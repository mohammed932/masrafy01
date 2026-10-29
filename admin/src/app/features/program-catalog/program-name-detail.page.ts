import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  type TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDrawerService, type NzDrawerRef } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  ArrowLeftOutline,
  ArrowRightOutline,
  CloseCircleOutline,
  LockOutline,
  OrderedListOutline,
  PlusOutline,
} from '@ant-design/icons-angular/icons';
import {
  FormDrawerComponent,
  LoanCategorySwitchesComponent,
  PageHeaderComponent,
  WizardStepsComponent,
  openFormDrawer,
  type WizardStepItem,
} from '@shared/ui';
import { RailTabsComponent, type RailTabItem } from '@shared/ui/rail-tabs.component';
import { toAskablePool } from '@shared/questions/to-askable';
import {
  addableQuestions,
  additionsToSave,
  lockMapFor,
  type AskableQuestion,
  type ServedCount,
  type ServedPage,
  type ServerLock,
} from '@shared/questions/asked-questions.rules';
import {
  moveBlock,
  moveBlockText,
  pagesAfterMove,
  servedOrder,
  type PageMove,
} from '@shared/questions/question-order';
import { QuestionnaireApiService } from '@features/questionnaire/questionnaire.api.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { LOAN_CATEGORIES, categoryLabel, type LoanCategory } from '@core/loan-category';
import type { IncomeBasis } from '@core/income-basis';
import { LookupsApiService } from '../lookups/lookups.api.service';
import { ENUM_TYPE, absorbProgramNames, type ProgramNameRow } from './program-name-row';
import {
  ServedPagesComponent,
  type ServedFilter,
  type ServedRowState,
} from './served-pages.component';
import { AddableQuestionsComponent, type AddableRow } from './addable-questions.component';

/**
 * One catalog program name, in two steps.
 *
 * Replaces the rail board this feature shipped with (`program-categories`), which
 * asked the operator to hold a 16×4 assignment in their head on a screen of its
 * own. The assignment is a fact about ONE name, so it belongs on one screen about
 * that name — reached by opening it from the catalog, the way every other object
 * in this dashboard is reached.
 *
 * - **Where it is offered** — the authoritative per-loan-type assignment. The
 *   bank-program builder filters its Program name picker on it and the API rejects
 *   an unassigned pair. Saved on every tap.
 * - **What applicants are asked** — the questions the app shows someone who picks this name,
 *   page by page, filterable to the fixed set or the rest; Add opens a side sheet, Remove sits
 *   on each row this name ticked (v31.6.0), and Change order moves a question on its page
 *   (v32.0.0: each program keeps its own order). A question carries no loan type — this is the
 *   one place a program's questions are set. Fixed questions are edited on Questionnaire.
 *
 * The screen used to open on a third step, "How the income is worked out": the
 * name's one surrogate income rule. Cut for the MVP — Add program makes income-proof
 * names only (v30.8.0), a no-payslip name's calculation is edited on its surrogate
 * product, and the stored rule is still read by every bank program under the name.
 */
