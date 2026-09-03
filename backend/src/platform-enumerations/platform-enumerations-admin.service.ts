import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { LoanCategory } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  EnumerationCategoriesNotApplicableException,
  EnumerationCategoryNotAssignedException,
  EnumerationDeleteNotSupportedException,
  EnumerationHasChildrenException,
  EnumerationFallbackInUseException,
  EnumerationTypeFallbackInvalidException,
  EnumerationInUseException,
  EnumerationCreateNotApplicableException,
  EnumerationKeyDuplicateException,
  EnumerationParentNotApplicableException,
  EnumerationTypeDuplicateException,
  EnumerationTypeInUseException,
  EnumerationTypeIsParentAxisException,
  EnumerationTypeNotFoundException,
  EnumerationTypeParentInvalidException,
  EnumerationTypeSystemOnlyException,
  ProgramNameHasOwnRuleException,
  SurrogateProductCapOnlyException,
  SurrogateProductRequiredException,
  EnumerationParentRequiredException,
  EnumerationParentUnknownException,
  EnumerationQuestionBindingNotApplicableException,
  EnumerationQuestionUnknownException,
  EnumerationQuestionsNotApplicableException,
  SurrogateFactQuestionTypeInvalidException,
  EnumerationSystemOnlyException,
  NotFoundException,
  EnumerationBulkCreateNotApplicableException,
  EnumerationBulkInvalidException,
  type EnumerationBulkProblem,
} from '@/common/errors/domain.exceptions';
// Frozen platform data — no Nest, no Prisma, and it imports nothing from this module, so
// the dependency is one-way at the file level as well as at runtime. The blueprint library
// is what DEFINES which products guess no income, so reading the answer from anywhere else
// would be a second statement of it.
import { isCapOnlyProductKey } from '@/bank-programs/blueprints/product-blueprints';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
// ONE slug rule, not two. The key a pasted row mints must be the key the questionnaire's
// options carry, because `question_option.code === platform_enumeration.key` is what makes
// `factChoiceTable` and `factParentTable` find a bank's row at all. A second copy here would
// be the copy that drifts. Pure function, no module involvement, so no DI cycle (A25).
import { slugify } from '@/questionnaire/slug.util';
import { dedupeCategories } from '@/common/loan-category.util';
import { dedupeBases, type IncomeBasis } from '@/common/income-basis.util';
import {
  BINDABLE_QUESTION_TYPES,
  isBindableQuestionType,
  isCategorisedEnumerationType,
  isQuestionBoundEnumerationType,
  isQuestionTemplateEnumerationType,
  isUnscopedEnumerationType,
  childTypesOf,
  parentTypeOf,
  type BoundQuestion,
  type EnumerationType,
  type EnumerationTypeDefinition,
  type EnumerationTypeDefinitions,
  type IncomeBasesByCategory,
  type QuestionCodesByCategory,
} from './platform-enumerations.repository';
import {
  PostgresPlatformEnumerationsRepository,
  type CatalogQuestionRow,
  type EnumerationCategoryAssignment,
  type EnumerationRow,
  type EnumerationTypeStats,
  type EnumerationUpdatePatch,
  type ProgramNameUsage,
} from './postgres-platform-enumerations.repository';
import type { SetEnumerationParentKeysBulkDto } from './dto/enumeration.dto';
import type {
  CreateEnumerationDto,
  CreateEnumerationValuesBulkDto,
  EnumerationBulkCreateResult,
  CreateEnumerationTypeDto,
  UpdateEnumerationDto,
  UpdateEnumerationTypeDto,
} from './dto/enumeration.dto';

/** The only categorised type today; see `CATEGORISED_ENUMERATION_TYPES`. */
const PROGRAM_NAME_TYPE = 'program_name';
const SURROGATE_PRODUCT_TYPE = 'surrogate_product';
const FACT_TYPE = 'surrogate_fact';

/**
 * Lexical, so the audit no-op check compares SETS. Ordering everywhere else is
 * the questionnaire's `displayOrder`, and a reshuffle there must not make an
 * unchanged template look like an edit.
 */
function sortCodes(codes: readonly string[]): string[] {
  return [...codes].sort();
}

function sameCodeSet(a: readonly string[], b: readonly string[]): boolean {
  // Compared as SETS, with no delimiter: a joined form needs a separator that
  // cannot occur in a code, and picking one wrong is how this line ended up
  // with a raw NUL in it. `next` is deduped by the caller and `before` is
  // unique by primary key, so length plus membership is exact.
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((code) => seen.has(code));
}

/**
 * Who is asking, when that changes what is allowed.
 *
 * Two callers set it, and each names ITSELF rather than borrowing the other's word:
 *
 *   `blueprint`   — the predefined-product library, which creates the two kinds
 *                   `SEEDED_ONLY_TYPES` closes to everyone else.
 *   `product_ask` — an operator ticking a pool question on one product's step ①. It may
 *                   create a `surrogate_fact` and NOTHING ELSE (`assertCreatableBy`): a
 *                   product is still seeded, never made by hand.
 *
 * A named option rather than a boolean because the next reason to bypass a door will not
 * be this one — which is what this second value is. Reusing `'blueprint'` for an operator's
 * pick would file their row, and its audit event, as the library's own work.
 */
export interface CreateEnumerationOptions {
  source: 'blueprint' | 'product_ask';
}

export interface AdminActor {
  staffId: string;
  sourceIp: string | null;
}

/**
 * What a `systemOnly` kind refuses on a patch.
 *
 * Everything else — the two labels, the description, the icon, the example, the sort order —
 * is what an operator READS, and a builtin owns none of that. These five change what the
 * platform DOES with values a code path is already reading by name — `fallbackParentKey`
 * among them, because it decides where an unfile lands and therefore what a bank quotes.
 */
const SYSTEM_ONLY_LOCKED_FIELDS = [
  'parentTypeKey',
  'fallbackParentKey',
  'deletable',
  'onValuesRail',
  'active',
] as const satisfies readonly (keyof UpdateEnumerationTypeDto)[];

/**
 * Kinds whose values a three-column paste cannot express, so the door is shut rather than
 * left ajar.
 *
 * `program_name` carries loan-category assignments and an income basis, `surrogate_product` a
 * calculation, `surrogate_fact` a bound question. Each has a screen that asks for it, and a
 * row created through this door is one that screen cannot render. Every other kind — including
 * a `systemOnly` builtin like `governorate` — is fair game: `systemOnly` is a fact about the
 * KIND, not about whether its values may be loaded in bulk.
 */
const BULK_CREATE_FORBIDDEN_TYPES = new Set<string>([
  'program_name',
  'surrogate_product',
  'surrogate_fact',
]);

/**
 * Kinds an operator may not create a value of AT ALL — only the predefined-product library
 * may, and it does so through this same method with an explicit `source`.
 *
 * A no-payslip PRODUCT and the FACTS it reads are platform structure, not operator data:
 * the eleven products are put in by `npm run seed:blueprints` and the operator's decision
 * is which of them this platform sells. Before this, three admin screens minted products
 * and facts of their own — a blank product from an anonymous shape, one on the way through
 * the Add-program-name flow, and a hand-built ask — and each produced a row nothing seeded
 * and no blueprint described.
 *
 * `program_name` is deliberately NOT here: hand-created catalog names are the point of the
 * catalog. `surrogate_product` and `surrogate_fact` are the two kinds a blueprint owns.
 */
const SEEDED_ONLY_TYPES = new Set<string>(['surrogate_product', 'surrogate_fact']);

/**
 * Which of the closed kinds each named source may create.
 *
 * `product_ask` reaches `surrogate_fact` and NOT `surrogate_product`, and that asymmetry is
 * the whole of v22.0.0's decision that survives here: an operator picks WHICH of the seeded
 * products this platform sells and what one of them reads, and never mints a product of
 * their own. A product row created by hand is one no blueprint describes and no seed run
 * can resume — the state the three deleted admin screens used to produce.
 */
const CREATABLE_BY_SOURCE: Readonly<
  Record<NonNullable<CreateEnumerationOptions['source']>, readonly string[]>
> = {
  blueprint: ['surrogate_product', 'surrogate_fact'],
  product_ask: ['surrogate_fact'],
};

function isCreatableBySource(
  type: string,
  source: CreateEnumerationOptions['source'] | undefined,
): boolean {
  if (!SEEDED_ONLY_TYPES.has(type)) return true;
  if (source === undefined) return false;
  return CREATABLE_BY_SOURCE[source].includes(type);
}

/** How many bad rows a refusal names before it stops. See `EnumerationBulkInvalidException`. */
const BULK_PROBLEM_REPORT_CAP = 200;

@Injectable()
export class PlatformEnumerationsAdminService {
  constructor(
    private readonly audit: AuditEventWriter,
    private readonly repo: PostgresPlatformEnumerationsRepository,
    /**
     * A mirrored list's values ARE a question's options, so a value write here is an
     * unpublished questionnaire until this runs (`EnumerationTypeDef.mirrorQuestionId`).
     *
     * `forwardRef` because `QuestionnaireModule` already imports this one — it needs the live
     * member list to warn when a fact's option codes drift from the registry they are supposed
     * to BE. The cycle is real and deliberate, the same posture this module already takes with
     * `CustomerAuthModule`; the alternative is a second writer of `question_option`, which is
     * exactly the drift both halves exist to prevent.
     */
    @Inject(forwardRef(() => QuestionnaireService))
    private readonly questionnaire: QuestionnaireService,
  ) {}

