import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ScoringRepository } from './scoring.repository';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import { Decimal } from '@prisma/client/runtime/library';
import type { QuestionType, ScoringWeightSet } from '@prisma/client';
import type { SaveWeightsDto } from './dto/scoring.dto';
import {
  isMultiSelectAggregation,
  normalizeWeights,
  MULTI_SELECT_AGGREGATIONS,
  type NumericBand,
} from '@/matching/scoring/approval-probability.scorer';

export interface ScoringRequestContext {
  sourceIp: string | null;
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

/** A question the admin can weight, with whatever its type needs to be scored. */
export interface WeightableQuestionView {
  code: string;
  labelAr: string;
  labelEn: string;
  /** Decides which scoring control the editor renders (v14.0.0 — every type scores). */
  type: QuestionType;
  /**
   * Loan categories that ASK this question (lowercase). The editor compares
   * these against the program's own category: weighting a question outside the
   * list configures something this program's applicants never see.
   */
  categories: string[];
  /** Both choice types. Empty for NUMERIC / TEXT. */
  options: WeightableOptionView[];
  /** NUMERIC only — the editor seeds band edges from the question's own bounds. */
  numericMinValue: string | null;
  numericMaxValue: string | null;
  numericUnitAr: string | null;
  numericUnitEn: string | null;
  /** TEXT only. */
  textMaxLength: number | null;
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

