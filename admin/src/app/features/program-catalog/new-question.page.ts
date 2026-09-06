import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  CheckOutline,
  CloseCircleOutline,
  DeleteOutline,
  DownOutline,
  ExclamationCircleOutline,
  HolderOutline,
  InfoCircleOutline,
  PlusOutline,
} from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import {
  LOAN_CATEGORIES,
  categoryLabel,
  isLoanCategory,
  type LoanCategory,
} from '@core/loan-category';
import { FormPageComponent } from '@shared/ui';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import { ENUM_TYPE, absorbProgramNames } from './program-name-row';
import {
  QuestionnaireApiService,
  type CreateQuestionWithOptionsBody,
  type GroupTreeRow,
  type QuestionType,
} from '@features/questionnaire/questionnaire.api.service';

/**
 * Author a brand-new question WITHOUT leaving the catalog name you are configuring.
 *
 * Under Principle V / A33 there is exactly one legal shape for a new question, and
 * it is not a second pool: it is created in the ONE global pool and assigned to the
 * loan categories that ask it.
 *
 * The consequence the operator MUST see before saving is exactly that: the question
 * is global, so every applicant in the chosen loan types is asked it, not only the
 * ones who reach this name. That sentence is rendered under the category tiles
 * rather than buried in a tooltip, because it is the one thing this screen's framing
 * ("Doctor Loans → a new question") invites people to get wrong.
 *
 * This screen used to end with a tick that added the question to the catalog name's
 * "what it scores on" list. Approval scoring is gone from the platform and that list
 * with it, so the tick — and the router-state hand-off that carried it back — went
 * too. The question is still created; nothing is attached to the name.
 *
 * One request, not N. The answers ride along on `createQuestionWithOptions`:
 * the split path publishes a questionnaire version per call, and every
 * intermediate version is live on GET /v1/questionnaire — briefly asking a
 * choice question that has one answer.
 */

/** Ordered as the tiles render: the two choice types first, then the value types. */
const TYPES: readonly QuestionType[] = ['SINGLE_SELECT', 'MULTI_SELECT', 'NUMERIC', 'TEXT'];

/** Mirrors the backend MIN_CHOICE_OPTIONS — a choice with one answer is not a choice. */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 50;
const LABEL_MAX = 500;
const OPTION_LABEL_MAX = 200;
const UNIT_MAX = 24;
const TEXT_LENGTH_DEFAULT = 500;
const TEXT_LENGTH_CEILING = 2000;

/**
 * Mirrors `backend/src/questionnaire/slug.util.ts`. Kept in step by hand rather
 * than shared, because the preview is a courtesy and the server's answer is the
 * one that gets stored — the success line reports what came back, not this.
 */
function slugify(label: string): string {
  const base = label
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base.length > 0 ? base.slice(0, 60) : 'item';
}

