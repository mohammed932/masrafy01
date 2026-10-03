/**
 * Feature 012 — "Use in calculation" on a QUESTION, and the "Used by" readout.
 *
 * Until now a question reached the money one of two ways: a code constant the engine reads
 * (amount, debts, employment …), or a `surrogate_fact` row bound to it that a programme's
 * table or a product's rule reads. Only a product's step ① could make the second link, so a
 * question authored on the question screens was stored, validated, used for visibility — and
 * read by no figure. This service makes the link from the question's side, and reports for
 * every question exactly what reads it.
 *
 * It writes ONE thing: `platform_enumeration.boundQuestionId` (plus the fact row when the
 * figure is new). The "what should it affect" choice on the screen is NOT stored — it is a
 * navigation to the bank-programme or product table where the bank's figures are typed, so
 * nothing here can claim an effect no table carries (the v16.3.0 lesson). Every write goes
 * through `PlatformEnumerationsAdminService`, never around it, so audit, cache and guards stay
 * one implementation; the unguarded `bound-question` repair route is not called.
 */
import { Injectable } from '@nestjs/common';
import { BANK_AXES } from '@/matching/pipeline/bank-relationship';
import { isReservedFactKey } from '@/matching/pipeline/fact-question-eligibility';
import { neededFactsOf, type NeededShape } from '@/matching/pipeline/product-needed-facts';
import {
  BUSINESS_AGE_QUESTION_CODE,
  CREDIT_CARD_LIMIT_QUESTION_CODE,
  DEBT_TYPES_QUESTION_CODE,
  EMPLOYMENT_TYPE_QUESTION_CODE,
  JOB_TENURE_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  OBLIGATION_ITEM_QUESTION_CODES,
  SALARY_TRANSFER_QUESTION_CODE,
} from '@/matching/pipeline/money-field-bindings';
import { I_SCORE_FACT_KEY } from '@/matching/pipeline/product-template';
import {
  PlatformEnumerationsAdminService,
  type AdminActor,
} from '@/platform-enumerations/platform-enumerations-admin.service';
import {
  PostgresPlatformEnumerationsRepository,
  type QuestionUsageInputs,
} from '@/platform-enumerations/postgres-platform-enumerations.repository';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  DomainException,
  EnumerationInUseException,
  QuestionFactAlreadyLinkedException,
  SurrogateFactAmbiguousForQuestionException,
  SurrogateFactKeyReservedException,
  SurrogateFactKeyTakenException,
  SurrogateFactQuestionTypeInvalidException,
  SurrogateFactShapeMismatchException,
} from '@/common/errors/domain.exceptions';
import { blueprintKeysAsking } from '../blueprints/product-blueprints';
import type {
  QuestionFactCandidateDto,
  QuestionFactLinkResultDto,
  QuestionUsageClass,
  QuestionUsageDetailDto,
  QuestionUsageDto,
  QuestionUsageReaderDto,
} from '../dto/question-facts.dto';
import {
  derivedFactKey,
  planBindFact,
  planLinkExisting,
  planUnlink,
  type AskFactInput,
  type AskQuestionInput,
  type AskRefusal,
  type AttachStep,
  type LinkRefusal,
} from './product-ask-plan';
import type { AskActor } from './product-asks.service';

const FACT_TYPE = 'surrogate_fact';
const QUESTION_LINK_SOURCE = { source: 'question_link' } as const;

/**
 * The questions the engine reads by a CODE CONSTANT — never typed here, assembled from the
 * constants themselves (A33: no hand-typed questionnaire codes).
 */
const ENGINE_QUESTION_CODES: ReadonlySet<string> = new Set<string>([
  ...Object.values(MONEY_FIELD_BINDINGS),
  DEBT_TYPES_QUESTION_CODE,
  ...OBLIGATION_ITEM_QUESTION_CODES,
  CREDIT_CARD_LIMIT_QUESTION_CODE,
  EMPLOYMENT_TYPE_QUESTION_CODE,
  JOB_TENURE_QUESTION_CODE,
  BUSINESS_AGE_QUESTION_CODE,
  SALARY_TRANSFER_QUESTION_CODE,
]);

