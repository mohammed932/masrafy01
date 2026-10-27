import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzDrawerService, type NzDrawerRef } from 'ng-zorro-antd/drawer';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  CheckCircleOutline,
  CloseOutline,
  DeleteOutline,
  EditOutline,
  EllipsisOutline,
  HolderOutline,
  LockOutline,
  PlusOutline,
  SearchOutline,
  UndoOutline,
  ThunderboltOutline,
  WarningOutline,
} from '@ant-design/icons-angular/icons';
import {
  QuestionnaireApiService,
  isChoiceQuestionType,
  type DeletedFixedQuestion,
  type EnabledWhenRule,
  type FixedServedOn,
  type OptionRow,
  type PublishWarning,
  type QuestionEngineLock,
  type QuestionRow,
  type QuestionType,
  type UpdateQuestionBody,
} from './questionnaire.api.service';
import {
  engineLockOf,
  isFixed,
  isListed,
  reorderWithin,
  servedOnHint,
  servedOnLabel,
} from './question-pool-view';
import {
  DeleteFixedQuestionDialog,
  type DeleteFixedQuestionData,
} from './delete-fixed-question.dialog';
import {
  ANSWER_EFFECT_LIMITS,
  betterThanBank,
  effectParts,
  hasAnyLever,
  leversOfOption,
  monthsEffectValidator,
  signedEffectValidator,
  type AnswerEffectBody,
  type AnswerEffectLevers,
} from './answer-effect';
import { ruleCodes } from '@shared/questions/enabled-when';
import { CanDirective } from '@shared/can.directive';
import { AuthService } from '@core/auth/auth.service';
import { categoryLabel, isLoanCategory } from '@core/loan-category';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { MoneyInputDirective, formatGroupedNumber } from '@core/directives/money-input.directive';
import { DrawerSectionComponent, FormDrawerComponent, openFormDrawer } from '@shared/ui';

/** Ordered for the segmented control: the two choice types, then the two value types. */
const TYPE_ORDER: readonly QuestionType[] = ['SINGLE_SELECT', 'MULTI_SELECT', 'NUMERIC', 'TEXT'];

/**
 * Answer chips shown on a collapsed row before collapsing into a `+N` counter.
 * Generous because the chips own a full-width line: nearly every question in the
 * pool fits entirely, so the count is a rare fallback rather than the norm.
 */
const INLINE_OPTION_PREVIEW = 8;

/**
 * Questions rendered per page. The pool grows without bound, and every row can
 * carry a full line of answer chips, so an unpaged list turned the only screen
 * that shows the questionnaire into a scroll hunt. Paging is CLIENT-side: the
 * tree endpoint returns the whole pool in one call (search, the type counts, the
 * health panel, and reordering all need every row), so a server page would cost
 * a round-trip per page and still not shrink the payload.
 */
const PAGE_SIZE = 10;

/**
 * The editor sheet's width: wider than a one-column form's default, because a numeric question
 * puts three bounds on one row and a branch rule is a sentence with two pickers in it.
 */
const SHEET_WIDTH = 'min(640px, calc(100vw - 32px))';

type TypeFilter = QuestionType | 'ALL';

/** The comparisons `enabledWhen` can carry — the server's own closed set. */
type BranchOperator = 'equals' | 'not_equals' | 'in';

/**
 * GLOBAL question-pool authoring (Constitution V, Feature 010 — questions are
 * admin DATA with NO category). One pool feeds one global questionnaire; codes
 * are auto-generated server-side (read-only here, A33).
 *
 * The pool is authored FLAT: one ordered list of questions, no group/section
 * dimension in the UI. Groups still exist in the database (they page the mobile
 * wizard), but the editor never names one — `POST /questions` omits `groupId` and
 * the server places the row. That trade buys the two things a sectioned tree could
 * not: the whole questionnaire is visible and searchable at once, and order is a
 * single global sequence you can drag, instead of a per-section number you type.
 *
 * Editing happens in a SIDE SHEET (the shared app-form-drawer), like every other add/edit
 * form in the dashboard: the list stays on screen beside it, so the admin keeps the
 * surrounding questions in view while they edit one. Every edit auto-publishes a new
 * global version.
 *
 * FIXED questions are data the admin owns, both ways (v31.0.0, v31.1.0): a question is made
 * fixed — asked on every program of its loan types — or ordinary again at will, and made
 * required or optional like any other. The list shows the fixed questions and every
 * ordinary one no surrogate product asks; those are managed from the Program catalog, stay in
 * `rows` (branch rules, the reorder and `?q=` need them) and open here only by link. Deleting
 * a fixed question is a super admin's, through a type-the-code dialog.
 */
