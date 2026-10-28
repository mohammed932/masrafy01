import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { CheckOutline, LockOutline, SearchOutline } from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  LOAN_CATEGORIES,
  canonicalCategories,
  categoryLabel,
  type LoanCategory,
} from '@core/loan-category';
import {
  FormPageComponent,
  LoanCategorySwitchesComponent,
  RailTabsComponent,
  WizardStepsComponent,
  type RailTabItem,
} from '@shared/ui';
import type { WizardStepItem } from '@shared/ui/wizard-steps.component';
import { toAskablePool } from '@shared/questions/to-askable';
import {
  addableQuestions,
  additionsToSave,
  coreProblems,
  gateHeldAdditions,
  lockMapFor,
  type AskableQuestion,
  type ServerLock,
} from '@shared/questions/asked-questions.rules';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import { slugify, uniqueSlug } from '@shared/lookups/slug';
import {
  QuestionnaireApiService,
  type GroupTreeRow,
} from '@features/questionnaire/questionnaire.api.service';
import { ENUM_TYPE } from './program-name-row';
import { CATALOG_BASE, newNameLanding } from './program-catalog.paths';
import {
  NEW_NAME_STEP_ORDER,
  RESERVED_NAME_KEYS,
  barBlock,
  blockReason,
  isLastStep,
  savePlan,
  stepIdAt,
  stepIndexOf,
  stepStatuses,
  type NewNameBlock,
  type NewNameDraft,
  type NewNameStepId,
} from './new-program-name';

/** One question card on step ③. */
interface QuestionCard {
  readonly id: string;
  readonly label: string;
  readonly isRequired: boolean;
  /** "Pick one", "Number"… — null for a type this screen has no word for. */
  readonly type: string | null;
  /** Asked only after a certain answer to another question. */
  readonly gated: boolean;
  readonly groupKey: string;
}

/** An "Other questions" card: tickable, for this program only. */
interface OtherCard extends QuestionCard {
  /** Ticked: asked of this program's applicants. */
  readonly checked: boolean;
  /** Another ticked question is asked after it, so it stays on until that one is unticked. */
  readonly held: boolean;
  /** What a tick brings with it, or why it can't be unticked — a line under the tags. */
  readonly note: string | null;
  /** The questions a tick brings with it — its show-when sources not asked yet. */
  readonly chainIds: readonly string[];
  readonly haystack: string;
}

/** Cards under the app page they sit on. */
interface CardGroup<T extends QuestionCard> {
  readonly key: string;
  readonly title: string;
  readonly cards: readonly T[];
}

