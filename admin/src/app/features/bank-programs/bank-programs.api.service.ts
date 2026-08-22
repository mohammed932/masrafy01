import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  BankProgramCreatePayload,
  BankProgramListRow,
  BankProgramResponse,
  BankProgramUpdatePayload,
  DuplicateBankProgramPayload,
  IncomeAssumptionConfig,
  IncomeRuleCheckPayload,
  IncomeRuleDraftCheckPayload,
  IncomeRuleCheckResult,
  ListBankProgramsQuery,
  ProgramNameIncomeRule,
  ValueSourceMap,
} from './bank-programs.types';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface PaginatedEnvelope<T> {
  success: true;
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
}

/**
 * Admin HttpClient adapter for /api/admin/bank-programs/* endpoints.
 * Auth + correlation + error + toast handled by global interceptors from feature 001.
 */
@Injectable({ providedIn: 'root' })
export class BankProgramsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/bank-programs`;

  async list(query: ListBankProgramsQuery): Promise<PaginatedEnvelope<BankProgramListRow>> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') {
        continue;
      }
      params = params.set(k, String(v));
    }
    return firstValueFrom(
      this.http.get<PaginatedEnvelope<BankProgramListRow>>(this.base, { params }),
    );
  }

  async getByCode(programCode: string): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<BankProgramResponse>>(
        `${this.base}/${encodeURIComponent(programCode)}`,
      ),
    );
  }

  async create(payload: BankProgramCreatePayload): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(this.http.post<SuccessEnvelope<BankProgramResponse>>(this.base, payload));
  }

  async update(
    programCode: string,
    payload: BankProgramUpdatePayload,
  ): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<BankProgramResponse>>(
        `${this.base}/${encodeURIComponent(programCode)}`,
        payload,
      ),
    );
  }

  async toggle(
    programCode: string,
    body: { active: boolean; version: number },
  ): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<BankProgramResponse>>(
        `${this.base}/${encodeURIComponent(programCode)}/toggle`,
        body,
      ),
    );
  }

  /** FR-013 — copy a program into a new INACTIVE draft carrying every value. */
  async duplicate(
    programCode: string,
    payload: DuplicateBankProgramPayload,
  ): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<BankProgramResponse>>(
        `${this.base}/${encodeURIComponent(programCode)}/duplicate`,
        payload,
      ),
    );
  }

  async delete(programCode: string, confirmHeader: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.base}/${encodeURIComponent(programCode)}`, {
        headers: { 'X-Confirm-Program-Code': confirmHeader },
      }),
    );
  }

  /**
   * Feature 011 / FR-026 … FR-031 — run a sample applicant against the ON-SCREEN
   * income rule.
   *
   * The draft rule travels in the BODY, not just the program code: the panel
   * evaluates what the admin is looking at, including unsaved edits (FR-028).
   * Persists nothing server-side — no application, no lead, no offer (FR-029).
   */
  async checkIncomeRule(
    programCode: string,
    payload: IncomeRuleCheckPayload,
  ): Promise<SuccessEnvelope<IncomeRuleCheckResult>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<IncomeRuleCheckResult>>(
        `${this.base}/${encodeURIComponent(programCode)}/income-rule/check`,
        payload,
      ),
    );
  }

  /**
   * The same check, for a program that does not exist yet.
   *
   * The saved-program route reads the rate, term, limits and fees off the stored row. During
   * CREATE there is no row, so the draft carries them — which it can, because pricing is
   * step 4 and this panel is on step 5. Same server-side snapshot mapper and same
   * `quoteProgram` after that, so the two routes cannot report different figures.
   */
  async checkIncomeRuleDraft(
    payload: IncomeRuleDraftCheckPayload,
  ): Promise<SuccessEnvelope<IncomeRuleCheckResult>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<IncomeRuleCheckResult>>(
        `${this.base}/income-rule/check`,
        payload,
      ),
    );
  }

  /**
   * The catalog program name's income rule — what the name reads the income from, and
   * the figures every bank filed under it starts from.
   *
   * On the bank-programs API rather than `admin/enumerations`, even though the row it
   * writes is an enumeration: everything that decides whether a rule is acceptable
   * already lives in that backend module. Addressed by catalog KEY, which is what the
   * catalog URL carries.
   */
  async getProgramNameIncomeRule(
    programNameKey: string,
  ): Promise<SuccessEnvelope<ProgramNameIncomeRule>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<ProgramNameIncomeRule>>(
        `${this.base}/program-names/${encodeURIComponent(programNameKey)}/income-rule`,
      ),
    );
  }

  /**
   * Set — or clear, with `incomeRule: null` — what a catalog name reads its income from.
   *
   * `valueSources` travels in the SAME call, because the markers describe those figures:
   * saving a new table and the old markers separately would leave a marker addressing a
   * row that no longer exists.
   */
  async setProgramNameIncomeRule(
    programNameKey: string,
    payload: { incomeRule: IncomeAssumptionConfig | null; valueSources?: ValueSourceMap },
  ): Promise<SuccessEnvelope<ProgramNameIncomeRule>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<ProgramNameIncomeRule>>(
        `${this.base}/program-names/${encodeURIComponent(programNameKey)}/income-rule`,
        payload,
      ),
    );
  }
}
