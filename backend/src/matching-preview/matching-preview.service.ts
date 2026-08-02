import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import { WeightedApprovalScoringService } from '@/scoring/weighted-approval.service';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import type { SelectedAnswer } from '@/matching/scoring/approval-probability.scorer';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';
import { validateAnswer } from '@/questionnaire/validation/answer-validation';

interface SnapshotOption {
  code: string;
}
interface SnapshotQuestion {
  code: string;
  /** Absent on a pre-010 snapshot — read as SINGLE_SELECT (FR-045). */
  type?: string | null;
  options: SnapshotOption[];
  numeric?: { minValue?: string | null; maxValue?: string | null; step?: string | null } | null;
  text?: { maxLength?: number | null } | null;
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
  isShariaCompliant: boolean;
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
 * Mobile matching preview (MVP). Validates the submitted answers against the
 * active questionnaire snapshot, then ranks EVERY active program in the category
 * by the per-bank per-answer weighted score (Principle V). Eligibility gating is
 * dropped — there are no hard filters; all programs are returned. JWT-gated.
 */
@Injectable()
export class MatchingPreviewService {
  constructor(
    private readonly questionnaire: QuestionnaireRepository,
    private readonly weightedScoring: WeightedApprovalScoringService,
    private readonly programs: BankProgramRepository,
  ) {}

  async preview(args: { category: LoanCategory; answers: SubmittedAnswerDto[] }) {
    const answers = await this.resolveSelectedOptions(args.answers);
    return this.runAndAssemble(args.category, answers);
  }

  /**
   * Validate answers against the active GLOBAL snapshot and return the pairs the
   * scorer consumes.
   *
   * Feature 010: the pool holds all four question types, so every answer is
   * validated through the shared `validateAnswer` (same rules as apply — type,
   * bounds, option membership). Only SINGLE_SELECT carries an answer score (R9),
   * so multi-pick / text / number answers are validated and then dropped from
   * the scoring input rather than rejected — they exist to feed the figures.
   *
   * `isRequired` is forced off: preview and the admin simulator accept a PARTIAL
   * answer set by design; required-question enforcement belongs to apply.
   */
  private async resolveSelectedOptions(answers: SubmittedAnswerDto[]): Promise<SelectedAnswer[]> {
    const version = await this.questionnaire.activeVersion();
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    const snapshot = version.snapshot as unknown as Snapshot;
    const questions: SnapshotQuestion[] = [];
    for (const g of snapshot.groups ?? []) for (const q of g.questions ?? []) questions.push(q);
    const byCode = new Map(questions.map((q) => [q.code, q]));
    const selected: SelectedAnswer[] = [];
    for (const ans of answers) {
      const q = byCode.get(ans.questionCode);
      if (!q)
        throw new DomainException(ERROR_CODES.UNKNOWN_QUESTION_CODE, { code: ans.questionCode });
      const normalised = validateAnswer(
        {
          code: q.code,
          type: q.type,
          isRequired: false,
          optionCodes: (q.options ?? []).map((o) => o.code),
          numeric: q.numeric ?? null,
          text: q.text ?? null,
        },
        ans,
      );
      if (normalised?.selectedOptionCode) {
        selected.push({ questionCode: q.code, optionCode: normalised.selectedOptionCode });
      }
    }
    return selected;
  }

  /** Score every active program in the category and rank by approval probability. */
  private async runAndAssemble(category: LoanCategory, answers: SelectedAnswer[]) {
    const rows = (await this.programs.findAllActive()).filter(
      (p) => p.productCategory.toLowerCase() === category,
    );

    const matches: PreviewMatch[] = [];
    for (const p of rows) {
      const { probability, tier, usedDefault } = await this.weightedScoring.scoreProgram({
        programId: p.id,
        category,
        answers,
      });
      matches.push({
        bankProgramId: p.id,
        programCode: p.programCode,
        bankName: p.bankName,
        bankIsFeatured: p.bank?.isFeatured ?? false,
        isShariaCompliant: p.isShariaCompliant,
        programFriendlyName: p.friendlyName,
        eligible: true,
        monthlyInstallmentEGP: null,
        effectiveRatePercent: null,
        approvalProbability: probability,
        approvalTier: tier,
        rejectionReasons: [],
        requiredDocuments: (p.requiredDocuments as string[]) ?? [],
        usedDefaultWeights: usedDefault,
      });
    }

    matches.sort((a, b) => {
      if (b.approvalProbability !== a.approvalProbability) {
        return b.approvalProbability - a.approvalProbability;
      }
      return Number(b.bankIsFeatured) - Number(a.bankIsFeatured);
    });

    return { category, matches, suggestions: [] };
  }
}