@Component({
  standalone: true,
  selector: 'mf-questionnaire-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CanDirective,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSwitchModule,
    NzSpinModule,
    NzEmptyModule,
    NzPaginationModule,
    NzIconModule,
    NzSelectModule,
    NzToolTipModule,
    MoneyInputDirective,
    FormDrawerComponent,
    DrawerSectionComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowDownOutline,
      ArrowUpOutline,
      CheckCircleOutline,
      CloseOutline,
      DeleteOutline,
      EditOutline,
      EllipsisOutline,
      HolderOutline,
      LockOutline,
      PlusOutline,
      SearchOutline,
      ThunderboltOutline,
      UndoOutline,
      WarningOutline,
    ]),
  ],
  template: `
    <section class="page">
      <!-- Command bar — title, health, and the primary action on ONE row. The
           former hero card spent ~120px restating counts that the toolbar below
           already carries, on a screen whose job is to show a long list. -->
      <header class="bar">
        <div class="bar-lead">
          <p class="eyebrow" i18n="@@qedit.eyebrow">Matching engine</p>
          <div class="title-row">
            <h1 i18n="@@qedit.title">Question pool</h1>
            @if (published()) {
              <span
                class="live-chip"
                title="A version is published"
                i18n-title="@@qedit.live_title"
              >
                <span class="live-dot" aria-hidden="true"></span>
                <span i18n="@@qedit.live">Live</span>
              </span>
            }
          </div>
        </div>

        <div class="bar-actions">
          <!-- Health is a chip, not a banner: an unclaimed money binding is a
               standing condition, so it belongs where the admin can ignore it and
               still see the list. Expanded on demand, below. -->
          @if (issueCount() > 0) {
            <button
              type="button"
              class="health warn"
              [class.on]="healthOpen()"
              [attr.aria-expanded]="healthOpen()"
              (click)="healthOpen.set(!healthOpen())"
            >
              <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@qedit.health_issues">{{ issueCount() }} to fix</span>
            </button>
          } @else if (!loading() && listed().length > 0) {
            <span class="health ok">
              <span nz-icon nzType="check-circle" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@qedit.health_ok">Ready to ask</span>
            </span>
          }
          <span class="autosave" i18n="@@qedit.autosave">Saves &amp; publishes automatically</span>
          <button nz-button nzType="primary" (click)="startCreate()">
            <span nz-icon nzType="plus" nzTheme="outline"></span>
            <span i18n="@@qedit.add_question">Question</span>
          </button>
        </div>
      </header>

      @if (healthOpen() && issueCount() > 0) {
        <div class="health-panel">
          @if (bindingWarnings().length > 0) {
            <p class="hp-title" i18n="@@qedit.binding_warn_title">
              Some figures the engine prices on are not being collected
            </p>
            <ul class="hp-list">
              @for (w of bindingWarnings(); track w.code + bindingOf(w)) {
                <li>
                  <code>{{ bindingOf(w) }}</code>
                  <span>{{ warningMessage(w) }}</span>
                </li>
              }
            </ul>
          }
          @if (incomplete().length > 0) {
            <p class="hp-title" i18n="@@qedit.hp_incomplete_title">
              These questions can't be asked yet — a choice question needs at least two options.
            </p>
            <ul class="hp-list">
              @for (q of incomplete(); track q.id) {
                <li>
                  <button type="button" class="hp-jump" (click)="jumpTo(q)">
                    {{ isAr ? q.questionAr : q.questionEn }}
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      }

      @if (loading()) {
        <div class="center"><nz-spin nzSimple /></div>
      } @else if (listed().length === 0) {
        <ng-container [ngTemplateOutlet]="hiddenNote"></ng-container>
        <div class="empty-card">
          <nz-empty
            nzNotFoundContent="No questions yet — the first one you add becomes the first thing every applicant is asked"
            i18n-nzNotFoundContent="@@qedit.empty"
          />
          <button nz-button nzType="primary" (click)="startCreate()" i18n="@@qedit.empty_cta">
            Add the first question
          </button>
        </div>
      } @else {
        <!-- Toolbar — search + type filter + the incomplete-only shortcut. A global
             pool is dozens of rows long; without these it is a scroll hunt. -->
        <div class="toolbar" role="search">
          <!-- nz-input-group owns the icon's gutter. A hand-placed absolute icon
               sat on top of the placeholder's first character. -->
          <nz-input-group class="search" nzPrefixIcon="search" nzSize="large">
            <input
              nz-input
              [formControl]="searchCtrl"
              placeholder="Search questions, answers, or codes"
              i18n-placeholder="@@qedit.search_ph"
              aria-label="Search the question pool"
              i18n-aria-label="@@qedit.search_aria"
            />
          </nz-input-group>

          <div
            class="filters"
            role="radiogroup"
            aria-label="Filter by answer type"
            i18n-aria-label="@@qedit.filter_aria"
          >
            <button
              type="button"
              role="radio"
              class="chip"
              [class.on]="typeFilter() === 'ALL'"
              [attr.aria-checked]="typeFilter() === 'ALL'"
              (click)="setTypeFilter('ALL')"
              i18n="@@qedit.filter_all"
            >
              All
            </button>
            <!-- A type with no questions is disabled rather than hidden: it still
                 tells the admin the type exists, without offering a filter whose
                 only possible result is an empty list. -->
            @for (t of types; track t) {
              <button
                type="button"
                role="radio"
                class="chip"
                [class.on]="typeFilter() === t"
                [attr.aria-checked]="typeFilter() === t"
                [disabled]="countOfType(t) === 0"
                (click)="setTypeFilter(t)"
              >
                {{ typeLabel(t) }}
                <span class="chip-n">{{ countOfType(t) }}</span>
              </button>
            }
          </div>

          <!-- Only where it narrows: on a list of nothing but fixed questions it would be a
               filter whose one result is the list already on screen. -->
          @if (fixedNarrows()) {
            <button
              type="button"
              class="chip fixed"
              [class.on]="onlyFixed()"
              [attr.aria-pressed]="onlyFixed()"
              (click)="setOnlyFixed(!onlyFixed())"
            >
              <span i18n="@@qedit.filter_fixed">Fixed</span>
              <span class="chip-n">{{ fixedCount() }}</span>
            </button>
          }

          @if (incomplete().length > 0) {
            <button
              type="button"
              class="chip warn"
              [class.on]="onlyIncomplete()"
              [attr.aria-pressed]="onlyIncomplete()"
              (click)="setOnlyIncomplete(!onlyIncomplete())"
            >
              <span i18n="@@qedit.only_incomplete">Needs options</span>
              <span class="chip-n">{{ incomplete().length }}</span>
            </button>
          }

          <!-- Not a filter: the deleted fixed questions are not in the pool, so this opens
               their own list, with Restore. A super admin's, like the delete itself. -->
          @if (deletedFixed().length > 0) {
            <button
              *can="['super_admin']"
              type="button"
              class="chip"
              [class.on]="deletedShown()"
              [attr.aria-expanded]="deletedShown()"
              aria-controls="qedit-deleted"
              (click)="deletedOpen.set(!deletedOpen())"
            >
              <span i18n="@@qedit.deleted_chip">Deleted</span>
              <span class="chip-n">{{ deletedFixed().length }}</span>
            </button>
          }

          <p class="showing">
            @if (filtering()) {
              <span i18n="@@qedit.showing"
                >{{ visible().length }} of {{ listed().length }} questions</span
              >
              <button
                type="button"
                class="link"
                (click)="clearFilters()"
                i18n="@@qedit.clear_filters"
              >
                Clear
              </button>
            } @else {
              <span i18n="@@qedit.total"
                >{{ listed().length }} questions · {{ totalOptions() }} answers</span
              >
            }
          </p>
        </div>

        <ng-container [ngTemplateOutlet]="hiddenNote"></ng-container>

        @if (deletedShown()) {
          <section class="deleted-panel" id="qedit-deleted" aria-labelledby="qedit-deleted-title">
            <p class="dp-title" id="qedit-deleted-title" i18n="@@qedit.deleted_title">
              Deleted fixed questions
            </p>
            <p class="dp-hint" i18n="@@qedit.deleted_hint">
              Restore brings a question back with its answers and loan types, and every program asks
              it again right away.
            </p>
            <ul class="dp-list">
              @for (d of deletedFixed(); track d.id) {
                <li class="dp-row">
                  <span class="dp-text">
                    <span class="dp-q">{{ isAr ? d.questionAr : d.questionEn }}</span>
                    <span class="dp-meta">{{ deletedMeta(d) }}</span>
                  </span>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [nzLoading]="restoringId() === d.id"
                    [disabled]="restoringId() !== null"
                    [attr.aria-label]="restoreAria(d)"
                    (click)="restore(d)"
                  >
                    <span nz-icon nzType="undo" nzTheme="outline" aria-hidden="true"></span>
                    <span i18n="@@qedit.restore">Restore</span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }

        @if (filtering() && visible().length > 0) {
          <p class="drag-note" i18n="@@qedit.drag_disabled">
            Dragging is off while the list is filtered — the order you'd see isn't the order
            applicants get. Use the row menu to move a question, or clear the filter.
          </p>
        } @else if (pageCount() > 1) {
          <!-- A drag cannot cross a page boundary, so the one move the list can't
               do is spelled out where the admin would otherwise try it. -->
          <p class="drag-note" i18n="@@qedit.drag_page">
            Dragging reorders within this page. To move a question to another page, open it and use
            the arrows in the editor's header.
          </p>
        }

        @if (visible().length === 0) {
          <div class="empty-card">
            <p class="nm-title" i18n="@@qedit.no_matches_title">Nothing matches that filter</p>
            <p class="nm-body" i18n="@@qedit.no_matches_body">
              The pool still has {{ listed().length }} questions — they're just filtered out.
            </p>
            <button nz-button (click)="clearFilters()" i18n="@@qedit.clear_filters">Clear</button>
          </div>
        } @else {
          <!-- The list is the page. Rows sit directly on one surface, separated by
               hairlines: a card per question would nest a card inside a card and
               spend ~24px of chrome on every row for no added meaning. -->
          <ul
            class="list"
            [class.has-pager]="pageCount() > 1"
            cdkDropList
            [cdkDropListDisabled]="!reorderable()"
            (cdkDropListDropped)="drop($event)"
          >
            @for (q of paged(); track q.id) {
              <li
                class="row"
                cdkDrag
                cdkDragLockAxis="y"
                [cdkDragDisabled]="!reorderable()"
                [class.open]="expandedId() === q.id"
                [class.flagged]="needsOptions(q)"
              >
                <div class="row-head">
                  <button
                    type="button"
                    class="handle"
                    cdkDragHandle
                    [disabled]="!reorderable()"
                    aria-label="Drag to reorder"
                    i18n-aria-label="@@qedit.reorder_aria"
                  >
                    <span nz-icon nzType="holder" nzTheme="outline" aria-hidden="true"></span>
                  </button>

                  <span class="ord" aria-hidden="true">{{ positionOf(q) }}</span>

                  <button
                    type="button"
                    class="row-main"
                    [attr.aria-expanded]="expandedId() === q.id"
                    (click)="toggleRow(q)"
                  >
                    <span class="q-text" [dir]="isAr ? 'rtl' : 'ltr'">{{
                      isAr ? q.questionAr : q.questionEn
                    }}</span>
                    <!-- The auto-generated code is deliberately NOT shown here: it is
                         machine identity the admin never types (A33), and it competed
                         with the question for the eye on all 41 rows. Search still
                         matches it. -->
                    <!-- A value type's rule is short and belongs on the title line;
                         only choice answers need the width of a second line. -->
                    @if (!isChoice(q.type)) {
                      <span class="rule-line">{{ ruleSummary(q) }}</span>
                    }
                  </button>

                  <!-- Both chips share one cell so the kebab stays in the same
                       column on every row — an optional required-chip cell of its
                       own would shift every kebab it is missing from. -->
                  <span class="row-meta">
                    <!-- A fact about where the question is asked, not a lock: worded, so it
                         never reads as the padlock beside it. -->
                    @if (isFixed(q)) {
                      <span class="fixed-chip" nz-tooltip [nzTooltipTitle]="fixedTip(q)"
                        ><span i18n="@@qedit.fixed_chip">Fixed</span
                        ><span class="sr-only">{{ fixedTip(q) }}</span></span
                      >
                    }
                    <!-- The engine reads this answer, so the server refuses anything but
                         its wording and answer order. Said on the row so the admin knows
                         before opening it, not after a refused save. -->
                    @if (engineLockOf(q); as lock) {
                      <span class="lock-chip" nz-tooltip [nzTooltipTitle]="lockSummary(lock)"
                        ><span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span
                        ><span class="sr-only">{{ lockSummary(lock) }}</span></span
                      >
                    }
                    <span
                      class="type-chip"
                      [class.value-type]="!isChoice(q.type)"
                      nz-tooltip
                      [nzTooltipTitle]="typeHint(q.type)"
                      >{{ typeLabel(q.type) }}</span
                    >
                    <!-- Required is the DEFAULT, so 41 identical "required" chips
                         said nothing. Only the exception is worth a chip. -->
                    @if (!q.isRequired) {
                      <span
                        class="req"
                        nz-tooltip
                        nzTooltipTitle="Applicants may skip this"
                        i18n-nzTooltipTitle="@@qedit.optional_tip"
                        i18n="@@qedit.optional_chip"
                        >optional</span
                      >
                    }
                  </span>

                  <!-- Opens the editor, same as clicking the row. It used to open a
                       4-item dropdown; move/delete now live in the editor itself, so
                       there is nothing left for a menu to hold. -->
                  <button
                    type="button"
                    class="kebab"
                    nz-button
                    nzType="text"
                    nzShape="circle"
                    (click)="toggleRow(q)"
                    aria-label="Edit question"
                    i18n-aria-label="@@qedit.edit_question_aria"
                  >
                    <span nz-icon nzType="ellipsis" nzTheme="outline"></span>
                  </button>
                </div>

                <!-- Answers get their own full-width line under the question. Squeezed
                     into a column beside it they truncated to "Getti…" / "Scho…",
                     which is worse than not showing them: the admin has to open the
                     row to learn what it already looked like it was telling them. -->
                @if (isChoice(q.type)) {
                  <div class="row-answers">
                    @if (q.options.length === 0) {
                      <span class="pill warn" i18n="@@qedit.needs_options_short"
                        >needs options</span
                      >
                    } @else {
                      @for (o of previewOptions(q); track o.id) {
                        <span class="pill" [dir]="isAr ? 'rtl' : 'ltr'">{{
                          isAr ? o.labelAr : o.labelEn
                        }}</span>
                      }
                      @if (q.options.length > INLINE_OPTION_PREVIEW) {
                        <span
                          class="pill more"
                          nz-tooltip
                          [nzTooltipTitle]="allOptionLabels(q)"
                          i18n="@@qedit.opt_more"
                          >+{{ q.options.length - INLINE_OPTION_PREVIEW }} more</span
                        >
                      }
                    }
                  </div>
                }

                <div class="drag-ghost" *cdkDragPlaceholder></div>
              </li>
            }

            <!-- The new question lands where it will actually be asked (last), so the
                 affordance sits at the end of the list rather than only in the bar —
                 and only on the page that IS the end. -->
            @if (!filtering() && page() === pageCount()) {
              <li class="row add-row">
                <button type="button" class="add-inline" (click)="startCreate()">
                  <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@qedit.add_question_inline">Add a question to the end</span>
                </button>
              </li>
            }
          </ul>

          <!-- Pager sits below the list and is hidden on a single page: a control
               whose only state is "page 1 of 1" is chrome, not navigation. -->
          @if (pageCount() > 1) {
            <nav class="pager" aria-label="Question pages" i18n-aria-label="@@qedit.pager_aria">
              <p class="pager-range" i18n="@@qedit.page_range">
                Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ visible().length }}
              </p>
              <nz-pagination
                [nzPageIndex]="page()"
                [nzPageSize]="PAGE_SIZE"
                [nzTotal]="visible().length"
                nzSize="small"
                (nzPageIndexChange)="setPage($event)"
              />
            </nav>
          }
        }
      }
    </section>

    <!-- The editor is a SIDE SHEET — app-form-drawer, opened through NzDrawerService like every
         other add/edit form in the dashboard (openSheet). The template stays in this page, so
         the form keeps the page's own state: the pool, the branch sources, the move buttons.
         The drawer owns the full-viewport mask (A34), the focus trap, Esc, and the end-edge
         placement in both directions; the list stays on screen beside the sheet. -->
    <ng-template #editorSheet>
      <app-form-drawer
        class="qe-sheet"
        [title]="sheetTitle()"
        [subtitle]="sheetSubtitle()"
        [submitLabel]="saveLabel()"
        [submitDisabled]="saveBlocked()"
        [submitting]="saving()"
        (cancelled)="cancel()"
        (submitted)="submitQuestion()"
      >
        <span drawerIcon nz-icon [nzType]="editing() ? 'edit' : 'plus'" nzTheme="outline"></span>
        <!-- Reordering lives here: the keyboard twin of the drag handle, and the only way to
             move a question while filtered. A question this tab does not list has no place in
             it to move. -->
        @if (movableQuestion(); as eq) {
          <span drawerHeadActions class="sheet-moves">
            <button
              type="button"
              class="icon-btn"
              [disabled]="positionOf(eq) === 1"
              (click)="moveBy(eq, -1)"
              nz-tooltip
              nzTooltipTitle="Move up"
              i18n-nzTooltipTitle="@@qedit.move_up"
              aria-label="Move up"
              i18n-aria-label="@@qedit.move_up"
            >
              <span nz-icon nzType="arrow-up" nzTheme="outline"></span>
            </button>
            <button
              type="button"
              class="icon-btn"
              [disabled]="positionOf(eq) === listed().length"
              (click)="moveBy(eq, 1)"
              nz-tooltip
              nzTooltipTitle="Move down"
              i18n-nzTooltipTitle="@@qedit.move_down"
              aria-label="Move down"
              i18n-aria-label="@@qedit.move_down"
            >
              <span nz-icon nzType="arrow-down" nzTheme="outline"></span>
            </button>
          </span>
        }
        <!-- On the footer's start edge, away from Save. A fixed question is a super admin's to
             delete, through the dialog that says what the delete costs and asks for the code;
             one the loan engine reads (and is not fixed) is not deleted from here at all. -->
        @if (deletableQuestion(); as eq) {
          <button
            drawerFootStart
            type="button"
            nz-button
            nzType="text"
            nzDanger
            (click)="deleteQuestion(eq)"
            i18n="@@qedit.delete_question"
          >
            Delete question
          </button>
        }
        <ng-container [ngTemplateOutlet]="questionEditor"></ng-container>
      </app-form-drawer>
    </ng-template>

    <!-- One editor for both edit and create: the two differ only in whether a question is
         already saved, so duplicating the form would be two places to fix every rule. ONE
         column of labelled sections, read top to bottom in the order an admin decides them:
         what is asked, how it is answered, who must answer it, and when it is asked. -->
    <ng-template #questionEditor>
      <form [formGroup]="questionForm" class="form" (ngSubmit)="submitQuestion()" novalidate>
        <!-- First, because it explains every control below that is greyed out. -->
        @if (editLock(); as lock) {
          <div class="lock-note" role="note">
            <span
              class="lock-ico"
              nz-icon
              nzType="lock"
              nzTheme="outline"
              aria-hidden="true"
            ></span>
            <div class="lock-text">
              @if (lock.reason === 'program') {
                <p class="lock-title" i18n="@@qedit.lock_title_program">
                  Bank programs work out offers from this answer
                </p>
              } @else {
                <p class="lock-title" i18n="@@qedit.lock_title_engine">
                  The loan engine reads this answer
                </p>
              }
              <!-- Said by what may still change, not by who reads it. A fixed one leaves out
                   the delete: a super admin may still delete it, through the dialog that says
                   what the engine loses. -->
              @if (editingFixed()) {
                <p class="lock-body" i18n="@@qedit.lock_body_fixed_q">
                  Its answer type, unit, when-to-ask rule and answers stay as they are. Its wording,
                  and whether it is required or fixed, can change.
                </p>
              } @else {
                <p class="lock-body" i18n="@@qedit.lock_body_fixed">
                  Its answer type, unit, when-to-ask rule and answers stay as they are, and it can't
                  be deleted. Its wording, and whether it is required or fixed, can change.
                </p>
              }
              <p class="lock-body" i18n="@@qedit.lock_numbers">
                Keep the numbers in its wording as they are, in the question, the helper text and
                the answers: applicants choose by them.
              </p>
              @if (lock.reason === 'program') {
                <p class="lock-who" i18n="@@qedit.lock_who">Read by {{ programNamesOf(lock) }}</p>
              }
            </div>
          </div>
        }

        <app-drawer-section [label]="secQuestion">
          <label class="field">
            <span class="lbl" i18n="@@qedit.lang_en">English</span>
            <input
              nz-input
              formControlName="questionEn"
              placeholder="e.g. What is your monthly income?"
            />
          </label>
          <label class="field">
            <span class="lbl" i18n="@@qedit.lang_ar">العربية</span>
            <input
              nz-input
              formControlName="questionAr"
              dir="rtl"
              placeholder="مثال: ما هو دخلك الشهري؟"
            />
          </label>
        </app-drawer-section>

        <!-- Optional sub-label. It carries the sentence that stops a figure being misread — the
             credit-card question asks for a total LIMIT across every card, which an applicant
             answers with a balance unless the prompt says otherwise, and a wrong figure there
             moves the DBR. -->
        <app-drawer-section [label]="secHelper" [optionalLabel]="optionalLabel" [hint]="helperHint">
          <label class="field">
            <span class="lbl" i18n="@@qedit.lang_en">English</span>
            <input
              nz-input
              formControlName="helperTextEn"
              placeholder="e.g. Add up the limit on every card, not what you owe."
            />
          </label>
          <label class="field">
            <span class="lbl" i18n="@@qedit.lang_ar">العربية</span>
            <input
              nz-input
              formControlName="helperTextAr"
              dir="rtl"
              placeholder="مثال: اجمع الحد الائتماني لكل بطاقة، وليس المبلغ المستخدم."
            />
          </label>
        </app-drawer-section>

        <app-drawer-section [label]="secAnswer">
          <!-- Typed reactive control, not ngModel (Principle XXII / A16). A radiogroup rather
               than a dropdown: four options are worth showing at once, and the choice changes
               the rest of the form. -->
          <div class="type-group" role="radiogroup" [attr.aria-label]="answerTypeLabel">
            @for (t of types; track t) {
              <button
                type="button"
                role="radio"
                class="type-btn"
                [class.on]="selectedType() === t"
                [attr.aria-checked]="selectedType() === t"
                [disabled]="typeLocked()"
                (click)="pickType(t)"
              >
                {{ typeLabel(t) }}
              </button>
            }
          </div>
          <p class="hint">
            {{ typeHint(selectedType()) }}
            <!-- Every saved question is locked to its type; the lock note above already says so
                 when the engine reads it. -->
            @if (typeLocked() && !editLock()) {
              <span i18n="@@qedit.type_locked_short"
                >It can't change once a question is saved — add a new question instead.</span
              >
            }
          </p>

          <!-- Per-type rules. Only the owning type's block is rendered, so the form cannot
               express a combination the server rejects with QUESTION_TYPE_RULES_INVALID. -->
          @if (selectedType() === 'NUMERIC') {
            <div formGroupName="numeric" class="rule-box">
              <p class="sub-lbl" i18n="@@qedit.sec_rules">Accepted values</p>
              <div class="field-row">
                <label class="field grow">
                  <span class="lbl" i18n="@@qedit.num_min">Minimum</span>
                  <input
                    nz-input
                    appMoneyInput
                    formControlName="minValue"
                    inputmode="decimal"
                    placeholder="1,000"
                  />
                </label>
                <label class="field grow">
                  <span class="lbl" i18n="@@qedit.num_max">Maximum</span>
                  <input
                    nz-input
                    appMoneyInput
                    formControlName="maxValue"
                    inputmode="decimal"
                    placeholder="20,000,000"
                  />
                </label>
                <label class="field grow">
                  <span class="lbl" i18n="@@qedit.num_step">Step</span>
                  <input
                    nz-input
                    appMoneyInput
                    formControlName="step"
                    inputmode="decimal"
                    placeholder="1,000"
                  />
                </label>
              </div>
              <div class="field-row">
                <label class="field grow">
                  <span class="lbl" i18n="@@qedit.num_unit_en">Unit (English)</span>
                  <input nz-input formControlName="unitEn" placeholder="EGP" />
                </label>
                <label class="field grow">
                  <span class="lbl" i18n="@@qedit.num_unit_ar">الوحدة (عربي)</span>
                  <input nz-input formControlName="unitAr" dir="rtl" placeholder="جنيه" />
                </label>
              </div>
              @if (numericRangeInverted()) {
                <p class="hint error" i18n="@@qedit.num_inverted">
                  The maximum must be greater than or equal to the minimum.
                </p>
              }
              <p class="hint" i18n="@@qedit.num_hint">
                Bounds are inclusive, and the step counts up from the minimum. Leave a field empty
                for no limit.
              </p>
            </div>
          } @else if (selectedType() === 'TEXT') {
            <div formGroupName="text" class="rule-box">
              <p class="sub-lbl" i18n="@@qedit.sec_rules">Accepted values</p>
              <label class="field">
                <span class="lbl" i18n="@@qedit.text_max">Maximum length</span>
                <nz-input-number formControlName="maxLength" [nzMin]="1" [nzMax]="2000" />
              </label>
              <p class="hint" i18n="@@qedit.text_hint">
                Free text is never written to logs, because applicants may type personal details
                into it.
              </p>
            </div>
          } @else {
            @if (editingQuestion(); as eq) {
              <!-- Options are edited here, in place: a choice question's answers are the
                   substance of it, so they belong beside the wording. -->
              <div class="opt-block">
                <p class="sub-lbl">
                  <span i18n="@@qedit.sec_answers">Answer options</span>
                  <span class="count-pill">{{ eq.options.length }}</span>
                </p>
                @if (eq.options.length < 2) {
                  <p class="hint warn" i18n="@@qedit.needs_options">
                    Needs at least 2 options before this can be published.
                  </p>
                }
                <ul class="opt-list">
                  @for (o of eq.options; track o.id) {
                    <li class="opt-row" [class.editing]="editingOptionId() === o.id">
                      @if (editingOptionId() === o.id) {
                        <ng-container
                          [ngTemplateOutlet]="optionEditor"
                          [ngTemplateOutletContext]="{ eq: eq, adding: false }"
                        ></ng-container>
                      } @else {
                        <span class="opt-main">
                          <span class="opt-label" [dir]="isAr ? 'rtl' : 'ltr'">{{
                            isAr ? o.labelAr : o.labelEn
                          }}</span>
                          <!-- What picking it does to every offer (v31.2.0), said under the
                               label so the list reads which answers move money at a glance. -->
                          @if (optionEffectText(o); as effect) {
                            <span class="opt-effect">
                              <span
                                nz-icon
                                nzType="thunderbolt"
                                nzTheme="outline"
                                aria-hidden="true"
                              ></span>
                              {{ effect }}
                            </span>
                          }
                        </span>
                        <button
                          type="button"
                          class="icon-btn"
                          (click)="openOptionEdit(o)"
                          aria-label="Edit option"
                          i18n-aria-label="@@qedit.edit_option_aria"
                        >
                          <span nz-icon nzType="edit" nzTheme="outline"></span>
                        </button>
                        @if (!editLock()) {
                          <button
                            type="button"
                            class="icon-btn danger"
                            (click)="confirmDeleteOption(o)"
                            aria-label="Delete option"
                            i18n-aria-label="@@qedit.delete_option_aria"
                          >
                            <span nz-icon nzType="delete" nzTheme="outline"></span>
                          </button>
                        }
                      }
                    </li>
                  }
                  @if (canAddOption()) {
                    <li class="opt-row add" [class.editing]="addingOption()">
                      @if (addingOption()) {
                        <ng-container
                          [ngTemplateOutlet]="optionEditor"
                          [ngTemplateOutletContext]="{ eq: eq, adding: true }"
                        ></ng-container>
                      } @else {
                        <button type="button" class="add-opt" (click)="startAddOption()">
                          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                          <span i18n="@@qedit.add_option">option</span>
                        </button>
                      }
                    </li>
                  }
                </ul>
              </div>
            } @else {
              <p class="hint" i18n="@@qedit.choice_hint_new">
                Save the question first, then add its options here — at least two are needed before
                it can be asked.
              </p>
            }
          }
          <!-- A non-choice answer has no option list, so nothing else on this form says what it
               is FOR: it is read by the money bindings and by a program's income rule. -->
          @if (!isChoice(selectedType())) {
            <p class="hint" i18n="@@qedit.scoring_by_type">
              A number or free text has no options to configure. Banks read this answer through
              their money bindings and income rules.
            </p>
          }
        </app-drawer-section>

        <!-- Who must answer it, and where it is asked. Both are the admin's, both ways
             (v31.1.0): a question is made required or optional, fixed or ordinary, at will.
             nz-switch carries nzId so its label's for= names it — a switch wrapped in a label
             is unlabelled to a screen reader. -->
        <app-drawer-section [label]="secSettings">
          <div class="settings">
            <div class="setting">
              <div class="setting-row">
                <div class="setting-text">
                  <label class="setting-title" for="qedit-required" i18n="@@qedit.required"
                    >Required</label
                  >
                  @if (requiredOn()) {
                    <p class="setting-desc" i18n="@@qedit.required_on">
                      Applicants must answer it before they can go on.
                    </p>
                  } @else {
                    <p class="setting-desc" i18n="@@qedit.required_off">Applicants may skip it.</p>
                  }
                </div>
                <nz-switch nzId="qedit-required" formControlName="isRequired" />
              </div>
              <!-- Allowed, but never silent: the quote reads this answer. -->
              @if (editLock() && !requiredOn()) {
                <p class="hint warn" i18n="@@qedit.optional_engine_warn">
                  Offers are worked out from this answer. An applicant who skips it is quoted
                  without it.
                </p>
              }
            </div>

            <div class="setting">
              <div class="setting-row">
                <div class="setting-text">
                  <label class="setting-title" for="qedit-fixed" i18n="@@qedit.fixed_label"
                    >Fixed question</label
                  >
                  <p class="setting-desc" i18n="@@qedit.fixed_hint">
                    Every program in its loan types asks it, and no program can skip it.
                  </p>
                </div>
                <nz-switch
                  nzId="qedit-fixed"
                  formControlName="fixed"
                  (ngModelChange)="onFixedChange($event)"
                />
              </div>
              @if (fixedTicked()) {
                <fieldset class="served">
                  <legend class="served-legend" i18n="@@qedit.served_legend">Asked on</legend>
                  <div class="served-options">
                    @for (s of servedOptions; track s) {
                      <label class="radio" [class.on]="servedOnValue() === s">
                        <input
                          type="radio"
                          name="servedOn"
                          formControlName="servedOn"
                          [value]="s"
                          (change)="syncServedOn()"
                        />
                        <span>{{ servedOnLabel(s) }}</span>
                      </label>
                    }
                  </div>
                  <p class="hint">{{ servedOnHint(servedOnValue()) }}</p>
                </fieldset>
              } @else if (unfixBlockedBy() !== null) {
                <!-- The server would refuse it (QUESTION_FIXED_GATE_NOT_FIXED): a fixed question
                     may only follow a fixed one. Said here, and Save waits. -->
                <p class="hint warn">{{ unfixBlockedText() }}</p>
              } @else if (editingFixed()) {
                <p class="hint warn" i18n="@@qedit.unfix_note">
                  Saving makes it an ordinary question, so a program can skip it.
                </p>
              }
            </div>
          </div>
        </app-drawer-section>

        <!-- Branch rule — its own section because "when is this asked" is a different question
             from "what does it accept", and because the source list depends on this question's
             POSITION, not on its type. -->
        <app-drawer-section [label]="secBranch">
          <div formGroupName="enabledWhen" class="branch">
            <!-- A locked question shows its (disabled) rule and why it is locked, even when
                 nothing earlier could be branched on: "nothing to branch on yet" would promise
                 an edit the server refuses. So does a rule already set, so it can still be read
                 and cleared. -->
            @if (branchSources().length === 0 && !editLock() && !branchOn()) {
              @if (fixedTicked()) {
                <p class="hint" i18n="@@qedit.branch_none_fixed">
                  Nothing to branch on yet — a fixed question can only follow an earlier fixed
                  question that offers options.
                </p>
              } @else {
                <p class="hint" i18n="@@qedit.branch_none">
                  Nothing to branch on yet — a rule reads an answer from an earlier question that
                  offers options.
                </p>
              }
            } @else {
              <!-- ONE sentence, read start to end. A span + aria-labelledby rather than a
                   label/for pair: nz-select renders a div, not an input, so a wrapping label
                   associates with nothing. -->
              <div class="rule-line">
                <span class="rule-lead" id="branch-src-lbl" i18n="@@qedit.branch_source">
                  Ask this only when the answer to
                </span>
                <nz-select
                  formControlName="questionCode"
                  class="select-comfy rule-grow"
                  nzDropdownClassName="select-comfy-dropdown"
                  [nzOptionHeightPx]="42"
                  nzShowSearch
                  [nzPlaceHolder]="branchPickSourceLabel"
                  [attr.aria-labelledby]="'branch-src-lbl'"
                  (ngModelChange)="onBranchSourceChange()"
                >
                  @for (q of branchSources(); track q.id) {
                    <nz-option
                      [nzValue]="q.code"
                      [nzLabel]="isAr ? q.questionAr : q.questionEn"
                    ></nz-option>
                  }
                </nz-select>
              </div>
              @if (branchOn()) {
                <div class="rule-line">
                  <!-- role=radiogroup is the honest semantics for one-of-three, and it reuses
                       the answer-type picker's segmented vocabulary. -->
                  <span class="sr-only" id="branch-op-lbl" i18n="@@qedit.branch_compare">
                    How the answer is compared
                  </span>
                  <div class="op-group" role="radiogroup" aria-labelledby="branch-op-lbl">
                    @for (op of branchOperators; track op) {
                      <button
                        type="button"
                        role="radio"
                        class="op-btn"
                        [class.on]="branchOperator() === op"
                        [attr.aria-checked]="branchOperator() === op"
                        [disabled]="editLock() !== null"
                        (click)="pickBranchOperator(op)"
                      >
                        {{ branchOperatorLabel(op) }}
                      </button>
                    }
                  </div>
                  <!-- "is one of" names several answers, so its picker takes several: one
                       select per comparison rather than one select whose mode flips. -->
                  @if (branchOperator() === 'in') {
                    <span class="sr-only" id="branch-opts-lbl" i18n="@@qedit.branch_options">
                      The answers that turn this question on
                    </span>
                    <nz-select
                      nzMode="multiple"
                      formControlName="optionCodes"
                      class="select-comfy rule-grow"
                      nzDropdownClassName="select-comfy-dropdown"
                      [nzOptionHeightPx]="42"
                      [nzMaxMultipleCount]="50"
                      [nzPlaceHolder]="branchPickOptionsLabel"
                      [attr.aria-labelledby]="'branch-opts-lbl'"
                    >
                      @for (o of branchOptions(); track o.id) {
                        <nz-option
                          [nzValue]="o.code"
                          [nzLabel]="isAr ? o.labelAr : o.labelEn"
                        ></nz-option>
                      }
                    </nz-select>
                  } @else {
                    <span class="sr-only" id="branch-opt-lbl" i18n="@@qedit.branch_option">
                      The answer that turns this question on
                    </span>
                    <nz-select
                      formControlName="optionCode"
                      class="select-comfy rule-grow"
                      nzDropdownClassName="select-comfy-dropdown"
                      [nzOptionHeightPx]="42"
                      nzShowSearch
                      [nzPlaceHolder]="branchPickOptionLabel"
                      [attr.aria-labelledby]="'branch-opt-lbl'"
                    >
                      @for (o of branchOptions(); track o.id) {
                        <nz-option
                          [nzValue]="o.code"
                          [nzLabel]="isAr ? o.labelAr : o.labelEn"
                        ></nz-option>
                      }
                    </nz-select>
                  }
                </div>
              }
              @if (editLock()) {
                <p class="hint" i18n="@@qedit.branch_locked">
                  Locked because offers are worked out from this answer: changing when it is asked
                  would change who answers it.
                </p>
              } @else if (branchNotFixed()) {
                <!-- Fixed over a rule on an ordinary question: the server would refuse it
                     (QUESTION_FIXED_GATE_NOT_FIXED), so it is said here, before Save. -->
                <p class="hint warn" i18n="@@qedit.branch_not_fixed">
                  That question is not fixed, and a fixed question can only follow another fixed
                  question. Pick a fixed one, or always ask this one.
                </p>
              } @else if (branchIncomplete()) {
                @if (branchOperator() === 'in') {
                  <p class="hint warn" i18n="@@qedit.branch_incomplete_in">
                    Pick at least two answers. For a single answer, use “is” instead.
                  </p>
                } @else {
                  <p class="hint warn" i18n="@@qedit.branch_incomplete">
                    Pick which answer turns this question on — a half-set rule hides nothing.
                  </p>
                }
              } @else if (branchSourceIsMulti()) {
                <p class="hint" i18n="@@qedit.branch_hint_multi">
                  That question accepts several picks — any one of them matching is enough.
                </p>
              } @else if (!branchOn()) {
                <p class="hint" i18n="@@qedit.branch_hint_off">
                  Asked of every applicant in this question's loan types.
                </p>
              }
              @if (fixedTicked() && !editLock() && !branchNotFixed()) {
                <p class="hint" i18n="@@qedit.branch_fixed_only">
                  Only fixed questions are listed: a fixed question can only follow another fixed
                  question.
                </p>
              }
              <!-- Undoes the whole rule, so it closes the section rather than sitting beside
                   the row it would clear. No icon: the label states the outcome. -->
              @if (branchOn() && !editLock()) {
                <button
                  type="button"
                  class="clear-branch"
                  (click)="clearBranch()"
                  i18n="@@qedit.branch_clear"
                >
                  Always ask instead
                </button>
              }
            }
          </div>
        </app-drawer-section>

        @if (!editing()) {
          <p class="ins-note" i18n="@@qedit.code_note">
            A stable code is generated automatically — no need to type one.
          </p>
        }
      </form>
    </ng-template>

    <!-- One option editor for both add and edit — they differed only in the primary
         button's word, which is not worth two copies of the form.

         It reads as a framed insert rather than four naked controls crammed onto the
         row: each field carries its own label (the placeholders vanished the moment
         there was text, leaving two identical grey boxes distinguishable only by
         script direction), and the buttons get their own line so nothing is squeezed. -->
    <ng-template #optionEditor let-eq="eq" let-adding="adding">
      <!-- Escape is caught on the panel, not per-input, so it also works when focus
           is on Save or Cancel. tabindex="-1" makes that a focusable scope without
           adding a stop to the tab order. -->
      <div class="opt-edit" tabindex="-1" (keydown.escape)="escapeOption($event)">
        <div class="oe-fields">
          <label class="field">
            <span class="lbl" i18n="@@qedit.lang_en">English</span>
            <input nz-input [formControl]="optionEn" (keydown.enter)="submitOption(eq)" />
          </label>
          <label class="field">
            <span class="lbl" i18n="@@qedit.lang_ar">العربية</span>
            <input nz-input [formControl]="optionAr" dir="rtl" (keydown.enter)="submitOption(eq)" />
          </label>
        </div>
        <!-- The answer's offer effect (v31.2.0): what picking it does to every program's
             offer. A plain checkbox, not nz-switch, so the label is the control's own. -->
        <div class="oe-effect">
          <label class="oe-effect-head">
            <input type="checkbox" class="oe-check" [formControl]="optionEffect.controls.on" />
            <span class="oe-effect-title" i18n="@@qedit.effect_toggle">Changes the offer</span>
          </label>
          <p class="hint" i18n="@@qedit.effect_toggle_hint">
            When an applicant picks this answer, every program's offer changes like this. Leave a
            box empty for no change.
          </p>
          @if (optionEffect.controls.on.value) {
            <div class="oe-levers">
              <label class="field">
                <span class="lbl" i18n="@@qedit.effect_loan">Max loan</span>
                <nz-input-group nzSuffix="%">
                  <input
                    nz-input
                    inputmode="decimal"
                    placeholder="-10"
                    [formControl]="optionEffect.controls.loan"
                    (keydown.enter)="submitOption(eq)"
                  />
                </nz-input-group>
                <span class="hint" i18n="@@qedit.effect_loan_range">
                  -90 to 100. -10 means 10% lower.
                </span>
              </label>
              <label class="field">
                <span class="lbl" i18n="@@qedit.effect_rate">Interest rate</span>
                <nz-input-group [nzSuffix]="unitPoints">
                  <input
                    nz-input
                    inputmode="decimal"
                    placeholder="1.5"
                    [formControl]="optionEffect.controls.rate"
                    (keydown.enter)="submitOption(eq)"
                  />
                </nz-input-group>
                <span class="hint" i18n="@@qedit.effect_rate_range">
                  -20 to 20. 1.5 means 1.5 points higher.
                </span>
              </label>
              <label class="field">
                <span class="lbl" i18n="@@qedit.effect_term">Longest term</span>
                <nz-input-group [nzSuffix]="unitMonths">
                  <input
                    nz-input
                    inputmode="numeric"
                    placeholder="60"
                    [formControl]="optionEffect.controls.term"
                    (keydown.enter)="submitOption(eq)"
                  />
                </nz-input-group>
                <span class="hint" i18n="@@qedit.effect_term_range">1 to 480 months.</span>
              </label>
            </div>
            @if (effectInvalid()) {
              <p class="hint error" i18n="@@qedit.effect_invalid">
                Check the figures: each box takes a number in its range, and not 0.
              </p>
            } @else if (effectBetter()) {
              <p class="hint warn" i18n="@@qedit.effect_better">
                This makes the offer better than the bank's own figures. The bank may not agree to
                it.
              </p>
            } @else if (!effectTypedAny()) {
              <p class="hint" i18n="@@qedit.effect_empty">
                Type at least one figure, or untick this.
              </p>
            }
          }
        </div>
        <div class="oe-actions">
          <button
            nz-button
            nzType="text"
            nzSize="small"
            type="button"
            (click)="cancelOption()"
            i18n="@@qedit.cancel"
          >
            Cancel
          </button>
          <button
            nz-button
            nzType="primary"
            nzSize="small"
            type="button"
            [disabled]="optionEn.invalid || optionAr.invalid || effectInvalid()"
            (click)="submitOption(eq)"
          >
            @if (adding) {
              <span i18n="@@qedit.add_o">Add</span>
            } @else {
              <span i18n="@@qedit.save_o">Save</span>
            }
          </button>
        </div>
      </div>
    </ng-template>

    <!-- What the list leaves out, said once under the toolbar: the questions surrogate
         products ask live in the Program catalog, and a list that silently dropped them would
         read as a pool that lost them. The link is a super admin's, like the catalog. -->
    <ng-template #hiddenNote>
      @if (hiddenCount() > 0) {
        <p class="hidden-note">
          <span i18n="@@qedit.hidden_note">{hiddenCount(), plural,
            =1 {
              1 question that surrogate programs ask is not listed here. Edit it from its product in
              the Program catalog.
            }
            other {
              {{ hiddenCount() }} questions that surrogate programs ask are not listed here. Edit
              them from their products in the Program catalog.
            }
          }</span>
          <a
            *can="['super_admin']"
            [routerLink]="['/program-catalog']"
            [queryParams]="{ basis: 'no_payslip' }"
            i18n="@@qedit.hidden_link"
            >Open the Program catalog</a
          >
        </p>
      }
    </ng-template>
  `,
  styles: [
    `
      /* The sheet is rendered in the drawer overlay, outside this host, so it re-declares the
         same variables — without them every border and track in the form paints nothing. */
      :host,
      .qe-sheet {
        /* Global pool → single brand azure accent (no per-category tint). */
        --cat: var(--primary, var(--ant-primary-color, #0869c3));
        --qe-line: var(--color-border-subtle, #efeae5);
        --qe-line-strong: var(--color-border-default, #ddd8d3);
        --qe-muted: var(--color-text-tertiary, #8c7e75);
        --qe-text: var(--color-text-primary, #2b2320);
        --qe-text-2: var(--color-text-secondary, #6b5d54);
        --qe-surface: var(--color-surface-default, #fdfcfb);
        --qe-surface-muted: var(--color-surface-muted, #efeae5);
        --qe-radius: var(--radius-lg, 12px);
        --qe-ease: var(--motion-easing-standard, cubic-bezier(0.4, 0, 0.2, 1));
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

      /* ---- Command bar ------------------------------------------------- */
      .bar {
        display: flex;
        align-items: center;
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
      }
      .title-row {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        flex-wrap: wrap;
      }
      .eyebrow {
        margin: 0;
        font-size: var(--text-xs, 12px);
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-tonal-accent, var(--qe-muted));
      }
      .title-row h1 {
        margin: 0;
        font-family: var(--heading-font, var(--font-sans));
        font-size: var(--text-2xl, 24px);
        font-weight: 700;
        letter-spacing: -0.015em;
        line-height: var(--leading-tight, 1.2);
        color: var(--qe-text);
      }
      .live-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--text-xs, 12px);
        font-weight: 600;
        color: var(--color-success, #2d5f3f);
        background: color-mix(in srgb, var(--color-success, #2d5f3f) 12%, transparent);
        padding: 2px 10px;
        border-radius: var(--radius-pill, 999px);
      }
      .live-dot {
        inline-size: 8px;
        block-size: 8px;
        border-radius: var(--radius-pill, 999px);
        background: var(--color-success, #2d5f3f);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success, #2d5f3f) 18%, transparent);
      }
      .bar-actions {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        flex-wrap: wrap;
      }
      .autosave {
        font-size: var(--text-xs, 12px);
        color: var(--qe-muted);
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
      }
      .health.ok {
        color: var(--color-success, #2d5f3f);
        background: color-mix(in srgb, var(--color-success, #2d5f3f) 10%, transparent);
      }
      .health.warn {
        color: var(--color-warning, #c8893d);
        background: color-mix(in srgb, var(--color-warning, #c8893d) 14%, transparent);
        cursor: pointer;
      }
      .health.warn:hover,
      .health.warn.on {
        border-color: var(--color-warning, #c8893d);
      }
      .health.warn:focus-visible {
        outline: 2px solid var(--color-warning, #c8893d);
        outline-offset: 2px;
      }
      .health-panel {
        margin-block-end: var(--space-4, 16px);
        padding: var(--space-4, 16px);
        background: color-mix(in srgb, var(--color-warning, #c8893d) 8%, var(--qe-surface));
        border: 1px solid color-mix(in srgb, var(--color-warning, #c8893d) 32%, transparent);
        border-radius: var(--qe-radius);
        animation: qe-expand var(--motion-duration-base, 180ms) var(--qe-ease);
      }
      @keyframes qe-expand {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .hp-title {
        margin: 0 0 var(--space-2, 8px);
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        color: var(--qe-text);
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
        color: var(--qe-text-2);
      }
      .hp-list code {
        margin-inline-end: var(--space-2, 8px);
        font-variant-numeric: tabular-nums;
      }
      .hp-jump {
        padding: 0;
        border: 0;
        background: none;
        color: var(--cat);
        font: inherit;
        text-align: start;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }

      /* ---- Toolbar ------------------------------------------------------ */
      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        flex-wrap: wrap;
        padding: var(--space-3, 12px) var(--space-4, 16px);
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-radius: var(--qe-radius) var(--qe-radius) 0 0;
        border-block-end: 0;
      }
      .search {
        flex: 1 1 320px;
        min-inline-size: 240px;
      }
      .filters {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 32px;
        padding-inline: var(--space-3, 12px);
        border: 1px solid var(--qe-line);
        border-radius: var(--radius-pill, 999px);
        background: var(--qe-surface);
        color: var(--qe-text-2);
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast, 120ms) ease,
          color var(--motion-duration-fast, 120ms) ease,
          background var(--motion-duration-fast, 120ms) ease;
      }
      .chip:hover:not(:disabled) {
        color: var(--qe-text);
        border-color: var(--qe-line-strong);
      }
      .chip:disabled {
        cursor: default;
        opacity: 0.45;
      }
      .chip:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: 2px;
      }
      .chip.on {
        color: var(--cat);
        border-color: var(--cat);
        background: color-mix(in srgb, var(--cat) 8%, transparent);
      }
      .chip.warn {
        color: var(--color-warning, #c8893d);
        border-color: color-mix(in srgb, var(--color-warning, #c8893d) 40%, transparent);
      }
      .chip.warn.on {
        background: color-mix(in srgb, var(--color-warning, #c8893d) 14%, transparent);
        border-color: var(--color-warning, #c8893d);
      }
      .chip-n {
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        opacity: 0.75;
      }
      .showing {
        margin: 0;
        margin-inline-start: auto;
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        font-size: var(--text-sm, 14px);
        color: var(--qe-muted);
        font-variant-numeric: tabular-nums;
      }
      .link {
        padding: 0;
        border: 0;
        background: none;
        color: var(--cat);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .link:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: 2px;
      }
      .drag-note {
        margin: 0;
        padding: var(--space-2, 8px) var(--space-4, 16px);
        background: var(--qe-surface-muted);
        border-inline: 1px solid var(--qe-line);
        font-size: var(--text-xs, 12px);
        color: var(--qe-muted);
      }

      /* ---- Flat list ---------------------------------------------------- */
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-radius: 0 0 var(--qe-radius) var(--qe-radius);
        overflow: hidden;
      }
      /* The pager takes over the bottom edge when it is there, so the list stops
         rounding into it and the two read as one panel. */
      .list.has-pager {
        border-radius: 0;
      }
      .pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-3, 12px);
        padding: var(--space-2, 8px) var(--space-4, 16px);
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-block-start: 0;
        border-radius: 0 0 var(--qe-radius) var(--qe-radius);
      }
      .pager-range {
        margin: 0;
        font-size: var(--text-sm, 14px);
        color: var(--qe-muted);
        font-variant-numeric: tabular-nums;
      }
      .row {
        border-block-start: 1px solid var(--qe-line);
      }
      .row:first-child {
        border-block-start: 0;
      }
      /* Title line: the question takes all the width it wants, the meta is pinned
         right. The old 1.5fr / 1fr split left a dead gap mid-row on short
         questions while starving the answers column beside it. */
      .row-head {
        display: grid;
        grid-template-columns: auto 24px minmax(0, 1fr) auto auto;
        align-items: center;
        gap: var(--space-2, 8px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        transition: background var(--motion-duration-fast, 120ms) ease;
      }
      .row-head:hover {
        background: color-mix(in srgb, var(--cat) 4%, transparent);
      }
      .row.open > .row-head {
        background: color-mix(in srgb, var(--cat) 7%, transparent);
      }
      /* An unpublishable question is marked on its edge, not by tinting the row:
         a tinted row reads as selected, which it is not. */
      .row.flagged > .row-head {
        box-shadow: inset 3px 0 0 0 var(--color-warning, #c8893d);
      }
      :host-context([dir='rtl']) .row.flagged > .row-head {
        box-shadow: inset -3px 0 0 0 var(--color-warning, #c8893d);
      }
      .handle {
        display: grid;
        place-items: center;
        inline-size: 28px;
        block-size: 44px;
        border: 0;
        background: none;
        color: var(--qe-line-strong);
        cursor: grab;
        transition: color var(--motion-duration-fast, 120ms) ease;
      }
      .handle:hover:not(:disabled) {
        color: var(--qe-text-2);
      }
      .handle:disabled {
        cursor: default;
        opacity: 0.4;
      }
      .handle:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: -2px;
      }
      /* 41 filled azure badges would shout over the questions they number, but a
         bare muted digit vanished into the hairline. A ringed neutral badge gives
         the number a countable shape on every row; the accent still arrives only
         on the row you are pointing at. */
      .ord {
        display: grid;
        place-items: center;
        inline-size: 24px;
        block-size: 24px;
        border-radius: var(--radius-pill, 999px);
        border: 1px solid var(--qe-line-strong);
        background: color-mix(in srgb, var(--qe-text) 4%, var(--qe-surface));
        font-size: var(--text-xs, 12px);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--qe-text-2);
        transition:
          color var(--motion-duration-fast, 120ms) ease,
          border-color var(--motion-duration-fast, 120ms) ease,
          background var(--motion-duration-fast, 120ms) ease;
      }
      .row-head:hover .ord,
      .row.open .ord {
        color: var(--cat);
        border-color: color-mix(in srgb, var(--cat) 35%, transparent);
        background: color-mix(in srgb, var(--cat) 12%, transparent);
      }
      /* Symmetric padding instead of min-block-size: baseline alignment puts a
         single-line flex item at the TOP of a taller box, which is what left the
         number sitting below the title it numbers. Padding keeps the 44px target
         and centres the line inside it. */
      .row-main {
        display: flex;
        align-items: baseline;
        gap: var(--space-2, 8px);
        min-inline-size: 0;
        padding: 10px 0;
        border: 0;
        background: none;
        color: var(--qe-text);
        font: inherit;
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        text-align: start;
        cursor: pointer;
      }
      .row-main:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: 2px;
        border-radius: var(--radius-sm, 6px);
      }
      .q-text {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rule-line {
        flex-shrink: 0;
        font-size: var(--text-xs, 12px);
        color: var(--qe-text-2);
        font-variant-numeric: tabular-nums;
      }

      /* Second line, indented to the question's text edge. Full width, wrapping,
         and NO per-chip clamp: a label that has to be read is a label that has to
         be shown. */
      .row-answers {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding-inline: calc(28px + 24px + var(--space-2, 8px) * 2 + var(--space-3, 12px))
          var(--space-3, 12px);
        padding-block: 0 var(--space-3, 12px);
      }
      /* An outline the colour of the row's own hairline on a fill the colour of the
         row read as ghost text, so the answers looked like disabled chrome rather
         than the content they are. Filled + primary text: they are the answers an
         applicant picks from, not decoration. */
      .pill {
        max-inline-size: 44ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 3px 12px;
        border: 1px solid var(--qe-line-strong);
        border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, var(--qe-text) 5%, var(--qe-surface));
        color: var(--qe-text);
        font-size: var(--text-sm, 14px);
        font-weight: 500;
      }
      .pill.more {
        border-style: dashed;
        color: var(--qe-muted);
        font-variant-numeric: tabular-nums;
      }
      .pill.warn {
        color: var(--color-warning, #c8893d);
        border-color: color-mix(in srgb, var(--color-warning, #c8893d) 40%, transparent);
        background: color-mix(in srgb, var(--color-warning, #c8893d) 10%, transparent);
        font-weight: 600;
      }
      .row-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      /* Outlined, not filled: the type repeats on every one of 41 rows, so it has
         to be legible without competing with the question it labels. */
      .type-chip {
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--cat);
        border: 1px solid color-mix(in srgb, var(--cat) 30%, transparent);
        background: color-mix(in srgb, var(--cat) 6%, transparent);
        padding: 1px 8px;
        border-radius: var(--radius-pill, 999px);
      }
      /* Value types read as neutral: they are a lookup list, not a question the
         applicant answers, so they should not wear the brand accent. */
      .type-chip.value-type {
        color: var(--qe-muted);
        border-color: var(--qe-line);
        background: transparent;
      }
      .req {
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 600;
        color: var(--qe-muted);
        border: 1px dashed var(--qe-line-strong);
        padding: 1px 8px;
        border-radius: var(--radius-pill, 999px);
      }
      .kebab {
        flex-shrink: 0;
        color: var(--qe-muted);
        transition: color var(--motion-duration-fast, 120ms) ease;
      }
      .kebab:hover,
      .kebab:focus-visible {
        color: var(--cat);
      }
      .kebab span[nz-icon] {
        transform: rotate(90deg);
      }
      /* Drag affordances. */
      .cdk-drag-preview {
        border-radius: var(--radius-md, 8px);
        background: var(--qe-surface);
        box-shadow: var(--shadow-xl, 0 12px 32px rgba(16, 24, 40, 0.18));
      }
      .cdk-drag-placeholder .row-head,
      .cdk-drag-placeholder .row-answers {
        display: none;
      }
      .drag-ghost {
        block-size: 48px;
        background: color-mix(in srgb, var(--cat) 8%, transparent);
        border: 1px dashed var(--cat);
        border-radius: var(--radius-md, 8px);
      }
      .cdk-drop-list-dragging .row-head {
        transition: transform var(--motion-duration-base, 180ms) var(--qe-ease);
      }

      /* ---- Editor sheet --------------------------------------------------
         The shell (app-form-drawer) owns the header, the scroll and the footer; this is the
         form inside it — one column of sections, a section's breathing room apart, so each
         decision reads as its own block without a box drawn round it. */
      .sheet-moves {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1, 4px);
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-6, 32px);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
        min-inline-size: 0;
      }
      .field.grow {
        flex: 1 1 0;
      }
      .field-row {
        display: flex;
        gap: var(--space-3, 12px);
        align-items: flex-end;
      }
      .lbl {
        font-size: var(--text-xs, 12px);
        font-weight: var(--font-semibold, 600);
        color: var(--qe-text-2);
      }
      /* A heading INSIDE a section (the answers, the accepted values): sentence case at body
         weight, so it never competes with the small-caps section legend above it. */
      .sub-lbl {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        margin: 0;
        font-size: var(--text-sm, 14px);
        font-weight: var(--font-semibold, 600);
        color: var(--qe-text);
      }
      .count-pill {
        min-inline-size: 24px;
        text-align: center;
        font-size: var(--text-xs, 12px);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--color-tonal-accent-ink, var(--cat));
        background: var(--color-tonal-accent-bg, color-mix(in srgb, var(--cat) 12%, transparent));
        padding: 1px var(--space-2, 8px);
        border-radius: var(--radius-pill, 999px);
      }
      .opt-block {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
      }
      /* ---- Settings: Required and Fixed ----------------------------------
         One bordered list, a hairline between its two rows: the only box in the form, because
         these two switches are the only controls that change who is asked rather than what. */
      .settings {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--qe-line-strong);
        border-radius: var(--radius-md, 8px);
      }
      .setting {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
        padding: var(--space-4, 16px);
      }
      .setting + .setting {
        border-block-start: 1px solid var(--qe-line);
      }
      .setting-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4, 16px);
      }
      .setting-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-0-5, 2px);
        min-inline-size: 0;
      }
      .setting-title {
        font-size: var(--text-sm, 14px);
        font-weight: var(--font-semibold, 600);
        color: var(--qe-text);
        cursor: pointer;
      }
      .setting-desc {
        margin: 0;
        font-size: var(--text-xs, 12px);
        line-height: var(--leading-normal, 1.5);
        color: var(--qe-text-2);
      }
      /* Sits on the title's line, and never loses its knob to a long description. */
      .setting-row nz-switch {
        flex-shrink: 0;
        margin-block-start: var(--space-0-5, 2px);
      }
      /* ---- Engine lock ---------------------------------------------------
         Neutral, not warning-tinted: a locked question is not a problem to fix,
         it is a fact about the question. Same vocabulary as the program-name
         board's lock tag (surface fill, hairline, quiet ink). */
      .lock-chip {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        padding: 1px var(--space-2, 8px);
        border: 1px solid var(--qe-line-strong);
        border-radius: var(--radius-pill, 999px);
        background: var(--qe-surface);
        color: var(--qe-text-2);
        font-size: var(--text-xs, 12px);
        line-height: 1.4;
      }
      .lock-note {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3, 12px);
        padding: var(--space-3, 12px) var(--space-4, 16px);
        border: 1px solid var(--qe-line-strong);
        border-radius: var(--radius-md, 8px);
        background: color-mix(in srgb, var(--qe-text) 4%, var(--qe-surface));
      }
      .lock-ico {
        flex: 0 0 auto;
        /* Optical: sits the glyph on the title's first line, at any font size. */
        margin-block-start: 0.15em;
        font-size: var(--text-base, 16px);
        color: var(--qe-text);
      }
      .lock-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
        min-inline-size: 0;
      }
      .lock-title {
        margin: 0;
        font-size: var(--text-sm, 14px);
        font-weight: var(--font-semibold, 600);
        color: var(--qe-text);
      }
      .lock-body,
      .lock-who {
        margin: 0;
        font-size: var(--text-xs, 12px);
        line-height: var(--leading-normal, 1.5);
        color: var(--qe-text-2);
      }
      .lock-who {
        color: var(--qe-text);
      }
      /* ---- Fixed (v31.0.0) -----------------------------------------------
         A fact about where a question is asked, worded rather than drawn as a
         second padlock: accent INK on its own faint tint (the tonal pair keeps
         the ink above AA in both themes; the raw accent on its tint does not). */
      .fixed-chip {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        padding: 1px var(--space-2, 8px);
        border-radius: var(--radius-pill, 999px);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
        font-size: var(--text-xs, 12px);
        font-weight: var(--font-semibold, 600);
        line-height: 1.4;
      }
      .served {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
        margin: 0;
        padding: 0;
        border: 0;
        min-inline-size: 0;
      }
      .served-legend {
        padding: 0;
        margin-block-end: var(--space-1, 4px);
        font-size: var(--text-xs, 12px);
        font-weight: var(--font-semibold, 600);
        color: var(--qe-text-2);
      }
      .served-options {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2, 8px);
      }
      /* Each answer is a 44px target, the whole bordered pill clickable. */
      .radio {
        display: flex;
        cursor: pointer;
        align-items: center;
        gap: var(--space-2, 8px);
        min-block-size: 44px;
        padding-inline: var(--space-3, 12px);
        border: 1px solid var(--qe-line-strong);
        border-radius: var(--radius-md, 8px);
        background: var(--qe-surface);
        color: var(--qe-text-2);
        font-size: var(--text-sm, 14px);
      }
      .radio input {
        flex: none;
        inline-size: var(--space-4, 16px);
        block-size: var(--space-4, 16px);
        margin: 0;
        accent-color: var(--cat);
        cursor: inherit;
      }
      .radio input:focus-visible {
        outline: var(--focus-ring-width, 2px) solid var(--focus-ring-color, var(--cat));
        outline-offset: 2px;
      }
      .radio.on {
        border-color: var(--cat);
        background: color-mix(in srgb, var(--cat) 6%, var(--qe-surface));
        color: var(--qe-text);
      }

      /* ---- What the list leaves out, and what was deleted ---------------- */
      .hidden-note {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-1, 4px) var(--space-2, 8px);
        margin: 0 0 var(--space-3, 12px);
        font-size: var(--text-xs, 12px);
        line-height: var(--leading-normal, 1.5);
        color: var(--qe-text-2);
      }
      .hidden-note a {
        color: var(--primary-visible, var(--cat));
        font-weight: var(--font-semibold, 600);
      }
      .hidden-note a:focus-visible {
        outline: var(--focus-ring-width, 2px) solid var(--focus-ring-color, var(--cat));
        outline-offset: 2px;
        border-radius: var(--radius-sm, 4px);
      }
      .deleted-panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
        margin-block-end: var(--space-3, 12px);
        padding: var(--space-3, 12px) var(--space-4, 16px);
        border: 1px solid var(--qe-line-strong);
        border-radius: var(--radius-md, 8px);
        background: var(--qe-surface);
      }
      .dp-title {
        margin: 0;
        font-size: var(--text-sm, 14px);
        font-weight: var(--font-semibold, 600);
        color: var(--qe-text);
      }
      .dp-hint {
        margin: 0;
        font-size: var(--text-xs, 12px);
        line-height: var(--leading-normal, 1.5);
        color: var(--qe-text-2);
      }
      .dp-list {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .dp-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3, 12px);
        padding-block: var(--space-2, 8px);
        border-block-start: 1px solid var(--qe-line);
      }
      .dp-row:first-child {
        border-block-start: 0;
      }
      .dp-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-0-5, 2px);
        min-inline-size: 0;
      }
      .dp-q {
        font-size: var(--text-sm, 14px);
        color: var(--qe-text);
        overflow-wrap: anywhere;
      }
      .dp-meta {
        font-size: var(--text-xs, 12px);
        color: var(--qe-text-2);
      }
      .dp-row button {
        flex: none;
      }
      @media (max-width: 480px) {
        .dp-row {
          flex-direction: column;
          align-items: flex-start;
        }
      }
      .ins-note {
        margin: 0;
        padding: var(--space-2, 8px) var(--space-3, 12px);
        font-size: 12px;
        color: var(--qe-text-2);
        background: color-mix(in srgb, var(--cat) 10%, transparent);
        border-radius: var(--radius-md, 8px);
      }
      nz-input-number {
        inline-size: 100%;
      }

      .type-group {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 3px;
        background: var(--qe-surface-muted);
        border-radius: var(--radius-md, 8px);
      }
      .type-btn {
        flex: 1 1 auto;
        /* 44px floor so the control is not a mobile-hostile tap target. */
        min-block-size: 44px;
        padding-inline: var(--space-3, 12px);
        border: 1px solid transparent;
        border-radius: var(--radius-sm, 6px);
        background: transparent;
        color: var(--qe-text-2);
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast, 120ms) ease,
          color var(--motion-duration-fast, 120ms) ease;
      }
      .type-btn:hover:not(:disabled) {
        color: var(--qe-text);
      }
      .type-btn:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: -2px;
      }
      .type-btn.on {
        background: var(--qe-surface);
        border-color: var(--cat);
        color: var(--cat);
      }
      .type-btn:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .rule-box {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
        padding: var(--space-3, 12px);
        background: var(--qe-surface-muted);
        border-radius: var(--radius-md, 8px);
      }
      .branch {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
      }
      @keyframes qe-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      .clear-branch {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        min-block-size: 32px;
        border: 0;
        padding-inline: var(--space-2, 8px);
        border-radius: var(--radius-pill, 999px);
        background: transparent;
        color: var(--qe-text-2);
        font: inherit;
        font-size: var(--text-xs, 12px);
        font-weight: 600;
        letter-spacing: 0;
        text-transform: none;
        white-space: nowrap;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast, 120ms) var(--motion-easing-standard, ease),
          color var(--motion-duration-fast, 120ms) var(--motion-easing-standard, ease);
      }
      .clear-branch:hover {
        background: var(--qe-surface-muted);
        color: var(--qe-text);
      }
      .clear-branch:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: 2px;
      }
      /* One row of the sentence. Wraps rather than shrinking the selects below
         their own text at narrow widths. */
      .rule-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3, 12px);
        animation: qe-fade var(--motion-duration-fast, 120ms) var(--qe-ease);
      }
      /* Prose, not a micro-label: it is read as the first words of the sentence the
         two controls finish, so it takes body size and reading-grade ink. */
      .rule-lead {
        font-size: var(--text-sm, 14px);
        color: var(--qe-text-2);
      }
      .rule-grow {
        flex: 1 1 16rem;
        min-inline-size: 0;
      }
      /* Segmented, sized to the 52px selects it sits between (46px segment + 2 x 3px
         track padding). Same vocabulary as the answer-type picker one column over. */
      .op-group {
        display: flex;
        flex: 0 0 auto;
        gap: 4px;
        padding: 3px;
        background: var(--qe-surface-muted);
        border-radius: var(--radius-md, 8px);
      }
      .op-btn {
        min-block-size: 46px;
        min-inline-size: 64px;
        padding-inline: var(--space-3, 12px);
        border: 1px solid transparent;
        border-radius: var(--radius-sm, 6px);
        background: transparent;
        color: var(--qe-text-2);
        font-size: 15px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast, 120ms) ease,
          color var(--motion-duration-fast, 120ms) ease;
      }
      .op-btn:hover:not(:disabled) {
        color: var(--qe-text);
      }
      /* The engine lock greys the rule out; the same treatment as a locked type. */
      .op-btn:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .op-btn:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: -2px;
      }
      .op-btn.on {
        background: var(--qe-surface);
        border-color: var(--cat);
        color: var(--cat);
      }
      /* A pressable row on a touch screen has no hover to reveal itself, so the
         44px floor applies where it is the only affordance. */
      @media (hover: none) {
        .clear-branch {
          min-block-size: 44px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .clear-branch,
        .op-btn {
          transition: none;
        }
        .rule-line {
          animation: none;
        }
      }
      /* Secondary, not tertiary. Every hint here is read prose, and tertiary ink
         measures 3.83:1 on this card and 3.28:1 on a muted panel in light mode —
         under AA on both. (DESIGN_SYSTEM.md, focus-and-contrast note.) */
      .hint {
        margin: 0;
        font-size: var(--text-xs, 12px);
        line-height: var(--leading-normal, 1.5);
        color: var(--qe-text-2);
      }
      /* Severity is carried by a DOT, not by the ink: --color-warning measures
         2.89:1 on this card and --color-error 3.81:1, and the warn hint is the one
         line that has to be read to unblock Save. */
      .hint.warn,
      .hint.error {
        display: flex;
        align-items: baseline;
        gap: var(--space-2, 8px);
        color: var(--qe-text);
      }
      .hint.warn::before,
      .hint.error::before {
        content: '';
        flex: 0 0 auto;
        inline-size: 6px;
        block-size: 6px;
        margin-block-start: 0.4em;
        border-radius: 50%;
      }
      .hint.warn::before {
        background: var(--color-warning-dot, var(--color-warning));
      }
      .hint.error::before {
        background: var(--color-error-dot, var(--color-error));
      }

      /* ---- Options, edited in place ------------------------------------- */
      .opt-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .opt-row {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        min-block-size: 40px;
        padding-inline: var(--space-2, 8px);
        border-block-end: 1px solid var(--qe-line);
        border-radius: var(--radius-sm, 6px);
        transition: background var(--motion-duration-fast, 120ms) ease;
      }
      .opt-row:last-child {
        border-block-end: 0;
      }
      .opt-row:hover:not(.editing) {
        background: color-mix(in srgb, var(--cat) 4%, transparent);
      }
      /* The editing row drops the list chrome entirely — the framed panel below is
         the affordance, and a hairline through the middle of it read as a break. */
      .opt-row.editing {
        padding: 0;
        border-block-end: 0;
        background: none;
      }
      .opt-label {
        flex: 1;
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-sm, 14px);
        color: var(--qe-text);
      }

      /* Framed insert: tinted, accented on the leading edge, so it reads as "this
         answer is open" instead of as a layout break. */
      .opt-edit {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
        margin-block: 6px;
        padding: var(--space-3, 12px);
        background: color-mix(in srgb, var(--cat) 5%, transparent);
        border: 1px solid color-mix(in srgb, var(--cat) 22%, transparent);
        border-inline-start: 3px solid var(--cat);
        border-radius: var(--radius-md, 8px);
        animation: qe-expand var(--motion-duration-base, 180ms) var(--qe-ease);
      }
      .oe-fields {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--space-3, 12px);
      }
      .oe-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2, 8px);
      }
      .opt-main {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding-block: var(--space-2, 8px);
      }
      .opt-main .opt-label {
        flex: none;
      }
      /* The answer's offer effect, under its label: quiet ink, a bolt to say "moves money". */
      .opt-effect {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1, 4px);
        font-size: var(--text-xs, 12px);
        color: var(--qe-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .opt-effect [nz-icon] {
        color: var(--cat);
      }
      .oe-effect {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
        padding-block-start: var(--space-3, 12px);
        border-block-start: 1px solid color-mix(in srgb, var(--cat) 18%, transparent);
      }
      .oe-effect-head {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2, 8px);
        cursor: pointer;
      }
      .oe-check {
        inline-size: 16px;
        block-size: 16px;
        margin: 0;
        accent-color: var(--cat);
        cursor: pointer;
      }
      .oe-check:focus-visible {
        outline: 2px solid var(--focus-ring-color);
        outline-offset: 2px;
      }
      .oe-effect-title {
        font-size: var(--text-sm, 14px);
        font-weight: var(--font-semibold, 600);
        color: var(--qe-text);
      }
      .oe-levers {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-3, 12px);
      }
      @media (max-width: 1100px) {
        .oe-fields {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      @media (max-width: 640px) {
        .oe-levers {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      /* Present but quiet, full strength on the row you are pointing at: 14 icon
         buttons at full contrast competed with the seven labels they act on. */
      .opt-row .icon-btn {
        opacity: 0.5;
      }
      .opt-row:hover .icon-btn,
      .opt-row:focus-within .icon-btn {
        opacity: 1;
      }
      .icon-btn {
        display: grid;
        place-items: center;
        inline-size: 32px;
        block-size: 32px;
        flex-shrink: 0;
        border: 0;
        border-radius: var(--radius-sm, 6px);
        background: none;
        color: var(--qe-muted);
        cursor: pointer;
        transition:
          color var(--motion-duration-fast, 120ms) ease,
          background var(--motion-duration-fast, 120ms) ease,
          opacity var(--motion-duration-fast, 120ms) ease;
      }
      .icon-btn:hover {
        color: var(--cat);
        background: var(--qe-surface-muted);
      }
      .icon-btn.danger:hover {
        color: var(--color-error, var(--ant-error-color));
      }
      .icon-btn:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: -2px;
      }
      .icon-btn:disabled {
        cursor: default;
        opacity: 0.35;
      }
      .icon-btn:disabled:hover {
        color: var(--qe-muted);
        background: none;
      }
      .add-opt,
      .add-inline {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 40px;
        padding-inline: var(--space-3, 12px);
        border: 1px dashed var(--qe-line-strong);
        border-radius: var(--radius-pill, 999px);
        background: transparent;
        color: var(--qe-muted);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition:
          color var(--motion-duration-fast, 120ms) ease,
          border-color var(--motion-duration-fast, 120ms) ease;
      }
      .add-opt:hover,
      .add-opt:focus-visible,
      .add-inline:hover,
      .add-inline:focus-visible {
        color: var(--cat);
        border-color: var(--cat);
      }
      .add-row {
        padding: var(--space-3, 12px);
        background: color-mix(in srgb, var(--qe-surface-muted) 45%, transparent);
      }
      .add-inline {
        inline-size: 100%;
        justify-content: center;
        min-block-size: 44px;
        border-radius: var(--radius-md, 8px);
      }

      /* ---- States ------------------------------------------------------- */
      .center {
        display: flex;
        justify-content: center;
        padding: var(--space-7, 40px);
      }
      .empty-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3, 12px);
        padding: var(--space-7, 40px);
        background: var(--qe-surface);
        border: 1px dashed var(--qe-line);
        border-radius: var(--qe-radius);
      }
      .nm-title {
        margin: 0;
        font-size: var(--text-lg, 18px);
        font-weight: 700;
        color: var(--qe-text);
      }
      .nm-body {
        margin: 0;
        font-size: var(--text-sm, 14px);
        color: var(--qe-muted);
        text-align: center;
      }

      /* ---- Narrow ------------------------------------------------------- */
      @media (max-width: 900px) {
        .page {
          padding: var(--space-4, 16px);
        }
        /* The type/optional chips drop under the question so the title keeps the
           full width instead of ellipsising against them. */
        .row-head {
          grid-template-columns: auto 24px minmax(0, 1fr) auto;
          grid-template-areas:
            'handle ord  main kebab'
            '.      meta meta meta';
          row-gap: 4px;
        }
        .handle {
          grid-area: handle;
        }
        .ord {
          grid-area: ord;
        }
        .row-main {
          grid-area: main;
          flex-wrap: wrap;
        }
        .kebab {
          grid-area: kebab;
        }
        .row-meta {
          grid-area: meta;
          justify-self: start;
        }
        .row-answers {
          padding-inline: var(--space-3, 12px);
        }
        .showing {
          margin-inline-start: 0;
        }
        /* The range text and the page buttons stop competing for one row. */
        .pager {
          justify-content: center;
        }
      }
      /* A phone-width sheet: the numeric bounds stack instead of squeezing three to a row. */
      @media (max-width: 560px) {
        .field-row {
          flex-direction: column;
          align-items: stretch;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .health-panel,
        .opt-edit {
          animation: none;
        }
        .opt-row,
        .chip,
        .type-btn,
        .row-head,
        .handle,
        .icon-btn,
        .add-opt,
        .add-inline,
        .kebab {
          transition: none;
        }
      }
    `,
  ],
})
export class QuestionnaireEditorPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly drawer = inject(NzDrawerService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly auth = inject(AuthService);

  /** Active admin locale drives label language (ar build → Arabic, else English). */
  readonly isAr = inject(LOCALE_ID).startsWith('ar');

  readonly INLINE_OPTION_PREVIEW = INLINE_OPTION_PREVIEW;
  readonly PAGE_SIZE = PAGE_SIZE;
  readonly types = TYPE_ORDER;

  /**
   * The flat pool, in the order applicants are asked. Groups still come back from
   * `tree()` (they page the mobile wizard) but are flattened away here and sorted
   * on `displayOrder` alone, which is the sequence `reorderQuestions` writes.
   */
  readonly rows = signal<QuestionRow[]>([]);
  readonly published = signal(false);
  readonly loading = signal(true);
  /** Standing money-binding warnings for the whole pool (FR-048/FR-049). */
  readonly bindingWarnings = signal<PublishWarning[]>([]);
  readonly healthOpen = signal(false);

  /** Which question the editor sheet is open on; null when it is closed. */
  readonly expandedId = signal<string | null>(null);
  /** True while the sheet holds a blank question form. */
  readonly creating = signal(false);
  readonly editing = computed(() => this.expandedId() !== null);
  /** A save in flight: the sheet's Save spins and nothing is sent twice. */
  readonly saving = signal(false);
  /** The open sheet; null when it is closed (or closing, after `collapse`). */
  private sheetRef: NzDrawerRef | null = null;
  private readonly editorSheet = viewChild.required<TemplateRef<unknown>>('editorSheet');
  readonly editingQuestion = computed<QuestionRow | null>(() => {
    const id = this.expandedId();
    return id === null ? null : (this.rows().find((q) => q.id === id) ?? null);
  });

  /**
   * The engine lock on the question being edited — what greys out half the form. The server's
   * `base` reason is the fixed mark, which the form shows with its own controls (`engineLockOf`).
   */
  readonly editLock = computed<QuestionEngineLock | null>(() => {
    const q = this.editingQuestion();
    return q === null ? null : engineLockOf(q);
  });
  /**
   * No answer may be ADDED to a locked question, whoever reads it (v30.12.0): nothing checks a
   * new answer has a row in the tables that read it, and one without is quoted on whatever a
   * table does with a stranger. The server refuses it too (`QUESTION_ENGINE_LOCKED`).
   */
  readonly canAddOption = computed(() => this.editLock() === null);

  /** The question being edited is fixed as saved — un-ticking the box would un-fix it. */
  readonly editingFixed = computed(() => {
    const q = this.editingQuestion();
    return q !== null && isFixed(q);
  });
  /** Opened by link from the Program catalog: not on this tab's list. */
  readonly editingHidden = computed(() => {
    const q = this.editingQuestion();
    return q !== null && !isListed(q);
  });
  /** The question the sheet header may move: one this tab lists. */
  readonly movableQuestion = computed<QuestionRow | null>(() => {
    const q = this.editingQuestion();
    return q !== null && isListed(q) ? q : null;
  });
  /**
   * The question the sheet's Delete acts on: a fixed one for a super admin (the type-the-code
   * dialog), any other one the loan engine does not read.
   */
  readonly deletableQuestion = computed<QuestionRow | null>(() => {
    const q = this.editingQuestion();
    if (q === null) return null;
    if (isFixed(q)) return this.auth.role() === 'super_admin' ? q : null;
    return engineLockOf(q) === null ? q : null;
  });

  readonly sheetTitle = computed(() =>
    this.editing()
      ? $localize`:@@qedit.modal_edit:Edit question`
      : $localize`:@@qedit.modal_new:New question`,
  );
  /** Where the question sits in the asked order — or that the catalog owns it. */
  readonly sheetSubtitle = computed(() => {
    const q = this.editingQuestion();
    if (q === null) {
      const position = this.listed().length + 1;
      return $localize`:@@qedit.sheet_pos_new:Asked last, at position ${position}:position:`;
    }
    // Opened by link from the Program catalog: not on this tab's list, so no place to number.
    if (!isListed(q)) return $localize`:@@qedit.modal_catalog_q:Program catalog question`;
    const position = this.positionOf(q);
    const total = this.listed().length;
    return $localize`:@@qedit.sheet_pos:Question ${position}:position: of ${total}:total:`;
  });
  readonly saveLabel = computed(() =>
    this.editing()
      ? $localize`:@@qedit.save_q:Save question`
      : $localize`:@@qedit.add_q:Add question`,
  );

  // Section legends. Properties, not method calls: they are plain string inputs.
  readonly secQuestion = $localize`:@@qedit.sec_question:Question`;
  readonly secHelper = $localize`:@@qedit.sec_helper:Helper text`;
  readonly optionalLabel = $localize`:@@qedit.sec_optional:Optional`;
  readonly helperHint = $localize`:@@qedit.helper_hint:Shown under the question in the app. Leave both empty for no sub-label.`;
  readonly secAnswer = $localize`:@@qedit.sec_answer_block:Answer`;
  readonly answerTypeLabel = $localize`:@@qedit.answer_type:Answer type`;
  readonly secSettings = $localize`:@@qedit.sec_settings:Settings`;
  readonly secBranch = $localize`:@@qedit.sec_branch:When to ask this`;

  /** Mirrors the form's Fixed tick and its "Asked on" choice, for the template. */
  readonly fixedTicked = signal(false);
  readonly servedOnValue = signal<FixedServedOn>('every_name');
  readonly servedOptions: readonly FixedServedOn[] = ['every_name', 'income_proof'];

  // ---- Deleted fixed questions (super admin) --------------------------------
  readonly deletedFixed = signal<DeletedFixedQuestion[]>([]);
  readonly deletedOpen = signal(false);
  readonly deletedShown = computed(() => this.deletedOpen() && this.deletedFixed().length > 0);
  readonly restoringId = signal<string | null>(null);

  /** Option sub-editors inside the sheet. */
  readonly editingOptionId = signal<string | null>(null);
  readonly addingOption = signal(false);

  // ---- Filtering -----------------------------------------------------------
  readonly searchCtrl = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.searchCtrl.valueChanges, { initialValue: '' });
  readonly typeFilter = signal<TypeFilter>('ALL');
  readonly onlyIncomplete = signal(false);
  readonly onlyFixed = signal(false);

  /**
   * What this tab LISTS: the fixed questions and every ordinary one no surrogate product asks
   * (v31.0.0). The rest stay in `rows` — branch rules, the reorder and `?q=` links need them.
   */
  readonly listed = computed<QuestionRow[]>(() => this.rows().filter((q) => isListed(q)));
  /** Questions surrogate products ask, managed from the Program catalog — said under the toolbar. */
  readonly hiddenCount = computed(() => this.rows().length - this.listed().length);
  readonly fixedCount = computed(() => this.listed().filter((q) => isFixed(q)).length);
  /** The Fixed chip is offered only when it narrows the list. */
  readonly fixedNarrows = computed(
    () => this.fixedCount() > 0 && this.fixedCount() < this.listed().length,
  );

  readonly filtering = computed(
    () =>
      this.query().trim() !== '' ||
      this.typeFilter() !== 'ALL' ||
      this.onlyIncomplete() ||
      this.onlyFixed(),
  );

  readonly visible = computed<QuestionRow[]>(() => {
    const needle = this.query().trim().toLowerCase();
    const type = this.typeFilter();
    const incompleteOnly = this.onlyIncomplete();
    const fixedOnly = this.onlyFixed();
    return this.listed().filter((q) => {
      if (fixedOnly && !isFixed(q)) return false;
      if (type !== 'ALL' && q.type !== type) return false;
      if (incompleteOnly && !this.needsOptions(q)) return false;
      if (needle === '') return true;
      return this.haystack(q).includes(needle);
    });
  });

  // ---- Paging --------------------------------------------------------------
  /**
   * The page the admin ASKED for. Reads go through `page()`, which clamps it, so
   * a shrinking list (a delete, a narrowing filter) can never strand the view on
   * an empty page — the clamp is the only place that decides what is shown.
   */
  private readonly pageRequest = signal(1);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.visible().length / PAGE_SIZE)));
  readonly page = computed(() => Math.min(Math.max(1, this.pageRequest()), this.pageCount()));
  private readonly pageOffset = computed(() => (this.page() - 1) * PAGE_SIZE);

  /** The rows actually rendered — one page of the FILTERED list. */
  readonly paged = computed<QuestionRow[]>(() =>
    this.visible().slice(this.pageOffset(), this.pageOffset() + PAGE_SIZE),
  );

  readonly rangeStart = computed(() => (this.visible().length === 0 ? 0 : this.pageOffset() + 1));
  readonly rangeEnd = computed(() => this.pageOffset() + this.paged().length);

  /** Choice questions the server would refuse to ask: fewer than two options. */
  readonly incomplete = computed(() => this.listed().filter((q) => this.needsOptions(q)));
  readonly issueCount = computed(() => this.incomplete().length + this.bindingWarnings().length);
  readonly totalOptions = computed(() =>
    this.listed().reduce((sum, q) => sum + q.options.length, 0),
  );

  /**
   * Reordering is only offered on the unfiltered list: in a filtered view the
   * visible sequence is not the asked sequence, so a drop would move a question
   * somewhere the admin cannot see. The sheet's mask covers the list while it is open, so
   * it needs no separate guard — the move buttons in its header cover that case.
   */
  readonly reorderable = computed(() => !this.filtering());

  // ---- Answer types --------------------------------------------------------
  /** Mirrors `questionForm.controls.type` so the template can react to it. */
  readonly selectedType = signal<QuestionType>('SINGLE_SELECT');
  /**
   * A question that already carries answers cannot change type: the stored
   * answers would no longer match their question's shape.
   */
  readonly typeLocked = signal(false);

  readonly questionForm = new FormGroup({
    questionEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    questionAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    // Optional both sides: most questions read fine without one, and an empty
    // string is the CLEAR signal on update rather than "leave as it was".
    helperTextEn: new FormControl('', { nonNullable: true }),
    helperTextAr: new FormControl('', { nonNullable: true }),
    isRequired: new FormControl(true, { nonNullable: true }),
    /** FIXED — the admin's mark, both ways (v31.1.0): asked on every program of its loan types. */
    fixed: new FormControl(false, { nonNullable: true }),
    /** Where a fixed question is asked; read only while `fixed` is ticked. */
    servedOn: new FormControl<FixedServedOn>('every_name', { nonNullable: true }),
    /** Typed reactive control (Principle XXII) — the radiogroup writes to this. */
    type: new FormControl<QuestionType>('SINGLE_SELECT', { nonNullable: true }),
    // Money crosses as decimal STRINGS even here, where these are bounds rather
    // than amounts: the server stores them as Decimal(18,2) (Principle I).
    numeric: new FormGroup({
      minValue: new FormControl('', { nonNullable: true }),
      maxValue: new FormControl('', { nonNullable: true }),
      step: new FormControl('', { nonNullable: true }),
      unitEn: new FormControl('', { nonNullable: true }),
      unitAr: new FormControl('', { nonNullable: true }),
    }),
    text: new FormGroup({
      maxLength: new FormControl<number | null>(null),
    }),
    /**
     * Branch rule. An empty `questionCode` means "always ask", which is why these
     * are plain optional controls rather than a nullable group: the form has one
     * representation of "no branch" instead of two.
     */
    enabledWhen: new FormGroup({
      questionCode: new FormControl('', { nonNullable: true }),
      operator: new FormControl<BranchOperator>('equals', { nonNullable: true }),
      /** `equals` / `not_equals` — the one answer compared. */
      optionCode: new FormControl('', { nonNullable: true }),
      /** `in` — the answers any one of which turns the question on (two or more). */
      optionCodes: new FormControl<string[]>([], { nonNullable: true }),
    }),
  });

  /** Two standalone controls rather than a group: the option editor is one row. */
  readonly optionEn = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly optionAr = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  /**
   * The answer's offer effect (v31.2.0), edited in the same panel as its labels. Text boxes,
   * not numbers: the figures are signed decimals the server keeps as strings (Principle I),
   * and an empty box is a lever left unset rather than a zero.
   */
  readonly optionEffect = new FormGroup({
    on: new FormControl(false, { nonNullable: true }),
    loan: new FormControl('', {
      nonNullable: true,
      validators: [
        signedEffectValidator(
          ANSWER_EFFECT_LIMITS.maxLoanPercent.min,
          ANSWER_EFFECT_LIMITS.maxLoanPercent.max,
        ),
      ],
    }),
    rate: new FormControl('', {
      nonNullable: true,
      validators: [
        signedEffectValidator(
          ANSWER_EFFECT_LIMITS.ratePoints.min,
          ANSWER_EFFECT_LIMITS.ratePoints.max,
        ),
      ],
    }),
    term: new FormControl('', {
      nonNullable: true,
      validators: [
        monthsEffectValidator(
          ANSWER_EFFECT_LIMITS.maxTenorMonths.min,
          ANSWER_EFFECT_LIMITS.maxTenorMonths.max,
        ),
      ],
    }),
  });
  readonly unitPoints = $localize`:@@qedit.effect_unit_points:points`;
  readonly unitMonths = $localize`:@@qedit.effect_unit_months:months`;

  constructor() {
    // A new search re-slices the list, so the page number the admin was on refers
    // to a set that no longer exists. The two chip filters reset the page in their
    // own setters; the search box is a control, so it resets from its stream.
    this.searchCtrl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.pageRequest.set(1));
  }

  async ngOnInit(): Promise<void> {
    await this.loadAll();
    this.openFromUrl();
  }

  /**
   * Open one question named on the URL — `?q=<code>`.
   *
   * The product screen lists what a product asks and, until now, its "Edit the wording" link
   * landed on this page's FIRST page with every question in the pool, leaving the operator to
   * find the row they had just been looking at. A code and not an id: an id is this
   * database's, and the link is pasted into a message as often as it is clicked.
   *
   * Read ONCE, after the rows are in hand — a question that is not in the pool is left alone
   * rather than reported, because a stale link is a link, not a fault the operator can fix
   * from here. The parameter is then cleared from the URL so a reload does not re-open a form
   * the operator deliberately closed.
   */
  private openFromUrl(): void {
    const code = this.route.snapshot.queryParamMap.get('q');
    if (!code) return;
    const row = this.rows().find((q) => q.code === code);
    if (!row) return;
    this.clearFilters();
    this.revealQuestion(row.id);
    this.openRow(row);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ---- Display helpers -----------------------------------------------------
  isChoice(type: QuestionType): boolean {
    return isChoiceQuestionType(type);
  }

  /** A choice question with fewer than two options cannot be published. */
  needsOptions(q: QuestionRow): boolean {
    return this.isChoice(q.type) && q.options.length < 2;
  }

  /** 1-based position in the ASKED order of this tab's list, not in the filtered view. */
  positionOf(q: QuestionRow): number {
    return this.listed().findIndex((r) => r.id === q.id) + 1;
  }

  countOfType(type: QuestionType): number {
    return this.listed().filter((q) => q.type === type).length;
  }

  readonly isFixed = isFixed;
  readonly engineLockOf = engineLockOf;
  readonly servedOnLabel = servedOnLabel;
  readonly servedOnHint = servedOnHint;

  /** The Fixed badge's tooltip, and its screen-reader text. */
  fixedTip(q: QuestionRow): string {
    return q.fixedServedOn === 'income_proof'
      ? $localize`:@@qedit.fixed_tip_proof:Fixed: every income-proof program in its loan types asks it`
      : $localize`:@@qedit.fixed_tip_every:Fixed: every program in its loan types asks it`;
  }

  previewOptions(q: QuestionRow): OptionRow[] {
    return q.options.slice(0, INLINE_OPTION_PREVIEW);
  }

  allOptionLabels(q: QuestionRow): string {
    return q.options.map((o) => (this.isAr ? o.labelAr : o.labelEn)).join(' · ');
  }

  /** The row chip's tooltip, and its screen-reader text. */
  lockSummary(lock: QuestionEngineLock): string {
    return lock.reason === 'program'
      ? $localize`:@@qedit.lock_tip_program:Locked: read by ${this.programNamesOf(lock)}:names:`
      : $localize`:@@qedit.lock_tip_engine:Locked: the loan engine reads this answer`;
  }

  /** The program names a `program` lock is read by, in the admin's language. */
  programNamesOf(lock: QuestionEngineLock): string {
    return lock.programNames
      .map((n) => (this.isAr ? n.labelAr : n.labelEn))
      .join(this.isAr ? '، ' : ', ');
  }

  // Placeholders and segment labels for the branch pickers. Properties, not method
  // calls: `nzPlaceHolder` is a plain string input, so a method here would re-run
  // `$localize` on every change detection pass.
  readonly branchPickSourceLabel = $localize`:@@qedit.branch_always:Pick an earlier question`;
  readonly branchPickOptionLabel = $localize`:@@qedit.branch_pick_option:Pick an answer`;
  readonly branchPickOptionsLabel = $localize`:@@qedit.branch_pick_options:Pick two or more answers`;

  /** The values of `enabledWhen.operator`, in the order the segments render. */
  readonly branchOperators: readonly BranchOperator[] = ['equals', 'not_equals', 'in'];

  branchOperatorLabel(op: BranchOperator): string {
    switch (op) {
      case 'equals':
        return $localize`:@@qedit.branch_is:is`;
      case 'not_equals':
        return $localize`:@@qedit.branch_is_not:is not`;
      case 'in':
        return $localize`:@@qedit.branch_is_one_of:is one of`;
    }
  }

  typeLabel(type: QuestionType): string {
    switch (type) {
      case 'SINGLE_SELECT':
        return $localize`:@@qedit.type_single:One choice`;
      case 'MULTI_SELECT':
        return $localize`:@@qedit.type_multi:Several choices`;
      case 'NUMERIC':
        return $localize`:@@qedit.type_numeric:Number`;
      case 'TEXT':
        return $localize`:@@qedit.type_text:Text`;
    }
  }

  typeHint(type: QuestionType): string {
    switch (type) {
      case 'SINGLE_SELECT':
        return $localize`:@@qedit.type_single_hint:The applicant picks exactly one option.`;
      case 'MULTI_SELECT':
        return $localize`:@@qedit.type_multi_hint:The applicant can pick more than one option.`;
      case 'NUMERIC':
        return $localize`:@@qedit.type_numeric_hint:The applicant types a number, within the bounds you set.`;
      case 'TEXT':
        return $localize`:@@qedit.type_text_hint:The applicant types free text.`;
    }
  }

  /** One line summarising a value type's rules, shown where options would be. */
  ruleSummary(q: QuestionRow): string {
    if (q.type === 'TEXT') {
      const max = q.textMaxLength ?? 500;
      return $localize`:@@qedit.rule_text:Free text, up to ${max}:max: characters`;
    }
    if (q.type === 'NUMERIC') {
      const unit = (this.isAr ? q.numericUnitAr : q.numericUnitEn) ?? '';
      const min = formatGroupedNumber(q.numericMinValue) || '—';
      const max = formatGroupedNumber(q.numericMaxValue) || '—';
      return $localize`:@@qedit.rule_numeric:Number from ${min}:min: to ${max}:max: ${unit}:unit:`;
    }
    return '';
  }

  /** `meta.binding` names which of the four money figures is unclaimed. */
  bindingOf(w: PublishWarning): string {
    return String(w.meta['binding'] ?? w.meta['questionCode'] ?? '');
  }

  /** Localized via the shared error-code catalog — no per-component mapping (A22). */
  warningMessage(w: PublishWarning): string {
    return this.errorCodes.toLocalizedMessage(w.code as never, w.meta);
  }

  /** Search matches the wording in BOTH languages, the code, and the answers. */
  private haystack(q: QuestionRow): string {
    return [
      q.questionEn,
      q.questionAr,
      q.code,
      ...q.options.flatMap((o) => [o.labelEn, o.labelAr, o.code]),
    ]
      .join(' ')
      .toLowerCase();
  }

  // ---- Filters -------------------------------------------------------------
  setTypeFilter(type: TypeFilter): void {
    this.typeFilter.set(type);
    this.pageRequest.set(1);
  }

  setOnlyIncomplete(only: boolean): void {
    this.onlyIncomplete.set(only);
    this.pageRequest.set(1);
  }

  setOnlyFixed(only: boolean): void {
    this.onlyFixed.set(only);
    this.pageRequest.set(1);
  }

  clearFilters(): void {
    this.searchCtrl.setValue('');
    this.typeFilter.set('ALL');
    this.onlyIncomplete.set(false);
    this.onlyFixed.set(false);
    this.pageRequest.set(1);
  }

  // ---- Paging --------------------------------------------------------------
  /**
   * Page change only re-slices the list — the scroll position is left exactly
   * where it was. Scrolling the list back to its top moved the pager itself off
   * screen, so paging through the pool meant scrolling back down to the control
   * that had just been used for every single page.
   */
  setPage(page: number): void {
    this.pageRequest.set(page);
  }

  /**
   * Put the page that CONTAINS this question in front of the admin. Called after
   * anything that can move a question off the current page (a create appends to
   * the end, a move crosses a boundary), so the row they are working on is still
   * behind the modal when it closes.
   */
  private revealQuestion(id: string): void {
    const index = this.visible().findIndex((q) => q.id === id);
    if (index < 0) return;
    this.pageRequest.set(Math.floor(index / PAGE_SIZE) + 1);
  }

  /** Jump from the health panel to the offending question, filters cleared. */
  jumpTo(q: QuestionRow): void {
    this.clearFilters();
    this.revealQuestion(q.id);
    this.healthOpen.set(false);
    this.openRow(q);
  }

  // ---- Expand / collapse ---------------------------------------------------
  toggleRow(q: QuestionRow): void {
    if (this.expandedId() === q.id) {
      this.collapse();
      return;
    }
    this.openRow(q);
  }

  private openRow(q: QuestionRow): void {
    this.creating.set(false);
    this.resetOptionEditors();
    // Changing the type of an answered question would orphan those answers, so
    // the picker locks. The server is the authority and rejects it regardless.
    this.typeLocked.set(true);
    this.selectedType.set(q.type);
    this.questionForm.reset({
      questionEn: q.questionEn,
      questionAr: q.questionAr,
      helperTextEn: q.helperTextEn ?? '',
      helperTextAr: q.helperTextAr ?? '',
      isRequired: q.isRequired,
      type: q.type,
      numeric: {
        minValue: q.numericMinValue ?? '',
        maxValue: q.numericMaxValue ?? '',
        step: q.numericStep ?? '',
        unitEn: q.numericUnitEn ?? '',
        unitAr: q.numericUnitAr ?? '',
      },
      text: { maxLength: q.textMaxLength },
      enabledWhen: branchFormValue(q.enabledWhen),
      fixed: isFixed(q),
      servedOn: q.fixedServedOn ?? 'every_name',
    } as never);
    this.fixedTicked.set(isFixed(q));
    this.servedOnValue.set(q.fixedServedOn ?? 'every_name');
    this.applyLocks(q);
    this.expandedId.set(q.id);
    this.openSheet();
  }

  /**
   * Grey out what the server would refuse: on a question the loan engine or a bank program
   * reads, its unit and its when-to-ask rule. Disabled controls still travel in
   * `getRawValue()`, so a save sends them unchanged and the server sees no change to refuse.
   * Required and Fixed are never greyed out — both are the admin's, both ways (v31.1.0).
   */
  private applyLocks(q: QuestionRow | null): void {
    const c = this.questionForm.controls;
    const locked = q !== null && engineLockOf(q) !== null;
    for (const control of [c.numeric.controls.unitEn, c.numeric.controls.unitAr, c.enabledWhen]) {
      if (locked) control.disable({ emitEvent: false });
      else control.enable({ emitEvent: false });
    }
  }

  /** Mirrors the Fixed switch for the template: "Asked on" shows while it is on. */
  onFixedChange(ticked: boolean): void {
    this.fixedTicked.set(ticked);
  }

  /** The Required switch, for the line under it and the engine warning. */
  requiredOn(): boolean {
    return this.questionForm.controls.isRequired.value;
  }

  syncServedOn(): void {
    this.servedOnValue.set(this.questionForm.controls.servedOn.value);
  }

  startCreate(): void {
    this.expandedId.set(null);
    this.resetOptionEditors();
    this.typeLocked.set(false);
    this.selectedType.set('SINGLE_SELECT');
    this.questionForm.reset({
      questionEn: '',
      questionAr: '',
      helperTextEn: '',
      helperTextAr: '',
      isRequired: true,
      type: 'SINGLE_SELECT',
      numeric: { minValue: '', maxValue: '', step: '', unitEn: '', unitAr: '' },
      text: { maxLength: null },
      enabledWhen: { questionCode: '', operator: 'equals', optionCode: '', optionCodes: [] },
      fixed: false,
      servedOn: 'every_name',
    } as never);
    this.fixedTicked.set(false);
    this.servedOnValue.set('every_name');
    this.applyLocks(null);
    this.creating.set(true);
    this.openSheet();
  }

  /**
   * Hand the editor template to the shared side sheet, once: opening another question while it
   * is open only swaps the state the template reads. `openFormDrawer` lands the caret in the
   * first text field after the slide-in.
   *
   * The sheet's own exits (Esc, the close button) reach `afterClose`, which clears the editor —
   * unless another sheet was opened meanwhile, whose state a late close must not wipe.
   */
  private openSheet(): void {
    if (this.sheetRef !== null) return;
    const ref = openFormDrawer<object, object, void>(this.drawer, {
      content: this.editorSheet(),
      data: {},
      width: SHEET_WIDTH,
    });
    this.sheetRef = ref;
    ref.afterClose.subscribe(() => {
      if (this.sheetRef === ref) this.sheetRef = null;
      if (this.sheetRef === null) this.resetEditorState();
    });
  }

  /**
   * Close the sheet. The editor state is cleared when the slide-out ENDS (`afterClose`), so
   * the closing sheet keeps showing the question it was on instead of flashing a blank form.
   */
  collapse(): void {
    const ref = this.sheetRef;
    if (ref === null) {
      this.resetEditorState();
      return;
    }
    this.sheetRef = null;
    ref.close();
  }

  cancel(): void {
    this.collapse();
  }

  private resetEditorState(): void {
    this.expandedId.set(null);
    this.creating.set(false);
    this.resetOptionEditors();
  }

  pickType(type: QuestionType): void {
    if (this.typeLocked()) return;
    this.questionForm.controls.type.setValue(type);
    this.selectedType.set(type);
  }

  // ---- Branch rule ---------------------------------------------------------
  /**
   * Is a rule set at all? Read by the heading's reset button, the second sentence
   * row and the off-state hint — one predicate rather than three copies of the
   * same control read, which is how those three came to disagree about what an
   * empty `questionCode` means.
   */
  branchOn(): boolean {
    return this.questionForm.controls.enabledWhen.controls.questionCode.value !== '';
  }

  /** The comparison currently picked, for the segmented control's checked state. */
  branchOperator(): BranchOperator {
    return this.questionForm.controls.enabledWhen.controls.operator.value;
  }

  /**
   * The segments write the typed control directly (Principle XXII holds — the form
   * is still the single source of truth), the way the answer-type radiogroup one
   * column over writes `type`. `nz-select` is gone from this slot because its panel
   * inherits the trigger's content width, and a trigger sized to "is" ellipsised
   * "is not" to "is …".
   *
   * The picked answer travels when the move keeps its meaning: one answer becomes the first
   * of an "is one of" list, and a list of exactly one becomes that answer. A list of several
   * is not cut down to its first entry, which would quietly ask a different rule.
   */
  pickBranchOperator(op: BranchOperator): void {
    const c = this.questionForm.controls.enabledWhen.controls;
    const from = c.operator.value;
    if (from === op) return;
    if (op === 'in' && c.optionCodes.value.length === 0 && c.optionCode.value !== '') {
      c.optionCodes.setValue([c.optionCode.value]);
    } else if (from === 'in' && c.optionCode.value === '' && c.optionCodes.value.length === 1) {
      c.optionCode.setValue(c.optionCodes.value[0] ?? '');
    }
    c.operator.setValue(op);
  }

  /**
   * Does the picked source accept SEVERAL picks? The one thing the sentence cannot
   * say — the rule fires when any one of them matches — so the caveat is shown when
   * it is true instead of standing under every rule.
   */
  branchSourceIsMulti(): boolean {
    const code = this.questionForm.controls.enabledWhen.controls.questionCode.value;
    if (!code) return false;
    return this.rows().find((q) => q.code === code)?.type === 'MULTI_SELECT';
  }

  /**
   * Questions that may serve as a branch SOURCE for the one being edited.
   *
   * Mirrors `assertEnabledWhenValid` so the picker cannot offer something the
   * server rejects: a CHOICE question (an option code is what the rule compares)
   * with a strictly LOWER `displayOrder` — no forward references, since a rule
   * can only read an answer the applicant has already given.
   */
  branchSources(): QuestionRow[] {
    const selfOrder = this.rows().find((q) => q.id === this.expandedId())?.displayOrder;
    // A fixed question may only follow another fixed one (`QUESTION_FIXED_GATE_NOT_FIXED`).
    const fixedOnly = this.fixedTicked();
    return this.rows().filter(
      (q) =>
        q.isActive &&
        (!fixedOnly || isFixed(q)) &&
        isChoiceQuestionType(q.type) &&
        q.id !== this.expandedId() &&
        q.options.some((o) => o.isActive) &&
        // Creating: the question is appended to the end of the pool, so every
        // existing question precedes it and all of them are legal sources.
        (selfOrder === undefined || q.displayOrder < selfOrder),
    );
  }

  /** Active options of the currently picked branch source, for the option picker. */
  branchOptions(): OptionRow[] {
    const code = this.questionForm.controls.enabledWhen.controls.questionCode.value;
    if (!code) return [];
    return (
      this.rows()
        .find((q) => q.code === code)
        ?.options.filter((o) => o.isActive) ?? []
    );
  }

  /**
   * Changing the source invalidates the answers: option codes are scoped per
   * question, so a code kept from the previous source would be rejected as
   * `unknown_option`. Cleared here rather than validated later — both the single
   * answer and the "is one of" list.
   */
  onBranchSourceChange(): void {
    const c = this.questionForm.controls.enabledWhen.controls;
    c.optionCode.setValue('');
    c.optionCodes.setValue([]);
  }

  /**
   * Fixed is ticked over a rule that hangs on an ordinary question: the server would refuse it
   * (`QUESTION_FIXED_GATE_NOT_FIXED`), so it is said here and Save waits.
   */
  branchNotFixed(): boolean {
    if (!this.fixedTicked() || this.editLock() !== null) return false;
    const code = this.questionForm.controls.enabledWhen.controls.questionCode.value;
    if (code === '') return false;
    const source = this.rows().find((q) => q.code === code);
    return source === undefined || !isFixed(source);
  }

  /** Drop the rule entirely — the question becomes unconditional. */
  clearBranch(): void {
    this.questionForm.controls.enabledWhen.reset({
      questionCode: '',
      operator: 'equals',
      optionCode: '',
      optionCodes: [],
    });
  }

  /**
   * A half-filled rule: a source picked with no answer — or, for "is one of", fewer
   * than two (one answer is "is", and the server refuses a one-answer list). Blocks
   * save, because the server would reject it and because a rule that cannot be
   * evaluated is treated as DANGLING at read time — it never hides its question, so
   * it would look saved while doing nothing.
   */
  branchIncomplete(): boolean {
    const { questionCode, operator, optionCode, optionCodes } =
      this.questionForm.controls.enabledWhen.getRawValue();
    if (questionCode === '') return false;
    return operator === 'in' ? new Set(optionCodes).size < 2 : optionCode === '';
  }

  /** Live guard mirroring the server's `numeric.maxValue` rule, for fast feedback. */
  numericRangeInverted(): boolean {
    const { minValue, maxValue } = this.questionForm.controls.numeric.getRawValue();
    if (!minValue || !maxValue) return false;
    const min = Number(minValue);
    const max = Number(maxValue);
    return Number.isFinite(min) && Number.isFinite(max) && max < min;
  }

  // ---- Question writes -----------------------------------------------------
  /**
   * What keeps Save off: a missing wording, inverted bounds, a half-set rule, or Fixed over a
   * rule on an ordinary question. Each one is said by a line in the form, so a disabled Save
   * always has its reason on screen.
   */
  saveBlocked(): boolean {
    return (
      this.questionForm.invalid ||
      this.numericRangeInverted() ||
      // What is not sent cannot block: a locked question's rule.
      (this.editLock() === null && this.branchIncomplete()) ||
      this.branchNotFixed() ||
      this.unfixBlockedBy() !== null
    );
  }

  /**
   * Un-ticking Fixed on a question other FIXED questions are asked after: they may only follow
   * a fixed question, so the server refuses it (`QUESTION_FIXED_GATE_NOT_FIXED`). The followers'
   * wording, joined, or `null` when the un-fix may go ahead.
   */
  unfixBlockedBy(): string | null {
    const q = this.editingQuestion();
    if (q === null || !isFixed(q) || this.fixedTicked()) return null;
    const followers = this.rows().filter(
      (r) => r.isActive && isFixed(r) && r.enabledWhen?.questionCode === q.code,
    );
    if (followers.length === 0) return null;
    return followers
      .map((r) => `“${this.isAr ? r.questionAr : r.questionEn}”`)
      .join(this.isAr ? '، ' : ', ');
  }

  unfixBlockedText(): string {
    const names = this.unfixBlockedBy() ?? '';
    return $localize`:@@qedit.unfix_blocked:Fixed questions are asked only after this answer: ${names}:names:. Make them ordinary first, then this one.`;
  }

  async submitQuestion(): Promise<void> {
    if (this.saveBlocked() || this.saving()) return;
    const lock = this.editLock();
    const v = this.questionForm.getRawValue();
    // FIXED is the admin's both ways (v31.1.0): sent on every save, `null` un-fixes it. The
    // server ignores a mark that is already what it is.
    const fixedServedOn: FixedServedOn | null = v.fixed ? v.servedOn : null;
    // Send only the rule block the chosen type owns. Sending both would fail the
    // server's QUESTION_TYPE_RULES_INVALID check; sending `null` clears the other.
    const rules = {
      numeric: v.type === 'NUMERIC' ? blankToNull(v.numeric) : null,
      text: v.type === 'TEXT' ? { maxLength: v.text.maxLength ?? undefined } : null,
    };
    // An empty source code means "always ask". On UPDATE that must be sent as an
    // explicit `null` to clear a rule the question previously had; on CREATE the
    // key is simply omitted.
    const branch = branchRule(v.enabledWhen);
    const id = this.expandedId();
    this.saving.set(true);
    try {
      if (id !== null) {
        // `code` is immutable (A33) — never sent. `type` is not sent either: it is
        // locked in edit mode, because answers already reference this shape.
        // `displayOrder` is not sent: order is owned by drag / move, not this form.
        const body: UpdateQuestionBody = {
          questionEn: v.questionEn,
          questionAr: v.questionAr,
          // Always sent, empty included: an emptied box must CLEAR the sub-label,
          // which omitting the key would silently decline to do.
          helperTextEn: v.helperTextEn.trim(),
          helperTextAr: v.helperTextAr.trim(),
          isRequired: v.isRequired,
          // A locked question leaves its rule out: the rule cannot change here, and re-sending
          // a copy of it is one more thing that could fail to round-trip.
          ...(lock === null ? { enabledWhen: branch } : {}),
          ...rules,
          fixedServedOn,
        };
        await this.api.updateQuestion(id, body);
        this.message.success($localize`:@@qedit.question_saved:Question saved`);
        await this.reload();
        this.collapse();
        return;
      }
      // No groupId, no displayOrder: the server places it at the end of the pool.
      const created = await this.api.createQuestion({
        questionEn: v.questionEn,
        questionAr: v.questionAr,
        ...(v.helperTextEn.trim() ? { helperTextEn: v.helperTextEn.trim() } : {}),
        ...(v.helperTextAr.trim() ? { helperTextAr: v.helperTextAr.trim() } : {}),
        isRequired: v.isRequired,
        type: v.type,
        ...(branch ? { enabledWhen: branch } : {}),
        ...rules,
        ...(fixedServedOn !== null ? { fixedServedOn } : {}),
      });
      this.message.success($localize`:@@qedit.question_added:Question added`);
      await this.reload();
      // The server appends, so the new question is on the LAST page — follow it, or
      // the admin closes the editor onto a list their question is not in.
      this.revealQuestion(created.id);
      // A choice question is unpublishable until it has options, so stay on it with
      // the option editor open rather than closing onto a row flagged "needs options".
      if (isChoiceQuestionType(created.type)) {
        const fresh = this.rows().find((q) => q.id === created.id);
        if (fresh) {
          this.openRow(fresh);
          this.startAddOption();
          return;
        }
      }
      this.collapse();
    } catch {
      // A refusal (an engine lock, a rule the server rejects) is already a toast from the
      // interceptor. The sheet stays open with the admin's edits so nothing typed is lost.
    } finally {
      this.saving.set(false);
    }
  }

  // ---- Reordering ----------------------------------------------------------
  /**
   * CDK reports indexes within the RENDERED list, which is one page. Dragging is
   * only offered unfiltered, so the page is a contiguous window over `rows()` and
   * the page offset converts a page index into the global one `commitOrder` needs.
   */
  async drop(event: CdkDragDrop<unknown>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const offset = this.pageOffset();
    // Within the LISTED questions: a hidden (program-catalog) question keeps its own slot.
    const next = reorderWithin(
      this.rows(),
      this.listed(),
      offset + event.previousIndex,
      offset + event.currentIndex,
    );
    await this.commitOrder(next);
  }

  /**
   * Menu-driven move: the keyboard path, the only path while filtered, and the
   * only way to move a question ACROSS a page boundary.
   */
  async moveBy(q: QuestionRow, delta: number): Promise<void> {
    const listed = this.listed();
    const from = listed.findIndex((r) => r.id === q.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= listed.length) return;
    await this.commitOrder(reorderWithin(this.rows(), listed, from, to));
    this.revealQuestion(q.id);
  }

  /**
   * Optimistic: the list re-renders before the round-trip so a drag does not snap
   * back under the cursor. A rejected reorder reloads the server's truth.
   */
  private async commitOrder(next: QuestionRow[]): Promise<void> {
    const previous = this.rows();
    this.rows.set(next);
    try {
      await this.api.reorderQuestions(next.map((q) => q.id));
      this.published.set(true);
    } catch {
      // Localized toast already shown by the interceptor.
      this.rows.set(previous);
    }
  }

  // ---- Options -------------------------------------------------------------
  startAddOption(): void {
    this.editingOptionId.set(null);
    this.optionEn.reset('');
    this.optionAr.reset('');
    this.optionEffect.reset({ on: false, loan: '', rate: '', term: '' });
    this.addingOption.set(true);
  }

  openOptionEdit(o: OptionRow): void {
    this.addingOption.set(false);
    this.optionEn.setValue(o.labelEn);
    this.optionAr.setValue(o.labelAr);
    const levers = leversOfOption(o);
    this.optionEffect.reset({
      on: hasAnyLever(levers),
      loan: levers.maxLoanPercent ?? '',
      rate: levers.ratePoints ?? '',
      term: levers.maxTenorMonths !== undefined ? String(levers.maxTenorMonths) : '',
    });
    this.editingOptionId.set(o.id);
  }

  /** "Max loan −10% · Rate +1 pts" for a row, or null when the answer changes nothing. */
  optionEffectText(o: OptionRow): string | null {
    const parts = effectParts(leversOfOption(o));
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  /** The levers as typed — an empty box is unset, and unticked means none at all. */
  private effectTyped(): AnswerEffectLevers {
    const v = this.optionEffect.getRawValue();
    if (!v.on) return {};
    const loan = v.loan.trim();
    const rate = v.rate.trim();
    const term = v.term.trim();
    return {
      ...(loan !== '' ? { maxLoanPercent: loan } : {}),
      ...(rate !== '' ? { ratePoints: rate } : {}),
      ...(term !== '' ? { maxTenorMonths: Number(term) } : {}),
    };
  }

  effectTypedAny(): boolean {
    return hasAnyLever(this.effectTyped());
  }

  /** Only while ticked: unticked, whatever is left in the boxes is not sent. */
  effectInvalid(): boolean {
    return this.optionEffect.controls.on.value && this.optionEffect.invalid;
  }

  effectBetter(): boolean {
    return betterThanBank(this.effectTyped());
  }

  cancelOption(): void {
    this.resetOptionEditors();
  }

  /**
   * Escape inside the option editor cancels the OPTION, not the question: without
   * stopping the event it bubbles to the modal and throws away every unsaved edit
   * on the question because the admin backed out of typing one answer label.
   */
  escapeOption(event: Event): void {
    event.stopPropagation();
    this.resetOptionEditors();
  }

  private resetOptionEditors(): void {
    this.editingOptionId.set(null);
    this.addingOption.set(false);
  }

  async submitOption(q: QuestionRow): Promise<void> {
    if (this.optionEn.invalid || this.optionAr.invalid || this.effectInvalid()) return;
    const labelEn = this.optionEn.value.trim();
    const labelAr = this.optionAr.value.trim();
    const editingId = this.editingOptionId();
    const levers = this.effectTyped();
    // The whole effect, every time: the server replaces it, so a box emptied here is cleared.
    const effect: AnswerEffectBody | null = hasAnyLever(levers)
      ? {
          maxLoanPercent: levers.maxLoanPercent ?? null,
          ratePoints: levers.ratePoints ?? null,
          maxTenorMonths: levers.maxTenorMonths ?? null,
        }
      : null;
    try {
      if (editingId !== null) {
        await this.api.updateOption(editingId, { labelEn, labelAr, effect });
        this.message.success($localize`:@@qedit.option_saved:Option saved`);
      } else {
        // No displayOrder: the server appends after the existing options.
        await this.api.createOption(q.id, { labelEn, labelAr, ...(effect ? { effect } : {}) });
        this.message.success($localize`:@@qedit.option_added:Option added`);
      }
    } catch {
      // Refused — on a locked question, a reword that changes its numbers
      // (`ENGINE_WORDING_NUMBERS_CHANGED`). The toast already says why; the editor stays open
      // on what was typed, so it can be put right rather than retyped.
      return;
    }
    await this.reload();
    // Adding options comes in runs, so the add row stays open and pre-cleared;
    // an edit is a one-off, so it closes.
    if (editingId !== null) {
      this.resetOptionEditors();
    } else {
      this.startAddOption();
    }
  }

  // ---- Deletes (soft-delete server-side; typed-error toasts via interceptor) --
  confirmDeleteQuestion(q: QuestionRow): void {
    this.modal.confirm({
      nzTitle: $localize`:@@qedit.del_question_title:Delete this question?`,
      nzContent: $localize`:@@qedit.del_question_body:"${
        this.isAr ? q.questionAr : q.questionEn
      }:name:" will stop being asked and a new version publishes immediately. Answers already given are kept. If another question branches on this one, the delete is refused.`,
      nzCentered: true,
      nzIconType: 'delete',
      nzOkText: $localize`:@@qedit.del_ok:Delete`,
      nzOkDanger: true,
      nzCancelText: $localize`:@@qedit.del_cancel:Cancel`,
      nzOnOk: async () => {
        try {
          await this.api.deleteQuestion(q.id);
          this.message.success($localize`:@@qedit.question_deleted:Question deleted`);
          if (this.expandedId() === q.id) this.collapse();
          await this.reload();
        } catch {
          /* blocked / failed — localized toast already shown by the interceptor */
        }
      },
    });
  }

  /** The sheet's Delete: the type-the-code dialog for a fixed question, a confirm otherwise. */
  deleteQuestion(q: QuestionRow): void {
    if (isFixed(q)) this.openDeleteFixed(q);
    else this.confirmDeleteQuestion(q);
  }

  /**
   * A FIXED question — loan-engine ones included — is deleted by a super admin through the
   * type-the-code dialog, which reads what the delete does first. Closed while a delete is in
   * flight only by the dialog itself, so the request is never orphaned.
   */
  openDeleteFixed(q: QuestionRow): void {
    const ref = this.modal.create<DeleteFixedQuestionDialog, DeleteFixedQuestionData, boolean>({
      nzContent: DeleteFixedQuestionDialog,
      nzData: { id: q.id, code: q.code, questionEn: q.questionEn, questionAr: q.questionAr },
      nzWidth: 520,
      nzCentered: true,
      nzFooter: null,
      nzMaskClosable: false,
      nzAutofocus: null,
      nzOnCancel: (dialog) => !dialog.busy(),
    });
    ref.afterClose.subscribe((deleted) => {
      if (deleted !== true) return;
      this.message.success($localize`:@@qedit.question_deleted:Question deleted`);
      if (this.expandedId() === q.id) this.collapse();
      void this.reload();
    });
  }

  /** Bring a deleted fixed question back — whole, and asked again by every program at once. */
  async restore(d: DeletedFixedQuestion): Promise<void> {
    this.restoringId.set(d.id);
    try {
      await this.api.restoreQuestion(d.id);
      this.message.success($localize`:@@qedit.restored:Question restored`);
      await this.reload();
      if (this.deletedFixed().length === 0) this.deletedOpen.set(false);
    } catch {
      /* refused — localized toast already shown by the interceptor */
    } finally {
      this.restoringId.set(null);
    }
  }

  /** "Every program · Personal, Car" — where a deleted fixed question was asked. */
  deletedMeta(d: DeletedFixedQuestion): string {
    const types = d.categories
      .filter(isLoanCategory)
      .map((c) => categoryLabel(c))
      .join(this.isAr ? '، ' : ', ');
    return types === ''
      ? servedOnLabel(d.fixedServedOn)
      : `${servedOnLabel(d.fixedServedOn)} · ${types}`;
  }

  restoreAria(d: DeletedFixedQuestion): string {
    const question = this.isAr ? d.questionAr : d.questionEn;
    return $localize`:@@qedit.restore_aria:Restore “${question}:question:”`;
  }

  confirmDeleteOption(o: OptionRow): void {
    this.modal.confirm({
      nzTitle: $localize`:@@qedit.del_option_title:Delete this option?`,
      nzContent: $localize`:@@qedit.del_option_body:"${
        this.isAr ? o.labelAr : o.labelEn
      }:name:" will no longer be offered. Answers that already picked it are kept, and any per-program score for it is dropped.`,
      nzCentered: true,
      nzIconType: 'delete',
      nzOkText: $localize`:@@qedit.del_ok:Delete`,
      nzOkDanger: true,
      nzCancelText: $localize`:@@qedit.del_cancel:Cancel`,
      nzOnOk: async () => {
        try {
          await this.api.deleteOption(o.id);
          this.message.success($localize`:@@qedit.option_deleted:Option deleted`);
          this.resetOptionEditors();
          await this.reload();
        } catch {
          /* blocked / failed — localized toast already shown by the interceptor */
        }
      },
    });
  }

  // ---- Loading -------------------------------------------------------------
  private async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [tree, history, warnings] = await Promise.all([
        this.api.tree(),
        this.api.versionHistory(),
        this.api.bindingWarnings(),
      ]);
      this.rows.set(flatten(tree ?? []));
      this.published.set((history ?? []).some((v) => v.isActive));
      this.bindingWarnings.set(warnings ?? []);
    } finally {
      this.loading.set(false);
    }
    await this.loadDeletedFixed();
  }

  /** The restore list — a super admin's, and a safety net: a failed read stays quiet. */
  private async loadDeletedFixed(): Promise<void> {
    if (this.auth.role() !== 'super_admin') return;
    try {
      this.deletedFixed.set(await this.api.deletedFixed({ silent: true }));
    } catch {
      this.deletedFixed.set([]);
    }
  }

  /** After a mutation, re-fetch. Every mutation auto-publishes server-side. */
  private async reload(): Promise<void> {
    const [tree, warnings] = await Promise.all([this.api.tree(), this.api.bindingWarnings()]);
    this.rows.set(flatten(tree ?? []));
    this.published.set(true);
    this.bindingWarnings.set(warnings ?? []);
    await this.loadDeletedFixed();
    // The open question's lock is re-read with the tree; keep the controls in step.
    const open = this.editingQuestion();
    if (open !== null) this.applyLocks(open);
  }
}

