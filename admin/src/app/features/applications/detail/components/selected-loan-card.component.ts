import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusPillComponent, type StatusTone } from '@shared/ui';
import { HumanizePipe } from '@shared/humanize.pipe';
import type { AdminApplicationOffer } from '../../api/applications.api.service';
import {
  cashIsBelowLoan,
  ceilingIsInformative,
  dbrIsAtCap,
  wasAmountReduced,
} from './selected-loan.rules';

/** One rendered fee line: label + formatted amount + optional "waived" mark. */
interface FeeLine {
  key: string;
  label: string;
  amount: string;
  waived: boolean;
}

/**
 * The loan the applicant actually committed to, read top to bottom as the
 * answer to three questions a sales agent gets asked:
 *   1. How much does the bank lend? (and, when cut, why)
 *   2. What does the customer pay back? installment × months = total
 *   3. What is behind that price? rate, total interest, debts vs. income
 * then the financed fees with the cash the customer actually receives.
 *
 * Sits above "Matched offers": that list is candidates, this card is the deal.
 * Every figure is read straight off the immutable BankOffer snapshot (Principle
 * I / A6) — nothing is recomputed here, the strings arrive Decimal-formatted and
 * are only grouped for display.
 */
@Component({
  selector: 'app-selected-loan-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, StatusPillComponent, HumanizePipe],
  template: `
    @let o = offer();
    <section class="loan-card">
      <span class="stripe" aria-hidden="true"></span>

      <header class="head">
        <div class="head-text">
          <span class="eyebrow" i18n="@@app.detail.selected.title">Eligible for</span>
          <h2 class="bank">{{ o.bankName }}</h2>
          <span class="program">{{ o.programFriendlyName }}</span>
        </div>

        <div class="head-marks">
          @if (decisionTone(); as tone) {
            <app-status-pill [tone]="tone" [label]="decisionLabel()" />
          } @else {
            <app-status-pill
              tone="neutral"
              label="Awaiting bank decision"
              i18n-label="@@app.detail.selected.awaitingDecision"
            />
          }
        </div>
      </header>

      <!-- 1. What the bank lends, and why it is that much -->
      <div class="principal">
        <span class="label" i18n="@@app.detail.selected.loanAmount">Loan amount</span>
        <div class="principal-figure">
          <span class="principal-value"
            >{{ wholePart(o.effectiveLoanAmountEGP)
            }}<span class="principal-fraction">{{
              fractionPart(o.effectiveLoanAmountEGP)
            }}</span></span
          >
          <span class="principal-currency" i18n="@@bpd.unit.egp">EGP</span>
        </div>
        @if (requestedAmountEGP(); as asked) {
          @if (amountWasReduced()) {
            <p class="principal-note">
              <span class="asked" i18n="@@app.detail.selected.askedFor"
                >Asked for {{ money(asked) }} EGP</span
              >
              @if (cutByDbr() && o.dbrCapPercent) {
                <!-- prettier-ignore -->
                <span class="why" i18n="@@app.detail.selected.cutByDbr">Reduced so all monthly debts stay within the bank's limit of {{ percent(o.dbrCapPercent) }}% of income.</span>
              }
            </p>
          } @else {
            <p class="principal-note">
              <span i18n="@@app.detail.selected.asRequested">Full amount requested</span>
            </p>
          }
        }
        @if (showCeiling()) {
          <p class="principal-note">
            <!-- prettier-ignore -->
            <span i18n="@@app.detail.selected.ceilingNote">This bank would lend up to {{ money(o.maxLoanAvailableEGP!) }} EGP</span>
          </p>
        }
      </div>

      <!-- 2. What the customer pays back: installment x months = total -->
      <div class="repay">
        <div class="repay-part">
          <span class="label" i18n="@@app.detail.selected.installment">Monthly installment</span>
          <span class="repay-value"
            >{{ money(o.monthlyInstallmentEGP) }}
            <span class="unit" i18n="@@bpd.unit.egp">EGP</span></span
          >
        </div>
        <span class="op" aria-hidden="true">&times;</span>
        <div class="repay-part">
          <span class="label" i18n="@@app.detail.selected.tenor">Term</span>
          <span class="repay-value">
            <ng-container i18n="@@app.detail.selected.months"
              >{{ o.effectiveTenorMonths }} months</ng-container
            >
          </span>
          @if (o.effectiveTenorMonths !== o.requestedTenorMonths) {
            <span class="repay-sub" i18n="@@app.detail.selected.tenorRequested"
              >asked for {{ o.requestedTenorMonths }}</span
            >
          }
        </div>
        <span class="op" aria-hidden="true">=</span>
        <div class="repay-part repay-part--total">
          <span class="label" i18n="@@app.detail.selected.totalPayable">Total to repay</span>
          <span class="repay-value"
            >{{ money(o.totalPayableEGP) }}
            <span class="unit" i18n="@@bpd.unit.egp">EGP</span></span
          >
        </div>
      </div>

      <!-- 3. The three numbers behind the price -->
      <dl class="stats">
        <div class="stat">
          <dt i18n="@@app.detail.selected.rate">Interest rate</dt>
          <dd>
            {{ percent(o.effectiveRatePercent) }}%
            <span class="stat-sub" i18n="@@app.detail.selected.perYear">a year</span>
          </dd>
        </div>
        <div class="stat">
          <dt i18n="@@app.detail.selected.costOfCredit">Total interest</dt>
          <dd>
            {{ money(o.totalCostOfCreditEGP) }}
            <span class="unit" i18n="@@bpd.unit.egp">EGP</span>
          </dd>
        </div>
        @if (o.dbrPercent) {
          <div class="stat">
            <dt i18n="@@app.detail.selected.dbr">Debts vs. income</dt>
            <dd>
              {{ percent(o.dbrPercent) }}%
              @if (o.dbrCapPercent) {
                <span class="stat-sub" i18n="@@app.detail.selected.dbrCap"
                  >limit {{ percent(o.dbrCapPercent) }}%</span
                >
              }
              @if (cutByDbr()) {
                <span class="at-limit" i18n="@@app.detail.selected.atLimit">At limit</span>
              }
            </dd>
          </div>
        }
      </dl>

      <!-- 4. Fees are financed: inside the loan amount, not paid on top -->
      @if (feeLines().length > 0) {
        <div class="fees">
          <span class="fees-title" i18n="@@app.detail.selected.fees"
            >Fees (included in the loan)</span
          >
          <ul class="fees-list">
            @for (f of feeLines(); track f.key) {
              <li class="fee">
                <span class="fee-label">{{ f.label }}</span>
                <span class="fee-amount" [class.fee-amount--waived]="f.waived">
                  {{ f.waived ? waivedLabel : money(f.amount) }}
                </span>
              </li>
            }
          </ul>
          @if (showCash()) {
            <p class="cash">
              <span class="cash-label" i18n="@@app.detail.selected.cash"
                >Customer receives in cash</span
              >
              <span class="cash-amount"
                >{{ money(o.requestedLoanAmountEGP) }}
                <span class="unit" i18n="@@bpd.unit.egp">EGP</span></span
              >
            </p>
          }
        </div>
      }

      <dl class="meta">
        <div class="meta-item">
          <dt i18n="@@app.detail.selected.program">Program</dt>
          <dd>
            <code>{{ o.programCode }} · v{{ o.programVersion }}</code>
          </dd>
        </div>
        @if (proceededAt()) {
          <div class="meta-item">
            <dt i18n="@@app.detail.selected.proceededAt">Committed on</dt>
            <dd>{{ proceededAt() | date: 'MMM d, y · h:mm a' }}</dd>
          </div>
        }
        @if (o.decision) {
          <div class="meta-item">
            <dt i18n="@@app.detail.selected.decidedAt">Bank replied</dt>
            <dd>{{ o.decision.recordedAt | date: 'MMM d, y · h:mm a' }}</dd>
          </div>
        }
        <div class="meta-item">
          <dt i18n="@@app.detail.selected.type">Financing type</dt>
          <dd>
            @if (o.isShariaCompliant) {
              <span i18n="@@app.detail.selected.sharia">Sharia-compliant</span>
            } @else {
              <span i18n="@@app.detail.selected.conventional">Conventional</span>
            }
          </dd>
        </div>
      </dl>

      @if (o.requiredDocuments.length > 0) {
        <p class="docs">
          <span class="docs-title" i18n="@@app.detail.selected.docs">Documents needed</span>
          <span class="docs-list">{{ o.requiredDocuments | humanize }}</span>
        </p>
      }
    </section>
  `,
  styles: [
    `
      .loan-card {
        position: relative;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5) var(--space-5) var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        overflow: hidden;
        container: loan-card / inline-size;
      }
      .stripe {
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: 0;
        inline-size: 4px;
        block-size: 100%;
        background: linear-gradient(
          180deg,
          var(--color-brand-primary) 0%,
          var(--color-tonal-accent) 100%
        );
      }

      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .head-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .eyebrow,
      .label {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .bank {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .program {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .head-marks {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .principal {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .principal-figure {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-2);
      }
      .principal-value {
        font-size: var(--text-3xl);
        font-weight: var(--font-weight-bold);
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: -0.025em;
        line-height: 1;
        color: var(--color-text-primary);
      }
      .principal-fraction {
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-tertiary);
        letter-spacing: 0;
      }
      .principal-currency {
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-tertiary);
        letter-spacing: 0.04em;
      }
      .principal-note {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
      }
      .asked {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums;
      }

      .repay {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3) var(--space-4);
        background: var(--color-surface-muted);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
      }
      .repay-part {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .repay-value {
        font-size: var(--text-xl);
        font-weight: var(--font-weight-semibold);
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-primary);
        white-space: nowrap;
      }
      .repay-part--total .repay-value {
        font-weight: var(--font-weight-bold);
      }
      .repay-sub {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .op {
        font-size: var(--text-xl);
        color: var(--color-text-tertiary);
        align-self: center;
      }
      /* Too narrow for one line: the sum reads as a list, so the signs go. */
      @container loan-card (max-width: 560px) {
        .repay {
          flex-direction: column;
          align-items: flex-start;
        }
        .op {
          display: none;
        }
        .fees-list {
          flex-direction: column;
        }
        .fee {
          justify-content: space-between;
        }
      }
      .unit {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-tertiary);
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: var(--space-3) var(--space-4);
        margin: 0;
      }
      .stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .stat dt {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .stat dd {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-1) var(--space-2);
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-primary);
      }
      .stat-sub {
        font-weight: var(--font-weight-regular);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .at-limit {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        background: var(--color-warning-bg);
        border-radius: var(--radius-pill);
        padding-inline: var(--space-2);
        padding-block: 1px;
      }

      .fees {
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .fees-title {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .fees-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-5);
      }
      .fee {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-2);
        font-size: var(--text-sm);
      }
      .fee-label {
        color: var(--color-text-secondary);
      }
      .fee-amount {
        font-variant-numeric: tabular-nums lining-nums;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .fee-amount--waived {
        color: var(--color-text-tertiary);
        font-weight: var(--font-weight-regular);
      }
      .cash {
        margin: 0;
        padding-block-start: var(--space-2);
        border-block-start: 1px dashed var(--color-border-default);
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        font-size: var(--text-sm);
      }
      .cash-label {
        color: var(--color-text-secondary);
      }
      .cash-amount {
        font-weight: var(--font-weight-semibold);
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-primary);
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-4) var(--space-5);
        margin: 0;
        padding-block-start: var(--space-3);
        border-block-start: 1px dashed var(--color-border-default);
      }
      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .meta-item dt {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
        margin: 0;
      }
      .meta-item dd {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums;
      }
      .meta-item code {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        font-size: var(--text-xs);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        padding-inline: var(--space-2);
        padding-block: 2px;
        border-radius: var(--radius-sm);
      }

      .docs {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: baseline;
        font-size: var(--text-xs);
      }
      .docs-title {
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .docs-list {
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class SelectedLoanCardComponent {
  readonly offer = input.required<AdminApplicationOffer>();
  /** When the applicant proceeded with this offer (application-level timestamp). */
  readonly proceededAt = input<string | null>(null);
  /**
   * What the applicant asked for on the application — NOT the offer's own
   * `requestedLoanAmountEGP`, which the cascade has already trimmed (a program
   * that caps at 442k reports 442k as "requested"). Comparing against that made
   * a DBR-capped loan read as "full amount requested".
   */
  readonly requestedAmountEGP = input<string | null>(null);

  protected readonly waivedLabel = $localize`:@@app.detail.selected.waived:Waived`;

  private readonly decisionLabels: Record<string, string> = {
    approved: $localize`:@@app.detail.selected.decision.approved:Approved by bank`,
    rejected: $localize`:@@app.detail.selected.decision.rejected:Rejected by bank`,
    withdrawn: $localize`:@@app.detail.selected.decision.withdrawn:Withdrawn`,
  };

  private readonly feeLabels: Record<string, string> = {
    adminFeeEGP: $localize`:@@app.detail.selected.fee.admin:Administrative fee`,
    stampDutyEGP: $localize`:@@app.detail.selected.fee.stamp:Stamp duty`,
    lifeInsuranceEGP: $localize`:@@app.detail.selected.fee.insurance:Life insurance`,
    collateralFeeEGP: $localize`:@@app.detail.selected.fee.collateral:Collateral fee`,
  };

  /** Tone for the bank verdict; null while no decision has been recorded. */
  protected readonly decisionTone = computed<StatusTone | null>(() => {
    const outcome = this.offer().decision?.outcome;
    if (!outcome) return null;
    if (outcome === 'approved') return 'success';
    if (outcome === 'rejected') return 'error';
    return 'neutral';
  });

  protected readonly decisionLabel = computed<string>(() => {
    const outcome = this.offer().decision?.outcome;
    return outcome ? (this.decisionLabels[outcome] ?? outcome) : '';
  });

  /** See `ceilingIsInformative` — the ceiling row is hidden when it echoes the headline. */
  protected readonly showCeiling = computed<boolean>(() =>
    ceilingIsInformative(this.offer().maxLoanAvailableEGP, this.offer().effectiveLoanAmountEGP),
  );

  /** True when the debt-burden limit is what sized the loan — see `dbrIsAtCap`. */
  protected readonly cutByDbr = computed<boolean>(() =>
    dbrIsAtCap(this.offer().dbrPercent, this.offer().dbrCapPercent),
  );

  /** The cash line, shown only when financed fees make it differ from the headline. */
  protected readonly showCash = computed<boolean>(() =>
    cashIsBelowLoan(this.offer().requestedLoanAmountEGP, this.offer().effectiveLoanAmountEGP),
  );

  /** True when the bank could not fund what the applicant actually asked for. */
  protected readonly amountWasReduced = computed<boolean>(() =>
    wasAmountReduced(this.offer().effectiveLoanAmountEGP, this.requestedAmountEGP()),
  );

  /**
   * Fee lines present on this offer, in signing order. A waiver flag renders as
   * "Waived" rather than a zero — a fee that was dropped and a fee that never
   * applied read very differently to a sales agent.
   */
  protected readonly feeLines = computed<FeeLine[]>(() => {
    const fees = this.offer().feesBreakdown ?? {};
    const waivers: Record<string, boolean> = {
      adminFeeEGP: fees.adminFeeWaived === true,
      lifeInsuranceEGP: fees.lifeInsuranceWaived === true,
    };
    return (
      ['adminFeeEGP', 'stampDutyEGP', 'lifeInsuranceEGP', 'collateralFeeEGP'] as const
    ).flatMap<FeeLine>((key) => {
      const amount = fees[key];
      if (typeof amount !== 'string') return [];
      return [
        {
          key,
          label: this.feeLabels[key] ?? key,
          amount,
          waived: waivers[key] === true,
        },
      ];
    });
  });

  /**
   * Decimal string → grouped display. Trailing ".00" is noise on a summary, but
   * piastres, when present, always show both digits ("4,168.50", never "4,168.5").
   */
  protected money(raw: string): string {
    const value = Number(raw);
    if (!Number.isFinite(value)) return raw;
    const digits = Number.isInteger(value) ? 0 : 2;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }

  /** "425,186.69" → "425,186": the headline's pounds, set large. */
  protected wholePart(raw: string): string {
    const formatted = this.money(raw);
    const dot = formatted.indexOf('.');
    return dot === -1 ? formatted : formatted.slice(0, dot);
  }

  /** "425,186.69" → ".69": the headline's piastres, set small; empty when whole. */
  protected fractionPart(raw: string): string {
    const formatted = this.money(raw);
    const dot = formatted.indexOf('.');
    return dot === -1 ? '' : formatted.slice(dot);
  }

  /** Percent string → at most 2 decimals ("24.0000" reads as noise at a glance). */
  protected percent(raw: string): string {
    const value = Number(raw);
    if (!Number.isFinite(value)) return raw;
    return String(Number(value.toFixed(2)));
  }
}
