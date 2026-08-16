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
  EnumerationQuestionBindingNotApplicableException,
  EnumerationQuestionUnknownException,
  EnumerationQuestionsNotApplicableException,
  SurrogateFactQuestionTypeInvalidException,
  EnumerationSystemOnlyException,
  NotFoundException,
} from '@/common/errors/domain.exceptions';
import { ALL_LOAN_CATEGORIES, dedupeCategories } from '@/common/loan-category.util';
import { dedupeBases, type IncomeBasis } from '@/common/income-basis.util';
import {
  BINDABLE_QUESTION_TYPES,
  isBindableQuestionType,
  isCategorisedEnumerationType,
  isQuestionBoundEnumerationType,
  isQuestionTemplateEnumerationType,
  isUnscopedEnumerationType,
  type BoundQuestion,
  type EnumerationType,
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

    const usedBy = await this.repo.countReferences(existing.type as EnumerationType, existing.key);
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
    this.repo.invalidateCache('surrogate_fact');

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
    if (patch.sortOrder !== undefined && patch.sortOrder !== existing.sortOrder) {
      changes.sortOrder = { from: existing.sortOrder, to: patch.sortOrder };
    }
    if (patch.deprecate === true && existing.deprecatedAt === null) {
      changes.deprecated = { from: false, to: true };
    }
    return changes;
  }
}
