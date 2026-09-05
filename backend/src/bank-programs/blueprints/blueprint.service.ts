/**
 * Creating a predefined product: the plan, executed.
 *
 * Every write goes through the SAME service an operator's clicks go through —
 * `PlatformEnumerationsAdminService` for lists, values and facts, `QuestionnaireService` for
 * questions and assignments, `BankProgramsService` for the calculation. A second, quieter
 * write path would be a second set of rules, free to disagree with the first about what is
 * allowed: it would skip the refusals, the audit events and the cache invalidations, and the
 * first thing an operator would notice is a product that saves clean and quotes nothing.
 *
 * ─── One publish, at the end ──────────────────────────────────────────────────
 *
 * A questionnaire publish embeds every option of every question in one snapshot, so cutting
 * one per created question means six versions of a questionnaire nobody served in between —
 * and version history is how an operator reads what they did. So the two callees publish
 * nothing (`{ publish: false }`) and this service publishes once, only if anything moved.
 *
 * ─── Not one transaction, and why that is the honest answer ───────────────────
 *
 * A list, a question and a fact live in three tables behind three services, one of which cuts
 * a questionnaire version. Holding all of that open in one Prisma transaction would mean
 * reaching past every one of those services into the client — the thing the paragraph above
 * exists to refuse. What makes a partial run safe instead is that the plan is IDEMPOTENT by
 * key: whatever landed, landed, and running the same create again writes exactly the rest.
 * The plan is also computed and reported BEFORE the first write, so a refusal that would
 * strand a figure is raised while nothing has been written at all.
 */

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import type { LoanCategory } from '@prisma/client';
import { DomainException } from '../../common/errors/domain.exceptions';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { PlatformEnumerationsAdminService } from '../../platform-enumerations/platform-enumerations-admin.service';
import type { AdminActor } from '../../platform-enumerations/platform-enumerations-admin.service';
import { PlatformEnumerationsRepository } from '../../platform-enumerations/platform-enumerations.repository';
import { QuestionnaireService } from '../../questionnaire/questionnaire.service';
import { BankProgramsService } from '../bank-programs.service';
import { slugify } from '../../questionnaire/slug.util';
import { planBlueprint, askCategories, askQuestionCode } from './blueprint-plan';
import type { BlueprintExistingState, BlueprintPlan } from './blueprint-plan';
import { waySlot, waysOf } from '../../matching/pipeline/product-template';
import { productBlueprint, productBlueprints } from './product-blueprints';
import type { ProductBlueprint } from './product-blueprint.types';
import type {
  ProductBlueprintAskDto,
  ProductBlueprintDto,
  CreateFromBlueprintResultDto,
} from '../dto/product-blueprint.dto';

const SURROGATE_PRODUCT_TYPE = 'surrogate_product';
/** Named once, so both create calls below say the same thing. */
const BLUEPRINT_SOURCE = { source: 'blueprint' } as const;
const SURROGATE_FACT_TYPE = 'surrogate_fact';

@Injectable()
export class BlueprintService {
  constructor(
    private readonly enums: PlatformEnumerationsAdminService,
    private readonly repo: PlatformEnumerationsRepository,
    @Inject(forwardRef(() => QuestionnaireService))
    private readonly questionnaire: QuestionnaireService,
    @Inject(forwardRef(() => BankProgramsService))
    private readonly programs: BankProgramsService,
  ) {}

  /**
   * The library, with what each product would have to CREATE and what is already there.
   *
   * The existence half is the point: an operator picking a product should read "asks three
   * things, two already set up" before they commit, not discover afterwards that a question
   * they wanted reworded was reused. Structure only — the words and the worked examples are
   * the admin bundle's, keyed by these same blueprint keys.
   */
  async list(): Promise<ProductBlueprintDto[]> {
    const existing = await this.readState();
    return productBlueprints().map((blueprint) => this.project(blueprint, existing));
  }

