import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  LOCALE_ID,
  OnInit,
  afterNextRender,
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
  moveItemInArray,
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { A11yModule } from '@angular/cdk/a11y';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  CheckCircleOutline,
  CloseOutline,
  DeleteOutline,
  EditOutline,
  EllipsisOutline,
  HolderOutline,
  PlusOutline,
  SearchOutline,
  WarningOutline,
} from '@ant-design/icons-angular/icons';
import {
  QuestionnaireApiService,
  isChoiceQuestionType,
  type OptionRow,
  type PublishWarning,
  type QuestionRow,
  type QuestionType,
} from './questionnaire.api.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { MoneyInputDirective, formatGroupedNumber } from '@core/directives/money-input.directive';

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

type TypeFilter = QuestionType | 'ALL';

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
 * Editing happens INLINE, in the row's own position — there is no drawer. A drawer
 * costs the admin the surrounding questions (the context that tells them whether
 * this question is redundant), and for a two-field option form it is pure overhead.
 * Every edit auto-publishes a new global version.
 */
@Component({
  standalone: true,
  selector: 'mf-questionnaire-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
    A11yModule,
    MoneyInputDirective,
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
      PlusOutline,
      SearchOutline,
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
          } @else if (!loading() && rows().length > 0) {
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
      } @else if (rows().length === 0) {
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

          <p class="showing">
            @if (filtering()) {
              <span i18n="@@qedit.showing"
                >{{ visible().length }} of {{ rows().length }} questions</span
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
                >{{ rows().length }} questions · {{ totalOptions() }} answers</span
              >
            }
          </p>
        </div>

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
              The pool still has {{ rows().length }} questions — they're just filtered out.
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

    <!-- Editor modal — rendered OUTSIDE section.page so the fixed scrim resolves
         against the viewport rather than the page's animated containing block (A34).
         A modal rather than an inline panel: expanding a row in place pushed every
         question below it down by ~400px, so the list moved under the cursor at the
         exact moment the admin was trying to read it. -->
    @if (modalOpen()) {
      <div class="scrim" (click)="cancel()" aria-hidden="true"></div>
      <!-- The wrap is the scroll container. Owning the scroll (plus overscroll
           containment) is what keeps the page behind from scrolling, with no
           body-overflow bookkeeping to get out of sync with nz-modal's own. -->
      <div class="modal-wrap">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qedit-modal-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (keydown.escape)="cancel()"
        >
          <header class="modal-head">
            <div class="mh-lead">
              @if (editingQuestion(); as eq) {
                <p class="mh-eyebrow">
                  <span i18n="@@qedit.modal_pos"
                    >Question {{ positionOf(eq) }} of {{ rows().length }}</span
                  >
                </p>
                <h2 id="qedit-modal-title" i18n="@@qedit.modal_edit">Edit question</h2>
              } @else {
                <p class="mh-eyebrow">
                  <span i18n="@@qedit.modal_pos_new">Position {{ rows().length + 1 }}</span>
                </p>
                <h2 id="qedit-modal-title" i18n="@@qedit.modal_new">New question</h2>
              }
            </div>
            <div class="mh-actions">
              <!-- Reordering lives here now: it is the keyboard twin of the drag
                   handle, and the only way to move a question while filtered. -->
              @if (editingQuestion(); as eq) {
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
                  [disabled]="positionOf(eq) === rows().length"
                  (click)="moveBy(eq, 1)"
                  nz-tooltip
                  nzTooltipTitle="Move down"
                  i18n-nzTooltipTitle="@@qedit.move_down"
                  aria-label="Move down"
                  i18n-aria-label="@@qedit.move_down"
                >
                  <span nz-icon nzType="arrow-down" nzTheme="outline"></span>
                </button>
              }
              <button
                type="button"
                class="icon-btn mh-close"
                (click)="cancel()"
                aria-label="Close"
                i18n-aria-label="@@qedit.close_aria"
              >
                <span nz-icon nzType="close" nzTheme="outline"></span>
              </button>
            </div>
          </header>

          <div class="modal-body">
            <ng-container [ngTemplateOutlet]="questionEditor"></ng-container>
          </div>
        </section>
      </div>
    }

    <!-- One editor for both edit and create: the two differ only in whether a
         question is already saved, so duplicating 120 lines of form would be two
         places to fix every rule. -->
    <ng-template #questionEditor>
      <form [formGroup]="questionForm" class="form" (ngSubmit)="submitQuestion()">
        <div class="form-cols">
          <div class="col">
            <p class="section-lbl" i18n="@@qedit.sec_content">Content</p>
            <label class="field">
              <span class="lbl" i18n="@@qedit.q_en">Question (English)</span>
              <input
                #firstField
                nz-input
                formControlName="questionEn"
                placeholder="e.g. What is your monthly income?"
              />
            </label>
            <label class="field">
              <span class="lbl" i18n="@@qedit.q_ar">السؤال (عربي)</span>
              <input
                nz-input
                formControlName="questionAr"
                dir="rtl"
                placeholder="مثال: ما هو دخلك الشهري؟"
              />
            </label>

            <p class="section-lbl" i18n="@@qedit.sec_answer">Answer type</p>
            <!-- Typed reactive control, not ngModel (Principle XXII / A16).
                 A radiogroup rather than a dropdown: four options are worth showing
                 at once, and the choice changes the rest of the form. -->
            <div class="type-group" role="radiogroup" aria-labelledby="type-lbl">
              <span class="sr-only" id="type-lbl" i18n="@@qedit.answer_type">Answer type</span>
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
            <p class="hint">{{ typeHint(selectedType()) }}</p>
            @if (typeLocked()) {
              <p class="hint warn" i18n="@@qedit.type_locked">
                The answer type can't change once applicants have answered this question — their
                stored answers would no longer match it. Add a new question instead.
              </p>
            }
            <!-- Every type is scoreable since v14.0.0 (numeric by band, several
                 choices by aggregation, text by presence). The old copy here said
                 the opposite and read as a warning, which told admins their income
                 and amount questions could not move a match. -->
            @if (!isChoice(selectedType())) {
              <p class="hint" i18n="@@qedit.scoring_by_type">
                This type carries scoring weights too — a number scores by the band it falls in,
                text by whether it was answered. Set that per program in its scoring weights.
              </p>
            }

            <label class="switch-field">
              <nz-switch formControlName="isRequired" />
              <span i18n="@@qedit.required">Required</span>
            </label>
          </div>

          <div class="col">
            <!-- Per-type rules. Only the owning type's block is rendered, so the form
                 cannot express a combination the server rejects with
                 QUESTION_TYPE_RULES_INVALID. -->
            @if (selectedType() === 'NUMERIC') {
              <p class="section-lbl" i18n="@@qedit.sec_rules">Accepted values</p>
              <div formGroupName="numeric" class="rule-box">
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
                </div>
                <div class="field-row">
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
              <p class="section-lbl" i18n="@@qedit.sec_rules">Accepted values</p>
              <div formGroupName="text" class="rule-box">
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
                <!-- Options are edited here, in place. A choice question's answers are
                   the substance of it, so they belong beside the wording, not behind
                   a second trip through a drawer. -->
                <p class="section-lbl">
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
                        <span class="opt-label" [dir]="isAr ? 'rtl' : 'ltr'">{{
                          isAr ? o.labelAr : o.labelEn
                        }}</span>
                        <button
                          type="button"
                          class="icon-btn"
                          (click)="openOptionEdit(o)"
                          aria-label="Edit option"
                          i18n-aria-label="@@qedit.edit_option_aria"
                        >
                          <span nz-icon nzType="edit" nzTheme="outline"></span>
                        </button>
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
                    </li>
                  }
                  <li class="opt-row" [class.editing]="addingOption()">
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
                </ul>
              } @else {
                <p class="section-lbl" i18n="@@qedit.sec_answers">Answer options</p>
                <p class="hint" i18n="@@qedit.choice_hint_new">
                  Save the question first, then add its options here — at least two are needed
                  before it can be asked.
                </p>
              }
            }
          </div>
        </div>

        <!-- Branch rule. Sits below both columns because it is about WHEN the
             question is asked, not about what it accepts — and because the source
             list depends on this question's position, not on its type. -->
        <div formGroupName="enabledWhen" class="branch-box">
          <p class="section-lbl">
            <span i18n="@@qedit.sec_branch">When to ask this</span>
            @if (questionForm.controls.enabledWhen.controls.questionCode.value) {
              <button type="button" class="clear-branch" (click)="clearBranch()">
                <span nz-icon nzType="close" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@qedit.branch_clear">Always ask</span>
              </button>
            }
          </p>
          @if (branchSources().length === 0) {
            <p class="hint" i18n="@@qedit.branch_none">
              Nothing to branch on yet. A rule reads an answer the applicant already gave, so it
              needs an earlier question that offers a choice of options.
            </p>
          } @else {
            <!-- A div + aria-labelledby rather than a label/for pair: nz-select
                 renders a div, not an input, so a wrapping label associates with
                 nothing. Same pattern as the simulator's question select. -->
            <div class="field-row">
              <div class="field grow">
                <span class="lbl" id="branch-src-lbl" i18n="@@qedit.branch_source">Depends on</span>
                <nz-select
                  formControlName="questionCode"
                  class="select-comfy"
                  nzDropdownClassName="select-comfy-dropdown"
                  [nzOptionHeightPx]="42"
                  nzAllowClear
                  nzShowSearch
                  [nzPlaceHolder]="branchAlwaysLabel"
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
              @if (questionForm.controls.enabledWhen.controls.questionCode.value) {
                <div class="field">
                  <span class="lbl" id="branch-op-lbl" i18n="@@qedit.branch_operator">
                    Condition
                  </span>
                  <nz-select
                    formControlName="operator"
                    class="select-comfy"
                    nzDropdownClassName="select-comfy-dropdown"
                    [nzOptionHeightPx]="42"
                    [attr.aria-labelledby]="'branch-op-lbl'"
                  >
                    <nz-option [nzValue]="'equals'" [nzLabel]="branchEqualsLabel"></nz-option>
                    <nz-option
                      [nzValue]="'not_equals'"
                      [nzLabel]="branchNotEqualsLabel"
                    ></nz-option>
                  </nz-select>
                </div>
                <div class="field grow">
                  <span class="lbl" id="branch-opt-lbl" i18n="@@qedit.branch_option">
                    This answer
                  </span>
                  <nz-select
                    formControlName="optionCode"
                    class="select-comfy"
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
                </div>
              }
            </div>
            @if (branchIncomplete()) {
              <p class="hint warn" i18n="@@qedit.branch_incomplete">
                Pick which answer triggers this question. A half-set rule can't be evaluated, so it
                would save without ever hiding anything.
              </p>
            } @else if (questionForm.controls.enabledWhen.controls.questionCode.value) {
              <p class="hint" i18n="@@qedit.branch_hint">
                Asked only when that answer matches. If the source question allows several picks,
                any one of them matching is enough.
              </p>
            } @else {
              <p class="hint" i18n="@@qedit.branch_hint_off">
                Asked of every applicant in this question's categories. Pick a question above to ask
                it conditionally instead.
              </p>
            }
          }
        </div>

        @if (!editing()) {
          <p class="ins-note" i18n="@@qedit.code_note">
            A stable code is generated automatically — no need to type one.
          </p>
        }

        <!-- Sticky, so a long option list never buries the save button. Delete is
             pushed to the far edge: it belongs to this question and had nowhere else
             to go once the row menu was removed, but it must not sit next to Save. -->
        <div class="form-actions">
          @if (editingQuestion(); as eq) {
            <button
              type="button"
              nz-button
              nzType="text"
              nzDanger
              class="del-q"
              (click)="confirmDeleteQuestion(eq)"
              i18n="@@qedit.delete_question"
            >
              Delete question
            </button>
          }
          <button type="button" nz-button (click)="cancel()" i18n="@@qedit.cancel">Cancel</button>
          <button
            nz-button
            nzType="primary"
            [disabled]="questionForm.invalid"
            i18n="@@qedit.save_q"
          >
            Save question
          </button>
        </div>
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
            [disabled]="optionEn.invalid || optionAr.invalid"
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
  `,
  styles: [
    `
      :host {
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
         than the content they are. Filled + primary text: they are answers a bank
         scores on, not decoration. */
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
      /* Value types read as neutral: they carry no scoring weight, so they should
         not wear the brand accent that marks a scoreable question. */
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

      /* ---- Editor modal ------------------------------------------------- */
      /* Below nz-modal's 1000 on purpose: the delete confirmation is an nz-modal and
         has to layer ABOVE this one. */
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 900;
        background: var(--color-overlay-backdrop, rgba(16, 24, 40, 0.45));
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        animation: qe-fade var(--motion-duration-base, 180ms) var(--qe-ease);
      }
      .modal-wrap {
        position: fixed;
        inset: 0;
        z-index: 901;
        display: grid;
        place-items: center;
        padding: var(--space-6, 32px);
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .modal {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        inline-size: min(1080px, 100%);
        max-block-size: min(880px, calc(100vh - var(--space-7, 48px) * 2));
        background: var(--qe-surface);
        border-radius: var(--qe-radius);
        box-shadow: var(--shadow-xl, 0 24px 64px rgba(16, 24, 40, 0.24));
        animation: qe-rise var(--motion-duration-base, 180ms) var(--qe-ease);
      }
      .modal-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4, 16px);
        padding: var(--space-4, 16px) var(--space-5, 24px);
        border-block-end: 1px solid var(--qe-line);
      }
      .mh-lead {
        min-inline-size: 0;
      }
      .mh-eyebrow {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--qe-muted);
        font-variant-numeric: tabular-nums;
      }
      .mh-lead h2 {
        margin: 2px 0 0;
        font-family: var(--heading-font, var(--font-sans));
        font-size: var(--text-lg, 18px);
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--qe-text);
      }
      .mh-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .mh-close {
        margin-inline-start: var(--space-2, 8px);
      }
      /* Holds the form and nothing else. The SCROLL belongs to .form-cols, one
         level down, so the action bar can be a sibling of the scrollport instead
         of an overlay inside it. */
      .modal-body {
        display: grid;
        min-block-size: 0;
        overflow: hidden;
      }
      @keyframes qe-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes qe-rise {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.99);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      /* Scrolling region + action bar, as two grid ROWS. Rows cannot overlap, so
         no control can end up under the bar — which is what the previous sticky
         bar did to the Required switch at every scroll offset but the last. */
      .form {
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        min-block-size: 0;
      }
      /* The width the group rail used to occupy now goes to the editor: wording on
         one side, the answers it produces on the other, both visible at once.
         This is also the scrollport — it owns the body padding, so the last
         control in a column clears the bar by a full 24px of its own padding. */
      .form-cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--space-5, 24px);
        align-items: start;
        padding: var(--space-5, 24px);
        min-block-size: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
        min-inline-size: 0;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .field.grow {
        flex: 1;
      }
      .field-row {
        display: flex;
        gap: var(--space-3, 12px);
        align-items: flex-end;
      }
      .lbl {
        font-size: var(--text-xs, 12px);
        font-weight: 600;
        color: var(--qe-text);
      }
      .switch-field {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        font-size: 13px;
      }
      /* A flex item with an intrinsic min-width still shrinks below its track; the
         switch loses its knob before the label loses a letter. */
      .switch-field nz-switch {
        flex-shrink: 0;
      }
      .section-lbl {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--qe-muted);
      }
      .count-pill {
        min-inline-size: 24px;
        text-align: center;
        font-size: var(--text-xs, 12px);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
        color: var(--cat);
        background: color-mix(in srgb, var(--cat) 12%, transparent);
        padding: 1px 8px;
        border-radius: var(--radius-pill, 999px);
      }
      /* Its OWN grid row on the modal's bottom edge: always visible, never over
         anything. No sticky, no negative margins to cancel. */
      .form-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-2, 8px);
        padding: var(--space-3, 12px) var(--space-5, 24px);
        background: var(--qe-surface);
        border-block-start: 1px solid var(--qe-line);
        border-end-start-radius: var(--qe-radius);
        border-end-end-radius: var(--qe-radius);
      }
      .del-q {
        margin-inline-end: auto;
      }
      .ins-note {
        margin: 0;
        padding: var(--space-2, 8px) var(--space-3, 12px);
        font-size: 12px;
        color: var(--qe-muted);
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
      /* Spans both columns: "when is this asked" is a different question from
         "what does it accept", and its source list depends on position, not type. */
      .branch-box {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
        margin-block-start: var(--space-4, 16px);
        padding: var(--space-3, 12px);
        background: var(--qe-surface-muted);
        border-radius: var(--radius-md, 8px);
      }
      /* Sits at the far edge of the section label — it undoes the whole rule, so
         it must not read as part of the field row it would clear. */
      .branch-box .section-lbl {
        justify-content: space-between;
      }
      .clear-branch {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 0;
        padding: 2px 8px;
        border-radius: var(--radius-pill, 999px);
        background: transparent;
        color: var(--qe-muted);
        font: inherit;
        letter-spacing: 0;
        text-transform: none;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast, 120ms) var(--motion-easing-standard, ease),
          color var(--motion-duration-fast, 120ms) var(--motion-easing-standard, ease);
      }
      .clear-branch:hover {
        background: var(--qe-surface);
        color: var(--qe-text);
      }
      .branch-box .field-row {
        flex-wrap: wrap;
      }
      @media (prefers-reduced-motion: reduce) {
        .clear-branch {
          transition: none;
        }
      }
      .hint {
        margin: 0;
        font-size: var(--text-xs, 12px);
        line-height: var(--leading-normal, 1.5);
        color: var(--qe-muted);
      }
      .hint.warn {
        color: var(--color-warning, var(--ant-warning-color));
      }
      .hint.error {
        color: var(--color-error, var(--ant-error-color));
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
      @media (max-width: 1100px) {
        .oe-fields {
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
      @media (max-width: 1100px) {
        .form-cols {
          grid-template-columns: minmax(0, 1fr);
        }
      }
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
        .modal-wrap {
          padding: var(--space-3, 12px);
        }
        .modal {
          max-block-size: calc(100vh - var(--space-5, 24px));
        }
        .form-cols {
          padding: var(--space-4, 16px);
        }
        .form-actions {
          padding-inline: var(--space-4, 16px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .health-panel,
        .scrim,
        .modal,
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
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly injector = inject(Injector);

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

  /** Which question the editor modal is open on; null when it is closed. */
  readonly expandedId = signal<string | null>(null);
  /** True while the modal holds a blank question form. */
  readonly creating = signal(false);
  readonly editing = computed(() => this.expandedId() !== null);
  readonly modalOpen = computed(() => this.editing() || this.creating());
  readonly editingQuestion = computed<QuestionRow | null>(() => {
    const id = this.expandedId();
    return id === null ? null : (this.rows().find((q) => q.id === id) ?? null);
  });

  /** Option sub-editors inside the expanded row. */
  readonly editingOptionId = signal<string | null>(null);
  readonly addingOption = signal(false);

  // ---- Filtering -----------------------------------------------------------
  readonly searchCtrl = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.searchCtrl.valueChanges, { initialValue: '' });
  readonly typeFilter = signal<TypeFilter>('ALL');
  readonly onlyIncomplete = signal(false);

  readonly filtering = computed(
    () => this.query().trim() !== '' || this.typeFilter() !== 'ALL' || this.onlyIncomplete(),
  );

  readonly visible = computed<QuestionRow[]>(() => {
    const needle = this.query().trim().toLowerCase();
    const type = this.typeFilter();
    const incompleteOnly = this.onlyIncomplete();
    return this.rows().filter((q) => {
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
  readonly incomplete = computed(() => this.rows().filter((q) => this.needsOptions(q)));
  readonly issueCount = computed(() => this.incomplete().length + this.bindingWarnings().length);
  readonly totalOptions = computed(() => this.rows().reduce((sum, q) => sum + q.options.length, 0));

  /**
   * Reordering is only offered on the unfiltered list: in a filtered view the
   * visible sequence is not the asked sequence, so a drop would move a question
   * somewhere the admin cannot see. The modal covers the list while it is open, so
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

  private readonly firstField = viewChild<ElementRef<HTMLInputElement>>('firstField');

  readonly questionForm = new FormGroup({
    questionEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    questionAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    isRequired: new FormControl(true, { nonNullable: true }),
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
      operator: new FormControl<'equals' | 'not_equals'>('equals', { nonNullable: true }),
      optionCode: new FormControl('', { nonNullable: true }),
    }),
  });

  /** Two standalone controls rather than a group: the option editor is one row. */
  readonly optionEn = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly optionAr = new FormControl('', { nonNullable: true, validators: [Validators.required] });

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
  }

  // ---- Display helpers -----------------------------------------------------
  isChoice(type: QuestionType): boolean {
    return isChoiceQuestionType(type);
  }

  /** A choice question with fewer than two options cannot be published. */
  needsOptions(q: QuestionRow): boolean {
    return this.isChoice(q.type) && q.options.length < 2;
  }

  /** 1-based position in the ASKED order, not in the filtered view. */
  positionOf(q: QuestionRow): number {
    return this.rows().findIndex((r) => r.id === q.id) + 1;
  }

  countOfType(type: QuestionType): number {
    return this.rows().filter((q) => q.type === type).length;
  }

  previewOptions(q: QuestionRow): OptionRow[] {
    return q.options.slice(0, INLINE_OPTION_PREVIEW);
  }

  allOptionLabels(q: QuestionRow): string {
    return q.options.map((o) => (this.isAr ? o.labelAr : o.labelEn)).join(' · ');
  }

  // Placeholders and option labels for the branch pickers. Properties, not method
  // calls: `nzPlaceHolder` / `nzLabel` are plain string inputs, so a method here
  // would re-run `$localize` on every change detection pass.
  readonly branchAlwaysLabel = $localize`:@@qedit.branch_always:Always ask this`;
  readonly branchEqualsLabel = $localize`:@@qedit.branch_is:is`;
  readonly branchNotEqualsLabel = $localize`:@@qedit.branch_is_not:is not`;
  readonly branchPickOptionLabel = $localize`:@@qedit.branch_pick_option:Pick an answer`;

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
        return $localize`:@@qedit.type_single_hint:The applicant picks exactly one option. This is the only type that carries scoring weights.`;
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

  clearFilters(): void {
    this.searchCtrl.setValue('');
    this.typeFilter.set('ALL');
    this.onlyIncomplete.set(false);
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
      enabledWhen: {
        questionCode: q.enabledWhen?.questionCode ?? '',
        operator: q.enabledWhen?.operator === 'not_equals' ? 'not_equals' : 'equals',
        optionCode: q.enabledWhen?.optionCode ?? '',
      },
    } as never);
    this.expandedId.set(q.id);
    this.focusFirstField();
  }

  startCreate(): void {
    this.expandedId.set(null);
    this.resetOptionEditors();
    this.typeLocked.set(false);
    this.selectedType.set('SINGLE_SELECT');
    this.questionForm.reset({
      questionEn: '',
      questionAr: '',
      isRequired: true,
      type: 'SINGLE_SELECT',
      numeric: { minValue: '', maxValue: '', step: '', unitEn: '', unitAr: '' },
      text: { maxLength: null },
      enabledWhen: { questionCode: '', operator: 'equals', optionCode: '' },
    } as never);
    this.creating.set(true);
    this.focusFirstField();
  }

  collapse(): void {
    this.expandedId.set(null);
    this.creating.set(false);
    this.resetOptionEditors();
  }

  cancel(): void {
    this.collapse();
  }

  /** The editor opens in place, so focus has to follow it or the keyboard is stranded. */
  private focusFirstField(): void {
    afterNextRender(() => this.firstField()?.nativeElement.focus(), { injector: this.injector });
  }

  pickType(type: QuestionType): void {
    if (this.typeLocked()) return;
    this.questionForm.controls.type.setValue(type);
    this.selectedType.set(type);
  }

  // ---- Branch rule ---------------------------------------------------------
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
    return this.rows().filter(
      (q) =>
        q.isActive &&
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
   * Changing the source invalidates the option: option codes are scoped per
   * question, so a code kept from the previous source would be rejected as
   * `unknown_option`. Cleared here rather than validated later.
   */
  onBranchSourceChange(): void {
    this.questionForm.controls.enabledWhen.controls.optionCode.setValue('');
  }

  /** Drop the rule entirely — the question becomes unconditional. */
  clearBranch(): void {
    this.questionForm.controls.enabledWhen.reset({
      questionCode: '',
      operator: 'equals',
      optionCode: '',
    });
  }

  /**
   * A half-filled rule: a source picked with no option. Blocks save, because the
   * server would reject it and because a rule that cannot be evaluated is treated
   * as DANGLING at read time — it never hides its question, so it would look
   * saved while doing nothing.
   */
  branchIncomplete(): boolean {
    const { questionCode, optionCode } = this.questionForm.controls.enabledWhen.getRawValue();
    return questionCode !== '' && optionCode === '';
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
  async submitQuestion(): Promise<void> {
    if (this.questionForm.invalid || this.numericRangeInverted() || this.branchIncomplete()) return;
    const v = this.questionForm.getRawValue();
    // Send only the rule block the chosen type owns. Sending both would fail the
    // server's QUESTION_TYPE_RULES_INVALID check; sending `null` clears the other.
    const rules = {
      numeric: v.type === 'NUMERIC' ? blankToNull(v.numeric) : null,
      text: v.type === 'TEXT' ? { maxLength: v.text.maxLength ?? undefined } : null,
    };
    // An empty source code means "always ask". On UPDATE that must be sent as an
    // explicit `null` to clear a rule the question previously had; on CREATE the
    // key is simply omitted.
    const branch =
      v.enabledWhen.questionCode !== '' && v.enabledWhen.optionCode !== ''
        ? {
            questionCode: v.enabledWhen.questionCode,
            operator: v.enabledWhen.operator,
            optionCode: v.enabledWhen.optionCode,
          }
        : null;
    const id = this.expandedId();
    if (id !== null) {
      // `code` is immutable (A33) — never sent. `type` is not sent either: it is
      // locked in edit mode, because answers already reference this shape.
      // `displayOrder` is not sent: order is owned by drag / move, not this form.
      await this.api.updateQuestion(id, {
        questionEn: v.questionEn,
        questionAr: v.questionAr,
        isRequired: v.isRequired,
        enabledWhen: branch,
        ...rules,
      });
      this.message.success($localize`:@@qedit.question_saved:Question saved`);
      await this.reload();
      return;
    }
    // No groupId, no displayOrder: the server places it at the end of the pool.
    const created = await this.api.createQuestion({
      questionEn: v.questionEn,
      questionAr: v.questionAr,
      isRequired: v.isRequired,
      type: v.type,
      ...(branch ? { enabledWhen: branch } : {}),
      ...rules,
    });
    this.message.success($localize`:@@qedit.question_added:Question added`);
    await this.reload();
    // The server appends, so the new question is on the LAST page — follow it, or
    // the admin closes the editor onto a list their question is not in.
    this.revealQuestion(created.id);
    // A choice question is unpublishable until it has options, so stay on it with
    // the option editor open rather than collapsing to a row flagged "needs options".
    if (isChoiceQuestionType(created.type)) {
      const fresh = this.rows().find((q) => q.id === created.id);
      if (fresh) {
        this.openRow(fresh);
        this.startAddOption();
        return;
      }
    }
    this.collapse();
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
    const next = [...this.rows()];
    moveItemInArray(next, offset + event.previousIndex, offset + event.currentIndex);
    await this.commitOrder(next);
  }

  /**
   * Menu-driven move: the keyboard path, the only path while filtered, and the
   * only way to move a question ACROSS a page boundary.
   */
  async moveBy(q: QuestionRow, delta: number): Promise<void> {
    const current = [...this.rows()];
    const from = current.findIndex((r) => r.id === q.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= current.length) return;
    moveItemInArray(current, from, to);
    await this.commitOrder(current);
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
    this.addingOption.set(true);
  }

  openOptionEdit(o: OptionRow): void {
    this.addingOption.set(false);
    this.optionEn.setValue(o.labelEn);
    this.optionAr.setValue(o.labelAr);
    this.editingOptionId.set(o.id);
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
    if (this.optionEn.invalid || this.optionAr.invalid) return;
    const labelEn = this.optionEn.value.trim();
    const labelAr = this.optionAr.value.trim();
    const editingId = this.editingOptionId();
    if (editingId !== null) {
      await this.api.updateOption(editingId, { labelEn, labelAr });
      this.message.success($localize`:@@qedit.option_saved:Option saved`);
    } else {
      // No displayOrder: the server appends after the existing options.
      await this.api.createOption(q.id, { labelEn, labelAr });
      this.message.success($localize`:@@qedit.option_added:Option added`);
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
  }

  /** After a mutation, re-fetch. Every mutation auto-publishes server-side. */
  private async reload(): Promise<void> {
    const [tree, warnings] = await Promise.all([this.api.tree(), this.api.bindingWarnings()]);
    this.rows.set(flatten(tree ?? []));
    this.published.set(true);
    this.bindingWarnings.set(warnings ?? []);
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
