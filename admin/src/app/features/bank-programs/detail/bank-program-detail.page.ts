import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import type { BankProgramResponse, RateBandMap } from '../bank-programs.types';
import { incomeMethodLabel } from '../bank-programs.types';
import { basisOf, incomeBasisLabel } from '@core/income-basis';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import type { EnumerationType } from '@core/platform-enumerations/platform-enumerations.types';
import { formatGroupedNumber } from '@core/directives/money-format';
import { RelativeTimePipe } from '../../../shared/relative-time.pipe';

/**
 * Bank-program detail — drill-down target of a bank's program list
 * (`/banks/programs/:programCode`).
 *
 * Read-only summary of one program's stored configuration (identity, tenor,
 * loan limits, pricing, eligibility, fees) plus the row actions (edit,
 * duplicate, delete). The rate-cascade "what-if" simulator was removed for
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
    RelativeTimePipe,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      EditOutline,
      CopyOutline,
      DeleteOutline,
      WarningOutline,
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
            @if (p.friendlyNameAr) {
              <!-- The name the customer is shown. It is Arabic on a page that may be laid
                 out either way, so it states its own direction rather than inheriting one. -->
              <p class="title-ar">
                <bdi dir="rtl">{{ p.friendlyNameAr }}</bdi>
              </p>
            }
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

        <!-- The four or five figures a credit officer reads before anything else. A rail,
           not five cards: they are one term sheet, and five bordered boxes would out-rank
           the underwriting cards below them. -->
        <dl class="terms" aria-label="Key terms" i18n-aria-label="@@bpd.terms.aria">
          <div class="term">
            <dt i18n="@@bpd.term.rate">Rate</dt>
            <dd class="numeric">{{ headlineRate(p) }}<span class="unit">%</span></dd>
            <span class="term-hint">{{ rateBasisLabel(p) }}</span>
          </div>
          <div class="term">
            <dt i18n="@@bpd.term.amount">Loan amount</dt>
            <dd class="numeric">
              <bdi dir="ltr"
                >{{ money(p.loanLimits.minAmountEGP) }} –
                {{ money(p.loanLimits.maxAmountEGP) }}</bdi
              >
            </dd>
            <span class="term-hint" i18n="@@bpd.unit.egp">EGP</span>
          </div>
          <div class="term">
            <dt i18n="@@bpd.term.tenor">Tenor</dt>
            <dd class="numeric">
              <bdi dir="ltr">{{ p.tenor.minMonths }} – {{ p.tenor.maxMonths }}</bdi>
            </dd>
            <span class="term-hint" i18n="@@bpd.unit.months">months</span>
          </div>
          <div class="term">
            <dt i18n="@@bpd.term.dbr">Debt burden cap</dt>
            <dd class="numeric">{{ p.eligibility.dbrCapPercent }}<span class="unit">%</span></dd>
            <span class="term-hint">{{ dbrHint(p) }}</span>
          </div>
          <div class="term">
            <dt i18n="@@bpd.term.min_income">Income floor</dt>
            <dd class="numeric">{{ money(p.eligibility.minMonthlyIncomeEGP) }}</dd>
            <span class="term-hint" i18n="@@bpd.unit.egp_month">EGP a month</span>
          </div>
        </dl>

        <!-- A team estimate is a figure no bank confirmed. It blocks activation, so it is
           said once at the top rather than only beside the row that carries it. -->
        @if (estimatedPaths(p).length > 0) {
          <div class="callout" role="status">
            <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bpd.estimates_note">
              Some figures below are the team’s estimates, not the bank’s own — confirm them before
              this program goes live.
            </span>
          </div>
        }

        <div class="grid">
          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.identity">Identity</h2>
            <dl class="kv">
              <div class="row">
                <dt i18n="@@bank_programs.field.program_code">Program code</dt>
                <dd>
                  <span class="code">{{ p.programCode }}</span>
                </dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.bank_name">Bank</dt>
                <dd>{{ p.bankName }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.friendly_name">Friendly name</dt>
                <dd>{{ p.friendlyName }}</dd>
              </div>
              @if (p.friendlyNameAr) {
                <div class="row">
                  <dt i18n="@@bpd.field.friendly_name_ar">Arabic name</dt>
                  <!-- The customer reads this one. It is Arabic inside a page that may be
                     laid out either way, so it carries its own direction. -->
                  <dd>
                    <bdi dir="rtl">{{ p.friendlyNameAr }}</bdi>
                  </dd>
                </div>
              }
              @if (p.programNameKey; as nameKey) {
                <div class="row">
                  <dt i18n="@@bpd.field.catalog_name">Catalog name</dt>
                  <!-- The catalog row's own words, not its key: the key is an addressing
                     token and this row exists to say which product the bank sells. -->
                  <dd>{{ enumLabel('program_name', nameKey) }}</dd>
                </div>
              }
              <div class="row">
                <dt i18n="@@bank_programs.field.product_category">Category</dt>
                <dd>{{ p.productCategory | humanize }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.income_basis_short">Income</dt>
                <dd>{{ basisLabel(p) }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.sharia_compliant">Sharia compliant</dt>
                <dd>{{ p.isShariaCompliant ? yesLabel : noLabel }}</dd>
              </div>
              <div class="row">
                <dt i18n="@@bpd.field.last_changed">Last changed</dt>
                <dd>
                  {{ p.updatedAt | relativeTime }}
                  <span class="unit">· v{{ p.version }}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.eligibility">
              Who the bank will lend to
            </h2>
            <dl class="kv">
              <div class="row">
                <dt i18n="@@bank_programs.field.accepted_employment_types">Employment</dt>
                <dd class="chips">
                  @for (
                    t of enumLabels('employment_type', p.eligibility.acceptedEmploymentTypes);
                    track t
                  ) {
                    <span class="enum-chip">{{ t }}</span>
                  } @empty {
                    <span class="empty-dash">—</span>
                  }
                </dd>
              </div>
              <div class="row">
                <dt i18n="@@bank_programs.field.age_min">Age</dt>
                <dd class="numeric">
                  <bdi dir="ltr">{{ p.eligibility.ageMin }}–{{ p.eligibility.ageMax }}</bdi>
                </dd>
              </div>
              @if (selfEmployedAge(p); as range) {
                <div class="row">
                  <dt i18n="@@bpd.field.age_self_employed">Age — self-employed</dt>
                  <dd class="numeric">
                    <bdi dir="ltr">{{ range }}</bdi>
                  </dd>
                </div>
              }
              <div class="row">
                <dt i18n="@@bank_programs.field.min_monthly_income_egp">Min income (EGP)</dt>
                <dd class="numeric">{{ money(p.eligibility.minMonthlyIncomeEGP) }}</dd>
              </div>
              @if (p.eligibility.minMonthlyIncomeSelfEmployedEGP; as se) {
                <div class="row">
                  <dt i18n="@@bpd.field.min_income_self_employed">
                    Min income — self-employed (EGP)
                  </dt>
                  <dd class="numeric">{{ money(se) }}</dd>
                </div>
              }
              <div class="row">
                <dt i18n="@@bpd.field.min_months_in_job">Time in the job</dt>
                <dd class="numeric">
                  {{ p.eligibility.minMonthsInJob }}
                  <span class="unit" i18n="@@bpd.unit.months_min">months minimum</span>
                </dd>
              </div>
              @if (p.eligibility.acceptedTransferTypes.length > 0) {
                <div class="row">
                  <dt i18n="@@bpd.field.transfer_types">Salary transfer</dt>
                  <dd class="chips">
                    @for (
                      t of enumLabels('transfer_type', p.eligibility.acceptedTransferTypes);
                      track t
                    ) {
                      <span class="enum-chip">{{ t }}</span>
                    }
                  </dd>
                </div>
              }
              @if (dbrBandRows(p).length > 0) {
                <div class="row">
                  <dt i18n="@@bpd.field.dbr_bands">Cap by income</dt>
                  <dd class="chips">
                    @for (r of dbrBandRows(p); track r) {
                      <span class="enum-chip">{{ r }}</span>
                    }
                  </dd>
                </div>
              }
              @if (dbrByEmploymentRows(p).length > 0) {
                <div class="row">
                  <dt i18n="@@bpd.field.dbr_by_employment">Cap by employment</dt>
                  <dd class="chips">
                    @for (r of dbrByEmploymentRows(p); track r) {
                      <span class="enum-chip">{{ r }}</span>
                    }
                  </dd>
                </div>
              }
              @if (p.eligibility.skipDbrCheck) {
                <div class="row">
                  <dt i18n="@@bank_programs.field.skip_dbr">Skip DBR check (secured loans only)</dt>
                  <dd>{{ yesLabel }}</dd>
                </div>
              }
              @for (g of wealthGateRows(p); track g.label) {
                <div class="row">
                  <dt>{{ g.label }}</dt>
                  <dd class="numeric">{{ g.value }}</dd>
                </div>
              }
              <!-- Only the requirements the bank turned ON. A grid of eleven "No"s is a
                 list of everything this program is not, which nobody reads. -->
              <div class="row">
                <dt i18n="@@bpd.field.requirements">Also requires</dt>
                <dd class="chips">
                  @for (r of requirementLabels(p); track r) {
                    <span class="enum-chip">{{ r }}</span>
                  } @empty {
                    <span class="quiet" i18n="@@bpd.value.no_requirements"
                      >Nothing beyond the above</span
                    >
                  }
                </dd>
              </div>
            </dl>
          </section>

          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.pricing">Pricing</h2>
            <dl class="kv">
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
                @if (spreadRange(p); as spread) {
                  <div class="row">
                    <dt i18n="@@bpd.field.spread">Spread over the index</dt>
                    <dd class="numeric">{{ spread }}</dd>
                  </div>
                }
              }
              <!-- Always shown, including on a program that states nothing: absence reads as
               the declining annuity on the server, so leaving the row out would let the
               operator read a flat program as declining and never know a basis existed. -->
              <div class="row">
                <dt i18n="@@bank_programs.field.rate_basis">How the interest is charged</dt>
                <dd>{{ rateBasisLabel(p) }}</dd>
              </div>
              @for (t of rateTables(p); track t.label) {
                <div class="row">
                  <dt>{{ t.label }}</dt>
                  <dd class="chips">
                    @for (r of t.rows; track r) {
                      <span class="enum-chip">{{ r }}</span>
                    }
                  </dd>
                </div>
              }
              @for (w of waiverRows(p); track w.label) {
                <div class="row">
                  <dt>{{ w.label }}</dt>
                  <dd class="numeric">{{ w.value }}</dd>
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

          <!-- Only when the bank states more than the range the rail already carries. A card
             whose one row repeats the strip two inches above it is a card of nothing. -->
          @if (hasLimitDetail(p)) {
            <section class="card">
              <h2 class="card-title" i18n="@@bank_programs.section.loan_limits">Loan limits</h2>
              <dl class="kv">
                <div class="row">
                  <dt i18n="@@bpd.field.amount_range">Amount</dt>
                  <dd class="numeric">
                    {{ money(p.loanLimits.minAmountEGP) }}–{{ money(p.loanLimits.maxAmountEGP) }}
                    <span class="unit" i18n="@@bpd.unit.egp">EGP</span>
                  </dd>
                </div>
                @for (l of limitRows(p); track l.label) {
                  <div class="row">
                    <dt>{{ l.label }}</dt>
                    <dd class="numeric">{{ l.value }}</dd>
                  </div>
                }
                <!-- The second table nine bank sheets print under "Loan Amount — Maximum".
                     Rendered here because this page is where an operator checks what a program
                     holds, and a cap that only appears inside the wizard reads as absent. -->
                @if (capRows(p).length > 0) {
                  <div class="row">
                    <dt>
                      <span i18n="@@bank_programs.detail.max_by_fact">Maximum by answer</span>
                      <!-- The keys below are CLASS keys on a class-keyed table (city_tier_major,
                           not cairo), and nothing else on the row would say so. The label is
                           deliberately left as the raw key rather than resolved: this page loads
                           no enumeration registry for governorate classes, and resolving one axis
                           while the other stayed a slug reads worse than both being raw. -->
                      @if (capIsClassKeyed(p)) {
                        <span class="hint" i18n="@@bank_programs.detail.max_by_class"
                          >keyed by the answer’s class</span
                        >
                      }
                    </dt>
                    <dd class="chips">
                      @for (r of capRows(p); track r.label) {
                        <span class="enum-chip">{{ r.label }} → {{ money(r.amount) }}</span>
                      }
                    </dd>
                  </div>
                  <div class="row">
                    <dt i18n="@@bank_programs.detail.max_no_match">An answer with no row</dt>
                    @if (p.loanLimits.maxLoanByFact?.onNoMatch === 'reject') {
                      <dd i18n="@@max_loan_by_fact.reject">
                        Gets no figures, with a stated reason
                      </dd>
                    } @else {
                      <dd i18n="@@max_loan_by_fact.use_program_max">
                        Falls back to this program’s maximum
                      </dd>
                    }
                  </div>
                }
                @if (capAdjustmentRows(p).length > 0) {
                  <div class="row">
                    <dt i18n="@@bank_programs.detail.max_adjustments">
                      Adjustments to that maximum
                    </dt>
                    <dd class="chips">
                      @for (r of capAdjustmentRows(p); track r) {
                        <span class="enum-chip">{{ r }}</span>
                      }
                    </dd>
                  </div>
                }
                @for (t of capAxisTables(p); track t.label) {
                  <div class="row">
                    <dt>{{ t.label }}</dt>
                    <dd class="chips">
                      @for (r of t.rows; track r) {
                        <span class="enum-chip">{{ r }}</span>
                      }
                    </dd>
                  </div>
                }
                @if (tenorByEmploymentRows(p).length > 0) {
                  <div class="row">
                    <dt i18n="@@bpd.field.tenor_by_employment">Longest term by employment</dt>
                    <dd class="chips">
                      @for (r of tenorByEmploymentRows(p); track r) {
                        <span class="enum-chip">{{ r }}</span>
                      }
                    </dd>
                  </div>
                }
              </dl>
            </section>
          }

          <!-- This page rendered NOTHING about the income rule until v16.0.0 — not the
             method, not the warnings the API was already returning. On a no-payslip
             program that rule decides what income exists at all, so the one read-only
             view of the program was silent about its single most consequential setting.
             The bank's own step figures are NOT rendered here: the wizard owns them, and a
             flattened dump of every step's table read as noise on this card. -->
          @if (p.programType === 'income_surrogate') {
            <section class="card">
              <h2 class="card-title" i18n="@@bank_programs.section.income">
                How the income is worked out
              </h2>
              <dl class="kv">
                <div class="row">
                  <dt i18n="@@bank_programs.field.strategy">Method</dt>
                  <dd>{{ methodLabel(p) }}</dd>
                </div>
                <div class="row">
                  <dt i18n="@@bpd.field.figures_owner">Whose figures</dt>
                  <dd>{{ figuresOwnerLabel(p) }}</dd>
                </div>
                @if (p.incomeAssumption['dbrCapPercentOverride']; as override) {
                  <div class="row">
                    <dt i18n="@@bank_programs.income.dbr_override">DBR cap for this rule</dt>
                    <dd class="numeric">{{ override }}%</dd>
                  </div>
                }
                @if (additionalIncomeRows(p).length > 0) {
                  <div class="row">
                    <dt>
                      <span i18n="@@bpd.field.additional_income">Other income counted</span>
                      <span class="hint" i18n="@@bpd.field.additional_income_hint"
                        >share of each source the bank recognises</span
                      >
                    </dt>
                    <dd class="chips">
                      @for (r of additionalIncomeRows(p); track r.label) {
                        <span class="enum-chip" [class.estimated]="r.estimated">
                          {{ r.label }} → {{ r.percent }}%
                          @if (r.estimated) {
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
                  @if (additionalIncomeCap(p); as cap) {
                    <div class="row">
                      <dt i18n="@@bpd.field.additional_income_cap">Counted up to</dt>
                      <dd class="numeric">
                        {{ cap }}%
                        <span class="unit" i18n="@@bpd.unit.of_basic">of the basic figure</span>
                      </dd>
                    </div>
                  }
                }
              </dl>
            </section>
          }

          <section class="card">
            <h2 class="card-title" i18n="@@bank_programs.section.fees">Fees</h2>
            <dl class="kv">
              @for (f of feeRows(p); track f.label) {
                <div class="row">
                  <dt>{{ f.label }}</dt>
                  <dd class="numeric">{{ f.value }}</dd>
                </div>
              }
            </dl>
          </section>

          <section class="card">
            <h2 class="card-title" i18n="@@bpd.section.documents">What the customer must bring</h2>
            <dl class="kv">
              <div class="row">
                <dt i18n="@@bpd.field.required_documents">Documents</dt>
                <dd class="chips">
                  @for (d of enumLabels('required_document', p.requiredDocuments); track d) {
                    <span class="enum-chip">{{ d }}</span>
                  } @empty {
                    <span class="quiet" i18n="@@bpd.value.no_documents"
                      >None recorded for this program</span
                    >
                  }
                </dd>
              </div>
            </dl>
          </section>

          @if (performanceRows(p).length > 0) {
            <section class="card">
              <h2 class="card-title" i18n="@@bpd.section.performance">Credit history</h2>
              <dl class="kv">
                @for (r of performanceRows(p); track r.label) {
                  <div class="row">
                    <dt>{{ r.label }}</dt>
                    <dd class="numeric">{{ r.value }}</dd>
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

          <!-- The conditions the sheet states and no field on this platform can hold —
             "private hospitals only", "confirm the percentages with the bank". They are the
             reason a program can look complete and still be wrong, so they get the width. -->
          @if (noteLines(p).length > 0 || p.operatorTips.length > 0) {
            <section class="card wide">
              <h2 class="card-title" i18n="@@bpd.section.notes">Notes for the desk</h2>
              @for (line of noteLines(p); track line) {
                <p class="prose">{{ line }}</p>
              }
              @if (p.operatorTips.length > 0) {
                <ul class="tips">
                  @for (t of p.operatorTips; track t) {
                    <li>{{ t }}</li>
                  }
                </ul>
              }
            </section>
          }
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
        /* Each card is as tall as what it holds. Stretching a four-row card to match a
           twelve-row neighbour puts a third of a card's height under its last value. */
        align-items: start;
        gap: var(--space-4);
        margin-block-start: var(--space-5);
      }
      /* Prose, not pairs: the desk notes are sentences and read badly in a 280px column. */
      .card.wide {
        grid-column: 1 / -1;
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
      /* Two steps of entrance, by position. A delay per card stopped at the sixth, which
         was arbitrary the moment the page grew a seventh. */
      .card:nth-child(n + 2) {
        animation-delay: 60ms;
      }
      .card:nth-child(n + 4) {
        animation-delay: 120ms;
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
      /* Secondary, not tertiary: tertiary measures 3.83:1 on a card in light mode and this
         is a heading somebody reads to find the card they want (DESIGN_SYSTEM.md, colour). */
      .card-title {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        margin: 0 0 var(--space-4);
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
      /* A qualifier on the term, not a second term: it says what the keys beside it name. */
      .row dt .hint {
        display: block;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }
      .row dd {
        margin: 0;
        /* A flex item's floor is its content, so one long value — a product rule's step
           chips run to forty characters — pushed the whole row past the card's edge and
           put horizontal scroll on the page. */
        min-inline-size: 0;
        text-align: end;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }
      /* Categorical enum values render as scannable brand pills, not a comma run-on. */
      /* The one row that stacks: its value is a list, not a figure, and a list reads
         across the card rather than down a third of it. */
      .row:has(dd.chips),
      .row:has(.code) {
        flex-direction: column;
        align-items: stretch;
      }
      .row dd:has(.code) {
        text-align: start;
      }
      .row dd.chips {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        gap: var(--space-2);
        min-inline-size: 0;
        text-align: start;
      }
      .enum-chip {
        unicode-bidi: isolate;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        max-inline-size: 100%;
        overflow-wrap: anywhere;
        padding: 4px 12px;
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-text-primary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        line-height: 1.4;
        /* Wraps. A single enum value never needed to, and a cap-table cell
           (row key · column key → amount) always does. */
        white-space: normal;
      }
      /* ── Key-terms rail ───────────────────────────────── */
      /* One surface with hairline dividers, not five cards: these five figures are one
         term sheet, and five bordered boxes would out-rank the cards that follow. */
      .terms {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
        margin: var(--space-5) 0 0;
        padding: var(--space-4) 0;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        /* Clips the divider of whichever cell starts a row — see .term below. */
        overflow: hidden;
      }
      /* Every cell draws its own start divider and is pulled one pixel toward the start,
         so the cell that opens a row pushes its divider outside the rail and the rail
         clips it. A :first-child rule would only have handled the first cell overall, and the
         rail wraps to a second row below ~800px where the wrapped cell opens one too. */
      .term {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding-inline: var(--space-4);
        margin-inline-start: -1px;
        border-inline-start: 1px solid var(--color-border-default);
      }
      .term dt {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .term dd {
        margin: 0;
        font-size: var(--text-xl);
        font-weight: var(--font-weight-semibold);
        line-height: 1.15;
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums lining-nums;
        overflow-wrap: anywhere;
      }
      /* A unit is not the figure. It rides at the ink of a caption so the number reads
         first, and it never shrinks below the 12px floor. */
      .term-hint,
      .unit {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-normal);
        color: var(--color-text-secondary);
      }
      .unit {
        margin-inline-start: 2px;
      }

      /* ── Estimate callout ─────────────────────────────── */
      .callout {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin-block-start: var(--space-4);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--color-warning-bg);
        /* The warning is carried by the wash and the glyph; the words take body ink,
           because --color-warning on its own tint measures 2.53:1 (v22.0.0). */
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .callout [nz-icon] {
        color: var(--color-warning);
        margin-block-start: 2px;
      }

      /* ── Value treatments ─────────────────────────────── */
      /* The program code is 24 characters of mono in a 300px column: it takes the row's
         full width rather than wrapping mid-token against the label. */

      .code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        padding: 2px 8px;
        border-radius: var(--radius-sm);
        background: var(--bg-muted);
      }
      .title-ar {
        margin: var(--space-1) 0 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: color-mix(in srgb, #fff 88%, transparent);
      }
      .quiet {
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-normal);
      }
      .prose {
        margin: 0 0 var(--space-3);
        max-inline-size: 68ch;
        font-size: var(--text-sm);
        line-height: var(--line-height-normal, 1.6);
        color: var(--color-text-primary);
      }
      .prose:last-child {
        margin-block-end: 0;
      }
      /* A team-estimated figure is not an equal of a bank-stated one: it blocks
         activation, so it reads as a warning wherever it appears. */
      .enum-chip.estimated {
        background: var(--color-warning-bg);
        color: var(--color-text-primary);
      }
      .est-mark {
        white-space: nowrap;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-normal);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-secondary);
      }
      .card.warnings {
        border-color: color-mix(in srgb, var(--color-warning) 35%, var(--color-border-default));
      }
      /* One list treatment: a warning list and the desk's tips are the same object. */
      .warn-list,
      .tips {
        margin: 0;
        padding-inline-start: var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
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
  /**
   * The label registries this page resolves keys through. A stored program holds keys
   * (`hr_letter`, `salaried`, `rental_income_monthly`); every other admin surface shows the
   * operator's own words for them, and this one used to show the key or an English
   * humanisation of it.
   */
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly localeIsAr = inject(LOCALE_ID).toLowerCase().startsWith('ar');

  readonly programCode = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('programCode') ?? '')),
    { initialValue: '' },
  );
  readonly program = signal<BankProgramResponse | null>(null);

  protected basisLabel(p: BankProgramResponse): string {
    return incomeBasisLabel(basisOf(p.programType));
  }

  protected methodLabel(p: BankProgramResponse): string {
    // The pipeline's own words live in `incomeMethodLabel` now — this page used to carry the
    // only copy, which is why three other callers each answered the same question again.
    return incomeMethodLabel(p.incomeAssumption.strategy);
  }

  /* ── Values a bank desk reads ─────────────────────────────────────────────
   *
   * Every helper below turns ONE stored field into the words an operator uses. They are
   * methods rather than computeds because each takes the program as an argument: the
   * template already narrows `program()` once at the top, and re-reading the signal in
   * twenty places would be twenty subscriptions to the same object.
   */

  /** "1000000" → "1,000,000". Empty stays empty; a row that renders it is guarded. */
  protected money(value: string | null | undefined): string {
    return formatGroupedNumber(value) || '—';
  }

  /** The one rate a desk quotes: the live one on a variable program, the base one otherwise. */
  protected headlineRate(p: BankProgramResponse): string {
    const rate = p.pricing.isVariableRate
      ? p.pricing.currentEffectiveRatePercent
      : p.pricing.baseRatePercent;
    return rate ?? '—';
  }

  /**
   * How the interest is charged, in the words the wizard uses.
   *
   * Absent reads as the declining annuity, which is what the server prices an unstated
   * program at — saying nothing here would let a flat program read as declining.
   */
  protected rateBasisLabel(p: BankProgramResponse): string {
    return p.pricing.rateBasis === 'flat'
      ? $localize`:@@bank_programs.review.rate_basis_flat:The full amount (flat)`
      : $localize`:@@bank_programs.review.rate_basis_reducing:What is still owed (declining)`;
  }

  /** What the flat cap actually means once bands or a per-employment cap are also stored. */
  protected dbrHint(p: BankProgramResponse): string {
    if (p.eligibility.skipDbrCheck) {
      return $localize`:@@bpd.dbr.skipped:not checked on this program`;
    }
    if ((p.eligibility.dbrCapPercentByEmploymentType ?? {}) && this.dbrByEmploymentRows(p).length) {
      return $localize`:@@bpd.dbr.by_employment:some employment types differ`;
    }
    if ((p.eligibility.dbrBands ?? []).length > 0) {
      return $localize`:@@bpd.dbr.by_income:refined by income`;
    }
    return $localize`:@@bpd.dbr.flat:of recognised income`;
  }

  /** `up to 50,000 → 45%`, and the open-ended last band as `above 50,000`. */
  protected dbrBandRows(p: BankProgramResponse): string[] {
    return (p.eligibility.dbrBands ?? []).map((band) =>
      band.upToIncomeEGP === null
        ? $localize`:@@bpd.dbr.band_open:above the last band → ${band.capPercent}:cap:%`
        : `${this.money(band.upToIncomeEGP)} → ${band.capPercent}%`,
    );
  }

  /**
   * `Salaried → 50%`. The keys are the engine's COARSE buckets, not the questionnaire's own
   * employment vocabulary, so they are humanised rather than looked up in the registry —
   * `employment_type` holds the detailed list and would resolve none of them.
   */
  protected dbrByEmploymentRows(p: BankProgramResponse): string[] {
    return Object.entries(p.eligibility.dbrCapPercentByEmploymentType ?? {}).map(
      ([bucket, cap]) => `${this.humanKey(bucket)} → ${cap}%`,
    );
  }

  /** The self-employed age window, only when this bank states one of its own. */
  protected selfEmployedAge(p: BankProgramResponse): string | null {
    const min = p.eligibility.ageMinSelfEmployed;
    const max = p.eligibility.ageMaxSelfEmployed;
    if (min === undefined && max === undefined) return null;
    return `${min ?? p.eligibility.ageMin}–${max ?? p.eligibility.ageMax}`;
  }

  /** `3–5%` when the bank states a spread over its index; nothing when it does not. */
  protected spreadRange(p: BankProgramResponse): string | null {
    const min = p.pricing.spreadMinPercent;
    const max = p.pricing.spreadMaxPercent;
    if (!min && !max) return null;
    return min && max ? `${min}–${max}%` : `${min ?? max}%`;
  }

  /**
   * The requirements this bank turned ON, in the wizard's own words (one wording, two
   * screens). Only the true ones: a grid of eleven "No"s is a list of everything the
   * program is not, which is read by nobody.
   */
  protected requirementLabels(p: BankProgramResponse): string[] {
    const e = p.eligibility;
    const flags: Array<[boolean, string]> = [
      [e.requiresCD, $localize`:@@bank_programs.flag.requires_cd:Requires CD`],
      [
        e.requiresAutoLoanAtABK,
        $localize`:@@bank_programs.flag.requires_auto_abk:Requires auto loan at ABK`,
      ],
      [
        e.requiresAutoLoanAtOtherBank,
        $localize`:@@bank_programs.flag.requires_auto_other:Requires auto loan at another bank`,
      ],
      [
        e.requiresCreditCardAtOtherBank,
        $localize`:@@bank_programs.flag.requires_cc_other:Requires credit card at another bank`,
      ],
      [
        e.requiresCompoundProperty,
        $localize`:@@bank_programs.flag.requires_compound:Requires compound property`,
      ],
      [
        e.requiresCollateral,
        $localize`:@@bank_programs.flag.requires_collateral:Requires collateral`,
      ],
      [
        e.requiresClubMembership,
        $localize`:@@bank_programs.flag.requires_club:Requires club membership`,
      ],
      [
        e.requiresExistingLoan,
        $localize`:@@bank_programs.flag.requires_existing_loan:Requires existing loan (buyout)`,
      ],
      [
        e.requiresFRMUVerification,
        $localize`:@@bank_programs.flag.requires_frmu:Requires FRMU verification`,
      ],
      [
        e.requiresQualitativeReview,
        $localize`:@@bank_programs.flag.requires_qr:Requires qualitative review (unlocks uplift)`,
      ],
      [
        e.requiresNoDocuments,
        $localize`:@@bank_programs.flag.requires_no_docs:No-documents lending tier`,
      ],
    ];
    return flags.filter(([on]) => on).map(([, label]) => label);
  }

  /** The money and holding gates a bank states beside the income floor, when it states any. */
  protected wealthGateRows(p: BankProgramResponse): Array<{ label: string; value: string }> {
    const e = p.eligibility;
    const rows: Array<{ label: string; value: string }> = [];
    if (e.minBankStatementBalanceEGP) {
      rows.push({
        label: $localize`:@@bpd.gate.bank_statement:Bank-statement balance`,
        value: `${this.money(e.minBankStatementBalanceEGP)} ${this.egpLabel}`,
      });
    }
    if (e.minAssetsValueEGP) {
      rows.push({
        label: $localize`:@@bpd.gate.assets:Assets`,
        value: `${this.money(e.minAssetsValueEGP)} ${this.egpLabel}`,
      });
    }
    if (e.eligibleCarPriceMinEGP) {
      rows.push({
        label: $localize`:@@bpd.gate.car_price:Car price`,
        value: `${this.money(e.eligibleCarPriceMinEGP)} ${this.egpLabel}`,
      });
    }
    if (e.eligibleDownPaymentPercent) {
      rows.push({
        label: $localize`:@@bpd.gate.down_payment:Down payment`,
        value: `${e.eligibleDownPaymentPercent}%`,
      });
    }
    if (e.minimumCreditCardHoldingMonths !== undefined) {
      rows.push({
        label: $localize`:@@bpd.gate.card_holding:Card held for`,
        value: `${e.minimumCreditCardHoldingMonths} ${this.monthsLabel}`,
      });
    }
    return rows;
  }

  /**
   * One block per rate table the bank filled — `Salaried → 24%`.
   *
   * The cascade is what a bank actually prices off; a single base rate on this page said
   * "everyone pays 30%" about a program that charges eight different rates.
   */
  protected rateTables(p: BankProgramResponse): Array<{ label: string; rows: string[] }> {
    const pr = p.pricing;
    const axes: Array<[RateBandMap | undefined, string, EnumerationType | null]> = [
      [
        pr.rateByEmploymentType,
        $localize`:@@bpd.rate.by_employment:Rate by employment`,
        'employment_type',
      ],
      [
        pr.rateByTransferType,
        $localize`:@@bpd.rate.by_transfer:Rate by salary transfer`,
        'transfer_type',
      ],
      [pr.rateBySeniority, $localize`:@@bpd.rate.by_seniority:Rate by seniority`, null],
      [pr.rateByTenor, $localize`:@@bpd.rate.by_tenor:Rate by term`, null],
      [
        pr.rateByTenorAndCustomerType,
        $localize`:@@bpd.rate.by_tenor_customer:Rate by term and customer`,
        null,
      ],
      [
        pr.rateByDownPaymentPercent,
        $localize`:@@bpd.rate.by_down_payment:Rate by down payment`,
        null,
      ],
      [pr.rateByAssetValueBand, $localize`:@@bpd.rate.by_asset:Rate by asset value`, null],
      [pr.rateByLoanAmountBand, $localize`:@@bpd.rate.by_amount:Rate by loan amount`, null],
    ];
    return axes.flatMap(([map, label, registry]) => {
      const entries = Object.entries(map ?? {});
      if (entries.length === 0) return [];
      return [
        {
          label,
          rows: entries.map(
            ([key, band]) =>
              `${registry ? this.enumLabel(registry, key) : this.humanKey(key)} → ${band.value}%`,
          ),
        },
      ];
    });
  }

  /** The fee and insurance waivers, each row shown only when this bank stated it. */
  protected waiverRows(p: BankProgramResponse): Array<{ label: string; value: string }> {
    const pr = p.pricing;
    const rows: Array<{ label: string; value: string }> = [];
    if (pr.feeWaiverEnabledAtRatePercent) {
      rows.push({
        label: $localize`:@@bpd.waiver.enabled_at:Fee waived at`,
        value: `${pr.feeWaiverEnabledAtRatePercent}%`,
      });
    }
    if (pr.feeWaiverMinTenorMonths !== undefined) {
      rows.push({
        label: $localize`:@@bpd.waiver.min_tenor:Waiver needs a term of`,
        value: `${pr.feeWaiverMinTenorMonths} ${this.monthsLabel}`,
      });
    }
    if (pr.feeWaiverPenaltyRatePercent) {
      rows.push({
        label: $localize`:@@bpd.waiver.penalty:Rate without the waiver`,
        value: `${pr.feeWaiverPenaltyRatePercent}%`,
      });
    }
    if (pr.feeWaiverPenaltyMinTenorMonths !== undefined) {
      rows.push({
        label: $localize`:@@bpd.waiver.penalty_tenor:Applied below a term of`,
        value: `${pr.feeWaiverPenaltyMinTenorMonths} ${this.monthsLabel}`,
      });
    }
    if (pr.insuranceWaiverPenaltyRatePercent) {
      rows.push({
        label: $localize`:@@bpd.waiver.insurance_penalty:Rate without life cover`,
        value: `${pr.insuranceWaiverPenaltyRatePercent}%`,
      });
    }
    return rows;
  }

  /**
   * Whether the loan-limits card has anything the key-terms rail does not already say.
   *
   * On a program that states only a floor and a ceiling the card held one row repeating
   * the strip at the top of the page, which reads as a card somebody forgot to fill in.
   */
  protected hasLimitDetail(p: BankProgramResponse): boolean {
    return (
      this.limitRows(p).length > 0 ||
      this.capRows(p).length > 0 ||
      this.capAdjustmentRows(p).length > 0 ||
      this.capAxisTables(p).length > 0 ||
      this.tenorByEmploymentRows(p).length > 0
    );
  }

  /** The limits beside the plain min/max — a top-up ceiling, an LTV, a down payment. */
  protected limitRows(p: BankProgramResponse): Array<{ label: string; value: string }> {
    const l = p.loanLimits;
    const rows: Array<{ label: string; value: string }> = [];
    if (l.maxTopUpEGP) {
      rows.push({
        label: $localize`:@@bpd.limit.top_up:Top-up ceiling`,
        value: `${this.money(l.maxTopUpEGP)} ${this.egpLabel}`,
      });
    }
    if (l.qualitativeReviewMaxEGP) {
      rows.push({
        label: $localize`:@@bank_programs.detail.qr_max:Uplift ceiling (qualitative review)`,
        value: `${this.money(l.qualitativeReviewMaxEGP)} ${this.egpLabel}`,
      });
    }
    if (l.otherCitiesMaxEGP) {
      rows.push({
        label: $localize`:@@bpd.limit.other_cities:Ceiling outside the main cities`,
        value: `${this.money(l.otherCitiesMaxEGP)} ${this.egpLabel}`,
      });
    }
    if (l.ltvCeilingPercent) {
      rows.push({
        label: $localize`:@@bank_programs.field.max_ltv:Maximum LTV`,
        value: `${l.ltvCeilingPercent}%`,
      });
    }
    if (l.minDownPaymentPercent) {
      rows.push({
        label: $localize`:@@bank_programs.field.min_down_payment:Minimum down payment`,
        value: `${l.minDownPaymentPercent}%`,
      });
    }
    return rows;
  }

  /** The fixed maximum axes that predate `maxLoanByFact` and are still stored by nine sheets. */
  protected capAxisTables(p: BankProgramResponse): Array<{ label: string; rows: string[] }> {
    const l = p.loanLimits;
    const out: Array<{ label: string; rows: string[] }> = [];
    const push = (
      map: Record<string, string> | undefined,
      label: string,
      registry: EnumerationType | null,
    ): void => {
      const entries = Object.entries(map ?? {});
      if (entries.length === 0) return;
      out.push({
        label,
        rows: entries.map(
          ([key, amount]) =>
            `${registry ? this.enumLabel(registry, key) : this.humanKey(key)} → ${this.money(amount)}`,
        ),
      });
    };
    push(
      l.maxByEmploymentType,
      $localize`:@@bpd.cap.by_employment:Maximum by employment`,
      'employment_type',
    );
    push(
      l.maxByTransferType,
      $localize`:@@bpd.cap.by_transfer:Maximum by salary transfer`,
      'transfer_type',
    );
    push(
      l.maxByPropertyType,
      $localize`:@@bpd.cap.by_property:Maximum by property`,
      'property_type',
    );
    if ((l.maxByCDTier ?? []).length > 0) {
      out.push({
        label: $localize`:@@bpd.cap.by_cd:Maximum by certificate value`,
        rows: (l.maxByCDTier ?? []).map(
          (tier) => `${this.money(tier.minCDValueEGP)}+ → ${this.money(tier.maxAmountEGP)}`,
        ),
      });
    }
    return out;
  }

  /** `Salaried → 96 months`, when the bank shortens the term for some employment types. */
  protected tenorByEmploymentRows(p: BankProgramResponse): string[] {
    return Object.entries(p.tenor.maxMonthsByEmploymentType ?? {}).map(
      ([key, months]) => `${this.enumLabel('employment_type', key)} → ${months}`,
    );
  }

  /** Whose figures the income tables are — this bank's own, or the catalog name's. */
  protected figuresOwnerLabel(p: BankProgramResponse): string {
    return p.incomeAssumption.amounts === 'catalog'
      ? $localize`:@@bpd.figures.catalog:The catalog name’s, shared with every bank on it`
      : $localize`:@@bpd.figures.own:This bank’s own`;
  }

  /**
   * The money counted beside the basic figure, at this bank's weight per source.
   *
   * Each row says whether its percentage is a team ESTIMATE, because an estimate blocks
   * activation and must not read as an equal of a bank-stated one.
   */
  protected additionalIncomeRows(
    p: BankProgramResponse,
  ): Array<{ label: string; percent: string; estimated: boolean }> {
    const sources = p.valueSources ?? {};
    return (p.incomeAssumption.additionalIncome?.sources ?? []).map((source, i) => ({
      label: this.enumLabel('surrogate_fact', source.factKey),
      percent: source.percent,
      estimated:
        sources[`incomeAssumption.additionalIncome.sources.${i}.percent`] === 'team_estimated',
    }));
  }

  /** The ceiling on that other income, as a share of the basic figure. */
  protected additionalIncomeCap(p: BankProgramResponse): string | null {
    return p.incomeAssumption.additionalIncome?.capPercentOfBasic ?? null;
  }

  /** Every fee this bank charges, with the ones it left blank omitted rather than zeroed. */
  protected feeRows(p: BankProgramResponse): Array<{ label: string; value: string }> {
    const f = p.fees;
    const rows: Array<{ label: string; value: string }> = [
      {
        label: $localize`:@@bank_programs.field.admin_fee:Admin fee`,
        value:
          f.adminFeeDisplay ??
          this.percentRange(f.adminFeePercent, f.adminFeeRangeMin, f.adminFeeRangeMax),
      },
      {
        label: $localize`:@@bank_programs.field.stamp_duty:Stamp duty`,
        value: `${f.stampDutyPercent}%`,
      },
      {
        label: f.lifeInsuranceMandatory
          ? $localize`:@@bpd.fee.life_mandatory:Life insurance (mandatory)`
          : $localize`:@@bank_programs.field.life_insurance_pct:Life insurance`,
        value: `${f.lifeInsurancePercent}%`,
      },
      {
        label: $localize`:@@bpd.fee.late_payment:Late payment`,
        value: `${f.latePaymentFeePercent}%`,
      },
      {
        label: $localize`:@@bpd.fee.payoff_cash:Early settlement — cash`,
        value: `${f.payoffCashPercent}%`,
      },
      {
        label: $localize`:@@bpd.fee.payoff_buyout:Early settlement — buyout`,
        value: `${f.payoffBuyoutPercent}%`,
      },
    ];
    if (f.lifeInsuranceMinLoanEGP) {
      rows.push({
        label: $localize`:@@bpd.fee.life_min_loan:Life cover starts at`,
        value: `${this.money(f.lifeInsuranceMinLoanEGP)} ${this.egpLabel}`,
      });
    }
    if (f.collateralReplacementFeeEGP) {
      rows.push({
        label: $localize`:@@bpd.fee.collateral_replace:Replacing the collateral`,
        value: `${this.money(f.collateralReplacementFeeEGP)} ${this.egpLabel}`,
      });
    }
    if (f.collateralDecreaseFeeEGP) {
      rows.push({
        label: $localize`:@@bpd.fee.collateral_decrease:Reducing the collateral`,
        value: `${this.money(f.collateralDecreaseFeeEGP)} ${this.egpLabel}`,
      });
    }
    return rows;
  }

  /**
   * What the bank asks of the applicant's credit history.
   *
   * An all-default block renders nothing: "0 months on book, no I-Score check" is the
   * absence of a policy, and a card stating it would read as one.
   */
  protected performanceRows(p: BankProgramResponse): Array<{ label: string; value: string }> {
    const c = p.performanceCriteria;
    if (!c) return [];
    const rows: Array<{ label: string; value: string }> = [];
    if (c.requiredMOBMonths > 0) {
      rows.push({
        label: $localize`:@@bpd.perf.mob:Months on book`,
        value: `${c.requiredMOBMonths}`,
      });
    }
    if (c.iScoreMOBPerformanceCheck) {
      rows.push({
        label: $localize`:@@bpd.perf.iscore:I-Score performance check`,
        value: this.yesLabel,
      });
    }
    if (c.bkt1NoHitWithinMonths !== undefined) {
      rows.push({
        label: $localize`:@@bpd.perf.bkt1:No 30-day arrears within`,
        value: `${c.bkt1NoHitWithinMonths} ${this.monthsLabel}`,
      });
    }
    if (c.bkt2NoHitWithinMonths !== undefined) {
      rows.push({
        label: $localize`:@@bpd.perf.bkt2:No 60-day arrears within`,
        value: `${c.bkt2NoHitWithinMonths} ${this.monthsLabel}`,
      });
    }
    if (c.requireCurrentLoanStatus) {
      rows.push({
        label: $localize`:@@bpd.perf.current:Every live loan current`,
        value: this.yesLabel,
      });
    }
    return rows;
  }

  /** The desk notes, one paragraph per line the operator typed. */
  protected noteLines(p: BankProgramResponse): string[] {
    return (p.operatorNotes ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /** Which figures on this program are the team's estimate rather than the bank's own. */
  protected estimatedPaths(p: BankProgramResponse): string[] {
    return Object.entries(p.valueSources ?? {})
      .filter(([, source]) => source === 'team_estimated')
      .map(([path]) => path);
  }

  /**
   * A registry key → the label an operator reads, in their own locale.
   *
   * Falls back to the key itself: a program pointing at a value somebody retired still has
   * to render, and the raw key is what every other admin surface addresses that row by.
   */
  protected enumLabel(type: EnumerationType, key: string): string {
    const member = this.enums
      .membersFor(type)()
      .find((m) => m.key === key);
    if (!member) return this.humanKey(key);
    return this.localeIsAr ? member.labelAr : member.labelEn;
  }

  /** The same, for a list — the order the bank stored, never re-sorted. */
  protected enumLabels(type: EnumerationType, keys: readonly string[]): string[] {
    return keys.map((k) => this.enumLabel(type, k));
  }

  /** `top_up` → `Top up`, for the keys no registry owns (rate bands, coarse buckets). */
  private humanKey(key: string): string {
    const spaced = key.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  /** `2.5%`, or `1–3%` when the bank states a range around it. */
  private percentRange(base: string, min?: string, max?: string): string {
    if (min && max) return `${min}–${max}%`;
    return `${base}%`;
  }

  protected readonly yesLabel = $localize`:@@bpd.value.yes:Yes`;
  protected readonly noLabel = $localize`:@@bpd.value.no:No`;
  private readonly egpLabel = $localize`:@@bpd.unit.egp:EGP`;
  private readonly monthsLabel = $localize`:@@bpd.unit.months:months`;

  /**
   * The program's maximum-loan table, flattened one row per cell.
   *
   * The label carries the column when there is one: the same row key appears twice in a
   * two-column table (a villa on a new loan and a villa on a top-up), and a bare row key
   * could not tell the two figures apart.
   */
  protected capRows(p: BankProgramResponse): Array<{ label: string; amount: string }> {
    const table = p.loanLimits.maxLoanByFact;
    if (!table) return [];
    return table.rows.map((row) => {
      // A numeric fact keys its rows by a half-open band, a choice fact by an option code.
      // An open-ended last band is the normal case, not a missing value.
      const key =
        row.rowKey ??
        (row.toExclusive === null || row.toExclusive === undefined
          ? `${row.fromInclusive ?? '0'}+`
          : `${row.fromInclusive ?? '0'}–${row.toExclusive}`);
      const rowLabel = row.rowKey === undefined ? key : this.humanKey(key);
      return {
        label:
          row.columnKey === undefined ? rowLabel : `${rowLabel} · ${this.humanKey(row.columnKey)}`,
        amount: row.maxAmountEGP,
      };
    });
  }

  /** Whether either axis of the cap table is keyed by a CLASS rather than by the answer. */
  protected capIsClassKeyed(p: BankProgramResponse): boolean {
    const table = p.loanLimits.maxLoanByFact;
    return table?.rowVia === 'parentClass' || table?.columnVia === 'parentClass';
  }

  /** `+10% when they own more than one unit` — kind, figure, and the answer that switches it on. */
  protected capAdjustmentRows(p: BankProgramResponse): string[] {
    return (p.loanLimits.maxLoanAdjustments ?? []).map(
      (adjustment) =>
        `${adjustment.kind === 'upliftPercent' ? '+' : ''}${adjustment.percent}% · ` +
        `${this.humanKey(adjustment.whenFactKey)}: ${this.humanKey(adjustment.whenOptionCode)}`,
    );
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
    // Reactive fetch. The registries are fetched beside it rather than awaited: a label
    // that has not landed falls back to its key, so the page renders either way.
    queueMicrotask(() => this.load());
    void this.enums.preload([
      'employment_type',
      'transfer_type',
      'property_type',
      'required_document',
      'surrogate_fact',
      'program_name',
    ]);
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
