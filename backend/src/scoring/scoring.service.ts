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
    return { program, active };
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
   * Save per-answer points for a program (direct, no maker-checker). Validates
   * the keys are active answer-option codes in the category and that every point
   * is within [1, 100] (decimals allowed), then atomically archives the prior
   * ACTIVE set and activates the new one. No sum constraint — points are
   * normalised by max-achievable at score time.
   */
  async saveWeights(
    programId: string,
    dto: SaveWeightsDto,
    editorId: string,
    ctx: ScoringRequestContext,
  ): Promise<ScoringWeightSet> {
    const category = await this.repo.programCategory(programId);
    if (!category) throw new DomainException(ERROR_CODES.BANK_PROGRAM_INVALID);
    await this.assertKnownOptions(category, dto.weights);
    this.assertPointsInRange(dto.weights);

    const versionNumber = await this.repo.nextVersionNumber(programId);
    const saved = await this.repo.saveActiveTx({
      programId,
      versionNumber,
      weights: dto.weights as unknown as Prisma.InputJsonValue,
      editorId,
    });
    await this.audit.write({
      actorId: editorId,
      targetId: saved.id,
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
  private async assertKnownOptions(
    category: LoanCategory,
    weights: Record<string, Record<string, number>>,
  ): Promise<void> {
    const questions = await this.questionnaire.questionsWithOptions(category);
    const valid = new Map(questions.map((q) => [q.code, new Set(q.options.map((o) => o.code))]));
    for (const [questionCode, byOption] of Object.entries(weights)) {
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

  /** Every per-answer point must be a finite number within [1, 100] (decimals allowed). */
  private assertPointsInRange(weights: Record<string, Record<string, number>>): void {
    for (const [questionCode, byOption] of Object.entries(weights)) {
      for (const [optionCode, points] of Object.entries(byOption)) {
        if (typeof points !== 'number' || !Number.isFinite(points) || points < 1 || points > 100) {
          throw new DomainException(ERROR_CODES.WEIGHTS_POINTS_OUT_OF_RANGE, {
            questionCode,
            optionCode,
            points,
          });
        }
      }
    }
  }
}
