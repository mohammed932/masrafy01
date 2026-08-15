import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import {
  ArrowLeftOutline,
  EditOutline,
  CopyOutline,
  DeleteOutline,
  WarningOutline,
  SlidersOutline,
  AppstoreOutline,
  BankOutline,
  CarOutline,
  HomeOutline,
  ShopOutline,
  UserOutline,
} from '@ant-design/icons-angular/icons';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CanDirective } from '../../../shared/can.directive';
import { HumanizePipe } from '../../../shared/humanize.pipe';
import { BankProgramsApiService } from '../bank-programs.api.service';
import { DeleteProgramDialog, type DeleteProgramDialogData } from '../delete/delete-program.dialog';
import type { BankProgramResponse } from '../bank-programs.types';
import { incomeMethodLabel } from '../bank-programs.types';
import { basisOf, incomeBasisLabel } from '@core/income-basis';

/**
 * Bank-program detail — drill-down target of a bank's program list
 * (`/banks/programs/:programCode`).
 *
 * Read-only summary of one program's stored configuration (identity, tenor,
 * loan limits, pricing, eligibility, fees) plus the row actions (edit, scoring
 * weights, delete). The rate-cascade "what-if" simulator was removed for
 * MVP — pricing-tier resolution is exercised by the matching engine, not by an
 * admin debug panel.
 */
