import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { SkeletonRowsComponent, StatusPillComponent } from '@shared/ui';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';
import type { BankProgramResponse } from '../bank-programs/bank-programs.types';
import type { SimulationMatch } from './questionnaire.api.service';
import { approvalTierLabel, bindingConstraintLabel } from './simulation-labels';

/** What the simulator hands the drawer when a result card is pressed. */
export interface SimulatedOfferDrawerData {
  match: SimulationMatch;
}

/** Thousands grouping done on the STRING — a Decimal must never round-trip a float (Principle I). */
function money(value: string): string {
  const [whole = '0', frac] = value.split('.');
  const negative = whole.startsWith('-');
  const digits = (negative ? whole.slice(1) : whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${digits}${frac ? `.${frac}` : ''}`;
}

/** `12.5000` → `12.5`, `12.0000` → `12`. Trailing-zero trim, no arithmetic. */
function percent(value: string): string {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' || trimmed === '-' ? '0' : trimmed;
}

/**
 * One simulated program, in full — the drill-down behind a result card.
 *
 * Two blocks, both from a live source, none of it invented:
 *  1. Estimate — the quote the engine produced for this sample applicant, or the
 *     localized reason it could not be quoted (a program stays listed either
 *     way: figures shape the amount, never the listing — A33).
 *  2. Program terms — fetched from `GET /admin/bank-programs/:code` on open, so
 *     the rate / tenor / limits / fees shown are the registry's current values.
 *
 * The per-answer score breakdown lived here and was cut deliberately: the score
 * itself is on the card and in the hero, and the weights editor is where the
 * numbers behind it are actually inspected and changed. `approvalFactors` is
 * still on the response for whoever needs it next.
 *
 * Rendered inside an NzDrawer (portaled to body → full-viewport scrim, A34).
 */
@Component({
  selector: 'app-simulated-offer-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, SkeletonRowsComponent, StatusPillComponent],
  template: `
    <div class="wrap">
      <!-- ── Identity + score ─────────────────────────────────── -->
      <header class="hero">
        <div class="hero-id">
          <h3 class="prog">{{ match.programFriendlyName }}</h3>
          <code class="code">{{ match.programCode }}</code>
        </div>
        <div
          class="score"
          [attr.data-tier]="match.usedDefaultWeights ? 'unrated' : match.approvalTier"
        >
          <span class="score-num">{{ scorePct() }}<span class="score-sign">%</span></span>
          <span class="score-tier">{{ tierLabel() }}</span>
        </div>
      </header>

      <div class="pills">
        @if (match.bankIsFeatured) {
          <app-status-pill tone="info" [label]="featuredLabel" />
        }
        @if (match.isShariaCompliant) {
          <app-status-pill tone="success" [label]="shariaLabel" />
        }
        @if (match.usedDefaultWeights) {
          <app-status-pill tone="warning" [label]="unratedLabel" />
        }
      </div>

      <!-- ── 1. The estimate ──────────────────────────────────── -->
      <section class="block">
        <h4 class="block-h" i18n="@@sim.detail.estimate">Estimate for this applicant</h4>
        @if (match.figures; as f) {
          <dl class="rows">
            <div>
              <dt i18n="@@sim.detail.installment">Monthly installment</dt>
              <dd class="numeric strong">{{ money(f.monthlyInstallmentEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.rate">Effective rate</dt>
              <dd class="numeric">{{ pct(f.effectiveRatePercent) }}%</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.tenor">Term</dt>
              <dd class="numeric">
                <ng-container i18n="@@sim.detail.months"
                  >{{ f.effectiveTenorMonths }} months</ng-container
                >
              </dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.offered">Booked principal</dt>
              <dd class="numeric">{{ money(f.offeredAmountEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.cash">Cash to customer</dt>
              <dd class="numeric">{{ money(f.cashToCustomerEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.fees">Fees (financed)</dt>
              <dd class="numeric">{{ money(f.totalFeesEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.total_payable">Total payable</dt>
              <dd class="numeric">{{ money(f.totalPayableEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.cost_of_credit">Cost of credit</dt>
              <dd class="numeric">{{ money(f.totalCostOfCreditEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.dbr">Debt burden</dt>
              <dd class="numeric">
                {{ pct(f.dbrPercent) }}% <span class="of">/ {{ pct(f.dbrCapPercent) }}% cap</span>
                @if (f.dbrBandIndex !== null) {
                  <span class="of">· band #{{ f.dbrBandIndex }}</span>
                }
              </dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.ceiling">Borrowing ceiling</dt>
              <dd class="numeric">{{ money(f.maxAffordableAmountEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.binding">What capped it</dt>
              <dd>{{ bindingLabel(f.bindingConstraint) }}</dd>
            </div>
          </dl>
          <dl class="rows sub">
            <div>
              <dt i18n="@@sim.detail.fee_admin">Admin fee</dt>
              <dd class="numeric">{{ money(f.fees.adminFeeEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.fee_stamp">Stamp duty</dt>
              <dd class="numeric">{{ money(f.fees.stampDutyEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.fee_life">Life insurance</dt>
              <dd class="numeric">{{ money(f.fees.lifeInsuranceEGP) }} EGP</dd>
            </div>
          </dl>
        } @else {
          <p class="unavailable">{{ unavailableText() }}</p>
          @if (match.maxAffordableAmountEGP; as ceiling) {
            <dl class="rows">
              <div>
                <dt i18n="@@sim.detail.ceiling">Borrowing ceiling</dt>
                <dd class="numeric">{{ money(ceiling) }} EGP</dd>
              </div>
            </dl>
          }
        }
      </section>

      <!-- ── 2. Registry terms (fetched live) ─────────────────── -->
      <section class="block">
        <h4 class="block-h" i18n="@@sim.detail.terms">Program terms</h4>
        @if (loadingProgram()) {
          <app-skeleton-rows
            [rows]="5"
            [cols]="[2, 3]"
            ariaLabel="Loading program terms"
            i18n-ariaLabel="@@sim.detail.terms_loading"
          />
        } @else if (program() !== null) {
          @let p = program()!;
          <dl class="rows">
            <div>
              <dt i18n="@@sim.detail.list_rate">Listed rate</dt>
              <dd class="numeric">{{ listedRate(p) }}</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.term_range">Term range</dt>
              <dd class="numeric">
                <ng-container i18n="@@sim.detail.months_range"
                  >{{ p.tenor.minMonths }}–{{ p.tenor.maxMonths }} months</ng-container
                >
              </dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.amount_range">Amount range (EGP)</dt>
              <dd class="numeric">{{ amountRange(p) }}</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.age_range">Age</dt>
              <dd class="numeric">{{ p.eligibility.ageMin }}–{{ p.eligibility.ageMax }}</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.dbr_cap">DBR cap</dt>
              <dd class="numeric">
                {{ pct(p.eligibility.dbrCapPercent) }}%
                @if (p.eligibility.dbrBands?.length) {
                  <span class="of">· {{ p.eligibility.dbrBands!.length }} income bands</span>
                }
              </dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.min_income">Minimum income</dt>
              <dd class="numeric">{{ money(p.eligibility.minMonthlyIncomeEGP) }} EGP</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.fee_rates">Fee rates</dt>
              <dd class="numeric">{{ feeRates(p) }}</dd>
            </div>
            <div>
              <dt i18n="@@sim.detail.updated">Last updated</dt>
              <dd>{{ p.updatedAt | date: 'medium' }}</dd>
            </div>
          </dl>
          @if (p.pricing.isVariableRate && p.pricing.variableRateNote) {
            <p class="note">{{ p.pricing.variableRateNote }}</p>
          }
          @if (match.requiredDocuments.length > 0) {
            <h5 class="sub-h" i18n="@@sim.detail.docs">Required documents</h5>
            <ul class="docs">
              @for (d of match.requiredDocuments; track d) {
                <li class="doc">{{ d }}</li>
              }
            </ul>
          }
          <a
            class="jump"
            [routerLink]="['/banks/programs', p.programCode]"
            i18n="@@sim.detail.open_program"
            >Open the full program →</a
          >
        } @else {
          <p class="note" i18n="@@sim.detail.terms_failed">
            The program's terms could not be loaded. The figures above are unaffected.
          </p>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .wrap { display: flex; flex-direction: column; gap: var(--space-6, 24px); }

      /* Identity and score share one baseline row — the number is the reason the
         drawer was opened, so it outranks everything else in the panel. */
      .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4, 16px); }
      .hero-id { display: flex; flex-direction: column; gap: 6px; min-inline-size: 0; }
      .prog { margin: 0; font-size: var(--text-lg, 18px); font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; }
      .code {
        font-size: 11px; letter-spacing: 0.04em; align-self: flex-start;
        color: var(--color-text-secondary, #6b7280);
        background: var(--color-surface-elevated, #f4f6f8); padding: 2px 8px; border-radius: var(--radius-sm, 6px);
      }
      .score { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
      .score-num {
        font-size: 34px; font-weight: 800; line-height: 1;
        font-variant-numeric: tabular-nums lining-nums; letter-spacing: -0.02em;
      }
      .score-sign { font-size: 18px; font-weight: 700; margin-inline-start: 2px; }
      .score-tier {
        margin-block-start: 4px; font-size: 11px; font-weight: 600; text-transform: capitalize;
        color: var(--color-text-secondary, #6b7280);
      }
      .score[data-tier='excellent'] .score-num, .score[data-tier='good'] .score-num { color: var(--ant-success-color, #2e7d4f); }
      .score[data-tier='moderate'] .score-num { color: var(--ant-warning-color, #b8860b); }
      .score[data-tier='low'] .score-num, .score[data-tier='very_low'] .score-num { color: var(--ant-error-color, #c1666b); }
      .score[data-tier='unrated'] .score-num { color: var(--color-text-tertiary, #9aa1ab); }

      .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: calc(-1 * var(--space-3, 12px)); }

      /* Blocks are separated by a hairline, not by nested cards: the drawer is
         already a surface, and a card inside it would be a second one. */
      .block { display: flex; flex-direction: column; gap: var(--space-3, 12px); padding-block-start: var(--space-5, 20px); border-block-start: 1px solid var(--color-border-default, #eceff3); }
      .block-h {
        margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.08em; color: var(--color-text-secondary, #6b7280);
      }
      .sub-h { margin: var(--space-2, 8px) 0 0; font-size: 12px; font-weight: 700; }

      .rows { display: flex; flex-direction: column; gap: 0; margin: 0; }
      .rows > div {
        display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4, 16px);
        padding-block: 9px; border-block-end: 1px solid var(--color-border-default, #eceff3);
      }
      .rows > div:last-child { border-block-end: none; }
      .rows dt { font-size: 13px; color: var(--color-text-secondary, #6b7280); }
      .rows dd { margin: 0; font-size: 14px; font-weight: 600; text-align: end; }
      .rows.sub dd, .rows.sub dt { font-size: 12px; font-weight: 500; }
      .rows dd.strong { font-size: 16px; font-weight: 700; }
      .numeric { font-variant-numeric: tabular-nums lining-nums; }
      .of { font-weight: 500; color: var(--color-text-secondary, #6b7280); }

      .note { margin: 0; font-size: 12px; line-height: 1.5; color: var(--color-text-secondary, #6b7280); }
      .unavailable {
        margin: 0; font-size: 13px; line-height: 1.5;
        color: var(--color-text-primary, #1a2433);
        background: color-mix(in srgb, var(--ant-warning-color, #b8860b) 10%, transparent);
        border-inline-start: 3px solid var(--ant-warning-color, #b8860b);
        padding: 10px 12px; border-radius: var(--radius-sm, 6px);
      }

      .docs { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
      .doc {
        font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: var(--radius-pill, 999px);
        background: var(--color-surface-elevated, #f4f6f8); color: var(--color-text-secondary, #6b7280);
      }

      .jump {
        align-self: flex-start; font-size: 13px; font-weight: 600; min-block-size: 32px;
        display: inline-flex; align-items: center;
        color: var(--ant-primary-color, #0869c3); text-decoration: none;
      }
      .jump:hover { text-decoration: underline; }
      .jump:focus-visible { outline: 2px solid var(--ant-primary-color, #0869c3); outline-offset: 3px; border-radius: 4px; }
    `,
  ],
})
export class SimulatedOfferDrawerComponent {
  private readonly data = inject<SimulatedOfferDrawerData>(NZ_DRAWER_DATA);
  private readonly programs = inject(BankProgramsApiService);
  private readonly errors = inject(ErrorCodeService);

  protected readonly match = this.data.match;
  protected readonly program = signal<BankProgramResponse | null>(null);
  protected readonly loadingProgram = signal(true);

  protected readonly featuredLabel = $localize`:@@sim.featured:Featured`;
  protected readonly shariaLabel = $localize`:@@sim.detail.sharia:Sharia-compliant`;
  protected readonly unratedLabel = $localize`:@@sim.detail.unrated:Not rated`;

  constructor() {
    void this.loadProgram();
  }

  protected scorePct(): number {
    return Math.round(this.match.approvalProbability * 100);
  }

  /** An unconfigured program reads as unrated — never as `very_low` (v13.0.0). */
  protected tierLabel(): string {
    return approvalTierLabel(this.match);
  }

  protected money(value: string): string {
    return money(value);
  }
  protected pct(value: string): string {
    return percent(value);
  }

  /** The reason text comes from the SAME catalog the interceptor uses (A22). */
  protected unavailableText(): string {
    const reason = this.match.figuresUnavailableReason;
    if (reason === null) return '';
    return this.errors.toLocalizedMessage(reason as ErrorCode);
  }

  protected bindingLabel(constraint: string): string {
    return bindingConstraintLabel(constraint);
  }

  protected listedRate(p: BankProgramResponse): string {
    const value = p.pricing.isVariableRate
      ? p.pricing.currentEffectiveRatePercent
      : p.pricing.baseRatePercent;
    if (!value) return '—';
    return p.pricing.isVariableRate
      ? $localize`:@@sim.detail.rate_variable:${percent(value)}:rate:% (variable)`
      : `${percent(value)}%`;
  }

  protected amountRange(p: BankProgramResponse): string {
    const bounds = p.loanLimits.perCurrency['EGP'];
    if (!bounds) return '—';
    return `${money(bounds.minAmount)} – ${money(bounds.maxAmount)}`;
  }

  /** Admin · stamp duty · life insurance, as configured percentages. */
  protected feeRates(p: BankProgramResponse): string {
    return `${percent(p.fees.adminFeePercent)}% · ${percent(p.fees.stampDutyPercent)}% · ${percent(
      p.fees.lifeInsurancePercent,
    )}%`;
  }

  private async loadProgram(): Promise<void> {
    try {
      const response = await this.programs.getByCode(this.match.programCode);
      this.program.set(response.data);
    } catch {
      // Terms are supplementary: the simulation figures already rendered above,
      // so a failed lookup degrades this one block instead of the whole drawer.
      this.program.set(null);
    } finally {
      this.loadingProgram.set(false);
    }
  }
}