  /**
   * Build one, in the order the foreign keys allow.
   *
   * ITS ONE CALLER is now `npm run seed:blueprints` (`blueprint-seed.command.ts`): there is
   * no HTTP door onto this, because a no-payslip product is not something an operator
   * creates — the eleven predefined ones are seeded and the decision left is which of them
   * this platform sells. Kept as a service rather than folded into the command precisely so
   * a seeded product is written by the same code, with the same refusals and the same single
   * questionnaire publish, that an operator's clicks used to go through.
   *
   * The name and `key` come from the BLUEPRINT. `key` follows from the name if the caller
   * states none, and it is the one thing here that is immutable afterwards — it is what a
   * bank's program row points at (`program_name.surrogateProductKey`), which is why the seed
   * states it explicitly rather than letting it be slugged.
   */
  async createFromBlueprint(
    input: { blueprintKey: string; key?: string; labelEn?: string; labelAr?: string },
    actor: { staffId: string; sourceIp: string | null },
    // POSITIONAL and third, exactly like `BLUEPRINT_SOURCE` below and for the same reason:
    // no request body can reach it. `'retemplate'` REPLACES the calculation of a product
    // that already holds one, which is the promise `blueprint-seed-plan.ts` makes to the
    // operator — so it is reachable only from a command that names the product and asks for
    // it (`blueprint-retemplate.command.ts`), never from the seed and never from a click.
    options: { onExistingProduct?: 'refuse' | 'retemplate' } = {},
  ): Promise<CreateFromBlueprintResultDto> {
    const blueprint = productBlueprint(input.blueprintKey);
    if (!blueprint) {
      throw new DomainException(ERROR_CODES.PRODUCT_BLUEPRINT_UNKNOWN, {
        blueprintKey: input.blueprintKey,
        available: productBlueprints().map((b) => b.key),
      });
    }

    const existing = await this.readState();
    const makesProduct = blueprint.template !== null;
    // A cap-only blueprint creates no product, so it needs no name. One that does create one
    // needs BOTH names: a product with an English label and no Arabic one is unreadable in
    // the primary locale, and every screen that lists it would fall back to the other.
    if (makesProduct && (!input.labelEn || !input.labelAr)) {
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
        field: input.labelEn ? 'labelAr' : 'labelEn',
        reason: 'required_for_a_product',
      });
    }
    // `slugify`, never `uniqueSlug`: a second product called the same thing would mint
    // `compound_owner_2`, permanently, and every bank program filed under it would point at
    // a key nobody meant. A key that is taken is a refusal the operator can act on.
    const productKey = makesProduct ? (input.key ?? slugify(input.labelEn as string)) : null;
    if (productKey !== null && productKey === '') {
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, { field: 'labelEn' });
    }
    if (productKey !== null && existing.productKeys.has(productKey)) {
      // A product that already has a CALCULATION is somebody's work, and `setProductTemplate`
      // below would replace it — so the name is refused and the operator picks another or
      // opens the one that exists.
      //
      // A bare row with no calculation is the other case entirely: it is what a run that
      // failed part-way through leaves behind (the row is written first, so a fact can say
      // which product it belongs to). Refusing that would make the retry impossible and the
      // row unfinishable, which is the opposite of what the idempotence is for.
      //
      // `onExistingProduct: 'retemplate'` is the third case and the only one that overwrites
      // somebody's work: a caller that has named this product, seen what a recompile would
      // drop, and said so. The write still goes through `setSurrogateProductTemplate`, so
      // the orphan check, the validator and the audit event all run as they always do.
      const row = await this.repo.findSurrogateProduct(productKey);
      const retemplating = options.onExistingProduct === 'retemplate' && row !== null;
      if (!retemplating && (row === null || row.incomeRule !== null)) {
        throw new DomainException(ERROR_CODES.ENUMERATION_KEY_DUPLICATE, {
          type: SURROGATE_PRODUCT_TYPE,
          key: productKey,
        });
      }
    }

    const plan = planBlueprint({
      blueprint,
      productKey,
      productLabelEn: input.labelEn ?? '',
      productLabelAr: input.labelAr ?? '',
      existing,
    });

    const created: CreateFromBlueprintResultDto['created'] = {
      lists: [],
      values: 0,
      questions: [],
      facts: [],
      widened: [],
      revived: [],
    };
    // Resolved as the plan runs: a fact created for a question created moments earlier needs
    // that question's id, and a widening names a question this run may have just made.
    const questionIdByCode = new Map(
      (await this.questionnaire.questionAssignments()).map((q) => [q.code, q.id]),
    );
    let publishNeeded = false;
    /** A planned code the service minted differently, so a later step follows the real one. */
    const mintedCode = new Map<string, string>();
    /**
     * Lists this run actually added rows to.
     *
     * The PLAN says which mirrored lists it expects to touch; this says which ones were
     * written. They differ in the case that matters: a list the plan did not know was
     * mirrored (the link is stamped in the same run) still needs its question re-synced.
     */
    const touchedTypes = new Set<string>(plan.touchedMirroredTypes);
    /**
     * `surrogate_fact` row ids by key, read at most once and only if a bind needs one —
     * `setBoundQuestion` addresses a row by id while everything else here speaks keys.
     *
     * A local, never a field: this provider is a singleton, so state on `this` would be
     * shared by two operators creating two products at the same moment.
     */
    let factRowIds: Map<string, string> | null = null;
    const factRowId = async (key: string): Promise<string | undefined> => {
      factRowIds ??= new Map(
        (await this.enums.listAll({ type: SURROGATE_FACT_TYPE })).map((row) => [row.key, row.id]),
      );
      return factRowIds.get(key);
    };

    for (const step of plan.steps) {
      switch (step.op) {
        case 'createProductRow':
          await this.enums.create(
            {
              type: SURROGATE_PRODUCT_TYPE,
              key: step.key,
              labelEn: step.labelEn,
              labelAr: step.labelAr,
            },
            actor,
            // The library is the ONLY thing allowed to create a product or a fact
            // (`SEEDED_ONLY_TYPES`). Positional and third, so no request body can claim it.
            BLUEPRINT_SOURCE,
          );
          break;

        case 'createType':
          await this.enums.createType(
            {
              key: step.typeKey,
              labelEn: step.labelEn,
              labelAr: step.labelAr,
              ...(step.parentTypeKey !== undefined ? { parentTypeKey: step.parentTypeKey } : {}),
              ...(step.fallbackParentKey !== undefined
                ? { fallbackParentKey: step.fallbackParentKey }
                : {}),
            },
            actor,
          );
          break;

        case 'createValues': {
          // ONE call for the whole list, and that is not a micro-optimisation. A value write
          // to a MIRRORED list re-syncs the question whose options it is, and that publishes:
          // seven values created one at a time cut seven questionnaire versions, which is the
          // per-write publish the bulk endpoint exists to avoid. `deferMirrorSync` puts the
          // sync off entirely — this service does it once per touched list at the end, then
          // publishes once.
          const result = await this.enums.createValuesBulk(
            {
              type: step.typeKey,
              deferMirrorSync: true,
              rows: step.values.map((value) => ({
                // Stated, never slugged: `slugify('Major General')` is `major_general`, and
                // the key a bank's figures are filed under is `grade_major_general`.
                key: value.key,
                labelEn: value.labelEn,
                labelAr: value.labelAr,
                ...(value.parentKey !== undefined ? { parentKey: value.parentKey } : {}),
              })),
            },
            actor,
          );
          created.values += result.created;
          if (result.created > 0) touchedTypes.add(step.typeKey);
          break;
        }

        case 'linkMirror':
          await this.enums.linkMirrorQuestion(step.typeKey, step.questionCode, actor);
          break;

        case 'reactivateQuestion': {
          const id = questionIdByCode.get(step.questionCode);
          if (id === undefined) break;
          await this.questionnaire.updateQuestion(id, { isActive: true }, actor.staffId, {
            publish: false,
          });
          created.revived.push(step.questionCode);
          publishNeeded = true;
          break;
        }

        case 'createQuestion': {
          // The code comes BACK from the service, which slugs it from the English wording. It
          // matches the code the plan derived in every case the plan actually creates one —
          // the plan only creates when that slug is free — but it is read from the response
          // rather than assumed, because binding a fact to the wrong question is silent: the
          // rule would read an answer to a different question and quote a plausible figure.
          const question = await this.questionnaire.createQuestionWithOptions(
            {
              type: step.type,
              questionEn: step.questionEn,
              questionAr: step.questionAr,
              ...(step.helperEn !== undefined ? { helperTextEn: step.helperEn } : {}),
              ...(step.helperAr !== undefined ? { helperTextAr: step.helperAr } : {}),
              // Not required unless the blueprint says so, and the default is the safe
              // direction: a no-payslip product usually asks about something the applicant
              // may simply not have, and a required question blocks the questionnaire for
              // everyone it is visible to — including the people the product is not for.
              // A blueprint stating `required` has accepted that, for that one ask.
              isRequired: step.required === true,
              categories: step.categories,
              ...(step.optionsFromEnumerationType !== undefined
                ? { optionsFromEnumerationType: step.optionsFromEnumerationType }
                : {}),
              ...(step.numeric !== undefined
                ? {
                    numeric: {
                      minValue: String(step.numeric.min),
                      maxValue: String(step.numeric.max),
                    },
                  }
                : {}),
              ...(step.enabledWhen !== undefined
                ? {
                    enabledWhen: {
                      questionCode: step.enabledWhen.questionCode,
                      operator: 'equals' as const,
                      optionCode: step.enabledWhen.optionCode,
                    },
                  }
                : {}),
            },
            actor.staffId,
            { publish: false },
          );
          questionIdByCode.set(question.code, question.id);
          if (question.code !== step.questionCode) mintedCode.set(step.questionCode, question.code);
          created.questions.push(question.code);
          publishNeeded = true;
          break;
        }

        case 'bindFact': {
          const questionCode = mintedCode.get(step.questionCode) ?? step.questionCode;
          const rowId = await factRowId(step.factKey);
          // Gone between the read and the write. Nothing to bind, and nothing to report: the
          // next run plans the create instead.
          if (rowId === undefined) break;
          await this.enums.setBoundQuestion(rowId, questionCode, actor);
          created.facts.push(step.factKey);
          break;
        }

        case 'createFact': {
          const questionCode = mintedCode.get(step.questionCode) ?? step.questionCode;
          const labels = await this.factLabels(questionCode, step.labelEn, step.labelAr);
          const fact = await this.enums.create(
            {
              type: SURROGATE_FACT_TYPE,
              key: step.factKey,
              labelEn: labels.labelEn,
              labelAr: labels.labelAr,
              ...(step.surrogateProductKey !== undefined
                ? { surrogateProductKey: step.surrogateProductKey }
                : {}),
            },
            actor,
            BLUEPRINT_SOURCE,
          );
          // The binding is what makes the row a FACT rather than a label: it is the join the
          // engine reads an answer through. Two writes because the create endpoint has no
          // field for it, which is also why a half-run leaves a fact the screen shows as
          // unbound rather than one silently reading the wrong question.
          await this.enums.setBoundQuestion(fact.id, questionCode, actor);
          created.facts.push(step.factKey);
          break;
        }

        case 'widenCategories': {
          const id = questionIdByCode.get(mintedCode.get(step.questionCode) ?? step.questionCode);
          // A question the blueprint names and the pool does not have. Not an error: the
          // product it belongs to may simply not be built yet, and refusing here would block
          // a create over a question this product does not read.
          if (id === undefined) break;
          await this.questionnaire.setQuestionCategoriesBulk(
            [{ questionId: id, categories: step.categories as LoanCategory[] }],
            actor.staffId,
            { publish: false },
          );
          created.widened.push(step.questionCode);
          publishNeeded = true;
          break;
        }

        case 'setProductTemplate':
          // Last, and through the real template endpoint, so the compile, the validator and
          // the orphan check all run exactly as they do for a hand-filled form.
          await this.programs.setSurrogateProductTemplate(
            step.key,
            {
              template: {
                ...(blueprint.template as object),
                blueprintKey: blueprint.key,
              } as Record<string, unknown>,
            },
            { id: actor.staffId, sourceIp: actor.sourceIp },
          );
          break;
      }
      if (step.op === 'createType') created.lists.push(step.typeKey);
    }

    // The lists whose values ARE a question's options, re-synced once each. `publish: false`
    // for the same reason as above; the single publish below covers every one of them.
    for (const typeKey of touchedTypes) {
      const changed = await this.questionnaire.syncMirroredOptions(typeKey, actor.staffId, {
        publish: false,
      });
      if (changed) publishNeeded = true;
    }
    if (publishNeeded) await this.questionnaire.publishNow(actor.staffId);

    return {
      blueprintKey: blueprint.key,
      productKey,
      capFactKey: blueprint.cap?.factKey ?? null,
      created,
      reused: plan.reuse,
      publishedQuestionnaire: publishNeeded,
    };
  }

  /**
   * A fact row's labels.
   *
   * A blueprint that authors the question states them; one that binds a fact to a question
   * somebody else authored does not, and taking that question's own wording is better than
   * inventing a name for it — the operator reads the two side by side on the product screen.
   */
  private async factLabels(
    questionCode: string,
    labelEn: string | undefined,
    labelAr: string | undefined,
  ): Promise<{ labelEn: string; labelAr: string }> {
    if (labelEn !== undefined && labelAr !== undefined) return { labelEn, labelAr };
    const question = (await this.questionnaire.questionAssignments()).find(
      (q) => q.code === questionCode,
    );
    // The code itself is the last resort, and it is never a good label — but a fact with no
    // label at all cannot be created, and refusing here would fail a create over cosmetics.
    return {
      labelEn: labelEn ?? question?.code ?? questionCode,
      labelAr: labelAr ?? question?.code ?? questionCode,
    };
  }

  /** Everything the planner needs to know about what is already there. Read once. */
  private async readState(): Promise<BlueprintExistingState> {
    const [defs, questions, bindings, factRows, products] = await Promise.all([
      this.repo.typeDefinitions(),
      this.questionnaire.questionAssignments(),
      // What the ENGINE can read: facts bound to a live question of a bindable type.
      this.repo.surrogateFactRegistry(),
      // What EXISTS: every fact row, bound or not. The two differ, and the difference is
      // load-bearing — a fact whose binding is missing reads as absent in the first list,
      // and a plan built on that creates a row whose key is already taken.
      this.enums.listAll({ type: SURROGATE_FACT_TYPE }),
      this.enums.listAll({ type: SURROGATE_PRODUCT_TYPE }),
    ]);
    const boundFactKeys = new Set(bindings.map((binding) => binding.key));

    // Only the lists this library touches, and active AND inactive rows: a key is taken
    // either way, and a retired value that the blueprint would "add" is a duplicate-key
    // refusal rather than a second row.
    const wantedTypes = new Set<string>();
    for (const blueprint of productBlueprints()) {
      for (const ask of blueprint.asks) {
        if (ask.kind === 'choice') {
          wantedTypes.add(ask.list.typeKey);
          if (ask.list.parent) wantedTypes.add(ask.list.parent.typeKey);
        }
        if (ask.kind === 'platformFact' && ask.addValues) wantedTypes.add(ask.addValues.typeKey);
      }
    }
    const valueKeysByType = new Map<string, ReadonlySet<string>>();
    for (const typeKey of wantedTypes) {
      if (!defs.has(typeKey)) continue;
      const rows = await this.enums.listAll({ type: typeKey });
      valueKeysByType.set(typeKey, new Set(rows.map((row) => row.key)));
    }

    const mirroredTypeKeys = new Set<string>();
    for (const [key, def] of defs) {
      if (def.mirrorQuestionId !== null) mirroredTypeKeys.add(key);
    }

    return {
      typeKeys: new Set(defs.keys()),
      valueKeysByType,
      questionCodes: new Set(questions.map((question) => question.code)),
      inactiveQuestionCodes: new Set(
        questions.filter((question) => !question.isActive).map((question) => question.code),
      ),
      categoriesByQuestion: new Map(
        questions.map((question) => [question.code, new Set(question.categories)]),
      ),
      factKeys: new Set(factRows.map((row) => row.key)),
      unboundFactKeys: new Set(
        factRows.filter((row) => !boundFactKeys.has(row.key)).map((row) => row.key),
      ),
      questionCodeByFact: new Map(bindings.map((binding) => [binding.key, binding.questionCode])),
      mirroredTypeKeys,
      productKeys: new Set(products.map((product) => product.key)),
    };
  }

  /** One blueprint, as the library screen reads it. */
  private project(
    blueprint: ProductBlueprint,
    existing: BlueprintExistingState,
  ): ProductBlueprintDto {
    const asks: ProductBlueprintAskDto[] = blueprint.asks.map((ask) => {
      const questionCode = askQuestionCode(ask, existing);
      // `askCategories`, not `ask.categories`: a REUSED fact states its need as `alsoAskIn`,
      // and that is precisely the case where a missing assignment is invisible everywhere
      // else — the question exists, so every screen reads it as set up, while the category it
      // is not assigned to never puts it to an applicant.
      const wanted = askCategories(ask);
      const have =
        questionCode === null
          ? new Set<LoanCategory>()
          : (existing.categoriesByQuestion.get(questionCode) ?? new Set<LoanCategory>());
      return {
        factKey: ask.factKey,
        kind: ask.kind,
        ...(questionCode !== null ? { questionCode } : {}),
        ...(ask.kind === 'choice' ? { listTypeKey: ask.list.typeKey } : {}),
        factExists:
          existing.factKeys.has(ask.factKey) ||
          // A derived axis is computed by the platform; there is nothing to create and it is
          // never missing.
          ask.kind === 'derivedFact',
        questionExists: questionCode !== null && existing.questionCodes.has(questionCode),
        listExists: ask.kind === 'choice' ? existing.typeKeys.has(ask.list.typeKey) : true,
        // Only for a question that ALREADY exists. A question this create is about to make is
        // born asked in every category the blueprint states, so listing them as "missing"
        // would put a warning on the screen about the very thing the button is going to fix.
        missingCategories:
          questionCode !== null && existing.questionCodes.has(questionCode)
            ? wanted.filter((category) => !have.has(category))
            : [],
      };
    });

    const plan: BlueprintPlan = planBlueprint({
      blueprint,
      productKey: blueprint.template === null ? null : `preview_${blueprint.key}`,
      productLabelEn: blueprint.labelEn,
      productLabelAr: blueprint.labelAr,
      existing,
    });

    return {
      key: blueprint.key,
      group: blueprint.group,
      labelEn: blueprint.labelEn,
      labelAr: blueprint.labelAr,
      outputKind: blueprint.template?.outputKind ?? null,
      wayCount:
        blueprint.template === null
          ? 0
          : 1 +
            (blueprint.template.alternatives?.length ??
              (blueprint.template.alternative !== undefined ? 1 : 0)),
      hasSecondColumn: blueprint.template?.secondColumn !== undefined,
      conditionCount: blueprint.template?.conditions.length ?? 0,
      hasCap: blueprint.cap !== undefined,
      ...(blueprint.openQuestion !== undefined ? { openQuestion: blueprint.openQuestion } : {}),
      asks,
      // What the create would write, so the screen can say it before the operator commits.
      creates: {
        lists: plan.steps.filter((step) => step.op === 'createType').length,
        values: plan.steps
          .filter((step) => step.op === 'createValues')
          .reduce(
            (total, step) => total + (step.op === 'createValues' ? step.values.length : 0),
            0,
          ),
        questions: plan.steps.filter((step) => step.op === 'createQuestion').length,
        facts: plan.steps.filter((step) => step.op === 'createFact').length,
        widens: plan.steps.filter((step) => step.op === 'widenCategories').length,
      },
      suggestedBands: (blueprint.suggestedBands ?? []).flatMap((suggestion) => {
        const ways = blueprint.template === null ? [] : waysOf(blueprint.template);
        const way = ways[suggestion.wayIndex];
        // A suggestion whose way does not exist is dropped rather than guessed at: a bracket
        // list offered against the wrong box would be inserted into somebody's live table.
        // The library's own test asserts every suggestion names a way that BANDS, so this is
        // unreachable from the shipped content and is the fence, not the behaviour.
        if (way === undefined) return [];
        return [
          {
            wayIndex: suggestion.wayIndex,
            slotId: waySlot(way, suggestion.wayIndex),
            edges: suggestion.edges.map((edge) => ({ ...edge })),
          },
        ];
      }),
    };
  }
}

/** The actor shape the enumeration service speaks, so a caller cannot pass the wrong one. */
export type BlueprintActor = AdminActor;