@Component({
  selector: 'app-program-name-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzSpinModule,
    PageHeaderComponent,
    WizardStepsComponent,
    LoanCategorySwitchesComponent,
    RailTabsComponent,
    ServedPagesComponent,
    AddableQuestionsComponent,
    FormDrawerComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      ArrowRightOutline,
      CloseCircleOutline,
      LockOutline,
      OrderedListOutline,
      PlusOutline,
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
            subtitle="Two steps: which loan types banks may sell it under, and what its applicants are asked. Every change saves as you tap."
            i18n-subtitle="@@pnd.sub3"
          >
            <div class="header-aside">
              <span class="usage">
                @if (n.usage.programs === 0) {
                  <span i18n="@@pnd.usage_none">Not offered by any bank yet</span>
                } @else {
                  {{ usageLabel(n) }}
                }
              </span>
              @if (stepIndex() === 0) {
                <span class="autosave" i18n="@@pnd.autosave_offer"
                  >Turning a loan type on or off saves at once</span
                >
              }
            </div>
          </app-page-header>

          <!-- ── Two steps, in the order the decisions depend on each other ──
               Non-linear on purpose. This is a settings screen, not a creation flow:
               every step is reachable at any time, every tap writes, and nothing is
               submitted at the end. The rail is the shared wizard rail, so a step here
               reads exactly like a step in the bank-program wizard. -->
          <app-wizard-steps
            [steps]="wizardSteps()"
            [activeIndex]="stepIndex()"
            [ariaLabel]="stepsAria"
            [caption]="stepCaption()"
            (stepSelect)="goToStep($event)"
          />

          @switch (stepIndex()) {
            @case (0) {
              <!-- ── STEP 1 · Where it is offered ──────────────────────────────
                   All four loan types at once, which is the whole reason this is a
                   step rather than the first thing behind a tab: the assignment is
                   ONE decision with four parts, and reading it used to cost four tab
                   clicks and a memory of what the other three said. -->
              <section class="card is-bare stage-card">
                <header class="stage-head">
                  <h2 class="stage-title" i18n="@@pnd.offered_title">
                    Which loan types is this name offered under?
                  </h2>
                  <p class="stage-sub" i18n="@@pnd.offered_sub">
                    A bank building a program can only pick this name under a loan type that is on
                    here.
                  </p>
                </header>

                <!-- Extracted on the second use: the create flow asks the same question,
                     and the component owns the WORDS as well as the markup, so an operator
                     reads the same sentence while creating a name as while editing it. -->
                <app-loan-category-switches
                  [value]="n.categories"
                  [busy]="savingOffer()"
                  [subject]="nameOf(n)"
                  (toggled)="toggleOffered($event)"
                />

                @if (offeredCount() === 0) {
                  <!-- Not a validation error — the row is saved and legal. It is a
                       statement that the name is currently unsellable, which is the
                       one thing this step exists to make visible. -->
                  <p class="stage-warn" role="status">
                    <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
                    <span i18n="@@pnd.offered_none"
                      >No bank can offer this name yet — turn on at least one loan type.</span
                    >
                  </p>
                }
              </section>
            }

            @case (1) {
              <!-- ── STEP 2 · What applicants are asked ────────────────────────
                   The list the app shows someone who picks this name, page by page, the
                   questions this name ticks for its own applicants, and the order it asks them
                   in. A fixed question is drawn as is, with a lock: it is asked on every
                   program, and only Questionnaire changes it. Every Add / Remove / move writes
                   at once — for THIS name only (program_name_question_addition / _order). -->
              <section class="card is-bare stage-card">
                <!-- The one action of the step sits on the heading, where it is seen before the
                     list, instead of under twenty-odd rows. The pick list it opens is a side sheet:
                     the list being added to stays on screen beside it. -->
                <header class="stage-head has-action">
                  <div class="stage-head-text">
                    <h2 class="stage-title" i18n="@@pnd.asks_title">
                      What are these applicants asked?
                    </h2>
                    <p class="stage-sub" i18n="@@pnd.asks_sub_edit2">
                      Add, remove or reorder questions for this program only — other programs don't
                      change.
                    </p>
                  </div>
                  @if (editable()) {
                    <button nz-button nzType="primary" type="button" (click)="openAddSheet()">
                      <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                      <span i18n="@@pnd.add_title">Add a question</span>
                    </button>
                  }
                </header>

                @if (n.categories.length > 1) {
                  <app-rail-tabs
                    [items]="askTabs()"
                    [activeId]="askCategory()"
                    [ariaLabel]="askTabsAria"
                    idPrefix="pnd-asks"
                    appearance="segmented"
                    (select)="selectAskTab($event)"
                  />
                }

                @if (asksError(); as err) {
                  <p class="stage-warn" role="alert">
                    <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
                    <span>{{ err }}</span>
                  </p>
                }

                <div
                  class="asks"
                  [attr.role]="n.categories.length > 1 ? 'tabpanel' : null"
                  [attr.id]="n.categories.length > 1 ? 'pnd-asks-panel-' + askCategory() : null"
                  [attr.aria-labelledby]="
                    n.categories.length > 1 ? 'pnd-asks-tab-' + askCategory() : null
                  "
                >
                  @if (servedHere(); as sv) {
                    <!-- Most rows are fixed and can't be removed here; the filter lets the admin
                         see just the few this program owns, or just the fixed set, without
                         losing the app's page order or numbering. Change order swaps the filter
                         for the order editor: every row, a handle and arrows on each. -->
                    <div class="asks-bar">
                      @if (ordering()) {
                        <p class="order-lede" i18n="@@pnd.order_lede">
                          Drag a question, or use its arrows, to move it on its page. Each move
                          saves at once, for this program only.
                        </p>
                        <button nz-button nzType="primary" type="button" (click)="stopOrdering()">
                          <span i18n="@@pnd.add_sheet_done">Done</span>
                        </button>
                      } @else {
                        @if (showRowFilter()) {
                          <app-rail-tabs
                            [items]="filterTabs()"
                            [activeId]="rowFilter()"
                            [ariaLabel]="filterAria"
                            idPrefix="pnd-rows"
                            (select)="selectRowFilter($event)"
                          />
                        }
                        <p class="asks-summary">{{ askSummary(sv) }}</p>
                        @if (editable() && sv.servedTotal > 1) {
                          <button nz-button type="button" (click)="startOrdering()">
                            <span
                              nz-icon
                              nzType="ordered-list"
                              nzTheme="outline"
                              aria-hidden="true"
                            ></span>
                            <span i18n="@@pnd.order_open">Change order</span>
                          </button>
                        }
                      }
                    </div>
                    <p class="sr-only" role="status" aria-live="polite">{{ orderStatus() }}</p>

                    @if (editable() && !ordering() && rowFilter() !== 'other') {
                      <p class="asks-hint">
                        <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
                        <span i18n="@@pnd.asks_fixed_note">
                          Fixed questions are asked on every program and can't be removed here. To
                          change one, open
                          <a class="stage-link" routerLink="/questionnaire/questions"
                            >Questionnaire</a
                          >.
                        </span>
                      </p>
                    }

                    <div
                      [attr.role]="showRowFilter() ? 'tabpanel' : null"
                      [attr.id]="showRowFilter() ? 'pnd-rows-panel-' + rowFilter() : null"
                      [attr.aria-labelledby]="
                        showRowFilter() ? 'pnd-rows-tab-' + rowFilter() : null
                      "
                    >
                      @if (!ordering() && rowFilter() === 'other' && otherCountHere() === 0) {
                        <div class="asks-empty">
                          <p class="asks-empty-text" i18n="@@pnd.asks_only_fixed">
                            Only the fixed questions are asked here. Add one to ask this program's
                            applicants something more.
                          </p>
                          @if (editable()) {
                            <button nz-button type="button" (click)="openAddSheet()">
                              <span
                                nz-icon
                                nzType="plus"
                                nzTheme="outline"
                                aria-hidden="true"
                              ></span>
                              <span i18n="@@pnd.add_title">Add a question</span>
                            </button>
                          }
                        </div>
                      } @else {
                        <app-served-pages
                          [pages]="sv.pages ?? []"
                          [isAr]="isAr"
                          [states]="rowStates()"
                          [editable]="editable()"
                          [busy]="busyCodes()"
                          [filter]="ordering() ? 'all' : rowFilter()"
                          [ordering]="ordering()"
                          [orderBusy]="savingOrder()"
                          (remove)="removeQuestion($event)"
                          (move)="moveQuestion($event)"
                        />
                      }
                    </div>
                  } @else if (servedLoading()) {
                    <div class="loading"><nz-spin nzSimple></nz-spin></div>
                  }
                </div>
              </section>
            }
          }

          <!-- Back / Next as well as the rail, because a rail is a map and these are
               the two moves. No "Finish": nothing is submitted here — every change saves
               as it is tapped. -->
          <nav class="stepnav" [attr.aria-label]="stepsAria">
            <button
              nz-button
              type="button"
              [disabled]="stepIndex() === 0"
              (click)="goToStep(stepIndex() - 1)"
            >
              <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@pnd.step_back">Back</span>
            </button>
            <span class="stepnav-spacer"></span>
            @if (stepIndex() < stepLabels.length - 1) {
              <button nz-button nzType="primary" type="button" (click)="goToStep(stepIndex() + 1)">
                <span>{{ nextStepLabel() }}</span>
                <span nz-icon nzType="arrow-right" nzTheme="outline" aria-hidden="true"></span>
              </button>
            }
          </nav>
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

    <!-- Add a question: a side sheet over the list it adds to. Declared here, outside every
         block, so the page's own state (the pool, what is in flight) is what it reads. Every Add
         saves at once, so the sheet has one exit, Done, and no Cancel. -->
    <ng-template #addSheet>
      <app-form-drawer
        [title]="addSheetTitle()"
        [subtitle]="addSheetSub"
        [hint]="addSheetHint"
        [submitLabel]="doneLabel"
        [showCancel]="false"
        (cancelled)="closeAddSheet()"
        (submitted)="closeAddSheet()"
      >
        <span drawerIcon nz-icon nzType="plus" nzTheme="outline"></span>
        <div class="sheet-body">
          @if (asksError(); as err) {
            <p class="stage-warn" role="alert">
              <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
              <span>{{ err }}</span>
            </p>
          }
          <app-addable-questions
            [rows]="addableRows()"
            [busy]="savingAsk()"
            (add)="askToAdd($event)"
          />
        </div>
      </app-form-drawer>
    </ng-template>
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

      /* --- A step's stage --------------------------------------------------- */
      /* is-bare for the reason step 1 uses it: the rows inside draw their own
         borders, and a filled card around them would be a card holding cards. */
      .stage-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .stage-head {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      /* Heading on the start side, its one action on the end side; the button drops under the
         words when they need the width. */
      .stage-head.has-action {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3) var(--space-4);
      }
      .stage-head-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        flex: 1 1 20rem;
        min-inline-size: 0;
      }
      .stage-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        color: var(--text-primary);
      }
      .stage-sub {
        margin: 0;
        max-inline-size: 68ch;
        font-size: 0.8125rem;
        line-height: 1.55;
        color: var(--text-secondary);
      }
      .stage-link {
        color: var(--color-text-link);
        font-weight: var(--font-weight-medium);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .stage-link:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }
      .asks {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .asks-summary {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      /* The order editor's one line: what a drag does, and that it saves. */
      .order-lede {
        flex: 1 1 18rem;
        margin: 0;
        font-size: var(--text-sm);
        line-height: 1.55;
        color: var(--text-secondary);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      /* The filter, the count and Change order, on one line. */
      .asks-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2) var(--space-4);
      }
      .asks-bar .asks-summary {
        margin-inline-start: auto;
      }
      /* Wrapped under the filter on a phone: start-aligned like everything else there. */
      @media (max-width: 560px) {
        .asks-bar .asks-summary {
          margin-inline-start: 0;
        }
      }
      /* A line, not a banner: it explains the locks on the rows below and should read as
         quietly as they do. */
      .asks-hint {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        line-height: 1.55;
        color: var(--text-secondary);
      }
      .asks-hint [nz-icon] {
        flex: none;
        margin-block-start: 0.25em;
        color: var(--text-tertiary);
      }
      .asks-empty {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3) var(--space-4);
        padding: var(--space-5);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-md);
      }
      .asks-empty-text {
        flex: 1 1 18rem;
        margin: 0;
        font-size: var(--text-sm);
        line-height: 1.55;
        color: var(--text-secondary);
      }
      .sheet-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      /* Four rows, one decision. A grid at two columns from 720px, because the four
         together are the thing being read and a single column makes the last one
         scroll out of the same glance as the first. */
      .gates {
        display: grid;
        gap: var(--space-3);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      @media (min-width: 720px) {
        .gates {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .gates > li {
        min-inline-size: 0;
      }
      /* Equal heights: one row's hint runs to two lines and its neighbour's to one,
         and a ragged pair of switches reads as two different kinds of control. */
      .gates > li > .gate {
        block-size: 100%;
      }
      /* A statement, not a form error: the row saved fine, the name is just
         unsellable while it stands. */
      .stage-warn {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-3);
        border-radius: var(--radius-md);
        border-inline-start: var(--rule-width-accent) solid var(--ant-warning-color);
        background: var(--color-warning-bg);
        color: var(--text-primary);
        font-size: 0.8125rem;
        line-height: 1.55;
      }
      .stage-warn [nz-icon] {
        color: var(--ant-warning-color);
        margin-block-start: 0.15em;
      }

      /* --- Step navigation --------------------------------------------------- */
      .stepnav {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--pnd-line);
      }
      .stepnav-spacer {
        flex: 1 1 auto;
      }
      /* Both arrows point along the reading direction, which no logical property can
         do to a glyph. */
      :host-context([dir='rtl']) .stepnav [nz-icon] {
        transform: scaleX(-1);
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

      /* Base card box, shared by the two step panels. The interactive treatment it
         used to carry belonged to the question cards, which are gone. */
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
        .header-aside {
          align-items: flex-start;
          text-align: start;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .track,
        .thumb,
        .gate {
          transition: none;
        }
      }
    `,
  ],
})
export class ProgramNameDetailPage implements OnInit {
  private readonly api = inject(LookupsApiService);
  private readonly questionnaire = inject(QuestionnaireApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly routeKey = signal<string>(this.route.snapshot.paramMap.get('key') ?? '');
  protected readonly name = signal<ProgramNameRow | null>(null);

  protected readonly loading = signal(true);
  protected readonly savingOffer = signal(false);

  private readonly errors = inject(ErrorCodeService);
  private readonly modal = inject(NzModalService);

  // --- The two steps ---------------------------------------------------------
  //
  // Which step is on stage lives in the URL, so a colleague pasting a link and a reload
  // after a save both land where the operator was rather than back at step one.

  /**
   * DECLARED BEFORE `stepIndex`, and that is load-bearing rather than tidy.
   *
   * `initialStep()` clamps a pasted `?step=` against this list's length, and class fields
   * initialise in source order — so with the signal above it, `this.stepLabels` was
   * `undefined` at the moment it was read. It survived because the clamp short-circuits:
   * with no `?step=` at all, `Number.isInteger(NaN)` is false and the length is never
   * reached. EVERY deep link that named a step threw — including the one this feature's own
   * create flow sends every freshly created name to.
   */
  protected readonly stepLabels: readonly string[] = [
    $localize`:@@pnd.step_offered:Where it is offered`,
    $localize`:@@pnd.step_asks:What applicants are asked`,
  ];

  protected readonly stepIndex = signal<number>(this.initialStep());

  /** The four loan types, for the assignment step's `@for`. Order is the platform's. */
  protected readonly categories = LOAN_CATEGORIES;

  protected readonly stepsAria = $localize`:@@pnd.steps_aria:Setting up this program name`;

  /**
   * The rail's status per step. "Where it is offered" is the only one that can be WRONG in
   * what it HOLDS: a name offered under no loan type is a name no bank can pick.
   */
  protected readonly wizardSteps = computed<WizardStepItem[]>(() => [
    {
      id: 'offered',
      label: this.stepLabels[0] ?? '',
      status: this.offeredCount() > 0 ? 'done' : 'invalid',
    },
    {
      id: 'asks',
      label: this.stepLabels[1] ?? '',
      // Never `invalid`, and never `todo`: what a program asks is a fact this step reports
      // and lets the operator adjust, not an answer this name owes. It is unreachable while the name is offered
      // nowhere, because there is nothing to put a tab on.
      status: 'done',
      disabled: this.offeredCount() === 0,
    },
  ]);

  /** One sentence under the rail: what this step decides, and what it does not. */
  protected readonly stepCaption = computed<string>(() => {
    if (this.stepIndex() === 0) {
      return $localize`:@@pnd.step_offered_cap:${this.offeredCount()}:OFFERED: of ${this.categories.length}:TOTAL: loan types are on. This is what a bank's program picker filters on.`;
    }
    return $localize`:@@pnd.step_asks_cap2:What the app asks someone who picks this program, page by page.`;
  });

  protected nextStepLabel(): string {
    return this.stepLabels[this.stepIndex() + 1] ?? '';
  }

  protected goToStep(index: number): void {
    const next = Math.min(Math.max(index, 0), this.stepLabels.length - 1);
    if (next === 1) this.loadAsks();
    if (next === this.stepIndex()) return;
    this.stepIndex.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: next + 1 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private initialStep(): number {
    const raw = Number(this.route.snapshot.queryParamMap.get('step'));
    return Number.isInteger(raw) && raw >= 1 && raw <= this.stepLabels.length ? raw - 1 : 0;
  }

  /** How many of the four are on. Drives the rail's status and its caption. */
  protected readonly offeredCount = computed(() => this.name()?.categories.length ?? 0);

  // --- Step 2 · what applicants are asked ------------------------------------

  /** What an applicant of this name is served per loan type; empty until the read lands. */
  protected readonly served = signal<readonly ServedCount[]>([]);
  protected readonly servedLoading = signal(false);
  protected readonly asksError = signal<string | null>(null);
  /** The served set for the loan type on the tab, pages included. */
  protected readonly servedHere = computed<ServedCount | null>(
    () => this.served().find((s) => s.category === this.askCategory()) ?? null,
  );

  /**
   * The whole question pool: what an Add picks from, and how a served code maps to the id a
   * write names. Read once per visit to step 2.
   */
  private readonly pool = signal<readonly AskableQuestion[]>([]);
  private poolRequested = false;
  private readonly poolByCode = computed(
    () => new Map(this.pool().map((q) => [q.code, q] as const)),
  );
  /** Codes this name may not drop, with the reason — the server's, never a list kept here. */
  private readonly locks = signal<readonly ServerLock[]>([]);
  /** Question ids this name ticks, per loan type — as stored, re-read after every write. */
  private readonly addedByCat = signal<ReadonlyMap<LoanCategory, ReadonlySet<string>>>(
    new Map<LoanCategory, ReadonlySet<string>>(),
  );
  /**
   * Question ids with a write in flight. One at a time: every write replaces this name's whole
   * set for the loan type, so two in flight would race each other.
   */
  protected readonly savingAsk = signal<ReadonlySet<string>>(new Set<string>());
  /** The same, by code — what the served list marks busy. */
  protected readonly busyCodes = computed<ReadonlySet<string>>(() => {
    const codeOf = new Map(this.pool().map((q) => [q.id, q.code] as const));
    return new Set([...this.savingAsk()].map((id) => codeOf.get(id) ?? id));
  });

  /**
   * Add / Remove / Change order are open once the pool is read: a write names question ids,
   * which only the pool maps a served code to. A name no bank sells yet is served its fixed
   * questions and its ticks like any other (v32.0.0), so it is editable too.
   */
  protected readonly editable = computed(() => this.pool().length > 0);

  private readonly servedCodesHere = computed<ReadonlySet<string>>(() => {
    const out = new Set<string>();
    for (const page of this.servedHere()?.pages ?? []) {
      for (const q of page.questions) out.add(q.code);
    }
    return out;
  });

  /**
   * Why each served question is here. A fixed one is locked whatever else reads it; a gate
   * source is locked while a question it shows is on the list (drop that one first — the server
   * would put the source back anyway).
   */
  protected readonly rowStates = computed<ReadonlyMap<string, ServedRowState>>(() => {
    const category = this.askCategory();
    const sv = this.servedHere();
    const fixed = new Set(sv?.fixedQuestionCodes ?? []);
    const locks = lockMapFor(this.locks(), category);
    const added = this.addedByCat().get(category) ?? new Set<string>();
    const byCode = this.poolByCode();
    const questions = (sv?.pages ?? []).flatMap((p) => p.questions);
    const sources = new Set<string>();
    for (const q of questions) {
      const source = q.enabledWhen?.questionCode;
      if (source) sources.add(source);
    }
    const out = new Map<string, ServedRowState>();
    for (const q of questions) {
      const row = byCode.get(q.code);
      const lock = locks.get(q.code);
      if (fixed.has(q.code) || row?.fixed === true || lock === 'base') out.set(q.code, 'fixed');
      else if (lock === 'engine') out.set(q.code, 'engine');
      else if (lock === 'program') out.set(q.code, 'program');
      else if (row === undefined) continue;
      else if (sources.has(q.code)) out.set(q.code, 'gate');
      else if (added.has(row.id)) out.set(q.code, 'added');
    }
    return out;
  });

  private readonly fixedCountHere = computed(
    () => [...this.rowStates().values()].filter((s) => s === 'fixed').length,
  );

  /** Served here and not fixed: what this program owns, a bank reads, or a follow-up needs. */
  protected readonly otherCountHere = computed(
    () => this.servedCodesHere().size - this.fixedCountHere(),
  );

  // --- Step 2 · the row filter -----------------------------------------------
  //
  // Twenty-odd fixed rows bury the two or three this program owns. The filter narrows the list
  // without reordering it: numbers and pages stay the app's. Kept across loan-type tabs.

  protected readonly rowFilter = signal<ServedFilter>('all');
  protected readonly filterAria = $localize`:@@pnd.rows_filter_aria:Show questions`;

  /** Nothing to split when no question here is fixed. */
  protected readonly showRowFilter = computed(() => this.fixedCountHere() > 0);

  protected readonly filterTabs = computed<RailTabItem[]>(() => {
    const total = this.servedCodesHere().size;
    const fixed = this.fixedCountHere();
    const other = this.otherCountHere();
    return [
      {
        id: 'all',
        label: $localize`:@@pnd.rows_all:All`,
        count: total,
        countLabel: this.questionsLabel(total),
      },
      {
        id: 'fixed',
        label: $localize`:@@pnd.rows_fixed:Fixed`,
        count: fixed,
        countLabel: this.questionsLabel(fixed),
      },
      {
        id: 'other',
        label: $localize`:@@pnd.rows_other:Not fixed`,
        count: other,
        countLabel: this.questionsLabel(other),
      },
    ];
  });

  protected selectRowFilter(id: string): void {
    if (id === 'all' || id === 'fixed' || id === 'other') this.rowFilter.set(id);
  }

  // --- Step 2 · the Add sheet ------------------------------------------------

  private readonly drawer = inject(NzDrawerService);
  private readonly message = inject(NzMessageService);
  private readonly addSheet = viewChild.required<TemplateRef<unknown>>('addSheet');
  private addSheetRef: NzDrawerRef | null = null;

  protected readonly addSheetSub = $localize`:@@pnd.add_sheet_sub:Asked only of this program's applicants, on the page the question sits in.`;
  protected readonly addSheetHint = $localize`:@@pnd.add_sheet_hint:Each question saves as soon as you add it.`;
  protected readonly doneLabel = $localize`:@@pnd.add_sheet_done:Done`;

  /** Names the program — and the loan type, when the name is sold under more than one. */
  protected readonly addSheetTitle = computed<string>(() => {
    const n = this.name();
    const head = n
      ? $localize`:@@pnd.add_sheet_title:Add a question to ${this.nameOf(n)}:NAME:`
      : $localize`:@@pnd.add_title:Add a question`;
    return n && n.categories.length > 1 ? `${head} · ${categoryLabel(this.askCategory())}` : head;
  });

  /** Opened once; a second click while it is open does nothing. */
  protected openAddSheet(): void {
    if (this.addSheetRef !== null) return;
    const ref = openFormDrawer<object, object, void>(this.drawer, {
      content: this.addSheet(),
      data: {},
    });
    this.addSheetRef = ref;
    ref.afterClose.subscribe(() => {
      if (this.addSheetRef === ref) this.addSheetRef = null;
    });
  }

  protected closeAddSheet(): void {
    this.addSheetRef?.close();
  }

  /**
   * What an Add may pick: every live question that is not asked here yet, not fixed, and not
   * read by every quote (both are the loan type's call, and the server refuses them). A
   * follow-up names the questions it needs first; one whose chain runs through a locked or
   * switched-off question is left out, because the server would refuse the whole write.
   *
   * Only the questions of the name's own income type (v31.7.0): a payslip name picks from the
   * income-proof questions — the ones the Questionnaire section lists — a no-payslip name from
   * the ones surrogate products ask, a name sold both ways from both. A name no bank sells yet
   * reads as payslip, the only kind Add program makes.
   */
  protected readonly addableRows = computed<readonly AddableRow[]>(() => {
    const category = this.askCategory();
    const bases = this.name()?.bases[category] ?? [];
    return addableQuestions(
      this.pool(),
      this.servedCodesHere(),
      lockMapFor(this.locks(), category),
      new Set<IncomeBasis>(bases.length === 0 ? ['payslip'] : bases),
    ).map(({ question: q, chain }) => ({
      id: q.id,
      code: q.code,
      label: this.labelOf(q),
      groupKey: q.groupKey ?? '',
      group: (this.isAr ? q.groupAr : q.groupEn) || q.groupEn || q.groupAr || '',
      isRequired: q.isRequired,
      alsoAdds: chain.map((c) => this.labelOf(c)),
      chainIds: chain.map((c) => c.id),
      haystack: q.haystack,
    }));
  });

  private labelOf(q: AskableQuestion): string {
    return (this.isAr ? q.labelAr : q.labelEn) || q.code;
  }

  private readonly askTab = signal<LoanCategory | null>(null);

  /** Clamped to a loan type the name is actually offered under. */
  protected readonly askCategory = computed<LoanCategory>(() => {
    const on = this.name()?.categories ?? [];
    const picked = this.askTab();
    if (picked !== null && on.includes(picked)) return picked;
    return on[0] ?? 'personal';
  });

  protected readonly askTabsAria = $localize`:@@pnd.asks_tabs_aria:Loan type`;

  /** One tab per loan type the name is offered under, in the platform's order. */
  protected readonly askTabs = computed<RailTabItem[]>(() => {
    const on = this.name()?.categories ?? [];
    return LOAN_CATEGORIES.filter((c) => on.includes(c)).map((c) => {
      const count = this.served().find((s) => s.category === c)?.servedTotal;
      return {
        id: c,
        label: categoryLabel(c),
        ...(count === undefined ? {} : { count, countLabel: this.questionsLabel(count) }),
      };
    });
  });

  protected selectAskTab(id: string): void {
    const category = LOAN_CATEGORIES.find((c) => c === id);
    if (category !== undefined) this.askTab.set(category);
  }

  /** "23 questions on 3 pages · all required". */
  protected askSummary(sv: ServedCount): string {
    const pages = (sv.pages ?? []).filter((p) => p.questions.length > 0).length;
    const questions = this.questionsLabel(sv.servedTotal);
    const head =
      pages === 1
        ? $localize`:@@pnd.asks_summary_one:${questions}:QUESTIONS: on 1 page`
        : $localize`:@@pnd.asks_summary:${questions}:QUESTIONS: on ${pages}:PAGES: pages`;
    const required =
      sv.servedRequired === sv.servedTotal
        ? $localize`:@@pnd.asks_all_required:all required`
        : $localize`:@@pnd.asks_some_required:${sv.servedRequired}:N: required`;
    return `${head} · ${required}`;
  }

  private questionsLabel(n: number): string {
    return n === 1
      ? $localize`:@@srvp.count_one:1 question`
      : $localize`:@@srvp.count_many:${n}:N: questions`;
  }

  // --- Step 2 writes ---------------------------------------------------------

  /**
   * An Add, confirmed when the question is REQUIRED: an application already in progress under
   * this program then has to answer it before it can be submitted.
   */
  protected askToAdd(row: AddableRow): void {
    if (!row.isRequired) {
      void this.addQuestion(row);
      return;
    }
    this.modal.confirm({
      nzTitle: $localize`:@@pnd.add_req_title:Ask “${row.label}:QUESTION:” of this program's applicants?`,
      nzContent: $localize`:@@pnd.add_req_body:It must be answered, so an application already in progress under this program has to answer it before it can be submitted. No other program changes.`,
      nzOkText: $localize`:@@pnd.req_ok:Ask it`,
      nzCancelText: $localize`:@@pnd.req_cancel:Leave it`,
      nzOnOk: () => {
        void this.addQuestion(row);
        // `nzOnOk` must RETURN TRUE: a void handler is read as a cancel.
        return true;
      },
    });
  }

  /** Tick one question for this name, with the gate sources it needs (nearest first). */
  private async addQuestion(row: AddableRow): Promise<void> {
    const category = this.askCategory();
    const current = this.addedByCat().get(category) ?? new Set<string>();
    const saved = await this.write(row.id, () =>
      this.saveAdded(category, new Set([...current, row.id, ...row.chainIds])),
    );
    // The row leaves the sheet as it lands in the list behind it; say where it went.
    if (saved) {
      this.message.success(
        $localize`:@@pnd.add_done:Added “${row.label}:QUESTION:” to “${row.group}:PAGE:”`,
      );
    }
  }

  /** Remove one question from this name: untick it. Only a ticked question can go. */
  protected async removeQuestion(code: string): Promise<void> {
    const category = this.askCategory();
    const question = this.poolByCode().get(code);
    if (question === undefined || this.rowStates().get(code) !== 'added') return;
    const next = new Set(this.addedByCat().get(category) ?? []);
    next.delete(question.id);
    await this.write(question.id, () => this.saveAdded(category, next));
  }

  /**
   * One write at a time — an order save included; the served list is read again after it,
   * refused or not. True when the write landed.
   */
  private async write(busyId: string, run: () => Promise<void>): Promise<boolean> {
    if (this.savingAsk().size > 0 || this.savingOrder()) return false;
    this.savingAsk.set(new Set([busyId]));
    this.asksError.set(null);
    try {
      await run();
      return true;
    } catch (err) {
      this.asksError.set(this.localizedError(err));
      // A lock the page did not know about (a bank program filed since the read): re-read.
      await this.loadScope();
      return false;
    } finally {
      await this.loadServed({ quiet: true });
      this.savingAsk.set(new Set<string>());
    }
  }

  private async saveAdded(category: LoanCategory, set: ReadonlySet<string>): Promise<void> {
    const saved = await this.api.setProgramNameQuestionAdditions(
      this.routeKey(),
      category,
      additionsToSave(this.pool(), set),
    );
    const next = new Map(this.addedByCat());
    next.set(category, new Set(saved.added));
    this.addedByCat.set(next);
  }

  // --- Step 2 · the program's own order ----------------------------------------
  //
  // Each program asks its questions in its own order, per loan type (v32.0.0,
  // `program_name_question_order`); the Questions tab's order is only the default. The order
  // editor works on the served pages themselves, so what the operator drags is what the app
  // shows, and a move is saved at once: the whole served list, in the new order.

  protected readonly ordering = signal(false);
  protected readonly savingOrder = signal(false);
  /** Said to a screen reader after each move: where the question now sits. */
  protected readonly orderStatus = signal('');

  protected startOrdering(): void {
    this.orderStatus.set('');
    this.ordering.set(true);
  }

  protected stopOrdering(): void {
    this.ordering.set(false);
  }

  /**
   * One move on one page: refused here when it would put a follow-up above the question it
   * follows, saved otherwise. The list moves at once and goes back if the server refuses.
   */
  protected async moveQuestion(move: PageMove): Promise<void> {
    if (this.savingOrder() || this.savingAsk().size > 0) return;
    const category = this.askCategory();
    const sv = this.servedHere();
    if (sv === null) return;
    const after = pagesAfterMove<ServedPage['questions'][number], ServedPage>(sv.pages ?? [], move);
    if (after === null) return;
    const page = after.pages.find((p) => p.code === move.page);
    const rows = [...(page?.questions ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
    const block = moveBlock(rows, after.movedCode);
    if (block !== null) {
      this.message.warning(moveBlockText(block, this.isAr));
      return;
    }
    const byCode = this.poolByCode();
    const ids: string[] = [];
    for (const code of servedOrder(after.pages)) {
      const q = byCode.get(code);
      // A code the pool does not know (a question switched off since the read): save nothing
      // rather than an order that leaves it out.
      if (q === undefined) return;
      ids.push(q.id);
    }
    const before = this.served();
    this.served.set(
      before.map((s) => (s.category === category ? { ...s, pages: after.pages } : s)),
    );
    this.savingOrder.set(true);
    this.asksError.set(null);
    try {
      await this.api.setProgramNameQuestionOrder(this.routeKey(), category, ids);
      const moved = rows.find((q) => q.code === after.movedCode);
      if (moved !== undefined && page !== undefined) {
        const label = this.isAr ? moved.questionAr : moved.questionEn;
        const title = this.isAr ? page.titleAr : page.titleEn;
        this.orderStatus.set(
          $localize`:@@pnd.order_status:“${label}:QUESTION:” is now ${move.to + 1}:POS: of ${rows.length}:TOTAL: on “${title}:PAGE:”`,
        );
      }
    } catch (err) {
      this.served.set(before);
      this.asksError.set(this.localizedError(err));
    } finally {
      await this.loadServed({ quiet: true });
      this.savingOrder.set(false);
    }
  }

  // --- Step 2 reads ----------------------------------------------------------

  /** Everything step 2 draws. The served read is taken on every arrival; the pool once. */
  private loadAsks(): void {
    void this.loadServed();
    void this.loadPool();
  }

  /**
   * Read on every arrival at step 2, not once: turning a loan type on or off on step 1 changes
   * what is served. `quiet` keeps the list on screen while it is read again after a write.
   */
  private async loadServed(opts: { quiet?: boolean } = {}): Promise<void> {
    const key = this.routeKey();
    if (!opts.quiet) {
      this.servedLoading.set(true);
      this.asksError.set(null);
    }
    try {
      this.served.set(await this.questionnaire.servedForName(key));
    } catch (err) {
      if (!opts.quiet) this.served.set([]);
      this.asksError.set(this.localizedError(err));
    } finally {
      this.servedLoading.set(false);
    }
  }

  /** The pool and this name's stored picks. A failed read leaves editing off, never wrong. */
  private async loadPool(): Promise<void> {
    if (this.poolRequested) return;
    this.poolRequested = true;
    try {
      const [tree] = await Promise.all([this.questionnaire.tree(), this.loadScope()]);
      this.pool.set(toAskablePool(tree));
    } catch (err) {
      this.poolRequested = false;
      this.pool.set([]);
      this.asksError.set(this.localizedError(err));
    }
  }

  private async loadScope(): Promise<void> {
    const scope = await this.api.programNameQuestionScope(this.routeKey());
    const toMap = (
      byCategory: Partial<Record<LoanCategory, string[]>> | undefined,
    ): ReadonlyMap<LoanCategory, ReadonlySet<string>> =>
      new Map(
        Object.entries(byCategory ?? {}).map(([category, ids]) => [
          category as LoanCategory,
          new Set(ids ?? []),
        ]),
      );
    this.locks.set(scope.locks);
    this.addedByCat.set(toMap(scope.addedByCategory));
  }

  ngOnInit(): void {
    // A deep link can land straight on step 2 — `newNameLanding` sends every freshly
    // created name there — so the reads cannot wait for a click on the rail.
    if (this.stepIndex() === 1) this.loadAsks();
    void this.load();
  }

  // --- Display helpers -------------------------------------------------------

  protected nameOf(row: ProgramNameRow): string {
    return this.isAr ? row.labelAr : row.labelEn;
  }

  protected usageLabel(row: ProgramNameRow): string {
    return $localize`:@@pnd.usage_value:${row.usage.programs}:PROGRAMS: bank programs · ${row.usage.banks}:BANKS: banks`;
  }

  // --- Writes ----------------------------------------------------------------

  /** Offer / withdraw this name under one category. Optimistic. */
  protected async toggleOffered(category: LoanCategory): Promise<void> {
    const n = this.name();
    if (!n || this.savingOffer()) return;

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
   * A rejection → the shared error-code vocabulary. Never a per-component English
   * string for a code the backend also reports (A22).
   */
  private localizedError(err: unknown): string {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })?.error;
    return this.errors.toLocalizedMessage(
      (envelope?.code ?? 'INTERNAL_ERROR') as Parameters<ErrorCodeService['toLocalizedMessage']>[0],
      envelope?.meta,
    );
  }

  // --- State plumbing --------------------------------------------------------

  private async load(opts: { quiet?: boolean } = {}): Promise<void> {
    if (!opts.quiet) this.loading.set(true);
    try {
      const rows = await this.api.list(ENUM_TYPE);
      const { rows: names } = absorbProgramNames(rows);
      this.name.set(names.find((n) => n.key === this.routeKey()) ?? null);
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
}
