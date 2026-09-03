/**
 * THE ASK DOOR — one operator click, one server-side unit of work.
 *
 * Step ① of a surrogate product's screen used to be a read-only list of what the blueprint
 * seed created, and adding an ask by hand was four client-orchestrated writes on a screen
 * that has since been deleted. This is that act as one composite call: pick a question from
 * the pool, and the product starts reading its answer.
 *
 * EVERY `platform_enumeration` WRITE GOES THROUGH `PlatformEnumerationsAdminService`, and
 * every `question_loan_category` write through `QuestionnaireService`. Not for tidiness: a
 * second write path would be a second set of rules — its own audit shape, its own cache
 * invalidation, its own idea of what is allowed — free to disagree with the first. What is
 * new here is the ORDER, the refusals, and the single publish.
 *
 * NOT ONE PRISMA TRANSACTION, and the reason `BlueprintService` already states applies
 * unchanged: the click spans four tables behind three services, one of which cuts a
 * questionnaire version. Holding that in one transaction means reaching past every one of
 * those services into the client. What makes it safe instead is that every step is
 * idempotent by key and every prefix state is coherent and self-describing:
 *
 *   fact created, not bound   → invisible to the engine's registry and to the grid; the
 *                               next tick finishes the job.
 *   bound, not asked          → a fact read by no rule. Nothing quotes differently.
 *   asked, not widened        → "read, but not asked in this loan type" — a state the
 *                               screen has words for and one tap to fix.
 *   widened, not published    → the ONE invisible prefix, reported as `published: false`
 *                               and rendered as a persistent alert rather than a toast.
 *                               Additive, so it fails in the safe direction.
 */
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { LoanCategory } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import {
  PlatformEnumerationsAdminService,
  type AdminActor,
} from '@/platform-enumerations/platform-enumerations-admin.service';
import { PostgresPlatformEnumerationsRepository } from '@/platform-enumerations/postgres-platform-enumerations.repository';
import { factsReadByIncomeRule } from '@/matching/pipeline/fact-readers';
import { factsReadBy } from '@/matching/pipeline/product-rule';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import { isBindableQuestionType } from '@/matching/pipeline/surrogate-fact-registry';
import { factQuestionIneligibleReason } from '@/matching/pipeline/fact-question-eligibility';
import { sortCategories } from '@/common/loan-category.util';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  DomainException,
  ProductAskBlueprintOwnedException,
  ProductAskReadByOwnRuleException,
  SurrogateFactAmbiguousForQuestionException,
  SurrogateFactKeyReservedException,
  SurrogateFactKeyTakenException,
  SurrogateFactQuestionInactiveException,
  SurrogateFactQuestionNotEligibleException,
  SurrogateFactQuestionTypeInvalidException,
  SurrogateFactWidenRequiredException,
  SurrogateProductNotFoundException,
  EnumerationInUseException,
} from '@/common/errors/domain.exceptions';
import { blueprintKeysAsking, isCapOnlyProductKey } from '../blueprints/product-blueprints';
import type {
  AskPoolQuestionDto,
  AskWriteResultDto,
  AttachProductAskDto,
  ProductAskDto,
  ProductAsksResponseDto,
} from '../dto/product-asks.dto';
import { ASK_SOURCE, ProductAsksRepository, type ProductAskRow } from './product-asks.repository';
import {
  derivedFactKey,
  planAttach,
  planDetach,
  type AskFactInput,
  type AskRefusal,
  type AttachStep,
} from './product-ask-plan';

const FACT_TYPE = 'surrogate_fact';
/** Named once, so the create call and the audit payload say the same thing. */
const PRODUCT_ASK_SOURCE = { source: 'product_ask' } as const;

/**
 * The actor as this controller passes it, translated once.
 *
 * `{ id }` on the wire side, `{ staffId }` in the registry service — the same translation
 * `BankProgramsService` already does for the product's on/off switch, in the same direction.
 */
export interface AskActor {
  id: string;
  sourceIp: string | null;
}

function adminActor(actor: AskActor): AdminActor {
  return { staffId: actor.id, sourceIp: actor.sourceIp };
}

@Injectable()
export class ProductAsksService {
  constructor(
    private readonly enums: PlatformEnumerationsAdminService,
    private readonly repo: PostgresPlatformEnumerationsRepository,
    private readonly asks: ProductAsksRepository,
    private readonly audit: AuditEventWriter,
    /**
     * `forwardRef` because `QuestionnaireModule` already imports `BankProgramsModule`'s
     * dependencies through `PlatformEnumerationsModule`; the cycle is the one this platform
     * already lives with wherever a registry write has to republish a questionnaire.
     */
    @Inject(forwardRef(() => QuestionnaireService))
    private readonly questionnaire: QuestionnaireService,
  ) {}