function uniqueSlug(label: string, existing: ReadonlySet<string>): string {
  const base = slugify(label);
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`.slice(0, 64);
    if (!existing.has(candidate)) return candidate;
  }
  return base;
}

/** A decimal string the backend's IsDecimalString({ scale: 2, min: 0 }) accepts. */
const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

type OptionGroup = FormGroup<{
  labelEn: FormControl<string>;
  labelAr: FormControl<string>;
}>;

@Component({
  selector: 'app-new-question-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDropList,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzToolTipModule,
    MoneyInputDirective,
    FormPageComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowDownOutline,
      ArrowUpOutline,
      CheckOutline,
      CloseCircleOutline,
      DeleteOutline,
      DownOutline,
      ExclamationCircleOutline,
      HolderOutline,
      InfoCircleOutline,
      PlusOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-page
      [eyebrow]="eyebrow"
      [title]="pageTitle"
      [subtitle]="nameLabel() ? subtitleFor(nameLabel()) : null"
      [hint]="summary()"
      [blockReason]="blockReason()"
      [submitLabel]="submitLabel"
      [submitting]="submitting()"
      (cancelled)="cancel()"
      (submitted)="save()"
    >
      <form [formGroup]="form" class="form" (ngSubmit)="save()">
        <!-- TYPE first, not the wording: the choice below rewrites the rest of
               the form, and asking it after the text would move the ground under
               something already typed. -->
        <section class="block">
          <h3 class="block-title" id="nqd-type-h" i18n="@@pnq.type_h">
            What kind of answer do you want back?
          </h3>
          <div class="types" role="radiogroup" aria-labelledby="nqd-type-h">
            @for (t of types; track t) {
              <button
                type="button"
                class="tile type"
                role="radio"
                [attr.data-type]="t"
                [attr.aria-checked]="type() === t"
                [class.is-on]="type() === t"
                [tabindex]="type() === t ? 0 : -1"
                (click)="pickType(t)"
                (keydown)="onTypeKey($event, t)"
              >
                <span class="type-glyph" aria-hidden="true">
                  @switch (t) {
                    @case ('SINGLE_SELECT') {
                      <span class="g-radio"></span>
                    }
                    @case ('MULTI_SELECT') {
                      <span class="g-checks"><i></i><i></i></span>
                    }
                    @case ('NUMERIC') {
                      <span class="g-num numeric">12</span>
                    }
                    @default {
                      <span class="g-text"><i></i><i></i><i></i></span>
                    }
                  }
                </span>
                <span class="tile-text">
                  <span class="tile-title">{{ typeLabel(t) }}</span>
                  <span class="tile-hint">{{ typeHint(t) }}</span>
                </span>
              </button>
            }
          </div>
        </section>

        <section class="block">
          <h3 class="block-title" i18n="@@pnq.wording_h">How is it worded?</h3>
          <div class="pair">
            <label class="field">
              <span class="field-label" i18n="@@pnq.q_en">Question — English</span>
              <input
                nz-input
                dir="ltr"
                formControlName="questionEn"
                [attr.maxlength]="labelMax"
                placeholder="How old is the company?"
                i18n-placeholder="@@pnq.q_en_ph"
              />
            </label>
            <label class="field">
              <span class="field-label" i18n="@@pnq.q_ar">Question — Arabic</span>
              <input
                nz-input
                dir="rtl"
                formControlName="questionAr"
                [attr.maxlength]="labelMax"
                placeholder="عمر الشركة؟"
                i18n-placeholder="@@pnq.q_ar_ph"
              />
            </label>
          </div>
          <div class="pair">
            <label class="field">
              <span class="field-label" i18n="@@pnq.help_en">Sub-label — English</span>
              <input
                nz-input
                dir="ltr"
                formControlName="helperTextEn"
                [attr.maxlength]="labelMax"
              />
            </label>
            <label class="field">
              <span class="field-label" i18n="@@pnq.help_ar">Sub-label — Arabic</span>
              <input
                nz-input
                dir="rtl"
                formControlName="helperTextAr"
                [attr.maxlength]="labelMax"
              />
            </label>
          </div>
          <!-- Kept visible rather than behind a disclosure: this is the line that
                 stops a figure being read as the wrong figure, and a sub-label
                 nobody sees is a sub-label nobody writes. -->
          <p class="hint" i18n="@@pnq.help_hint">
            Optional. Says what you want, when the question alone could be read two ways — “the
            limit, not the balance”.
          </p>
          <p class="code-line">
            <span class="code-key" i18n="@@pnq.code">code</span>
            <code class="code-val" dir="ltr">{{ codePreview() }}</code>
            <span class="code-hint" i18n="@@pnq.code_hint"
              >made from the English wording, and permanent</span
            >
          </p>
        </section>

        @if (isChoice()) {
          <section class="block">
            <h3 class="block-title" i18n="@@pnq.answers_h">The answers to pick from</h3>
            <ul class="opts" role="list" cdkDropList (cdkDropListDropped)="drop($event)">
              @for (row of optionRows().controls; track row; let i = $index) {
                <li class="opt" cdkDrag [formGroup]="row">
                  <span class="opt-grip" cdkDragHandle aria-hidden="true">
                    <span nz-icon nzType="holder" nzTheme="outline"></span>
                  </span>
                  <span class="opt-n numeric" aria-hidden="true">{{ i + 1 }}</span>
                  <input
                    nz-input
                    dir="ltr"
                    class="opt-in"
                    formControlName="labelEn"
                    [attr.maxlength]="optionLabelMax"
                    [attr.aria-label]="optionAria(i, 'en')"
                    placeholder="English"
                    i18n-placeholder="@@pnq.ans_en_ph"
                    (keydown.alt.arrowup)="moveBy(i, -1); $event.preventDefault()"
                    (keydown.alt.arrowdown)="moveBy(i, 1); $event.preventDefault()"
                  />
                  <input
                    nz-input
                    dir="rtl"
                    class="opt-in"
                    formControlName="labelAr"
                    [attr.maxlength]="optionLabelMax"
                    [attr.aria-label]="optionAria(i, 'ar')"
                    placeholder="عربي"
                    i18n-placeholder="@@pnq.ans_ar_ph"
                    (keydown.enter)="addOption(); $event.preventDefault()"
                    (keydown.alt.arrowup)="moveBy(i, -1); $event.preventDefault()"
                    (keydown.alt.arrowdown)="moveBy(i, 1); $event.preventDefault()"
                  />
                  <code class="opt-code" dir="ltr">{{ optionCode(i) }}</code>
                  <span class="opt-acts">
                    <button
                      type="button"
                      class="ico"
                      [disabled]="i === 0"
                      [attr.aria-label]="moveUpAria"
                      (click)="moveBy(i, -1)"
                    >
                      <span nz-icon nzType="arrow-up" nzTheme="outline"></span>
                    </button>
                    <button
                      type="button"
                      class="ico"
                      [disabled]="i === optionRows().length - 1"
                      [attr.aria-label]="moveDownAria"
                      (click)="moveBy(i, 1)"
                    >
                      <span nz-icon nzType="arrow-down" nzTheme="outline"></span>
                    </button>
                    <!-- Rendered disabled at the floor rather than hidden: a control
                           that appears and disappears as rows cross two reads as a
                           rendering bug, and the tooltip says why it is off. -->
                    <button
                      type="button"
                      class="ico danger"
                      [disabled]="optionRows().length <= minOptions"
                      nz-tooltip
                      [nzTooltipTitle]="
                        optionRows().length <= minOptions ? minOptionsTip : removeAria
                      "
                      [attr.aria-label]="removeAria"
                      (click)="removeOption(i)"
                    >
                      <span nz-icon nzType="delete" nzTheme="outline"></span>
                    </button>
                  </span>
                  <span class="opt-ghost" *cdkDragPlaceholder></span>
                </li>
              }
            </ul>
            <button
              type="button"
              class="add-opt"
              [disabled]="optionRows().length >= maxOptions"
              (click)="addOption()"
            >
              <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@pnq.add_answer">Add an answer</span>
            </button>
            <p class="hint" i18n="@@pnq.answers_hint">
              Drag to reorder, or use the arrows. Enter in the Arabic box adds the next one.
            </p>
          </section>
        } @else if (type() === 'NUMERIC') {
          <section class="block">
            <h3 class="block-title" i18n="@@pnq.number_h">What counts as a valid number?</h3>
            <div class="trio">
              <label class="field">
                <span class="field-label" i18n="@@pnq.num_min">Smallest allowed</span>
                <input nz-input appMoneyInput inputmode="decimal" formControlName="numericMin" />
              </label>
              <label class="field">
                <span class="field-label" i18n="@@pnq.num_max">Largest allowed</span>
                <input nz-input appMoneyInput inputmode="decimal" formControlName="numericMax" />
              </label>
              <label class="field">
                <span class="field-label" i18n="@@pnq.num_step">Step</span>
                <input nz-input appMoneyInput inputmode="decimal" formControlName="numericStep" />
              </label>
            </div>
            <div class="pair">
              <label class="field">
                <span class="field-label" i18n="@@pnq.unit_en">Unit — English</span>
                <input
                  nz-input
                  dir="ltr"
                  formControlName="unitEn"
                  [attr.maxlength]="unitMax"
                  placeholder="EGP"
                />
              </label>
              <label class="field">
                <span class="field-label" i18n="@@pnq.unit_ar">Unit — Arabic</span>
                <input
                  nz-input
                  dir="rtl"
                  formControlName="unitAr"
                  [attr.maxlength]="unitMax"
                  placeholder="جنيه"
                />
              </label>
            </div>
            <p class="hint" i18n="@@pnq.number_hint">
              All optional. Leave them empty to accept any number.
            </p>
          </section>
        } @else {
          <section class="block">
            <h3 class="block-title" i18n="@@pnq.text_h">How long can the answer be?</h3>
            <!-- Paired for + nzId rather than nesting alone: an nz-* control is a
                   component, so a wrapping label associates with nothing until the
                   id lands on the real input inside it. -->
            <label class="field len" for="nqd-text-len">
              <span class="field-label" i18n="@@pnq.text_len">Longest answer, in characters</span>
              <nz-input-number
                nzId="nqd-text-len"
                formControlName="textMaxLength"
                [nzMin]="1"
                [nzMax]="textCeiling"
                [nzStep]="50"
              />
            </label>
            <p class="hint" i18n="@@pnq.text_hint">
              Free text is stored as the applicant typed it. Nothing reads what it says.
            </p>
          </section>
        }

        <section class="block">
          <h3 class="block-title" id="nqd-cats-h" i18n="@@pnq.where_h">Who gets asked this?</h3>
          <div class="tiles" role="group" aria-labelledby="nqd-cats-h">
            @for (c of categories; track c) {
              <label
                class="tile cat"
                [attr.data-cat]="c"
                [class.is-on]="hasCategory(c)"
                [style.--tile-accent]="'var(--color-cat-' + c + ')'"
              >
                <input
                  type="checkbox"
                  class="sr-only"
                  [checked]="hasCategory(c)"
                  (change)="toggleCategory(c)"
                />
                <span class="tile-tick" aria-hidden="true">
                  @if (hasCategory(c)) {
                    <span nz-icon nzType="check" nzTheme="outline"></span>
                  }
                </span>
                <span class="tile-text">
                  <span class="tile-title">{{ categoryName(c) }}</span>
                </span>
              </label>
            }
          </div>
          <!-- The one sentence this dialog exists to stop people getting wrong.
                 The question is GLOBAL — it is not attached to this name. -->
          <p class="consequence">
            <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
            <span>{{ consequence() }}</span>
          </p>

          <label class="tile row" [class.is-on]="required()">
            <input
              type="checkbox"
              class="sr-only"
              [checked]="required()"
              (change)="toggleRequired()"
            />
            <span class="tile-tick" aria-hidden="true">
              @if (required()) {
                <span nz-icon nzType="check" nzTheme="outline"></span>
              }
            </span>
            <span class="tile-text">
              <span class="tile-title" i18n="@@pnq.required">Must be answered</span>
              <span class="tile-hint" i18n="@@pnq.required_hint"
                >Applicants cannot move on without it.</span
              >
            </span>
          </label>
        </section>

        <section class="block branch">
          <button
            type="button"
            class="disclose"
            [attr.aria-expanded]="branchOpen()"
            aria-controls="nqd-branch"
            (click)="toggleBranch()"
          >
            <span nz-icon nzType="down" nzTheme="outline" class="chev" aria-hidden="true"></span>
            <span i18n="@@pnq.branch_toggle">Ask this only sometimes</span>
          </button>
          @if (branchOpen()) {
            <div class="branch-body" id="nqd-branch">
              @if (branchLoading()) {
                <p class="hint" i18n="@@pnq.branch_loading">Loading the other questions…</p>
              } @else if (branchSources().length === 0) {
                <p class="hint" i18n="@@pnq.branch_none">
                  No earlier pick-one question to depend on yet, so this one is always asked.
                </p>
              } @else {
                <div class="branch-row">
                  <label class="field" for="nqd-branch-q">
                    <span class="field-label" i18n="@@pnq.branch_q">Only when this question</span>
                    <nz-select
                      nzId="nqd-branch-q"
                      formControlName="branchQuestionCode"
                      nzPlaceHolder="Pick a question"
                      i18n-nzPlaceHolder="@@pnq.branch_q_ph"
                      (ngModelChange)="onBranchSourceChange()"
                    >
                      @for (s of branchSources(); track s.code) {
                        <nz-option [nzValue]="s.code" [nzLabel]="s.label" />
                      }
                    </nz-select>
                  </label>
                  <label class="field narrow" for="nqd-branch-op">
                    <span class="field-label" i18n="@@pnq.branch_op">was</span>
                    <nz-select nzId="nqd-branch-op" formControlName="branchOperator">
                      <nz-option [nzValue]="'equals'" [nzLabel]="opEquals" />
                      <nz-option [nzValue]="'not_equals'" [nzLabel]="opNotEquals" />
                    </nz-select>
                  </label>
                  <label class="field" for="nqd-branch-a">
                    <span class="field-label" i18n="@@pnq.branch_a">this answer</span>
                    <nz-select
                      nzId="nqd-branch-a"
                      formControlName="branchOptionCode"
                      nzPlaceHolder="Pick an answer"
                      i18n-nzPlaceHolder="@@pnq.branch_a_ph"
                    >
                      @for (o of branchOptions(); track o.code) {
                        <nz-option [nzValue]="o.code" [nzLabel]="o.label" />
                      }
                    </nz-select>
                  </label>
                </div>
              }
            </div>
          }
        </section>
      </form>

      <p class="sr-only" role="status" aria-live="polite">{{ live() }}</p>

      @if (errorMessage(); as message) {
        <p class="error" role="alert">
          <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
          <span>{{ message }}</span>
        </p>
      }
    </app-form-page>
  `,
  styles: [
    `
      /* One accent for the whole screen, taken from the loan type it was opened
         on: a question authored from the Business lane is green throughout. */
      :host {
        display: block;
        --nqd-accent: var(--color-brand-primary);
      }
      .form {
        display: grid;
        gap: var(--space-6);
        margin: 0;
      }
      .block {
        display: grid;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .block-title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        letter-spacing: var(--tracking-tight);
        color: var(--color-text-primary);
      }
      .hint {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-tertiary);
        max-inline-size: 62ch;
      }

      /* ---- shared tickable-tile vocabulary -------------------------------
         Types, loan categories and the two switches are ALL tiles. One
         interaction grammar per dialog: three different selection widgets on
         one form is three things to learn for one kind of decision. */
      .tile {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-elevated);
        text-align: start;
        cursor: pointer;
        color: inherit;
        font: inherit;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .tile:hover:not(.is-on) {
        border-color: var(--color-border-strong);
        background: var(--color-surface-default);
      }
      .tile:focus-visible,
      .tile:focus-within {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: var(--focus-ring-offset);
      }
      /* Inset ring rather than a 2px border: a thicker border reflows the label
         by a pixel on every tick. */
      .tile.is-on {
        border-color: var(--tile-accent, var(--nqd-accent));
        background: color-mix(
          in srgb,
          var(--tile-accent, var(--nqd-accent)) 6%,
          var(--color-surface-default)
        );
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--tile-accent, var(--nqd-accent)) 45%, transparent);
      }
      .tile-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .tile-title {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
      }
      .tile-hint {
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
        max-inline-size: 46ch;
      }
      .tile-tick {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 20px;
        block-size: 20px;
        margin-block-start: 1px;
        border: 1.5px solid var(--color-border-strong);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        color: var(--text-inverse);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .tile.is-on .tile-tick {
        border-color: var(--tile-accent, var(--nqd-accent));
        background: var(--tile-accent, var(--nqd-accent));
      }
      .tile.row {
        align-items: flex-start;
      }

      /* ---- type picker ---------------------------------------------------- */
      .types {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: var(--space-3);
      }
      .type-glyph {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: var(--icon-tile-sm);
        block-size: var(--icon-tile-sm);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        transition:
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .type.is-on .type-glyph {
        background: color-mix(in srgb, var(--nqd-accent) 14%, var(--color-surface-default));
        color: var(--nqd-accent);
      }
      /* The answer SHAPE, drawn rather than iconified: a radio is a radio, a
         checklist is squares, a number is digits. Nothing to look up. */
      .g-radio {
        inline-size: 12px;
        block-size: 12px;
        border-radius: var(--radius-pill);
        border: 2px solid currentColor;
        box-shadow: inset 0 0 0 2px var(--color-surface-muted);
        background: currentColor;
      }
      .g-checks,
      .g-text {
        display: grid;
        gap: 2px;
      }
      .g-checks i {
        inline-size: 12px;
        block-size: 5px;
        border: 1.5px solid currentColor;
        border-radius: 1px;
      }
      .g-checks i:first-child {
        background: currentColor;
      }
      .g-text i {
        inline-size: 14px;
        block-size: 2px;
        border-radius: 1px;
        background: currentColor;
      }
      .g-text i:last-child {
        inline-size: 8px;
      }
      .g-num {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-bold);
        letter-spacing: var(--tracking-tight);
      }

      /* ---- fields --------------------------------------------------------- */
      .pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: var(--space-4);
        align-items: start;
      }
      .trio {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: var(--space-4);
        align-items: start;
      }
      .field {
        display: grid;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .field-label {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
      }
      .field.narrow {
        max-inline-size: 160px;
      }
      .field.len {
        max-inline-size: 220px;
      }

      .code-line {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .code-key {
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-weight: var(--font-weight-semibold);
      }
      .code-val {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }

      /* ---- options builder ------------------------------------------------ */
      .opts {
        display: grid;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .opt {
        display: grid;
        grid-template-columns: auto auto minmax(0, 1fr) minmax(0, 1fr) auto auto;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
        animation: nqd-row-in var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* Drops IN from the button above. The host page's landing animation rises
         by the same distance for the opposite meaning — a card settling after it
         moved up a section. Two motions, two readings. */
      @keyframes nqd-row-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
      }
      .opt-grip {
        display: grid;
        place-items: center;
        color: var(--color-text-tertiary);
        cursor: grab;
      }
      .opt-grip:active {
        cursor: grabbing;
      }
      .opt-n {
        inline-size: 18px;
        text-align: center;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums;
      }
      .opt-code {
        font-family: var(--font-mono);
        font-size: var(--text-xxs);
        color: var(--color-text-tertiary);
        max-inline-size: 14ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .opt-acts {
        display: flex;
        gap: var(--space-0-5);
        /* Always in the tab order; only the PAINT is deferred until the row is
           engaged, so a six-answer list is not six triplets of loud glyphs. */
        opacity: 0.35;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .opt:hover .opt-acts,
      .opt:focus-within .opt-acts {
        opacity: 1;
      }
      .ico {
        display: grid;
        place-items: center;
        inline-size: 26px;
        block-size: 26px;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition:
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .ico:hover:not(:disabled) {
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }
      .ico.danger:hover:not(:disabled) {
        background: var(--color-error-bg);
        color: var(--color-error);
      }
      .ico:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .opt-ghost {
        display: block;
        block-size: 42px;
        border: 1px dashed var(--color-border-strong);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
      }
      .add-opt {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        inline-size: 100%;
        padding: var(--space-2-5);
        border: 1px dashed var(--color-border-strong);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .add-opt:hover:not(:disabled) {
        border-color: var(--nqd-accent);
        color: var(--nqd-accent);
        background: color-mix(in srgb, var(--nqd-accent) 5%, transparent);
      }
      .add-opt:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* ---- categories ----------------------------------------------------- */
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--space-2);
      }
      .tile.cat {
        align-items: center;
        padding: var(--space-2-5) var(--space-3);
      }
      .tile.cat .tile-tick {
        margin-block-start: 0;
      }
      .consequence {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--color-info-bg);
        color: var(--color-info);
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        max-inline-size: 72ch;
      }
      .consequence [nz-icon] {
        flex: none;
        margin-block-start: 2px;
      }

      /* ---- branch --------------------------------------------------------- */
      .disclose {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--color-text-link);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        justify-self: start;
      }
      .disclose .chev {
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .disclose[aria-expanded='false'] .chev {
        transform: rotate(-90deg);
      }
      :host-context([dir='rtl']) .disclose[aria-expanded='false'] .chev {
        transform: rotate(90deg);
      }
      .branch-body {
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-muted);
        animation: nqd-swap var(--motion-duration-fast) var(--motion-easing-standard);
      }
      @keyframes nqd-swap {
        from {
          opacity: 0;
          transform: translateY(2px);
        }
      }
      .branch-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--space-3);
        align-items: end;
      }

      /* ---- footer --------------------------------------------------------- */
      .error {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-error);
        font-size: var(--text-sm);
      }

      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }

      .cdk-drag-preview {
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-xl);
        background: var(--color-surface-default);
      }
      .cdk-drag-animating,
      .opts.cdk-drop-list-dragging .opt:not(.cdk-drag-placeholder) {
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }

      @media (max-width: 720px) {
        .opt {
          grid-template-columns: auto minmax(0, 1fr) auto;
        }
        .opt-n,
        .opt-code {
          display: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .tile,
        .tile-tick,
        .type-glyph,
        .ico,
        .add-opt,
        .opt-acts,
        .disclose .chev,
        .cdk-drag-animating,
        .opts.cdk-drop-list-dragging .opt:not(.cdk-drag-placeholder) {
          transition: none;
        }
        .opt,
        .branch-body {
          animation: none;
        }
      }
    `,
  ],
})
export class NewQuestionPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly lookups = inject(LookupsApiService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly locale = inject(LOCALE_ID);

  /** The catalog name being configured, bound from the route. */
  readonly key = input.required<string>();

  /**
   * The open tab, read from `?loan=` — the same query param the name's own page uses, so
   * coming back lands on the tab the operator left. SYNCHRONOUS, because it seeds the
   * category pick and the wording of half this form; an unknown value falls back to
   * `personal` rather than leaving the form with no category picked at all.
   */
  protected readonly category: LoanCategory = (() => {
    const raw = this.route.snapshot.queryParamMap.get('loan');
    return isLoanCategory(raw) ? raw : 'personal';
  })();
  /** Prefill from the search dead end on the name's page (`?seed=`). */
  private readonly seedQuestionEn = this.route.snapshot.queryParamMap.get('seed') ?? '';

  /**
   * Wording only, and async: the label is not on the URL. Until it arrives the subtitle
   * says what it can without naming the name — never a placeholder name, which would
   * read as a real one.
   */
  protected readonly nameLabel = signal('');
  /**
   * Live pool codes, so the slug preview matches what the server will mint. Async too:
   * the preview says "the code will be …" and re-derives the moment the pool lands.
   */
  private readonly existingCodes = signal<readonly string[]>([]);

  protected readonly eyebrow = $localize`:@@pnq.eyebrow:Question pool`;
  protected readonly pageTitle = $localize`:@@pnd.new_question_title:New question`;
  protected readonly submitLabel = $localize`:@@pnq.save:Create question`;

  async ngOnInit(): Promise<void> {
    // The same two reads the name's own page makes, for the same two reasons: the row
    // carries the label this form is worded with, the pool carries the codes the slug
    // preview has to avoid colliding with.
    const [rows, pool] = await Promise.all([
      this.lookups.list(ENUM_TYPE),
      this.lookups.catalogQuestions(),
    ]);
    const { rows: names } = absorbProgramNames(rows);
    const name = names.find((n) => n.key === this.key());
    if (name) this.nameLabel.set(this.locale.startsWith('ar') ? name.labelAr : name.labelEn);
    this.existingCodes.set(pool.map((q) => q.code));
  }

  protected subtitleFor(label: string): string {
    return $localize`:@@pnq.subtitle:Opened from “${label}:name:”, but written into the one shared question pool — every applicant in the loan types you pick is asked it.`;
  }

  protected readonly types = TYPES;
  protected readonly categories = LOAN_CATEGORIES;
  protected readonly minOptions = MIN_OPTIONS;
  protected readonly maxOptions = MAX_OPTIONS;
  protected readonly labelMax = LABEL_MAX;
  protected readonly optionLabelMax = OPTION_LABEL_MAX;
  protected readonly unitMax = UNIT_MAX;
  protected readonly textCeiling = TEXT_LENGTH_CEILING;

  protected readonly moveUpAria = $localize`:@@pnq.aria_up:Move this answer up`;
  protected readonly moveDownAria = $localize`:@@pnq.aria_down:Move this answer down`;
  protected readonly removeAria = $localize`:@@pnq.aria_remove:Remove this answer`;
  protected readonly minOptionsTip = $localize`:@@pnq.min_answers_tip:A pick-one question needs at least two answers`;
  protected readonly opEquals = $localize`:@@pnq.op_equals:was answered`;
  protected readonly opNotEquals = $localize`:@@pnq.op_not_equals:was NOT answered`;

  protected readonly type = signal<QuestionType>('SINGLE_SELECT');
  protected readonly required = signal(true);
  protected readonly picked = signal<readonly LoanCategory[]>([this.category]);
  protected readonly branchOpen = signal(false);
  protected readonly branchLoading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly live = signal('');

  /** Loaded lazily, only when the branch disclosure is opened. */
  private readonly tree = signal<GroupTreeRow[] | null>(null);

  private readonly existing = computed(() => new Set(this.existingCodes()));

  protected readonly form = new FormGroup({
    questionEn: new FormControl(this.seedQuestionEn, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LABEL_MAX)],
    }),
    questionAr: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LABEL_MAX)],
    }),
    helperTextEn: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LABEL_MAX)],
    }),
    helperTextAr: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LABEL_MAX)],
    }),
    numericMin: new FormControl('', { nonNullable: true }),
    numericMax: new FormControl('', { nonNullable: true }),
    numericStep: new FormControl('', { nonNullable: true }),
    unitEn: new FormControl('', { nonNullable: true }),
    unitAr: new FormControl('', { nonNullable: true }),
    textMaxLength: new FormControl(TEXT_LENGTH_DEFAULT, { nonNullable: true }),
    branchQuestionCode: new FormControl('', { nonNullable: true }),
    branchOperator: new FormControl<'equals' | 'not_equals'>('equals', { nonNullable: true }),
    branchOptionCode: new FormControl('', { nonNullable: true }),
    options: new FormArray<OptionGroup>([]),
  });

  /**
   * One tick per form mutation, so every computed below reads the CURRENT raw
   * value. `valueChanges` covers pushes and removals on the array too, which is
   * why the option rows need no counter of their own.
   */
  private readonly beat = toSignal(this.form.valueChanges, { initialValue: null });
  private readonly value = computed(() => {
    this.beat();
    return this.form.getRawValue();
  });

  constructor() {
    // Seeded at the floor rather than empty: two answers are mandatory anyway,
    // so an empty list makes the first interaction "press add" for a rule the
    // form is about to enforce.
    this.addOption(false);
    this.addOption(false);
  }

  // ---- type -----------------------------------------------------------------
  protected isChoice(): boolean {
    return this.type() === 'SINGLE_SELECT' || this.type() === 'MULTI_SELECT';
  }

  protected pickType(t: QuestionType): void {
    this.type.set(t);
  }

  /** Roving tabindex: arrows move AND select, which is the radio contract. */
  protected onTypeKey(event: KeyboardEvent, current: QuestionType): void {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const i = TYPES.indexOf(current);
    // Right/Left follow the writing direction; Up/Down never do — up is up in
    // every script, which is the same contract app-rail-tabs encodes.
    const rtl = document.documentElement.dir === 'rtl';
    let next = i;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TYPES.length - 1;
    else if (event.key === 'ArrowDown') next = (i + 1) % TYPES.length;
    else if (event.key === 'ArrowUp') next = (i - 1 + TYPES.length) % TYPES.length;
    else {
      const forward = event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
      next = (i + (forward ? 1 : -1) + TYPES.length) % TYPES.length;
    }
    const target = TYPES[next];
    if (!target) return;
    this.pickType(target);
    const host = event.currentTarget as HTMLElement | null;
    const tiles = host?.parentElement?.querySelectorAll<HTMLElement>('.type');
    tiles?.item(next)?.focus();
  }

  protected typeLabel(t: QuestionType): string {
    switch (t) {
      case 'SINGLE_SELECT':
        return $localize`:@@pnq.type_single:Pick one`;
      case 'MULTI_SELECT':
        return $localize`:@@pnq.type_multi:Pick several`;
      case 'NUMERIC':
        return $localize`:@@pnq.type_number:A number`;
      case 'TEXT':
        return $localize`:@@pnq.type_text:Free text`;
    }
  }

  protected typeHint(t: QuestionType): string {
    switch (t) {
      case 'SINGLE_SELECT':
        return $localize`:@@pnq.type_single_hint:One answer from a list you write.`;
      case 'MULTI_SELECT':
        return $localize`:@@pnq.type_multi_hint:Any number of answers from your list.`;
      case 'NUMERIC':
        return $localize`:@@pnq.type_number_hint:A figure — salary, rent, years.`;
      case 'TEXT':
        return $localize`:@@pnq.type_text_hint:Typed in freely, in the applicant's own words.`;
    }
  }

  // ---- codes ----------------------------------------------------------------
  protected codePreview(): string {
    const en = this.value().questionEn.trim();
    return en === '' ? '—' : uniqueSlug(en, this.existing());
  }

  /** Option codes collide only with their own siblings, so they slug in order. */
  protected optionCode(index: number): string {
    const rows = this.value().options;
    const seen = new Set<string>();
    for (let i = 0; i <= index; i++) {
      const label = (rows[i]?.labelEn ?? '').trim();
      const code = label === '' ? '' : uniqueSlug(label, seen);
      if (i === index) return code === '' ? '—' : code;
      if (code !== '') seen.add(code);
    }
    return '—';
  }

  // ---- options --------------------------------------------------------------
  protected optionRows(): FormArray<OptionGroup> {
    return this.form.controls.options;
  }

  protected addOption(announce = true): void {
    if (this.optionRows().length >= MAX_OPTIONS) return;
    this.optionRows().push(
      new FormGroup({
        labelEn: new FormControl('', { nonNullable: true }),
        labelAr: new FormControl('', { nonNullable: true }),
      }),
    );
    if (announce) {
      const n = this.optionRows().length;
      this.live.set($localize`:@@pnq.live_added:Answer added, ${n}:n: in total`);
    }
  }

  protected removeOption(index: number): void {
    if (this.optionRows().length <= MIN_OPTIONS) return;
    this.optionRows().removeAt(index);
    const n = this.optionRows().length;
    this.live.set($localize`:@@pnq.live_removed:Answer removed, ${n}:n: left`);
  }

  protected moveBy(index: number, delta: number): void {
    const to = index + delta;
    if (to < 0 || to >= this.optionRows().length) return;
    const rows = this.optionRows();
    const moved = rows.at(index);
    rows.removeAt(index);
    rows.insert(to, moved);
    this.live.set(
      $localize`:@@pnq.live_moved:Answer moved to position ${to + 1}:pos: of ${rows.length}:n:`,
    );
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    const rows = this.optionRows();
    const controls = [...rows.controls];
    moveItemInArray(controls, event.previousIndex, event.currentIndex);
    rows.clear({ emitEvent: false });
    for (const c of controls) rows.push(c, { emitEvent: false });
    rows.updateValueAndValidity();
    this.live.set(
      $localize`:@@pnq.live_moved:Answer moved to position ${event.currentIndex + 1}:pos: of ${rows.length}:n:`,
    );
  }

  protected optionAria(index: number, lang: 'en' | 'ar'): string {
    const n = index + 1;
    return lang === 'en'
      ? $localize`:@@pnq.aria_ans_en:Answer ${n}:n:, English`
      : $localize`:@@pnq.aria_ans_ar:Answer ${n}:n:, Arabic`;
  }

  // ---- categories + switches ------------------------------------------------
  protected categoryName(c: LoanCategory): string {
    return categoryLabel(c);
  }

  protected hasCategory(c: LoanCategory): boolean {
    return this.picked().includes(c);
  }

  protected toggleCategory(c: LoanCategory): void {
    // Rebuilt in LOAN_CATEGORIES order so the payload never depends on click order.
    this.picked.update((current) =>
      current.includes(c)
        ? current.filter((x) => x !== c)
        : LOAN_CATEGORIES.filter((x) => x === c || current.includes(x)),
    );
  }

  protected toggleRequired(): void {
    this.required.update((v) => !v);
  }

  /** Locale-aware list, so the Arabic build never renders an English comma. */
  private list(names: readonly string[]): string {
    return new Intl.ListFormat(this.locale, { style: 'long', type: 'conjunction' }).format(names);
  }

  protected consequence(): string {
    const names = this.picked().map((c) => categoryLabel(c));
    if (names.length === 0) {
      return $localize`:@@pnq.where_none:Pick at least one loan type — a question no one is asked is a question that does nothing.`;
    }
    const list = this.list(names);
    return $localize`:@@pnq.where_note:Every ${list}:types: applicant will be asked this, in every program — not only “${this.nameLabel()}:name:”. Questions are one shared pool.`;
  }

  // ---- branch ---------------------------------------------------------------
  protected async toggleBranch(): Promise<void> {
    const next = !this.branchOpen();
    this.branchOpen.set(next);
    if (!next) {
      this.form.patchValue({ branchQuestionCode: '', branchOptionCode: '' });
      return;
    }
    if (this.tree() !== null) return;
    this.branchLoading.set(true);
    try {
      this.tree.set(await this.api.tree());
    } catch {
      // Degrade, never block: a branch is optional and the save must not depend
      // on a read that only this disclosure needs.
      this.tree.set([]);
    } finally {
      this.branchLoading.set(false);
    }
  }

  /**
   * Only CHOICE questions can be branched on — the rule compares an option code.
   * Every existing question qualifies on order, because a new one is appended to
   * the end of the pool.
   */
  protected readonly branchSources = computed(() => {
    const groups = this.tree() ?? [];
    return groups
      .flatMap((g) => g.questions)
      .filter((q) => q.isActive && (q.type === 'SINGLE_SELECT' || q.type === 'MULTI_SELECT'))
      .map((q) => ({ code: q.code, label: q.questionEn, options: q.options }));
  });

  protected readonly branchOptions = computed(() => {
    const code = this.value().branchQuestionCode;
    const source = this.branchSources().find((s) => s.code === code);
    return (source?.options ?? [])
      .filter((o) => o.isActive)
      .map((o) => ({ code: o.code, label: o.labelEn }));
  });

  protected onBranchSourceChange(): void {
    this.form.controls.branchOptionCode.setValue('');
  }

  // ---- validity -------------------------------------------------------------
  /**
   * ONE reason at a time, most specific first, rendered as text next to the
   * disabled button. Mirrors the server's rules so the common mistakes never
   * cost a round trip; the server stays the authority and its message lands in
   * the error banner if the two ever disagree.
   */
  protected readonly blockReason = computed<string | null>(() => {
    const v = this.value();
    if (v.questionEn.trim() === '' || v.questionAr.trim() === '') {
      return $localize`:@@pnq.block_wording:Write the question in English and Arabic`;
    }
    if (this.isChoice()) {
      if (v.options.length < MIN_OPTIONS) {
        return $localize`:@@pnq.block_min_answers:Add one more answer`;
      }
      if (v.options.some((o) => o.labelEn.trim() === '' || o.labelAr.trim() === '')) {
        return $localize`:@@pnq.block_answer_labels:Every answer needs both languages`;
      }
    }
    if (this.type() === 'NUMERIC') {
      const bad = [v.numericMin, v.numericMax, v.numericStep].some(
        (n) => n.trim() !== '' && !DECIMAL_RE.test(n.trim()),
      );
      if (bad) return $localize`:@@pnq.block_decimal:Numbers take at most two decimal places`;
      const min = v.numericMin.trim() === '' ? null : Number(v.numericMin);
      const max = v.numericMax.trim() === '' ? null : Number(v.numericMax);
      const step = v.numericStep.trim() === '' ? null : Number(v.numericStep);
      if (min !== null && max !== null && max < min) {
        return $localize`:@@pnq.block_range:The largest allowed cannot be below the smallest`;
      }
      if (step !== null && step <= 0) {
        return $localize`:@@pnq.block_step:The step has to be more than zero`;
      }
      // A step wider than the range leaves exactly one legal value — a mistake,
      // not a bound. The server refuses it too.
      if (min !== null && max !== null && step !== null && max !== min && step > max - min) {
        return $localize`:@@pnq.block_step_wide:The step is wider than the whole range`;
      }
      const unitEn = v.unitEn.trim() === '';
      const unitAr = v.unitAr.trim() === '';
      if (unitEn !== unitAr) {
        return $localize`:@@pnq.block_unit:Give the unit in both languages, or in neither`;
      }
    }
    if (this.type() === 'TEXT') {
      const len = v.textMaxLength;
      if (!Number.isInteger(len) || len < 1 || len > TEXT_LENGTH_CEILING) {
        return $localize`:@@pnq.block_len:The longest answer has to be between 1 and 2000`;
      }
    }
    if (this.picked().length === 0) {
      return $localize`:@@pnq.block_categories:Pick at least one loan type`;
    }
    if (
      this.branchOpen() &&
      this.branchSources().length > 0 &&
      (this.value().branchQuestionCode === '' || this.value().branchOptionCode === '')
    ) {
      return $localize`:@@pnq.block_branch:Finish the condition, or close it`;
    }
    return null;
  });

  protected summary(): string {
    const kind = this.typeLabel(this.type()).toLocaleLowerCase(this.locale);
    const where = this.list(this.picked().map((c) => categoryLabel(c)));
    return $localize`:@@pnq.summary_plain:A ${kind}:kind: question, asked of ${where}:types: applicants.`;
  }

  // ---- save -----------------------------------------------------------------
  /** Leaves without writing anything — back to the name this was opened from. */
  protected cancel(): void {
    void this.router.navigate(['/program-catalog', this.key()]);
  }

  protected async save(): Promise<void> {
    if (this.blockReason() !== null || this.submitting()) return;
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      // The write IS the whole job now — the question lands in the global pool and is
      // asked of the loan types picked above. Nothing is attached to the catalog name,
      // so there is nothing to hand back to it.
      await this.api.createQuestionWithOptions(this.body());
      void this.router.navigate(['/program-catalog', this.key()]);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.errorMessage.set(
        this.errorCodes.toLocalizedMessage((code ?? 'INTERNAL_ERROR') as ErrorCode),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  /** Only the blocks the chosen type owns are sent — the server rejects the rest. */
  private body(): CreateQuestionWithOptionsBody {
    const v = this.value();
    const trimmed = (s: string): string | undefined => (s.trim() === '' ? undefined : s.trim());
    const body: CreateQuestionWithOptionsBody = {
      questionEn: v.questionEn.trim(),
      questionAr: v.questionAr.trim(),
      helperTextEn: trimmed(v.helperTextEn),
      helperTextAr: trimmed(v.helperTextAr),
      isRequired: this.required(),
      type: this.type(),
      categories: [...this.picked()],
    };
    if (this.isChoice()) {
      body.options = v.options.map((o) => ({
        labelEn: o.labelEn.trim(),
        labelAr: o.labelAr.trim(),
      }));
    } else if (this.type() === 'NUMERIC') {
      const numeric = {
        minValue: trimmed(v.numericMin),
        maxValue: trimmed(v.numericMax),
        step: trimmed(v.numericStep),
        unitEn: trimmed(v.unitEn),
        unitAr: trimmed(v.unitAr),
      };
      // Sent only when at least one bound was actually given: an all-undefined
      // block is a rule the question does not have.
      if (Object.values(numeric).some((x) => x !== undefined)) body.numeric = numeric;
    } else {
      body.text = { maxLength: v.textMaxLength };
    }
    if (this.branchOpen() && v.branchQuestionCode !== '' && v.branchOptionCode !== '') {
      body.enabledWhen = {
        questionCode: v.branchQuestionCode,
        operator: v.branchOperator,
        optionCode: v.branchOptionCode,
      };
    }
    return body;
  }
}