type QuestionType = QuestionUsageInputs['questions'][number]['type'];

/** How a figure's live readers key it (see `shapeOf`). */
type FigureShape =
  | { kind: 'choice'; optionKeys: string[] }
  | { kind: 'number' }
  | { kind: 'mixed' }
  | { kind: 'unread' };

function candidateShape(shape: FigureShape): QuestionFactCandidateDto['shape'] {
  return shape.kind === 'mixed' ? 'unknown' : shape.kind;
}

function questionOptionCodes(code: string, inputs: QuestionUsageInputs): string[] {
  return inputs.questions.find((q) => q.code === code)?.optionCodes ?? [];
}

function adminActor(actor: AskActor): AdminActor {
  return { staffId: actor.id, sourceIp: actor.sourceIp };
}

@Injectable()
export class QuestionFactLinkService {
  constructor(
    private readonly enums: PlatformEnumerationsAdminService,
    private readonly repo: PostgresPlatformEnumerationsRepository,
  ) {}

  /** Every active pool question, classified. */
  async usage(): Promise<QuestionUsageDto[]> {
    const inputs = await this.repo.questionUsageInputs();
    return inputs.questions.map((q) => this.usageOf(q.code, inputs));
  }

  /** One question, with the figures it could answer instead of minting its own. */
  async detail(questionCode: string): Promise<QuestionUsageDetailDto> {
    const inputs = await this.repo.questionUsageInputs();
    return this.detailOf(questionCode, inputs);
  }

  /**
   * Link: the question answers a calculation figure. No `factKey` — the figure is the
   * question's own (reuse-first, else minted under the question code, exactly as a product
   * tick would). With one — an existing, unbound figure some table already reads.
   */
  async link(
    questionCode: string,
    factKey: string | undefined,
    actor: AskActor,
  ): Promise<QuestionFactLinkResultDto> {
    const inputs = await this.repo.questionUsageInputs();
    const question = this.askQuestion(questionCode, inputs);
    const facts = this.askFacts(inputs);
    const blueprintsAsking = blueprintKeysAsking(factKey ?? derivedFactKey(question));

    const plan =
      factKey === undefined
        ? planBindFact({ question, facts, blueprintsAsking, fileUnderProduct: false })
        : planLinkExisting({
            question,
            fact: facts.find((f) => f.key === factKey),
            questionFactKey: facts.find((f) => f.boundQuestionCode === question.code)?.key ?? null,
            blueprintsAsking,
          });
    if (plan.kind === 'refuse') throw this.refusalToException(plan.refusal, questionCode, factKey);

    // The shape test for an EXISTING figure: what its live readers key it by must be
    // something this question's answer can give, or every one of those tables would miss —
    // and a table that refuses on no match would refuse every applicant under it.
    if (factKey !== undefined && plan.steps.length > 0) {
      const misfit = this.misfitOf(
        factKey,
        question.type,
        questionOptionCodes(question.code, inputs),
        inputs,
      );
      if (misfit !== null) {
        throw new SurrogateFactShapeMismatchException({
          factKey,
          questionCode,
          expected: misfit.expected,
          questionType: question.type,
          unknownKeys: misfit.unknownKeys,
        });
      }
    }

    const changed = {
      factKey: plan.factKey,
      factCreated: false,
      factBound: false,
      factDeleted: false,
    };
    for (const step of plan.steps) await this.runStep(step, changed, actor);
    return { changed, state: await this.detail(questionCode) };
  }