@Component({
  selector: 'app-new-program-name-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    FormPageComponent,
    WizardStepsComponent,
    LoanCategorySwitchesComponent,
    RailTabsComponent,
    NgTemplateOutlet,
  ],
  providers: [provideNzIconsPatch([CheckOutline, LockOutline, SearchOutline])],
  template: `
    <app-form-page
      wide
      stepped
      [eyebrow]="eyebrow"
      [title]="title"
      [subtitle]="subtitle"
      [backLabel]="backLabel"
      [showPrev]="stepIndex() > 0"
      [submitLabel]="primaryLabel()"
      [submitting]="submitting()"
      [blockReason]="blockText()"
      [hint]="hint()"
      (cancelled)="leave()"
      (prev)="goToStep(stepIndex() - 1)"
      (submitted)="primary()"
    >
      <div class="body">
        <app-wizard-steps
          [steps]="steps()"
          [activeIndex]="stepIndex()"
          [ariaLabel]="stepsAria"
          [caption]="stepCaption()"
          (stepSelect)="goToStep($event)"
        />

        <form [formGroup]="form" class="stage" (ngSubmit)="primary()">
          <!-- ══ STEP ① — WHAT IT IS ════════════════════════════════════════
               The two labels. The step used to open on a second question, how the bank
               proves the income, and that question is gone rather than pre-answered: a
               surrogate program comes with its own calculation, written in code, so every
               name made here is sold against a payslip. The line under the heading says so,
               because an operator who remembers the Surrogate card should not be left to
               wonder where it went. -->
          @if (step() === 'program') {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.name_h">What is this program called?</h2>
              <p class="lede" i18n="@@pcn.payslip_only">
                Every program added here is sold against a payslip. Surrogate programs come with
                their own calculation, so they are built into the platform rather than added here.
              </p>
              <!-- One name in two locales is ONE decision, so the pair sits on one row.
                   Stacked, they read as two unrelated fields. -->
              <div class="pair">
                <label class="field">
                  <span class="field-label" i18n="@@lookups.field.labelEnglish">English label</span>
                  <input
                    nz-input
                    formControlName="labelEn"
                    dir="ltr"
                    [attr.maxlength]="nameMax"
                    [placeholder]="labelEnPlaceholder"
                  />
                </label>
                <label class="field">
                  <span class="field-label" i18n="@@lookups.field.labelAr">Arabic label</span>
                  <input
                    nz-input
                    formControlName="labelAr"
                    dir="rtl"
                    [attr.maxlength]="nameMax"
                    [placeholder]="labelArPlaceholder"
                  />
                </label>
                <label class="field sort">
                  <span class="field-label" i18n="@@lookups.field.sortOrder">Sort order</span>
                  <input nz-input type="number" formControlName="sortOrder" min="0" />
                  <span class="field-hint" i18n="@@lookups.field.sortOrderHint"
                    >controls the order in dropdowns</span
                  >
                </label>
              </div>

              <!-- DERIVED, never typed: staff curating this list had no way to judge what
                   a key should read, and a key typed by hand is immutable the moment it is
                   saved. -->
              @if (keyPreview(); as key) {
                <p class="key">
                  <span i18n="@@pcn.key_preview">Filed under</span>
                  <code dir="ltr">{{ key }}</code>
                </p>
              }
            </section>
          }

          <!-- ══ STEP ② — WHERE IT IS OFFERED ═══════════════════════════════
               Moved in from the name's own page, which is where a freshly created name
               used to be dropped to answer it. All four loan types at once: the
               assignment is ONE decision with four parts. -->
          @if (step() === 'offered') {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.offered_h">
                Which loan types is this name offered under?
              </h2>
              <p class="lede" i18n="@@pcn.offered_lede">
                A bank building a program can only pick this name under a loan type that is on here.
                The next step asks what each of those loan types' applicants answer.
              </p>
              <app-loan-category-switches [value]="offered()" (toggled)="toggleOffered($event)" />
            </section>
          }

          <!-- ══ STEP ③ — WHAT APPLICANTS ARE ASKED ═════════════════════════
               Two lists of cards, per loan type the name is offered under, and they are what
               the applicant of a program filed under this name is asked (v31.5.0): the FIXED
               questions, always, and every other question only when it is ticked here. Both are
               grouped by the app page they sit on. A tick is for this program only
               (program_name_question_addition); nothing a loan type asks of other programs
               moves. -->
          @if (step() === 'asks') {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.asks_h">What are these applicants asked?</h2>
              @if (poolError()) {
                <p class="notice" role="status" i18n="@@pcn.asks_unavailable">
                  The question pool could not be read, so this step cannot be shown. The name will
                  still be created — set what its applicants are asked on its own page afterwards.
                </p>
              } @else if (pool().length === 0) {
                <div class="loading"><nz-spin nzSimple></nz-spin></div>
              } @else {
                @if (offered().length > 1) {
                  <app-rail-tabs
                    [items]="askTabs()"
                    [activeId]="askCategory()"
                    [ariaLabel]="askTabsAria"
                    idPrefix="pcn-asks"
                    appearance="segmented"
                    (select)="selectAskTab($event)"
                  />
                }

                <!-- A question every quote needs that is switched off or missing: the
                     loan type cannot be priced, so Add program waits. Rare — they are all
                     fixed — and only Questionnaire can fix it, so it says where. -->
                @if (coreMissingHere().length > 0) {
                  <p class="notice" role="alert">
                    <span i18n="@@pcn.core_missing"
                      >This loan type can't be priced — a question every quote needs is switched
                      off:</span
                    >
                    <strong>{{ coreMissingHere().join(' · ') }}</strong>
                  </p>
                }

                <div
                  class="asks"
                  [attr.role]="offered().length > 1 ? 'tabpanel' : null"
                  [attr.id]="offered().length > 1 ? 'pcn-asks-panel-' + askCategory() : null"
                  [attr.aria-labelledby]="
                    offered().length > 1 ? 'pcn-asks-tab-' + askCategory() : null
                  "
                >
                  <!-- FIXED: a lock where the tick would be, no lock tag per card — the heading
                       says every one of them is fixed. -->
                  <section aria-labelledby="pcn-fixed-h">
                    <h3 class="sec" id="pcn-fixed-h">
                      <span i18n="@@caq.base_h">Fixed questions — always asked</span>
                      <span class="sec-n">{{ fixedCountHere() }}</span>
                    </h3>
                    <p class="hint" i18n="@@pcn.fixed_sub">
                      Always asked, on every program. To change one, open
                      <a class="link" routerLink="/questionnaire/questions">Questionnaire</a>.
                    </p>
                    <!-- Ties this tab's count to the one Questionnaire shows: the fixed list there
                         counts every loan type, and some fixed questions belong to one only. -->
                    @if (fixedElsewhereText(); as text) {
                      <p class="hint is-aside">{{ text }}</p>
                    }
                    @for (group of fixedGroups(); track group.key) {
                      <h4 class="group-h">
                        <span>{{ group.title }}</span>
                        <span class="group-n">{{ group.cards.length }}</span>
                      </h4>
                      <ul class="grid">
                        @for (card of group.cards; track card.id) {
                          <li>
                            <div class="card is-on is-locked">
                              <span class="tick" aria-hidden="true"
                                ><span nz-icon nzType="lock" nzTheme="outline"></span
                              ></span>
                              <span class="text">
                                <span class="label">{{ card.label }}</span>
                                <ng-container
                                  [ngTemplateOutlet]="cardTags"
                                  [ngTemplateOutletContext]="{ $implicit: card }"
                                />
                              </span>
                            </div>
                          </li>
                        }
                      </ul>
                    }
                  </section>

                  <section aria-labelledby="pcn-other-h">
                    <h3 class="sec" id="pcn-other-h">
                      <span i18n="@@caq.other_h">Other questions</span>
                      @if (otherHere().length > 0) {
                        <span class="sec-n">{{ otherCountLabel() }}</span>
                      }
                    </h3>
                    <p class="hint" i18n="@@pcn.other_sub">
                      Not asked unless you tick them. A tick asks it of this program's applicants
                      only.
                    </p>

                    @if (otherHere().length === 0) {
                      <p class="empty" i18n="@@pcn.other_none">
                        There are no other income-proof questions yet. Create one on
                        <a class="link" routerLink="/questionnaire/questions">Questionnaire</a> and
                        it shows up here.
                      </p>
                    } @else {
                      @if (otherHere().length > searchFrom) {
                        <div class="search" role="search">
                          <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
                          <label class="sr-only" for="pcn-other-search" i18n="@@addq.search_label"
                            >Search questions to add</label
                          >
                          <input
                            id="pcn-other-search"
                            type="search"
                            autocomplete="off"
                            [value]="askSearch()"
                            placeholder="Search by wording or answer"
                            i18n-placeholder="@@addq.search_placeholder"
                            (input)="onSearch($event)"
                          />
                        </div>
                      }
                      @if (otherGroups().length === 0) {
                        <p class="empty">
                          <span i18n="@@addq.no_match"
                            >No question matches “{{ askSearch() }}”.</span
                          >
                        </p>
                      } @else {
                        @for (group of otherGroups(); track group.key) {
                          <h4 class="group-h">
                            <span>{{ group.title }}</span>
                            <span class="group-n">{{ group.cards.length }}</span>
                          </h4>
                          <ul class="grid">
                            @for (card of group.cards; track card.id) {
                              <li>
                                <!-- A real checkbox, drawn as the card's tick: the whole card is
                                     its label, so a click anywhere ticks it. -->
                                <label
                                  class="card is-pick"
                                  [class.is-on]="card.checked"
                                  [class.is-locked]="card.held"
                                >
                                  <input
                                    type="checkbox"
                                    class="sr-only"
                                    [checked]="card.checked"
                                    [disabled]="card.held || submitting()"
                                    (change)="toggleOther(card)"
                                  />
                                  <span
                                    class="tick"
                                    [class.is-empty]="!card.checked"
                                    aria-hidden="true"
                                  >
                                    @if (card.held) {
                                      <span nz-icon nzType="lock" nzTheme="outline"></span>
                                    } @else {
                                      <span nz-icon nzType="check" nzTheme="outline"></span>
                                    }
                                  </span>
                                  <span class="text">
                                    <span class="label">{{ card.label }}</span>
                                    <ng-container
                                      [ngTemplateOutlet]="cardTags"
                                      [ngTemplateOutletContext]="{ $implicit: card }"
                                    />
                                    @if (card.note) {
                                      <span class="note">{{ card.note }}</span>
                                    }
                                  </span>
                                </label>
                              </li>
                            }
                          </ul>
                        }
                      }
                    }
                  </section>
                </div>
              }
            </section>
          }

          <ng-template #cardTags let-card>
            <span class="meta">
              @if (card.isRequired) {
                <span class="tag" i18n="@@caq.tag_required">Required</span>
              } @else {
                <span class="tag" i18n="@@caq.tag_optional">Optional</span>
              }
              @if (card.type) {
                <span class="tag is-type">{{ card.type }}</span>
              }
              @if (card.gated) {
                <span class="tag is-type" i18n="@@caq.tag_gated">Only if it applies</span>
              }
            </span>
          </ng-template>

          @if (errorMessage(); as message) {
            <div class="error" role="alert">
              <p class="error-text">{{ message }}</p>
              <!-- TWO exits, because the name already exists and only the additive half
                   failed. Trapping an operator on a create screen over a write they can
                   redo in two clicks on another one is the worse answer, and the button
                   beside this one is already a retry. -->
              @if (createdName() !== null) {
                <button
                  type="button"
                  class="error-out"
                  (click)="openCreated()"
                  i18n="@@pcn.skip_open"
                >
                  Skip — open the program
                </button>
              }
            </div>
          }
        </form>
      </div>
    </app-form-page>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .stage {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .step {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        animation: step-in var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes step-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .step-h {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
      }
      /* SECONDARY, not tertiary: these sentences are read every time, and tertiary lands
         under 4.5:1 at this size. */
      .lede {
        margin: 0;
        max-inline-size: 62ch;
        text-wrap: pretty;
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
      }
      /* The steps run the full page — the loan-type switches and the question board are
         the point of the width. A ROW OF TEXT FIELDS is not: stretched across 1440px it
         puts a label and its value at opposite ends of the screen, so the measure cap
         lives here, on the fields, rather than on the step that holds them. */
      .pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-4);
        align-items: start;
        max-inline-size: 62rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      /* A sort order is one or two digits; a full-width box for it made the least
         important field on the form the widest thing on it. */
      .field.sort {
        max-inline-size: 240px;
      }
      .field-label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }
      .field-hint {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .key {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .key code {
        /* Browsers give <code> a smaller monospace default, which rendered the key at
           10.8px beside a 12px label. Hold it to the line it sits on. */
        font-size: 1em;
        padding: 2px var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--bg-muted);
        font-family: var(--font-mono);
        color: var(--color-text-primary);
      }

      /* Sentences, not cards — they keep the reading measure the step gave up. */
      .notice,
      .error {
        max-inline-size: 62rem;
      }
      .notice {
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border: 1px solid color-mix(in srgb, var(--color-warning) 32%, transparent);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--color-warning) 8%, transparent);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--color-text-primary);
      }
      .error {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-error);
        font-size: var(--text-sm);
      }
      .error-text {
        margin: 0;
      }
      .error-out {
        min-block-size: 44px;
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        font-weight: var(--font-weight-semibold);
        text-decoration: underline;
        cursor: pointer;
      }
      .error-out:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }

      /* ── Step ③ ─────────────────────────────────────────────────────────── */
      .loading {
        display: grid;
        place-items: center;
        min-block-size: 160px;
      }
      .asks {
        display: flex;
        flex-direction: column;
        gap: var(--space-7);
      }
      .sec {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-1);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .sec-n {
        padding: 1px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
        letter-spacing: 0;
        text-transform: none;
        font-variant-numeric: tabular-nums;
      }
      .hint {
        margin: 0 0 var(--space-4);
        max-inline-size: 62ch;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        text-wrap: pretty;
      }
      /* Two hint lines read as one note: the gap goes under the second. */
      .hint:has(+ .hint.is-aside) {
        margin-block-end: var(--space-1);
      }
      /* The app page a run of cards sits on — what makes 17 cards read as two short lists. */
      .group-h {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: var(--space-4) 0 var(--space-2);
        color: var(--text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
      }
      .group-h:first-of-type {
        margin-block-start: 0;
      }
      .group-n {
        color: var(--text-tertiary);
        font-weight: var(--font-weight-regular);
        font-variant-numeric: tabular-nums;
      }
      .link {
        color: var(--color-text-link);
        font-weight: var(--font-weight-medium);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .link:hover {
        color: var(--color-text-link-hover);
      }
      .link:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }
      .empty {
        margin: 0;
        padding: var(--space-4);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
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
      .search {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        max-inline-size: 28rem;
        block-size: var(--size-field);
        margin-block-end: var(--space-2);
        padding-inline: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-secondary);
      }
      .search:focus-within {
        border-color: var(--primary);
      }
      .search input {
        flex: 1;
        min-inline-size: 0;
        border: 0;
        outline: 0;
        background: none;
        color: var(--text-primary);
        font: inherit;
        font-size: var(--text-sm);
      }

      /* Two columns of cards; one on a narrow screen. */
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .grid > li {
        display: flex;
      }
      .card {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: var(--space-2-5);
        inline-size: 100%;
        margin: 0;
        padding: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        color: var(--text-primary);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card.is-on {
        border-color: color-mix(in srgb, var(--primary) 45%, var(--border-default));
        background: color-mix(in srgb, var(--primary) 6%, var(--bg-surface));
      }
      .card.is-pick {
        cursor: pointer;
      }
      .card.is-pick:hover:not(.is-locked) {
        border-color: var(--primary);
      }
      .card.is-pick.is-locked {
        cursor: not-allowed;
      }
      .card.is-pick:has(input:focus-visible) {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .tick {
        display: grid;
        place-items: center;
        flex: none;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        margin-block-start: 1px;
        border-radius: var(--radius-sm);
        background: var(--primary);
        color: var(--text-inverse);
        font-size: var(--text-xs);
      }
      .tick.is-empty {
        background: transparent;
        color: transparent;
        box-shadow: inset 0 0 0 1.5px var(--border-strong);
      }
      .card.is-locked .tick {
        background: var(--text-secondary);
        color: var(--text-inverse);
      }
      .text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1-5);
        min-inline-size: 0;
      }
      .label {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        line-height: var(--leading-snug);
        overflow-wrap: anywhere;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .tag {
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        white-space: nowrap;
      }
      .tag.is-type {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--border-default);
      }
      .note {
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
        color: var(--text-secondary);
      }
      @media (max-width: 720px) {
        .grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      @media (hover: none) {
        .card {
          min-block-size: 44px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .step {
          animation: none;
        }
        .card {
          transition: none;
        }
      }
    `,
  ],
})
export class NewProgramNamePage {
  private readonly lookups = inject(LookupsApiService);
  private readonly questionnaire = inject(QuestionnaireApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /** Program names must fit `bank_program.friendlyName`. */
  protected readonly nameMax = 120;

  protected readonly form = new FormGroup({
    labelEn: new FormControl<string>('', { nonNullable: true }),
    labelAr: new FormControl<string>('', { nonNullable: true }),
    sortOrder: new FormControl<number>(0, { nonNullable: true }),
  });

  /**
   * The form as a signal, so the rail, the block reason and the summary all recompute from
   * one source. No `Validators` anywhere on this form: what makes it savable is
   * `blockReason(draft)`, which is a pure recomputation on every change — the drawer this
   * replaces attached `Validators.required` from inside a click handler, so a state the
   * operator never clicked through stayed savable and was refused by the server instead.
   */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** The loan types the name will be offered under, written in the same insert as the row. */
  protected readonly offered = signal<readonly LoanCategory[]>([]);

  /** The global question pool, read on first arrival at the offer step and not before. */
  protected readonly pool = signal<readonly AskableQuestion[]>([]);
  /** The same read as sections — what the fixed list is drawn from, page by page. */
  private readonly tree = signal<readonly GroupTreeRow[]>([]);
  protected readonly poolError = signal(false);
  private poolRequested = false;
  protected readonly askSearch = signal('');
  private readonly askTab = signal<LoanCategory | null>(null);
  /**
   * Codes no name may add — the engine's own inputs and the fixed set; a new name has no
   * programme yet. As sent: read per loan type through `lockMapFor`.
   */
  protected readonly locks = signal<readonly ServerLock[]>([]);
  /**
   * What the operator ticked under "Other questions", per loan type: the questions THIS name asks
   * on top of the fixed ones. Written after the name exists; no other name is touched.
   */
  private readonly added = signal<ReadonlyMap<LoanCategory, ReadonlySet<string>>>(
    new Map<LoanCategory, ReadonlySet<string>>(),
  );
  protected readonly addedHere = computed<ReadonlySet<string>>(
    () => this.added().get(this.askCategory()) ?? new Set<string>(),
  );
  /** How many questions the name will add across the loan types it is offered under. */
  private readonly addedCount = computed(() =>
    this.offered().reduce(
      (n, category) =>
        n + additionsToSave(this.pool(), this.added().get(category) ?? new Set<string>()).length,
      0,
    ),
  );

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /**
   * The name, once the FIRST write has landed.
   *
   * The recovery signal for a two-write finish, and it is the whole reason a retry is safe:
   * the key is minted with a collision suffix, so re-running write 1 after it succeeded would
   * create `doctors_2` rather than retrying. This flow carried the same guard once before,
   * for a product-then-name pair, and lost it when the second write went away.
   */
  protected readonly createdName = signal<{ id: string; key: string } | null>(null);

  protected readonly stepId = signal<NewNameStepId>('program');

  protected readonly eyebrow = $localize`:@@pcn.eyebrow:Program catalog`;
  protected readonly title = $localize`:@@program_catalog.dialog.add:Add program`;
  protected readonly subtitle = $localize`:@@pcn.subtitle3:A catalog name banks file their programs under. Three answers: what it is, which loan types sell it, and what those applicants are asked.`;
  protected readonly backLabel = $localize`:@@pcn.back:Back to the catalog`;
  protected readonly submitLabel = $localize`:@@program_catalog.dialog.add_cta:Add program`;
  protected readonly retryLabel = $localize`:@@pcn.retry_questions:Try the questions again`;
  protected readonly nextLabel = $localize`:@@pcn.next:Next`;
  protected readonly stepsAria = $localize`:@@pcn.steps_aria:Adding a program name`;
  protected readonly labelEnPlaceholder = $localize`:@@pcn.eg_en:e.g. Doctors — Practice`;
  protected readonly labelArPlaceholder = $localize`:@@pcn.eg_ar:مثال: أطباء — عيادة`;

  constructor() {
    this.stepId.set(this.initialStep());
  }

  // --- the draft -------------------------------------------------------------

  protected readonly draft = computed<NewNameDraft>(() => {
    const v = this.formValue();
    return {
      labelEn: v.labelEn ?? '',
      labelAr: v.labelAr ?? '',
      offered: this.offered(),
      coreMissing: this.coreMissing().reduce((n, p) => n + p.missing.length, 0),
    };
  });

  /**
   * A question every quote needs that is switched off or out of the loan type, per loan type
   * on. No ticks are passed: those questions are fixed, so nothing ticked here can fix one.
   */
  private readonly coreMissing = computed(() =>
    coreProblems(this.pool(), this.offered(), new Map(), this.isAr),
  );

  /** The same, for the loan type on screen — named, so the notice says which. */
  protected readonly coreMissingHere = computed<readonly string[]>(
    () =>
      this.coreMissing()
        .find((p) => p.category === this.askCategory())
        ?.missing.map((c) => c.label) ?? [],
  );

  protected readonly keyPreview = computed<string | null>(() => {
    const key = slugify(this.formValue().labelEn ?? '');
    return key === '' ? null : key;
  });

  /** The steps every name walks — the same three, whatever it is called. */
  protected readonly stepIds = NEW_NAME_STEP_ORDER;

  /** The id the operator is standing on. The list never reshapes, so there is nothing to guard. */
  protected readonly step = this.stepId.asReadonly();

  protected readonly stepIndex = computed(() => stepIndexOf(this.stepIds, this.step()));

  private readonly stepLabels: Readonly<Record<NewNameStepId, string>> = {
    program: $localize`:@@pcn.step_program:What it is`,
    offered: $localize`:@@pcn.step_offered:Where it is offered`,
    asks: $localize`:@@pcn.step_asks:What applicants are asked`,
  };

  protected readonly steps = computed<WizardStepItem[]>(() => {
    const statuses = stepStatuses(this.draft());
    return this.stepIds.map((id) => ({
      id,
      label: this.stepLabels[id],
      status: statuses[id].status,
      disabled: statuses[id].disabled,
    }));
  });

  protected stepCaption(): string {
    switch (this.step()) {
      case 'program':
        return $localize`:@@pcn.cap_program2:The name can be changed later, from its card in the catalog.`;
      case 'offered':
        return $localize`:@@pcn.cap_offered:${this.offered().length}:ON: of 4 loan types are on. This is what a bank's program picker filters on.`;
      case 'asks':
        return $localize`:@@pcn.cap_asks2:Fixed questions are set on Questionnaire. A tick here asks a question of this program only.`;
    }
  }

  protected readonly isLast = computed(() => isLastStep(this.stepIds, this.step()));

  /**
   * The bar's primary, which is the CURRENT STEP's action rather than a create button that
   * spends most of the flow greyed out.
   *
   * A create-only primary made step ① a dead end: answer it and the only enabled control left
   * in the footer was Cancel, so moving on meant knowing to click the rail.
   *
   * Once the name EXISTS the button stops being a create at all — the only thing left is the
   * question write, which is what failed. Saying "Add program" there would offer to make a
   * second one.
   */
  protected readonly primaryLabel = computed(() => {
    if (this.createdName() !== null) return this.retryLabel;
    return this.isLast() ? this.submitLabel : this.nextLabel;
  });

  protected primary(): void {
    if (this.isLast()) {
      // Guarded by `doSave` itself: on this step the bar reports the WHOLE draft's refusal,
      // so an unfinished draft leaves the button disabled rather than saving.
      this.save();
      return;
    }
    this.goToStep(this.stepIndex() + 1);
  }

  /**
   * The refusal, in words: why THIS step cannot be left, or — once everything is answered —
   * nothing, so the hint takes over and says what Save will do.
   *
   * The rule is `barBlock`'s; the wording is this screen's. `blockReason` still guards the
   * write itself in `doSave`, so a step-scoped message can never widen what is savable.
   *
   * SILENT once the name exists. `barBlock` on the last step reports the whole draft, which
   * would keep naming form refusals for a name that has already been created — and would
   * re-block the retry the moment the operator touched a field between attempts.
   */
  protected blockText(): string | null {
    if (this.createdName() !== null) return null;
    const reason: NewNameBlock = barBlock(this.draft(), this.step(), this.stepIds);
    switch (reason) {
      case 'labels':
        return $localize`:@@pcn.block_name:Give it a name in both languages.`;
      case 'labels_key':
        return $localize`:@@pcn.block_name_latin:The English name needs at least one letter or digit — it becomes the key.`;
      case 'core':
        return $localize`:@@pcn.block_core2:A loan type can't be priced — turn its switched-off question back on in Questionnaire.`;
      case 'offered':
        return $localize`:@@pcn.block_offered:Turn on at least one loan type — a name offered under none can be picked by no bank.`;
      default:
        return null;
    }
  }

  /** What Save will do, said before it is clicked rather than discovered afterwards. */
  protected hint(): string | null {
    // Keyed on the step, like the button it sits beside: a step whose primary MOVES says where
    // it moves to, and the summary of what will be written belongs on the step that writes it.
    if (!this.isLast()) {
      const next = this.stepIds[this.stepIndex() + 1];
      return next === undefined
        ? null
        : $localize`:@@pcn.next_hint:Next: ${this.stepLabels[next]}:STEP:`;
    }
    if (this.createdName() !== null) {
      return $localize`:@@pcn.made_not_asked:The name is created and offered. Only the questions are left — retry, or open the program and finish there.`;
    }
    const name = this.formValue().labelEn ?? '';
    const own = this.addedCount();
    // One string per count rather than "question(s)". The parenthesised plural is the one
    // form that is wrong in BOTH languages at once — and in Arabic it is not even a form,
    // since the noun changes rather than taking a suffix.
    if (own === 0) {
      return $localize`:@@pcn.summary_plain:Creates “${name}:NAME:”, offered under ${this.offered().length}:COUNT: of 4 loan types. Nothing else changes.`;
    }
    // Additions touch this name alone, so "nothing else changes" still holds for them — the
    // sentence says whose applicants are asked more, which is the whole difference.
    if (own === 1) {
      return $localize`:@@pcn.summary_added_one:Creates “${name}:NAME:” and asks its own applicants one more question. No other program changes.`;
    }
    return $localize`:@@pcn.summary_added:Creates “${name}:NAME:” and asks its own applicants ${own}:COUNT: more questions. No other program changes.`;
  }

  // --- the questions step ----------------------------------------------------

  /**
   * Which tab is on stage, CLAMPED to a loan type the name is actually offered under.
   *
   * Derived rather than stored, because the offer set can move under it: un-tick the loan
   * type whose tab is open on the step before, and a stored value would point the board at a
   * category the name is no longer sold under — which the rail does not draw, so the panel
   * would render a list belonging to no visible tab.
   */
  protected readonly askCategory = computed<LoanCategory>(() => {
    const on = this.offered();
    const picked = this.askTab();
    if (picked !== null && on.includes(picked)) return picked;
    return on[0] ?? 'personal';
  });

  protected readonly askTabsAria = $localize`:@@pnd.asks_tabs_aria:Loan type`;

  protected selectAskTab(id: string): void {
    const category = LOAN_CATEGORIES.find((c) => c === id);
    if (category !== undefined) this.askTab.set(category);
  }

  /** One tab per loan type the name is offered under, counting what its applicants are asked. */
  protected readonly askTabs = computed<RailTabItem[]>(() => {
    const on = this.offered();
    return LOAN_CATEGORIES.filter((c) => on.includes(c)).map((c) => {
      const count =
        this.fixedFor(c).length +
        additionsToSave(this.pool(), this.added().get(c) ?? new Set()).length;
      return { id: c, label: categoryLabel(c), count, countLabel: this.questionsLabel(count) };
    });
  });

  protected toggleOffered(category: LoanCategory): void {
    const on = this.offered();
    this.offered.set(on.includes(category) ? on.filter((c) => c !== category) : [...on, category]);
    // The pool backs the NEXT step, and reading it here rather than on arrival means the
    // step is already populated when the operator gets to it. Once only — a second visit
    // must not discard ticks by re-reading over them.
    void this.loadPool();
  }

  // --- step ③ · the fixed list -----------------------------------------------

  /**
   * The fixed questions one loan type asks — on every program, so on this one. Every name made
   * here is sold against a payslip, so the income-proof ones count as well as the every-name ones.
   */
  private fixedFor(category: LoanCategory): readonly AskableQuestion[] {
    return this.pool().filter(
      (q) => q.isActive && q.fixed === true && q.categories.includes(category),
    );
  }

  private readonly fixedHere = computed(() => this.fixedFor(this.askCategory()));

  protected readonly fixedCountHere = computed(() => this.fixedHere().length);

  /**
   * "Personal Loan asks 17 of the 23 fixed questions — the other 6 are for Auto Loan only." The
   * Questionnaire tab counts the fixed questions of every loan type; a fixed question keeps its
   * loan types, so a car one is never asked on a personal loan. Null when this tab has them all.
   */
  protected readonly fixedElsewhereText = computed<string | null>(() => {
    const category = this.askCategory();
    const all = this.pool().filter((q) => q.isActive && q.fixed === true);
    const others = all.filter((q) => !q.categories.includes(category));
    if (others.length === 0) return null;
    const type = categoryLabel(category);
    const here = all.length - others.length;
    const total = all.length;
    const types = canonicalCategories(others.flatMap((q) => [...q.categories]))
      .map((c) => categoryLabel(c))
      .join(', ');
    return others.length === 1
      ? $localize`:@@pcn.fixed_elsewhere_one:${type}:TYPE: asks ${here}:HERE: of the ${total}:TOTAL: fixed questions — the other one is for ${types}:TYPES: only.`
      : $localize`:@@pcn.fixed_elsewhere:${type}:TYPE: asks ${here}:HERE: of the ${total}:TOTAL: fixed questions — the other ${others.length}:N: are for ${types}:TYPES: only.`;
  });

  /**
   * The fixed cards under the app page each sits on, pages in the app's order and each question
   * at its place in this loan type (`categoryOrder`) — the order the applicant meets them.
   */
  protected readonly fixedGroups = computed<readonly CardGroup<QuestionCard>[]>(() => {
    const category = this.askCategory();
    const order = new Map<string, number>();
    for (const g of this.tree()) {
      for (const q of g.questions) order.set(q.id, q.categoryOrder?.[category] ?? q.displayOrder);
    }
    const cards = [...this.fixedHere()]
      .sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0))
      .map((q) => this.cardOf(q));
    return this.groupByPage(cards);
  });

  // --- step ③ · the other questions ------------------------------------------

  /** A search box only once the list is long enough to need one. */
  protected readonly searchFrom = 8;

  /**
   * Every other income-proof question, ticked or not — the same rule the program's own page
   * offers in its Add sheet (`addableQuestions`), with the fixed set as what is asked already.
   */
  protected readonly otherHere = computed<readonly OtherCard[]>(() => {
    const category = this.askCategory();
    const added = this.addedHere();
    const held = gateHeldAdditions(this.pool(), added);
    return addableQuestions(
      this.pool(),
      new Set(this.fixedHere().map((q) => q.code)),
      lockMapFor(this.locks(), category),
      new Set(['payslip'] as const),
    ).map(({ question: q, chain }) => {
      const isHeld = held.has(q.id);
      const checked = added.has(q.id);
      const note = isHeld
        ? $localize`:@@pcn.other_held:A question you ticked needs it`
        : !checked && chain.length > 0
          ? $localize`:@@addq.also:Also asks first: ${chain.map((c) => this.labelOf(c)).join(' · ')}:QUESTIONS:`
          : null;
      return {
        ...this.cardOf(q),
        checked,
        held: isHeld,
        note,
        chainIds: chain.map((c) => c.id),
        haystack: q.haystack,
      };
    });
  });

  /** The other cards under their pages, narrowed by the search. */
  protected readonly otherGroups = computed<readonly CardGroup<OtherCard>[]>(() => {
    const needle = this.askSearch().trim().toLowerCase();
    const cards =
      needle === ''
        ? this.otherHere()
        : this.otherHere().filter((c) => c.haystack.includes(needle));
    return this.groupByPage(cards);
  });

  protected otherCountLabel(): string {
    const on = this.otherHere().filter((r) => r.checked).length;
    return $localize`:@@pcn.other_count:${on}:ON: of ${this.otherHere().length}:TOTAL: ticked`;
  }

  protected onSearch(event: Event): void {
    this.askSearch.set((event.target as HTMLInputElement).value);
  }

  /**
   * Tick or untick one question for this program, in the loan type on screen. A tick brings the
   * questions it is asked after (its show-when chain); a question another tick needs stays on
   * until that one is unticked. No confirmation: the name does not exist yet, so no application
   * is in flight to be made to answer it.
   */
  protected toggleOther(card: OtherCard): void {
    const category = this.askCategory();
    const set = new Set(this.added().get(category) ?? []);
    if (card.checked) {
      if (card.held) return;
      set.delete(card.id);
    } else {
      set.add(card.id);
      for (const id of card.chainIds) set.add(id);
    }
    const next = new Map(this.added());
    next.set(category, set);
    this.added.set(next);
  }

  private cardOf(q: AskableQuestion): QuestionCard {
    return {
      id: q.id,
      label: this.labelOf(q),
      isRequired: q.isRequired,
      type: this.typeLabel(q.type),
      gated: q.gateSourceCode !== null,
      groupKey: q.groupKey ?? '',
    };
  }

  /** Cards in the app's page order, the order inside each page kept as given. */
  private groupByPage<T extends QuestionCard>(cards: readonly T[]): CardGroup<T>[] {
    return this.tree()
      .filter((g) => g.isActive)
      .map((g) => ({
        key: g.id,
        title: (this.isAr ? g.titleAr : g.titleEn) || g.titleEn,
        cards: cards.filter((c) => c.groupKey === g.id),
      }))
      .filter((g) => g.cards.length > 0);
  }

  private typeLabel(type: string | undefined): string | null {
    switch (type) {
      case 'SINGLE_SELECT':
        return $localize`:@@askq.type_single:Pick one`;
      case 'MULTI_SELECT':
        return $localize`:@@askq.type_multi:Pick several`;
      case 'NUMERIC':
        return $localize`:@@askq.type_number:Number`;
      case 'TEXT':
        return $localize`:@@askq.type_text:Text`;
      default:
        return null;
    }
  }

  private labelOf(q: AskableQuestion): string {
    return (this.isAr ? q.labelAr : q.labelEn) || q.code;
  }

  private questionsLabel(n: number): string {
    return n === 1
      ? $localize`:@@srvp.count_one:1 question`
      : $localize`:@@srvp.count_many:${n}:N: questions`;
  }

  // --- navigation ------------------------------------------------------------

  /**
   * Step index mirrors to `?step=`, the house convention: the signal is truth, the URL
   * follows with `replaceUrl` so flipping steps does not fill the back button, and the
   * initial value is read from the snapshot so a reload lands where the operator was.
   */
  protected goToStep(index: number): void {
    const id = stepIdAt(this.stepIds, index);
    this.stepId.set(id);
    if (id === 'offered' || id === 'asks') void this.loadPool();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: stepIndexOf(this.stepIds, id) + 1 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Back to the Income proof side of the board — the side every name made here is listed on. */
  protected leave(): void {
    void this.router.navigate([CATALOG_BASE], { queryParams: { basis: 'payslip' } });
  }

  /**
   * `?step=` on arrival, clamped into range so a pasted number always names a step on the rail.
   *
   * With no `?step=` the screen opens on `program`. A `?basis=` left on an old link is ignored
   * — there is one basis. The draft is never restored, so a deep link can only move the
   * operator, never answer for them: every step's own refusal still stands between it and Save.
   */
  private initialStep(): NewNameStepId {
    const raw = Number(this.route.snapshot.queryParamMap.get('step'));
    if (!Number.isFinite(raw) || raw <= 0) return 'program';
    return stepIdAt(this.stepIds, raw - 1);
  }

  // --- save ------------------------------------------------------------------

  /** Fire-and-forget for the template: Angular's parser has no `void` operator. */
  protected save(): void {
    void this.doSave();
  }

  /**
   * The name first, then its ticked questions per loan type — they need the name to exist.
   *
   * Nothing global is written: a tick is this program's own addition, so no other program and no
   * loan type's list moves. The additions are replace-writes, so a retry after the name landed
   * re-sends the same sets and changes nothing twice.
   */
  private async doSave(): Promise<void> {
    if (this.submitting()) return;
    if (this.createdName() === null && blockReason(this.draft()) !== null) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      if (this.createdName() === null) {
        const plan = savePlan(this.draft());
        const v = this.form.getRawValue();

        const name = await this.lookups.create({
          type: ENUM_TYPE,
          key: await this.uniqueKey(v.labelEn),
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          sortOrder: v.sortOrder,
          // Always payslip, and stated rather than defaulted: the server writes it as each
          // category row's own basis flags. No `surrogateProductKey` — see `savePlan`.
          incomeBases: [...plan.incomeBases],
          // In the SAME atomic insert as the row. The name is born offered rather than
          // parked, which is what the whole second step is for.
          categories: [...plan.categories],
        });
        this.createdName.set({ id: name.id, key: name.key });
      }

      const made = this.createdName();
      if (made !== null) {
        // A loan type un-offered on step 2 after its ticks contributes nothing.
        for (const category of this.offered()) {
          const ids = additionsToSave(this.pool(), this.added().get(category) ?? new Set<string>());
          if (ids.length > 0) {
            await this.lookups.setProgramNameQuestionAdditions(made.key, category, ids);
          }
        }
      }

      const landing = newNameLanding(this.createdName()?.key ?? '');
      void this.router.navigate(landing.commands, { queryParams: landing.queryParams });
    } catch (err) {
      const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
        ?.error;
      this.errorMessage.set(
        this.errors.toLocalizedMessage(
          (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
          envelope?.meta,
        ),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  /** Leave the half-finished flow for the name that DOES exist, rather than being trapped. */
  protected openCreated(): void {
    const made = this.createdName();
    if (made === null) return;
    const landing = newNameLanding(made.key);
    void this.router.navigate(landing.commands, { queryParams: landing.queryParams });
  }

  /**
   * The key for the NAME, avoiding both the taken ones and the two the router would eat.
   *
   * Two values may legitimately share an English label, and the key is not typeable — so a
   * raw ENUMERATION_KEY_DUPLICATE here would name a field the operator never saw. The server
   * still enforces the unique; this only keeps the ordinary case from surfacing as an
   * unactionable error.
   *
   * `/program-catalog/new` and `/program-catalog/products` are literal segments declared
   * before the single-segment `:key`, so a name keyed `new` would be saved, listed, and
   * impossible to open.
   */
  private async uniqueKey(label: string): Promise<string> {
    try {
      const rows = await this.lookups.list(ENUM_TYPE);
      return uniqueSlug(label, new Set([...rows.map((r) => r.key), ...RESERVED_NAME_KEYS]));
    } catch {
      // The list read is a courtesy — the server enforces the unique either way, and refusing
      // to save because a GET failed would be the worse answer.
      return uniqueSlug(label, RESERVED_NAME_KEYS);
    }
  }

  /**
   * The global question pool, read ONCE and only once the operator is heading for it.
   *
   * Not in the constructor: it is the whole pool with every answer, and the first step
   * neither shows nor needs it. Not re-read on a second visit either —
   * the ticks made in between live in this page's own signals, and a re-read would draw the
   * board again as though they had not happened.
   */
  private async loadPool(): Promise<void> {
    if (this.poolRequested) return;
    this.poolRequested = true;
    try {
      const [tree, scope] = await Promise.all([
        this.questionnaire.tree(),
        this.lookups.programNameQuestionScope(null),
      ]);
      this.tree.set(tree);
      this.pool.set(toAskablePool(tree));
      this.locks.set(scope.locks);
      this.poolError.set(false);
    } catch {
      this.poolError.set(true);
      this.tree.set([]);
      this.pool.set([]);
    }
  }
}
