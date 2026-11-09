/**
 * "Try it" — run sample answers through a no-payslip product's own calculation (v33.0.0).
 *
 * The server's `POST …/check` runs the engine's own `evaluateProductRule` on the product's
 * rule and figures, narrowed to one way when the product offers several — so the figure here
 * is what a bank program taking the product's figures would compute BEFORE its own debt-burden
 * cap, maximum and rate. Nothing is saved. It is the step an operator takes before switching a
 * new product on: a product that answers "no matching row" for every sample is not ready.
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  CheckCircleOutline,
  ExclamationCircleOutline,
  PlayCircleOutline,
} from '@ant-design/icons-angular/icons';
import { SkeletonRowsComponent } from '@shared/ui';
import {
  MoneyInputDirective,
  formatGroupedNumber,
} from '../../core/directives/money-input.directive';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';
import type {
  SurrogateProductCheckAnswer,
  SurrogateProductCheckInputs,
  SurrogateProductCheckResult,
} from '../bank-programs/bank-programs.types';

@Component({
  selector: 'app-product-test-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    SkeletonRowsComponent,
    MoneyInputDirective,
  ],
  providers: [
    provideNzIconsPatch([CheckCircleOutline, ExclamationCircleOutline, PlayCircleOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="test" [attr.aria-label]="heading">
      <h2 class="sub" i18n="@@ptest.title">Try it with sample answers</h2>
      <p class="lede" i18n="@@ptest.lede">
        Answer as an applicant would and see what this product works out — before any bank's own
        debt-burden cap, maximum loan or rate. Nothing is saved.
      </p>

      @if (state() === 'loading') {
        <app-skeleton-rows [rows]="3" [cols]="[2, 2]" [ariaLabel]="heading" />
      } @else if (state() === 'error') {
        <p class="empty" i18n="@@ptest.load_failed">
          The sample form could not be loaded. Reload the page.
        </p>
      } @else if (inputs()) {
        @let data = inputs()!;
        @if (data.inputs.length === 0) {
          <p class="empty" i18n="@@ptest.nothing">
            This product has no calculation yet, so there is nothing to try. Build its calculation
            first.
          </p>
        } @else {
          <form class="grid" [formGroup]="form" (ngSubmit)="run()">
            @if (data.ways.length > 1) {
              <nz-form-item>
                <nz-form-label nzFor="ptest-way" i18n="@@ptest.way">Way a bank uses</nz-form-label>
                <nz-form-control>
                  <nz-select nzId="ptest-way" [formControl]="wayCtrl">
                    @for (w of data.ways; track w; let i = $index) {
                      <nz-option [nzValue]="w" [nzLabel]="wayLabel(i)" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            }
            @for (field of data.inputs; track field.factKey) {
              <nz-form-item>
                <nz-form-label [nzFor]="'ptest-' + field.factKey">{{
                  isAr ? field.labelAr : field.labelEn
                }}</nz-form-label>
                <nz-form-control>
                  @if (field.type === 'number') {
                    <input
                      nz-input
                      appMoneyInput
                      inputmode="decimal"
                      [id]="'ptest-' + field.factKey"
                      [formControlName]="field.factKey"
                    />
                  } @else {
                    <nz-select
                      [nzId]="'ptest-' + field.factKey"
                      [formControlName]="field.factKey"
                      nzAllowClear
                      nzShowSearch
                      [nzPlaceHolder]="notAnswered"
                    >
                      @for (o of field.options; track o.code) {
                        <nz-option [nzValue]="o.code" [nzLabel]="isAr ? o.labelAr : o.labelEn" />
                      }
                    </nz-select>
                  }
                </nz-form-control>
              </nz-form-item>
            }
            <div class="actions">
              <button nz-button nzType="primary" type="submit" [nzLoading]="running()">
                <span nz-icon nzType="play-circle" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@ptest.run">Work it out</span>
              </button>
            </div>
          </form>

          <div class="result" aria-live="polite">
            @if (result(); as r) {
              @if (r.ok) {
                <p class="ok">
                  <span nz-icon nzType="check-circle" nzTheme="outline" aria-hidden="true"></span>
                  <span class="ok-label">{{
                    r.kind === 'maxAmount' ? ceilingLabel : incomeLabel
                  }}</span>
                  <strong class="figure"
                    ><bdi>{{ money(r.valueEGP) }}</bdi></strong
                  >
                </p>
              } @else {
                <p class="miss">
                  <span
                    nz-icon
                    nzType="exclamation-circle"
                    nzTheme="outline"
                    aria-hidden="true"
                  ></span>
                  <span>{{ missLabel(r) }}</span>
                </p>
              }
            }
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .test {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .sub {
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .lede,
      .empty {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        max-inline-size: 70ch;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
        gap: 0 var(--space-4);
        align-items: end;
      }
      .actions {
        grid-column: 1 / -1;
        margin-block-start: var(--space-2);
      }
      .result p {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
      }
      .ok {
        background: var(--color-success-bg);
        color: var(--text-primary);
      }
      .ok [nz-icon] {
        color: var(--color-success);
      }
      .ok-label {
        color: var(--text-secondary);
      }
      .figure {
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
      }
      .miss {
        background: var(--color-warning-bg);
        color: var(--text-primary);
      }
      .miss [nz-icon] {
        color: var(--warning);
      }
    `,
  ],
})
export class ProductTestPanelComponent {
  readonly productKey = input.required<string>();

  private readonly api = inject(BankProgramsApiService);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly inputs = signal<SurrogateProductCheckInputs | null>(null);
  protected readonly result = signal<SurrogateProductCheckResult | null>(null);
  protected readonly running = signal(false);

  protected form = new FormGroup<Record<string, FormControl<string | null>>>({});
  protected readonly wayCtrl = new FormControl<string | null>(null);

  protected readonly heading = $localize`:@@ptest.title:Try it with sample answers`;
  protected readonly notAnswered = $localize`:@@ptest.not_answered:Not answered`;
  protected readonly incomeLabel = $localize`:@@ptest.income:Monthly income it counts`;
  protected readonly ceilingLabel = $localize`:@@ptest.ceiling:Most it would lend`;

  private readonly labelByFact = computed(() => {
    const data = this.inputs();
    return new Map((data?.inputs ?? []).map((i) => [i.factKey, this.isAr ? i.labelAr : i.labelEn]));
  });

  constructor() {
    effect(() => {
      const key = this.productKey();
      untracked(() => void this.load(key));
    });
  }

  private async load(key: string): Promise<void> {
    this.state.set('loading');
    this.result.set(null);
    try {
      const { data } = await this.api.getSurrogateProductCheckInputs(key);
      const controls: Record<string, FormControl<string | null>> = {};
      for (const field of data.inputs)
        controls[field.factKey] = new FormControl<string | null>(null);
      this.form = new FormGroup(controls);
      this.wayCtrl.setValue(data.ways[0] ?? null);
      this.inputs.set(data);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected wayLabel(index: number): string {
    return index === 0
      ? $localize`:@@ptest.way_main:Main way`
      : $localize`:@@ptest.way_n:Way ${index + 1}:N:`;
  }

  protected money(value: string): string {
    return $localize`:@@ptest.egp:${formatGroupedNumber(value)}:AMOUNT: EGP`;
  }

  protected missLabel(r: Extract<SurrogateProductCheckResult, { ok: false }>): string {
    const fact = r.factKey ? (this.labelByFact().get(r.factKey) ?? r.factKey) : '';
    switch (r.reason) {
      case 'fact_not_answered':
        return $localize`:@@ptest.miss_unanswered:Answer “${fact}:FACT:” — the calculation reads it.`;
      case 'no_matching_row':
      case 'no_matching_band':
        return $localize`:@@ptest.miss_no_row:No figure is set for this answer, so nothing is worked out. Pick another answer, or fill in the figure.`;
      case 'gate_failed':
        return $localize`:@@ptest.miss_gate:A condition of this product is not met by these answers.`;
      case 'rule_unconfigured':
        return $localize`:@@ptest.miss_unconfigured:This product's calculation is not finished, or this way has no figures yet.`;
      default:
        return $localize`:@@ptest.miss_other:Nothing could be worked out from these answers (${r.reason}:REASON:).`;
    }
  }

  protected async run(): Promise<void> {
    const data = this.inputs();
    if (!data || this.running()) return;
    const answers = data.inputs.flatMap((field): SurrogateProductCheckAnswer[] => {
      const raw = this.form.controls[field.factKey]?.value;
      if (raw === null || raw === undefined || raw === '') return [];
      return field.type === 'number'
        ? [{ factKey: field.factKey, value: raw }]
        : [{ factKey: field.factKey, optionCode: raw }];
    });
    this.running.set(true);
    try {
      const way = this.wayCtrl.value;
      const { data: result } = await this.api.checkSurrogateProduct(this.productKey(), {
        ...(data.ways.length > 1 && way ? { wayId: way } : {}),
        answers,
      });
      this.result.set(result);
    } catch {
      this.result.set(null);
    } finally {
      this.running.set(false);
    }
  }
}