  /** Everything step ① renders. */
  async board(productKey: string): Promise<ProductAsksResponseDto> {
    const products = await this.repo.listSurrogateProducts();
    const product = products.find((p) => p.key === productKey);
    if (!product) {
      throw new SurrogateProductNotFoundException({
        key: productKey,
        activeKeys: products.filter((p) => p.active).map((p) => p.key),
      });
    }

    const [askRows, factRows, members, boundQuestions, pool, ruleRow] = await Promise.all([
      this.asks.asksFor(productKey),
      this.enums.listAll({ type: FACT_TYPE }),
      // The ACTIVE members carry what the row list cannot: the derived provenance of a
      // question's options (which registry list they came from, and its class axis), which
      // is what decides whether the values panel below the grid has anything to show.
      this.repo.getActiveMembers(FACT_TYPE),
      this.repo.boundQuestions({ type: FACT_TYPE }),
      this.repo.factCandidateQuestions(),
      this.repo.findSurrogateProduct(productKey),
    ]);

    const factsReadByRule = [...factsReadByIncomeRule(ruleRow?.incomeRule ?? null)].sort();
    const asked = new Map(askRows.map((row) => [row.factKey, row]));
    const alsoAskedBy = await this.asks.asksForFacts([...asked.keys()]);
    const readersByFact = new Map<string, readonly { source: string; ref: string }[]>();
    await Promise.all(
      [...asked.keys()].map(async (factKey) => {
        readersByFact.set(factKey, await this.repo.surrogateFactReaders(factKey));
      }),
    );

    const memberByKey = new Map(members.map((m) => [m.key, m]));
    const factByKey = new Map(factRows.map((row) => [row.key, row]));

    const asks: ProductAskDto[] = [...asked.values()].map((ask) => {
      const member = memberByKey.get(ask.factKey);
      const row = factByKey.get(ask.factKey);
      const bound = row ? boundQuestions.get(row.id) : undefined;
      const question = member?.boundQuestion ?? bound ?? null;
      const others = (alsoAskedBy.get(ask.factKey) ?? []).filter((key) => key !== productKey);
      const readers = (readersByFact.get(ask.factKey) ?? []).filter(
        // The product's own calculation is reported separately, as a different refusal with
        // a different fix — it is the one reader the operator can clear on this screen.
        (reader) => !(reader.source === 'surrogate_product' && reader.ref === productKey),
      );
      return {
        factKey: ask.factKey,
        source: ask.source,
        questionCode: question?.code ?? null,
        questionLabelAr: question?.labelAr ?? row?.labelAr ?? ask.factKey,
        questionLabelEn: question?.labelEn ?? row?.labelEn ?? ask.factKey,
        questionType: question?.type ?? null,
        questionActive: question?.active ?? false,
        askedIn: question ? sortCategories([...question.askedIn]) : [],
        listType: member?.boundQuestion?.optionsEnumerationType ?? null,
        parentListType: member?.boundQuestion?.parentEnumerationType ?? null,
        alsoAskedBy: others,
        detach: this.detachability({
          productKey,
          ask,
          fact: row ?? null,
          othersAsking: others,
          ownRuleStepIds: this.ownRuleStepIds(ruleRow?.incomeRule ?? null, ask.factKey),
          readers,
        }),
      };
    });

    const factKeyByQuestion = new Map<string, string>();
    for (const row of factRows) {
      const bound = boundQuestions.get(row.id);
      if (bound) factKeyByQuestion.set(bound.code, row.key);
    }
    const asksByProduct = await this.asks.asksByProduct();
    const productsByFact = new Map<string, string[]>();
    for (const [key, rows] of asksByProduct) {
      for (const row of rows) {
        const list = productsByFact.get(row.factKey) ?? [];
        list.push(key);
        productsByFact.set(row.factKey, list);
      }
    }

    const poolDtos: AskPoolQuestionDto[] = pool.map((q) => {
      const factKey = factKeyByQuestion.get(q.code) ?? null;
      const ineligible = this.poolIneligibleReason(q.type, q.code);
      const readers = factKey === null ? [] : (productsByFact.get(factKey) ?? []);
      return {
        code: q.code,
        labelAr: q.labelAr,
        labelEn: q.labelEn,
        type: q.type,
        isRequired: q.isRequired,
        categories: q.categories,
        eligible: ineligible === undefined,
        ...(ineligible === undefined ? {} : { ineligibleReason: ineligible }),
        factKey,
        askedByThisProduct: factKey !== null && asked.has(factKey),
        askedByOtherProducts: readers.filter((key) => key !== productKey),
      };
    });

    // The pool keeps the repository's own `displayOrder` — a card must not move because
    // somebody ticked it, so nothing is re-sorted here.
    return {
      productKey,
      labelAr: product.labelAr,
      labelEn: product.labelEn,
      active: product.active,
      capOnly: isCapOnlyProductKey(productKey),
      asks,
      pool: poolDtos,
      factsReadByRule,
    };
  }

