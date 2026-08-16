import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  ArrowLeftOutline,
  CheckOutline,
  CheckSquareOutline,
  CloseCircleOutline,
  LockOutline,
  MinusSquareOutline,
  PlusOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { PageHeaderComponent, RailTabsComponent, type RailTabItem } from '@shared/ui';
import {
  LOAN_CATEGORIES,
  categoryLabel,
  isLoanCategory,
  type LoanCategory,
} from '@core/loan-category';
import {
  LookupsApiService,
  type CatalogQuestion,
  type CatalogQuestionType,
} from '../lookups/lookups.api.service';
import { ENUM_TYPE, absorbProgramNames, type ProgramNameRow } from './program-name-row';
import {
  NewQuestionDialogComponent,
  type NewQuestionDialogData,
  type NewQuestionResult,
} from './components/new-question.dialog';

/** Long enough to read as a move, short enough not to queue behind a fast tapper. */
const LAND_ANIMATION_MS = 260;

/** A question row as this screen renders it, resolved against the active tab. */
interface QuestionRow {
  code: string;
  label: string;
  type: CatalogQuestionType;
  /** True when the ACTIVE category asks this question. */
  inScope: boolean;
  /** True when the code is picked but resolves to nothing in the active pool. */
  removed: boolean;
}

/**
 * One catalog program name, configured per loan category.
 *
 * Replaces the two rail boards this feature shipped with (`program-categories`
 * and `program-questions`), which asked the operator to hold a 16×4 assignment
 * and a 16×43 template in their head on two separate screens and then compare
 * them mentally. Both facts are about ONE name, so they belong on one screen
 * about that name — reached by opening it from the catalog, the way every other
 * object in this dashboard is reached.
 *
 * Two axes, four tabs, one panel each:
 *
 * - **Offered under this loan type** — the authoritative assignment. The
 *   bank-program builder filters its Program name picker on it and the API
 *   rejects an unassigned pair, so it gates the tab: a name that cannot be sold
 *   as a car loan has no car-loan applicants to score.
 * - **Questions scored on** — the archetype's suggestion for that category, and
 *   ADVISORY ONLY. It pre-ticks step 1 of each bank program's scoring wizard and
 *   constrains nothing; `saveWeights` never reads it, so nothing here can
 *   invalidate a weight set a bank already saved. No weights either: two banks
 *   offering "New Car" price it differently, which is the whole marketplace, so a
 *   shared weight would be a value with no owner.
 *
 * The template is stored PER CATEGORY, not once per name, because the products
 * differ — "Pharmacy" as a personal loan cares about salary, as a business loan
 * about company age. Tabs over one flat set would silently tie those two answers
 * together.
 *
 * Nothing is pruned. A pick left outside its category's asked set, or under a
 * category the name is no longer offered under, is KEPT and flagged: the fix
 * belongs to whoever narrowed the scope, and deleting configuration an admin
 * never asked to lose is worse than showing them a warning.
 *
 * Saves on every tap; there is no Save button and nothing to publish.
 */
