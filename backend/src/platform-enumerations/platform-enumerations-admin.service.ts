import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { LoanCategory } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  EnumerationCategoriesNotApplicableException,
  EnumerationCategoryNotAssignedException,
  EnumerationDeleteNotSupportedException,
  EnumerationHasChildrenException,
  EnumerationInUseException,
  EnumerationKeyDuplicateException,
  EnumerationParentNotApplicableException,
  EnumerationTypeDuplicateException,
  EnumerationTypeInUseException,
  EnumerationTypeNotFoundException,
  EnumerationTypeParentInvalidException,
  EnumerationTypeSystemOnlyException,
  ProgramNameHasOwnRuleException,
  SurrogateProductInUseException,
  SurrogateProductRequiredException,
  EnumerationParentRequiredException,
  EnumerationParentUnknownException,
  EnumerationQuestionBindingNotApplicableException,
  EnumerationQuestionUnknownException,
  EnumerationQuestionsNotApplicableException,
  SurrogateFactQuestionTypeInvalidException,
  EnumerationSystemOnlyException,
  NotFoundException,
} from '@/common/errors/domain.exceptions';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
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

export interface AdminActor {
  staffId: string;
  sourceIp: string | null;
}

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
  private async syncMirroredList(type: string, actor: string): Promise<void> {
    const defs = await this.repo.typeDefinitions();
    if (defs.get(type)?.mirrorQuestionId == null) return;
    await this.questionnaire.syncMirroredOptions(type, actor);
  }

  async listAll(filter?: { type?: string }): Promise<EnumerationRow[]> {
    return this.repo.findAllOrdered(filter);
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

    if (patch.parentTypeKey !== undefined) {
      if (existing.systemOnly) {
        throw new EnumerationTypeSystemOnlyException({ key, attempted: 'rename' });
      }
      this.assertParentTypeUsable(defs, key, patch.parentTypeKey);
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
      throw new EnumerationTypeInUseException({ key, values: children.length });
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

  /** A parent axis must name a kind that exists and must not be the kind itself. */
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
  }

  async create(input: CreateEnumerationDto, actor: AdminActor): Promise<EnumerationRow> {
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
   *     moves may ask for it — never create, and never a patch that came to change a label;
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
    if (parentKey === null && opts.allowUnfiled === true) return null;
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

    const activeProducts = (await this.repo.getActiveMembers(SURROGATE_PRODUCT_TYPE)).map(
      (m) => m.key,
    );
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
    const seen = new Set<string>();
    for (const assignment of dto.assignments) {
      const row = byId.get(assignment.id);
      if (!row) continue;
      const pair = `${row.type}\u0000${assignment.parentKey}`;
      if (seen.has(pair)) continue;
      seen.add(pair);
      if (parentTypeOf(typeDefs, row.type) === null) {
        throw new EnumerationParentNotApplicableException({ type: row.type });
      }
      // `allowUnfiled` ONLY here: this is the endpoint an operator uses to say where a value is
      // priced, and "nowhere" is one of the answers it may give. Create and patch keep their
      // refusal — a value of a filed-under type is born filed, and a label edit cannot unfile it.
      await this.resolveParentKey(row.type, assignment.parentKey, { allowUnfiled: true });
    }

    const moves = await this.repo.setParentKeysBulk(dto.assignments);
    // A move changes no LABEL, so the question's options are unaffected — but the ORDER a
    // list is served in is `sortOrder`, not `parentKey`, so there is genuinely nothing to
    // re-sync here. Stated rather than left as a gap somebody has to re-derive.
    // Every type, for the reason `update()` states: a parentKey move is felt by the row's own
    // cached list AND by `surrogate_fact`'s derived `parentOptions`.
    this.repo.invalidateCache();
    for (const move of moves) {
      await this.audit.write({
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
      });
    }
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
      for (const childType of childTypesOf(await this.repo.typeDefinitions(), existing.type)) {
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

      // Retiring a PRODUCT while catalog names still take their calculation from it. Same
      // shape of refusal, different axis — and load-bearing for the same reason:
      // `programNameIncomeRules()` resolves a link without checking the product's active
      // flag, deliberately, so that retiring one cannot blank the income of names already
      // on it mid-flight. That is only safe because this stops the retire happening while
      // anyone is still linked. A separate code from HAS_CHILDREN: its meta and its Arabic
      // both describe a filing relation, and this is a product/consumer one.
      if (existing.type === SURROGATE_PRODUCT_TYPE) {
        const names = await this.repo.programNamesLinkedTo(existing.key);
        if (names.length > 0) {
          throw new SurrogateProductInUseException({ key: existing.key, names });
        }
      }
    }

    if (patch.deprecate === true && existing.deprecatedAt === null) {
      repoPatch.deprecate = true;
      eventType = AuditEventType.PLATFORM_ENUMERATION_DEPRECATED;
    } else if (patch.active !== undefined && patch.deprecate !== true) {
      repoPatch.active = patch.active;
      if (patch.active === false) eventType = AuditEventType.PLATFORM_ENUMERATION_DEACTIVATED;
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
