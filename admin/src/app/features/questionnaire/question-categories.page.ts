import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { DragDropModule } from '@angular/cdk/drag-drop';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  CheckOutline,
  HolderOutline,
  SearchOutline,
  WarningOutline,
} from '@ant-design/icons-angular/icons';
import {
  LOAN_CATEGORIES,
  QuestionnaireApiService,
  categoryLabel,
  isLoanCategory,
  type LoanCategory,
  type QuestionCategoryAssignment,
  type QuestionRow,
} from './questionnaire.api.service';

/** Matches the `qc-land` keyframes below — the flag outlives neither. */
const LAND_ANIMATION_MS = 260;

/** A question whose branch source is not asked everywhere the question itself is. */
interface DanglingBranch {
  question: QuestionRow;
  sourceCode: string;
  /** Categories where the question is asked but its branch source is not. */
  orphanedIn: LoanCategory[];
}

/**
 * Loan-category assignment for the GLOBAL question pool (Principle V, as amended).
 *
 * One tab per loan category, each listing what that category asks. The tabs are a
 * VIEW, not four questionnaires: there is still ONE pool and ONE published version
 * (A33), and a question may serve several categories at once — the tab counts and
 * the health panel are where that overlap is visible, since a card only ever
 * speaks for the open tab.
 *
 * Each tab lists the asked questions first, then the rest of the pool underneath,
 * so adding one is a tick in place and never a hunt on another screen.
 *
 * Every tick writes immediately and auto-publishes, matching the pool tab — there
 * is no Save button to forget. Writes are optimistic and revert by re-fetching the
 * tree, which is also the only way two tabs open on the same pool stay honest.
 */