  /**
   * Unlink: the question stops answering its figure. Refused while anything reads the figure
   * or a product asks it — through `surrogateFactReaders`, the delete guard's own answer.
   */
  async unlink(questionCode: string, actor: AskActor): Promise<QuestionFactLinkResultDto> {
    const inputs = await this.repo.questionUsageInputs();
    this.askQuestion(questionCode, inputs); // 404s an unknown code
    const factRow = inputs.facts.find((f) => f.boundQuestionCode === questionCode);
    const fact =
      factRow === undefined ? undefined : this.askFacts(inputs).find((f) => f.key === factRow.key);
    const readBy = fact === undefined ? [] : await this.repo.surrogateFactReaders(fact.key);
    const plan = planUnlink({ fact, readBy, productsAsking: factRow?.askedByProducts ?? [] });
    if (plan.kind === 'refuse')
      throw this.refusalToException(plan.refusal, questionCode, undefined);

    const changed = {
      factKey: factRow?.key ?? null,
      factCreated: false,
      factBound: false,
      factDeleted: false,
    };
    if (plan.kind === 'proceed' && factRow !== undefined) {
      if (plan.deleteFact) {
        // The EXISTING delete, so its guards, its audit event and its cache invalidation stay
        // one implementation.
        await this.enums.remove(factRow.id, adminActor(actor));
        changed.factDeleted = true;
      } else {
        await this.enums.setBoundQuestion(factRow.id, null, adminActor(actor));
      }
    }
    return { changed, state: await this.detail(questionCode) };
  }

  // ---- classification ------------------------------------------------------------------

  private usageOf(code: string, inputs: QuestionUsageInputs): QuestionUsageDto {
    const q = inputs.questions.find((x) => x.code === code);
    if (q === undefined)
      throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND, { questionCode: code });
    const fact = inputs.facts.find((f) => f.boundQuestionCode === code);
    // A derived bank axis has no registry binding: its question is named by the axis itself.
    const axisKeys = BANK_AXES.filter((axis) => axis.questionCode === code).map((a) => a.factKey);
    const factKeys = [...(fact ? [fact.key] : []), ...axisKeys];

    const readers: QuestionUsageReaderDto[] = [];
    for (const program of inputs.programs) {
      const reads = factKeys.flatMap((key) => program.surfaces.get(key) ?? []);
      if (reads.length === 0) continue;
      readers.push({
        kind: 'program',
        ref: program.programCode,
        bankName: program.bankName,
        programName: program.friendlyName,
        category: program.category,
        productKey: program.productKey,
        inherited: program.plansFromProduct,
        surfaces: [...new Set(reads.map((r) => r.surface))],
        // A bank axis never refuses blank: it reads the new-to-bank column.
        refusesWhenUnanswered:
          fact !== undefined &&
          (program.surfaces.get(fact.key) ?? []).some((r) => r.refusesWhenUnanswered),
      });
    }
    for (const rule of inputs.rules) {
      if (!factKeys.some((key) => rule.factKeys.includes(key))) continue;
      readers.push({
        kind: rule.type === 'surrogate_product' ? 'product_rule' : 'program_name_rule',
        ref: rule.key,
        surfaces: ['income_rule'],
        refusesWhenUnanswered: false,
      });
    }
    if (fact?.key === I_SCORE_FACT_KEY && inputs.platformIScoreMovesIncome) {
      readers.push({
        kind: 'platform_iscore',
        ref: I_SCORE_FACT_KEY,
        surfaces: ['income_rule'],
        refusesWhenUnanswered: false,
      });
    }

    const gates = inputs.questions
      .filter((other) => {
        const w = other.enabledWhen as { questionCode?: unknown } | null;
        return w !== null && typeof w === 'object' && w.questionCode === code;
      })
      .map((other) => other.code);

    const engineInput = ENGINE_QUESTION_CODES.has(code);
    let cls: QuestionUsageClass;
    if (readers.length > 0) cls = 'calculation';
    else if (engineInput) cls = 'engine';
    else if (factKeys.length > 0) cls = 'linked_unread';
    else if (gates.length > 0) cls = 'gate_only';
    else cls = 'none';

