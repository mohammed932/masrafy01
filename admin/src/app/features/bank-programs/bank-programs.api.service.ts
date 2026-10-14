import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { LoanCategory } from '@core/loan-category';
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
  AskWriteResult,
  NeededWriteResult,
  ProductAsksBoard,
  SurrogateProductDetail,
  SurrogateProductSummary,
  LoanAmountDefaults,
  RateDefaults,
  TenorDefaults,
  IScoreTiers,
  PlanDefaults,
  SurrogateProductTemplateResponse,
  ProductBlueprint,
  ValueSourceMap,
} from './bank-programs.types';
import type { MaxLoanByFactRow } from '@shared/ui/max-loan-by-fact.rules';

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
   * Switch a surrogate product on or off — the operator's ONE lifecycle action on a product.
   *
   * There is no create and no delete on this service any more. The eleven predefined products
   * are put in by `npm run seed:blueprints`; what an operator decides is which of them this
   * platform sells.
   *
   * OFF stops the product being used ANYWHERE, including by catalog names already linked to
   * it: every bank program under those names comes back listed with
   * `SURROGATE_PRODUCT_RETIRED` instead of figures. It takes effect on the next quote, and
   * issued offers keep their own frozen figures. Nothing is deleted, and it is reversible.
   *
   * Keyed by `key`, like every other product route — the registry id is on no product DTO.
   */
  async setSurrogateProductActive(
    key: string,
    active: boolean,
  ): Promise<SuccessEnvelope<{ key: string; active: boolean; factsChanged: string[] }>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<{ key: string; active: boolean; factsChanged: string[] }>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/active`,
        { active },
      ),
    );
  }

  /**
   * WHAT THIS PRODUCT ASKS — the board step ① renders, in one response.
   *
   * Its ask set, the whole active question pool, and per ask both who else reads it and
   * whether it can be removed here. ONE read, and not to save round trips: the three
   * existing reads cannot be composed. The question pool sits behind a stricter role, the
   * fact registry reaches this bundle through a per-session cache a tick cannot invalidate,
   * and "which other products read this fact" is answerable only from the ask table.
   */
  async getProductAsks(key: string): Promise<SuccessEnvelope<ProductAsksBoard>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<ProductAsksBoard>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/asks`,
      ),
    );
  }

  /**
   * Tick a pool question: this product starts reading its answer.
   *
   * Addressed by the QUESTION, because that is what the operator picked and the fact may not
   * exist yet. `askIn` is ADDITIVE — it says which loan types should start asking the
   * question and never narrows the set, which is shared with every other product reading it.
   *
   * Returns the whole recomputed board, so the screen absorbs one object per click instead
   * of re-reading three things that can disagree about what the click did.
   */
  async attachProductAsk(
    key: string,
    questionCode: string,
    askIn: readonly LoanCategory[],
  ): Promise<SuccessEnvelope<AskWriteResult>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<AskWriteResult>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/asks/` +
          encodeURIComponent(questionCode),
        { askIn: [...askIn] },
      ),
    );
  }

  /**
   * Cover a fact the engine needs for this product — tick its question, or create one when
   * it has none — or, with `factKey` null, every one that can be covered ("Fix all").
   * Returns the recomputed board, like the tick above.
   */
  async askNeeded(
    key: string,
    factKey: string | null,
  ): Promise<SuccessEnvelope<NeededWriteResult>> {
    const base = `${this.base}/surrogate-products/${encodeURIComponent(key)}/needed`;
    return firstValueFrom(
      this.http.put<SuccessEnvelope<NeededWriteResult>>(
        factKey === null ? base : `${base}/${encodeURIComponent(factKey)}`,
        {},
      ),
    );
  }

  /**
   * Untick: this product stops reading the answer.
   *
   * Addressed by the FACT, because that is what exists and what the screen renders. The
   * question stays in the pool and the loan types that ask it are untouched.
   */
  async detachProductAsk(key: string, factKey: string): Promise<SuccessEnvelope<AskWriteResult>> {
    return firstValueFrom(
      this.http.delete<SuccessEnvelope<AskWriteResult>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/asks/` +
          encodeURIComponent(factKey),
      ),
    );
  }

  /**
   * The predefined products and what each one asks.
   *
   * Read by the CALCULATION screen, for the brackets a published sheet prints
   * (`suggestedBands`) and the sentence that states the product's mechanism. It was also the
   * library's list of things to create; nothing creates a product from the admin now, so what
   * is left is the half the form uses.
   *
   * Structure and existence only — every word an operator reads is this bundle's, keyed by
   * the blueprint key.
   */
  async listProductBlueprints(): Promise<SuccessEnvelope<ProductBlueprint[]>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<ProductBlueprint[]>>(`${this.base}/product-blueprints`),
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
   * The amounts every new bank program starts this product's maximum-loan grid from.
   *
   * AMOUNTS ONLY — the grid itself comes from the blueprint and is resolved on every read, so
   * the shape and the figures in it cannot disagree. An empty `rows` clears them.
   */
  async setSurrogateProductCapDefaults(
    key: string,
    payload: { rows: MaxLoanByFactRow[] },
  ): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/cap-defaults`,
        payload,
      ),
    );
  }

  /**
   * The loan duration every bank program under this product falls back to.
   *
   * INHERITED, not copied: a change here moves every program that states no months of its
   * own. `tenor: null` clears it, and that is the one call the server can refuse — clearing
   * leaves an inheriting program with no term at all (`SURROGATE_PRODUCT_TENOR_IN_USE`).
   */
  async setSurrogateProductTenorDefaults(
    key: string,
    payload: { tenor: TenorDefaults | null },
  ): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/tenor-defaults`,
        payload,
      ),
    );
  }

  /**
   * The I-SCORE TIERS every bank program under this product falls back to.
   *
   * INHERITED, not copied, like the duration above: a change here moves every program that
   * states no tiers of its own, and a bank that scores differently states its own and wins —
   * including a flat 100% table, which is how it opts out.
   *
   * `tiers: null` clears them and is NEVER refused, unlike the duration's clear: cleared
   * tiers leave a program multiplying by 100%, which is a priceable quote. It still moves
   * live figures, which is why the card that calls this says how many programs are reading
   * them before the operator saves.
   */
  async setSurrogateProductIScoreDefaults(
    key: string,
    payload: { tiers: IScoreTiers | null },
  ): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/iscore-defaults`,
        payload,
      ),
    );
  }

  /**
   * The loan SIZE every bank program under this product falls back to.
   *
   * The sibling of the duration above in every respect: inherited rather than copied, a
   * change moves every program that states no amounts of its own, and `loanAmounts: null`
   * is the one call the server can refuse — clearing leaves an inheriting program with no
   * size at all (`SURROGATE_PRODUCT_LOAN_AMOUNTS_IN_USE`).
   */
  async setSurrogateProductLoanAmountDefaults(
    key: string,
    payload: { loanAmounts: LoanAmountDefaults | null },
  ): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/loan-amount-defaults`,
        payload,
      ),
    );
  }

  /**
   * The INTEREST RATE every bank program under this product falls back to — the rate, the
   * basis it is charged on and the variable-rate disclosure, as ONE statement.
   *
   * The sibling of the duration and the size above in every respect: inherited rather than
   * copied, a change re-prices every program that states none of its own, and `rate: null`
   * is the one call the server can refuse — clearing leaves an inheriting program with no
   * price at all (`SURROGATE_PRODUCT_RATE_IN_USE`).
   *
   * It is also the only screen a price is typed on: the bank-program wizard's rate card was
   * deleted, so a program under this product is quoted from here unless a seed or the API
   * gave it one of its own.
   */
  async setSurrogateProductRateDefaults(
    key: string,
    payload: { rate: RateDefaults | null },
  ): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/rate-defaults`,
        payload,
      ),
    );
  }

  /**
   * The PLAN tables every bank program that opted in falls back to — the rate, the two ends
   * of the term, the financed share and the floor, each keyed by the deposit the applicant
   * puts down.
   *
   * INHERITED, but only by a program whose `plansSource` is `product`: a blank grid on a
   * program already means "this bank does not price by that", so absence is never read as
   * consent. `plans: null` clears them, and unlike the duration above that is NOT refused —
   * a cleared table leaves each program on its own rate, floor and share, all of which still
   * exist, so nothing stops quoting.
   */
  async setSurrogateProductPlanDefaults(
    key: string,
    payload: { plans: PlanDefaults | null },
  ): Promise<SuccessEnvelope<SurrogateProductDetail>> {
    return firstValueFrom(
      this.http.put<SuccessEnvelope<SurrogateProductDetail>>(
        `${this.base}/surrogate-products/${encodeURIComponent(key)}/plan-defaults`,
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
