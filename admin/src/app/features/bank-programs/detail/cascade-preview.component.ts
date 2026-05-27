import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  RiseOutline,
  InfoCircleOutline,
  CheckCircleOutline,
  MinusOutline,
} from '@ant-design/icons-angular/icons';
import type { BankProgramResponse, DerivationChain, RateBandValue } from '../bank-programs.types';

/**
 * Pure-client cascade evaluator (R12). Mirrors the backend evaluator's frozen order +
 * floor-to-≤ rules. The TypeScript shape stays in lock-step via the shared types module.
 *
 * Spec anchors: FR-008b/o.1/p.1, FR-033e (what-if preview).
 */

export interface CascadeApplicantContext {
  employmentType?: string;
  transferType?: string;
  salaryCategory?: string;
  customerProgramTier?: string;
  seniorityYears?: number;
  tenorMonths?: number;
  downPaymentPercent?: number;
  assetValueEGP?: number;
  loanAmountEGP?: number;
}

interface TraceStep {
  level: string;
  matched: boolean;
  value?: string;
  reason?: string;
}

interface CascadeResult {
  effectiveRatePercent: string;
  matchedLevel: string;
  derivation?: DerivationChain;
  trace: TraceStep[];
}

const PRICING_ORDER = [
  'rateByTenor',
  'rateByTransferType',
  'rateByDownPaymentPercent',
  'rateByCustomerProgramTier',
  'rateByAssetValueBand',
  'rateByLoanAmountBand',
  'rateBySeniority',
  'rateByEmploymentType',
] as const;

