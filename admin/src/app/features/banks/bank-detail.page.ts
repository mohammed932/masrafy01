import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { openFormDrawer } from '@shared/ui';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  ClockCircleOutline,
  AppstoreOutline,
  ArrowLeftOutline,
  BankOutline,
  CarOutline,
  CheckCircleOutline,
  CopyOutline,
  DeleteOutline,
  EditOutline,
  HomeOutline,
  PauseCircleOutline,
  PlusOutline,
  RightOutline,
  ShopOutline,
  UserOutline,
} from '@ant-design/icons-angular/icons';
import { CanDirective } from '../../shared/can.directive';
import {
  LOAN_CATEGORIES,
  categoryLabel,
  isLoanCategory,
  type LoanCategory,
} from '@core/loan-category';
import { basisOf, incomeBasisLabel, type ProgramType } from '@core/income-basis';
import { ErrorCodeService } from '../../core/errors/error-code.service';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';
import {
  DeleteProgramDialog,
  type DeleteProgramDialogData,
} from '../bank-programs/delete/delete-program.dialog';
import { BanksApiService } from './banks.api.service';
import {
  BankFormDrawer,
  type BankFormDrawerData,
  type BankFormDrawerResult,
} from './bank-form.drawer';
import type { BankProgramSummary, BankWithProgramCount } from './banks.types';
import { splitByBasis, type BasisGroupKey } from './basis-groups';

/**
 * One income-basis group inside a category section (v24.1.0).
 *
 * `unknown` is a real member, not a defensive branch: `programType` is optional on the
 * wire, and a program the backend said nothing about must not be filed under "Income
 * proof" — that would state a fact nobody sent, on the riskier side of the pair.
 */
interface BasisGroup {
  key: BasisGroupKey;
  label: string;
  /** One line saying what the bank reads. `null` for the unknown group — nothing to say. */
  hint: string | null;
  items: BankProgramSummary[];
}

/** One category accordion section on the bank-detail programs list. */
interface ProgramSection {
  cat: LoanCategory | 'other';
  label: string;
  items: BankProgramSummary[];
  /** The same programs, split by income basis. Empty groups are absent, never rendered. */
  basisGroups: BasisGroup[];
}

/** One glass KPI cell in the command bar's rail (Total / Active / Inactive). */
interface KpiItem {
  label: string;
  value: number;
  hint: string;
  tone?: 'success' | 'warning' | 'muted';
}

/** One segment of the portfolio-mix bar + its legend entry. */
interface MixSegment {
  cat: LoanCategory | 'other';
  label: string;
  count: number;
  /** CSS custom-property reference, e.g. `var(--color-cat-personal)`. */
  colorVar: string;
}

/** Portfolio-health summary driving the donut ring. */
interface PortfolioHealth {
  pct: number;
  active: number;
  total: number;
}

/**
 * Bank detail — drill-down target of the registry (`/banks/:bankId`).
 *
 * Holds the bank's header (logo, names, edit/toggle/delete) + the list of
 * programs belonging to this bank. Programs are reached only by drilling into
 * their bank; there is no flat cross-bank list. Row actions reuse the existing
 * Delete program dialog and the bank-program toggle endpoint verbatim.
 */
