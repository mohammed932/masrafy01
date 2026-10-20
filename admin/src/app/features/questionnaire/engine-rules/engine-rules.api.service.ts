import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';
import { SKIP_TOAST_INTERCEPTOR } from '@core/interceptors/toast.interceptor';
import type { EngineRulesView } from './engine-rules.types';

/**
 * The "Loan engine rules" tab's two calls. The read is its own endpoint; the one write is the
 * questionnaire's own option PATCH — the engine contract judges it there, for every screen
 * alike, so this tab gets no route of its own to be lenient on.
 */
@Injectable({ providedIn: 'root' })
export class EngineRulesApiService {
  private readonly http = inject(HttpClient);

  async rules(): Promise<EngineRulesView> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<EngineRulesView>>(
        `${environment.apiBaseUrl}/questionnaire/engine-rules`,
      ),
    );
    return res.data;
  }

  /**
   * Answer WORDING only — the sheet never sends an order, a switch or a code. No toast: the
   * sheet reads every refusal out beside the fields (`SKIP_TOAST_INTERCEPTOR`'s one exception).
   */
  async saveAnswerWording(
    optionId: string,
    labels: { labelAr: string; labelEn: string },
  ): Promise<void> {
    await firstValueFrom(
      this.http.patch<SuccessEnvelope<unknown>>(
        `${environment.apiBaseUrl}/questionnaire/options/${optionId}`,
        labels,
        { context: new HttpContext().set(SKIP_TOAST_INTERCEPTOR, true) },
      ),
    );
  }
}