  /**
   * Tick: this product starts reading a pool question's answer, and the loan types on the
   * rail start asking it.
   */
  async attach(
    productKey: string,
    questionCode: string,
    dto: AttachProductAskDto,
    actor: AskActor,
  ): Promise<AskWriteResultDto> {
    const products = await this.repo.listSurrogateProducts();
    const product = products.find((p) => p.key === productKey);
    if (!product) {
      throw new SurrogateProductNotFoundException({
        key: productKey,
        activeKeys: products.filter((p) => p.active).map((p) => p.key),
      });
    }

    const [pool, factRows, boundQuestions, askRows] = await Promise.all([
      this.repo.factCandidateQuestions(),
      this.enums.listAll({ type: FACT_TYPE }),
      this.repo.boundQuestions({ type: FACT_TYPE }),
      this.asks.asksFor(productKey),
    ]);

    const question = pool.find((q) => q.code === questionCode);
    const facts: AskFactInput[] = factRows.map((row) => ({
      id: row.id,
      key: row.key,
      active: row.active,
      systemOnly: row.systemOnly,
      surrogateProductKey: row.surrogateProductKey,
      boundQuestionCode: boundQuestions.get(row.id)?.code ?? null,
    }));

    const plan = planAttach({
      productKey,
      question,
      facts,
      askedFactKeys: askRows.map((row) => row.factKey),
      askIn: dto.askIn ?? [],
      // Keyed by the DERIVED FACT KEY, through the same function the plan derives it with,
      // rather than by the question code that happens to equal it today.
      blueprintsAsking: question === undefined ? [] : blueprintKeysAsking(derivedFactKey(question)),
    });
    if (plan.kind === 'refuse') throw await this.refusalToException(plan.refusal, questionCode);

    const changed = {
      factKey: plan.factKey,
      factCreated: false,
      factBound: false,
      askAdded: false,
      askRemoved: false,
      factDeleted: false,
      widened: [] as LoanCategory[],
      published: false,
    };

    for (const step of plan.steps) {
      await this.runAttachStep(step, productKey, changed, actor);
    }

    return { changed, state: await this.board(productKey) };
  }

  /**
   * Untick: this product stops reading the answer. The question is untouched, and so are the
   * loan types that ask it.
   */
  async detach(productKey: string, factKey: string, actor: AskActor): Promise<AskWriteResultDto> {
    const products = await this.repo.listSurrogateProducts();
    const product = products.find((p) => p.key === productKey);
    if (!product) {
      throw new SurrogateProductNotFoundException({
        key: productKey,
        activeKeys: products.filter((p) => p.active).map((p) => p.key),
      });
    }

    const [askRows, factRow, productsAsking, readers, ruleRow, boundQuestions] = await Promise.all([
      this.asks.asksFor(productKey),
      this.repo.findByTypeAndKey(FACT_TYPE, factKey),
      this.asks.productsAsking(factKey),
      this.repo.surrogateFactReaders(factKey),
      this.repo.findSurrogateProduct(productKey),
      this.repo.boundQuestions({ type: FACT_TYPE }),
    ]);

    const ask = askRows.find((row) => row.factKey === factKey);
    const plan = planDetach({
      productKey,
      factKey,
      ask: ask === undefined ? undefined : { source: ask.source },
      fact:
        factRow === null
          ? undefined
          : {
              id: factRow.id,
              key: factRow.key,
              active: factRow.active,
              systemOnly: factRow.systemOnly,
              surrogateProductKey: factRow.surrogateProductKey,
              boundQuestionCode: boundQuestions.get(factRow.id)?.code ?? null,
            },
      productsAsking,
      ownRuleStepIds: this.ownRuleStepIds(ruleRow?.incomeRule ?? null, factKey),
      // The product's own rule is refused by its own branch above, so it must not also be
      // counted here — it would turn a fixable incoherence into "in use by something else".
      readBy: readers.filter(
        (reader) => !(reader.source === 'surrogate_product' && reader.ref === productKey),
      ),
    });
    if (plan.kind === 'refuse') throw await this.refusalToException(plan.refusal, null);

    const changed = {
      factKey,
      factCreated: false,
      factBound: false,
      askAdded: false,
      askRemoved: false,
      factDeleted: false,
      widened: [] as LoanCategory[],
      published: false,
    };

    if (plan.kind === 'proceed') {
      for (const step of plan.steps) {
        if (step.op === 'removeAsk') {
          changed.askRemoved = await this.asks.removeAskByKeys(productKey, step.factKey);
        } else if (factRow) {
          // The EXISTING delete, so its three guards, its audit event (which carries both
          // labels — once the row is gone that event is the only record the key existed)
          // and its cache invalidation all stay one implementation.
          await this.enums.remove(factRow.id, adminActor(actor));
          changed.factDeleted = true;
        }
      }
    }

    // No category write and no publish, deliberately, and the response says so by echoing
    // an unchanged `widened`. Narrowing what a question is asked for belongs on
    // `/questionnaire/categories`, where it is the whole point of the surface.
    return { changed, state: await this.board(productKey) };
  }

