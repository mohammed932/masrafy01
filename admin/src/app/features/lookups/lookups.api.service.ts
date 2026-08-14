import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';
import type { LoanCategory } from '@core/loan-category';

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
  };
  /**
   * `program_name` rows only — which loan categories may offer this name.
   * Absent means the type has no such axis; a present `[]` means PARKED
   * (offerable nowhere). Optional so the bundle still runs against a backend
   * that has not deployed the assignment endpoints yet.
   */
  categories?: LoanCategory[];
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
}

export interface CreateEnumerationRequest {
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  parentKey?: string;
  sortOrder?: number;
}

export interface UpdateEnumerationRequest {
  labelAr?: string;
  labelEn?: string;
  parentKey?: string;
  active?: boolean;
  deprecate?: boolean;
  sortOrder?: number;
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
  async setCategoriesBulk(
    assignments: EnumerationCategoryAssignment[],
  ): Promise<EnumerationRow[]> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<EnumerationRow[]>>(`${this.base}/categories`, {
        assignments,
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
