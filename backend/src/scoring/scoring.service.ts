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

/** A scored question row for the weights editor (admins weight by question). */
export interface ScoredQuestionView {
  code: string;
  labelAr: string;
  labelEn: string;
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

  // ---- Scored questions (weight rows) -------------------------------------
  /** The category's scored questions — one weight row each in the editor. */
  async listScoredQuestions(category: LoanCategory): Promise<ScoredQuestionView[]> {
    const questions = await this.questionnaire.scoredQuestions(category);
    return questions.map((q) => ({ code: q.code, labelAr: q.questionAr, labelEn: q.questionEn }));
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
   * Save per-question weights for a program (direct, no maker-checker). Validates
   * the keys are the category's scored questions and that they sum to exactly 100,
   * then atomically archives the prior ACTIVE set and activates the new one.
   */
  async saveWeights(
    programId: string,
    dto: SaveWeightsDto,
    editorId: string,
    ctx: ScoringRequestContext,
  ): Promise<ScoringWeightSet> {
    const category = await this.repo.programCategory(programId);
    if (!category) throw new DomainException(ERROR_CODES.BANK_PROGRAM_INVALID);
    await this.assertKnownQuestions(category, dto.weights);
    this.assertSums100(dto.weights);

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
  private async assertKnownQuestions(
    category: LoanCategory,
    weights: Record<string, number>,
  ): Promise<void> {
    const valid = new Set((await this.questionnaire.scoredQuestions(category)).map((q) => q.code));
    for (const code of Object.keys(weights)) {
      if (!valid.has(code)) {
        throw new DomainException(ERROR_CODES.WEIGHTS_UNKNOWN_QUESTION, { questionCode: code });
      }
    }
  }

  private assertSums100(weights: Record<string, number>): void {
    const total = Object.values(weights).reduce((a, b) => a + Number(b), 0);
    if (Math.round(total * 1000) / 1000 !== 100) {
      throw new DomainException(ERROR_CODES.WEIGHTS_MUST_SUM_TO_100, { total });
    }
  }
}