  private async runAttachStep(
    step: AttachStep,
    productKey: string,
    changed: AskWriteResultDto['changed'],
    actor: AskActor,
  ): Promise<void> {
    switch (step.op) {
      case 'createFact': {
        await this.enums.create(
          {
            type: FACT_TYPE,
            key: step.factKey,
            labelAr: step.labelAr,
            labelEn: step.labelEn,
            ...(step.fileUnderProduct ? { surrogateProductKey: productKey } : {}),
          },
          adminActor(actor),
          PRODUCT_ASK_SOURCE,
        );
        changed.factCreated = true;
        return;
      }
      case 'bindFact': {
        const row = await this.repo.findByTypeAndKey(FACT_TYPE, step.factKey);
        if (!row) return;
        await this.enums.setBoundQuestion(row.id, step.questionCode, adminActor(actor));
        changed.factBound = true;
        return;
      }
      case 'addAsk': {
        // Both ends resolved by KEY inside the repository, so this path and the seed's own
        // ask pass share one lookup rather than each holding a copy of it.
        const outcome = await this.asks.addAskByKeys({
          productKey,
          factKey: step.factKey,
          source: ASK_SOURCE.operator,
          createdBy: actor.id,
        });
        changed.askAdded = outcome === 'added';
        return;
      }
      case 'addCategories': {
        const result = await this.questionnaire.addQuestionCategories(
          step.questionId,
          step.categories,
          actor.id,
        );
        changed.widened = sortCategories(result.added);
        changed.published = result.published;
        if (result.added.length > 0) {
          // The category half of the click, audited on the FACT row so one target carries
          // the whole gesture. Not a new `AuditEventType`: each value costs an `ALTER TYPE`,
          // and `PLATFORM_ENUMERATION_UPDATED` with a named `changes` key is the shape every
          // other assignment write here already uses.
          const factRow = await this.repo.findByTypeAndKey(FACT_TYPE, changed.factKey);
          await this.audit.write({
            actorId: actor.id,
            targetId: null,
            eventType: AuditEventType.PLATFORM_ENUMERATION_UPDATED,
            sourceIp: actor.sourceIp,
            payload: {
              type: FACT_TYPE,
              key: changed.factKey,
              id: factRow?.id ?? null,
              questionCode: step.questionCode,
              changes: { askedIn: { added: sortCategories(result.added) } },
              source: PRODUCT_ASK_SOURCE.source,
            },
          });
        }
        return;
      }
    }
  }

  /**
   * Why the answers to a question cannot be a fact — the shape of the answer first, then
   * the figure it holds.
   *
   * The same two functions the server refuses on, so the card's reason and the 422 are one
   * statement rather than two that can drift.
   */
  private poolIneligibleReason(
    type: AskPoolQuestionDto['type'],
    code: string,
  ): AskPoolQuestionDto['ineligibleReason'] | undefined {
    if (!isBindableQuestionType(type)) {
      return type === 'TEXT' ? 'text' : 'multi_select';
    }
    return factQuestionIneligibleReason(code);
  }

  /** Step and gate ids in one stored rule that read a fact. */
  private ownRuleStepIds(rule: unknown, factKey: string): string[] {
    if (!rule || typeof rule !== 'object') return [];
    const walkable = rule as ProductRule;
    if (walkable.steps !== undefined && !Array.isArray(walkable.steps)) return [];
    if (walkable.gates !== undefined && !Array.isArray(walkable.gates)) return [];
    if (!factsReadBy(walkable).includes(factKey)) {
      // A single-fact rule names its fact in the strategy token and has no steps to name.
      return factsReadByIncomeRule(rule).has(factKey) ? ['(the whole calculation)'] : [];
    }
    const ids: string[] = [];
    for (const step of walkable.steps ?? []) {
      if (step.fact === factKey) ids.push(step.id);
    }
    for (const gate of walkable.gates ?? []) {
      if ('fact' in gate && gate.fact === factKey) ids.push(gate.id);
      if ('keyedBy' in gate && gate.keyedBy === factKey) ids.push(gate.id);
    }
    return ids.length > 0 ? ids : ['(the whole calculation)'];
  }