  /**
   * Re-sync the question whose options are this list, if any.
   *
   * Called after every write to a VALUE — create, patch, retire, delete. Guarded on the
   * cached definitions so the overwhelming majority of writes (every builtin, every list made
   * on the Manage-values rail) cost one map read and stop here.
   *
   * Deliberately NOT awaited inside the registry transaction and deliberately not rolled back
   * on failure: the registry write is the operator's edit and it has committed. A failed sync
   * leaves the options one write behind, which the next write to that list puts right and
   * which the product screen can force; unwinding a saved value because a republish failed
   * would be the more surprising of the two.
   */
  private async syncMirroredList(type: string, actor: string): Promise<boolean> {
    const defs = await this.repo.typeDefinitions();
    if (defs.get(type)?.mirrorQuestionId == null) return false;
    return this.questionnaire.syncMirroredOptions(type, actor);
  }

  /**
   * Refuse a write that would take a mirrored list below a choice question's minimum.
   *
   * The counterpart to `syncMirroredList`, which runs AFTER the write and re-checks nothing:
   * a value going away deactivates the matching option, and nothing else stops that leaving
   * a live `SINGLE_SELECT` with no answers. Guarded on the cached definitions first, so an
   * unmirrored kind — every builtin, every list on the Manage-values rail — costs one map
   * read.
   */
  private async assertMirroredListSurvives(type: string, key: string): Promise<void> {
    const defs = await this.repo.typeDefinitions();
    if (defs.get(type)?.mirrorQuestionId == null) return;
    await this.questionnaire.assertMirroredListSurvives(type, key);
  }

  async listAll(filter?: { type?: string }): Promise<EnumerationRow[]> {
    return this.repo.findAllOrdered(filter);
  }

  /**
   * Switch named FACTS on or off — what a cap-only product's switch does.
   *
   * For a cap-only product this is the whole of "off". Such a product guesses no income — it
   * asks its question and each bank states the maximum for the answer on its own program —
   * so there is no calculation to withhold. Deactivating the fact is what stops the answer
   * being read: it leaves `surrogateFactRegistry` (which filters `active` for exactly this
   * reason), and the bank's cap table then takes the `onNoMatch` branch the bank itself
   * chose, rather than the platform inventing "no cap" or "cap zero".
   *
   * TAKES THE KEYS rather than a product, because the caller is the only one that knows
   * which facts belong to one exclusively — a cap blueprint creates no product row for its
   * facts to be filed under, and a fact two blueprints read must never be taken away by one
   * of them (`exclusiveFactKeysOf`).
   *
   * Goes through `update()` per row rather than one bulk write: each flip is an audited
   * decision, the cache invalidation is already there, and it is one or two facts. Rows
   * already in the wanted state are skipped, so a no-op switch writes no audit events.
   *
   * Returns the keys it actually moved, so an operator can be told that switching a product
   * off also stopped a question being read.
   */
  async setFactsActive(
    factKeys: readonly string[],
    active: boolean,
    actor: AdminActor,
  ): Promise<string[]> {
    if (factKeys.length === 0) return [];
    const wanted = new Set(factKeys);
    const facts = (await this.repo.findAllOrdered({ type: FACT_TYPE })).filter(
      (row) => wanted.has(row.key) && row.active !== active,
    );
    for (const fact of facts) await this.update(fact.id, { active }, actor);
    return facts.map((f) => f.key);
  }

  /**
   * Program-catalog usage: archetype key → how many bank programs instantiate it
   * and across how many banks. Feeds the catalog board so an entry is never
   * deprecated blind.
   */
  async programNameUsage(): Promise<Map<string, ProgramNameUsage>> {
    return this.repo.countProgramNameUsage();
  }

  /**
   * Every KIND, with its definition and how many values it holds.
   *
   * Typed as `EnumerationTypeStats[]` rather than the old inline four-field shape: the
   * narrower type still COMPILED once `deletable` and `definition` were added — a wider
   * object is assignable to it — while erasing both from what the controller believes it is
   * serving, so the admin would have had to cast to read fields the server was already
   * sending.
   */
  async listTypes(): Promise<EnumerationTypeStats[]> {
    return this.repo.listTypeStats();
  }

  /** Loan-category assignments for a type, keyed by enumeration id. */
  async categoryAssignments(filter?: { type?: string }): Promise<Map<string, LoanCategory[]>> {
    return this.repo.categoryAssignments(filter);
  }

  // ---- The KIND registry -------------------------------------------------
  //
  // A KIND is a row now (`enumeration_type_def`), so inventing the list a bank keys its
  // table by is an operator action rather than a release. What is NOT settable here is
  // every axis a code path reads by name — `systemOnly`, the customer allow-list, the
  // categorised / question-bound / unscoped sets — because claiming one would let an
  // operator assert a capability nothing implements.