    return {
      questionCode: q.code,
      labelAr: q.labelAr,
      labelEn: q.labelEn,
      type: q.type,
      isRequired: q.isRequired,
      categories: q.categories,
      class: cls,
      engineInput,
      factKey: fact?.key ?? null,
      factLocked: fact !== undefined && (fact.systemOnly || isReservedFactKey(fact.key)),
      readers,
      askedByProducts: fact?.askedByProducts ?? [],
      gates,
      blankRefuses: q.isRequired
        ? []
        : readers.filter((r) => r.refusesWhenUnanswered).map((r) => r.ref),
    };
  }

  private detailOf(code: string, inputs: QuestionUsageInputs): QuestionUsageDetailDto {
    const usage = this.usageOf(code, inputs);
    const question = inputs.questions.find((q) => q.code === code);
    const candidates: QuestionFactCandidateDto[] = inputs.facts
      .filter(
        (f) =>
          f.boundQuestionCode === null && f.active && !f.systemOnly && !isReservedFactKey(f.key),
      )
      .map((f) => {
        const readerCount =
          inputs.programs.filter((p) => p.surfaces.has(f.key)).length +
          inputs.rules.filter((r) => r.factKeys.includes(f.key)).length;
        return {
          factKey: f.key,
          labelAr: f.labelAr,
          labelEn: f.labelEn,
          shape: readerCount === 0 ? 'unread' : candidateShape(this.shapeOf(f.key, inputs)),
          readerCount,
          unknownKeys:
            readerCount === 0 || question === undefined
              ? []
              : (this.misfitOf(f.key, question.type, question.optionCodes, inputs)?.unknownKeys ??
                []),
        };
      });
    return { ...usage, candidates, createKey: usage.factKey ?? derivedFactKey({ code }) };
  }

  /**
   * How the live readers key a figure. `choice` carries the union of the option keys its
   * tables are keyed by (empty when every keyed read is by class, or no keys are typed yet —
   * any choice question fits those). `mixed` is a figure read both by option and as a
   * number: no single question type fills it. `unread` when nothing reveals a shape.
   */
  private shapeOf(factKey: string, inputs: QuestionUsageInputs): FigureShape {
    const seen: NeededShape[] = [];
    const collect = (facts: ReturnType<typeof neededFactsOf>): void => {
      for (const f of facts) if (f.factKey === factKey) seen.push(f.shape);
    };
    collect(
      neededFactsOf({
        incomeRule: null,
        planDefaults: null,
        programs: inputs.programs.map((p) => p.tables),
      }),
    );
    for (const rule of inputs.rules) {
      if (!rule.factKeys.includes(factKey)) continue;
      collect(neededFactsOf({ incomeRule: rule.incomeRule, planDefaults: null, programs: [] }));
    }
    if (seen.length === 0) return { kind: 'unread' };
    if (seen.some((s) => s.kind === 'unknown' && s.mixed === true)) return { kind: 'mixed' };
    const hasNumber = seen.some((s) => s.kind === 'number');
    // An `unknown` that is not mixed is a keyed read whose keys are not the options.
    const hasChoice = seen.some((s) => s.kind !== 'number');
    if (hasNumber && hasChoice) return { kind: 'mixed' };
    if (hasNumber) return { kind: 'number' };
    const optionKeys: string[] = [];
    for (const s of seen) {
      if (s.kind !== 'choice') continue;
      for (const k of s.optionKeys) if (!optionKeys.includes(k)) optionKeys.push(k);
    }
    return { kind: 'choice', optionKeys };
  }

  /**
   * Why this question cannot answer the figure, or null when it can (plan A2): a number
   * read needs a NUMERIC question; an option read needs a choice question whose options
   * cover every key the tables are keyed by; a figure read both ways fits nothing.
   */
  private misfitOf(
    factKey: string,
    type: QuestionType,
    optionCodes: readonly string[],
    inputs: QuestionUsageInputs,
  ): { expected: 'number' | 'choice' | 'unknown'; unknownKeys: string[] } | null {
    const shape = this.shapeOf(factKey, inputs);
    switch (shape.kind) {
      case 'unread':
        return null;
      case 'mixed':
        return { expected: 'unknown', unknownKeys: [] };
      case 'number':
        return type === 'NUMERIC' ? null : { expected: 'number', unknownKeys: [] };
      case 'choice': {
        if (type === 'NUMERIC' || type === 'TEXT') return { expected: 'choice', unknownKeys: [] };
        const unknownKeys = shape.optionKeys.filter((k) => !optionCodes.includes(k));
        return unknownKeys.length === 0 ? null : { expected: 'choice', unknownKeys };
      }
    }
  }

  // ---- plan inputs / execution ---------------------------------------------------------

  private askQuestion(code: string, inputs: QuestionUsageInputs): AskQuestionInput {
    const q = inputs.questions.find((x) => x.code === code);
    if (q === undefined)
      throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND, { questionCode: code });
    return {
      id: q.id,
      code: q.code,
      labelAr: q.labelAr,
      labelEn: q.labelEn,
      type: q.type,
      isRequired: q.isRequired,
      categories: q.categories,
    };
  }

  private askFacts(inputs: QuestionUsageInputs): AskFactInput[] {
    return inputs.facts.map((f) => ({
      id: f.id,
      key: f.key,
      active: f.active,
      systemOnly: f.systemOnly,
      surrogateProductKey: f.surrogateProductKey,
      boundQuestionCode: f.boundQuestionCode,
    }));
  }

  private async runStep(
    step: AttachStep,
    changed: QuestionFactLinkResultDto['changed'],
    actor: AskActor,
  ): Promise<void> {
    if (step.op === 'createFact') {
      // Filed under NO product: the question screen authors a figure for the platform, and
      // `surrogateProductKey` means "this product's on/off switch governs it".
      await this.enums.create(
        { type: FACT_TYPE, key: step.factKey, labelAr: step.labelAr, labelEn: step.labelEn },
        adminActor(actor),
        QUESTION_LINK_SOURCE,
      );
      changed.factCreated = true;
      return;
    }
    if (step.op === 'bindFact') {
      const row = await this.repo.findByTypeAndKey(FACT_TYPE, step.factKey);
      if (!row) return;
      await this.enums.setBoundQuestion(row.id, step.questionCode, adminActor(actor));
      changed.factBound = true;
    }
    // `addAsk` / `addCategories` never come out of the planners this service calls.
  }

  private refusalToException(
    refusal: AskRefusal | LinkRefusal,
    questionCode: string,
    factKey: string | undefined,
  ): Error {
    switch (refusal.code) {
      case 'questionTypeInvalid':
        return new SurrogateFactQuestionTypeInvalidException({
          questionCode: refusal.questionCode,
          type: refusal.type,
          allowed: refusal.allowed,
        });
      case 'ambiguousFact':
        return new SurrogateFactAmbiguousForQuestionException({
          questionCode: refusal.questionCode,
          factKeys: refusal.factKeys,
        });
      case 'keyTaken':
        return new SurrogateFactKeyTakenException({
          questionCode: refusal.questionCode,
          factKey: refusal.factKey,
          boundQuestionCode: refusal.boundQuestionCode,
        });
      case 'blueprintOwnsKey':
        return new SurrogateFactKeyTakenException({
          questionCode: refusal.questionCode,
          factKey: refusal.factKey,
          boundQuestionCode: null,
        });
      case 'keyReserved':
        return new SurrogateFactKeyReservedException({
          questionCode: refusal.questionCode,
          factKey: refusal.factKey,
          reservedKeys: refusal.reservedKeys,
        });
      case 'alreadyLinked':
        return new QuestionFactAlreadyLinkedException({
          questionCode: refusal.questionCode,
          factKey: refusal.factKey,
        });
      case 'factNotFound':
        return new DomainException(ERROR_CODES.VALIDATION_FAILED, {
          field: 'factKey',
          reason: 'unknown_fact',
          value: factKey ?? null,
        });
      case 'factInUse':
        return new EnumerationInUseException({
          type: FACT_TYPE,
          key: refusal.factKey,
          references: refusal.readBy.length,
          usedBy: this.groupReaders(refusal.readBy),
        });
      default:
        return new DomainException(ERROR_CODES.VALIDATION_FAILED, {
          questionCode,
          reason: refusal.code,
        });
    }
  }

  private groupReaders(
    readers: readonly { source: string }[],
  ): { source: string; count: number }[] {
    const bySource = new Map<string, number>();
    for (const r of readers) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
    return [...bySource].map(([source, count]) => ({ source, count }));
  }
}