@Component({
  selector: 'app-bank-program-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzSpinModule,
    CanDirective,
    HumanizePipe,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      EditOutline,
      CopyOutline,
      DeleteOutline,
      WarningOutline,
      SlidersOutline,
      AppstoreOutline,
      BankOutline,
      CarOutline,
      HomeOutline,
      ShopOutline,
      UserOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (program(); as p) {
      <section class="page">
        <a [routerLink]="backLink()" class="back">
          <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.detail.back">Back to bank</span>
        </a>

        <header class="hero">
          <span class="cat-badge" aria-hidden="true">
            <span nz-icon [nzType]="catIcon(p.productCategory)" nzTheme="outline"></span>
          </span>

          <div class="hero-text">
            <span class="eyebrow">{{ p.bankName }}</span>
            <h1 class="title">
              {{ p.friendlyName }}
              <span class="status-chip" [class.active]="p.active">
                <span class="dot" aria-hidden="true"></span>
                {{ p.active ? activeLabel() : inactiveLabel() }}
              </span>
            </h1>
            <!-- The humanize pipe on the raw type printed "Income surrogate" — a schema noun
               no operator uses. Same words as every other surface now. -->
            <p class="sub">
              {{ p.productCategory | humanize }} · {{ basisLabel(p) }} · v{{ p.version }}
            </p>
          </div>

          <div class="hero-actions">
            <a
              *can="['super_admin', 'sales_manager']"
              nz-button
              [routerLink]="['/banks/programs', p.programCode, 'edit']"
            >
              <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@bank_programs.action.edit">Edit</span>
            </a>
            <a
              *can="['super_admin', 'sales_manager']"
              nz-button
              [routerLink]="['/scoring', 'weights', p.id]"
            >
              <span nz-icon nzType="sliders" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@bank_programs.action.scoring_weights">Scoring weights</span>
            </a>
            <button
              *can="['super_admin']"
              nz-button
              [nzLoading]="duplicating()"
              [disabled]="duplicating()"
              (click)="duplicate()"
            >
              @if (!duplicating()) {
                <span nz-icon nzType="copy" nzTheme="outline" aria-hidden="true"></span>
              }
              <span i18n="@@bank_programs.action.duplicate">Duplicate</span>
            </button>
            <button
              *can="['super_admin']"
              nz-button
              nzType="text"
              nzShape="circle"
              nzDanger
              (click)="openDelete()"
              aria-label="Delete program"
              i18n-aria-label="@@bank_programs.action.delete"
            >
              <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
            </button>
          </div>
        </header>

        @if (p.deprecatedKeys.length > 0) {
          <div class="deprecated-banner" role="status">
            <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.detail.deprecated_banner">
              {{ p.deprecatedKeys.length }} tier key(s) have been deprecated in the registry —
              review.
            </span>
          </div>
        }

        <div class="grid">
          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.identity">Identity</h2>
            <dl class="kv">
              <div class="row">
                <dt i18n="@@bank_programs.field.program_code">Program code</dt>
                <dd>{{ p.programCode }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.bank_name">Bank</dt>
                <dd>{{ p.bankName }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.friendly_name">Friendly name</dt>
                <dd>{{ p.friendlyName }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.product_category">Category</dt>
                <dd>{{ p.productCategory | humanize }}</dd>
              </div>
            </dl>
          </section>

          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.tenor">Tenor</h2>
            <dl class="kv">
              <div class="row">
                <dt i18n="@@bank_programs.field.min_months">Min months</dt>
                <dd class="numeric">{{ p.tenor.minMonths }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.max_months">Max months</dt>
                <dd class="numeric">{{ p.tenor.maxMonths }}</dd>
              </div>
            </dl>
          </section>

          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.loan_limits">Loan limits</h2>
            <dl class="kv">
              <div class="row">
                <dt>EGP min</dt>
                <dd class="numeric">{{ p.loanLimits.minAmountEGP }}</dd>
              </div>
              <div class="row">
                <dt>EGP max</dt>
                <dd class="numeric">{{ p.loanLimits.maxAmountEGP }}</dd>
              </div>
              @if (p.loanLimits.qualitativeReviewMaxEGP; as qr) {
                <div class="row">
                  <dt i18n="@@bank_programs.detail.qr_max">Uplift ceiling (qualitative review)</dt>
                  <dd class="numeric">{{ qr }}</dd>
                </div>
              }
            </dl>
          </section>

          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.pricing">Pricing</h2>
            <dl class="kv">
              <div class="row">
                <dt i18n="@@bank_programs.field.is_variable_rate">Variable rate</dt>
                <dd>{{ p.pricing.isVariableRate ? 'Yes' : 'No' }}</dd>
              </div>
              @if (!p.pricing.isVariableRate) {
                <div class="row">
                  <dt i18n="@@bank_programs.field.base_rate">Base rate</dt>
                  <dd class="numeric">{{ p.pricing.baseRatePercent }}%</dd>
                </div>
              } @else {
                <div class="row">
                  <dt i18n="@@bank_programs.field.current_effective_rate">
                    Current effective rate
                  </dt>
                  <dd class="numeric">{{ p.pricing.currentEffectiveRatePercent }}%</dd>
                </div>
              }
              @if (p.pricing.variableRateNote) {
                <div class="row">
                  <dt i18n="@@bank_programs.field.variable_rate_note">Disclosure note</dt>
                  <dd>{{ p.pricing.variableRateNote }}</dd>
                </div>
              }
            </dl>
          </section>

          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.eligibility">Eligibility</h2>
            <dl class="kv">
              <div class="row">
                <dt i18n="@@bank_programs.field.accepted_employment_types">Employment</dt>
                <dd class="chips">
                  @for (t of p.eligibility.acceptedEmploymentTypes; track t) {
                    <span class="enum-chip">{{ t | humanize }}</span>
                  } @empty {
                    <span class="empty-dash">—</span>
                  }
                </dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.age_min">Age</dt>
                <dd class="numeric">{{ p.eligibility.ageMin }}–{{ p.eligibility.ageMax }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.min_monthly_income_egp">Min income (EGP)</dt>
                <dd class="numeric">{{ p.eligibility.minMonthlyIncomeEGP }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.dbr_cap">DBR cap</dt>
                <dd class="numeric">{{ p.eligibility.dbrCapPercent }}%</dd>
              </div>
            </dl>
          </section>

          <!-- This page rendered NOTHING about the income rule until v16.0.0 — not the
             method, not the table, not the estimate markers, not the warnings the API was
             already returning. On a no-payslip program that rule decides what income
             exists at all, so the one read-only view of the program was silent about its
             single most consequential setting. Read-only: the wizard owns editing. -->
          @if (p.programType === 'income_surrogate') {
            <section class="card">
              <h2 class="card-title" i18n="@@bank_programs.section.income">
                How the income is worked out
              </h2>
              <dl class="kv">
                <div class="row">
                  <dt i18n="@@bank_programs.field.income_basis_short">Income</dt>
                  <dd>{{ noPayslipLabel }}</dd>
                </div>
                <div class="row">
                  <dt i18n="@@bank_programs.field.strategy">Method</dt>
                  <dd>{{ methodLabel(p) }}</dd>
                </div>
                @if (incomeRows(p).length > 0) {
                  <div class="row">
                    <dt i18n="@@bank_programs.income.table">The bank’s table</dt>
                    <dd class="chips">
                      @for (r of incomeRows(p); track r.label) {
                        <span class="enum-chip" [class.estimated]="r.estimated">
                          {{ r.label }} → {{ r.income }}
                          @if (r.estimated) {
                            <!-- An estimate is a number no bank confirmed; it blocks
                               activation, so it cannot be a silent equal of a stated one. -->
                            <span
                              class="est-mark"
                              i18n="@@bank_programs.value_source.estimated_short"
                              >Estimate</span
                            >
                          }
                        </span>
                      }
                    </dd>
                  </div>
                } @else {
                  <div class="row">
                    <dt i18n="@@bank_programs.income.table">The bank’s table</dt>
                    <dd class="empty-dash" i18n="@@bank_programs.income.no_table">
                      Not entered — this program quotes nothing
                    </dd>
                  </div>
                }
                @if (p.incomeAssumption['dbrCapPercentOverride']; as override) {
                  <div class="row">
                    <dt i18n="@@bank_programs.income.dbr_override">DBR cap for this rule</dt>
                    <dd class="numeric">{{ override }}%</dd>
                  </div>
                }
              </dl>
            </section>
          }

          <!-- Typed codes the API has always returned and no screen has ever shown. -->
          @if (p.warnings && p.warnings.length > 0) {
            <section class="card warnings">
              <h2 class="card-title" i18n="@@bank_programs.section.warnings">Needs attention</h2>
              <ul class="warn-list">
                @for (w of p.warnings; track w.code + (w.meta ? '' : '')) {
                  <li>{{ warningText(w) }}</li>
                }
              </ul>
            </section>
          }

          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.fees">Fees</h2>
            <dl class="kv">
              <div class="row">
                <dt i18n="@@bank_programs.field.admin_fee">Admin fee</dt>
                <dd class="numeric">{{ p.fees.adminFeePercent }}%</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.stamp_duty">Stamp duty</dt>
                <dd class="numeric">{{ p.fees.stampDutyPercent }}%</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.life_insurance_pct">Life insurance</dt>
                <dd class="numeric">
                  {{ p.fees.lifeInsurancePercent }}%{{
                    p.fees.lifeInsuranceMandatory ? ' (mandatory)' : ''
                  }}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </section>
    } @else {
      <div class="loading" aria-busy="true"><nz-spin nzSimple></nz-spin></div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        padding: var(--space-6);
        max-width: var(--content-max-width);
        margin-inline: auto;
      }
      .back {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-end: var(--space-4);
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .back:hover {
        color: var(--color-brand-primary);
      }
      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-10);
      }

      /* ── Hero ─────────────────────────────────────────── */
      .hero {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-6);
        border-radius: var(--radius-lg);
        background: var(--gradient-hero);
        box-shadow: var(--shadow-md);
        overflow: hidden;
        isolation: isolate;
      }
      /* Soft diagonal sheen — pure white tint, no brand hex literals. */
      .hero::after {
        content: '';
        position: absolute;
        inset-block-start: -40%;
        inset-inline-end: -10%;
        inline-size: 320px;
        block-size: 320px;
        background: radial-gradient(
          circle,
          color-mix(in srgb, #fff 14%, transparent) 0%,
          transparent 70%
        );
        z-index: -1;
        pointer-events: none;
      }
      .cat-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 60px;
        block-size: 60px;
        flex: none;
        border-radius: var(--radius-lg);
        background: color-mix(in srgb, #fff 18%, transparent);
        color: #fff;
        font-size: var(--text-2xl);
        backdrop-filter: blur(6px);
      }
      .hero-text {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .eyebrow {
        display: block;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: color-mix(in srgb, #fff 80%, transparent);
      }
      .title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin: var(--space-1) 0 0;
        font-family: var(--font-display);
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        letter-spacing: var(--tracking-tight);
        color: #fff;
      }
      .sub {
        margin: var(--space-1) 0 0;
        color: color-mix(in srgb, #fff 78%, transparent);
        font-size: var(--text-sm);
      }
      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 3px 11px;
        border-radius: var(--radius-pill);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        background: color-mix(in srgb, #fff 16%, transparent);
        color: color-mix(in srgb, #fff 78%, transparent);
        backdrop-filter: blur(6px);
      }
      .status-chip.active {
        background: color-mix(in srgb, #fff 24%, transparent);
        color: #fff;
      }
      .status-chip .dot {
        inline-size: 6px;
        block-size: 6px;
        border-radius: 50%;
        background: color-mix(in srgb, #fff 60%, transparent);
      }
      .status-chip.active .dot {
        background: #fff;
      }
      .hero-actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex: none;
      }
      /* Glass treatment so controls read on the gradient (no gray-on-color). */
      .hero-actions ::ng-deep .ant-btn:not(.ant-btn-dangerous) {
        background: color-mix(in srgb, #fff 16%, transparent);
        border-color: color-mix(in srgb, #fff 32%, transparent);
        color: #fff;
        backdrop-filter: blur(6px);
      }
      .hero-actions ::ng-deep .ant-btn:not(.ant-btn-dangerous):hover {
        background: color-mix(in srgb, #fff 26%, transparent);
        border-color: color-mix(in srgb, #fff 48%, transparent);
        color: #fff;
      }
      .hero-actions ::ng-deep .ant-btn-dangerous {
        color: color-mix(in srgb, #fff 90%, transparent);
      }
      .hero-actions ::ng-deep .ant-btn-dangerous:hover {
        background: color-mix(in srgb, #fff 18%, transparent);
        color: #fff;
      }
      @media (max-width: 640px) {
        .hero-actions {
          flex-basis: 100%;
          flex-wrap: wrap;
        }
      }

      /* ── Deprecated banner ────────────────────────────── */
      .deprecated-banner {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        margin-block-start: var(--space-4);
        font-size: var(--text-sm);
      }

      /* ── Info grid ────────────────────────────────────── */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-4);
        margin-block-start: var(--space-6);
      }
      .card {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        transition:
          box-shadow var(--motion-duration-base) var(--motion-easing-standard),
          transform var(--motion-duration-base) var(--motion-easing-standard);
        animation: card-rise var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      .card:hover {
        box-shadow: var(--shadow-sm);
        transform: translateY(-2px);
      }
      .card:nth-child(2) {
        animation-delay: 50ms;
      }
      .card:nth-child(3) {
        animation-delay: 100ms;
      }
      .card:nth-child(4) {
        animation-delay: 150ms;
      }
      .card:nth-child(5) {
        animation-delay: 200ms;
      }
      .card:nth-child(6) {
        animation-delay: 250ms;
      }
      @keyframes card-rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .card {
          animation: none;
        }
        .card:hover {
          transform: none;
        }
      }
      .card-title {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
        margin: 0 0 var(--space-3);
      }
      .kv {
        margin: 0;
        display: flex;
        flex-direction: column;
      }
      .row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-4);
        padding-block: var(--space-2);
        border-block-start: 1px solid var(--color-border-default);
      }
      .row:first-child {
        border-block-start: none;
        padding-block-start: 0;
      }
      .row dt {
        flex: none;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .row dd {
        margin: 0;
        text-align: end;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }
      /* Categorical enum values render as scannable brand pills, not a comma run-on. */
      .row dd.chips {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: var(--space-2);
      }
      .enum-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: 4px 12px;
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        line-height: 1.4;
        white-space: nowrap;
      }
      /* A team-estimated figure is not an equal of a bank-stated one: it blocks
         activation, so it reads as a warning wherever it appears. */
      .enum-chip.estimated {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .est-mark {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-regular);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.85;
      }
      .card.warnings {
        border-color: color-mix(in srgb, var(--color-warning) 35%, var(--color-border-default));
      }
      .warn-list {
        margin: 0;
        padding-inline-start: var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .enum-chip::before {
        content: '';
        inline-size: 6px;
        block-size: 6px;
        border-radius: 50%;
        background: currentColor;
        flex: none;
      }
      .empty-dash {
        color: var(--color-text-tertiary);
      }
      .numeric {
        font-variant-numeric: tabular-nums lining-nums;
      }
    `,
  ],
})
export class BankProgramDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BankProgramsApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly errors = inject(ErrorCodeService);

  readonly programCode = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('programCode') ?? '')),
    { initialValue: '' },
  );
  readonly program = signal<BankProgramResponse | null>(null);

  /** Same words as every other surface (v16.0.0) — one source in `@core/income-basis`. */
  protected readonly noPayslipLabel = incomeBasisLabel('no_payslip');

  protected basisLabel(p: BankProgramResponse): string {
    return incomeBasisLabel(basisOf(p.programType));
  }

  protected methodLabel(p: BankProgramResponse): string {
    return incomeMethodLabel(p.incomeAssumption.strategy);
  }

  /**
   * The bank's table, flattened to one list of rows whichever SHAPE the method uses — a
   * key table (grade → income) or bands (from–to → income). Both answer the reader's one
   * question ("what does this bank actually pay out?"), so they are rendered as one list
   * rather than as two blocks the reader has to know the difference between.
   *
   * Each row carries whether its number was team-ESTIMATED, because an estimate blocks
   * activation and must not read as an equal of a bank-stated figure.
   */
  protected incomeRows(
    p: BankProgramResponse,
  ): Array<{ label: string; income: string; estimated: boolean }> {
    const rule = p.incomeAssumption;
    const sources = p.valueSources ?? {};
    const keyRows = (rule.keyTable ?? []).map((r) => ({
      label: r.key,
      income: r.incomeEGP,
      estimated: sources[`incomeAssumption.keyTable.${r.key}.incomeEGP`] === 'team_estimated',
    }));
    const bandRows = (rule.bands ?? []).map((b, i) => ({
      // An open-ended last band is the normal case, not a missing value.
      label: b.toExclusive === null ? `${b.fromInclusive}+` : `${b.fromInclusive}–${b.toExclusive}`,
      income: b.incomeEGP,
      estimated: sources[`incomeAssumption.bands.${i}.incomeEGP`] === 'team_estimated',
    }));
    return [...keyRows, ...bandRows];
  }

  /**
   * A typed warning code → the operator's language, never English from the server (A22).
   *
   * The cast is the boundary being crossed honestly: `warnings[].code` is a plain string on
   * the wire, and a code this bundle does not know about must still render — the service
   * falls back rather than throwing, which is the right behaviour when the backend ships a
   * new warning before the admin does.
   */
  protected warningText(w: { code: string; meta?: Record<string, unknown> }): string {
    return this.errors.toLocalizedMessage(
      w.code as Parameters<ErrorCodeService['toLocalizedMessage']>[0],
      w.meta,
    );
  }

  /** Back / post-delete target: the owning bank's detail page (registry fallback). */
  readonly backLink = computed<unknown[]>(() => {
    const id = this.program()?.bankId;
    return id ? ['/banks', id] : ['/banks'];
  });

  readonly activeLabel = signal($localize`:@@bank_programs.col.active:Active`);
  readonly inactiveLabel = signal($localize`:@@bank_programs.col.inactive:Inactive`);

  /** ng-zorro icon nzType per loan category — generic map, no hardcoded bank logic. */
  private static readonly CAT_ICONS: Readonly<Record<string, string>> = {
    personal: 'user',
    car: 'car',
    mortgage: 'home',
    business: 'shop',
  };

  catIcon(category: string): string {
    return BankProgramDetailPage.CAT_ICONS[category.toLowerCase()] ?? 'bank';
  }

  constructor() {
    // Reactive fetch.
    queueMicrotask(() => this.load());
  }

  async load(): Promise<void> {
    const code = this.programCode();
    if (!code) return;
    const res = await this.api.getByCode(code);
    this.program.set(res.data);
  }

  readonly duplicating = signal(false);

  /**
   * FR-013 — copy this program into a new INACTIVE draft and open it for editing.
   * The copy carries every configuration value; only the name and code differ,
   * which is the whole point when a bank runs 12–14 near-identical programs.
   */
  async duplicate(): Promise<void> {
    const p = this.program();
    if (!p || this.duplicating()) return;
    this.duplicating.set(true);
    try {
      const res = await this.api.duplicate(p.programCode, {
        friendlyName: $localize`:@@bank_programs.duplicate.name:${p.friendlyName}:name: (copy)`,
        friendlyNameAr: p.friendlyNameAr ?? undefined,
      });
      this.message.success(
        $localize`:@@bank_programs.duplicate.created:Draft copy created — review and activate it.`,
        { nzDuration: 5000 },
      );
      void this.router.navigate(['/banks/programs', res.data.programCode, 'edit']);
    } catch (err: unknown) {
      const code = (err as { error?: { code?: string } }).error?.code ?? 'INTERNAL_ERROR';
      this.message.error(this.errors.toLocalizedMessage(code as never));
    } finally {
      this.duplicating.set(false);
    }
  }

  openDelete(): void {
    const p = this.program();
    if (!p) return;
    const ref = this.modal.create<
      DeleteProgramDialog,
      DeleteProgramDialogData,
      boolean | undefined
    >({
      nzContent: DeleteProgramDialog,
      nzData: { programCode: p.programCode, friendlyName: p.friendlyName },
      nzWidth: 480,
      nzFooter: null,
    });
    ref.afterClose.subscribe((deleted) => {
      if (deleted) void this.router.navigate(p.bankId ? ['/banks', p.bankId] : ['/banks']);
    });
  }
}