  /** Whether an ask can be removed on this screen, decided server-side and served. */
  private detachability(args: {
    productKey: string;
    ask: ProductAskRow;
    fact: { systemOnly: boolean; surrogateProductKey: string | null } | null;
    othersAsking: readonly string[];
    ownRuleStepIds: readonly string[];
    readers: readonly { source: string; ref: string }[];
  }): ProductAskDto['detach'] {
    if (args.ask.source === ASK_SOURCE.blueprint) {
      return { ok: false, reason: 'blueprint_owned', meta: { productKey: args.productKey } };
    }
    if (args.ownRuleStepIds.length > 0) {
      return { ok: false, reason: 'read_by_own_rule', meta: { stepIds: [...args.ownRuleStepIds] } };
    }
    const wouldDelete =
      args.fact !== null &&
      args.othersAsking.length === 0 &&
      !args.fact.systemOnly &&
      args.fact.surrogateProductKey === args.productKey;
    if (wouldDelete && args.readers.length > 0) {
      return { ok: false, reason: 'fact_still_read', meta: { readBy: [...args.readers] } };
    }
    return { ok: true };
  }

  private async refusalToException(
    refusal: AskRefusal,
    questionCode: string | null,
  ): Promise<Error> {
    switch (refusal.code) {
      case 'questionInactive': {
        // "Not in the ACTIVE pool" is two different things with two different fixes, and
        // the plan cannot tell them apart — it is handed the active pool and nothing else.
        // A code that names NO question is a stale client or a hand-made request; a code
        // that names a parked one is a question somebody switched off, and telling the
        // operator to switch it back on is only true in the second case. One extra read,
        // on the refusal path only.
        const code = refusal.questionCode || (questionCode ?? '');
        const question = await this.repo.findBindableQuestion(code);
        if (question === null) {
          throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND, { questionCode: code });
        }
        return new SurrogateFactQuestionInactiveException({ questionCode: code });
      }
      case 'questionTypeInvalid':
        return new SurrogateFactQuestionTypeInvalidException({
          questionCode: refusal.questionCode,
          type: refusal.type,
          allowed: refusal.allowed,
        });
      case 'questionNotEligible':
        return new SurrogateFactQuestionNotEligibleException({
          questionCode: refusal.questionCode,
          reason: refusal.reason,
        });
      case 'widenRequired':
        return new SurrogateFactWidenRequiredException({
          questionCode: refusal.questionCode,
          categories: refusal.categories,
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
      case 'keyReserved':
        return new SurrogateFactKeyReservedException({
          questionCode: refusal.questionCode,
          factKey: refusal.factKey,
          reservedKeys: refusal.reservedKeys,
        });
      case 'blueprintOwnsKey':
        // The key belongs to a blueprint that declares it for a DIFFERENT question, so the
        // operator's tick would repoint that product. Reported as the taken key it is, with
        // the blueprints named, rather than as a fourth near-identical code.
        return new SurrogateFactKeyTakenException({
          questionCode: refusal.questionCode,
          factKey: refusal.factKey,
          boundQuestionCode: null,
        });
      case 'blueprintOwnsAsk':
        return new ProductAskBlueprintOwnedException({
          productKey: refusal.productKey,
          factKey: refusal.factKey,
        });
      case 'readByOwnRule':
        return new ProductAskReadByOwnRuleException({
          productKey: refusal.productKey,
          factKey: refusal.factKey,
          stepIds: refusal.stepIds,
        });
      case 'factInUse':
        return new EnumerationInUseException({
          type: FACT_TYPE,
          key: refusal.factKey,
          references: refusal.readBy.length,
          usedBy: [...this.groupReaders(refusal.readBy)],
        });
    }
  }

  private groupReaders(
    readers: readonly { source: string; ref: string }[],
  ): { source: string; count: number }[] {
    const bySource = new Map<string, number>();
    for (const reader of readers) {
      bySource.set(reader.source, (bySource.get(reader.source) ?? 0) + 1);
    }
    return [...bySource].map(([source, count]) => ({ source, count }));
  }
}