/**
 * Groups collapse away here. Sorting on `displayOrder` ALONE (not group order,
 * then question order) is what makes the flat list authoritative: `reorderQuestions`
 * writes a single global sequence, so group membership must not influence order.
 */
function flatten(tree: { questions: QuestionRow[] }[]): QuestionRow[] {
  return tree
    .flatMap((g) => g.questions)
    .filter((q) => q.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** The branch rule as the form holds it — one shape for every operator. */
interface BranchFormValue {
  questionCode: string;
  operator: BranchOperator;
  optionCode: string;
  optionCodes: string[];
}

/**
 * A stored rule into the form, read through `ruleCodes` like every other reader: `in` fills the
 * list, `equals` / `not_equals` the single answer. An operator this build does not know loads as
 * "is" with no answer, so the rule reads as unfinished rather than being saved back as a
 * different one.
 */
function branchFormValue(rule: QuestionRow['enabledWhen']): BranchFormValue {
  const operator: BranchOperator =
    rule?.operator === 'not_equals' ? 'not_equals' : rule?.operator === 'in' ? 'in' : 'equals';
  const codes = ruleCodes(rule);
  return {
    questionCode: rule?.questionCode ?? '',
    operator,
    optionCode: operator === 'in' ? '' : (codes[0] ?? ''),
    optionCodes: operator === 'in' ? [...codes] : [],
  };
}

/**
 * The form back into the rule the API takes, or `null` for "always ask" — and for a rule too
 * unfinished to send, which `branchIncomplete` keeps from reaching here on an editable question.
 */
function branchRule(v: BranchFormValue): EnabledWhenRule | null {
  if (v.questionCode === '') return null;
  if (v.operator === 'in') {
    const optionCodes = [...new Set(v.optionCodes)];
    return optionCodes.length >= 2
      ? { questionCode: v.questionCode, operator: 'in', optionCodes }
      : null;
  }
  return v.optionCode === ''
    ? null
    : { questionCode: v.questionCode, operator: v.operator, optionCode: v.optionCode };
}

/**
 * An empty text input means "no bound", not "zero" — a blank minimum must not
 * become 0, which would be a real (and wrong) lower bound.
 */
function blankToNull(numeric: {
  minValue: string;
  maxValue: string;
  step: string;
  unitEn: string;
  unitAr: string;
}): Record<string, string | undefined> {
  const clean = (v: string): string | undefined => {
    const t = v.trim();
    return t === '' ? undefined : t;
  };
  return {
    minValue: clean(numeric.minValue),
    maxValue: clean(numeric.maxValue),
    step: clean(numeric.step),
    unitEn: clean(numeric.unitEn),
    unitAr: clean(numeric.unitAr),
  };
}