  /**
   * Create a KIND.
   *
   * The parent axis is resolved BEFORE the insert for the reason `create()` states about
   * `parentKey` and `surrogateProductKey`: a kind filed under a kind that does not exist
   * makes every one of its future values uncreatable, because `resolveParentKey` would
   * demand a parent from a list nothing can populate.
   */
  async createType(
    input: CreateEnumerationTypeDto,
    actor: AdminActor,
  ): Promise<EnumerationTypeDefinition> {
    const defs = await this.repo.typeDefinitions();
    if (defs.has(input.key)) {
      throw new EnumerationTypeDuplicateException({ key: input.key });
    }
    this.assertParentTypeUsable(defs, input.key, input.parentTypeKey ?? null);
    await this.assertFallbackUsable(
      input.key,
      input.parentTypeKey ?? null,
      input.fallbackParentKey ?? null,
    );

    const created = await this.repo.insertTypeDefinition({
      key: input.key,
      labelAr: input.labelAr,
      labelEn: input.labelEn,
      descriptionAr: input.descriptionAr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      icon: input.icon ?? null,
      exampleAr: input.exampleAr ?? null,
      exampleEn: input.exampleEn ?? null,
      parentTypeKey: input.parentTypeKey ?? null,
      fallbackParentKey: input.fallbackParentKey ?? null,
      // A kind an operator invented IS deletable by default: nothing reads it by name, so
      // the only thing that can point at one of its values is a child value, which
      // `countGenericReferences` counts. Defaulting to false would recreate the trap this
      // feature exists to remove — a list you can make and never unmake.
      deletable: input.deletable ?? true,
      onValuesRail: input.onValuesRail ?? true,
      systemOnly: false,
      // A list a product authored is owned by it and kept off the global rail: it exists to
      // answer one question, and mixing it in with "Governorates" would offer an operator a
      // list they have no way to place. Absent = a shared list, which is what the rail and
      // the seeded builtins are.
      surrogateProductKey: input.surrogateProductKey ?? null,
      // Never settable on create: the question does not exist yet on the only path that
      // matters. `createQuestionWithOptions` stamps it once the question has an id.
      mirrorQuestionId: null,
      sortOrder: input.sortOrder ?? 0,
    });

    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.ENUMERATION_TYPE_CREATED,
      sourceIp: actor.sourceIp,
      payload: { key: created.key, parentTypeKey: created.parentTypeKey },
    });
    return created;
  }

  /**
   * Patch a KIND. `key` cannot be patched — the DTO has no field for it.
   *
   * A `systemOnly` kind may be RELABELLED and reordered but not re-parented and not
   * retired: the label is what an operator reads, while the axis and the active flag change
   * what the platform does with values a code path is already reading by name.
   */
  async updateType(
    key: string,
    patch: UpdateEnumerationTypeDto,
    actor: AdminActor,
  ): Promise<EnumerationTypeDefinition> {
    const defs = await this.repo.typeDefinitions();
    const existing = defs.get(key);
    if (!existing) throw new EnumerationTypeNotFoundException({ key });

    if (existing.systemOnly) {
      // Every settings field a builtin does not own, not just the axis. Guarding only
      // `parentTypeKey` let `{"active": false}` retire a kind the platform reads by name and
      // `{"deletable": true}` open the hard-delete gate on values `countGenericReferences`
      // knows nothing about — both accepted, both contradicting this method's own contract.
      const locked = SYSTEM_ONLY_LOCKED_FIELDS.filter((field) => patch[field] !== undefined);
      if (locked.length > 0) {
        throw new EnumerationTypeSystemOnlyException({
          key,
          attempted: 'reconfigure',
          fields: locked,
        });
      }
    }
    if (patch.parentTypeKey !== undefined) {
      this.assertParentTypeUsable(defs, key, patch.parentTypeKey);
    }
    if (patch.fallbackParentKey !== undefined) {
      // Against the axis this patch RESULTS in, not the one on disk: dropping the axis and
      // naming a fallback in one request must be refused as a pair, and moving both at once
      // must be judged against the new list rather than the old one.
      await this.assertFallbackUsable(
        key,
        patch.parentTypeKey !== undefined ? patch.parentTypeKey : existing.parentTypeKey,
        patch.fallbackParentKey,
      );
    }

    const updated = await this.repo.updateTypeDefinition(key, patch);
    if (!updated) throw new EnumerationTypeNotFoundException({ key });

    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.ENUMERATION_TYPE_UPDATED,
      sourceIp: actor.sourceIp,
      payload: { key, changes: patch },
    });
    return updated;
  }

  /**
   * Delete a KIND.
   *
   * Refused while any value carries the type, and the check is a COUNT over
   * `platform_enumeration` rather than a foreign key, because that column has none. Without
   * the refusal the rows would survive as values of a kind with no label, no parent axis and
   * no delete gate — the orphan state the registry exists to remove.
   */
  async deleteType(key: string, actor: AdminActor): Promise<void> {
    const defs = await this.repo.typeDefinitions();
    const existing = defs.get(key);
    if (!existing) throw new EnumerationTypeNotFoundException({ key });
    if (existing.systemOnly) {
      throw new EnumerationTypeSystemOnlyException({ key, attempted: 'delete' });
    }

    const values = await this.repo.countRowsOfType(key);
    if (values > 0) throw new EnumerationTypeInUseException({ key, values });

    // A kind nothing files under is safe to drop; one that IS a parent axis is not. Leaving
    // the axis dangling would make every value of the CHILD kind uncreatable, which is the
    // same damage as a missing parent on create — refused there, so refused here too.
    const children = childTypesOf(defs, key);
    if (children.length > 0) {
      throw new EnumerationTypeIsParentAxisException({
        key,
        childTypes: children,
        count: children.length,
      });
    }

    await this.repo.deleteTypeDefinition(key);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.ENUMERATION_TYPE_DELETED,
      sourceIp: actor.sourceIp,
      payload: { key },
    });
  }

  /**
   * A parent axis must name a kind that exists, must not be the kind itself, and must not
   * already have this kind somewhere above it.
   *
   * The walk is what `parentTypeKey === key` alone could not catch: file `b` under `a`, then
   * `a` under `b`, and both refusals pass. Neither kind can then hold its first value —
   * `resolveParentKey` demands a live parent value on create, and each waits on the other —
   * and neither can be deleted, because each is the other's child. Unusable and unremovable
   * through the API, from two individually legal writes.
   *
   * Bounded by the definition count, since a chain that revisits a kind ends at `key` or at
   * a kind already seen.
   */
  private assertParentTypeUsable(
    defs: EnumerationTypeDefinitions,
    key: string,
    parentTypeKey: string | null,
  ): void {
    if (parentTypeKey === null) return;
    if (parentTypeKey === key) {
      throw new EnumerationTypeParentInvalidException({ key, parentTypeKey, reason: 'self' });
    }
    if (!defs.has(parentTypeKey)) {
      throw new EnumerationTypeParentInvalidException({ key, parentTypeKey, reason: 'missing' });
    }

    const seen = new Set<string>([key]);
    let at: string | null = parentTypeKey;
    while (at !== null) {
      if (seen.has(at)) {
        throw new EnumerationTypeParentInvalidException({ key, parentTypeKey, reason: 'cycle' });
      }
      seen.add(at);
      at = defs.get(at)?.parentTypeKey ?? null;
    }
  }

  /**
   * A declared fallback must name a LIVE member of the axis the kind is filed under.
   *
   * Async where `assertParentTypeUsable` is sync, and unavoidably so: the axis is a fact
   * about the KIND registry, which the caller already holds, while a fallback is a fact about
   * a VALUE and needs the members read.
   *
   * Checked at SET time only, on its own reasoning: if the class were somehow retired anyway
   * (a migration, direct SQL), the unfile gesture must still land somewhere rather than start
   * throwing at an operator mid-board, and the fallback-in-use refusal in `update()` is what
   * keeps that path narrow. It used to cite `programNameIncomeRules()`'s indifference to a
   * linked product's active flag as the precedent; that posture is gone — a switched-off
   * product now withholds its calculation — so the analogy went with it.
   */
  private async assertFallbackUsable(
    key: string,
    parentTypeKey: string | null,
    fallbackParentKey: string | null,
  ): Promise<void> {
    if (fallbackParentKey === null) return;
    if (parentTypeKey === null) {
      throw new EnumerationTypeFallbackInvalidException({
        key,
        fallbackParentKey,
        reason: 'no_axis',
      });
    }
    const members = await this.repo.getActiveMembers(parentTypeKey);
    if (!members.some((m) => m.key === fallbackParentKey)) {
      const parent = await this.repo.findByTypeAndKey(parentTypeKey, fallbackParentKey);
      throw new EnumerationTypeFallbackInvalidException({
        key,
        fallbackParentKey,
        reason: parent ? 'inactive' : 'unknown',
        parentType: parentTypeKey,
        activeKeys: members.map((m) => m.key),
      });
    }
  }

  async create(
    input: CreateEnumerationDto,
    actor: AdminActor,
    opts?: CreateEnumerationOptions,
  ): Promise<EnumerationRow> {
    // THIRD and POSITIONAL, so no wire field can ever reach it: the controller passes a
    // validated body and an actor, and there is no third thing it could pass. The two
    // callers that supply it are `BlueprintService`, building a predefined product, and
    // `ProductAsksService`, attaching a pool question to one — and the second may reach
    // exactly one of the two closed kinds.
    if (!isCreatableBySource(input.type, opts?.source)) {
      throw new EnumerationCreateNotApplicableException({ type: input.type });
    }

    const existing = await this.repo.findByTypeAndKey(input.type, input.key);
    if (existing) {
      throw new EnumerationKeyDuplicateException({ type: input.type, key: input.key });
    }

    // Both checks run BEFORE the insert, and together, because `incomeBases` is applied
    // inside the same atomic create: a name written as no-payslip with no link would
    // exist, be offerable, and quote nothing until somebody noticed. A brand-new row
    // states no rule of its own, so `statesOwnRule` is false by construction — there is
    // nothing to grandfather at birth.
    const resolvedProduct = await this.resolveSurrogateProductKey(
      input.type,
      input.surrogateProductKey,
    );
    if (isCategorisedEnumerationType(input.type)) {
      await this.assertSurrogateProductForBases(
        { type: input.type, key: input.key },
        dedupeBases(input.incomeBases ?? ['payslip']),
        resolvedProduct,
        false,
      );
    }

    const created = await this.repo.insert({
      type: input.type,
      key: input.key,
      labelAr: input.labelAr,
      labelEn: input.labelEn,
      // The parent is decided by an ALLOW-LIST now, not by "whatever the caller sent".
      // A type with no parent axis is force-nulled (a caller sending one is a bug, not an
      // intent to scope it), and a type WITH one must name a live member of it: a value
      // filed under nothing is offered to the customer and prices nothing, because
      // `factParentTable` answers `no_matching_row` for whoever picks it.
      parentKey: await this.resolveParentKey(input.type, input.parentKey),
      // Resolved BEFORE the insert, like `parentKey`: a link that names a product that
      // does not exist must never reach storage, where it reads as "no rule" at the
      // engine seam and quotes `rule_unconfigured` for every program under the name.
      surrogateProductKey: resolvedProduct,
      // Default a new categorised entry to NO categories. It used to default to all
      // four, on the argument that a name assigned to nothing is an invisible catalog
      // row — true then, because the assignment lived four tab-clicks deep and nothing
      // said it was unset. Since the name's own page became a three-step screen it says
      // exactly that, in three places at once: step 2 is the ONLY step that can read
      // `invalid`, it opens with "0 of 4 loan types are on", and the catalog board lists
      // the name under "Offered under no loan type". So the old default was no longer
      // buying visibility — it was the platform deciding, on the operator's behalf and
      // in silence, that a brand-new name is sold as all four products. Which loan types
      // a name reaches is a decision, and an undecided decision must read as undecided.
      // Dropped silently for other types, mirroring `parentKey` above.
      categories: isCategorisedEnumerationType(input.type)
        ? dedupeCategories(input.categories ?? [])
        : [],
      // Asked once on the create screen and applied to every category above; the
      // detail screen's tabs are where it gets split per loan type. Defaulted
      // rather than required so an API client that predates the field creates the
      // name it used to create, instead of failing validation.
      incomeBases: isCategorisedEnumerationType(input.type)
        ? dedupeBases(input.incomeBases ?? ['payslip'])
        : [],
      sortOrder: input.sortOrder ?? 0,
      createdBy: actor.staffId,
    });
    this.repo.invalidateCache(input.type);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.PLATFORM_ENUMERATION_CREATED,
      sourceIp: actor.sourceIp,
      payload: { type: created.type, key: created.key, id: created.id },
    });
    await this.syncMirroredList(created.type, actor.staffId);
    return created;
  }

  /**
   * Create many values of ONE kind from a pasted list — one transaction, one publish.
   *
   * The reason this is an endpoint and not a client loop is arithmetic, not tidiness. Four
   * hundred single creates are four hundred requests against a 100-per-15-minutes throttle,
   * four hundred audit round trips, and — for a MIRRORED list — four hundred questionnaire
   * versions, each embedding every option of every question, so the JSON written grows as the
   * square of the list. Here it is one insert, one `writeMany`, and one `syncMirroredList`.
   *
   * ALL-OR-NOTHING, with every bad row reported at once. Partial success reads as the kinder
   * option and is worse: it hands the operator a textarea and asks them to work out which
   * half of it landed against a list they cannot see. Reporting every problem together is
   * what makes the retry a single edit, and the retry is free because the whole thing is
   * IDEMPOTENT — keys are slugged from `labelEn`, so re-pasting the same sheet finds every
   * key already there and writes nothing.
   *
   * That idempotency is also why this uses `slugify` and NOT `uniqueSlug`. `uniqueSlug`
   * appends `_2` on collision, which on a list of place names mints two rows no picker and no
   * bank table can tell apart, and turns a re-paste into a second full set of duplicates.
   * A collision is a duplicate and is reported as one.
   */
  async createValuesBulk(
    input: CreateEnumerationValuesBulkDto,
    actor: AdminActor,
  ): Promise<EnumerationBulkCreateResult> {
    const defs = await this.repo.typeDefinitions();
    const def = defs.get(input.type);
    if (!def) throw new EnumerationTypeNotFoundException({ key: input.type });
    if (BULK_CREATE_FORBIDDEN_TYPES.has(input.type)) {
      throw new EnumerationBulkCreateNotApplicableException({ type: input.type });
    }

    const parentType = def.parentTypeKey;
    // One read for the whole batch, never one per row — the de-duping `setParentKeysBulk`
    // already does for its `(type, target)` pairs, for the same reason.
    const activeParentKeys =
      parentType === null ? [] : (await this.repo.getActiveMembers(parentType)).map((m) => m.key);
    const liveParents = new Set(activeParentKeys);

    // EVERY key of the type, not just the active ones: a retired value still holds its
    // `(type, key)` unique, so treating it as absent would produce a constraint error at
    // insert time rather than a `duplicate_existing` the operator can read.
    const existingKeys = new Set(
      (await this.repo.findAllOrdered({ type: input.type })).map((r) => r.key),
    );

    const problems: EnumerationBulkProblem[] = [];
    const minted = new Map<string, number>();
    const toCreate: Array<{
      key: string;
      labelAr: string;
      labelEn: string;
      parentKey: string | null;
    }> = [];
    const skippedRows: Array<{ index: number; key: string }> = [];

    input.rows.forEach((row, index) => {
      // A stated key wins. Only a programmatic caller states one, and when it does the key is
      // the point: it is what a bank's figures are filed under, and slugging a label would
      // put them somewhere no rule reads.
      const key = row.key ?? slugify(row.labelEn);
      // `slugify` falls back to the literal `'item'` for a label with no Latin character.
      // The DTO's `@Matches` should have caught that, so this is the belt to its braces —
      // and it names the real problem rather than letting 400 rows collide on one key.
      if (row.key === undefined && key === 'item' && !/[A-Za-z0-9]/.test(row.labelEn)) {
        problems.push({ index, reason: 'label_unsluggable' });
        return;
      }

      let parentKey: string | null = null;
      if (parentType === null) {
        if (row.parentKey !== undefined) {
          problems.push({ index, reason: 'parent_not_applicable', key });
          return;
        }
      } else if (row.parentKey === undefined) {
        // NOT the kind's declared fallback. That answers an operator's UNFILE — a decision
        // they made — while a blank column is a typo, and the platform answering a typo with
        // a price tier is what `ENUMERATION_PARENT_REQUIRED` exists to refuse.
        problems.push({ index, reason: 'parent_required', key });
        return;
      } else if (!liveParents.has(row.parentKey)) {
        problems.push({ index, reason: 'parent_unknown', key, parentKey: row.parentKey });
        return;
      } else {
        parentKey = row.parentKey;
      }

      const firstIndex = minted.get(key);
      if (firstIndex !== undefined) {
        problems.push({ index, reason: 'duplicate_in_batch', key, firstIndex });
        return;
      }
      if (existingKeys.has(key)) {
        // The EXPECTED second use of this screen. A problem only when the operator says so —
        // a re-paste and a paste-into-the-wrong-list are different intentions and only they
        // know which one they are having.
        if (input.onDuplicate === 'fail') {
          problems.push({ index, reason: 'duplicate_existing', key });
        } else {
          skippedRows.push({ index, key });
        }
        return;
      }

      minted.set(key, index);
      toCreate.push({ key, labelAr: row.labelAr, labelEn: row.labelEn, parentKey });
    });

    if (problems.length > 0) {
      // Capped: a paste with more than 200 distinct problems is one the operator redoes, and
      // a 200 KB error body helps nobody read the first three.
      const shown = problems.slice(0, BULK_PROBLEM_REPORT_CAP);
      throw new EnumerationBulkInvalidException({
        type: input.type,
        rows: input.rows.length,
        problemsTotal: problems.length,
        truncated: problems.length > shown.length,
        problems: shown,
        ...(parentType !== null ? { activeParentKeys } : {}),
      });
    }

    if (input.dryRun === true) {
      return {
        type: input.type,
        created: toCreate.length,
        skipped: skippedRows.length,
        createdKeys: toCreate.map((r) => r.key),
        skippedRows,
        republished: false,
      };
    }

    // Nothing to write — every row was a duplicate, which is what a RE-PASTE looks like.
    // Returning here rather than falling through with an empty array is what makes the second
    // paste of a sheet genuinely free: no transaction, no audit batch, and above all no
    // mirror sync, so a screen the operator re-submitted by habit cannot mint a questionnaire
    // version. (The sync would report no change and publish nothing anyway; this makes it not
    // happen at all, and says so.)
    if (toCreate.length === 0) {
      return {
        type: input.type,
        created: 0,
        skipped: skippedRows.length,
        createdKeys: [],
        skippedRows,
        republished: false,
      };
    }

    // Append after the current maximum. Not from zero: the mirrored question's `displayOrder`
    // is a dense index over `[sortOrder asc, key asc]`, so rows that sort LAST leave every
    // existing option's index untouched and the sync's update set empty.
    const base = (await this.repo.maxSortOrder(input.type)) ?? 0;
    const created = await this.repo.insertMany(
      input.type,
      toCreate.map((r, i) => ({ ...r, sortOrder: base + i + 1 })),
      actor.staffId,
    );

    // EVERYTHING, not `invalidateCache(input.type)`. New children of a class list change what
    // `surrogate_fact`'s derived `parentOptions` answers, which is the reasoning `update()`
    // already writes out and which single-row `create()` gets wrong.
    this.repo.invalidateCache();

    const idByKey = new Map(created.map((r) => [r.key, r.id]));
    await this.audit.writeMany(
      toCreate.map((r) => ({
        actorId: actor.staffId,
        targetId: null,
        eventType: AuditEventType.PLATFORM_ENUMERATION_CREATED,
        sourceIp: actor.sourceIp,
        payload: { type: input.type, key: r.key, id: idByKey.get(r.key) ?? null, bulk: true },
      })),
    );

    // ONCE, after the write and after the invalidate — the order `create()` already gets
    // right, and the single most important line in this method.
    //
    // Deferred only for an in-process caller that is about to write to another list too and
    // will sync every one of them, then publish once. Left to default for every HTTP caller:
    // a screen that skipped the sync would leave the questionnaire behind the registry with
    // nothing scheduled to catch it up.
    const republished =
      input.deferMirrorSync === true
        ? false
        : await this.syncMirroredList(input.type, actor.staffId);

    return {
      type: input.type,
      created: toCreate.length,
      skipped: skippedRows.length,
      createdKeys: toCreate.map((r) => r.key),
      skippedRows,
      republished,
    };
  }

  /**
   * What to STORE as a value's parent — the one place the parent axis is enforced.
   *
   * Four answers, and each is a decision rather than a fallback:
   *   · the type is filed under nothing → `null`, whatever the caller sent;
   *   · the type is filed under a list and the caller named nothing → refused. Not
   *     defaulted: the platform choosing a class on the operator's behalf is the platform
   *     stating a price tier, and a wrong guess quotes a real figure to a real applicant;
   *   · the type is filed under a list and the caller passed an explicit `null` while
   *     `allowUnfiled` is set → `null`. That is an operator UNFILING the value on purpose,
   *     and it is a different statement from "you forgot to say": the value stays a pickable
   *     answer, `factParentTable` then answers `no_matching_row`, and every bank keying its
   *     table by this axis quotes that applicant nothing. So only the endpoint built for
   *     moves may ask for it — never create, and never a patch that came to change a label.
   *     When the KIND declares a `fallbackParentKey`, that unfile is REDIRECTED there instead
   *     and `null` becomes unreachable through the API — the operator has said "not that
   *     class", and the kind has already said where that lands;
   *   · the type is filed under a list and the caller named something → it must be a LIVE
   *     member of that list. This validation existed nowhere before: `parentKey` is a bare
   *     string with no foreign key, so a typo saved 200 and surfaced as `no_matching_row` on
   *     a customer, which the income-rule validator explicitly declines to catch.
   *
   * `''` is refused in every case including `allowUnfiled`. It is the reading v18.2.0 closed:
   * it passes the engine's `parentKey IS NOT NULL` filter, so the value looks filed and quotes
   * nothing — the same damage as `null` with none of the intent. "No parent" has one spelling.
   */
  private async resolveParentKey(
    type: string,
    parentKey: string | null | undefined,
    opts: { allowUnfiled?: boolean } = {},
  ): Promise<string | null> {
    const parentType = parentTypeOf(await this.repo.typeDefinitions(), type);
    if (parentType === null) {
      // `null` is NOT excused here, deliberately: unfiling a type that has no parent axis is
      // the same category error as filing one, and both deserve to be reported. Only
      // `undefined` and `''` stay silent — `program_name` keeps the historical silent-drop,
      // because it USED to carry a parent and old clients still send one.
      if (parentKey !== undefined && parentKey !== '' && !isUnscopedEnumerationType(type)) {
        throw new EnumerationParentNotApplicableException({ type });
      }
      return null;
    }
    if (parentKey === null && opts.allowUnfiled === true) {
      // The KIND decides what "not that class" MEANS. A declared fallback makes an unfiled
      // value unreachable through the API — which is the point: an unfiled value is a
      // pickable answer that quotes nothing, because `factParentTable` answers
      // `no_matching_row` and that reason is FATAL, not skippable. Undeclared, `null` stands
      // exactly as v18.3.0 shipped it, so an operator-made axis with nothing to offer instead
      // does not become un-unfileable.
      //
      // Read only HERE, and only under `allowUnfiled`. Never on create: a blank class on a
      // pasted row is a typo, and the paragraph above says why the platform must not answer
      // a typo with a price tier.
      const defs = await this.repo.typeDefinitions();
      return defs.get(type)?.fallbackParentKey ?? null;
    }
    if (parentKey === undefined || parentKey === null || parentKey === '') {
      throw new EnumerationParentRequiredException({ type, parentType });
    }
    const parent = await this.repo.findByTypeAndKey(parentType, parentKey);
    if (!parent || !parent.active || parent.deprecatedAt !== null) {
      const activeKeys = (await this.repo.getActiveMembers(parentType)).map((m) => m.key);
      throw new EnumerationParentUnknownException({
        type,
        parentType,
        parentKey,
        reason: !parent ? 'missing' : parent.deprecatedAt !== null ? 'deprecated' : 'inactive',
        activeKeys,
      });
    }
    return parentKey;
  }

  /**
   * The products a catalog program name may actually take its calculation from: live, and
   * not cap-only.
   *
   * One derivation, used by both refusals that offer the operator a list of what would
   * have worked — two copies is how the "pick one of these" list comes to name a product
   * the very next refusal rejects.
   */
  private async linkableProductKeys(): Promise<string[]> {
    const active = await this.repo.getActiveMembers(SURROGATE_PRODUCT_TYPE);
    return active.map((m) => m.key).filter((key) => !isCapOnlyProductKey(key));
  }

  /**
   * What to STORE as a row's surrogate product — the one place the link is enforced, and the
   * mirror of `resolveParentKey` above.
   *
   * TWO types may carry it, and they mean different things by it (see the column's own doc):
   * on a `program_name` it is where the calculation comes from, and on a `surrogate_fact` it
   * is which product AUTHORED the fact. One function resolves both because the question it
   * answers — "is this a live product?" — is the same, and a second copy is how the two come
   * to disagree about what a live product is.
   *
   * Four answers, same posture:
   *   · the type is neither → refused. A product link on a governorate is a category error,
   *     and force-nulling it silently is how a caller keeps sending it;
   *   · the caller named nothing (`undefined`) → `null`, meaning "states its own rule".
   *     Whether that is ALLOWED is a separate question, asked by
   *     `assertSurrogateProductForBases` — the two are kept apart because the basis and
   *     the link arrive on different requests, and this function must not have to know
   *     which one is being written;
   *   · the caller passed an explicit `null` → `null`. UNLINK, a real operator action;
   *   · the caller named a key → it must be a LIVE `surrogate_product`. There is no
   *     foreign key (the reachable unique is the composite `(type, key)`), so without
   *     this a typo would save 200 and surface as `rule_unconfigured` on a customer.
   *
   * `''` is refused by the DTO before it reaches here, for the reason `parentKey` states:
   * stored, it is a link that resolves to nothing while looking set.
   */
  private async resolveSurrogateProductKey(
    type: string,
    productKey: string | null | undefined,
  ): Promise<string | null> {
    if (type !== PROGRAM_NAME_TYPE && type !== FACT_TYPE) {
      if (productKey !== undefined && productKey !== null) {
        throw new EnumerationParentNotApplicableException({ type });
      }
      return null;
    }
    if (productKey === undefined || productKey === null) return null;

    const product = await this.repo.findByTypeAndKey(SURROGATE_PRODUCT_TYPE, productKey);
    if (!product || !product.active || product.deprecatedAt !== null) {
      const activeProducts = (await this.repo.getActiveMembers(SURROGATE_PRODUCT_TYPE)).map(
        (m) => m.key,
      );
      throw new EnumerationParentUnknownException({
        type,
        parentType: SURROGATE_PRODUCT_TYPE,
        parentKey: productKey,
        reason: !product ? 'missing' : product.deprecatedAt !== null ? 'deprecated' : 'inactive',
        activeKeys: activeProducts,
      });
    }
    // A cap-only product works out no income at all — it asks its question and each bank
    // states the maximum for the answer on its own program. So a NAME may not take its
    // calculation from one; the name would be sold with no payslip and quote nothing,
    // silently, until a customer saw a blank card.
    //
    // Names only. A cap-only product's own FACT is filed under it and must stay filable,
    // which is the whole reason this refusal is keyed on the type rather than on the
    // product.
    if (type === PROGRAM_NAME_TYPE && isCapOnlyProductKey(productKey)) {
      throw new SurrogateProductCapOnlyException({
        type,
        key: productKey,
        surrogateProductKey: productKey,
        linkableProducts: await this.linkableProductKeys(),
      });
    }
    return productKey;
  }

  /**
   * A no-payslip name must say where its calculation comes from.
   *
   * GRANDFATHERED on a name that already states its own `incomeRule`: those predate the
   * archetypes and keep working. Enforcing on them would make every legacy no-payslip
   * name unsavable from admin — and unsavable means unfixable, because the edit that
   * would link it is the edit being refused.
   *
   * Takes the resolved link and the stored rule rather than reading them itself, so the
   * create path (where neither is written yet) and the basis path (where both are) ask
   * the identical question.
   */
  private async assertSurrogateProductForBases(
    row: { type: string; key: string },
    bases: readonly IncomeBasis[],
    linkedTo: string | null,
    statesOwnRule: boolean,
    category?: LoanCategory,
  ): Promise<void> {
    if (row.type !== PROGRAM_NAME_TYPE) return;
    if (!bases.includes('no_payslip')) return;
    if (linkedTo !== null || statesOwnRule) return;

    const activeProducts = await this.linkableProductKeys();
    throw new SurrogateProductRequiredException({
      type: row.type,
      key: row.key,
      ...(category !== undefined ? { category } : {}),
      activeProducts,
    });
  }

  /**
   * Re-file many values onto a parent in one transaction — what the class board saves.
   *
   * One request rather than N patches, and the reason is not speed: a bulk mistake is N rows,
   * and half-applied it leaves some values reading one bank figure and some another with the
   * audit trail as the only record of how far it got. Every id is resolved and every target
   * validated BEFORE anything is written, exactly as `setCategoriesBulk` does.
   */
  async setParentKeysBulk(
    dto: SetEnumerationParentKeysBulkDto,
    actor: AdminActor,
  ): Promise<{ moved: number }> {
    const ids = [...new Set(dto.assignments.map((a) => a.id))];
    const rows = await Promise.all(ids.map((id) => this.repo.findById(id)));
    const byId = new Map<string, { id: string; type: string; key: string }>();
    for (const [index, row] of rows.entries()) {
      if (!row) throw new NotFoundException();
      byId.set(ids[index] as string, row);
    }

    // Validate every (type, target) pair once, not once per row: a board save is N rows with
    // one target, and N identical refusals would be N identical registry reads.
    const typeDefs = await this.repo.typeDefinitions();
    const resolved = new Map<string, string | null>();
    for (const assignment of dto.assignments) {
      const row = byId.get(assignment.id);
      if (!row) continue;
      const pair = `${row.type}\u0000${assignment.parentKey}`;
      if (resolved.has(pair)) continue;
      if (parentTypeOf(typeDefs, row.type) === null) {
        throw new EnumerationParentNotApplicableException({ type: row.type });
      }
      // `allowUnfiled` ONLY here: this is the endpoint an operator uses to say where a value is
      // priced, and "nowhere" is one of the answers it may give. Create and patch keep their
      // refusal — a value of a filed-under type is born filed, and a label edit cannot unfile it.
      //
      // The ANSWER is kept, not just the refusal. `resolveParentKey` is where a kind's declared
      // `fallbackParentKey` turns an unfile into a move, so discarding what it returns would
      // validate one thing and write another — the redirect would never reach the database.
      resolved.set(
        pair,
        await this.resolveParentKey(row.type, assignment.parentKey, { allowUnfiled: true }),
      );
    }

    const moves = await this.repo.setParentKeysBulk(
      dto.assignments.map((assignment) => {
        const row = byId.get(assignment.id);
        const pair = row ? `${row.type}\u0000${assignment.parentKey}` : null;
        return {
          id: assignment.id,
          parentKey:
            pair !== null && resolved.has(pair)
              ? (resolved.get(pair) as string | null)
              : assignment.parentKey,
        };
      }),
    );
    // A move changes no LABEL, so the question's options are unaffected — but the ORDER a
    // list is served in is `sortOrder`, not `parentKey`, so there is genuinely nothing to
    // re-sync here. Stated rather than left as a gap somebody has to re-derive.
    // Every type, for the reason `update()` states: a parentKey move is felt by the row's own
    // cached list AND by `surrogate_fact`'s derived `parentOptions`.
    this.repo.invalidateCache();
    // One statement, not one round trip per moved row. A board save is up to 500 moves and
    // this loop was 500 sequential inserts inside a request the operator is waiting on.
    await this.audit.writeMany(
      moves.map((move) => ({
        actorId: actor.staffId,
        targetId: null,
        eventType: AuditEventType.PLATFORM_ENUMERATION_UPDATED,
        sourceIp: actor.sourceIp,
        payload: {
          type: move.type,
          key: move.key,
          id: move.id,
          // The SAME scalar shape `diffChanges` writes for a single-row patch, so the log
          // reads identically whichever surface the operator used.
          changes: { parentKey: { from: move.from, to: move.to } },
        },
      })),
    );
    return { moved: moves.length };
  }

  async update(
    id: string,
    patch: UpdateEnumerationDto,
    actor: AdminActor,
  ): Promise<EnumerationRow> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException();

    if (existing.systemOnly && (patch.active !== undefined || patch.deprecate !== undefined)) {
      throw new EnumerationSystemOnlyException({ type: existing.type, key: existing.key });
    }

    const repoPatch: EnumerationUpdatePatch = { updatedBy: actor.staffId };
    let eventType:
      | AuditEventType.PLATFORM_ENUMERATION_UPDATED
      | AuditEventType.PLATFORM_ENUMERATION_DEACTIVATED
      | AuditEventType.PLATFORM_ENUMERATION_DEPRECATED =
      AuditEventType.PLATFORM_ENUMERATION_UPDATED;

    if (patch.labelAr !== undefined) repoPatch.labelAr = patch.labelAr;
    if (patch.labelEn !== undefined) repoPatch.labelEn = patch.labelEn;
    // Same rule as create: a type with no parent axis can never acquire one, so the field
    // is dropped rather than written (and stays out of the audit diff). When it IS named it
    // is validated — but ONLY then. A label-only patch on a row that is already unfiled must
    // still save: demanding a parent there would make the row unfixable by the very edit
    // that would fix it, and the class board is the surface that files it.
    if (patch.parentKey !== undefined && !isUnscopedEnumerationType(existing.type)) {
      repoPatch.parentKey = await this.resolveParentKey(existing.type, patch.parentKey);
    }
    // Three values, all reachable (see the DTO): absent leaves the link alone, `null`
    // unlinks, a key re-points. Unlike `parentKey` there is no bulk endpoint to hide the
    // unlink behind, so it is spelled here — and paired with the basis check below, so
    // the order the two writes arrive in cannot decide whether the row ends up valid.
    if (patch.surrogateProductKey !== undefined) {
      repoPatch.surrogateProductKey = await this.resolveSurrogateProductKey(
        existing.type,
        patch.surrogateProductKey,
      );
      const ownRule = await this.repo.findProgramName(existing.key);
      if (repoPatch.surrogateProductKey === null) {
        // Unlinking a name that is still sold without a payslip, and states no rule of its
        // own, would leave it quoting nothing. Refused here rather than left to the basis
        // screen: the operator is looking at the link when they break it.
        const bases = Object.values(await this.repo.incomeBasesOf(id)).flat();
        await this.assertSurrogateProductForBases(
          existing,
          bases,
          null,
          ownRule?.incomeRule != null,
        );
      } else if (ownRule?.incomeRule != null) {
        // LINKING a name that still holds its own rule. A row holding BOTH is a fork:
        // `programNameIncomeRules()` quotes the product's copy while the name's own page
        // and `scripts/income-proof-conflicts.ts` still read the stale one, with nothing
        // to reveal the disagreement. The schema doc, `effectiveProgramNameRule` and the
        // migration's RAISE all assert that state is unreachable; it was reachable through
        // this very patch until now.
        //
        // REFUSED, not absorbed. Clearing the rule here was tried first and is worse: it
        // destroys data on the platform's initiative, and it leaves the name UNFIXABLE —
        // with the rule gone, unlinking hits `SURROGATE_PRODUCT_REQUIRED` and there is no
        // way back. The operator clears it explicitly first, through an endpoint that
        // refuses while bank programs still read it.
        throw new ProgramNameHasOwnRuleException({
          type: existing.type,
          key: existing.key,
          strategy: ownRule.incomeRule.strategy ?? null,
        });
      }
    }

    if (patch.sortOrder !== undefined) repoPatch.sortOrder = patch.sortOrder;

    // Retiring a LIST value while values are still filed under it. Refused, because the
    // engine's parent walk (`enumerationParentKeys`) filters the CHILD row's active flag and
    // never the parent's: a retired class with children goes on pricing off a row the
    // operator can no longer see or re-select, and the admin's own key-table editor drops it
    // from the list at the same moment. A 409 they read beats a quote that carries on.
    const retiring = patch.deprecate === true || patch.active === false;
    if (retiring) {
      const defsNow = await this.repo.typeDefinitions();

      // Retiring the class that some kind's UNFILED values are SENT to. Refused separately
      // from the children check below, because this one fires on a class holding NOTHING —
      // which is precisely the case that check cannot see, and the dangerous one. An empty
      // retired fallback is where the very next untick on the class board lands, and the
      // parent walk never looks at the parent's own active flag, so it prices on in silence.
      const fallbackFor = [...defsNow.values()]
        .filter((d) => d.parentTypeKey === existing.type && d.fallbackParentKey === existing.key)
        .map((d) => d.key);
      if (fallbackFor.length > 0) {
        throw new EnumerationFallbackInUseException({
          type: existing.type,
          key: existing.key,
          childTypes: fallbackFor,
          count: fallbackFor.length,
        });
      }

      for (const childType of childTypesOf(defsNow, existing.type)) {
        const children = await this.repo.countChildren(childType, existing.key);
        if (children > 0) {
          throw new EnumerationHasChildrenException({
            type: existing.type,
            key: existing.key,
            childType,
            children,
          });
        }
      }

      // NO REFUSAL for a PRODUCT that catalog names still take their calculation from, and
      // its absence is the deliberate half. Switching a product off is now the operator's
      // one lifecycle action on it, and stopping the names already linked from quoting is
      // exactly what they are asking for — so `programNameIncomeRules()` withholds the
      // calculation and every affected program comes back LISTED, carrying
      // `SURROGATE_PRODUCT_RETIRED` instead of figures. Refusing here would leave a product
      // that can never be switched off, since a linked name is the normal state.
      //
      // The consequence is stated to the operator BEFORE they confirm, on the screen that
      // holds the list of affected names and program codes, rather than as a 409 afterwards.
    }

    if (patch.deprecate === true && existing.deprecatedAt === null) {
      repoPatch.deprecate = true;
      eventType = AuditEventType.PLATFORM_ENUMERATION_DEPRECATED;
    } else if (patch.active !== undefined && patch.deprecate !== true) {
      repoPatch.active = patch.active;
      if (patch.active === false) eventType = AuditEventType.PLATFORM_ENUMERATION_DEACTIVATED;
    }

    // Only when the row is actually leaving the live set. A relabel or a reorder of a
    // mirrored value re-syncs the option and changes no count, so holding those to the
    // minimum would refuse the edit that FIXES a short list.
    if (repoPatch.deprecate === true || repoPatch.active === false) {
      await this.assertMirroredListSurvives(existing.type, existing.key);
    }

    const updated = await this.repo.updateById(id, repoPatch);
    // A parentKey move is felt by TWO cached types: the row's own, and `surrogate_fact`,
    // whose members carry the derived `parentOptions` list the bank's key-table editor is
    // filled from. Invalidating only `existing.type` left that editor offering the old class
    // list for up to the cache TTL — which, mid-re-filing, reads as "it did not work".
    // A parentKey or product-link move is felt by more than the row's own type, so both
    // clear everything: `surrogate_fact` members carry the derived `parentOptions` the
    // bank's key-table editor is filled from, and a name's link changes what the catalog
    // board reports about the product. Invalidating only `existing.type` left one of those
    // stale for up to the cache TTL — which, mid-edit, reads as "it did not work".
    if (repoPatch.parentKey !== undefined || repoPatch.surrogateProductKey !== undefined) {
      this.repo.invalidateCache();
    } else this.repo.invalidateCache(existing.type);
    await this.syncMirroredList(existing.type, actor.staffId);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType,
      sourceIp: actor.sourceIp,
      payload: {
        type: existing.type,
        key: existing.key,
        id: existing.id,
        changes: this.diffChanges(existing, patch),
      },
    });
    return updated;
  }

  /**
   * Hard-delete a registry entry — row gone, loan-category and question
   * assignments cascaded with it.
   *
   * Not a second flavour of deprecate. Deprecating parks a value that IS in use:
   * it stops appearing in every picker, everything that already names it keeps
   * working, and the row survives to explain those keys. This is for the other
   * case — a value added by mistake, or one nothing ever used — where leaving a
   * tombstone on the board is just noise an operator has to re-read forever.
   *
   * Three guards, in the order an operator meets them:
   *  - never `systemOnly`, matching `update()`'s rule for active/deprecate: a
   *    system-managed row is not the operator's to remove.
   *  - only a type whose readers `countReferences` enumerates. No enumeration key
   *    carries an FK anywhere, so a type nobody has counted is refused rather than
   *    guessed at.
   *  - never while referenced. Postgres would happily let the row go and leave
   *    every reader pointing at nothing — the ghost rows A26 forbids. The
   *    exception names each surface and its count, so the operator knows whether
   *    repointing anything would even help.
   *
   * The audit event carries the labels, not just the id: once the row is gone it
   * is the only remaining record that the key ever existed.
   */
  async remove(id: string, actor: AdminActor): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException();
    if (existing.systemOnly) {
      throw new EnumerationSystemOnlyException({ type: existing.type, key: existing.key });
    }

    const usedBy = await this.repo.countReferences(existing.type, existing.key);
    if (usedBy === null) {
      throw new EnumerationDeleteNotSupportedException({ type: existing.type });
    }
    const references = usedBy.reduce((sum, r) => sum + r.count, 0);
    if (references > 0) {
      throw new EnumerationInUseException({
        type: existing.type,
        key: existing.key,
        references,
        // Only the surfaces that actually hold something — a meta line reading
        // `document: 0` invites the operator to go looking for rows there are none of.
        usedBy: usedBy.filter((r) => r.count > 0),
      });
    }

    // Last, because the three guards above are cheaper and name a more specific blocker.
    await this.assertMirroredListSurvives(existing.type, existing.key);

    await this.repo.deleteById(id);
    this.repo.invalidateCache(existing.type);
    await this.syncMirroredList(existing.type, actor.staffId);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.PLATFORM_ENUMERATION_DELETED,
      sourceIp: actor.sourceIp,
      payload: {
        type: existing.type,
        key: existing.key,
        id: existing.id,
        labelAr: existing.labelAr,
        labelEn: existing.labelEn,
      },
    });
  }

  // ---- Loan-category assignment --------------------------------------------

  /**
   * Replace one entry's loan-category set. The submitted array IS the new set,
   * not a delta, and MAY be empty — an empty set parks the entry: kept and
   * editable, offerable under no category.
   *
   * Deliberately NOT guarded on `systemOnly`, unlike `active`/`deprecate` in
   * `update()`. Which categories a name is offered under is an operational
   * choice, not a system invariant — a system-managed name still has to be
   * fileable. (No `program_name` row is `systemOnly` today; this is about what
   * the rule means, not what it currently blocks.)
   */
  async setCategories(
    id: string,
    categories: LoanCategory[],
    actor: AdminActor,
  ): Promise<EnumerationRow> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException();
    if (!isCategorisedEnumerationType(existing.type)) {
      throw new EnumerationCategoriesNotApplicableException({ type: existing.type });
    }

    const before = await this.repo.categoriesOf(id);
    const next = dedupeCategories(categories);
    await this.repo.setCategories(id, next);
    this.repo.invalidateCache(PROGRAM_NAME_TYPE);

    // No-op saves write no audit — the board autosaves on every tap, so an
    // unchanged set is a re-render, not an operator decision.
    if (before.join(',') !== next.join(',')) {
      await this.writeCategoryAudit(existing, before, next, actor);
    }
    return existing;
  }

  /**
   * Reassign many entries in ONE transaction — the board's per-category
   * "offer all / remove all" actions.
   *
   * Every id is validated BEFORE anything is written: a bulk action that
   * half-applies and then reports an error leaves the operator with no idea
   * which half landed.
   */
  async setCategoriesBulk(
    assignments: ReadonlyArray<{ id: string; categories: LoanCategory[] }>,
    actor: AdminActor,
  ): Promise<EnumerationRow[]> {
    const rows = await this.repo.findAllOrdered({ type: PROGRAM_NAME_TYPE });
    const byId = new Map(rows.map((r) => [r.id, r]));

    const resolved: Array<{ row: EnumerationRow; next: LoanCategory[] }> = [];
    for (const a of assignments) {
      const row = byId.get(a.id) ?? (await this.repo.findById(a.id));
      if (!row) throw new NotFoundException();
      if (!isCategorisedEnumerationType(row.type)) {
        throw new EnumerationCategoriesNotApplicableException({ type: row.type });
      }
      resolved.push({ row, next: dedupeCategories(a.categories) });
    }

    const before = await this.repo.categoryAssignments({ type: PROGRAM_NAME_TYPE });
    const writes: EnumerationCategoryAssignment[] = resolved.map((r) => ({
      enumerationId: r.row.id,
      categories: r.next,
    }));
    await this.repo.setCategoriesBulk(writes);
    this.repo.invalidateCache(PROGRAM_NAME_TYPE);

    // One event per CHANGED row, after the transaction commits — the same
    // per-row payload shape `update()` writes, so no audit consumer branches.
    for (const { row, next } of resolved) {
      const prev = dedupeCategories(before.get(row.id) ?? []);
      if (prev.join(',') === next.join(',')) continue;
      await this.writeCategoryAudit(row, prev, next, actor);
    }
    return this.repo.findAllOrdered({ type: PROGRAM_NAME_TYPE });
  }

  // ---- Income basis (per name, per category) --------------------------------

  /** Income bases for a type, keyed by enumeration id then by loan category. */
  async incomeBasisAssignments(filter?: {
    type?: string;
  }): Promise<Map<string, IncomeBasesByCategory>> {
    return this.repo.incomeBasisAssignments(filter);
  }

  /**
   * Replace ONE (name, category) pair's income basis — "How do banks prove the
   * income" on the catalog detail screen and in the Add / Edit dialog.
   *
   * Refuses a category the name is not offered under rather than creating the
   * assignment: the two controls sit next to each other on the same tab and mean
   * different things, so a basis write that silently offered the name somewhere
   * new would be the screen doing something the operator did not ask for.
   *
   * Not guarded on `systemOnly`, like both assignment axes above: how a name is
   * sold is an operational choice, not a system invariant.
   */
  async setIncomeBases(
    id: string,
    category: LoanCategory,
    bases: IncomeBasis[],
    actor: AdminActor,
  ): Promise<EnumerationRow> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException();
    if (!isCategorisedEnumerationType(existing.type)) {
      throw new EnumerationCategoriesNotApplicableException({ type: existing.type });
    }

    const before = (await this.repo.incomeBasesOf(id))[category] ?? [];
    const next = dedupeBases(bases);

    // Moving a name TO the no-payslip basis when nothing says how its income is worked
    // out. Checked BEFORE the write, so a refusal leaves the row exactly as it was —
    // the same posture the dialog relies on when it writes the basis first.
    //
    // Grandfathered on a name that states its own rule: those predate the archetypes and
    // must stay editable, or the edit that would link them is the edit being refused.
    const ownRule = await this.repo.findProgramName(existing.key);
    await this.assertSurrogateProductForBases(
      existing,
      next,
      existing.surrogateProductKey,
      ownRule?.incomeRule != null,
      category,
    );

    const written = await this.repo.setIncomeBases(id, category, next);
    if (written === 0) {
      throw new EnumerationCategoryNotAssignedException({
        type: existing.type,
        key: existing.key,
        category,
      });
    }
    // Invalidated for the same reason as `setCategories`: the catalog board reads
    // this off the same list the cache serves, so a 60s window would show the
    // operator the old answer on the screen they just changed it from.
    this.repo.invalidateCache(PROGRAM_NAME_TYPE);

    if (before.join(',') !== next.join(',')) {
      await this.writeAssignmentAudit(existing, `incomeBasis.${category}`, before, next, actor);
    }
    return existing;
  }

  // ---- Question template ---------------------------------------------------

  /**
   * Suggested question sets for a type, keyed by enumeration id then by loan
   * category (codes).
   */
  async questionAssignments(filter?: {
    type?: string;
  }): Promise<Map<string, QuestionCodesByCategory>> {
    return this.repo.questionAssignments(filter);
  }

  /** The active question pool the template board picks from. */
  async questionPool(): Promise<CatalogQuestionRow[]> {
    return this.repo.questionTemplatePool();
  }

  /**
   * Replace one catalog name's SUGGESTED question set FOR ONE loan category.
   * Advisory data: it pre-ticks the per-program scoring wizard and is read by
   * nothing at runtime, so this can never invalidate a weight set a bank already
   * saved.
   *
   * Scoped to `category`; the other three sets are untouched. The name's own
   * category ASSIGNMENT is a different axis with its own endpoint — a name can
   * be templated for a category it is not currently offered under, and that is
   * not an error (below).
   *
   * Deliberately NOT guarded on `systemOnly`, for the same reason as
   * `setCategories`: which questions a name suggests is an operational choice,
   * not a system invariant.
   *
   * Deliberately NOT guarded on scope either — neither a question code outside
   * the category's asked set, nor a category the name is not assigned to, is
   * rejected. This looks exactly like two missing validations and is neither:
   * the detail screen surfaces both (a "no longer asked" tag, and a tab whose
   * "offered under" switch is off), so the admin can see and fix them. Rejecting
   * would make an existing drifted set unsaveable, and pruning would destroy
   * configuration the admin never asked to lose.
   */
  async setQuestions(
    id: string,
    category: LoanCategory,
    questionCodes: string[],
    actor: AdminActor,
  ): Promise<EnumerationRow> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException();
    if (!isQuestionTemplateEnumerationType(existing.type)) {
      throw new EnumerationQuestionsNotApplicableException({ type: existing.type });
    }

    const next = [...new Set(questionCodes)];
    if (next.length > 0) {
      // Checked against EVERY question, not just the active pool: an admin
      // re-saving a template that still names a soft-deleted question must not
      // be blocked by a row they are being told to come here and remove.
      const known = await this.repo.existingQuestionCodes(next);
      const unknownCodes = next.filter((c) => !known.has(c));
      if (unknownCodes.length > 0) {
        throw new EnumerationQuestionUnknownException({
          type: existing.type,
          key: existing.key,
          unknownCodes,
        });
      }
    }

    const before = await this.repo.questionsOfCategory(id, category);
    await this.repo.setQuestions(id, category, next);
    // No `invalidateCache` here, deliberately: question codes are kept OFF
    // `EnumerationMember` precisely so the 60s registry cache cannot serve the
    // wizard a stale suggestion. Invalidating would imply the cache holds this.

    if (!sameCodeSet(before, next)) {
      // Audited per category — `questions.personal`, not `questions`. One key for
      // all four would make a diff on the Personal tab read as though the whole
      // template had been replaced, and the log is what an operator reaches for
      // when a bank asks why its wizard changed.
      await this.writeAssignmentAudit(
        existing,
        `questions.${category}`,
        sortCodes(before),
        sortCodes(next),
        actor,
      );
    }
    return existing;
  }

  // ---- Surrogate fact binding ---------------------------------------------

  /** The bound question of every fact of a type, keyed by enumeration id. */
  async boundQuestions(filter?: { type?: string }): Promise<Map<string, BoundQuestion>> {
    return this.repo.boundQuestions(filter);
  }

  /**
   * Point one FACT at the question that answers it, or unbind it (`null`).
   *
   * Three rejections, each naming a different fix:
   *   · not a fact type → the caller addressed the wrong row entirely
   *   · unknown code → the question does not exist (a typo, or it was deleted)
   *   · wrong type → TEXT/MULTI_SELECT, which no bank table can be keyed by
   *
   * An INACTIVE question is accepted, deliberately. Binding is how an operator sets a
   * fact up, and questionnaire edits land in their own order: refusing here would make
   * "create the question, bind the fact, activate the question" impossible in the one
   * order an operator naturally works in. The consequence is visible rather than
   * silent — publish reports the fact as `missing_or_inactive` and the engine's
   * registry read drops it, so no applicant is priced off an answer nobody was asked.
   *
   * Not guarded on `systemOnly`, like the assignment axes: the four seeded facts are
   * system rows so their KEYS cannot be renamed out from under a stored `fact:` token,
   * but which question answers "military grade" is exactly the operational choice this
   * feature exists to hand over.
   */
  /**
   * Point a LIST at the question whose options are that list.
   *
   * Needed because two seeded lists were copied into their questions once and never linked:
   * `military_grade` and `professor_rank` hold three values each where the sheets publish
   * seven, and a value added to either reached the registry and never the question — a grade
   * no applicant could pick and no bank's table could be keyed by. Adopting the link is safe
   * for exactly those two because the seed created their options with `code` equal to the
   * value key, which is what `syncMirroredOptions` matches on.
   *
   * Idempotent, and silent when the link is already there: the caller is a create that may
   * run twice.
   */
  async linkMirrorQuestion(
    typeKey: string,
    questionCode: string,
    actor: AdminActor,
  ): Promise<void> {
    const defs = await this.repo.typeDefinitions();
    const def = defs.get(typeKey);
    if (!def) throw new EnumerationTypeNotFoundException({ key: typeKey });
    const question = await this.repo.findBindableQuestion(questionCode);
    if (!question) {
      throw new EnumerationQuestionUnknownException({
        type: typeKey,
        key: typeKey,
        unknownCodes: [questionCode],
      });
    }
    if (def.mirrorQuestionId === question.id) return;
    await this.repo.updateTypeDefinition(typeKey, { mirrorQuestionId: question.id });
    this.repo.invalidateCache();
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.ENUMERATION_TYPE_UPDATED,
      sourceIp: actor.sourceIp,
      payload: {
        key: typeKey,
        changes: { mirrorQuestion: { from: def.mirrorQuestionId, to: question.id } },
      },
    });
  }

  async setBoundQuestion(
    id: string,
    questionCode: string | null,
    actor: AdminActor,
  ): Promise<EnumerationRow> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException();
    if (!isQuestionBoundEnumerationType(existing.type)) {
      throw new EnumerationQuestionBindingNotApplicableException({ type: existing.type });
    }

    if (questionCode !== null) {
      const question = await this.repo.findBindableQuestion(questionCode);
      if (!question) {
        throw new EnumerationQuestionUnknownException({
          type: existing.type,
          key: existing.key,
          unknownCodes: [questionCode],
        });
      }
      if (!isBindableQuestionType(question.type)) {
        throw new SurrogateFactQuestionTypeInvalidException({
          key: existing.key,
          questionCode,
          type: question.type,
          allowed: [...BINDABLE_QUESTION_TYPES],
        });
      }
    }

    const before = (await this.repo.boundQuestions({ type: existing.type })).get(id)?.code ?? null;
    const row = await this.repo.setBoundQuestion(id, questionCode, actor.staffId);
    // Invalidated: the binding rides on the cached member payload (the catalog board
    // derives its fact tick-list from it), so a 60s window would show the operator a
    // screen that does not yet know about the fact they just bound.
    this.repo.invalidateCache(FACT_TYPE);

    if (before !== questionCode) {
      await this.writeAssignmentAudit(
        existing,
        'boundQuestion',
        before ? [before] : [],
        questionCode ? [questionCode] : [],
        actor,
      );
    }
    return row;
  }

  /**
   * One audit shape for both assignment axes. Reuses
   * PLATFORM_ENUMERATION_UPDATED rather than adding event types: `AuditEventType`
   * is also a Postgres enum, so each new value costs an ALTER TYPE migration,
   * and `payload` is JSONB — the diff rides free in the same
   * `{type, key, id, changes}` shape every other update writes.
   */
  private async writeAssignmentAudit(
    row: EnumerationRow,
    // `questions.<category>` rather than a plain 'questions': the question
    // template is per loan category, and a diff that did not say which one would
    // be unreadable as soon as a name is templated twice. `incomeBasis.<category>`
    // is per category for the same reason — a name meant for no-payslip lending as a
    // personal loan and payslip-only as a car loan produces two independent diffs.
    field:
      | 'categories'
      | `questions.${LoanCategory}`
      | `incomeBasis.${LoanCategory}`
      // Not per category: a fact reads ONE question whoever is asking, which is what
      // makes it a fact rather than a per-product rule.
      | 'boundQuestion',
    from: readonly string[],
    to: readonly string[],
    actor: AdminActor,
  ): Promise<void> {
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.PLATFORM_ENUMERATION_UPDATED,
      sourceIp: actor.sourceIp,
      payload: {
        type: row.type,
        key: row.key,
        id: row.id,
        changes: { [field]: { from: [...from], to: [...to] } },
      },
    });
  }

  private async writeCategoryAudit(
    row: EnumerationRow,
    from: LoanCategory[],
    to: LoanCategory[],
    actor: AdminActor,
  ): Promise<void> {
    await this.writeAssignmentAudit(row, 'categories', from, to, actor);
  }

  private diffChanges(
    existing: EnumerationRow,
    patch: UpdateEnumerationDto,
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (patch.labelAr !== undefined && patch.labelAr !== existing.labelAr) {
      changes.labelAr = { from: existing.labelAr, to: patch.labelAr };
    }
    if (patch.labelEn !== undefined && patch.labelEn !== existing.labelEn) {
      changes.labelEn = { from: existing.labelEn, to: patch.labelEn };
    }
    if (patch.active !== undefined && patch.active !== existing.active) {
      changes.active = { from: existing.active, to: patch.active };
    }
    if (
      patch.parentKey !== undefined &&
      patch.parentKey !== existing.parentKey &&
      !isUnscopedEnumerationType(existing.type)
    ) {
      changes.parentKey = { from: existing.parentKey, to: patch.parentKey };
    }
    if (
      patch.surrogateProductKey !== undefined &&
      (patch.surrogateProductKey ?? null) !== existing.surrogateProductKey
    ) {
      changes.surrogateProductKey = {
        from: existing.surrogateProductKey,
        to: patch.surrogateProductKey ?? null,
      };
    }
    if (patch.sortOrder !== undefined && patch.sortOrder !== existing.sortOrder) {
      changes.sortOrder = { from: existing.sortOrder, to: patch.sortOrder };
    }
    if (patch.deprecate === true && existing.deprecatedAt === null) {
      changes.deprecated = { from: false, to: true };
    }
    return changes;
  }
}
