import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import { ScoringRepository } from '@/scoring/scoring.repository';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import {
  computeProbability,
  defaultWeights,
  tierFor,
  type SubScores,
  type Weights,
} from '@/matching/scoring/approval-probability.scorer';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';

interface SnapshotOption {
  code: string;
  scoreValue: string | null;
  numericPoint: string | null;
}
interface SnapshotQuestion {
  code: string;
  scoringFactorCode: string | null;
  systemRole: string | null;
  options: SnapshotOption[];
}
interface Snapshot {
  category: string;
  versionNumber: number;
  groups: { questions: SnapshotQuestion[] }[];
}

export interface PreviewMatch {
  bankProgramId: string;
  programCode: string;
  bankName: string;
  bankIsFeatured: boolean;
  programFriendlyName: string;
  approvalProbability: number;
  approvalTier: string;
  usedDefaultWeights: boolean;
}

/**
 * Mobile matching preview (Spec §5.2). Validates submitted answers against the
 * active questionnaire snapshot, then ranks active programs by the NEW approval
 * probability (per-option scoreValue × per-bank ACTIVE weight set, Principle V
 * v4.1.0). Eligibility hard-gates + installment math reuse the feature-003
 * engine and are layered in a follow-up; this returns the scored ranking.
 */
@Injectable()
export class MatchingPreviewService {
  constructor(
    private readonly questionnaire: QuestionnaireRepository,
    private readonly scoring: ScoringRepository,
    private readonly programs: BankProgramRepository,
  ) {}

  async preview(args: {
    category: LoanCategory;
    answers: SubmittedAnswerDto[];
  }): Promise<{ category: LoanCategory; matches: PreviewMatch[] }> {
    const version = await this.questionnaire.activeVersion(args.category);
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    const snapshot = version.snapshot as unknown as Snapshot;

    const questionByCode = new Map<string, SnapshotQuestion>();
    for (const g of snapshot.groups ?? []) {
      for (const q of g.questions ?? []) questionByCode.set(q.code, q);
    }

    // Validate answers + build DIRECT factor sub-scores from chosen options.
    const subScores: SubScores = {};
    for (const ans of args.answers) {
      const q = questionByCode.get(ans.questionCode);
      if (!q) throw new DomainException(ERROR_CODES.UNKNOWN_QUESTION_CODE, { code: ans.questionCode });
      const opt = q.options.find((o) => o.code === ans.optionCode);
      if (!opt) throw new DomainException(ERROR_CODES.UNKNOWN_OPTION_CODE, { code: ans.optionCode });
      if (q.scoringFactorCode) {
        subScores[q.scoringFactorCode] = opt.scoreValue !== null ? Number(opt.scoreValue) : 0;
      }
    }

    const factorCodes = (await this.scoring.activeFactors(args.category)).map((f) => f.code);
    const programs = (await this.programs.findAllActive()).filter(
      (p) => p.productCategory.toLowerCase() === args.category,
    );

    const matches: PreviewMatch[] = [];
    for (const p of programs) {
      const active = await this.scoring.activeSet(p.id);
      const usedDefaultWeights = active === null;
      const weights: Weights = active
        ? (active.weights as Record<string, number>)
        : defaultWeights(factorCodes);
      const probability = computeProbability(weights, subScores);
      matches.push({
        bankProgramId: p.id,
        programCode: p.programCode,
        bankName: p.bankName,
        bankIsFeatured: p.bank?.isFeatured ?? false,
        programFriendlyName: p.friendlyName,
        approvalProbability: Number(probability.toFixed(4)),
        approvalTier: tierFor(probability),
        usedDefaultWeights,
      });
    }

    // Rank: probability desc, then featured first (Spec §5.4 ranking tail).
    matches.sort((a, b) => {
      if (b.approvalProbability !== a.approvalProbability) {
        return b.approvalProbability - a.approvalProbability;
      }
      return Number(b.bankIsFeatured) - Number(a.bankIsFeatured);
    });

    return { category: args.category, matches };
  }
}
