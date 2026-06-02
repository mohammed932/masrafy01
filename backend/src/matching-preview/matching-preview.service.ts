import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import { WeightedApprovalScoringService } from '@/scoring/weighted-approval.service';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import { EngineService } from '@/matching/engine.service';
import { ScoringEngineVersionService } from '@/scoring-versions/scoring-versions.service';
import { loadActiveScoringConfig } from '@/applications/adapters/active-scoring-config.adapter';
import type { BankProgramSnapshot } from '@/matching/types';
import type { SubScores } from '@/matching/scoring/approval-probability.scorer';
import {
  buildApplicantProfile,
  type SnapshotQuestionFull,
} from './answer-to-profile';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';

interface SnapshotOption {
  code: string;
  scoreValue: string | null;
  numericPoint: string | null;
  profileValue: string | null;
}
interface SnapshotQuestion {
  code: string;
  scoringFactorCode: string | null;
  systemRole: string | null;
  profileField: string | null;
  options: SnapshotOption[];
}
interface Snapshot {
  category: string;
  groups: { questions: SnapshotQuestion[] }[];
}

export interface PreviewMatch {
  bankProgramId: string | null;
  programCode: string;
  bankName: string;
  bankIsFeatured: boolean;
  programFriendlyName: string;
  eligible: boolean;
  monthlyInstallmentEGP: string | null;
  effectiveRatePercent: string | null;
  approvalProbability: number;
  approvalTier: string;
  rejectionReasons: string[];
  requiredDocuments: string[];
  usedDefaultWeights: boolean;
}

/**
 * Mobile matching preview (Spec §5.2). Validates answers against the active
 * snapshot, bridges them to an `ApplicantProfile`, runs the feature-003 engine
 * for eligibility + installment + fees + suggestions, then OVERRIDES each
 * eligible offer's approval probability with the new per-bank weighted scoring
 * (Principle V v4.1.0). JWT-gated (no guest).
 */
@Injectable()
export class MatchingPreviewService {
  constructor(
    private readonly questionnaire: QuestionnaireRepository,
    private readonly weightedScoring: WeightedApprovalScoringService,
    private readonly programs: BankProgramRepository,
    private readonly engine: EngineService,
    private readonly scoringVersions: ScoringEngineVersionService,
  ) {}

  /** Mobile preview: profile derived entirely from the submitted answers. */
  async preview(args: { category: LoanCategory; answers: SubmittedAnswerDto[] }) {
    const { subScores, questions } = await this.resolveSubScores(args.category, args.answers);
    const profile = buildApplicantProfile({
      category: args.category,
      questions: questions as unknown as SnapshotQuestionFull[],
      answers: args.answers,
    });
    return this.runAndAssemble(args.category, profile, subScores);
  }

  /** Validate answers against the active snapshot + build DIRECT sub-scores. */
  private async resolveSubScores(
    category: LoanCategory,
    answers: SubmittedAnswerDto[],
  ): Promise<{ subScores: SubScores; questions: SnapshotQuestion[] }> {
    const version = await this.questionnaire.activeVersion(category);
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    const snapshot = version.snapshot as unknown as Snapshot;
    const questions: SnapshotQuestion[] = [];
    for (const g of snapshot.groups ?? []) for (const q of g.questions ?? []) questions.push(q);
    const byCode = new Map(questions.map((q) => [q.code, q]));
    const subScores: SubScores = {};
    for (const ans of answers) {
      const q = byCode.get(ans.questionCode);
      if (!q) throw new DomainException(ERROR_CODES.UNKNOWN_QUESTION_CODE, { code: ans.questionCode });
      const opt = q.options.find((o) => o.code === ans.optionCode);
      if (!opt) throw new DomainException(ERROR_CODES.UNKNOWN_OPTION_CODE, { code: ans.optionCode });
      if (q.scoringFactorCode) {
        subScores[q.scoringFactorCode] = opt.scoreValue !== null ? Number(opt.scoreValue) : 0;
      }
    }
    return { subScores, questions };
  }