@Component({
  selector: 'app-cascade-preview',
  standalone: true,
  imports: [CommonModule, NzIconModule, NzToolTipModule],
  providers: [
    provideNzIconsPatch([RiseOutline, InfoCircleOutline, CheckCircleOutline, MinusOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cascade">
      <header>
        <span nz-icon nzType="rise" nzTheme="outline" class="header-icon" aria-hidden="true"></span>
        <h3 i18n="@@bank_programs.cascade.title">Rate cascade</h3>
      </header>

      <p class="effective">
        <span i18n="@@bank_programs.cascade.effective_label">Effective rate</span>
        <strong class="numeric">{{ result().effectiveRatePercent }}%</strong>
      </p>
      <p class="matched-level">
        <span i18n="@@bank_programs.cascade.matched_at">Matched at</span>
        <code>{{ result().matchedLevel }}</code>
      </p>

      @if (result().derivation; as d) {
        <div
          class="derivation-chip"
          nz-tooltip
          [nzTooltipTitle]="derivationTooltip(d)"
        >
          <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
          <span>{{ d.sourceRatePercent }}% + {{ d.deltaPercent }}% — {{ d.reason }}</span>
        </div>
      }

      <ol class="trace">
        @for (step of result().trace; track step.level) {
          <li [class.matched]="step.matched">
            <span
              nz-icon
              [nzType]="step.matched ? 'check-circle' : 'minus'"
              nzTheme="outline"
              class="trace-icon"
              aria-hidden="true"
            ></span>
            <span class="trace-level">{{ step.level }}</span>
            @if (step.value) {
              <span class="trace-value numeric">{{ step.value }}%</span>
            }
            @if (step.reason) {
              <span class="trace-reason">{{ step.reason }}</span>
            }
          </li>
        }
      </ol>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .cascade {
        background: var(--color-surface);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
      }
      header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-end: var(--space-2);
      }
      header h3 {
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
      }
      .header-icon {
        color: var(--color-tonal-accent);
      }
      .effective {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin: 0 0 var(--space-1);
      }
      .effective strong {
        font-size: var(--text-xl);
        color: var(--color-brand-primary);
      }
      .matched-level {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        margin: 0 0 var(--space-3);
      }
      .matched-level code {
        background: var(--color-surface-elevated);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-family: var(--font-family-mono, monospace);
      }
      .derivation-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 4px 8px;
        background: rgba(28, 66, 144, 0.06);
        border: 1px solid rgba(28, 66, 144, 0.2);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        color: var(--color-tonal-accent);
        margin-block-end: var(--space-3);
      }
      .trace {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        border-block-start: 1px dashed var(--color-border-subtle);
        padding-block-start: var(--space-2);
      }
      .trace li {
        display: grid;
        grid-template-columns: 16px max-content 1fr max-content;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .trace li.matched {
        color: var(--color-text-primary);
      }
      .trace-icon {
        font-size: 14px;
      }
      .trace li.matched .trace-icon {
        color: var(--color-tonal-accent);
      }
      .trace-level {
        font-family: var(--font-family-mono, monospace);
      }
      .trace-value {
        color: var(--color-brand-primary);
        justify-self: end;
      }
      .trace-reason {
        color: var(--color-text-tertiary);
        font-style: italic;
      }
      .numeric {
        font-variant-numeric: tabular-nums lining-nums;
      }
    `,
  ],
})
export class CascadePreviewComponent {
  readonly program = input.required<BankProgramResponse>();
  readonly context = input.required<CascadeApplicantContext>();

  readonly result = computed<CascadeResult>(() => evaluate(this.program(), this.context()));

  derivationTooltip(d: DerivationChain): string {
    return `${d.sourceRatePercent} + ${d.deltaPercent} = effective rate. Reason: ${d.reason}`;
  }
}

function evaluate(program: BankProgramResponse, ctx: CascadeApplicantContext): CascadeResult {
  const pricing = program.pricing;
  const trace: TraceStep[] = [];

  for (const level of PRICING_ORDER) {
    const map = (pricing as unknown as Record<string, Record<string, RateBandValue> | undefined>)[
      level
    ];
    if (!map || Object.keys(map).length === 0) {
      trace.push({ level, matched: false, reason: 'not configured' });
      continue;
    }
    const matched = selectFromTierMap(level, map, ctx);
    if (matched) {
      trace.push({ level, matched: true, value: matched.band.value, reason: `key=${matched.key}` });
      return {
        effectiveRatePercent: matched.band.value,
        matchedLevel: level,
        derivation: matched.band.derivation,
        trace,
      };
    }
    trace.push({ level, matched: false, reason: 'no key matched' });
  }

  const final = pricing.isVariableRate
    ? pricing.currentEffectiveRatePercent
    : pricing.baseRatePercent;
  trace.push({
    level: 'baseOrCurrentEffectiveRate',
    matched: true,
    value: final ?? '0',
    reason: 'fallback',
  });
  return {
    effectiveRatePercent: final ?? '0',
    matchedLevel: 'baseOrCurrentEffectiveRate',
    trace,
  };
}

interface BandMatch {
  key: string;
  band: RateBandValue;
}

function selectFromTierMap(
  level: string,
  map: Record<string, RateBandValue>,
  ctx: CascadeApplicantContext,
): BandMatch | null {
  switch (level) {
    case 'rateByEmploymentType':
      return ctx.employmentType ? exact(map, ctx.employmentType) : null;
    case 'rateBySeniority':
      return ctx.seniorityYears !== undefined ? exact(map, String(ctx.seniorityYears)) : null;
    case 'rateByTransferType':
      return ctx.transferType ? exact(map, ctx.transferType) : null;
    case 'rateByTenor':
      return ctx.tenorMonths !== undefined ? exact(map, String(ctx.tenorMonths)) : null;
    case 'rateByCustomerProgramTier':
      return ctx.customerProgramTier ? exact(map, ctx.customerProgramTier) : null;
    case 'rateByDownPaymentPercent':
      return ctx.downPaymentPercent !== undefined ? floor(map, ctx.downPaymentPercent) : null;
    case 'rateByAssetValueBand':
      return ctx.assetValueEGP !== undefined ? floor(map, ctx.assetValueEGP) : null;
    case 'rateByLoanAmountBand':
      return ctx.loanAmountEGP !== undefined ? floor(map, ctx.loanAmountEGP) : null;
    default:
      return null;
  }
}

function exact(map: Record<string, RateBandValue>, key: string): BandMatch | null {
  const band = map[key];
  return band ? { key, band } : null;
}

function floor(map: Record<string, RateBandValue>, applicant: number): BandMatch | null {
  let bestKey: string | null = null;
  let bestNum = -Infinity;
  for (const key of Object.keys(map)) {
    const k = Number(key);
    if (!Number.isFinite(k)) continue;
    if (k <= applicant && k > bestNum) {
      bestKey = key;
      bestNum = k;
    }
  }
  if (bestKey === null) return null;
  const band = map[bestKey];
  return band ? { key: bestKey, band } : null;
}
