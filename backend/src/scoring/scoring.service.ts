import { Injectable } from '@nestjs/common';
import { LoanCategory, Prisma } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ScoringRepository } from './scoring.repository';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import type { ScoringWeightSet } from '@prisma/client';
import type { SaveWeightsDto } from './dto/scoring.dto';
import { normalizeWeights } from '@/matching/scoring/approval-probability.scorer';

export interface ScoringRequestContext {
  sourceIp: string | null;
  correlationId: string;
}

/** Bank + program identity surfaced to the admin so weights are labelled, not raw IDs. */
export interface ProgramMeta {
  programCode: string;
  friendlyName: string;
  friendlyNameAr: string | null;
  bankName: string;
  category: string; // lowercase LoanCategory
}

/** An answer option the admin assigns points to in the weights editor. */
export interface WeightableOptionView {
  code: string;
  labelAr: string;
  labelEn: string;
}

/** A question with its answer options for the weights editor (points per answer). */
export interface WeightableQuestionView {
  code: string;
  labelAr: string;
  labelEn: string;
  options: WeightableOptionView[];
}

export interface ProgramWeightsResult {
  program: ProgramMeta;
  active: ScoringWeightSet | null;
}

@Injectable()
export class ScoringService {
  constructor(
    private readonly repo: ScoringRepository,
    private readonly audit: AuditEventWriter,
    private readonly programs: BankProgramRepository,
    private readonly questionnaire: QuestionnaireRepository,
  ) {}

  // ---- Weightable answers (points-per-answer editor) ----------------------
  /** The category's questions with their answer options — each option a points input. */
  async listWeightableOptions(category: LoanCategory): Promise<WeightableQuestionView[]> {
    const questions = await this.questionnaire.questionsWithOptions(category);
    return questions.map((q) => ({
      code: q.code,
      labelAr: q.questionAr,
      labelEn: q.questionEn,
      options: q.options.map((o) => ({ code: o.code, labelAr: o.labelAr, labelEn: o.labelEn })),
    }));
  }

  // ---- Weight sets (direct save, v5.0.0) ----------------------------------
  async getProgramWeights(programId: string): Promise<ProgramWeightsResult> {
    const [program, active] = await Promise.all([
      this.programMeta(programId),
      this.repo.activeSet(programId),
    ]);
    // Upgrade legacy single-level rows to the v8 two-level shape for the editor.
    const normalized = active
      ? { ...active, weights: normalizeWeights(active.weights) as unknown as Prisma.JsonValue }
      : null;
    return { program, active: normalized };
  }

  /** Resolve a program's bank/program identity; throws typed error if unknown. */
  private async programMeta(programId: string): Promise<ProgramMeta> {
    const p = await this.programs.findById(programId);
    if (!p) throw new DomainException(ERROR_CODES.BANK_PROGRAM_INVALID);
    return {
      programCode: p.programCode,
      friendlyName: p.friendlyName,
      friendlyNameAr: p.friendlyNameAr ?? null,
      bankName: p.bankName,
      category: p.productCategory.toLowerCase(),
    };
  }

  /**
   * Save a program's two-level scoring (direct, no maker-checker): per-question
   * weights summing to 100 + per-answer scores 0..100. Validates the codes
   * exist, scores are in range, and weights sum to 100, then atomically archives
   * the prior ACTIVE set and activates the new versioned one.
   */
  async saveWeights(
    programId: string,
    dto: SaveWeightsDto,
    editorId: string,
    ctx: ScoringRequestContext,
  ): Promise<ScoringWeightSet> {
    const category = await this.repo.programCategory(programId);
    if (!category) throw new DomainException(ERROR_CODES.BANK_PROGRAM_INVALID);
    await this.assertKnownStructure(category, dto.weights);
    this.assertAnswerScoresInRange(dto.weights);
    this.assertQuestionWeightsSumTo100(dto.weights);

    const versionNumber = await this.repo.nextVersionNumber(programId);
    const saved = await this.repo.saveActiveTx({
      programId,
      versionNumber,
      weights: dto.weights as unknown as Prisma.InputJsonValue,
      editorId,
    });
    await this.audit.write({
      actorId: editorId,
      // targetId FKs StaffAccount — the saved weight-set id belongs in the
      // payload, and the program is linked via bankProgramId.
      targetId: null,
      bankProgramId: programId,
      eventType: AuditEventType.SCORING_WEIGHTS_SAVED,
      sourceIp: ctx.sourceIp,
      correlationId: ctx.correlationId,
      payload: { bankProgramId: programId, weightSetId: saved.id, versionNumber },
    });
    return saved;
  }

  history(programId: string) {
    return this.repo.listByProgram(programId);
  }

  // ---- Validation ---------------------------------------------------------
  /** Every question/option code referenced by the weights + scores must exist in the category. */
  private async assertKnownStructure(
    category: LoanCategory,
    weights: SaveWeightsDto['weights'],
  ): Promise<void> {
    const questions = await this.questionnaire.questionsWithOptions(category);
    const valid = new Map(questions.map((q) => [q.code, new Set(q.options.map((o) => o.code))]));
    for (const questionCode of Object.keys(weights.questionWeights)) {
      if (!valid.has(questionCode)) {
        throw new DomainException(ERROR_CODES.WEIGHTS_UNKNOWN_OPTION, { questionCode });
      }
    }
    for (const [questionCode, byOption] of Object.entries(weights.answerScores)) {
      const options = valid.get(questionCode);
      if (!options) {
        throw new DomainException(ERROR_CODES.WEIGHTS_UNKNOWN_OPTION, { questionCode });
      }
      for (const optionCode of Object.keys(byOption)) {
        if (!options.has(optionCode)) {
          throw new DomainException(ERROR_CODES.WEIGHTS_UNKNOWN_OPTION, { questionCode, optionCode });
        }
      }
    }
  }

  /** Every answer score must be a finite number within [0, 100] (decimals allowed). */
  private assertAnswerScoresInRange(weights: SaveWeightsDto['weights']): void {
    for (const [questionCode, byOption] of Object.entries(weights.answerScores)) {
      for (const [optionCode, score] of Object.entries(byOption)) {
        if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
          throw new DomainException(ERROR_CODES.WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE, {
            questionCode,
            optionCode,
            score,
          });
        }
      }
    }
  }

  /**
   * The program's question weights must each be in [0, 100] and sum to exactly
   * 100 (±0.1 for decimal noise).
   */
  private assertQuestionWeightsSumTo100(weights: SaveWeightsDto['weights']): void {
    let total = 0;
    for (const [questionCode, weight] of Object.entries(weights.questionWeights)) {
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 100) {
        throw new DomainException(ERROR_CODES.WEIGHTS_QUESTION_WEIGHT_SUM_INVALID, {
          questionCode,
          weight,
        });
      }
      total += weight;
    }
    const rounded = Math.round(total * 10) / 10;
    if (rounded !== 100) {
      throw new DomainException(ERROR_CODES.WEIGHTS_QUESTION_WEIGHT_SUM_INVALID, { total: rounded });
    }
  }
}