@Component({
  standalone: true,
  selector: 'mf-question-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSpinModule,
    NzIconModule,
    NzToolTipModule,
    DragDropModule,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowDownOutline,
      ArrowUpOutline,
      CheckOutline,
      HolderOutline,
      SearchOutline,
      WarningOutline,
    ]),
  ],
  template: `
    <section class="page">
      <p class="sr-only" role="status" aria-live="polite">{{ status() }}</p>
      <header class="bar">
        <div class="bar-lead">
          <p class="eyebrow" i18n="@@qcat.eyebrow">Matching engine</p>
          <h1 i18n="@@qcat.title">Who gets asked what</h1>
          <p class="sub" i18n="@@qcat.sub">
            One question can be asked for several loan categories. Untick every category to park a
            question — it stays here, but nobody is asked it.
          </p>
        </div>
        <div class="bar-actions">
          @if (issueCount() > 0) {
            <button
              type="button"
              class="health warn"
              [class.on]="healthOpen()"
              [attr.aria-expanded]="healthOpen()"
              (click)="healthOpen.set(!healthOpen())"
            >
              <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@qcat.health_issues">{{ issueCount() }} to look at</span>
            </button>
          }
          <span class="autosave" i18n="@@qcat.autosave">Saves &amp; publishes automatically</span>
        </div>
      </header>

      @if (healthOpen() && issueCount() > 0) {
        <div class="health-panel">
          @if (parked().length > 0) {
            <p class="hp-title" i18n="@@qcat.parked_title">
              These questions are asked for no category — nobody sees them.
            </p>
            <ul class="hp-list">
              @for (q of parked(); track q.id) {
                <li>{{ wordingOf(q) }}</li>
              }
            </ul>
          }
          @if (dangling().length > 0) {
            <!-- A branch whose source question is not asked in the same category
                 never hides its dependent: the server treats an unanswerable rule
                 as "always show". So this is silent unless it is said here. -->
            <p class="hp-title" i18n="@@qcat.dangling_title">
              These questions only appear after another answer, but that other question isn't asked
              in every category they're assigned to — so they'll always show there.
            </p>
            <ul class="hp-list">
              @for (d of dangling(); track d.question.id) {
                <li>
                  {{ wordingOf(d.question) }}
                  <code>{{ d.sourceCode }}</code>
                  <span class="hp-where">{{ labelsOf(d.orphanedIn) }}</span>
                </li>
              }
            </ul>
          }
        </div>
      }

      @if (loading()) {
        <div class="center"><nz-spin nzSimple /></div>
      } @else if (rows().length === 0) {
        <div class="empty-card">
          <nz-empty
            nzNotFoundContent="No questions to assign yet — add some on the Questions tab first"
            i18n-nzNotFoundContent="@@qcat.empty"
          />
        </div>
      } @else {
        <!-- One tab per loan category. Automatic activation (arrow key selects,
             per WAI-ARIA tabs): the panel is a filtered list of a pool already in
             memory, so there is nothing to load and nothing to confirm. -->
        <div
          class="tabs"
          role="tablist"
          aria-label="Loan categories"
          i18n-aria-label="@@qcat.rail_aria"
        >
          @for (c of categories; track c) {
            <button
              type="button"
              role="tab"
              class="tab"
              [id]="'qcat-tab-' + c"
              [class.on]="active() === c"
              [attr.aria-selected]="active() === c"
              [attr.aria-controls]="'qcat-panel-' + c"
              [attr.tabindex]="active() === c ? 0 : -1"
              (click)="select(c)"
              (keydown)="onTabKey($event, c)"
            >
              <span class="tab-name">{{ label(c) }}</span>
              <span class="tab-n">{{ countOf(c) }}</span>
            </button>
          }
        </div>

        <div
          class="panel"
          role="tabpanel"
          [id]="'qcat-panel-' + active()"
          [attr.aria-labelledby]="'qcat-tab-' + active()"
          tabindex="0"
        >
          <!-- Head + search are ONE card; the question cards below sit straight
               on the page. A grid of cards inside a card is a hierarchy with a
               level that means nothing. -->
          <div class="controls">
            <div class="panel-head">
              <div class="ph-lead">
                <p class="ph-count">
                  <strong>{{ countOf(active()) }}</strong>
                  <span i18n="@@qcat.panel_count">of {{ rows().length }} questions asked</span>
                </p>
                <span class="meter" aria-hidden="true">
                  <span class="meter-fill" [style.inline-size.%]="pctOf(active())"></span>
                </span>
              </div>
              <div class="ph-acts">
                <!-- The two verbs of this panel, and the switch between them. Ordering is a
                     MODE and not a third button beside the bulk actions, because it changes
                     what every row on the list is: a tick becomes a position, and the rows
                     the category does not ask stop being on the page at all. -->
                <button
                  type="button"
                  class="ghost"
                  [class.on]="ordering()"
                  [attr.aria-pressed]="ordering()"
                  [disabled]="busy() || askedByStep().length === 0"
                  (click)="ordering.set(!ordering())"
                  nz-tooltip
                  nzTooltipTitle="Set the order these questions are asked in, step by step"
                  i18n-nzTooltipTitle="@@qcat.order_tip"
                >
                  @if (ordering()) {
                    <span i18n="@@qcat.order_done">Done ordering</span>
                  } @else {
                    <span i18n="@@qcat.order_mode">Set the order</span>
                  }
                </button>
                <!-- Bulk actions act on the rows LISTED, not the whole pool: with a
                   search on, "all" meaning "all 41" would be a silent mass edit
                   of rows nobody can see. -->
                <button
                  type="button"
                  class="ghost"
                  [hidden]="ordering()"
                  [disabled]="busy()"
                  (click)="setColumn(active(), true)"
                  nz-tooltip
                  nzTooltipTitle="Ask every listed question for this category"
                  i18n-nzTooltipTitle="@@qcat.col_all_tip"
                  i18n="@@qcat.ask_all"
                >
                  Ask all listed
                </button>
                <button
                  type="button"
                  class="ghost"
                  [hidden]="ordering()"
                  [disabled]="busy()"
                  (click)="setColumn(active(), false)"
                  nz-tooltip
                  nzTooltipTitle="Stop asking every listed question for this category"
                  i18n-nzTooltipTitle="@@qcat.col_none_tip"
                  i18n="@@qcat.remove_all"
                >
                  Remove all listed
                </button>
              </div>
            </div>

            <div class="toolbar" role="search">
              <nz-input-group class="search" nzPrefixIcon="search" nzSize="large">
                <input
                  nz-input
                  [formControl]="searchCtrl"
                  placeholder="Search questions, answers, or codes"
                  i18n-placeholder="@@qcat.search_ph"
                  aria-label="Search the question pool"
                  i18n-aria-label="@@qcat.search_aria"
                />
              </nz-input-group>

              <p class="showing">
                @if (filtering()) {
                  <span i18n="@@qcat.showing"
                    >{{ visible().length }} of {{ rows().length }} questions</span
                  >
                  <button type="button" class="link" (click)="clearFilters()" i18n="@@qcat.clear">
                    Clear
                  </button>
                } @else {
                  <span i18n="@@qcat.total">{{ rows().length }} questions</span>
                }
              </p>
            </div>
          </div>

          @if (ordering()) {
            <!-- ORDER MODE. One column and the steps named, because that is the shape of the
                 thing being edited: the app pages one step per group and sorts the questions
                 inside it, so the sequence is only readable when the boundaries are.

                 The rows the category does NOT ask are gone from the page here — they have
                 no position to set, and leaving them under a "not asked" heading would offer
                 a drag that means nothing. -->
            <p class="order-lede" i18n="@@qcat.order_lede">
              Drag a question to move it, or use the arrows. Each step is one screen in the app, so
              a question can only move within its own. The other categories keep their own order.
            </p>
            @if (filtering()) {
              <p class="order-note" i18n="@@qcat.order_filtered">
                Dragging is off while the list is filtered — the order you'd see isn't the order
                applicants get. Use the arrows, or clear the search.
              </p>
            }
            @for (step of askedByStep(); track step.id) {
              <p class="sec">
                <span>{{ step.title }}</span>
                <span class="sec-n">{{ step.rows.length }}</span>
              </p>
              <ul
                class="olist"
                cdkDropList
                [cdkDropListDisabled]="!reorderable()"
                (cdkDropListDropped)="
                  dropInStep(step.id, $event.previousIndex, $event.currentIndex)
                "
              >
                @for (q of step.rows; track q.id; let i = $index) {
                  <li class="orow" cdkDrag cdkDragLockAxis="y" [cdkDragDisabled]="!reorderable()">
                    <button
                      type="button"
                      class="handle"
                      cdkDragHandle
                      [disabled]="!reorderable()"
                      aria-label="Drag to reorder"
                      i18n-aria-label="@@qcat.reorder_aria"
                    >
                      <span nz-icon nzType="holder" nzTheme="outline" aria-hidden="true"></span>
                    </button>
                    <span class="ord" aria-hidden="true">{{ i + 1 }}</span>
                    <span class="orow-text">{{ wordingOf(q) }}</span>
                    <span class="orow-acts">
                      <button
                        type="button"
                        class="icon-btn"
                        [disabled]="i === 0 || busy()"
                        (click)="moveBy(q, -1)"
                        aria-label="Move up"
                        i18n-aria-label="@@qcat.move_up"
                      >
                        <span nz-icon nzType="arrow-up" nzTheme="outline"></span>
                      </button>
                      <button
                        type="button"
                        class="icon-btn"
                        [disabled]="i === step.rows.length - 1 || busy()"
                        (click)="moveBy(q, 1)"
                        aria-label="Move down"
                        i18n-aria-label="@@qcat.move_down"
                      >
                        <span nz-icon nzType="arrow-down" nzTheme="outline"></span>
                      </button>
                    </span>
                    <div class="drag-ghost" *cdkDragPlaceholder></div>
                  </li>
                }
              </ul>
            }
          } @else if (visible().length === 0) {
            <div class="no-match">
              <p class="nm-title" i18n="@@qcat.no_matches_title">Nothing matches that filter</p>
              <button nz-button (click)="clearFilters()" i18n="@@qcat.clear">Clear</button>
            </div>
          } @else {
            <!-- Two sections, one row markup: the lists differ in tone, not in
                 what a row is or what tapping it does. Driving them from a
                 computed pair keeps that single definition. -->
            @for (s of sections(); track s.key) {
              @if (s.key === 'asked' || s.rows.length > 0) {
                <p class="sec" [class.muted]="s.key === 'rest'">
                  @if (s.key === 'asked') {
                    <span i18n="@@qcat.sec_asked">Asked in this category</span>
                  } @else {
                    <span i18n="@@qcat.sec_not_asked">Not asked here</span>
                  }
                  <span class="sec-n">{{ s.rows.length }}</span>
                </p>
                @if (s.rows.length === 0) {
                  <p class="sec-empty" i18n="@@qcat.none_asked">
                    Nothing is asked here yet — tick a question below to add it.
                  </p>
                } @else {
                  <!-- Cards in a fluid grid, not full-width rows: a question is
                       one short line, so a row spent ~1500px of a 1800px screen
                       on nothing and forced the eye back to the start for every
                       tick. Three or four per line quarters the travel. -->
                  <ul class="qgrid" [class.dim]="s.key === 'rest'">
                    @for (q of s.rows; track q.id) {
                      <li>
                        <button
                          type="button"
                          class="qcard"
                          role="checkbox"
                          [class.on]="has(q, active())"
                          [class.some]="optIn(q, active())"
                          [class.landed]="justMoved() === q.id"
                          [attr.aria-checked]="optIn(q, active()) ? 'mixed' : has(q, active())"
                          [attr.aria-label]="cellLabel(q, active())"
                          [attr.aria-busy]="saving().has(q.id) || busy()"
                          (click)="toggle(q, active())"
                        >
                          <span class="tick-box">
                            <span
                              nz-icon
                              nzType="check"
                              nzTheme="outline"
                              aria-hidden="true"
                              class="tick-icon"
                            ></span>
                          </span>
                          <span class="qc-text">
                            <!-- Wording only. The code is an implementation
                                 detail of the pool tab; here it said nothing
                                 about who gets asked. Search still matches it. -->
                            <span class="qc-title">{{ wordingOf(q) }}</span>
                            @if (q.categories.length === 0) {
                              <span class="row-meta">
                                <span class="parked-tag" i18n="@@qcat.parked_tag">Parked</span>
                              </span>
                            } @else if (optIn(q, active())) {
                              <span class="row-meta">
                                <span class="optin-tag">{{ optInText(q, active()) }}</span>
                              </span>
                            }
                          </span>
                        </button>
                      </li>
                    }
                  </ul>
                }
              }
            }
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        --qc-accent: var(--primary, var(--ant-primary-color, #0869c3));
        /* --color-border-subtle / --color-text-on-primary are NOT tokens: the
           old aliases resolved to their hardcoded light fallbacks and made this
           the one screen that stayed light-mode inside dark mode. */
        --qc-line: var(--border-subtle, #efeae5);
        --qc-line-strong: var(--border-default, #ddd8d3);
        --qc-muted: var(--color-text-tertiary, #8c7e75);
        --qc-text: var(--color-text-primary, #2b2320);
        --qc-text-2: var(--color-text-secondary, #6b5d54);
        --qc-surface: var(--color-surface-default, #fdfcfb);
        --qc-warn: var(--color-warning, #c8893d);
        --qc-radius: var(--radius-lg, 12px);
      }
      .page {
        padding: var(--space-6, 32px);
        inline-size: 100%;
        background: var(--color-surface-page, #f8f6f4);
        min-block-size: 100%;
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .center {
        display: grid;
        place-items: center;
        padding: var(--space-8, 48px);
      }

      /* ---- Command bar --------------------------------------------------- */
      .bar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4, 16px);
        flex-wrap: wrap;
        margin-block-end: var(--space-4, 16px);
      }
      .bar-lead {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
        max-inline-size: 68ch;
      }
      .eyebrow {
        margin: 0;
        font-size: var(--text-xs, 12px);
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-tonal-accent, var(--qc-muted));
      }
      .bar-lead h1 {
        margin: 0;
        font-family: var(--heading-font, var(--font-sans));
        font-size: var(--text-2xl, 24px);
        font-weight: 700;
        letter-spacing: -0.015em;
        line-height: var(--leading-tight, 1.2);
        color: var(--qc-text);
      }
      .sub {
        margin: var(--space-1, 4px) 0 0;
        font-size: var(--text-sm, 14px);
        line-height: var(--leading-normal, 1.5);
        color: var(--qc-text-2);
      }
      .bar-actions {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        flex-wrap: wrap;
      }
      .autosave {
        font-size: var(--text-xs, 12px);
        color: var(--qc-muted);
      }
      .health {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 32px;
        padding: 2px 12px;
        border: 1px solid transparent;
        border-radius: var(--radius-pill, 999px);
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        color: var(--qc-warn);
        background: color-mix(in srgb, var(--qc-warn) 14%, transparent);
        cursor: pointer;
      }
      .health:hover,
      .health.on {
        border-color: var(--qc-warn);
      }
      .health:focus-visible {
        outline: 2px solid var(--qc-warn);
        outline-offset: 2px;
      }
      .health-panel {
        margin-block-end: var(--space-4, 16px);
        padding: var(--space-4, 16px);
        background: color-mix(in srgb, var(--qc-warn) 8%, var(--qc-surface));
        border: 1px solid color-mix(in srgb, var(--qc-warn) 32%, transparent);
        border-radius: var(--qc-radius);
      }
      .hp-title {
        margin: 0 0 var(--space-2, 8px);
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        color: var(--qc-text);
      }
      .hp-title:not(:first-child) {
        margin-block-start: var(--space-4, 16px);
      }
      .hp-list {
        margin: 0;
        padding-inline-start: var(--space-4, 16px);
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--text-sm, 14px);
        color: var(--qc-text-2);
      }
      .hp-list code {
        margin-inline: var(--space-2, 8px);
      }
      .hp-where {
        color: var(--qc-muted);
      }

      /* ---- Category tabs --------------------------------------------------
         Segmented, not underlined: the shell above already owns an underline
         tab row (Questions / Loan categories), and two identical rows stacked
         read as one broken control. */
      .tabs {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        padding: 4px;
        margin-block-end: var(--space-4, 16px);
        background: var(--color-surface-muted, var(--qc-line));
        border-radius: var(--radius-pill, 999px);
        inline-size: fit-content;
        max-inline-size: 100%;
      }
      .tab {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2, 8px);
        min-block-size: 40px;
        padding-inline: var(--space-4, 16px);
        border: 0;
        border-radius: var(--radius-pill, 999px);
        background: none;
        color: var(--qc-text-2);
        font: inherit;
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast, 120ms) var(--motion-easing-standard, ease),
          color var(--motion-duration-fast, 120ms) var(--motion-easing-standard, ease);
      }
      .tab:hover:not(.on) {
        color: var(--qc-text);
      }
      .tab:focus-visible {
        outline: 2px solid var(--qc-accent);
        outline-offset: 2px;
      }
      .tab.on {
        background: var(--qc-surface);
        color: var(--qc-accent);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(43, 35, 32, 0.06));
      }
      .tab-n {
        min-inline-size: 20px;
        padding-inline: 6px;
        border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, currentColor 12%, transparent);
        font-size: var(--text-xs, 12px);
        font-variant-numeric: tabular-nums lining-nums;
      }

      /* ---- Panel ----------------------------------------------------------- */
      /* Not a card — the question cards are. One container per level. */
      .panel {
        display: block;
      }
      .panel:focus-visible {
        outline: 2px solid var(--qc-accent);
        outline-offset: 2px;
        border-radius: var(--qc-radius);
      }
      .controls {
        background: var(--qc-surface);
        border: 1px solid var(--qc-line);
        border-radius: var(--qc-radius);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(43, 35, 32, 0.06));
        overflow: hidden;
      }
      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4, 16px);
        flex-wrap: wrap;
        padding: var(--space-4, 16px);
        border-block-end: 1px solid var(--qc-line);
      }
      .ph-lead {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
        flex: 1 1 220px;
        min-inline-size: 0;
        max-inline-size: 320px;
      }
      .ph-count {
        display: flex;
        align-items: baseline;
        gap: 6px;
        margin: 0;
        font-size: var(--text-sm, 14px);
        color: var(--qc-muted);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .ph-count strong {
        font-size: var(--text-xl, 22px);
        font-weight: 700;
        line-height: 1;
        color: var(--qc-text);
      }
      /* A 3px bar, not a ring or a donut: the only comparison worth making is
         tab-to-tab, and a bar reads as a share at a glance. */
      .meter {
        display: block;
        block-size: 3px;
        border-radius: var(--radius-pill, 999px);
        background: var(--qc-line);
        overflow: hidden;
      }
      .meter-fill {
        display: block;
        block-size: 100%;
        border-radius: inherit;
        background: var(--qc-accent);
        transition: inline-size var(--motion-duration-base, 180ms)
          var(--motion-easing-standard, ease);
      }
      .ph-acts {
        display: flex;
        gap: var(--space-2, 8px);
        flex-wrap: wrap;
      }
      .ghost {
        /* 44px (WCAG 2.5.5) — these two are the only controls on the screen that
           rewrite dozens of rows at once, so they get a full-size target. */
        min-block-size: 44px;
        padding-inline: var(--space-4, 16px);
        border: 1px solid var(--qc-line-strong);
        border-radius: var(--radius-md, 8px);
        background: var(--qc-surface);
        color: var(--qc-accent);
        font: inherit;
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast, 120ms) ease,
          border-color var(--motion-duration-fast, 120ms) ease;
      }
      .ghost:hover:not(:disabled) {
        border-color: var(--qc-accent);
        background: color-mix(in srgb, var(--qc-accent) 8%, transparent);
      }
      .ghost:disabled {
        color: var(--qc-muted);
        cursor: default;
      }
      .ghost:focus-visible {
        outline: 2px solid var(--qc-accent);
        outline-offset: 2px;
      }

      /* ---- Toolbar --------------------------------------------------------- */
      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        flex-wrap: wrap;
        padding: var(--space-3, 12px) var(--space-4, 16px);
        border-block-end: 1px solid var(--qc-line);
      }
      .search {
        flex: 1 1 320px;
        min-inline-size: 240px;
      }
      .showing {
        margin: 0;
        margin-inline-start: auto;
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        font-size: var(--text-sm, 14px);
        color: var(--qc-muted);
        font-variant-numeric: tabular-nums;
      }
      .link {
        padding: 0;
        border: 0;
        background: none;
        color: var(--qc-accent);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .link:focus-visible {
        outline: 2px solid var(--qc-accent);
        outline-offset: 2px;
      }

      /* ---- Sections + card grid --------------------------------------------
         The heading sits on the page now, so it is a label with a rule under it
         rather than a filled band — a grey band across an open page reads as the
         top of a container that is not there. */
      /* ── ORDER MODE ────────────────────────────────────────────────────────
         One column, hairline-separated, with the drag handle and the position on the
         start edge — the same row anatomy the pool tab's list uses, deliberately: an
         operator who has reordered the pool already knows how to read this, and a second
         way of drawing one interaction is a second thing to learn. */
      .order-lede,
      .order-note {
        margin: var(--space-3, 12px) 0 0;
        max-inline-size: 70ch;
        font-size: var(--text-sm, 14px);
        line-height: 1.6;
        color: var(--qc-text-2);
      }
      .order-note {
        color: var(--qc-muted);
      }
      .olist {
        margin: 0;
        padding: 0;
        list-style: none;
        border: 1px solid var(--qc-line);
        border-radius: var(--radius-md, 10px);
        background: var(--qc-surface);
      }
      .orow {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border-block-end: 1px solid var(--qc-line);
        background: var(--qc-surface);
      }
      .orow:last-child {
        border-block-end: 0;
      }
      .handle {
        display: grid;
        place-items: center;
        flex: none;
        inline-size: 28px;
        block-size: 36px;
        border: 0;
        background: none;
        color: var(--qc-muted);
        cursor: grab;
      }
      .handle:disabled {
        cursor: default;
        opacity: 0.4;
      }
      /* The position, not a badge to shout with: an outline and tabular figures, so a
         column of them reads as a sequence rather than as 36 chips. */
      .ord {
        display: grid;
        place-items: center;
        flex: none;
        inline-size: 24px;
        block-size: 24px;
        border: 1px solid var(--qc-line);
        border-radius: var(--radius-pill, 999px);
        font-size: var(--text-xs, 12px);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--qc-text-2);
      }
      .orow-text {
        flex: 1 1 auto;
        min-inline-size: 0;
        font-size: var(--text-sm, 14px);
        color: var(--qc-text);
      }
      .orow-acts {
        display: flex;
        flex: none;
        gap: var(--space-1, 4px);
      }
      .icon-btn {
        display: grid;
        place-items: center;
        inline-size: 28px;
        block-size: 28px;
        border: 1px solid transparent;
        border-radius: var(--radius-sm, 6px);
        background: none;
        color: var(--qc-text-2);
        cursor: pointer;
      }
      .icon-btn:hover:not(:disabled) {
        border-color: var(--qc-line);
        background: color-mix(in srgb, currentColor 6%, transparent);
      }
      .icon-btn:disabled {
        cursor: default;
        opacity: 0.35;
      }
      /* The gap the row leaves behind while it is being carried. */
      .drag-ghost {
        block-size: 36px;
        border: 1px dashed var(--qc-line);
        border-radius: var(--radius-sm, 6px);
        background: color-mix(in srgb, var(--qc-accent) 6%, transparent);
      }
      .cdk-drag-preview {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border: 1px solid var(--qc-line);
        border-radius: var(--radius-md, 10px);
        background: var(--qc-surface);
        box-shadow: var(--shadow-md, 0 8px 24px rgb(0 0 0 / 12%));
      }
      .cdk-drag-placeholder .orow-text,
      .cdk-drag-placeholder .orow-acts,
      .cdk-drag-placeholder .handle,
      .cdk-drag-placeholder .ord {
        visibility: hidden;
      }

      .sec {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        margin: var(--space-5, 24px) 0 var(--space-3, 12px);
        padding-block-end: var(--space-2, 8px);
        border-block-end: 1px solid var(--qc-line);
        font-size: var(--text-xs, 12px);
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--qc-text-2);
      }
      .sec.muted {
        color: var(--qc-muted);
      }
      .sec-n {
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: 0;
        color: var(--qc-muted);
      }
      .sec-empty {
        margin: 0;
        padding: var(--space-5, 24px) 0;
        font-size: var(--text-sm, 14px);
        color: var(--qc-muted);
      }
      /* auto-fill, not auto-fit: a search that leaves two hits should keep card
         width, not stretch two cards across 1800px. */
      .qgrid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: var(--space-3, 12px);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .qgrid > li {
        display: flex;
      }
      /* Tick and wording on ONE line, the wording set against the tick: stacked,
         the tick sat alone on a line of its own and the card needed a third more
         height to say the same thing. */
      .qcard {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2-5, 10px);
        inline-size: 100%;
        min-block-size: 68px;
        padding: var(--space-3, 12px);
        border: 1px solid var(--qc-line);
        border-radius: var(--qc-radius);
        background: var(--qc-surface);
        text-align: start;
        font: inherit;
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast, 120ms) ease,
          background var(--motion-duration-fast, 120ms) ease,
          box-shadow var(--motion-duration-fast, 120ms) ease;
      }
      .qcard:hover {
        border-color: var(--qc-line-strong);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(43, 35, 32, 0.06));
      }
      .qcard:focus-visible {
        outline: 2px solid var(--qc-accent);
        outline-offset: 2px;
      }
      /* Asked reads as a filled card, not just a ticked box: at four cards a row
         the tick alone is too small to scan a whole grid by. */
      .qcard.on {
        border-color: color-mix(in srgb, var(--qc-accent) 40%, var(--qc-line));
        background: color-mix(in srgb, var(--qc-accent) 5%, var(--qc-surface));
      }
      .qcard.on:hover {
        border-color: var(--qc-accent);
      }
      /* The tick moves the card to the other section immediately, which means the
         card is destroyed here and rebuilt there. Landing it — rather than
         letting it blink into place — is what makes the jump readable. */
      .qcard.landed {
        animation: qc-land var(--motion-duration-slow, 280ms)
          var(--motion-easing-standard, ease-out) both;
      }
      @keyframes qc-land {
        from {
          opacity: 0;
          transform: scale(0.96);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .qc-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
        min-inline-size: 0;
      }
      .qc-title {
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        line-height: var(--leading-normal, 1.45);
        color: var(--qc-text);
        /* Three lines then ellipsis: a 12-word question must not make its card
           twice the height of its neighbours and tear a hole in the row. */
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .qgrid.dim .qc-title {
        color: var(--qc-text-2);
      }
      .tick-box {
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        /* 20px, matching the cap-height of the line beside it: the card IS the
           44px target, so the box only has to read as a checkbox, not carry the
           hit area. At 26px it out-weighted the question. */
        inline-size: 20px;
        block-size: 20px;
        border: 1px solid var(--qc-line-strong);
        border-radius: var(--radius-sm, 4px);
        background: var(--qc-surface);
        color: transparent;
        transition:
          background var(--motion-duration-fast, 120ms) ease,
          border-color var(--motion-duration-fast, 120ms) ease,
          color var(--motion-duration-fast, 120ms) ease,
          transform var(--motion-duration-fast, 120ms) ease;
      }
      .qcard:hover .tick-box {
        border-color: var(--qc-accent);
      }
      .qcard:active .tick-box {
        transform: scale(0.92);
      }
      .qcard.on .tick-box {
        background: var(--qc-accent);
        border-color: var(--qc-accent);
        /* --color-text-on-primary is not a token — the old fallback painted a
           white glyph on dark mode's light-azure fill (2.3:1). */
        color: var(--text-on-primary, #fdfcfb);
      }
      .qcard[aria-busy='true'] .tick-box {
        opacity: 0.55;
      }
      /* OPT-IN: in the loan type only for the program names that add it. Half a tick — the
         box outlined in the accent with a bar, never the filled "asked of everyone" box. */
      .qcard.some .tick-box {
        border-color: var(--qc-accent);
        box-shadow: inset 0 0 0 4px var(--qc-surface);
        background: color-mix(in srgb, var(--qc-accent) 55%, var(--qc-surface));
      }
      .optin-tag {
        padding: 1px 8px;
        border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, var(--qc-accent) 12%, transparent);
        color: var(--qc-accent);
        font-weight: 600;
      }
      .tick-icon {
        font-size: 12px;
        line-height: 1;
      }
      .row-meta {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        flex-wrap: wrap;
        font-size: var(--text-xs, 12px);
        color: var(--qc-muted);
      }
      .parked-tag {
        padding: 1px 8px;
        border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, var(--qc-warn) 14%, transparent);
        color: var(--qc-warn);
        font-weight: 600;
      }
      .empty-card {
        display: grid;
        justify-items: center;
        gap: var(--space-3, 12px);
        padding: var(--space-7, 48px) var(--space-6, 32px);
        background: var(--qc-surface);
        border: 1px solid var(--qc-line);
        border-radius: var(--qc-radius);
      }
      .no-match {
        display: grid;
        justify-items: center;
        gap: var(--space-3, 12px);
        margin-block-start: var(--space-4, 16px);
        padding: var(--space-7, 48px) var(--space-6, 32px);
        background: var(--qc-surface);
        border: 1px solid var(--qc-line);
        border-radius: var(--qc-radius);
      }
      .nm-title {
        margin: 0;
        font-weight: 600;
        color: var(--qc-text);
      }

      @media (max-width: 720px) {
        .page {
          padding: var(--space-4, 16px);
        }
        .tabs {
          inline-size: 100%;
          border-radius: var(--qc-radius);
        }
        .tab {
          flex: 1 1 auto;
          justify-content: center;
        }
        .qgrid {
          grid-template-columns: 1fr;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .tab,
        .ghost,
        .qcard,
        .meter-fill,
        .tick-box {
          transition: none;
        }
        .qcard:active .tick-box {
          transform: none;
        }
        .qcard.landed {
          animation: none;
        }
      }
    `,
  ],
})
export class QuestionCategoriesPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Active admin locale drives label language (ar build → Arabic, else English). */
  readonly isAr = inject(LOCALE_ID).startsWith('ar');

  readonly categories = LOAN_CATEGORIES;

  /** The flat pool, in the order applicants are asked (same flatten as the pool tab). */
  readonly rows = signal<QuestionRow[]>([]);
  /**
   * The STEPS, in the order the app pages them.
   *
   * Kept beside the flat rows because this screen now edits an order, and an order only
   * means something inside a step: the app renders one step per group and sorts the
   * questions within it, so a position that crossed a step boundary would describe nothing.
   * The tick list still ignores them — a question is ticked into a category whatever step it
   * sits in.
   */
  readonly groups = signal<ReadonlyArray<{ id: string; titleAr: string; titleEn: string }>>([]);
  /**
   * Is the panel in ORDER mode?
   *
   * A mode rather than handles on the tick cards, for two reasons the layout makes concrete.
   * A tick list wants a dense wrapped grid — four short cards a line, so 36 questions are one
   * screen — and an order list wants one column with the steps shown, because the sequence IS
   * the content and a wrapped grid has no readable "next". And the two verbs answer different
   * questions: whether a question is asked at all, and where. Mixing them puts a drag handle
   * on a card whose next click removes the row it is dragging.
   */
  readonly ordering = signal(false);
  readonly loading = signal(true);
  /** Ids with a write in flight — their row's tick is inert until it lands. */
  readonly saving = signal<ReadonlySet<string>>(new Set<string>());
  /** True while a BULK action is in flight (it rewrites many rows at once). */
  readonly busy = signal(false);
  readonly healthOpen = signal(false);
  /** Last change worth speaking aloud (bulk actions only — see `announce`). */
  readonly status = signal('');

  /** Which category's tab is open. Mirrored to `?cat=` so a reload lands back. */
  readonly active = signal<LoanCategory>(this.initialCategory());

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.searchCtrl.valueChanges, { initialValue: '' });

  readonly filtering = computed(() => this.query().trim() !== '');

  /** Search hits across the WHOLE pool — the tab splits them, not this. */
  readonly visible = computed<QuestionRow[]>(() => {
    const needle = this.query().trim().toLowerCase();
    if (needle === '') return this.rows();
    return this.rows().filter((q) => this.haystack(q).includes(needle));
  });

  /**
   * The card that just changed section, so it can land rather than blink into
   * existence — the two sections are separate lists, so a tick DESTROYS the card
   * in one and CREATES it in the other, and without the animation the eye has
   * nothing to follow. Cleared once the animation is done.
   */
  readonly justMoved = signal<string | null>(null);

  /**
   * What the open category asks, IN ITS OWN ORDER.
   *
   * Sorted by the position stored on the assignment row, falling back to the pool's own for
   * a server that predates the field — the same chain, in the same sequence, that
   * `orderedForCategory` applies on the serve path and `questionIdsInCategory` applies in the
   * repository. Three readings of one order is how a screen ends up showing a sequence the
   * applicant does not get.
   */
  readonly asked = computed(() => {
    const category = this.active();
    return this.visible()
      .filter((q) => this.inCategory(q, category))
      .sort(
        (a, b) =>
          this.positionIn(a, category) - this.positionIn(b, category) ||
          a.displayOrder - b.displayOrder ||
          a.code.localeCompare(b.code),
      );
  });

  /** A question's position in one category: its own when stated, else the pool's. */
  private positionIn(q: QuestionRow, category: LoanCategory): number {
    return q.categoryOrder?.[category] ?? q.displayOrder;
  }

  /**
   * The asked set, split into the STEPS the app pages — the list order mode drags.
   *
   * Empty steps are dropped, exactly as the publish does: a step with nothing to ask never
   * reaches the applicant, so a heading for it here would name a screen that does not exist.
   */
  readonly askedByStep = computed<
    ReadonlyArray<{ id: string; title: string; rows: QuestionRow[] }>
  >(() => {
    const asked = this.asked();
    return this.groups()
      .map((g) => ({
        id: g.id,
        title: this.isAr ? g.titleAr : g.titleEn,
        rows: asked.filter((q) => q.groupId === g.id),
      }))
      .filter((step) => step.rows.length > 0);
  });

  /**
   * Can the list be dragged right now?
   *
   * Not while a search is on, for the reason the pool tab states: the order on screen is a
   * filtered one, so dropping a row between two visible neighbours would put it somewhere the
   * operator cannot see. The arrows stay live — they move a row one place in the FULL list,
   * which is a move the operator can still reason about.
   */
  readonly reorderable = computed(() => !this.filtering() && !this.busy());
  readonly notAsked = computed(() =>
    this.visible().filter((q) => !this.inCategory(q, this.active())),
  );

  /**
   * The panel's two lists. A pair rather than two blocks in the template so the
   * row markup is written once — the sections differ only in tone and heading.
   */
  readonly sections = computed<ReadonlyArray<{ key: 'asked' | 'rest'; rows: QuestionRow[] }>>(
    () => [
      { key: 'asked', rows: this.asked() },
      { key: 'rest', rows: this.notAsked() },
    ],
  );

  /** Asked for nothing: kept and editable, but no applicant ever sees it. */
  readonly parked = computed(() => this.rows().filter((q) => q.categories.length === 0));

  /**
   * A question that appears only after a specific answer, in a category where the
   * question it branches on is NOT asked. The server never hides a question whose
   * rule cannot be evaluated, so the branch silently stops working rather than
   * failing — which makes this list the only place it is visible.
   */
  readonly dangling = computed<DanglingBranch[]>(() => {
    const all = this.rows();
    const byCode = new Map(all.map((q) => [q.code, q]));
    const out: DanglingBranch[] = [];
    for (const q of all) {
      const sourceCode = q.enabledWhen?.questionCode;
      if (!sourceCode) continue;
      const source = byCode.get(sourceCode);
      if (!source) continue; // unknown source: the pool tab's own guards own that
      const orphanedIn = q.categories.filter((c) => !source.categories.includes(c));
      if (orphanedIn.length > 0) out.push({ question: q, sourceCode, orphanedIn });
    }
    return out;
  });

  readonly issueCount = computed(() => this.parked().length + this.dangling().length);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  // ---- Tabs ----------------------------------------------------------------
  select(category: LoanCategory): void {
    if (this.active() === category) return;
    this.active.set(category);
    this.justMoved.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cat: category },
      queryParamsHandling: 'merge',
      // A tab switch is not a place in history: Back should leave the screen,
      // not walk the four categories the admin flicked through.
      replaceUrl: true,
    });
  }

  /**
   * Arrow / Home / End over the tab strip (WAI-ARIA tabs). Selection follows
   * focus because the panel is already in memory — there is nothing to load.
   */
  onTabKey(event: KeyboardEvent, current: LoanCategory): void {
    const last = this.categories.length - 1;
    const at = this.categories.indexOf(current);
    const forward = this.isAr ? 'ArrowLeft' : 'ArrowRight';
    const back = this.isAr ? 'ArrowRight' : 'ArrowLeft';
    let next: number | null = null;
    if (event.key === forward) next = at === last ? 0 : at + 1;
    else if (event.key === back) next = at === 0 ? last : at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    const target = this.categories[next];
    if (!target) return;
    event.preventDefault();
    this.select(target);
    document.getElementById(`qcat-tab-${target}`)?.focus();
  }

  private initialCategory(): LoanCategory {
    const fromUrl = this.route.snapshot.queryParamMap.get('cat');
    return isLoanCategory(fromUrl) ? fromUrl : 'personal';
  }

  // ---- Display helpers -----------------------------------------------------
  label(category: LoanCategory): string {
    return categoryLabel(category);
  }

  labelsOf(categories: readonly LoanCategory[]): string {
    return categories.map((c) => this.label(c)).join(this.isAr ? '، ' : ', ');
  }

  wordingOf(q: QuestionRow): string {
    return this.isAr ? q.questionAr : q.questionEn;
  }

  /** Asked of EVERY applicant of the category — an ordinary row. */
  has(q: QuestionRow, category: LoanCategory): boolean {
    return q.categories.includes(category) && !this.optIn(q, category);
  }

  /**
   * In the category only for the program names that ADD it — an opt-in row, written from a
   * name's own questions step. Drawn half-ticked: it is there, but not asked of everyone.
   */
  optIn(q: QuestionRow, category: LoanCategory): boolean {
    return (q.optInCategories ?? []).includes(category);
  }

  /** Any row at all — what the order list and the whole-set reorder must carry. */
  private inCategory(q: QuestionRow, category: LoanCategory): boolean {
    return q.categories.includes(category);
  }

  /** The ordinary set — what the category write replaces; opt-in rows ride along server-side. */
  private ordinaryOf(q: QuestionRow): LoanCategory[] {
    return q.categories.filter((c) => !this.optIn(q, c));
  }

  optInText(q: QuestionRow, category: LoanCategory): string {
    const n = q.addedByNames?.[category] ?? 0;
    return $localize`:@@qcat.optin_tag:Only programs that add it · ${n}:COUNT:`;
  }

  /** How many questions in the WHOLE pool a category asks every applicant (tab counts). */
  countOf(category: LoanCategory): number {
    return this.rows().filter((q) => this.has(q, category)).length;
  }

  /** Share of the pool the open tab asks — the meter's length. */
  pctOf(category: LoanCategory): number {
    const total = this.rows().length;
    return total === 0 ? 0 : Math.round((this.countOf(category) / total) * 100);
  }

  /**
   * Each tick needs its own name: "checkbox" alone tells a screen-reader user
   * nothing about which question and which category they are about to change.
   */
  cellLabel(q: QuestionRow, category: LoanCategory): string {
    const wording = this.wordingOf(q);
    const cat = this.label(category);
    return $localize`:@@qcat.cell_aria:Ask "${wording}:question:" for ${cat}:category:`;
  }

  private haystack(q: QuestionRow): string {
    return [q.questionEn, q.questionAr, q.code, ...q.options.flatMap((o) => [o.labelEn, o.labelAr])]
      .join(' ')
      .toLowerCase();
  }

  clearFilters(): void {
    this.searchCtrl.setValue('');
  }

  // ---- Writes --------------------------------------------------------------
  /**
   * Flip one row for the open tab. Optimistic: the tick moves before the round
   * trip, because the admin's next action is usually the row below and a 200 ms
   * wait per tick would make assigning 40 questions unbearable.
   *
   * A failure puts the row back exactly as it was and re-reads the pool WITHOUT
   * the loading state: throwing the whole panel back to a spinner over one
   * rejected row reads as the screen refreshing itself, and loses the admin's
   * scroll position for a change that never happened.
   */
  async toggle(q: QuestionRow, category: LoanCategory): Promise<void> {
    // Guarded here rather than with `[disabled]`: disabling the button the user
    // just activated destroys focus mid-interaction, which strands a keyboard or
    // screen-reader user in the middle of the list. The row reports `aria-busy`
    // and stays focusable instead.
    if (this.saving().has(q.id) || this.busy()) return;
    // An OPT-IN cell asks the question of the names that added it. One click would ask it of
    // every applicant of the category instead — a different decision, so it is named first.
    if (this.optIn(q, category)) {
      const wording = this.wordingOf(q);
      const cat = this.label(category);
      const n = q.addedByNames?.[category] ?? 0;
      this.modal.confirm({
        nzTitle: $localize`:@@qcat.optin_confirm_title:Ask “${wording}:QUESTION:” of every ${cat}:TYPE: applicant?`,
        nzContent: $localize`:@@qcat.optin_confirm_body:Today only the programs that added it ask it — ${n}:COUNT: of them. Every ${cat}:TYPE: program will ask it from now on.`,
        nzOkText: $localize`:@@qcat.optin_confirm_ok:Ask everyone`,
        nzCancelText: $localize`:@@qcat.optin_confirm_cancel:Leave it`,
        nzOnOk: () => {
          void this.write(q, category);
          return true;
        },
      });
      return;
    }
    await this.write(q, category);
  }

  /**
   * The flip itself. The body is the ORDINARY set; the server carries every opt-in row over,
   * turns a listed one ordinary, and keeps an unticked row as opt-in while a program name
   * still adds it — so the optimistic patch below says the same.
   */
  private async write(q: QuestionRow, category: LoanCategory): Promise<void> {
    const before = { categories: q.categories, optInCategories: q.optInCategories ?? [] };
    const ordinary = this.ordinaryOf(q);
    const nextOrdinary = this.has(q, category)
      ? ordinary.filter((c) => c !== category)
      : this.canonical([...ordinary, category]);
    const keptOptIn = before.optInCategories.filter((c) => !nextOrdinary.includes(c));
    const fallsBack =
      this.has(q, category) && (q.addedByNames?.[category] ?? 0) > 0 ? [category] : [];
    const nextOptIn = this.canonical([...keptOptIn, ...fallsBack]);
    this.patchRow(q.id, this.canonical([...nextOrdinary, ...nextOptIn]), nextOptIn);
    this.markLanded(q.id);
    this.markSaving(q.id, true);
    try {
      await this.api.setQuestionCategories(q.id, nextOrdinary);
    } catch {
      // The toast interceptor already surfaced the typed error (A22).
      this.patchRow(q.id, [...before.categories], [...before.optInCategories]);
      await this.load({ quiet: true });
    } finally {
      this.markSaving(q.id, false);
    }
  }

  /**
   * Add or remove the whole LISTED set in ONE request: the server writes them in
   * one transaction and publishes one version, where a loop would publish one per
   * question. Rows already in the wanted state are skipped so the request carries
   * only real changes.
   */
  async setColumn(category: LoanCategory, on: boolean): Promise<void> {
    if (this.busy()) return;
    const changes: QuestionCategoryAssignment[] = [];
    for (const q of this.visible()) {
      if (this.has(q, category) === on) continue;
      // The ORDINARY set: a program name's opt-in rows ride along on the server, and an opt-in
      // row this column turns on becomes ordinary like any other tick.
      const ordinary = this.ordinaryOf(q);
      changes.push({
        questionId: q.id,
        categories: on
          ? this.canonical([...ordinary, category])
          : ordinary.filter((c) => c !== category),
      });
    }
    if (changes.length === 0) return;
    this.busy.set(true);
    try {
      const tree = await this.api.setQuestionCategoriesBulk(changes);
      this.rows.set(flatten(tree));
      this.announce(changes.length, category, on);
    } catch {
      await this.load({ quiet: true });
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * A bulk action rewrites rows the user is not focused on, so nothing would be
   * spoken: `aria-checked` only announces on the focused control. The status
   * region says what actually changed and how much.
   */
  private announce(count: number, category: LoanCategory, on: boolean): void {
    const cat = this.label(category);
    this.status.set(
      on
        ? $localize`:@@qcat.live_added:${count}:count: questions are now asked for ${cat}:category:`
        : $localize`:@@qcat.live_removed:${count}:count: questions are no longer asked for ${cat}:category:`,
    );
  }

  // ---- Order ---------------------------------------------------------------
  /**
   * A drag landed inside ONE step.
   *
   * The indices are the step's, so the move is applied to the step's own slice and the whole
   * category is then re-flattened in step order — which is the list the server wants. Moving
   * within a slice is also what keeps a drag from carrying a question out of the step it is
   * asked in: the drop lists are per step and never connected, so a row cannot leave its
   * screen by accident.
   */
  async dropInStep(stepId: string, previousIndex: number, currentIndex: number): Promise<void> {
    if (previousIndex === currentIndex) return;
    const steps = this.askedByStep();
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    const moved = [...step.rows];
    const [row] = moved.splice(previousIndex, 1);
    if (!row) return;
    moved.splice(currentIndex, 0, row);
    await this.commitOrder(steps.map((s) => (s.id === stepId ? { ...s, rows: moved } : s)));
  }

  /**
   * The keyboard twin of the drag, and the only way to move a row while the list is
   * filtered — the same pair the pool tab ships, for the same reason.
   *
   * Clamped INSIDE the step: one step is one screen on the app, and an arrow that carried a
   * question into the next one would be answering a different question (which step is this
   * asked in) with the control for this one.
   */
  async moveBy(q: QuestionRow, delta: number): Promise<void> {
    const steps = this.askedByStep();
    const step = steps.find((s) => s.rows.some((r) => r.id === q.id));
    if (!step) return;
    const from = step.rows.findIndex((r) => r.id === q.id);
    const to = from + delta;
    if (to < 0 || to >= step.rows.length) return;
    await this.dropInStep(step.id, from, to);
  }

  /**
   * Optimistic, like every other write on this screen: the list re-renders before the round
   * trip so a dragged row does not snap back under the cursor, and a rejected reorder reloads
   * the server's truth rather than guessing what it kept.
   *
   * Writes the new positions onto the rows in memory rather than re-sorting from the server's
   * answer, because `asked` sorts by exactly those numbers — without them the list would
   * repaint in the old order for as long as the request takes.
   */
  private async commitOrder(
    steps: ReadonlyArray<{ id: string; rows: QuestionRow[] }>,
  ): Promise<void> {
    const category = this.active();
    const previous = this.rows();
    const ordered = steps.flatMap((s) => s.rows);
    const positions = new Map(ordered.map((q, index) => [q.id, index] as const));
    this.rows.update((rows) =>
      rows.map((r) =>
        positions.has(r.id)
          ? { ...r, categoryOrder: { ...(r.categoryOrder ?? {}), [category]: positions.get(r.id) } }
          : r,
      ),
    );
    this.busy.set(true);
    try {
      // The WHOLE asked set, in step order — the contract the server holds this to. The
      // dragged step alone would be a slice the server cannot place.
      await this.api.reorderCategoryQuestions(category, [...positions.keys()]);
      this.status.set(
        $localize`:@@qcat.live_reordered:Order saved for ${this.label(category)}:category:`,
      );
    } catch {
      // Localized toast already shown by the interceptor.
      this.rows.set(previous);
    } finally {
      this.busy.set(false);
    }
  }

  // ---- Internals -----------------------------------------------------------
  /**
   * `quiet` re-reads without the spinner — used after a rejected write, where
   * the panel is already on screen and blanking it would read as a page refresh.
   */
  private async load(opts: { quiet?: boolean } = {}): Promise<void> {
    if (!opts.quiet) this.loading.set(true);
    try {
      const tree = await this.api.tree();
      this.rows.set(flatten(tree));
      // The steps, in the app's own paging order. Taken from the same response as the rows
      // for the reason `categories` rides on the tree at all: two fetches would be two ways
      // for the list and its headings to disagree.
      this.groups.set(tree.map((g) => ({ id: g.id, titleAr: g.titleAr, titleEn: g.titleEn })));
    } finally {
      if (!opts.quiet) this.loading.set(false);
    }
  }

  /**
   * Flag the card that just changed section for one animation, then drop the
   * flag — left set, it would replay every time the grid re-renders (a search
   * keystroke, a neighbour's write) on a card that moved minutes ago.
   */
  private markLanded(id: string): void {
    this.justMoved.set(id);
    setTimeout(() => {
      if (this.justMoved() === id) this.justMoved.set(null);
    }, LAND_ANIMATION_MS);
  }

  private patchRow(id: string, categories: LoanCategory[], optInCategories?: LoanCategory[]): void {
    this.rows.update((rows) =>
      rows.map((r) =>
        r.id === id
          ? { ...r, categories, ...(optInCategories === undefined ? {} : { optInCategories }) }
          : r,
      ),
    );
  }

  private markSaving(id: string, on: boolean): void {
    this.saving.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Canonical order + no duplicates, so a row's set renders the same every time. */
  private canonical(categories: LoanCategory[]): LoanCategory[] {
    return LOAN_CATEGORIES.filter((c) => categories.includes(c));
  }
}

/**
 * Groups still come back from `tree()` (they page the mobile wizard) but carry no
 * meaning here: the pool is authored flat and `displayOrder` is the one global
 * sequence applicants are asked in.
 */
function flatten(tree: ReadonlyArray<{ questions: QuestionRow[] }>): QuestionRow[] {
  return tree
    .flatMap((g) => g.questions)
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
