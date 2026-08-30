import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';
import type { LoanCategory } from '@core/loan-category';
import type { IncomeBasis } from '@core/income-basis';

/** One entry's new assignment set, for the bulk write. */
export interface EnumerationCategoryAssignment {
  id: string;
  categories: LoanCategory[];
}

/** Question answer types, mirroring the backend `QuestionType` enum. */
export type CatalogQuestionType = 'SINGLE_SELECT' | 'MULTI_SELECT' | 'NUMERIC' | 'TEXT';

/** One active question, as the catalog's question-template board renders it. */
export interface CatalogQuestion {
  code: string;
  labelAr: string;
  labelEn: string;
  type: CatalogQuestionType;
  /** The loan categories that ASK this question. Empty = parked. */
  categories: LoanCategory[];
}

export interface EnumerationRow {
  id: string;
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  deprecatedAt: string | null;
  systemOnly: boolean;
  parentKey: string | null;
  /**
   * `program_name` only — the surrogate product this catalog name takes its calculation
   * from, or `null` when it states its own rule.
   *
   * Always present, never conditional: the admin has to tell "linked" from "states its own"
   * on every row, and an absent field would read as the second when it might be the first.
   */
  surrogateProductKey: string | null;
  /** `program_name` rows only — how many bank programs instantiate this archetype. */
  usage?: {
    programs: number;
    banks: number;
    /** Of those, how many are typed `income_surrogate` — sold with no payslip. */
    noPayslipPrograms: number;
    /**
     * No-payslip programs that assume no income yet — the program says there is no
     * payslip, but the bank's own income table was never entered, so the rule falls
     * back to the declared salary and the customer gets no figure. What the list
     * badges as "no table yet".
     */
    noPayslipProgramsWithoutTable: number;
    /**
     * The payslip / no-payslip split per loan category — `{ personal: { payslip: 2,
     * noPayslip: 1 } }`. What a catalog name's per-loan-type tab reports, counted from
     * the programs banks actually created; a category with no program is ABSENT, which
     * the tab renders as "no bank offers this yet".
     *
     * Optional so the bundle still runs against a backend that predates the field.
     */
    byCategory?: Partial<Record<LoanCategory, { payslip: number; noPayslip: number }>>;
  };
  /**
   * `program_name` rows only — which loan categories may offer this name.
   * Absent means the type has no such axis; a present `[]` means PARKED
   * (offerable nowhere). Optional so the bundle still runs against a backend
   * that has not deployed the assignment endpoints yet.
   */
  categories?: LoanCategory[];
  /**
   * `program_name` rows only — how this name is MEANT to be sold under each category
   * it is offered under: against a payslip, without one, or both. Keyed by the
   * assignment, so a category absent here is one the name is not offered under; an
   * offered category always carries at least one basis.
   *
   * The catalog's INTENT, and only that. It filters nothing and refuses nothing —
   * `usage.byCategory` above says what banks actually did, and the two may disagree.
   */
  incomeBasesByCategory?: Partial<Record<LoanCategory, IncomeBasis[]>>;
  /**
   * `program_name` rows only — question codes this name SUGGESTS scoring on,
   * PER loan category. Advisory: it pre-ticks the per-program scoring wizard and
   * constrains nothing. A missing category key and an empty array both mean "not
   * configured for that category", which is the day-one state and not a problem
   * — unlike `categories` above, where `[]` is the meaningful "parked" state.
   */
  questionsByCategory?: Partial<Record<LoanCategory, string[]>>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnumerationTypeSummary {
  type: string;
  total: number;
  active: number;
  deprecated: number;
  /**
   * Whether a row of this type can be hard-deleted at all — the server's own answer.
   *
   * `undefined` means NOT LOADED, never "no": a backend that predates the field must leave
   * the button as it was rather than hide an action that still works.
   */
  deletable?: boolean;
  /**
   * What the KIND itself is — label, parent axis, rail placement — served from
   * `enumeration_type_def` rather than restated in a hardcoded map on this side.
   *
   * `null` is a real state: a type that has values but no definition row. Reachable only if
   * something wrote a type outside the admin API, and surfaced rather than hidden so the
   * operator can name it — dropping it from the list would make rows exist that no screen
   * admits to. `undefined` still means NOT LOADED.
   */
  definition?: EnumerationTypeDefinition | null;
}

/**
 * A KIND of list.
 *
 * Mirrors the server's `EnumerationTypeDefinition`. This replaces three hardcoded maps that
 * each stated part of the same thing — `LOOKUP_TYPES` (rail label, description, icon),
 * `ENUMERATION_TYPE_LABELS` (label again, for types off the rail) and `EXAMPLES` (the add
 * dialog's placeholder) — none of which a new kind could extend without a release.
 */
export interface EnumerationTypeDefinition {
  key: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  icon: string | null;
  exampleAr: string | null;
  exampleEn: string | null;
  /** The kind whose values these are filed under. `null` = no parent axis. */
  parentTypeKey: string | null;
  /**
   * Where a value of this kind goes when an operator UNFILES it, by key of the
   * `parentTypeKey` list. `null` = none declared, and an unfile then stores `null`.
   */
  fallbackParentKey: string | null;
  deletable: boolean;
  /** Shown on the Manage-values rail. Off for kinds with a screen of their own. */
  onValuesRail: boolean;
  /** A builtin the platform reads by name: relabel yes, rename or delete no. */
  systemOnly: boolean;
  active: boolean;
  sortOrder: number;
  /** The surrogate product that authored this list. `null` = a shared list nobody owns. */
  surrogateProductKey: string | null;
  /**
   * The question whose OPTIONS are this list, one-for-one by code. `null` = nothing mirrors
   * it. Set by the server when a question is created from the list; never sent by a client.
   */
  mirrorQuestionId: string | null;
}

export interface CreateEnumerationTypeRequest {
  key: string;
  labelAr: string;
  labelEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  icon?: string;
  exampleAr?: string;
  exampleEn?: string;
  parentTypeKey?: string | null;
  fallbackParentKey?: string | null;
  deletable?: boolean;
  onValuesRail?: boolean;
  /** Sent by the product screen only — the product authoring this list. */
  surrogateProductKey?: string;
  sortOrder?: number;
}

/** `key` is absent on purpose — every value carries the string, so a rename strands them. */
export type UpdateEnumerationTypeRequest = Partial<
  Omit<CreateEnumerationTypeRequest, 'key'> & { active: boolean }
>;

export interface CreateEnumerationRequest {
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  parentKey?: string;
  /**
   * `program_name` only — how the new name is meant to be sold, applied to every loan
   * category it starts under. Omitted means `['payslip']` server-side.
   */
  incomeBases?: IncomeBasis[];
  sortOrder?: number;
  /**
   * `program_name` only — the surrogate product the new name works its income out from.
   * REQUIRED by the server when `incomeBases` includes `no_payslip`.
   */
  surrogateProductKey?: string;
}

export interface UpdateEnumerationRequest {
  labelAr?: string;
  labelEn?: string;
  parentKey?: string;
  active?: boolean;
  deprecate?: boolean;
  sortOrder?: number;
  /**
   * Three values, all meaningful: absent leaves the link alone, `null` UNLINKS, a key
   * re-points. `''` is refused by the server — "not linked" has one spelling.
   */
  surrogateProductKey?: string | null;
}

/**
 * What `SetEnumerationParentKeysBulkDto` accepts in one request, mirrored so a caller can
 * refuse in words instead of eating a silent `VALIDATION_FAILED`.
 */
export const PARENT_KEYS_BULK_MAX = 500;

/** What `CreateEnumerationValuesBulkDto` accepts in one paste. Same reasoning. */
export const ENUMERATION_BULK_MAX = 500;

/** One pasted row on the wire. No `key` and no `sortOrder` — the server owns both. */
export interface BulkCreateEnumerationValueRow {
  labelEn: string;
  labelAr: string;
  /** Required when the list has a class axis; the server refuses a blank one per row. */
  parentKey?: string;
}

export interface BulkCreateEnumerationValuesRequest {
  type: string;
  rows: readonly BulkCreateEnumerationValueRow[];
  /** `skip` (default) leaves a key the list already holds alone; `fail` refuses the batch. */
  onDuplicate?: 'skip' | 'fail';
  /** Validate and report, write nothing. */
  dryRun?: boolean;
}

export interface EnumerationBulkCreateResult {
  type: string;
  created: number;
  skipped: number;
  createdKeys: string[];
  /** `index` is ZERO-BASED into the request rows. */
  skippedRows: Array<{ index: number; key: string }>;
  /** Whether the mirrored question moved and a new questionnaire version was published. */
  republished: boolean;
}

/** One row the server could not accept. `index` is ZERO-BASED — the screen adds one. */
export interface EnumerationBulkProblem {
  index: number;
  reason: string;
  key?: string;
  parentKey?: string;
  firstIndex?: number;
}

@Injectable({ providedIn: 'root' })
export class LookupsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/enumerations`;

  async listTypes(): Promise<EnumerationTypeSummary[]> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<EnumerationTypeSummary[]>>(`${this.base}/types`),
    );
    return res.data;
  }

  /**
   * Create a KIND of list.
   *
   * `POST /types`, a sibling of the value CRUD below rather than a resource of its own,
   * because it is the same registry seen one level up — and the server declares all four
   * KIND routes before its `:id` routes so `types` cannot resolve as an enumeration id.
   */
  async createType(body: CreateEnumerationTypeRequest): Promise<EnumerationTypeDefinition> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<EnumerationTypeDefinition>>(`${this.base}/types`, body),
    );
    return res.data;
  }

  async updateType(
    key: string,
    body: UpdateEnumerationTypeRequest,
  ): Promise<EnumerationTypeDefinition> {
    const res = await firstValueFrom(
      this.http.patch<SuccessEnvelope<EnumerationTypeDefinition>>(
        `${this.base}/types/${encodeURIComponent(key)}`,
        body,
      ),
    );
    return res.data;
  }

  async removeType(key: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<SuccessEnvelope<{ key: string }>>(
        `${this.base}/types/${encodeURIComponent(key)}`,
      ),
    );
  }

  async list(type?: string): Promise<EnumerationRow[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<EnumerationRow[]>>(this.base, { params }),
    );
    return res.data;
  }

  async create(body: CreateEnumerationRequest): Promise<EnumerationRow> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<EnumerationRow>>(this.base, body),
    );
    return res.data;
  }

  async update(id: string, body: UpdateEnumerationRequest): Promise<EnumerationRow> {
    const res = await firstValueFrom(
      this.http.patch<SuccessEnvelope<EnumerationRow>>(`${this.base}/${id}`, body),
    );
    return res.data;
  }

  /**
   * Hard-delete an entry — the row and its per-category assignments are gone,
   * not parked.
   *
   * Allowed only while nothing points at the key: the server counts every surface
   * that reads the value's type and refuses with `ENUMERATION_IN_USE` (409) if any
   * still names it, `ENUMERATION_DELETE_NOT_SUPPORTED` (422) for a type whose
   * readers it cannot count, and the toast interceptor renders both. Callers do NOT
   * need to pre-check — the counts on the row are a UX shortcut, the server is the
   * rule.
   */
  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<SuccessEnvelope<{ id: string }>>(`${this.base}/${id}`));
  }

  /**
   * Replace one name's loan-category set. The array IS the new set, not a
   * delta; an empty array parks the name (pickable nowhere).
   *
   * PUT, not PATCH, unlike `update()` above: this replaces a collection whole,
   * and "omitted = unchanged" would make an empty set unexpressible.
   */
  async setCategories(id: string, categories: LoanCategory[]): Promise<EnumerationRow> {
    const res = await firstValueFrom(
      this.http.put<SuccessEnvelope<EnumerationRow>>(`${this.base}/${id}/categories`, {
        categories,
      }),
    );
    return res.data;
  }

  /** Reassign many names in ONE transaction; returns the refreshed catalog. */
  async setCategoriesBulk(assignments: EnumerationCategoryAssignment[]): Promise<EnumerationRow[]> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<EnumerationRow[]>>(`${this.base}/categories`, {
        assignments,
      }),
    );
    return res.data;
  }

  /**
   * Re-file many values onto one parent list entry — or onto NOTHING — in ONE transaction.
   *
   * One request rather than a patch per row, and not for speed: a bulk mistake is N rows, and
   * half-applied it leaves some values reading one bank figure and some another. The server
   * resolves every id and validates the target BEFORE it writes anything, and audits one
   * event per value that actually moved. Returns how many moved, so a no-op tick can say so.
   *
   * `parentKey: null` UNFILES the value — the board's uncheck. It is a real target, not a
   * missing one: `''` and an absent field are both refused, because a stored empty string looks
   * filed to the engine's `parentKey IS NOT NULL` filter and then prices nothing anyway.
   */
  async setParentKeysBulk(
    assignments: readonly { id: string; parentKey: string | null }[],
  ): Promise<{ moved: number }> {
    // Checked HERE, before the request. `SetEnumerationParentKeysBulkDto` caps the array at
    // `PARENT_KEYS_BULK_MAX`, and the refusal comes back as `VALIDATION_FAILED` — which is in
    // `SILENT_CODES`, so the toast interceptor swallows it. On the class board that meant
    // hundreds of cards flipping and flipping back with nothing on screen to explain it.
    // A caller that can hit the cap must state the reason itself; see `moveAllListed`.
    if (assignments.length === 0 || assignments.length > PARENT_KEYS_BULK_MAX) {
      throw new RangeError(
        `setParentKeysBulk: ${assignments.length} assignment(s); the server accepts 1..${PARENT_KEYS_BULK_MAX}`,
      );
    }
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<{ moved: number }>>(`${this.base}/parent-keys`, {
        assignments,
      }),
    );
    return res.data;
  }

  /**
   * Create many values of ONE list in ONE transaction — what a pasted sheet saves.
   *
   * ALL-OR-NOTHING. On refusal the server answers `ENUMERATION_BULK_INVALID` with every bad
   * row named by `meta.problems[].index`, ZERO-BASED into `rows` — the screen adds one to
   * name a line. A duplicate is NOT a problem: re-pasting the same sheet is the expected
   * second use, and those come back in the success body as `skipped`.
   *
   * Capped here as well as on the server, for the reason `setParentKeysBulk` documents: the
   * DTO's refusal is `VALIDATION_FAILED`, which the toast interceptor swallows.
   */
  async createValuesBulk(
    body: BulkCreateEnumerationValuesRequest,
  ): Promise<EnumerationBulkCreateResult> {
    if (body.rows.length === 0 || body.rows.length > ENUMERATION_BULK_MAX) {
      throw new RangeError(
        `createValuesBulk: ${body.rows.length} row(s); the server accepts 1..${ENUMERATION_BULK_MAX}`,
      );
    }
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<EnumerationBulkCreateResult>>(`${this.base}/values`, body),
    );
    return res.data;
  }

  /**
   * Replace ONE (name, loan category) pair's income basis — how the catalog says the
   * name is meant to be sold there. The array IS the new set and may never be empty:
   * a pair the catalog describes in no way at all is a pair no screen could render.
   *
   * Scoped to the category, like `setQuestions`: a name is legitimately meant for
   * no-payslip lending as a personal loan and payslip-only as a car loan.
   */
  /**
   * Point one income FACT at the question that answers it, or unbind it.
   *
   * `questionCode: null` UNBINDS, which is why the parameter is nullable rather than
   * optional: a full replacement of the binding must distinguish "clear it" from "leave it".
   *
   * The endpoint has existed since v16.2.0; what was missing was any client for it. v16.3.0
   * deleted the fact rail and its picker from the admin and recorded the consequence —
   * "adding a NEW income fact or re-pointing a broken one is no longer an admin action" —
   * which a step builder that cannot name a new input cannot live with.
   */
  async setBoundQuestion(id: string, questionCode: string | null): Promise<EnumerationRow> {
    const res = await firstValueFrom(
      this.http.put<SuccessEnvelope<EnumerationRow>>(`${this.base}/${id}/bound-question`, {
        questionCode,
      }),
    );
    return res.data;
  }

  async setIncomeBasis(
    id: string,
    category: LoanCategory,
    bases: IncomeBasis[],
  ): Promise<EnumerationRow> {
    const res = await firstValueFrom(
      this.http.put<SuccessEnvelope<EnumerationRow>>(`${this.base}/${id}/income-basis`, {
        category,
        bases,
      }),
    );
    return res.data;
  }

  /** The active question pool the catalog's question-template board picks from. */
  async catalogQuestions(): Promise<CatalogQuestion[]> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<CatalogQuestion[]>>(`${this.base}/questions`),
    );
    return res.data;
  }

  /**
   * Replace one name's SUGGESTED question set FOR ONE loan category. The array IS
   * the new set, not a delta; empty clears that category's template and leaves
   * the other three alone. Advisory only — it pre-ticks the scoring wizard and
   * can never invalidate a weight set a bank already saved.
   *
   * No bulk sibling: every action on the detail screen produces a new set for ONE
   * name under ONE category.
   */
  async setQuestions(
    id: string,
    category: LoanCategory,
    questionCodes: string[],
  ): Promise<EnumerationRow> {
    const res = await firstValueFrom(
      this.http.put<SuccessEnvelope<EnumerationRow>>(`${this.base}/${id}/questions`, {
        category,
        questionCodes,
      }),
    );
    return res.data;
  }
}