  /** Run the engine over the category's active programs + weighted scoring. */
  private async runAndAssemble(
    category: LoanCategory,
    profile: ReturnType<typeof buildApplicantProfile>,
    subScores: SubScores,
  ) {
    const rows = (await this.programs.findAllActive()).filter(
      (p) => p.productCategory.toLowerCase() === category,
    );
    const idByCode = new Map(rows.map((p) => [p.programCode, p.id]));
    const snapshots = rows.map((p) => toSnapshot(p));

    const scoringConfig = await loadActiveScoringConfig(this.scoringVersions);
    const output = this.engine.run({
      profile,
      programs: snapshots,
      scoringConfig,
      correlationId: randomUUID(),
    });

    // DBR cap per program (percent) — feeds the COMPUTED `debt_burden` factor.
    const dbrCapByCode = new Map(
      snapshots.map((s) => [s.programCode, s.eligibility.dbrCapPercent]),
    );
    const matches: PreviewMatch[] = [];

    for (const offer of output.offers) {
      const programId = idByCode.get(offer.programCode) ?? null;
      const { probability, tier, usedDefault } = await this.weightedScoring.scoreProgram({
        programId,
        category,
        directSubScores: subScores,
        computed: {
          dbrPercent: Number(offer.dbrPercent),
          dbrCapPercent: dbrCapByCode.get(offer.programCode) ?? null,
        },
      });
      matches.push({
        bankProgramId: programId,
        programCode: offer.programCode,
        bankName: offer.bankName,
        bankIsFeatured: offer.bankIsFeatured,
        programFriendlyName: offer.programFriendlyName,
        eligible: true,
        monthlyInstallmentEGP: offer.monthlyInstallmentEGP.toFixed(2),
        effectiveRatePercent: offer.effectiveRatePercent.toFixed(4),
        approvalProbability: probability,
        approvalTier: tier,
        rejectionReasons: [],
        requiredDocuments: offer.requiredDocuments,
        usedDefaultWeights: usedDefault,
      });
    }

    for (const nm of output.noMatchDetails ?? []) {
      const row = rows.find((p) => p.programCode === nm.programCode);
      const programId = idByCode.get(nm.programCode) ?? null;
      // No eligible offer → no DBR figure; debt_burden contributes 0.
      const { probability, tier, usedDefault } = await this.weightedScoring.scoreProgram({
        programId,
        category,
        directSubScores: subScores,
        computed: { dbrPercent: null, dbrCapPercent: dbrCapByCode.get(nm.programCode) ?? null },
      });
      matches.push({
        bankProgramId: programId,
        programCode: nm.programCode,
        bankName: row?.bankName ?? '',
        bankIsFeatured: row?.bank?.isFeatured ?? false,
        programFriendlyName: row?.friendlyName ?? '',
        eligible: false,
        monthlyInstallmentEGP: null,
        effectiveRatePercent: null,
        approvalProbability: probability,
        approvalTier: tier,
        rejectionReasons: nm.failedChecks,
        requiredDocuments: [],
        usedDefaultWeights: usedDefault,
      });
    }

    matches.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (b.approvalProbability !== a.approvalProbability) {
        return b.approvalProbability - a.approvalProbability;
      }
      return Number(b.bankIsFeatured) - Number(a.bankIsFeatured);
    });

    return { category, matches, suggestions: output.suggestions ?? [] };
  }
}

type ProgramRow = Awaited<ReturnType<BankProgramRepository['findAllActive']>>[number];

/** Map a BankProgram row (feature-002 JSON) into the engine snapshot. */
function toSnapshot(p: ProgramRow): BankProgramSnapshot {
  return {
    id: p.id,
    programCode: p.programCode,
    bankName: p.bankName,
    bankIsFeatured: p.bank?.isFeatured ?? false,
    friendlyName: p.friendlyName,
    programType: p.programType,
    productCategory: p.productCategory,
    currencies: (p.currencies as string[]) ?? [],
    active: p.active,
    version: p.version,
    requiredDocuments: (p.requiredDocuments as string[]) ?? [],
    createdAt: p.createdAt,
    tenor: p.tenor as unknown as BankProgramSnapshot['tenor'],
    loanLimits: p.loanLimits as unknown as BankProgramSnapshot['loanLimits'],
    pricing: p.pricing as unknown as BankProgramSnapshot['pricing'],
    eligibility: p.eligibility as unknown as BankProgramSnapshot['eligibility'],
    incomeAssumption: p.incomeAssumption as unknown as BankProgramSnapshot['incomeAssumption'],
    fees: p.fees as unknown as BankProgramSnapshot['fees'],
    performanceCriteria: p.performanceCriteria as unknown as
      | BankProgramSnapshot['performanceCriteria']
      | undefined,
  };
}