@Component({
  selector: 'app-bank-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzCollapseModule,
    NzIconModule,
    NzSpinModule,
    NzSwitchModule,
    NzToolTipModule,
    CanDirective,
  ],
  providers: [
    provideNzIconsPatch([
      ClockCircleOutline,
      ArrowLeftOutline,
      EditOutline,
      DeleteOutline,
      PlusOutline,
      CopyOutline,
      RightOutline,
      AppstoreOutline,
      BankOutline,
      CarOutline,
      CheckCircleOutline,
      HomeOutline,
      PauseCircleOutline,
      ShopOutline,
      UserOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <a routerLink="/banks" class="back">
        <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@bank_detail.back">Banks</span>
      </a>

      @if (loading() && !bank()) {
        <div class="loading" aria-busy="true">
          <nz-spin nzSimple />
        </div>
      } @else {
        @if (bank(); as b) {
          <!-- Command bar: hero identity + glass KPI rail fused on one gradient surface. -->
          <section class="command">
            <div class="cmd-top">
              <span class="logo">
                @if (b.logoS3Key) {
                  <img [src]="logoUrl(b)" alt="" class="logo-img" />
                } @else {
                  <span class="logo-fallback">{{ initialsOf(b.nameEnglish) }}</span>
                }
              </span>

              <div class="cmd-id">
                <span class="eyebrow" i18n="@@bank_detail.eyebrow">Bank partner</span>
                <h1 class="bank-name">
                  {{ b.nameEnglish }}
                  @if (b.isFeatured) {
                    <span
                      class="featured-chip"
                      nz-tooltip
                      i18n-nzTooltipTitle="@@banks.featured.tooltip"
                      nzTooltipTitle="Featured partner — boosted in mobile ranking ties"
                      >★ Featured</span
                    >
                  }
                </h1>
                @if (b.nameArabic) {
                  <p class="ar" dir="rtl">{{ b.nameArabic }}</p>
                }
              </div>

              <div class="cmd-actions">
                <label *can="['super_admin']" class="active-toggle">
                  <nz-switch [formControl]="bankActiveControl"></nz-switch>
                  <span i18n="@@bank_detail.active">Active</span>
                </label>
                <span *can="['sales_manager', 'sales_agent', 'analyst']" class="status">
                  @if (bank()!.isActive) {
                    <span i18n="@@bank_detail.status.active">Active</span>
                  } @else {
                    <span i18n="@@bank_detail.status.inactive">Inactive</span>
                  }
                </span>
                <button
                  *can="['super_admin']"
                  nz-button
                  nzType="default"
                  (click)="openEditBank(bank()!)"
                >
                  <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@bank_detail.edit">Edit bank</span>
                </button>
                <button
                  *can="['super_admin']"
                  nz-button
                  nzType="text"
                  nzShape="circle"
                  nz-tooltip
                  i18n-nzTooltipTitle="@@bank_detail.delete"
                  nzTooltipTitle="Delete bank"
                  (click)="onDeleteBank(bank()!)"
                >
                  <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                </button>
              </div>
            </div>

            <dl
              class="kpi-rail"
              aria-label="Bank program statistics"
              i18n-aria-label="@@bank_detail.stats.aria"
            >
              @for (k of stats(); track k.label) {
                <div class="kpi" [attr.data-tone]="k.tone ?? 'default'">
                  <dt class="kpi-label">{{ k.label }}</dt>
                  <dd class="kpi-num">{{ k.value }}</dd>
                  <span class="kpi-hint">{{ k.hint }}</span>
                </div>
              }
            </dl>
          </section>

          <!-- Portfolio overview: category mix + health at a glance. -->
          <div class="grid">
            <section class="panel">
              <p class="panel-h" i18n="@@bank_detail.mix.title">Portfolio mix</p>
              <div class="mix-bar" aria-hidden="true">
                @for (seg of mixSegments(); track seg.cat) {
                  @if (seg.count > 0) {
                    <span
                      class="mix-seg"
                      [style.flex-grow]="seg.count"
                      [style.background]="seg.colorVar"
                    ></span>
                  }
                }
                @if (programs().length === 0) {
                  <span class="mix-seg mix-empty" [style.flex-grow]="1"></span>
                }
              </div>
              <dl class="legend">
                @for (seg of mixSegments(); track seg.cat) {
                  <div class="leg">
                    <span
                      class="dot"
                      [style.background]="
                        seg.count > 0 ? seg.colorVar : 'var(--color-surface-muted)'
                      "
                    ></span>
                    <dt>{{ seg.label }}</dt>
                    <dd>{{ seg.count }}</dd>
                  </div>
                }
              </dl>
            </section>

            <section class="panel">
              <p class="panel-h" i18n="@@bank_detail.health.title">Portfolio health</p>
              <div class="ring-wrap">
                <div class="ring" [style.--pct]="health().pct + '%'" aria-hidden="true">
                  <span class="ring-c">
                    <span class="n">{{ health().pct }}%</span>
                    <span class="l" i18n="@@bank_detail.health.live">live</span>
                  </span>
                </div>
                <div class="ring-meta">
                  @if (health().total === 0) {
                    <p class="big" i18n="@@bank_detail.health.none">No programs yet</p>
                  } @else if (health().pct === 100) {
                    <p class="big" i18n="@@bank_detail.health.all">All programs active</p>
                  } @else {
                    <p class="big" i18n="@@bank_detail.health.some">
                      {{ health().active }} of {{ health().total }} active
                    </p>
                  }
                  <p class="sm" i18n="@@bank_detail.health.meta">
                    Active programs are visible to applicants on the marketplace.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div class="section-head">
            <h2 class="section-title" i18n="@@bank_detail.programs.title">Programs</h2>
          </div>

          @if (loadingPrograms()) {
            <div class="loading"><nz-spin nzSimple></nz-spin></div>
          } @else {
            <nz-collapse class="cat-collapse">
              @for (section of categorySections(); track section.cat; let i = $index) {
                <nz-collapse-panel
                  class="cat-panel"
                  [class.is-empty]="section.items.length === 0"
                  [style.--i]="i"
                  [style.--rail]="catColor(section.cat)"
                  [style.--cat]="catColor(section.cat)"
                  [nzActive]="section.cat === firstOpenCat()"
                  [nzHeader]="catHeaderTpl"
                  [nzExtra]="catExtraTpl"
                >
                  <ng-template #catHeaderTpl>
                    <span
                      class="cat-icon"
                      [class.muted]="section.items.length === 0"
                      aria-hidden="true"
                    >
                      <span nz-icon [nzType]="catIcon(section.cat)" nzTheme="outline"></span>
                    </span>
                    <span class="cat-heading">
                      <span class="cat-name-row">
                        <span class="cat-name">{{ section.label }}</span>
                        <span class="cat-count" [class.empty]="section.items.length === 0">{{
                          section.items.length
                        }}</span>
                      </span>
                    </span>
                  </ng-template>

                  <ng-template #catExtraTpl>
                    <a
                      *can="['super_admin', 'sales_manager']"
                      nz-button
                      nzType="link"
                      nzSize="small"
                      [routerLink]="['/banks/programs/new']"
                      [queryParams]="addQueryParams(section.cat)"
                      (click)="$event.stopPropagation()"
                    >
                      <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                      <span i18n="@@bank_detail.programs.add">Add program</span>
                    </a>
                  </ng-template>

                  @if (section.items.length === 0) {
                    <div class="cat-empty">
                      <span class="cat-empty-icon" aria-hidden="true">
                        <span nz-icon [nzType]="catIcon(section.cat)" nzTheme="outline"></span>
                      </span>
                      <span class="cat-empty-copy">
                        <span class="cat-empty-title" i18n="@@bank_detail.programs.cat_empty">
                          No {{ section.label }} programs yet
                        </span>
                        <span class="cat-empty-sub" i18n="@@bank_detail.programs.cat_empty_hint">
                          Add the first one to make it available to applicants.
                        </span>
                      </span>
                      <a
                        *can="['super_admin', 'sales_manager']"
                        class="cat-empty-cta"
                        nz-button
                        nzType="primary"
                        nzSize="small"
                        [routerLink]="['/banks/programs/new']"
                        [queryParams]="addQueryParams(section.cat)"
                      >
                        <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                        <span i18n="@@bank_detail.programs.add">Add program</span>
                      </a>
                    </div>
                  } @else {
                    <!-- Cards sit UNDER their income basis (v24.1.0): a bank desk reads
                         the two kinds differently, and a per-card tag left the operator
                         doing the sorting by eye across a grid. The heading is the
                         statement, so the card carries no basis tag of its own. Groups
                         that hold nothing are absent, so a bank selling one way only
                         sees one heading. -->
                    @for (g of section.basisGroups; track g.key) {
                      <div class="basis-group" [class.is-surrogate]="g.key === 'income_surrogate'">
                        <h4 class="basis-head" [id]="'basis-' + section.cat + '-' + g.key">
                          <span class="basis-name">{{ g.label }}</span>
                          <span class="basis-count">{{ g.items.length }}</span>
                        </h4>
                        @if (g.hint) {
                          <p class="basis-hint">{{ g.hint }}</p>
                        }
                        <ul
                          class="prog-grid"
                          [attr.aria-labelledby]="'basis-' + section.cat + '-' + g.key"
                        >
                          @for (p of g.items; track p.programCode; let j = $index) {
                            <li
                              class="prog"
                              [class.is-off]="!p.active"
                              [style.--j]="j"
                              [style.--cat]="catColor(section.cat)"
                            >
                              <a
                                class="prog-hit"
                                [routerLink]="['/banks/programs', p.programCode]"
                                [attr.aria-label]="p.friendlyName"
                              ></a>

                              <header class="prog-head">
                                <span class="prog-name">{{ p.friendlyName }}</span>
                                <!-- The card states its own basis as well as sitting under
                                     the group heading: a grid scrolls, and a card read on
                                     its own — or dragged into a screenshot — must still
                                     say which kind of program it is. Absent programType
                                     shows nothing; it must not read as "Income proof". -->
                                @if (p.programType; as type) {
                                  <span
                                    class="tag basis"
                                    [class.is-surrogate]="type === 'income_surrogate'"
                                    >{{ basisLabel(type) }}</span
                                  >
                                }
                                @if (p.isShariaCompliant) {
                                  <span
                                    class="tag sharia"
                                    nz-tooltip
                                    i18n-nzTooltipTitle="@@bank_detail.program.sharia"
                                    nzTooltipTitle="Sharia-compliant"
                                    i18n="@@bank_detail.program.sharia_short"
                                    >Islamic</span
                                  >
                                }
                              </header>

                              <dl class="specs">
                                <div class="spec">
                                  <dt i18n="@@bank_detail.spec.rate">Rate</dt>
                                  <dd class="num">
                                    {{ rateLabel(p) }}
                                    @if (p.isVariableRate) {
                                      <span class="spec-flag" i18n="@@bank_detail.spec.variable"
                                        >var.</span
                                      >
                                    }
                                  </dd>
                                </div>
                                <div class="spec">
                                  <dt i18n="@@bank_detail.spec.amount">Amount</dt>
                                  <dd class="num">{{ amountLabel(p) }}</dd>
                                </div>
                                <div class="spec">
                                  <dt i18n="@@bank_detail.spec.tenor">Tenor</dt>
                                  <dd class="num">{{ tenorLabel(p) }}</dd>
                                </div>
                              </dl>

                              <footer class="prog-foot">
                                <span class="live">
                                  <nz-switch
                                    *can="['super_admin', 'sales_manager']"
                                    nzSize="small"
                                    [formControl]="rowActiveControl(p)"
                                  ></nz-switch>
                                  <span class="live-label">
                                    @if (p.active) {
                                      <span i18n="@@bank_detail.status.active">Active</span>
                                    } @else {
                                      <span i18n="@@bank_detail.status.inactive">Inactive</span>
                                    }
                                  </span>
                                </span>
                                <span class="prog-actions">
                                  <a
                                    *can="['super_admin', 'sales_manager']"
                                    nz-button
                                    nzType="text"
                                    nzShape="circle"
                                    nzSize="small"
                                    nz-tooltip
                                    i18n-nzTooltipTitle="@@bank_detail.program.edit"
                                    nzTooltipTitle="Edit program"
                                    [routerLink]="['/banks/programs', p.programCode, 'edit']"
                                  >
                                    <span
                                      nz-icon
                                      nzType="edit"
                                      nzTheme="outline"
                                      aria-hidden="true"
                                    ></span>
                                  </a>
                                  <button
                                    *can="['super_admin', 'sales_manager']"
                                    nz-button
                                    nzType="text"
                                    nzShape="circle"
                                    nzSize="small"
                                    nz-tooltip
                                    i18n-nzTooltipTitle="@@bank_detail.program.delete"
                                    nzTooltipTitle="Delete program"
                                    (click)="openDelete(p)"
                                  >
                                    <span
                                      nz-icon
                                      nzType="delete"
                                      nzTheme="outline"
                                      aria-hidden="true"
                                    ></span>
                                  </button>
                                </span>
                              </footer>
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  }
                </nz-collapse-panel>
              }
            </nz-collapse>
          }
        } @else {
          <p class="empty-text" i18n="@@bank_detail.not_found">Bank not found.</p>
        }
      }
    </section>
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

      /* ===== Command bar — identity + KPI rail fused on one gradient ===== */
      .command {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        padding: var(--space-6);
        border-radius: var(--radius-xl);
        background: var(--gradient-hero);
        box-shadow: var(--shadow-lg);
        color: #fff;
      }
      /* Two soft radial sheens — pure white tint, no brand hex literals. */
      .command::after,
      .command::before {
        content: '';
        position: absolute;
        border-radius: 50%;
        z-index: -1;
        pointer-events: none;
      }
      .command::after {
        inset-block-start: -50%;
        inset-inline-end: -8%;
        inline-size: 380px;
        block-size: 380px;
        background: radial-gradient(
          circle,
          color-mix(in srgb, #fff 16%, transparent) 0%,
          transparent 70%
        );
      }
      .command::before {
        inset-block-end: -60%;
        inset-inline-start: -6%;
        inline-size: 300px;
        block-size: 300px;
        background: radial-gradient(
          circle,
          color-mix(in srgb, #fff 9%, transparent) 0%,
          transparent 70%
        );
      }
      .cmd-top {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-4);
      }
      .logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 68px;
        block-size: 68px;
        flex: none;
        border-radius: var(--radius-lg);
        background: var(--bg-pure);
        box-shadow: var(--shadow-md);
        overflow: hidden;
      }
      .logo-img {
        inline-size: 100%;
        block-size: 100%;
        object-fit: contain;
      }
      .logo-fallback {
        font-weight: var(--font-weight-bold);
        font-size: var(--text-2xl);
        color: var(--color-brand-primary);
      }
      .cmd-id {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .eyebrow {
        display: block;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: color-mix(in srgb, #fff 78%, transparent);
      }
      .bank-name {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: var(--space-1) 0 0;
        font-family: var(--font-display);
        font-size: var(--text-3xl);
        font-weight: var(--font-weight-bold);
        line-height: var(--line-height-tight);
        letter-spacing: var(--tracking-tight);
        color: #fff;
      }
      .ar {
        margin: var(--space-1) 0 0;
        color: color-mix(in srgb, #fff 80%, transparent);
        font-size: var(--text-sm);
      }
      .featured-chip {
        display: inline-flex;
        align-items: center;
        padding: 2px var(--space-2-5);
        background: color-mix(in srgb, #fff 22%, transparent);
        color: #fff;
        border-radius: var(--radius-pill);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        backdrop-filter: blur(6px);
      }
      .cmd-actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
        flex: none;
      }
      /* Glass treatment so controls read on the gradient (no gray-on-color). */
      .cmd-actions ::ng-deep .ant-btn-default {
        background: color-mix(in srgb, #fff 16%, transparent);
        border-color: color-mix(in srgb, #fff 32%, transparent);
        color: #fff;
        backdrop-filter: blur(6px);
      }
      .cmd-actions ::ng-deep .ant-btn-default:hover {
        background: color-mix(in srgb, #fff 26%, transparent);
        border-color: color-mix(in srgb, #fff 48%, transparent);
        color: #fff;
      }
      .cmd-actions ::ng-deep .ant-btn-text {
        color: color-mix(in srgb, #fff 88%, transparent);
      }
      .cmd-actions ::ng-deep .ant-btn-text:hover {
        background: color-mix(in srgb, #fff 18%, transparent);
        color: #fff;
      }
      .active-toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, #fff 16%, transparent);
        backdrop-filter: blur(6px);
        font-size: var(--text-sm);
        color: #fff;
        cursor: pointer;
      }
      .status {
        font-size: var(--text-sm);
        color: color-mix(in srgb, #fff 82%, transparent);
      }
      /* KPI rail inside the command bar — glass cells over the gradient. */
      .kpi-rail {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1px;
        margin: var(--space-5) 0 0;
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: color-mix(in srgb, #fff 18%, transparent);
      }
      .kpi {
        padding: var(--space-4) var(--space-5);
        background: color-mix(in srgb, #fff 10%, transparent);
        backdrop-filter: blur(4px);
      }
      .kpi-label {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: color-mix(in srgb, #fff 78%, transparent);
      }
      .kpi-num {
        margin: var(--space-2) 0 0;
        font-size: var(--text-3xl);
        font-weight: var(--font-weight-bold);
        line-height: 1;
        color: #fff;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .kpi[data-tone='success'] .kpi-num {
        color: color-mix(in srgb, #fff 92%, transparent);
      }
      .kpi-hint {
        display: block;
        margin-block-start: var(--space-2);
        font-size: var(--text-xs);
        color: color-mix(in srgb, #fff 72%, transparent);
      }
      @media (max-width: 760px) {
        .cmd-actions {
          flex-basis: 100%;
          flex-wrap: wrap;
        }
        .kpi-rail {
          grid-template-columns: 1fr;
        }
      }

      /* ===== Portfolio overview panels ===== */
      .grid {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: var(--space-5);
        margin-block: var(--space-5);
      }
      @media (max-width: 760px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      .panel {
        padding: var(--space-5);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        transition:
          transform var(--motion-duration-base) cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow var(--motion-duration-base) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .panel:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      .panel-h {
        margin: 0 0 var(--space-4);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .mix-bar {
        display: flex;
        gap: 2px;
        block-size: 14px;
        border-radius: var(--radius-pill);
        overflow: hidden;
      }
      .mix-seg {
        block-size: 100%;
      }
      .mix-empty {
        background: var(--color-surface-muted);
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3) var(--space-5);
        margin: var(--space-4) 0 0;
      }
      .leg {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .leg dt {
        margin: 0;
      }
      .leg dd {
        margin: 0;
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .dot {
        inline-size: 10px;
        block-size: 10px;
        border-radius: var(--radius-sm);
        flex: none;
      }
      /* Health donut — conic ring around a punched-out center. */
      .ring-wrap {
        display: flex;
        align-items: center;
        gap: var(--space-5);
      }
      .ring {
        position: relative;
        inline-size: 108px;
        block-size: 108px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: conic-gradient(
          var(--color-success) var(--pct, 0%),
          var(--color-surface-muted) 0
        );
      }
      .ring::before {
        content: '';
        position: absolute;
        inset: 12px;
        border-radius: 50%;
        background: var(--color-surface-default);
      }
      .ring-c {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        line-height: 1;
      }
      .ring-c .n {
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-success);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .ring-c .l {
        margin-block-start: var(--space-1);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .ring-meta .big {
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .ring-meta .sm {
        margin: var(--space-2) 0 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }

      /* ===== Programs section ===== */
      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-block-end: var(--space-4);
      }
      .section-title {
        margin: 0;
        font-family: var(--font-display);
        font-size: var(--text-xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }
      .cat-collapse {
        background: transparent;
        border: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      /* Each category is its own card with a per-category color rail. */
      .cat-panel {
        position: relative;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
        opacity: 0;
        transform: translateY(8px);
        animation: cat-rise var(--motion-duration-slow) cubic-bezier(0.4, 0, 0.2, 1) forwards;
        animation-delay: calc(var(--i, 0) * 50ms);
        transition:
          box-shadow var(--motion-duration-base) cubic-bezier(0.4, 0, 0.2, 1),
          border-color var(--motion-duration-base) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .cat-panel:hover {
        box-shadow: var(--shadow-md);
        border-color: color-mix(in srgb, var(--rail, var(--color-brand-primary)) 40%, transparent);
      }
      .cat-panel::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 4px;
        background: var(--rail, var(--color-brand-primary));
        z-index: 1;
      }
      .cat-panel.is-empty {
        --rail: var(--color-border-default);
      }
      @keyframes cat-rise {
        to {
          opacity: 1;
          transform: none;
        }
      }
      /* Faint category-hue wash so each header carries its own identity. */
      .cat-collapse ::ng-deep .ant-collapse-header {
        align-items: center;
        padding-inline-start: var(--space-5);
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--rail, var(--color-brand-primary)) 8%, transparent),
          transparent 60%
        );
      }
      .cat-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 42px;
        block-size: 42px;
        margin-inline-end: var(--space-3);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--rail, var(--color-brand-primary)) 12%, transparent);
        color: var(--rail, var(--color-brand-primary));
        font-size: var(--text-lg);
        flex: none;
      }
      .cat-icon.muted {
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
      }
      .cat-heading {
        display: inline-flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 160px;
        flex: 1 1 auto;
      }
      .cat-name-row {
        display: inline-flex;
        align-items: center;
      }
      .cat-name {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .cat-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-inline-size: 22px;
        block-size: 20px;
        margin-inline-start: var(--space-2);
        padding-inline: var(--space-2);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--rail, var(--color-brand-primary)) 14%, transparent);
        color: var(--rail, var(--color-brand-primary));
        font-size: var(--text-xs);
        font-weight: var(--font-weight-bold);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .cat-count.empty {
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
      }
      /* Compact single-row empty state — no dead vertical space, no hatch texture. */
      .cat-empty {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        margin: 0 var(--space-5) var(--space-5);
        padding: var(--space-4) var(--space-5);
        border: 1px dashed
          color-mix(
            in srgb,
            var(--cat, var(--color-brand-primary)) 28%,
            var(--color-border-default)
          );
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--cat, var(--color-brand-primary)) 4%, transparent);
      }
      .cat-empty-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 40px;
        block-size: 40px;
        flex: none;
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--cat, var(--color-brand-primary)) 12%, transparent);
        color: var(--cat, var(--color-brand-primary));
        font-size: var(--text-lg);
      }
      .cat-empty-copy {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .cat-empty-title {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
      }
      .cat-empty-sub {
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
      }
      .cat-empty-cta {
        flex: none;
      }
      @media (max-width: 560px) {
        .cat-empty {
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .cat-empty-cta {
          inline-size: 100%;
        }
      }
      /* ===== Program shelf — one card per program, specs on the face ===== */
      .prog-grid {
        list-style: none;
        margin: 0 var(--space-5) var(--space-5);
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--space-3);
      }
      .prog {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
        opacity: 0;
        transform: translateY(6px);
        animation: cat-rise var(--motion-duration-base) var(--motion-easing-standard) forwards;
        animation-delay: calc(var(--j, 0) * var(--motion-stagger));
        transition:
          box-shadow var(--motion-duration-base) var(--motion-easing-standard),
          border-color var(--motion-duration-base) var(--motion-easing-standard),
          transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      /* Category hue arrives on hover only, so a dense grid stays calm at rest. */
      .prog:hover,
      .prog:focus-within {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: color-mix(in srgb, var(--cat, var(--color-brand-primary)) 45%, transparent);
      }
      .prog.is-off {
        background: var(--color-surface-muted);
      }
      .prog.is-off .prog-name {
        color: var(--color-text-secondary);
      }
      /* Whole card is the link target; controls above it stay clickable. */
      .prog-hit {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        z-index: 0;
      }
      .prog-hit:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .prog-head,
      .specs,
      .prog-foot {
        position: relative;
        z-index: 1;
        pointer-events: none;
      }
      /* Re-armed above the card-wide link: controls must stay clickable. */
      .prog-foot,
      .prog-head .tag {
        pointer-events: auto;
      }
      .prog-head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .prog-name {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tag.sharia {
        flex: none;
        padding: 1px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-success-bg);
        color: var(--color-success);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      /* Same anatomy as the Islamic tag: the two say different KINDS of thing about a
         program and must not be told apart only by position. Neutral by default — the
         tag is on every card, and two accents per row would leave the card with no
         quiet ground. The surrogate case keeps the plum the whole no-payslip surface is
         accented with, matching its group heading. */
      .tag.basis {
        flex: none;
        padding: 1px var(--space-2);
        /* Hairline on BOTH variants (transparent on the accented one) so the two tags are
           the same height in one row. The neutral chip needs it: an inactive card's own
           ground is the muted surface, where a fill-only chip disappears. */
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      /* No tooltip on this one, so it must not re-arm pointer events the way the Islamic
         tag does — a dead spot in the middle of the card-wide link is worse than a chip
         that cannot be hovered. */
      .prog-head .tag.basis {
        pointer-events: none;
      }
      .tag.basis.is-surrogate {
        border-color: transparent;
        background: var(--color-income-surrogate-bg);
        color: var(--color-income-surrogate);
      }
      /* Income-basis group inside a category. The heading is the house micro-label
         (uppercase, tracked, text-xs) — the same rank the specs' own dt row uses, so it
         reads as a divider inside the section and never competes with the category
         header above it. Only the surrogate group is accented: it is the exception a
         desk looks for, and inking both leaves the section with no quiet ground. */
      .basis-group + .basis-group {
        margin-block-start: var(--space-5);
      }
      .basis-head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-secondary);
      }
      .basis-group.is-surrogate .basis-head {
        color: var(--color-income-surrogate);
      }
      .basis-count {
        flex: none;
        min-inline-size: 1.25rem;
        padding: 0 var(--space-1);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xxs);
        text-align: center;
        letter-spacing: 0;
      }
      .basis-group.is-surrogate .basis-count {
        background: var(--color-income-surrogate-bg);
        color: var(--color-income-surrogate);
      }
      /* Secondary ink, never tertiary: this line is read, and tertiary sits under
         4.5:1 on this ground in light mode. */
      .basis-hint {
        margin: var(--space-1) 0 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .basis-group .prog-grid {
        margin-block-start: var(--space-3);
      }
      /* Three figures on one baseline — the actual comparison surface. */
      .specs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-2);
        margin: var(--space-1) 0 0;
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--color-border-default);
      }
      .spec {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .spec dt {
        font-size: var(--text-xxs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-tertiary);
      }
      .spec dd {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .spec dd.num {
        font-family: var(--data-font);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .spec-flag {
        margin-inline-start: var(--space-1);
        font-family: var(--font-family-base);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-regular);
        color: var(--color-text-tertiary);
      }
      .prog-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        margin-block-start: var(--space-2);
      }
      .live {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .live-label {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .prog-actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        opacity: 0;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .prog:hover .prog-actions,
      .prog:focus-within .prog-actions {
        opacity: 1;
      }
      /* Touch devices never hover — keep the actions reachable, at a real tap size. */
      @media (hover: none) {
        .prog-actions {
          opacity: 1;
          gap: var(--space-2);
        }
        .prog-actions ::ng-deep .ant-btn {
          inline-size: 40px;
          block-size: 40px;
        }
      }
      .row-link {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
        text-decoration: none;
      }
      .row-link:hover {
        color: var(--color-text-link);
      }
      .actions {
        white-space: nowrap;
        text-align: end;
      }
      .empty-text {
        margin: 0;
        color: var(--color-text-tertiary);
      }
      @media (prefers-reduced-motion: reduce) {
        .cat-panel,
        .prog {
          opacity: 1;
          transform: none;
          animation: none;
        }
        .prog:hover,
        .prog:focus-within {
          transform: none;
        }
        .panel,
        .panel:hover {
          transition: none;
          transform: none;
        }
      }
    `,
  ],
})
export class BankDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly banksApi = inject(BanksApiService);
  private readonly programsApi = inject(BankProgramsApiService);
  private readonly modal = inject(NzModalService);
  private readonly drawer = inject(NzDrawerService);
  private readonly message = inject(NzMessageService);
  private readonly errors = inject(ErrorCodeService);

  readonly bank = signal<BankWithProgramCount | null>(null);
  readonly programs = signal<BankProgramSummary[]>([]);
  readonly loading = signal(false);
  readonly loadingPrograms = signal(false);

  readonly bankActiveControl = new FormControl<boolean>(true, { nonNullable: true });
  private readonly rowActiveControls = new Map<string, FormControl<boolean>>();

  private get bankId(): string {
    return this.route.snapshot.paramMap.get('bankId') ?? '';
  }

  /**
   * Programs grouped into the four constitution-locked categories (Principle II),
   * in canonical order. Any program whose category falls outside the four
   * (legacy / unknown) is surfaced in a trailing "Other" section rather than
   * silently hidden.
   */
  readonly categorySections = computed<ProgramSection[]>(() => {
    const ps = this.programs();
    const section = (cat: LoanCategory | 'other', label: string, items: BankProgramSummary[]) => ({
      cat,
      label,
      items,
      basisGroups: this.basisGroupsOf(items),
    });
    const sections: ProgramSection[] = LOAN_CATEGORIES.map((cat) =>
      section(
        cat,
        categoryLabel(cat),
        ps.filter((p) => p.productCategory === cat),
      ),
    );
    const others = ps.filter((p) => !isLoanCategory(p.productCategory));
    if (others.length > 0) {
      sections.push(section('other', $localize`:@@bank_detail.cat.other:Other`, others));
    }
    return sections;
  });

  /**
   * The tag on a card. Same words as the group heading above it and as every other
   * surface — one source (`@core/income-basis`). No tooltip: the sentence explaining
   * what the bank reads is already rendered under the group heading, and a second copy
   * on hover would be the same claim in two places.
   */
  protected basisLabel(type: ProgramType): string {
    return incomeBasisLabel(basisOf(type));
  }

  /**
   * Split one category's programs by how the bank establishes the income, then hang the
   * words on the result. The split itself is pure and lives in `basis-groups.ts` — it
   * decides what an operator sees and is worth exercising without an Angular runtime.
   */
  private basisGroupsOf(items: BankProgramSummary[]): BasisGroup[] {
    return splitByBasis(items).map((g) => ({
      key: g.key,
      label: this.basisGroupLabel(g.key),
      hint: this.basisGroupHint(g.key),
      items: g.items,
    }));
  }

  /** The platform's own two words for the two types — one source (`@core/income-basis`). */
  private basisGroupLabel(key: BasisGroupKey): string {
    return key === 'unknown'
      ? $localize`:@@bank_detail.basis.unknown:Basis not stated`
      : incomeBasisLabel(basisOf(key));
  }

  /**
   * One line under the heading saying what the BANK does. The two words above it are the
   * platform's type names, and "Income proof" alone does not tell an operator that the
   * figure comes off a payslip. Rendered, not a tooltip: a group heading is not a
   * hoverable control, and the sentence is the half a new operator actually needs.
   */
  private basisGroupHint(key: BasisGroupKey): string | null {
    if (key === 'unknown') return null;
    return key === 'income_surrogate'
      ? $localize`:@@bank_detail.program.no_payslip_tip:The bank works the income out from a fact about the applicant`
      : $localize`:@@bank_detail.program.income_proof_tip:The bank lends against a salary the customer is paid`;
  }

  /** Query params for the per-section "Add program" link (scopes category). */
  addQueryParams(cat: LoanCategory | 'other'): Record<string, string> {
    const bankId = this.bank()?.id ?? '';
    return cat === 'other' ? { bankId } : { bankId, category: cat };
  }

  /** ng-zorro icon nzType per loan category — generic map, no hardcoded bank logic. */
  private static readonly CAT_ICONS: Readonly<Record<LoanCategory | 'other', string>> = {
    personal: 'user',
    car: 'car',
    mortgage: 'home',
    business: 'shop',
    other: 'appstore',
  };

  catIcon(cat: LoanCategory | 'other'): string {
    return BankDetailPage.CAT_ICONS[cat] ?? 'appstore';
  }

  /**
   * Per-category accent hue — generic map (Principle II), keyed by category.
   * Returns a CSS custom-property reference resolved against the theme tokens.
   */
  private static readonly CAT_COLORS: Readonly<Record<LoanCategory | 'other', string>> = {
    personal: 'var(--color-cat-personal)',
    car: 'var(--color-cat-car)',
    mortgage: 'var(--color-cat-mortgage)',
    business: 'var(--color-cat-business)',
    other: 'var(--color-cat-other)',
  };

  catColor(cat: LoanCategory | 'other'): string {
    return BankDetailPage.CAT_COLORS[cat] ?? 'var(--color-cat-other)';
  }

  // --- Card spec formatting -------------------------------------------------
  // Programs across banks share a name, so the three figures below are what
  // actually distinguishes them on the shelf. Compact notation keeps a 3-up card
  // grid readable ("3M" not "3,000,000") — the exact figures live on the detail
  // page.

  private static readonly EM_DASH = '—';

  /** Compact EGP, e.g. `3M` / `750K`. Falls back to a dash on missing config. */
  private compactEgp(value: string | null | undefined): string | null {
    if (!value) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }

  /** Headline rate, trailing zeros trimmed (`21.5%`, not `21.5000%`). */
  rateLabel(p: BankProgramSummary): string {
    if (!p.ratePercent) return BankDetailPage.EM_DASH;
    const n = Number(p.ratePercent);
    if (!Number.isFinite(n)) return BankDetailPage.EM_DASH;
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)}%`;
  }

  amountLabel(p: BankProgramSummary): string {
    const min = this.compactEgp(p.minAmountEGP);
    const max = this.compactEgp(p.maxAmountEGP);
    if (!min && !max) return BankDetailPage.EM_DASH;
    if (!min) return `≤ ${max}`;
    if (!max) return `≥ ${min}`;
    return `${min}–${max}`;
  }

  tenorLabel(p: BankProgramSummary): string {
    if (p.minMonths == null && p.maxMonths == null) return BankDetailPage.EM_DASH;
    const min = p.minMonths ?? p.maxMonths;
    const max = p.maxMonths ?? p.minMonths;
    return $localize`:@@bank_detail.spec.tenor_value:${min}:MIN:–${max}:MAX: mo`;
  }

  /** First non-empty category — the only accordion panel open by default. */
  readonly firstOpenCat = computed<LoanCategory | 'other' | null>(
    () => this.categorySections().find((s) => s.items.length > 0)?.cat ?? null,
  );

  readonly stats = computed<KpiItem[]>(() => {
    const ps = this.programs();
    const active = ps.filter((p) => p.active).length;
    const inactive = ps.length - active;
    const liveCategories = this.categorySections().filter((s) => s.items.length > 0).length;
    const livePct = ps.length > 0 ? Math.round((active / ps.length) * 100) : 0;
    return [
      {
        label: $localize`:@@bank_detail.stat.total:Total programs`,
        value: ps.length,
        hint: $localize`:@@bank_detail.stat.total.hint:across ${liveCategories}:count: categories`,
      },
      {
        label: $localize`:@@bank_detail.stat.active:Active`,
        value: active,
        tone: 'success',
        hint: $localize`:@@bank_detail.stat.active.hint:${livePct}:pct:% live`,
      },
      {
        label: $localize`:@@bank_detail.stat.inactive:Inactive`,
        value: inactive,
        tone: inactive > 0 ? 'warning' : 'muted',
        hint:
          inactive > 0
            ? $localize`:@@bank_detail.stat.inactive.paused:paused`
            : $localize`:@@bank_detail.stat.inactive.none:none paused`,
      },
    ];
  });

  /** Per-category counts feeding the portfolio-mix bar + legend (all categories, incl. empty). */
  readonly mixSegments = computed<MixSegment[]>(() =>
    this.categorySections().map((s) => ({
      cat: s.cat,
      label: s.label,
      count: s.items.length,
      colorVar: this.catColor(s.cat),
    })),
  );

  /** Portfolio health for the donut ring — share of programs visible to applicants. */
  readonly health = computed<PortfolioHealth>(() => {
    const ps = this.programs();
    const active = ps.filter((p) => p.active).length;
    const pct = ps.length > 0 ? Math.round((active / ps.length) * 100) : 0;
    return { pct, active, total: ps.length };
  });

  ngOnInit(): void {
    this.bankActiveControl.valueChanges.subscribe((next) => {
      const b = this.bank();
      if (b && next !== b.isActive) void this.onToggleBank(b, next);
    });
    void this.loadBank();
    void this.loadPrograms();
  }

  private async loadBank(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.banksApi.getById(this.bankId);
      this.bank.set(res.data);
      this.bankActiveControl.setValue(res.data.isActive, { emitEvent: false });
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadPrograms(): Promise<void> {
    this.loadingPrograms.set(true);
    try {
      const res = await this.banksApi.listPrograms(this.bankId);
      this.programs.set(res.data);
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loadingPrograms.set(false);
    }
  }

  rowActiveControl(p: BankProgramSummary): FormControl<boolean> {
    let ctrl = this.rowActiveControls.get(p.programCode);
    if (!ctrl) {
      ctrl = new FormControl<boolean>(p.active, { nonNullable: true });
      this.rowActiveControls.set(p.programCode, ctrl);
      const code = p.programCode;
      ctrl.valueChanges.subscribe((next) => {
        const current = this.programs().find((r) => r.programCode === code);
        if (current && next !== current.active) void this.onToggleProgram(current, next);
      });
    } else if (ctrl.value !== p.active) {
      ctrl.setValue(p.active, { emitEvent: false });
    }
    return ctrl;
  }

  private async onToggleProgram(p: BankProgramSummary, active: boolean): Promise<void> {
    try {
      const res = await this.programsApi.toggle(p.programCode, { active, version: p.version });
      // Patch the single row in place — no refetch, so the accordion keeps its
      // state and the list does not flash / re-animate (signals update only the
      // changed row + the derived KPI / mix / health numbers).
      this.programs.update((list) =>
        list.map((r) =>
          r.programCode === p.programCode
            ? { ...r, active: res.data.active, version: res.data.version }
            : r,
        ),
      );
    } catch (err) {
      this.handleError(err);
      // Revert the row switch to its last confirmed state.
      this.rowActiveControls.get(p.programCode)?.setValue(p.active, { emitEvent: false });
    }
  }

  openEditBank(b: BankWithProgramCount): void {
    const ref = openFormDrawer<
      BankFormDrawer,
      BankFormDrawerData,
      BankFormDrawerResult | undefined
    >(this.drawer, { content: BankFormDrawer, data: { mode: 'edit', bank: b } });
    ref.afterClose.subscribe((res) => {
      if (res?.saved) void this.loadBank();
    });
  }

  async onToggleBank(b: BankWithProgramCount, isActive: boolean): Promise<void> {
    try {
      const res = await this.banksApi.toggle(b.id, { version: b.version, isActive });
      this.message.success($localize`:@@banks.toggle.success:Bank updated.`);
      // Merge in place (keep programCount) — avoids a hero refetch / flash.
      this.bank.update((cur) => (cur ? { ...cur, ...res.data } : cur));
    } catch (err) {
      this.handleError(err);
      // Revert the header switch to the last confirmed state.
      this.bankActiveControl.setValue(b.isActive, { emitEvent: false });
    }
  }

  onDeleteBank(b: BankWithProgramCount): void {
    if (b.programCount > 0) {
      this.message.warning(
        this.errors.toLocalizedMessage('BANK_HAS_PROGRAMS' as never, {
          programCount: b.programCount,
        }),
      );
      return;
    }
    this.modal.confirm({
      nzTitle: $localize`:@@banks.delete.title:Delete bank?`,
      nzContent: b.nameEnglish,
      nzOkText: $localize`:@@banks.delete.ok:Delete`,
      nzOkDanger: true,
      nzOnOk: async () => {
        try {
          await this.banksApi.remove(b.id);
          this.message.success($localize`:@@banks.delete.success:Bank deleted.`);
          void this.router.navigate(['/banks']);
        } catch (err) {
          this.handleError(err);
        }
      },
    });
  }

  openDelete(p: BankProgramSummary): void {
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
      if (deleted) {
        void this.loadBank();
        void this.loadPrograms();
      }
    });
  }

  logoUrl(b: BankWithProgramCount): string {
    return b.logoS3Key ? `/api/admin/banks/${b.id}/logo` : '';
  }

  initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  private handleError(err: unknown): void {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
    const code = envelope?.code ?? 'INTERNAL_ERROR';
    this.message.error(this.errors.toLocalizedMessage(code as never, envelope?.meta));
  }
}
