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
  ProductTemplate,
  ProgramNameIncomeRule,
  SurrogateProductDetail,
  SurrogateProductSummary,
  SurrogateProductTemplateResponse,
  TemplateStarter,
  ProductBlueprint,
  CreateFromBlueprintResult,
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
   * The surrogate-product library — the pre-defined no-payslip calculations a catalog name
   * can be linked to.
   *
   * Inactive products are included and flagged, not filtered: a name already linked to a
   * retired one must still render as linked to something. Callers offering a CHOICE filter
   * to `active` at the point of choice.
   */
  async listSurrogateProducts(): Promise<SuccessEnvelope<SurrogateProductSummary[]>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<SurrogateProductSummary[]>>(`${this.base}/surrogate-products`),
    );
  }

  /** One product: its calculation, and every bank program reachable through it. */
  async getSurrogateProduct(key: string): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}`,
      ),
    );
  }

  /**
   * Set a product's calculation. Reaches every catalog name linked to it, and every bank
   * program under those names that takes catalog amounts.
   *
   * `valueSources` travels in the SAME call, for the reason the name's setter states: the
   * markers describe those figures, and saving them separately leaves a marker addressing a
   * row that no longer exists.
   */
  /**
   * Delete a surrogate product.
   *
   * `cascade` is a deliberate SECOND call. Without it the server refuses with
   * `SURROGATE_PRODUCT_IN_USE` carrying the exact `names` and `programCodes` that would be
   * destroyed, so the screen confirms against a list rather than against a count. A product
   * nothing points at deletes on the first call.
   */
  async deleteSurrogateProduct(key: string, opts: { cascade?: boolean } = {}): Promise<void> {
    const suffix = opts.cascade ? '?cascade=true' : '';
    await firstValueFrom(
      this.http.delete<SuccessEnvelope<unknown>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}${suffix}`,
      ),
    );
  }

  /**
   * The starter shapes. SHAPES ONLY — no labels and no figures come back; this bundle
   * supplies the words, in both locales.
   */
  async listSurrogateProductTemplates(): Promise<SuccessEnvelope<TemplateStarter[]>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<TemplateStarter[]>>(`${this.base}/surrogate-product-templates`),
    );
  }

  /**
   * The predefined products, with what each one still has to CREATE.
   *
   * Structure and existence only — the product names that come back are the DEFAULT for the
   * name box, and every other word an operator reads is this bundle's, keyed by the blueprint
   * key, exactly as the starter shapes' words already are.
   */
  async listProductBlueprints(): Promise<SuccessEnvelope<ProductBlueprint[]>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<ProductBlueprint[]>>(`${this.base}/product-blueprints`),
    );
  }

  /**
   * Build one: its lists, its values, its questions, its facts, its calculation, in one call.
   *
   * Idempotent by key on the server, so a retry after a refusal writes what is missing rather
   * than a second copy of everything. A cap-only product takes no name — it creates the
   * question and the list and no product — and answers with the fact key its cap is keyed by.
   */
  async createFromBlueprint(payload: {
    blueprintKey: string;
    key?: string;
    labelEn?: string;
    labelAr?: string;
  }): Promise<SuccessEnvelope<CreateFromBlueprintResult>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<CreateFromBlueprintResult>>(
        `${this.base}/surrogate-products/from-blueprint`,
        payload,
      ),
    );
  }

  /**
   * The friendly form behind a product, and what it compiles to.
   *
   * Returns `advanced: true` rather than failing when the calculation was authored by hand:
   * the screen has to SAY that, and an error on the read would leave it with nothing to say
   * it about.
   */
  async getSurrogateProductTemplate(
    key: string,
  ): Promise<SuccessEnvelope<SurrogateProductTemplateResponse>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<SurrogateProductTemplateResponse>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/template`,
      ),
    );
  }

  /**
   * Save the form. The server compiles it, validates the result exactly as it validates a
   * hand-authored rule, and refuses if recompiling would orphan figures a bank has typed.
   */
  async setSurrogateProductTemplate(
    key: string,
    payload: {
      template: ProductTemplate;
      /**
       * The catalog's default figures, sent WITH the shape. Recompiling replaces the step
       * list, so a separate figures call would be writing against a shape that no longer
       * exists.
       */
      stepParams?: Record<string, unknown>;
      valueSources?: ValueSourceMap;
    },
  ): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/template`,
        payload,
      ),
    );
  }

  async setSurrogateProductIncomeRule(
    key: string,
    payload: { incomeRule: IncomeAssumptionConfig | null; valueSources?: ValueSourceMap },
  ): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/income-rule`,
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
