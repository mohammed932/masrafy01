import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import { ScoringRepository } from '@/scoring/scoring.repository';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import { EngineService } from '@/matching/engine.service';
import { ScoringEngineVersionService } from '@/scoring-versions/scoring-versions.service';
import { loadActiveScoringConfig } from '@/applications/adapters/active-scoring-config.adapter';
import type { BankProgramSnapshot } from '@/matching/types';
import {
  computeProbability,
  defaultWeights,
  tierFor,
  type SubScores,
  type Weights,
} from '@/matching/scoring/approval-probability.scorer';
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
    private readonly scoring: ScoringRepository,
    private readonly programs: BankProgramRepository,
    private readonly engine: EngineService,
    private readonly scoringVersions: ScoringEngineVersionService,
  ) {}

  async preview(args: { category: LoanCategory; answers: SubmittedAnswerDto[] }) {
    const version = await this.questionnaire.activeVersion(args.category);
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    const snapshot = version.snapshot as unknown as Snapshot;

    const questions: SnapshotQuestion[] = [];
    for (const g of snapshot.groups ?? []) for (const q of g.questions ?? []) questions.push(q);
    const byCode = new Map(questions.map((q) => [q.code, q]));

    // Validate + build DIRECT factor sub-scores.
    const subScores: SubScores = {};
    for (const ans of args.answers) {
      const q = byCode.get(ans.questionCode);
      if (!q) throw new DomainException(ERROR_CODES.UNKNOWN_QUESTION_CODE, { code: ans.questionCode });
      const opt = q.options.find((o) => o.code === ans.optionCode);
      if (!opt) throw new DomainException(ERROR_CODES.UNKNOWN_OPTION_CODE, { code: ans.optionCode });
      if (q.scoringFactorCode) {
        subScores[q.scoringFactorCode] = opt.scoreValue !== null ? Number(opt.scoreValue) : 0;
      }
    }

    const profile = buildApplicantProfile({
      category: args.category,
      questions: questions as unknown as SnapshotQuestionFull[],
      answers: args.answers,
    });

    const rows = (await this.programs.findAllActive()).filter(
      (p) => p.productCategory.toLowerCase() === args.category,
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

    const factorCodes = (await this.scoring.activeFactors(args.category)).map((f) => f.code);
    const matches: PreviewMatch[] = [];

    for (const offer of output.offers) {
      const programId = idByCode.get(offer.programCode) ?? null;
      const { probability, tier, usedDefault } = await this.scoreProgram(
        programId,
        subScores,
        factorCodes,
      );
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
      const { probability, tier, usedDefault } = await this.scoreProgram(
        programId,
        subScores,
        factorCodes,
      );
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

    return { category: args.category, matches, suggestions: output.suggestions ?? [] };
  }

  private async scoreProgram(
    programId: string | null,
    subScores: SubScores,
    factorCodes: string[],
  ): Promise<{ probability: number; tier: string; usedDefault: boolean }> {
    const active = programId ? await this.scoring.activeSet(programId) : null;
    const usedDefault = active === null;
    const weights: Weights = active
      ? (active.weights as Record<string, number>)
      : defaultWeights(factorCodes);
    const probability = Number(computeProbability(weights, subScores).toFixed(4));
    return { probability, tier: tierFor(probability), usedDefault };
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