  // ---- Weightable answers (assign + score editor) -------------------------
  /**
   * Every question in the GLOBAL pool with its answer options. The admin ticks
   * which questions this program scores on (assignment) and sets a weight +
   * per-answer scores for each ticked one.
   *
   * Deliberately NOT filtered to the program's category — an admin may tick a
   * question before its category assignment catches up, and hiding it would
   * make that impossible. Each question carries its `categories` instead, so
   * the editor can warn about a mismatch without forbidding it.
   */
  async listWeightableOptions(): Promise<WeightableQuestionView[]> {
    const questions = await this.questionnaire.questionsWithOptions();
    // EVERY type is offered (Constitution V, v14.0.0). Each carries what its own
    // scoring control needs: options for the choice types, bounds + unit for
    // NUMERIC, max length for TEXT. Filtering to SINGLE_SELECT here is what kept
    // income, existing debts, amount and term out of every match score.
    return questions.map((q) => ({
      code: q.code,
      labelAr: q.questionAr,
      labelEn: q.questionEn,
      type: q.type,
      categories: q.categories.map((c) => c.toLowerCase()),
      options: q.options.map((o) => ({ code: o.code, labelAr: o.labelAr, labelEn: o.labelEn })),
      numericMinValue: q.numericMinValue,
      numericMaxValue: q.numericMaxValue,
      numericUnitAr: q.numericUnitAr,
      numericUnitEn: q.numericUnitEn,
      textMaxLength: q.textMaxLength,
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
   * weights summing to 100 + the per-type rule each weighted question is scored
   * by (option scores, multi-select aggregation, numeric bands, text presence).
   * The set of questions in `questionWeights` IS the program's assignment
   * (checkbox → weight-set membership, Feature 010). Validates the codes exist in
   * the global pool and match their rules' types, every weighted question has a
   * rule, scores are in range, and weights sum to 100 — then atomically archives
   * the prior ACTIVE set and activates the new versioned one.
   */
  async saveWeights(
    programId: string,
    dto: SaveWeightsDto,
    editorId: string,
    ctx: ScoringRequestContext,
  ): Promise<ScoringWeightSet> {
    const program = await this.programs.findById(programId);
    if (!program) throw new DomainException(ERROR_CODES.BANK_PROGRAM_INVALID);
    await this.assertKnownStructure(dto.weights);
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
      payload: { bankProgramId: programId, weightSetId: saved.id, versionNumber },
    });
    return saved;
  }

  history(programId: string) {
    return this.repo.listByProgram(programId);
  }

  // ---- Validation ---------------------------------------------------------
  /**
   * Every code referenced by the weights + rules must exist in the global pool,
   * every rule block must sit on a question of the matching type, and every
   * WEIGHTED question must carry a usable rule for its own type.
   *
   * That last check is the one that earns its keep: a weighted question with no
   * rule consumes its share of the asked-weight denominator and can never earn
   * anything back, so the program is capped below 100% with nothing on screen to
   * say why. Before v14.0.0 an option map could be omitted exactly like that and
   * nothing complained.
   */
  private async assertKnownStructure(weights: SaveWeightsDto['weights']): Promise<void> {
    const questions = await this.questionnaire.questionsWithOptions();
    const valid = new Map(questions.map((q) => [q.code, new Set(q.options.map((o) => o.code))]));
    const typeByCode = new Map(questions.map((q) => [q.code, q.type]));

    const requireKnown = (questionCode: string): QuestionType => {
      const type = typeByCode.get(questionCode);
      if (type === undefined) {
        throw new DomainException(ERROR_CODES.WEIGHTS_UNKNOWN_OPTION, { questionCode });
      }
      return type;
    };
    const requireType = (
      questionCode: string,
      expected: QuestionType,
      rule: string,
    ): void => {
      const actual = requireKnown(questionCode);
      if (actual !== expected) {
        throw new DomainException(ERROR_CODES.WEIGHTS_RULE_TYPE_MISMATCH, {
          questionCode,
          rule,
          expectedType: expected,
          type: actual,
        });
      }
    };

    // Option scores belong to the two choice types, and every option code must
    // be one this question actually offers.
    for (const [questionCode, byOption] of Object.entries(weights.answerScores ?? {})) {
      const type = requireKnown(questionCode);
      if (type !== 'SINGLE_SELECT' && type !== 'MULTI_SELECT') {
        throw new DomainException(ERROR_CODES.WEIGHTS_RULE_TYPE_MISMATCH, {
          questionCode,
          rule: 'answerScores',
          type,
        });
      }
      const options = valid.get(questionCode) ?? new Set<string>();
      for (const optionCode of Object.keys(byOption)) {
        if (!options.has(optionCode)) {
          throw new DomainException(ERROR_CODES.WEIGHTS_UNKNOWN_OPTION, {
            questionCode,
            optionCode,
          });
        }
      }
    }

    for (const [questionCode, rule] of Object.entries(weights.multiSelectRules ?? {})) {
      requireType(questionCode, 'MULTI_SELECT', 'multiSelectRules');
      if (!isMultiSelectAggregation(rule?.aggregation)) {
        throw new DomainException(ERROR_CODES.WEIGHTS_RULE_TYPE_MISMATCH, {
          questionCode,
          rule: 'multiSelectRules.aggregation',
          aggregation: rule?.aggregation ?? null,
          allowed: MULTI_SELECT_AGGREGATIONS,
        });
      }
    }

    for (const [questionCode, bands] of Object.entries(weights.numericBands ?? {})) {
      requireType(questionCode, 'NUMERIC', 'numericBands');
      this.assertNumericBands(questionCode, bands);
    }

    for (const questionCode of Object.keys(weights.textRules ?? {})) {
      requireType(questionCode, 'TEXT', 'textRules');
    }

    // Finally: each weighted question must be configured for its own type.
    for (const questionCode of Object.keys(weights.questionWeights)) {
      const type = requireKnown(questionCode);
      this.assertHasRule(questionCode, type, weights);
    }
  }

  /**
   * A weighted question must carry the rule its type is scored by, or it can
   * never earn the weight the admin gave it.
   */
  private assertHasRule(
    questionCode: string,
    type: QuestionType,
    weights: SaveWeightsDto['weights'],
  ): void {
    const missing = (rule: string): never => {
      throw new DomainException(ERROR_CODES.WEIGHTS_MISSING_RULE, { questionCode, type, rule });
    };
    switch (type) {
      case 'SINGLE_SELECT':
      case 'MULTI_SELECT': {
        const byOption = weights.answerScores?.[questionCode];
        if (!byOption || Object.keys(byOption).length === 0) missing('answerScores');
        return;
      }
      case 'NUMERIC': {
        const bands = weights.numericBands?.[questionCode];
        if (!bands || bands.length === 0) missing('numericBands');
        return;
      }
      case 'TEXT': {
        if (weights.textRules?.[questionCode] === undefined) missing('textRules');
        return;
      }
    }
  }

  /**
   * Bands are half-open `[from, to)`, ordered ascending, and must tile the line
   * without gaps: the first opens at −∞ (`from: null`), the last closes at +∞
   * (`to: null`), and each band starts exactly where the previous one ended.
   *
   * Full coverage is required rather than warned about because an uncovered value
   * scores nothing while still costing its weight — the applicant would be
   * penalised for answering inside a hole in the configuration.
   */
  private assertNumericBands(questionCode: string, bands: NumericBand[]): void {
    const fail = (reason: string, index?: number): never => {
      throw new DomainException(ERROR_CODES.WEIGHTS_NUMERIC_BANDS_INVALID, {
        questionCode,
        reason,
        ...(index !== undefined ? { index } : {}),
      });
    };
    if (!Array.isArray(bands) || bands.length === 0) fail('no_bands');

    let previousTo: Decimal | null = null;
    for (const [index, band] of bands.entries()) {
      if (!band || typeof band !== 'object') fail('malformed_band', index);
      const from = this.parseBandEdge(band.from);
      const to = this.parseBandEdge(band.to);
      if (band.from != null && from === null) fail('unparseable_from', index);
      if (band.to != null && to === null) fail('unparseable_to', index);
      if (from && to && to.lessThanOrEqualTo(from)) fail('empty_or_reversed_band', index);

      if (index === 0) {
        if (from !== null) fail('first_band_must_open_at_minus_infinity', index);
      } else if (from === null) {
        fail('only_the_first_band_may_open_at_minus_infinity', index);
      } else if (previousTo === null) {
        fail('band_after_an_unbounded_band', index);
      } else if (!from.equals(previousTo)) {
        // Both a gap and an overlap land here — either way two adjacent bands
        // disagree about who owns the values between them.
        fail(from.greaterThan(previousTo) ? 'gap_before_band' : 'overlapping_band', index);
      }

      if (index === bands.length - 1) {
        if (to !== null) fail('last_band_must_close_at_plus_infinity', index);
      } else if (to === null) {
        fail('only_the_last_band_may_close_at_plus_infinity', index);
      }
      previousTo = to;
    }
  }

  private parseBandEdge(raw: string | null | undefined): Decimal | null {
    if (raw == null) return null;
    try {
      const d = new Decimal(raw);
      return d.isFinite() ? d : null;
    } catch {
      return null;
    }
  }

  /**
   * Every score must be a finite number within [0, 100] (decimals allowed) —
   * option scores, numeric band scores, and the TEXT presence score alike.
   */
  private assertAnswerScoresInRange(weights: SaveWeightsDto['weights']): void {
    const check = (questionCode: string, score: unknown, meta: Record<string, unknown>): void => {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
        throw new DomainException(ERROR_CODES.WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE, {
          questionCode,
          score,
          ...meta,
        });
      }
    };
    for (const [questionCode, byOption] of Object.entries(weights.answerScores ?? {})) {
      for (const [optionCode, score] of Object.entries(byOption)) {
        check(questionCode, score, { optionCode });
      }
    }
    for (const [questionCode, bands] of Object.entries(weights.numericBands ?? {})) {
      for (const [index, band] of (bands ?? []).entries()) {
        check(questionCode, band?.score, { bandIndex: index });
      }
    }
    for (const [questionCode, rule] of Object.entries(weights.textRules ?? {})) {
      check(questionCode, rule?.answeredScore, { rule: 'textRules.answeredScore' });
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
