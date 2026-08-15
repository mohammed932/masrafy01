import { Injectable } from '@nestjs/common';
import type { LoanCategory } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  EnumerationCategoriesNotApplicableException,
  EnumerationCategoryNotAssignedException,
  EnumerationDeleteNotSupportedException,
  EnumerationInUseException,
  EnumerationKeyDuplicateException,
  EnumerationQuestionUnknownException,
  EnumerationQuestionsNotApplicableException,
  EnumerationSystemOnlyException,
  NotFoundException,
} from '@/common/errors/domain.exceptions';
import { ALL_LOAN_CATEGORIES, dedupeCategories } from '@/common/loan-category.util';
import { dedupeBases, type IncomeBasis } from '@/common/income-basis.util';
import {
  isCategorisedEnumerationType,
  isQuestionTemplateEnumerationType,
  isUnscopedEnumerationType,
  type IncomeBasesByCategory,
  type QuestionCodesByCategory,
} from './platform-enumerations.repository';
import {
  PostgresPlatformEnumerationsRepository,
  type CatalogQuestionRow,
  type EnumerationCategoryAssignment,
  type EnumerationRow,
  type EnumerationUpdatePatch,
  type ProgramNameUsage,
} from './postgres-platform-enumerations.repository';
import type { CreateEnumerationDto, UpdateEnumerationDto } from './dto/enumeration.dto';

/** The only categorised type today; see `CATEGORISED_ENUMERATION_TYPES`. */
const PROGRAM_NAME_TYPE = 'program_name';

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
  ) {}

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

  async listTypes(): Promise<
    Array<{ type: string; total: number; active: number; deprecated: number }>
  > {
    return this.repo.listTypeStats();
  }

  /** Loan-category assignments for a type, keyed by enumeration id. */
  async categoryAssignments(filter?: { type?: string }): Promise<Map<string, LoanCategory[]>> {
    return this.repo.categoryAssignments(filter);
  }

  async create(input: CreateEnumerationDto, actor: AdminActor): Promise<EnumerationRow> {
    const existing = await this.repo.findByTypeAndKey(input.type, input.key);
    if (existing) {
      throw new EnumerationKeyDuplicateException({ type: input.type, key: input.key });
    }
    const created = await this.repo.insert({
      type: input.type,
      key: input.key,
      labelAr: input.labelAr,
      labelEn: input.labelEn,
      // An unscoped type is a pure name — it belongs to no parent, and a caller
      // sending one is a bug, not an intent to scope it.
      parentKey: isUnscopedEnumerationType(input.type) ? null : (input.parentKey ?? null),
      // Default a new categorised entry to ALL categories, never none: an entry
      // assigned to nothing is offerable nowhere, so a create that named no
      // categories would silently add an invisible catalog row. Operators add
      // names on one tab and narrow them on the other, never the reverse.
      // Dropped silently for other types, mirroring `parentKey` above.
      categories: isCategorisedEnumerationType(input.type)
        ? dedupeCategories(input.categories ?? [...ALL_LOAN_CATEGORIES])
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
    this.repo.invalidateCache(input.type as never);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.PLATFORM_ENUMERATION_CREATED,
      sourceIp: actor.sourceIp,
      payload: { type: created.type, key: created.key, id: created.id },
    });
    return created;
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
    // Same rule as create: an unscoped type can never acquire a parent, so the
    // field is dropped rather than written (and stays out of the audit diff).
    if (patch.parentKey !== undefined && !isUnscopedEnumerationType(existing.type)) {
      repoPatch.parentKey = patch.parentKey;
    }
    if (patch.sortOrder !== undefined) repoPatch.sortOrder = patch.sortOrder;

    if (patch.deprecate === true && existing.deprecatedAt === null) {
      repoPatch.deprecate = true;
      eventType = AuditEventType.PLATFORM_ENUMERATION_DEPRECATED;
    } else if (patch.active !== undefined && patch.deprecate !== true) {
      repoPatch.active = patch.active;
      if (patch.active === false) eventType = AuditEventType.PLATFORM_ENUMERATION_DEACTIVATED;
    }

    const updated = await this.repo.updateById(id, repoPatch);
    this.repo.invalidateCache(existing.type as never);
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
   * Hard-delete a catalog entry — row gone, loan-category and question
   * assignments cascaded with it.
   *
   * Not a second flavour of deprecate. Deprecating parks a name that IS in use:
   * it stops appearing in the picker, every bank program that already names it
   * keeps working, and the row survives to explain those keys. This is for the
   * other case — a name added by mistake, or one nothing ever instantiated —
   * where leaving a tombstone on the board is just noise an operator has to
   * re-read forever.
   *
   * Three guards, in the order an operator meets them:
   *  - `program_name` only. Every other type is referenced by key from places no
   *    single count covers, so a delete there would dangle silently.
   *  - never `systemOnly`, matching `update()`'s rule for active/deprecate: a
   *    system-managed row is not the operator's to remove.
   *  - never while referenced. There is no FK on either `programNameKey` column
   *    (the catalog's unique key is composite), so Postgres would happily let the
   *    row go and leave both pointing at nothing — the ghost rows A26 forbids.
   *    The exception names both counts so the operator knows whether repointing
   *    the programs would even help.
   *
   * The audit event carries the labels, not just the id: once the row is gone it
   * is the only remaining record that the key ever existed.
   */
  async remove(id: string, actor: AdminActor): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException();
    if (existing.type !== PROGRAM_NAME_TYPE) {
      throw new EnumerationDeleteNotSupportedException({ type: existing.type });
    }
    if (existing.systemOnly) {
      throw new EnumerationSystemOnlyException({ type: existing.type, key: existing.key });
    }

    const refs = await this.repo.countProgramNameReferences(existing.key);
    if (refs.programs > 0 || refs.applications > 0) {
      throw new EnumerationInUseException({
        type: existing.type,
        key: existing.key,
        programs: refs.programs,
        applications: refs.applications,
      });
    }

    await this.repo.deleteById(id);
    this.repo.invalidateCache(existing.type as never);
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
   * Replace ONE (name, category) pair's income basis — "Sold without a payslip"
   * on the catalog detail screen.
   *
   * Refuses a category the name is not offered under rather than creating the
   * assignment: the two switches sit next to each other on the same tab and mean
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
    const written = await this.repo.setIncomeBases(id, category, next);
    if (written === 0) {
      throw new EnumerationCategoryNotAssignedException({
        type: existing.type,
        key: existing.key,
        category,
      });
    }
    // Invalidated, unlike `setQuestions`: the basis DOES ride on the cached member
    // payload (the bank-program picker filters on it), so a 60s window would let a
    // name the operator just marked no-payslip stay missing from the picker they
    // opened it for.
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
    // is per category for the same reason — a name sold without a payslip as a
    // personal loan and against one as a car loan produces two independent diffs.
    field: 'categories' | `questions.${LoanCategory}` | `incomeBasis.${LoanCategory}`,
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
    if (patch.sortOrder !== undefined && patch.sortOrder !== existing.sortOrder) {
      changes.sortOrder = { from: existing.sortOrder, to: patch.sortOrder };
    }
    if (patch.deprecate === true && existing.deprecatedAt === null) {
      changes.deprecated = { from: false, to: true };
    }
    return changes;
  }
}