@Component({
  selector: 'app-program-name-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzToolTipModule,
    PageHeaderComponent,
    RailTabsComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      CheckOutline,
      CheckSquareOutline,
      CloseCircleOutline,
      LockOutline,
      MinusSquareOutline,
      PlusOutline,
      SearchOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <a class="back" routerLink="..">
        <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@pnd.back">All program names</span>
      </a>

      @if (loading()) {
        <div class="loading"><nz-spin nzSimple></nz-spin></div>
      } @else {
        <!-- Nested rather than an @else if that binds the row: an "as" binding is
             only legal on a PRIMARY @if. -->
        @if (name(); as n) {
          <app-page-header
            eyebrow="Program catalog"
            i18n-eyebrow="@@pnd.eyebrow"
            [title]="nameOf(n)"
            subtitle="Pick the loan types this name is offered under, then the questions each type scores on. Every bank that offers it starts from your list and sets its own weights."
            i18n-subtitle="@@pnd.sub"
          >
            <div class="header-aside">
              <span class="usage">
                @if (n.usage.programs === 0) {
                  <span i18n="@@pnd.usage_none">Not offered by any bank yet</span>
                } @else {
                  {{ usageLabel(n) }}
                }
              </span>
              <span class="autosave" i18n="@@pnd.autosave">Saves automatically</span>
            </div>
          </app-page-header>

          <app-rail-tabs
            [items]="tabs()"
            [activeId]="activeCategory()"
            [ariaLabel]="tabsAria"
            idPrefix="pnd"
            (select)="selectCategory($event)"
          />

          <div
            class="panel"
            role="tabpanel"
            [id]="'pnd-panel-' + activeCategory()"
            [attr.aria-labelledby]="'pnd-tab-' + activeCategory()"
          >
            <!-- Gate first, list second: the switch decides whether the list below
               means anything, so it reads top-down as one sentence. -->
            <div class="gate" [class.on]="offered()">
              <button
                type="button"
                role="switch"
                class="switch"
                [attr.aria-checked]="offered()"
                [attr.aria-label]="offerLabel(n)"
                [attr.aria-busy]="savingOffer()"
                (click)="toggleOffered()"
              >
                <span class="track" aria-hidden="true"><span class="thumb"></span></span>
                <span class="switch-text">
                  <span class="switch-title">{{ offerLabel(n) }}</span>
                  <span class="switch-hint">
                    @if (offered()) {
                      <!-- Says WHO sees the effect and WHERE. "Banks can sell it"
                         described a business fact the admin cannot see; the name
                         appearing in a picker is the thing they can go and check. -->
                      <span i18n="@@pnd.gate_on_hint"
                        >A bank adding a {{ categoryName() }} program can pick this name.</span
                      >
                    } @else if (pickedCount() > 0) {
                      <!-- The one state that needs explaining: picks exist but are
                         inert. Saying they survive is what stops an admin from
                         "fixing" it by re-entering them somewhere else. -->
                      <span i18n="@@pnd.gate_off_kept_hint"
                        >A bank adding a {{ categoryName() }} program can’t pick this name. Your
                        {{ pickedCount() }} chosen questions stay saved and come back when you turn
                        this on.</span
                      >
                    } @else {
                      <span i18n="@@pnd.gate_off_hint"
                        >A bank adding a {{ categoryName() }} program can’t pick this name. Turn
                        this on to allow it, then choose what those applicants are scored on.</span
                      >
                    }
                  </span>
                </span>
              </button>
            </div>

            @if (scope().length === 0) {
              <!-- The pool having nothing for this loan type is the one dead end on
                   this screen where the existing exit (assign something) can be the
                   WRONG advice — there may be nothing to assign. So the primary way
                   out is to write the question, and the assign link stays as the
                   secondary. -->
              <div class="notice">
                <span i18n="@@pnd.no_questions"
                  >{{ categoryName() }} applicants aren’t asked any questions yet.</span
                >
                <button
                  nz-button
                  nzType="primary"
                  nzSize="small"
                  type="button"
                  (click)="openNewQuestion()"
                >
                  <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@pnd.write_first">Write the first question</span>
                </button>
                <a routerLink="/questionnaire/categories" i18n="@@pnd.no_questions_link"
                  >Assign questions to this loan type</a
                >
              </div>
            } @else if (!offered()) {
              <!-- Locked: rendered as text, not disabled buttons. A disabled control
                 still takes a tab stop in some browsers and reads as "broken"
                 rather than "not yet"; plain rows read as a preview. -->
              <div class="locked" aria-live="polite">
                <p class="locked-line">
                  <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
                  <!-- Points at the switch by POSITION, not by quoting its label: the
                     label now carries the name, and nesting that inside quotes read
                     as two sentences fighting for the same pair of quote marks. -->
                  <span i18n="@@pnd.locked"
                    >{{ scope().length }} questions are asked here. Turn on the switch above to pick
                    which ones this name scores on.</span
                  >
                </p>
                <ul class="grid grid-locked" role="list">
                  @for (q of lockedPreview(); track q.code) {
                    <li class="card is-locked" [class.on]="isPicked(q.code)">
                      <span class="card-head">
                        <span class="tick" aria-hidden="true">
                          @if (isPicked(q.code)) {
                            <span nz-icon nzType="check" nzTheme="outline"></span>
                          }
                        </span>
                        <span class="q-label">{{ q.label }}</span>
                      </span>
                      <span class="card-meta">
                        <span class="qtype">{{ typeLabel(q.type) }}</span>
                      </span>
                    </li>
                  }
                </ul>
                @if (scope().length > lockedPreview().length) {
                  <p class="locked-more" i18n="@@pnd.locked_more">
                    and {{ scope().length - lockedPreview().length }} more
                  </p>
                }
              </div>
            } @else {
              <div class="controls">
                <div class="coverage">
                  <span class="cov-count">
                    {{ pickedInScope().length }}
                    <span class="cov-of" i18n="@@pnd.count"
                      >of {{ scope().length }} questions asked here</span
                    >
                  </span>
                  <span class="meter" aria-hidden="true">
                    <span class="meter-fill" [style.inline-size.%]="pct()"></span>
                  </span>
                  <!-- The meter counts IN-SCOPE picks only, so without this line the
                       section below ("Scored on 11") disagrees with it by exactly the
                       drifted rows and reads as a bug in the page. -->
                  @if (driftedCount() > 0) {
                    <span class="cov-drift" i18n="@@pnd.count_drift"
                      >+{{ driftedCount() }} kept from a change made elsewhere</span
                    >
                  }
                </div>

                <span class="controls-spacer"></span>

                <!-- One segmented pair, not two loose buttons: they are the two
                     directions of a single set operation over the same list, and
                     rendering them as separate pills made three peer actions on a
                     row where only one of them authors anything. The two icons are
                     the checkbox states the operation LEAVES BEHIND, which is what
                     lets the labels drop the long "everything listed" phrasing and
                     give the row back the width the search needed. -->
                <span class="bulk" role="group" [attr.aria-label]="bulkAria">
                  <button
                    nz-button
                    type="button"
                    class="bulk-tick"
                    [disabled]="busy()"
                    nz-tooltip
                    nzTooltipTitle="Score this name on every question listed"
                    i18n-nzTooltipTitle="@@pnd.pick_all_tip"
                    (click)="setAllVisible(true)"
                  >
                    <span nz-icon nzType="check-square" nzTheme="outline" aria-hidden="true"></span>
                    <span i18n="@@pnd.pick_all">Tick all listed</span>
                  </button>
                  <button
                    nz-button
                    type="button"
                    class="bulk-untick"
                    [disabled]="busy()"
                    nz-popconfirm
                    [nzCondition]="!wouldClearAll()"
                    nzPopconfirmTitle="This clears the list for this loan type — bank programs created from it will start from nothing."
                    i18n-nzPopconfirmTitle="@@pnd.clear_all_confirm"
                    nzPopconfirmPlacement="bottomRight"
                    (nzOnConfirm)="setAllVisible(false)"
                    nz-tooltip
                    nzTooltipTitle="Stop scoring on every question listed"
                    i18n-nzTooltipTitle="@@pnd.clear_all_tip"
                  >
                    <span nz-icon nzType="minus-square" nzTheme="outline" aria-hidden="true"></span>
                    <span i18n="@@pnd.clear_all">Untick all listed</span>
                  </button>
                </span>

                <nz-input-group [nzPrefix]="searchIcon" class="search">
                  <input
                    nz-input
                    [formControl]="searchCtrl"
                    placeholder="Search questions"
                    i18n-placeholder="@@pnd.search_ph"
                    [attr.aria-label]="searchAria"
                  />
                </nz-input-group>
                <ng-template #searchIcon>
                  <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
                </ng-template>

                <!-- Its own zone behind a hairline, not a third peer of the two
                     bulk buttons: those are set operations over content that
                     already exists, this authors new content for the whole
                     platform. Rendering them alike would say they are the same
                     kind of act. -->
                <span class="controls-sep" aria-hidden="true"></span>
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  class="new-q"
                  [disabled]="busy()"
                  nz-tooltip
                  nzTooltipTitle="Write a question and tick it into this name in one go"
                  i18n-nzTooltipTitle="@@pnd.new_question_tip"
                  (click)="openNewQuestion()"
                >
                  <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@pnd.new_question">New question</span>
                </button>
              </div>

              <!-- The one outcome the autosave chip would otherwise lie about: the
                   question IS created and live, only the tick did not land. Stated
                   inline and persistently, because a toast for a state the operator
                   has to act on is a toast they will miss. -->
              @if (tickFailed(); as failed) {
                <p class="tick-failed" role="alert">
                  <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@pnd.tick_failed"
                    >“{{ failed }}” was created, but ticking it here didn’t save. Tap it below to
                    score this name on it.</span
                  >
                  <button
                    type="button"
                    class="linkish"
                    (click)="dismissTickFailed()"
                    i18n="@@pnd.dismiss"
                  >
                    Dismiss
                  </button>
                </p>
              }

              @if (filtering()) {
                <p class="filter-note">
                  <span i18n="@@pnd.showing"
                    >{{ visibleScope().length }} of {{ scope().length }} questions</span
                  >
                  <button type="button" class="linkish" (click)="clearFilter()" i18n="@@pnd.clear">
                    Clear
                  </button>
                </p>
              }

              <p class="sr-only" role="status" aria-live="polite">{{ status() }}</p>

              @for (s of sections(); track s.key) {
                @if (s.rows.length > 0 || s.key === 'scored') {
                  <section class="sec">
                    <h2 class="sec-title">
                      @if (s.key === 'scored') {
                        <span i18n="@@pnd.sec_scored">Scored on</span>
                      } @else {
                        <span i18n="@@pnd.sec_rest">Not scored on</span>
                      }
                      <span class="sec-count">{{ s.rows.length }}</span>
                    </h2>

                    @if (s.rows.length === 0) {
                      <p class="sec-empty" i18n="@@pnd.none_scored">
                        Nothing yet — tap a question below, or use “Tick all listed”.
                      </p>
                    } @else {
                      <ul class="grid" role="list">
                        @for (q of s.rows; track q.code) {
                          <li>
                            <button
                              type="button"
                              class="card"
                              role="checkbox"
                              [class.on]="s.key === 'scored'"
                              [class.landed]="justMoved() === q.code"
                              [attr.aria-checked]="s.key === 'scored'"
                              [attr.aria-label]="cellLabel(q)"
                              [attr.aria-busy]="saving().has(q.code) || busy()"
                              (click)="toggleQuestion(q)"
                            >
                              <span class="card-head">
                                <span class="tick" aria-hidden="true">
                                  @if (s.key === 'scored') {
                                    <span nz-icon nzType="check" nzTheme="outline"></span>
                                  }
                                </span>
                                <span class="q-label">{{ q.label }}</span>
                              </span>
                              <span class="card-meta">
                                <span class="qtype">{{ typeLabel(q.type) }}</span>
                                @if (q.removed) {
                                  <span class="tag warn" i18n="@@pnd.removed_tag"
                                    >removed from the pool</span
                                  >
                                } @else if (!q.inScope) {
                                  <span class="tag warn" i18n="@@pnd.drift_tag"
                                    >not asked here</span
                                  >
                                }
                              </span>
                            </button>
                          </li>
                        }
                      </ul>
                    }
                  </section>
                }
              }

              @if (filtering() && visibleScope().length === 0 && pickedRows().length === 0) {
                <div class="no-match">
                  <p i18n="@@pnd.no_matches_title">No questions match that search</p>
                  <!-- They just typed the exact wording they were hunting for.
                       Offering to create it costs one seeded field. -->
                  <button
                    nz-button
                    nzType="primary"
                    nzSize="small"
                    type="button"
                    (click)="openNewQuestion(query())"
                  >
                    <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                    <span i18n="@@pnd.create_searched"
                      >Create “{{ query() }}” as a new question</span
                    >
                  </button>
                  <button type="button" class="linkish" (click)="clearFilter()" i18n="@@pnd.clear">
                    Clear
                  </button>
                </div>
              }
            }
          </div>
        } @else {
          <!-- Reachable by typing a URL, and by opening a name a colleague
               deprecated in the meantime. Says which key failed, because "not
               found" on a page with no other content is a dead end. -->
          <div class="missing">
            <p class="missing-title" i18n="@@pnd.missing_title">
              No program name matches “{{ routeKey() }}”.
            </p>
            <p class="missing-body" i18n="@@pnd.missing_body">
              It may have been renamed or deprecated. Open it from the catalog instead.
            </p>
            <a nz-button nzType="primary" routerLink=".." i18n="@@pnd.missing_cta">
              Back to the catalog
            </a>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        --pnd-surface: var(--color-surface-default);
        --pnd-line: var(--border-subtle);
        --pnd-line-strong: var(--border-default);
      }
      /* One column, generous rhythm: the page is a sentence (which loan types →
         which questions), not a dashboard of peers. */
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding: var(--space-6);
        max-inline-size: 1120px;
        margin-inline: auto;
      }
      .back {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        align-self: flex-start;
        min-block-size: 32px;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        text-decoration: none;
      }
      .back:hover {
        color: var(--color-text-link);
      }
      .back:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }
      /* The arrow points "back", which is the leading edge — it must flip in
         Arabic, and a logical property cannot do that to a glyph. */
      :host-context([dir='rtl']) .back [nz-icon] {
        transform: scaleX(-1);
      }
      .header-aside {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-1);
        text-align: end;
      }
      .usage {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .autosave {
        font-size: var(--text-xxs);
        color: var(--color-text-tertiary);
      }
      .loading {
        padding: var(--space-8) 0;
        text-align: center;
      }
      .missing {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-6);
        border: 1px solid var(--pnd-line-strong);
        border-radius: var(--radius-lg);
        background: var(--pnd-surface);
      }
      .missing-title {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .missing-body {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      /* --- Panel ----------------------------------------------------------- */
      .panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-inline-size: 0;
      }

      /* --- The gate -------------------------------------------------------- */
      .gate {
        border: 1px solid var(--pnd-line-strong);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* On = brand edge and the page surface: the gate stops being the thing you
         must deal with and becomes a heading for the list below. */
      .gate.on {
        border-color: color-mix(in srgb, var(--color-brand-primary) 35%, var(--pnd-line));
        background: var(--pnd-surface);
      }
      .switch {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        inline-size: 100%;
        min-block-size: 44px;
        padding: var(--space-4);
        border: none;
        border-radius: var(--radius-md);
        background: none;
        text-align: start;
        cursor: pointer;
      }
      /* The track darkens on hover; the panel behind it does not. Repainting the
         gate's background on hover made the whole strip look toggled. */
      .switch:hover .track {
        background: var(--color-text-tertiary);
      }
      .switch[aria-checked='true']:hover .track {
        background: color-mix(in srgb, var(--color-brand-primary) 85%, black);
      }
      .switch:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .switch[aria-busy='true'] {
        opacity: 0.65;
      }
      .track {
        position: relative;
        flex: none;
        display: block;
        inline-size: 40px;
        block-size: 24px;
        margin-block-start: 1px;
        border-radius: var(--radius-pill);
        background: var(--color-border-strong);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .switch[aria-checked='true'] .track {
        background: var(--color-brand-primary);
      }
      .thumb {
        position: absolute;
        inset-block-start: 3px;
        inset-inline-start: 3px;
        inline-size: 18px;
        block-size: 18px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-default);
        box-shadow: var(--shadow-sm);
        /* Logical inset + a logical translate, so the thumb travels toward the
           trailing edge in both directions instead of always rightward. */
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .switch[aria-checked='true'] .thumb {
        transform: translateX(16px);
      }
      :host-context([dir='rtl']) .switch[aria-checked='true'] .thumb {
        transform: translateX(-16px);
      }
      .switch-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .switch-title {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .switch-hint {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .cov-drift {
        font-size: var(--text-xxs);
        color: var(--color-text-tertiary);
      }

      /* --- Locked preview -------------------------------------------------- */
      .locked {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .locked-line {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
      }
      .locked-more {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      /* Faded, not hidden: the point is to show what turning the switch on will
         let you do. Interaction is removed by rendering list items instead of
         buttons, not by opacity — so 0.7, which keeps the labels readable rather
         than the 0.5 that would say "disabled" at the cost of contrast. */
      .grid-locked {
        opacity: 0.7;
      }
      .card.is-locked {
        cursor: default;
        box-shadow: none;
      }
      /* Nothing happens on hover here, so nothing may LOOK like it will. Declared
         after the .card:hover rule it has to undo. */
      .card.is-locked:hover {
        border-color: var(--pnd-line);
        box-shadow: none;
      }

      .notice {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--pnd-line-strong);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .notice a {
        color: var(--color-text-link);
      }

      /* --- Controls -------------------------------------------------------- */
      .controls {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--pnd-line);
        border-radius: var(--radius-md);
        background: var(--pnd-surface);
      }
      .coverage {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 180px;
        max-inline-size: 260px;
      }
      .cov-count {
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        font-family: var(--font-family-numeric);
        font-feature-settings: var(--font-feature-tabular);
        color: var(--color-text-primary);
      }
      .cov-of {
        margin-inline-start: var(--space-1);
        font-family: var(--font-family-base);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-regular);
        color: var(--color-text-tertiary);
      }
      /* 4px on a tinted track, not a 3px hairline on the page's own muted grey: at
         3px the fill and the track were within a shade of each other and the bar
         read as a stray rule under the number. */
      .meter {
        display: block;
        block-size: 4px;
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--color-brand-primary) 12%, var(--color-surface-muted));
        overflow: hidden;
      }
      .meter-fill {
        display: block;
        block-size: 100%;
        background: var(--color-brand-primary);
        transition: inline-size var(--motion-duration-base) var(--motion-easing-standard);
      }
      .controls-spacer {
        flex: 1;
      }
      /* Separates authoring from the set operations beside it. Logical inline
         border, so it lands on the correct side in Arabic without a second rule. */
      .controls-sep {
        align-self: stretch;
        inline-size: 1px;
        min-block-size: 24px;
        background: var(--pnd-line-strong);
      }
      /* One control that happens to have two halves, not two buttons pushed
         together: the hairline track belongs to the GROUP, the halves inside are
         borderless and transparent, and the seam is drawn once by the second half
         so the two can never double it into a 2px rule. Two welded outlined
         buttons read as a slab of grey text at rest — a third of the row's width
         spent on the least authoring action on it. Logical corner and border
         properties, so the pair flips correctly in Arabic without a second rule. */
      /* The track is drawn with an inset OUTLINE, not a border: a border would add
         its 2px to the group and leave the pair standing taller than the search
         field and the primary beside it, which is the misalignment this pass was
         partly here to fix. An outline takes no layout box, so the group is
         exactly one control tall. */
      .bulk {
        display: inline-flex;
        align-items: stretch;
        border-radius: var(--radius-md);
        outline: 1px solid var(--pnd-line-strong);
        outline-offset: -1px;
        background: var(--pnd-surface);
      }
      .bulk button {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        border: none;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-medium);
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .bulk button:first-child {
        border-start-start-radius: var(--radius-md);
        border-end-start-radius: var(--radius-md);
      }
      .bulk button:last-child {
        border-start-end-radius: var(--radius-md);
        border-end-end-radius: var(--radius-md);
      }
      .bulk button + button {
        border-inline-start: 1px solid var(--pnd-line);
      }
      /* The additive half warms toward the brand, the subtractive half toward the
         error hue: they are opposite directions of one operation and must not feel
         like the same act. Tint only — a filled red button here would out-shout
         the primary that authors new questions. */
      .bulk .bulk-tick:hover:not([disabled]) {
        background: color-mix(in srgb, var(--color-brand-primary) 9%, transparent);
        color: var(--color-brand-primary);
      }
      .bulk .bulk-untick:hover:not([disabled]) {
        background: color-mix(in srgb, var(--color-error) 9%, transparent);
        color: var(--color-error);
      }
      .bulk .bulk-tick:active:not([disabled]) {
        background: color-mix(in srgb, var(--color-brand-primary) 16%, transparent);
      }
      .bulk .bulk-untick:active:not([disabled]) {
        background: color-mix(in srgb, var(--color-error) 16%, transparent);
      }
      /* Rides above the seam so the ring is never clipped by the neighbouring
         half, and takes the group's full radius so a focused middle edge does not
         show a square corner against the round track. */
      .bulk button:focus-visible {
        z-index: 1;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-focus-ring);
        outline: none;
      }
      /* ng-zorro fills a disabled button with its own grey, which would paint one
         half of the track a different colour from the other. */
      .bulk button[disabled],
      .bulk button[disabled]:hover {
        background: transparent;
        color: var(--color-text-tertiary);
      }
      .search {
        max-inline-size: 240px;
        flex: 0 1 200px;
      }
      /* Matches the segmented pair's leading-icon rhythm; nz-button's own icon gap
         is tuned for a button that has no sibling to line up with. */
      .new-q {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .filter-note {
        margin: 0;
        font-size: var(--text-xxs);
        color: var(--color-text-tertiary);
      }
      .linkish {
        margin-inline-start: var(--space-2);
        border: none;
        background: none;
        padding: 0;
        color: var(--color-text-link);
        font-size: inherit;
        cursor: pointer;
        text-decoration: underline;
      }
      .linkish:hover {
        color: var(--color-text-primary);
      }
      .linkish:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }
      .no-match {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-6);
        text-align: center;
        color: var(--color-text-tertiary);
      }
      .no-match p {
        margin: 0;
      }
      /* Persistent, not a toast: the question is live and the operator still has
         one tap to make. A message that fades leaves them thinking it saved. */
      .tick-failed {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-error);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
      }
      .tick-failed [nz-icon] {
        flex: none;
        margin-block-start: 3px;
      }
      .tick-failed .linkish {
        color: inherit;
      }

      /* --- Sections + question cards --------------------------------------- */
      .sec-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-3);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .sec-count {
        font-family: var(--font-family-numeric);
        font-feature-settings: var(--font-feature-tabular);
        letter-spacing: 0;
      }
      .sec-empty {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
      }
      .grid {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: var(--space-3);
      }
      .card {
        inline-size: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--pnd-line);
        border-radius: var(--radius-md);
        background: var(--pnd-surface);
        text-align: start;
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* Hover lifts the edge; it does NOT repaint the fill. The fill is the
         scored/not-scored signal, and a hover that changes it makes the card read
         as already toggled. */
      .card:hover {
        border-color: var(--pnd-line-strong);
        box-shadow: var(--shadow-sm);
      }
      .card:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .card.on {
        border-color: color-mix(in srgb, var(--color-brand-primary) 40%, var(--pnd-line));
        background: color-mix(in srgb, var(--color-brand-primary) 5%, var(--pnd-surface));
      }
      /* Declared after .card.on, which would otherwise win and leave an
         already-scored card with no hover feedback at all. */
      .card.on:hover {
        border-color: var(--color-brand-primary);
      }
      .card[aria-busy='true'] {
        opacity: 0.65;
      }
      .card.landed {
        animation: pnd-land var(--motion-duration-base) var(--motion-easing-standard);
      }
      @keyframes pnd-land {
        from {
          transform: translateY(4px);
          opacity: 0.4;
        }
        to {
          transform: none;
          opacity: 1;
        }
      }
      .card-head {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .tick {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        inline-size: 18px;
        block-size: 18px;
        margin-block-start: 2px;
        border: 1px solid var(--pnd-line-strong);
        border-radius: var(--radius-sm);
        color: var(--text-on-primary);
        font-size: var(--text-xxs);
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover .tick {
        border-color: var(--color-brand-primary);
      }
      .card.on .tick {
        border-color: var(--color-brand-primary);
        background: var(--color-brand-primary);
      }
      .q-label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
        overflow-wrap: break-word;
      }
      .card-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-block-start: auto;
      }
      .qtype {
        font-size: var(--text-xxs);
        color: var(--color-text-tertiary);
      }
      .tag {
        padding-inline: var(--space-2);
        padding-block: 1px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
      }
      .tag.warn {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }

      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      /* Touch: the back link is the only sub-44px target on the page. */
      @media (hover: none) {
        .back {
          min-block-size: 44px;
        }
      }
      @media (max-width: 720px) {
        .page {
          padding: var(--space-4);
        }
        .grid {
          grid-template-columns: 1fr;
        }
        .search {
          max-inline-size: none;
          flex: 1 1 100%;
        }
        .header-aside {
          align-items: flex-start;
          text-align: start;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .card,
        .tick,
        .meter-fill,
        .track,
        .thumb,
        .gate,
        .bulk button {
          transition: none;
        }
        .card.landed {
          animation: none;
        }
      }
    `,
  ],
})
export class ProgramNameDetailPage implements OnInit {
  private readonly api = inject(LookupsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly modal = inject(NzModalService);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /** How many rows the locked preview shows before it stops listing. */
  private static readonly LOCKED_PREVIEW_ROWS = 6;

  protected readonly routeKey = signal<string>(this.route.snapshot.paramMap.get('key') ?? '');
  protected readonly name = signal<ProgramNameRow | null>(null);
  protected readonly pool = signal<CatalogQuestion[]>([]);

  protected readonly loading = signal(true);
  /** Question codes with a write in flight (a toggle is one whole-set PUT). */
  protected readonly saving = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly savingOffer = signal(false);
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly justMoved = signal<string | null>(null);
  protected readonly activeCategory = signal<LoanCategory>(this.initialCategory());

  protected readonly searchCtrl = new FormControl<string>('', { nonNullable: true });
  /** Protected: the search-dead-end CTA seeds the new-question dialog with it. */
  protected readonly query = toSignal(this.searchCtrl.valueChanges, { initialValue: '' });

  /**
   * Set when a question was CREATED but its tick into this name failed — the one
   * outcome the "Saves automatically" chip would otherwise misreport. Holds the
   * question's label so the notice can name it.
   */
  protected readonly tickFailed = signal<string | null>(null);

  protected readonly tabsAria = $localize`:@@pnd.tabs_aria:Loan types`;
  protected readonly searchAria = $localize`:@@pnd.search_aria:Search questions`;
  /** Names the segmented pair for a screen reader, which sees two loose buttons. */
  protected readonly bulkAria = $localize`:@@pnd.bulk_aria:Tick or untick every question listed`;
  private readonly notOfferedNote = $localize`:@@pnd.tab_not_offered:Not offered`;

  /** True when the name may be OFFERED under the open tab's category. */
  protected readonly offered = computed(
    () => this.name()?.categories.includes(this.activeCategory()) ?? false,
  );

  /** Questions the OPEN category asks — this tab's whole universe. */
  protected readonly scope = computed<CatalogQuestion[]>(() => {
    const category = this.activeCategory();
    return this.pool().filter((q) => q.categories.includes(category));
  });

  private readonly pickedCodes = computed<ReadonlySet<string>>(
    () => new Set(this.name()?.questions[this.activeCategory()] ?? []),
  );

  protected readonly pickedCount = computed(() => this.pickedCodes().size);

  protected readonly filtering = computed(() => this.query().trim() !== '');

  protected readonly visibleScope = computed(() =>
    this.scope()
      .map((q) => this.rowFor(q, true))
      .filter((r) => this.matches(r)),
  );

  /**
   * Everything picked for this category, resolved against the pool — IN SCOPE OR
   * NOT, so drift is visible and removable. A picked code the pool no longer
   * knows is rendered by its raw code rather than dropped, because "the question
   * was retired" and "the question is not asked here" have different fixes.
   */
  protected readonly pickedRows = computed<QuestionRow[]>(() => {
    const scopeCodes = new Set(this.scope().map((q) => q.code));
    const byCode = new Map(this.pool().map((q) => [q.code, q]));
    return [...this.pickedCodes()].map((code) => {
      const q = byCode.get(code);
      if (!q) {
        return {
          code,
          label: code,
          type: 'TEXT' as CatalogQuestionType,
          inScope: false,
          removed: true,
        };
      }
      return { ...this.rowFor(q, scopeCodes.has(code)), removed: false };
    });
  });

  protected readonly pickedInScope = computed(() =>
    this.pickedRows().filter((r) => r.inScope && !r.removed),
  );

  protected readonly sections = computed(() => {
    const picked = this.pickedCodes();
    return [
      { key: 'scored' as const, rows: this.pickedRows().filter((r) => this.matches(r)) },
      { key: 'rest' as const, rows: this.visibleScope().filter((r) => !picked.has(r.code)) },
    ];
  });

  /** Picked first, so a locked tab shows the configuration it is holding. */
  protected readonly lockedPreview = computed<QuestionRow[]>(() => {
    const picked = this.pickedCodes();
    const rows = this.scope().map((q) => this.rowFor(q, true));
    return [
      ...rows.filter((r) => picked.has(r.code)),
      ...rows.filter((r) => !picked.has(r.code)),
    ].slice(0, ProgramNameDetailPage.LOCKED_PREVIEW_ROWS);
  });

  protected readonly pct = computed(() => {
    const total = this.scope().length;
    return total === 0 ? 0 : Math.round((this.pickedInScope().length / total) * 100);
  });

  /** True when "untick everything listed" would empty this category's set. */
  protected readonly wouldClearAll = computed(() => {
    const picked = this.pickedCodes();
    if (picked.size === 0) return false;
    const onScreen = new Set(this.sections()[0]?.rows.map((r) => r.code) ?? []);
    return [...picked].every((c) => onScreen.has(c));
  });

  /**
   * Picks kept for this lane that the category no longer asks, or whose question
   * left the pool.
   *
   * Surfaced as its own number because the meter counts only IN-SCOPE picks: the
   * screen used to show "10 of 25 questions scored" above a section headed "Scored
   * on 11" with nothing explaining the eleventh, which reads as a bug in the page
   * rather than as configuration needing attention.
   */
  protected readonly driftedCount = computed(
    () => this.pickedRows().filter((r) => r.removed || !r.inScope).length,
  );

  /**
   * The four tabs. Every category always gets one, offered or not: a hidden tab
   * would make picks left behind by a narrowed assignment unreachable, and the
   * count is the fastest way to see that a name is configured for a loan type
   * nobody can sell it under.
   */
  protected readonly tabs = computed<RailTabItem[]>(() => {
    const n = this.name();
    const byCode = new Map(this.pool().map((q) => [q.code, q]));
    return LOAN_CATEGORIES.map((category) => {
      const codes = n?.questions[category] ?? [];
      const inScope = codes.filter((c) => byCode.get(c)?.categories.includes(category) ?? false);
      const offered = n?.categories.includes(category) ?? false;
      return {
        id: category,
        label: categoryLabel(category),
        count: inScope.length,
        note: offered ? undefined : this.notOfferedNote,
        // Warns on DRIFT only — a pick this category does not ask, or one whose
        // question left the pool. "Not offered" is a state, not a problem: a name
        // nobody sells as a mortgage is the normal case, and warning on it would
        // put a dot on three tabs of every specialised name.
        warn: codes.length > inScope.length,
        accent: `var(--color-cat-${category})`,
      };
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  // --- Display helpers -------------------------------------------------------

  protected nameOf(row: ProgramNameRow): string {
    return this.isAr ? row.labelAr : row.labelEn;
  }

  protected usageLabel(row: ProgramNameRow): string {
    return $localize`:@@pnd.usage_value:${row.usage.programs}:PROGRAMS: bank programs · ${row.usage.banks}:BANKS: banks`;
  }

  protected categoryName(): string {
    return categoryLabel(this.activeCategory());
  }

  /**
   * Quotes the name when the caller has the row. "Offered as a Personal Loan" read
   * as a property of nothing in particular on a page that already shows the name in
   * the H1 — spelling out who does the offering is what makes the switch a sentence.
   */
  protected offerLabel(row: ProgramNameRow): string {
    return $localize`:@@pnd.gate_label:Banks can offer “${this.nameOf(row)}:name:” as a ${this.categoryName()}:category:`;
  }

  protected isPicked(code: string): boolean {
    return this.pickedCodes().has(code);
  }

  protected typeLabel(type: CatalogQuestionType): string {
    switch (type) {
      case 'SINGLE_SELECT':
        return $localize`:@@pnd.qtype_single:One answer`;
      case 'MULTI_SELECT':
        return $localize`:@@pnd.qtype_multi:Several answers`;
      case 'NUMERIC':
        return $localize`:@@pnd.qtype_number:A number`;
      case 'TEXT':
        return $localize`:@@pnd.qtype_text:Free text`;
    }
  }

  protected cellLabel(q: QuestionRow): string {
    return $localize`:@@pnd.cell_aria:Score ${this.categoryName()}:category: applicants on "${q.label}:question:"`;
  }

  protected clearFilter(): void {
    this.searchCtrl.setValue('');
  }

  private rowFor(q: CatalogQuestion, inScope: boolean): QuestionRow {
    return {
      code: q.code,
      label: this.isAr ? q.labelAr : q.labelEn,
      type: q.type,
      inScope,
      removed: false,
    };
  }

  private matches(q: { code: string; label: string }): boolean {
    const term = this.query().trim().toLowerCase();
    if (!term) return true;
    return q.label.toLowerCase().includes(term) || q.code.toLowerCase().includes(term);
  }

  // --- Tabs ------------------------------------------------------------------

  protected selectCategory(id: string): void {
    if (!isLoanCategory(id)) return;
    this.activeCategory.set(id);
    this.justMoved.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { loan: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // --- Writes ----------------------------------------------------------------

  /**
   * Offer / withdraw this name under the open category. Optimistic.
   *
   * Withdrawing does NOT clear that category's question picks — see the class
   * docblock. They stay, greyed, and come back if the name is offered again.
   */
  protected async toggleOffered(): Promise<void> {
    const n = this.name();
    if (!n || this.savingOffer()) return;

    const category = this.activeCategory();
    const before = n.categories;
    const next = before.includes(category)
      ? before.filter((c) => c !== category)
      : [...before, category];

    this.patch({ categories: next });
    this.savingOffer.set(true);
    try {
      const row = await this.api.setCategories(n.id, next);
      // Trust the server's echo: it is the row every other surface will read.
      this.absorb(row);
    } catch {
      // The toast interceptor already surfaced the typed code (A22).
      this.patch({ categories: [...before] });
    } finally {
      this.savingOffer.set(false);
    }
  }

  /**
   * Optimistic. The whole set for the OPEN category goes up on every tap — there
   * is no per-question endpoint, because the template IS the set.
   *
   * Guarded with an early return rather than `[disabled]`: a disabled button
   * loses focus mid-keyboard-pass, and `aria-busy` reports the state instead.
   */
  protected async toggleQuestion(q: QuestionRow): Promise<void> {
    const n = this.name();
    if (!n || this.saving().has(q.code) || this.busy()) return;

    const category = this.activeCategory();
    const before = [...(n.questions[category] ?? [])];
    const next = before.includes(q.code) ? before.filter((c) => c !== q.code) : [...before, q.code];

    this.patchQuestions(category, next);
    this.markLanded(q.code);
    this.markSaving(q.code, true);
    try {
      await this.api.setQuestions(n.id, category, next);
    } catch {
      this.patchQuestions(category, before);
      await this.load({ quiet: true });
    } finally {
      this.markSaving(q.code, false);
    }
  }

  /**
   * Tick / untick everything currently LISTED. Not optimistic: it can touch the
   * whole set, and a half-reverted grid is worse than a short wait.
   *
   * Ticking adds only what is in scope; unticking removes what is on screen,
   * which deliberately INCLUDES drifted picks — that is how an admin clears them.
   */
  protected async setAllVisible(on: boolean): Promise<void> {
    const n = this.name();
    if (!n || this.busy()) return;

    const category = this.activeCategory();
    const before = [...(n.questions[category] ?? [])];
    const next = on
      ? [...new Set([...before, ...this.visibleScope().map((r) => r.code)])]
      : before.filter((c) => !this.sections()[0]?.rows.some((r) => r.code === c));

    if (next.length === before.length && next.every((c) => before.includes(c))) return;

    this.busy.set(true);
    try {
      const row = await this.api.setQuestions(n.id, category, next);
      this.absorb(row);
      this.announce(Math.abs(next.length - before.length), on);
    } catch {
      await this.load({ quiet: true });
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Write the OPEN category's whole pick set. Not optimistic, like `setAllVisible` and
   * for the same reason: it can remove several picks at once, and a half-reverted grid
   * is worse than a short wait.
   *
   * Reports whether the write landed, because one caller — the new-question flow —
   * has already created something by the time it gets here and must say so
   * rather than silently reloading a screen the operator expects to have changed.
   */
  private async writeQuestions(next: readonly string[]): Promise<boolean> {
    const n = this.name();
    if (!n || this.busy()) return false;
    this.busy.set(true);
    try {
      const row = await this.api.setQuestions(n.id, this.activeCategory(), [...next]);
      this.absorb(row);
      return true;
    } catch {
      await this.load({ quiet: true });
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  // --- Authoring a new question ----------------------------------------------

  /**
   * Author a question in the GLOBAL pool without leaving this name, then tick it
   * into the open tab's template.
   *
   * The dialog owns the create (one request, one published version) and hands
   * back what it made; the tick stays here because the template is a whole-set
   * write this page already owns, and doing it here is what lets the new card
   * arrive through the same landing animation and live region as a tap.
   *
   * `seed` prefills the wording — used by the search dead end, where the
   * operator has just typed the exact question they were looking for.
   */
  protected openNewQuestion(seed?: string): void {
    const n = this.name();
    if (!n) return;
    const data: NewQuestionDialogData = {
      nameLabel: this.nameOf(n),
      category: this.activeCategory(),
      existingCodes: this.pool().map((q) => q.code),
      ...(seed && seed.trim() !== '' ? { seedQuestionEn: seed.trim() } : {}),
    };
    const ref = this.modal.create<
      NewQuestionDialogComponent,
      NewQuestionDialogData,
      NewQuestionResult | null
    >({
      nzContent: NewQuestionDialogComponent,
      nzData: data,
      nzTitle: $localize`:@@pnd.new_question_title:New question`,
      nzWidth: 'min(880px, calc(100vw - 48px))',
      nzFooter: null,
      // Unlike the label dialog on the catalog list, this form can hold twenty
      // fields and a list of answers — a stray click on the mask would bin it.
      nzMaskClosable: false,
    });
    ref.afterClose.subscribe((result: NewQuestionResult | null | undefined) => {
      if (result) void this.absorbNewQuestion(result);
    });
  }

  protected dismissTickFailed(): void {
    this.tickFailed.set(null);
  }

  /**
   * Land a freshly created question: refresh the pool so the card exists, then
   * tick it if that was asked for.
   *
   * The pick set is rebuilt from the CURRENT row rather than from anything the
   * dialog captured when it opened — same discipline as `toggleQuestion`, since
   * a colleague may have written the set in the meantime.
   */
  private async absorbNewQuestion(result: NewQuestionResult): Promise<void> {
    this.tickFailed.set(null);
    await this.load({ quiet: true });
    if (!result.tick) {
      this.status.set(
        $localize`:@@pnd.live_created:“${result.label}:question:” was added to the question pool`,
      );
      return;
    }
    const n = this.name();
    if (!n) return;
    const category = this.activeCategory();
    const before = n.questions[category] ?? [];
    if (before.includes(result.code)) return;
    this.markLanded(result.code);
    const saved = await this.writeQuestions([...before, result.code]);
    if (saved) {
      this.announce(1, true);
    } else {
      // Created and live, but not ticked. Says so where the operator is looking.
      this.tickFailed.set(result.label);
    }
  }

  // --- State plumbing --------------------------------------------------------

  private initialCategory(): LoanCategory {
    const fromUrl = this.route.snapshot.queryParamMap.get('loan');
    return isLoanCategory(fromUrl) ? fromUrl : 'personal';
  }

  private async load(opts: { quiet?: boolean } = {}): Promise<void> {
    if (!opts.quiet) this.loading.set(true);
    try {
      // Assignment, template and pool ride the SAME read, so the gate and the
      // drift flags can never be computed from a split-brain state.
      const [rows, pool] = await Promise.all([
        this.api.list(ENUM_TYPE),
        this.api.catalogQuestions(),
      ]);
      const { rows: names } = absorbProgramNames(rows);
      this.name.set(names.find((n) => n.key === this.routeKey()) ?? null);
      this.pool.set(pool);
    } finally {
      if (!opts.quiet) this.loading.set(false);
    }
  }

  /** Re-absorb one server row — the write responses carry the whole entry. */
  private absorb(row: Parameters<typeof absorbProgramNames>[0][number]): void {
    const { rows } = absorbProgramNames([row]);
    const fresh = rows[0];
    if (fresh) this.name.set(fresh);
  }

  private patch(patch: Partial<ProgramNameRow>): void {
    this.name.update((n) => (n ? { ...n, ...patch } : n));
  }

  private patchQuestions(category: LoanCategory, codes: readonly string[]): void {
    this.name.update((n) =>
      n ? { ...n, questions: { ...n.questions, [category]: [...codes] } } : n,
    );
  }

  private markSaving(code: string, on: boolean): void {
    this.saving.update((set) => {
      const next = new Set(set);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  private markLanded(code: string): void {
    this.justMoved.set(code);
    setTimeout(() => {
      if (this.justMoved() === code) this.justMoved.set(null);
    }, LAND_ANIMATION_MS);
  }

  private announce(count: number, on: boolean): void {
    const category = this.categoryName();
    this.status.set(
      on
        ? $localize`:@@pnd.live_added:${count}:count: questions added for ${category}:category:`
        : $localize`:@@pnd.live_removed:${count}:count: questions removed for ${category}:category:`,
    );
  }
}
