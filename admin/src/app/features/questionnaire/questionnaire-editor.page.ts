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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { EditOutline, DeleteOutline, EllipsisOutline, DownOutline } from '@ant-design/icons-angular/icons';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { A11yModule } from '@angular/cdk/a11y';
import {
  QuestionnaireApiService,
  isChoiceQuestionType,
  type GroupTreeRow,
  type OptionRow,
  type PublishWarning,
  type QuestionRow,
  type QuestionType,
} from './questionnaire.api.service';
import { ErrorCodeService } from '@core/errors/error-code.service';

type Mode = null | 'group' | 'question' | 'option';

/** Ordered for the segmented control: the two choice types, then the two value types. */
const TYPE_ORDER: readonly QuestionType[] = [
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'NUMERIC',
  'TEXT',
];

/**
 * GLOBAL question-pool authoring (Constitution V, Feature 010 — questions are
 * admin DATA with NO category). One pool feeds one global questionnaire; codes
 * are auto-generated server-side (read-only here, A33). Groups are sections used
 * only to organise the pool. Tree on the left, a contextual inspector drawer on
 * the right; every edit auto-publishes a new global version.
 */
@Component({
  standalone: true,
  selector: 'mf-questionnaire-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSwitchModule,
    NzSpinModule,
    NzEmptyModule,
    NzIconModule,
    NzDropDownModule,
    NzToolTipModule,
    NzAlertModule,
    A11yModule,
  ],
  providers: [provideNzIconsPatch([EditOutline, DeleteOutline, EllipsisOutline, DownOutline])],
  template: `
    <section class="page">
      <!-- Hero — quiet surface card; brand azure accent lives in the eyebrow +
           counts. No category dimension: this is the single global pool. -->
      <header class="hero">
        <div class="hero-inner">
          <div class="hero-lead">
            <div class="title-text">
              <p class="eyebrow" i18n="@@qedit.eyebrow">Matching engine</p>
              <div class="title-row">
                <h1 i18n="@@qedit.title">Question pool</h1>
                @if (published()) {
                  <span class="live-chip" title="A version is published" i18n-title="@@qedit.live_title">
                    <span class="live-dot" aria-hidden="true"></span>
                    <span i18n="@@qedit.live">Live</span>
                  </span>
                }
              </div>
            </div>
            <p class="stats">
              <strong>{{ groups().length }}</strong> <span i18n="@@qedit.stat_groups">groups</span>
              <span class="dot">·</span>
              <strong>{{ totalQuestions() }}</strong>
              <span i18n="@@qedit.stat_questions">questions</span>
              <span class="dot">·</span>
              <span class="muted" i18n="@@qedit.stat_autosave"
                >one global questionnaire · saves &amp; publishes automatically</span
              >
            </p>
          </div>
          <div class="hero-actions">
            <button nz-button nzType="primary" nzSize="large" (click)="startGroup()">
              <span i18n="@@qedit.add_group">＋ Group</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Money-binding banner. A standing condition, not a save event: the four
           bound number questions are what the engine prices on, so an unclaimed
           binding means affected applicants get MONEY_FIGURE_MISSING instead of a
           quote (FR-044/FR-048). Rendered from the backend code via the shared
           error-code catalog — no per-component message mapping (A22). -->
      @if (bindingWarnings().length > 0) {
        <nz-alert
          class="binding-alert"
          nzType="warning"
          [nzMessage]="bindingWarningTitle"
          [nzDescription]="bindingWarningBody"
          nzShowIcon
        />
        <ng-template #bindingWarningTitle>
          <span i18n="@@qedit.binding_warn_title"
            >Some figures the engine prices on are not being collected</span
          >
        </ng-template>
        <ng-template #bindingWarningBody>
          <ul class="binding-list">
            @for (w of bindingWarnings(); track w.code + bindingOf(w)) {
              <li>
                <code>{{ bindingOf(w) }}</code>
                <span>{{ warningMessage(w) }}</span>
              </li>
            }
          </ul>
        </ng-template>
      }

      <!-- Master-detail workbench: outline rail (left) + editing canvas (right). -->
      <div class="tree">
        @if (loading()) {
          <div class="center"><nz-spin nzSimple /></div>
        } @else if (groups().length === 0) {
          <div class="empty-card">
            <nz-empty
              nzNotFoundContent="No groups yet — add your first group to start building the pool"
              i18n-nzNotFoundContent="@@qedit.empty"
            />
            <button nz-button nzType="primary" (click)="startGroup()" i18n="@@qedit.empty_cta">
              Add a group
            </button>
          </div>
        } @else {
          <div class="workbench">
            <!-- LEFT: group outline (master) — pure navigation. -->
            <aside class="outline" aria-label="Question groups" i18n-aria-label="@@qedit.outline_aria">
              <div class="outline-head">
                <span i18n="@@qedit.outline_head">Groups</span>
                <span class="head-total">{{ groups().length }}</span>
              </div>
              <ul class="grp-list">
                @for (g of groups(); track g.id) {
                  <li>
                    <button
                      type="button"
                      class="grp-row"
                      [class.active]="g.id === selectedGroup()?.id"
                      [attr.aria-current]="g.id === selectedGroup()?.id ? 'true' : null"
                      nz-tooltip
                      [nzTooltipTitle]="isAr ? g.titleAr : g.titleEn"
                      nzTooltipPlacement="right"
                      (click)="selectGroup(g)"
                    >
                      <span class="grp-name" [dir]="isAr ? 'rtl' : 'ltr'">{{
                        isAr ? g.titleAr : g.titleEn
                      }}</span>
                      <span
                        class="count-pill"
                        nz-tooltip
                        nzTooltipTitle="Questions in this group"
                        i18n-nzTooltipTitle="@@qedit.grp_qcount_tip"
                        >{{ g.questions.length }}</span
                      >
                    </button>
                  </li>
                }
              </ul>
              <button
                class="add-grp"
                nz-button
                nzType="text"
                (click)="startGroup()"
                i18n="@@qedit.add_group"
              >
                ＋ Group
              </button>
            </aside>

            <!-- RIGHT: editing canvas (detail) — only the selected group. -->
            <section class="canvas">
              @if (selectedGroup(); as g) {
                <header class="canvas-head">
                  <div class="ch-title">
                    <h2 [dir]="isAr ? 'rtl' : 'ltr'">{{ isAr ? g.titleAr : g.titleEn }}</h2>
                    <span class="count-pill">{{ g.questions.length }}</span>
                  </div>
                  <div class="ch-actions">
                    <button
                      nz-button
                      nzSize="small"
                      (click)="startQuestion(g)"
                      i18n="@@qedit.add_question"
                    >
                      ＋ Question
                    </button>
                    <button
                      type="button"
                      class="kebab"
                      nz-button
                      nzType="text"
                      nzShape="circle"
                      nz-dropdown
                      [nzDropdownMenu]="gMenu"
                      nzTrigger="click"
                      nzPlacement="bottomRight"
                      aria-label="Group actions"
                      i18n-aria-label="@@qedit.group_actions_aria"
                    >
                      <span nz-icon nzType="ellipsis" nzTheme="outline"></span>
                    </button>
                    <nz-dropdown-menu #gMenu="nzDropdownMenu">
                      <ul nz-menu class="row-menu">
                        <li nz-menu-item (click)="editGroup(g)">
                          <span nz-icon nzType="edit" nzTheme="outline" style="margin-inline-end: 8px"></span>
                          <span i18n="@@qedit.menu_edit">Edit</span>
                        </li>
                        <li nz-menu-item (click)="confirmDeleteGroup(g)">
                          <span
                            nz-icon
                            nzType="delete"
                            nzTheme="outline"
                            style="margin-inline-end: 8px; color: var(--color-error, var(--ant-error-color))"
                          ></span>
                          <span style="color: var(--color-error, var(--ant-error-color))" i18n="@@qedit.menu_delete"
                            >Delete</span
                          >
                        </li>
                      </ul>
                    </nz-dropdown-menu>
                  </div>
                </header>

                @if (g.questions.length === 0) {
                  <p class="empty-line" i18n="@@qedit.group_empty">
                    No questions yet — add the first one.
                  </p>
                }

                <div class="q-grid">
                  @for (q of g.questions; track q.id; let i = $index) {
                    <div class="q-card">
                      <div class="q-top">
                        <span class="q-ord" aria-hidden="true">{{ i + 1 }}</span>
                        <span class="q-text" [dir]="isAr ? 'rtl' : 'ltr'">{{
                          isAr ? q.questionAr : q.questionEn
                        }}</span>
                        <span
                          class="type-chip"
                          [class.value-type]="!isChoice(q.type)"
                          nz-tooltip
                          [nzTooltipTitle]="typeHint(q.type)"
                          >{{ typeLabel(q.type) }}</span
                        >
                        @if (q.isRequired) {
                          <span class="req" i18n="@@qedit.required_chip">required</span>
                        }
                        <button
                          type="button"
                          class="kebab"
                          nz-button
                          nzType="text"
                          nzShape="circle"
                          nz-dropdown
                          [nzDropdownMenu]="qMenu"
                          nzTrigger="click"
                          nzPlacement="bottomRight"
                          aria-label="Question actions"
                          i18n-aria-label="@@qedit.question_actions_aria"
                        >
                          <span nz-icon nzType="ellipsis" nzTheme="outline"></span>
                        </button>
                        <nz-dropdown-menu #qMenu="nzDropdownMenu">
                          <ul nz-menu class="row-menu">
                            <li nz-menu-item (click)="editQuestion(q)">
                              <span nz-icon nzType="edit" nzTheme="outline" style="margin-inline-end: 8px"></span>
                              <span i18n="@@qedit.menu_edit">Edit</span>
                            </li>
                            <li nz-menu-item (click)="confirmDeleteQuestion(q)">
                              <span
                                nz-icon
                                nzType="delete"
                                nzTheme="outline"
                                style="margin-inline-end: 8px; color: var(--color-error, var(--ant-error-color))"
                              ></span>
                              <span style="color: var(--color-error, var(--ant-error-color))" i18n="@@qedit.menu_delete"
                                >Delete</span
                              >
                            </li>
                          </ul>
                        </nz-dropdown-menu>
                      </div>
                      <!-- Value types have nothing to pick: showing an option list
                           would invite the admin into a state the server rejects
                           with QUESTION_TYPE_RULES_INVALID. Show the rule instead. -->
                      @if (isChoice(q.type)) {
                        @if (q.options.length > 0) {
                          <p class="opt-meta">
                            {{ q.options.length }}<span i18n="@@qedit.opt_count"> options</span>
                          </p>
                        } @else {
                          <p class="rule-line warn" i18n="@@qedit.needs_options">
                            Needs at least 2 options before this can be published.
                          </p>
                        }
                      } @else {
                        <p class="rule-line">{{ ruleSummary(q) }}</p>
                      }
                      @if (isChoice(q.type)) {
                      <ul class="opts">
                        @for (o of q.options; track o.id) {
                          <li>
                            <button
                              type="button"
                              class="opt-chip"
                              nz-dropdown
                              [nzDropdownMenu]="oMenu"
                              nzTrigger="click"
                              nzPlacement="bottomLeft"
                              aria-label="Option actions"
                              i18n-aria-label="@@qedit.option_actions_aria"
                            >
                              <span class="opt-label" [dir]="isAr ? 'rtl' : 'ltr'">{{
                                isAr ? o.labelAr : o.labelEn
                              }}</span>
                              <span class="opt-caret" nz-icon nzType="down" nzTheme="outline" aria-hidden="true"></span>
                            </button>
                            <nz-dropdown-menu #oMenu="nzDropdownMenu">
                              <ul nz-menu class="row-menu">
                                <li nz-menu-item (click)="editOption(o)">
                                  <span nz-icon nzType="edit" nzTheme="outline" style="margin-inline-end: 8px"></span>
                                  <span i18n="@@qedit.menu_edit">Edit</span>
                                </li>
                                <li nz-menu-item (click)="confirmDeleteOption(o)">
                                  <span
                                    nz-icon
                                    nzType="delete"
                                    nzTheme="outline"
                                    style="margin-inline-end: 8px; color: var(--color-error, var(--ant-error-color))"
                                  ></span>
                                  <span style="color: var(--color-error, var(--ant-error-color))" i18n="@@qedit.menu_delete"
                                    >Delete</span
                                  >
                                </li>
                              </ul>
                            </nz-dropdown-menu>
                          </li>
                        }
                        <li>
                          <button
                            type="button"
                            class="add-opt-chip"
                            (click)="startOption(q.id)"
                            i18n="@@qedit.add_option"
                          >
                            ＋ option
                          </button>
                        </li>
                      </ul>
                      }
                    </div>
                  }
                </div>
              } @else {
                <p class="empty-line" i18n="@@qedit.canvas_empty">
                  Select a group to edit its questions.
                </p>
              }
            </section>
          </div>
        }
      </div>
    </section>

    <!-- Inspector drawer — rendered OUTSIDE section.page so position:fixed
         resolves against the viewport (A34). -->
    @if (mode() !== null) {
      <div class="scrim" (click)="cancel()" aria-hidden="true"></div>
      <!-- role="dialog" is a promise: Escape closes it and the heading names it.
           cdkTrapFocus + cdkTrapFocusAutoCapture keep Tab inside the drawer and
           move focus into it on open, so it is not a mouse-only surface. -->
      <aside
        class="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="cancel()"
      >
        <div class="ins-card">
          <header class="ins-head">
            <h3 id="drawer-title">
              @switch (mode()) {
                @case ('group') {
                  @if (editing()) {
                    <span i18n="@@qedit.edit_group">Edit group</span>
                  } @else {
                    <span i18n="@@qedit.new_group">New group</span>
                  }
                }
                @case ('question') {
                  @if (editing()) {
                    <span i18n="@@qedit.edit_question">Edit question</span>
                  } @else {
                    <span i18n="@@qedit.new_question">New question</span>
                  }
                }
                @default {
                  @if (editing()) {
                    <span i18n="@@qedit.edit_option">Edit option</span>
                  } @else {
                    <span i18n="@@qedit.new_option">New option</span>
                  }
                }
              }
            </h3>
            <button
              nz-button
              nzType="text"
              nzShape="circle"
              (click)="cancel()"
              aria-label="Close"
              i18n-aria-label="@@qedit.close_aria"
            >
              ✕
            </button>
          </header>
          @if (!editing()) {
            <p class="ins-note" i18n="@@qedit.code_note">
              A stable code is generated automatically — no need to type one.
            </p>
          }

          @if (mode() === 'group') {
            <form [formGroup]="groupForm" class="form" (ngSubmit)="submitGroup()">
              <label class="field">
                <span class="lbl" i18n="@@qedit.title_en">Title (English)</span>
                <input nz-input formControlName="titleEn" placeholder="e.g. Financing details" />
              </label>
              <label class="field">
                <span class="lbl" i18n="@@qedit.title_ar">العنوان (عربي)</span>
                <input nz-input formControlName="titleAr" dir="rtl" placeholder="مثال: تفاصيل التمويل" />
              </label>
              <label class="field">
                <span class="lbl" i18n="@@qedit.order">Display order</span>
                <nz-input-number formControlName="displayOrder" [nzMin]="0" />
              </label>
              <div class="form-actions">
                <button type="button" nz-button (click)="cancel()" i18n="@@qedit.cancel">Cancel</button>
                <button nz-button nzType="primary" [disabled]="groupForm.invalid" i18n="@@qedit.save">
                  Save group
                </button>
              </div>
            </form>
          } @else if (mode() === 'question') {
            <form [formGroup]="questionForm" class="form" (ngSubmit)="submitQuestion()">
              <p class="section-lbl" i18n="@@qedit.sec_content">Content</p>
              <label class="field">
                <span class="lbl" i18n="@@qedit.q_en">Question (English)</span>
                <input nz-input formControlName="questionEn" placeholder="e.g. What is your monthly income?" />
              </label>
              <label class="field">
                <span class="lbl" i18n="@@qedit.q_ar">السؤال (عربي)</span>
                <input nz-input formControlName="questionAr" dir="rtl" placeholder="مثال: ما هو دخلك الشهري؟" />
              </label>

              <p class="section-lbl" i18n="@@qedit.sec_answer">Answer</p>
              <div class="field">
                <span class="lbl" id="type-lbl" i18n="@@qedit.answer_type">Answer type</span>
                <!-- Typed reactive control, not ngModel (Principle XXII / A16).
                     A radiogroup rather than a dropdown: four options are worth
                     showing at once, and the choice changes the rest of the form. -->
                <div class="type-group" role="radiogroup" aria-labelledby="type-lbl">
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
                    The answer type can't change once applicants have answered this question —
                    their stored answers would no longer match it. Add a new question instead.
                  </p>
                }
              </div>

              <!-- Per-type rules. Only the owning type's block is rendered, so the
                   form cannot express a combination the server rejects with
                   QUESTION_TYPE_RULES_INVALID. -->
              @if (selectedType() === 'NUMERIC') {
                <div formGroupName="numeric" class="rule-box">
                  <div class="field-row">
                    <label class="field grow">
                      <span class="lbl" i18n="@@qedit.num_min">Minimum</span>
                      <input nz-input formControlName="minValue" inputmode="decimal" placeholder="1000" />
                    </label>
                    <label class="field grow">
                      <span class="lbl" i18n="@@qedit.num_max">Maximum</span>
                      <input nz-input formControlName="maxValue" inputmode="decimal" placeholder="20000000" />
                    </label>
                  </div>
                  <div class="field-row">
                    <label class="field grow">
                      <span class="lbl" i18n="@@qedit.num_step">Step</span>
                      <input nz-input formControlName="step" inputmode="decimal" placeholder="1000" />
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
                    Bounds are inclusive, and the step counts up from the minimum. Leave a field
                    empty for no limit.
                  </p>
                </div>
              } @else if (selectedType() === 'TEXT') {
                <div formGroupName="text" class="rule-box">
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.text_max">Maximum length</span>
                    <nz-input-number formControlName="maxLength" [nzMin]="1" [nzMax]="2000" />
                  </label>
                  <p class="hint" i18n="@@qedit.text_hint">
                    Free text is never written to logs, because applicants may type personal
                    details into it.
                  </p>
                </div>
              } @else {
                <p class="hint" i18n="@@qedit.choice_hint">
                  Add the answer options on the question card after saving — at least two are
                  needed before this question can be published.
                </p>
              }
              @if (!isChoice(selectedType())) {
                <p class="hint warn" i18n="@@qedit.not_scoreable">
                  Only single-choice questions carry scoring weights, so this question won't
                  affect approval probability.
                </p>
              }

              <p class="section-lbl" i18n="@@qedit.sec_behaviour">Behaviour</p>
              <div class="field-row">
                <label class="field grow">
                  <span class="lbl" i18n="@@qedit.order">Display order</span>
                  <nz-input-number formControlName="displayOrder" [nzMin]="0" />
                </label>
                <label class="switch-field">
                  <nz-switch formControlName="isRequired" />
                  <span i18n="@@qedit.required">Required</span>
                </label>
              </div>

              <div class="form-actions">
                <button type="button" nz-button (click)="cancel()" i18n="@@qedit.cancel">Cancel</button>
                <button nz-button nzType="primary" [disabled]="questionForm.invalid" i18n="@@qedit.save_q">
                  Save question
                </button>
              </div>
            </form>
          } @else {
            <form [formGroup]="optionForm" class="form" (ngSubmit)="submitOption()">
              <label class="field">
                <span class="lbl" i18n="@@qedit.label_en">Label (English)</span>
                <input nz-input formControlName="labelEn" placeholder="e.g. 20,000 – 40,000" />
              </label>
              <label class="field">
                <span class="lbl" i18n="@@qedit.label_ar">التسمية (عربي)</span>
                <input nz-input formControlName="labelAr" dir="rtl" placeholder="مثال: ٢٠٬٠٠٠ – ٤٠٬٠٠٠" />
              </label>
              <label class="field">
                <span class="lbl" i18n="@@qedit.order">Display order</span>
                <nz-input-number formControlName="displayOrder" [nzMin]="0" />
              </label>

              <div class="form-actions">
                <button type="button" nz-button (click)="cancel()" i18n="@@qedit.cancel">Cancel</button>
                <button nz-button nzType="primary" [disabled]="optionForm.invalid" i18n="@@qedit.save_o">
                  Save option
                </button>
              </div>
            </form>
          }
        </div>
      </aside>
    }
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
      }
      .page {
        padding: var(--space-6, 32px);
        inline-size: 100%;
        background: var(--color-surface-page, #f8f6f4);
        min-block-size: 100%;
      }

      /* Hero — quiet surface card. */
      .hero {
        position: relative;
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-radius: var(--qe-radius);
        margin-block-end: var(--space-6, 32px);
      }
      .hero-inner {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4, 16px);
        flex-wrap: wrap;
        padding: var(--space-5, 24px) var(--space-6, 32px);
      }
      .title-text {
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
      .stats {
        margin: var(--space-3, 12px) 0 0;
        color: var(--qe-text-2);
        font-size: var(--text-sm, 14px);
        font-variant-numeric: tabular-nums;
      }
      .stats strong {
        margin-inline-end: 4px;
        color: var(--qe-text);
        font-weight: 700;
      }
      .stats .dot {
        margin-inline: 8px;
        color: var(--qe-line);
      }
      .stats .muted {
        color: var(--qe-muted);
      }
      .hero-actions {
        display: flex;
        gap: var(--space-3, 12px);
        flex-wrap: wrap;
      }

      /* Layout — master-detail: outline rail (left) + editing canvas (right). */
      .tree {
        min-inline-size: 0;
      }
      .workbench {
        display: grid;
        grid-template-columns: minmax(240px, 288px) minmax(0, 1fr);
        gap: var(--space-5, 24px);
        align-items: start;
        min-inline-size: 0;
        animation: qe-fade var(--motion-duration-base, 180ms) var(--motion-easing-standard, ease);
      }
      @media (prefers-reduced-motion: reduce) {
        .workbench {
          animation: none;
        }
      }

      .outline {
        position: sticky;
        inset-block-start: var(--space-5, 24px);
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
        max-block-size: calc(100vh - var(--space-7, 48px));
        overflow-y: auto;
        padding: var(--space-3, 12px);
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-radius: var(--qe-radius);
      }
      .outline-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2, 8px);
        margin: 0;
        padding-inline: var(--space-2, 8px);
        padding-block-end: var(--space-2, 8px);
        border-block-end: 1px solid var(--qe-line);
        font-size: var(--text-xs, 12px);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--qe-muted);
      }
      .head-total {
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
        color: var(--cat);
        background: color-mix(in srgb, var(--cat) 12%, transparent);
        padding: 2px 8px;
        border-radius: var(--radius-pill, 999px);
      }
      .grp-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .grp-row {
        inline-size: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2, 8px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        border: 0;
        border-inline-start: 3px solid transparent;
        border-radius: var(--radius-md, 8px);
        background: transparent;
        color: var(--qe-text-2);
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        text-align: start;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast, 120ms) ease,
          color var(--motion-duration-fast, 120ms) ease;
      }
      .grp-row:hover {
        background: var(--qe-surface-muted);
        color: var(--qe-text);
      }
      .grp-row:focus-visible {
        outline: 2px solid var(--cat);
        outline-offset: -2px;
      }
      .grp-row.active {
        border-inline-start-color: var(--cat);
        background: color-mix(in srgb, var(--cat) 8%, transparent);
        color: var(--qe-text);
      }
      .grp-name {
        flex: 1;
        min-inline-size: 0;
        overflow-wrap: anywhere;
        white-space: normal;
      }
      .add-grp {
        margin-block-start: var(--space-2, 8px);
        justify-content: flex-start;
        color: var(--qe-muted);
      }
      .add-grp:hover {
        color: var(--cat);
      }

      .canvas {
        min-inline-size: 0;
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-radius: var(--qe-radius);
        padding: var(--space-5, 24px);
      }
      .canvas-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3, 12px);
        flex-wrap: wrap;
      }
      .ch-title {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        min-inline-size: 0;
      }
      .ch-title h2 {
        margin: 0;
        font-family: var(--heading-font, var(--font-sans));
        font-size: var(--text-lg, 18px);
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--qe-text);
      }
      .ch-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        flex-shrink: 0;
      }

      @media (max-width: 960px) {
        .workbench {
          grid-template-columns: 1fr;
        }
        .outline {
          position: static;
          max-block-size: none;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
        }
        .outline-head {
          flex-basis: 100%;
        }
        .grp-list {
          flex-direction: row;
          flex-wrap: wrap;
          flex: 1;
        }
        .grp-row {
          inline-size: auto;
          min-block-size: 44px;
          border-inline-start: 0;
          border: 1px solid var(--qe-line);
        }
        .grp-row.active {
          border-color: var(--cat);
        }
      }
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
      .count-pill {
        min-inline-size: 24px;
        text-align: center;
        font-size: var(--text-xs, 12px);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--cat);
        background: color-mix(in srgb, var(--cat) 12%, transparent);
        padding: 2px 8px;
        border-radius: var(--radius-pill, 999px);
      }
      .q-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-4, 16px);
        margin-block-start: var(--space-5, 24px);
      }
      .q-card {
        position: relative;
        border: 1px solid var(--qe-line);
        border-radius: var(--radius-md, 8px);
        padding: var(--space-4, 16px) var(--space-5, 24px);
        background: var(--color-surface-page, #f8f6f4);
        transition: border-color var(--motion-duration-base, 160ms) ease;
      }
      .q-card:hover {
        border-color: var(--qe-line-strong);
      }
      .q-top {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
      }
      .q-text {
        font-weight: 600;
        font-size: var(--text-sm, 14px);
        flex: 1;
        min-inline-size: 0;
        color: var(--qe-text);
      }
      .q-ord {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        inline-size: 22px;
        block-size: 22px;
        border-radius: var(--radius-pill, 999px);
        font-size: 11px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--cat);
        background: color-mix(in srgb, var(--cat) 12%, transparent);
      }
      .opt-meta {
        margin: var(--space-3, 12px) 0 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--qe-muted);
        font-variant-numeric: tabular-nums;
      }
      .req {
        font-size: 11px;
        font-weight: 600;
        color: var(--color-warning, #c8893d);
        background: color-mix(in srgb, var(--color-warning, #c8893d) 14%, transparent);
        padding: 1px 7px;
        border-radius: var(--radius-pill, 999px);
      }
      .opts {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .opt-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-inline-size: 100%;
        padding: 4px 8px 4px 12px;
        font-size: 13px;
        color: var(--qe-text-2);
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-radius: var(--radius-pill, 999px);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast, 120ms) ease,
          color var(--motion-duration-fast, 120ms) ease,
          background var(--motion-duration-fast, 120ms) ease;
      }
      .opt-chip:hover,
      .opt-chip:focus-visible {
        color: var(--qe-text);
        border-color: var(--cat);
        background: color-mix(in srgb, var(--cat) 6%, transparent);
      }
      .opt-label {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .opt-caret {
        flex-shrink: 0;
        font-size: 10px;
        color: var(--qe-muted);
        transition: color var(--motion-duration-fast, 120ms) ease;
      }
      .opt-chip:hover .opt-caret,
      .opt-chip:focus-visible .opt-caret {
        color: var(--cat);
      }
      .add-opt-chip {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        font-size: 13px;
        font-weight: 600;
        color: var(--qe-muted);
        background: transparent;
        border: 1px dashed var(--qe-line-strong);
        border-radius: var(--radius-pill, 999px);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast, 120ms) ease,
          color var(--motion-duration-fast, 120ms) ease;
      }
      .add-opt-chip:hover,
      .add-opt-chip:focus-visible {
        color: var(--cat);
        border-color: var(--cat);
      }
      .empty-line {
        color: var(--qe-muted);
        font-style: italic;
        font-size: 13px;
        margin: var(--space-2, 8px) 0 0;
      }
      .empty-line.tiny {
        font-size: 12px;
        margin-block-start: 4px;
      }

      /* Inspector drawer — docked inline-end; scrim is click-capture on desktop,
         a real dimming backdrop on mobile (A34). */
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 1000;
        animation: qe-fade 160ms ease;
      }
      .drawer {
        position: fixed;
        z-index: 1001;
        inset-block: 0;
        inset-inline-end: 0;
        inline-size: min(440px, 100vw);
        background: var(--bg-surface, var(--qe-surface));
        border-inline-start: 1px solid var(--qe-line);
        box-shadow: var(--shadow-xl, 0 24px 64px rgba(16, 24, 40, 0.24));
        overflow-y: auto;
        animation: qe-slide 200ms var(--motion-easing-standard, cubic-bezier(0.2, 0, 0, 1));
      }
      @media (max-width: 960px) {
        .scrim {
          background: var(--color-overlay-backdrop, rgba(16, 24, 40, 0.45));
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
        }
      }
      @keyframes qe-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes qe-slide {
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
        .scrim,
        .drawer {
          animation: none;
        }
        .q-card {
          transition: none;
        }
      }
      .ins-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
        padding: var(--space-5, 24px);
      }
      .ins-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2, 8px);
      }
      .ins-head h3 {
        margin: 0;
        font-size: var(--text-lg, 18px);
        font-weight: var(--font-weight-semibold, 600);
        color: var(--color-text-primary, #1a2433);
      }
      .ins-note {
        font-size: 12px;
        color: var(--qe-muted);
        margin: 0;
        padding: var(--space-2, 8px) var(--space-3, 12px);
        background: color-mix(in srgb, var(--cat) 10%, transparent);
        border-radius: var(--radius-md, 8px);
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
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
        padding-block-end: 6px;
        font-size: 13px;
      }
      .section-lbl {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--qe-muted);
        margin: var(--space-3, 12px) 0 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2, 8px);
        margin-block-start: var(--space-2, 8px);
        padding-block-start: var(--space-3, 12px);
        border-block-start: 1px solid var(--color-border-default, var(--qe-line));
      }
      nz-input-number,
      nz-select {
        inline-size: 100%;
      }

      /* ---- Feature 010: answer types ---------------------------------- */
      .binding-alert {
        margin-block-end: var(--space-5, 24px);
      }
      .binding-list {
        margin: 0;
        padding-inline-start: var(--space-4, 16px);
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--text-sm, 14px);
      }
      .binding-list code {
        margin-inline-end: var(--space-2, 8px);
        font-variant-numeric: tabular-nums;
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
      @media (prefers-reduced-motion: reduce) {
        .type-btn {
          transition: none;
        }
      }

      .type-chip {
        flex-shrink: 0;
        font-size: var(--text-xs, 12px);
        font-weight: 600;
        color: var(--cat);
        background: color-mix(in srgb, var(--cat) 12%, transparent);
        padding: 1px 8px;
        border-radius: var(--radius-pill, 999px);
      }
      /* Value types read as neutral: they carry no scoring weight, so they should
         not wear the brand accent that marks a scoreable question. */
      .type-chip.value-type {
        color: var(--qe-text-2);
        background: var(--qe-surface-muted);
      }

      .rule-box {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
        padding: var(--space-3, 12px);
        background: var(--qe-surface-muted);
        border-radius: var(--radius-md, 8px);
      }
      .rule-line {
        margin: var(--space-3, 12px) 0 0;
        font-size: var(--text-sm, 14px);
        color: var(--qe-text-2);
        font-variant-numeric: tabular-nums;
      }
      .rule-line.warn {
        color: var(--color-warning, var(--ant-warning-color));
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
    `,
  ],
})
export class QuestionnaireEditorPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly errorCodes = inject(ErrorCodeService);

  /** Active admin locale drives label language (ar build → Arabic, else English). */
  readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /** The single global pool of groups (each with its questions + options). */
  readonly groups = signal<GroupTreeRow[]>([]);
  /** Whether a questionnaire version is currently published (LIVE chip). */
  readonly published = signal(false);
  readonly loading = signal(true);
  readonly mode = signal<Mode>(null);
  /** true → drawer is editing an existing node; false → creating a new one. */
  readonly editing = signal(false);
  readonly totalQuestions = computed(() =>
    this.groups().reduce((sum, g) => sum + g.questions.length, 0),
  );

  /** Master-detail selection: which group the canvas is editing (falls back to first). */
  readonly selectedGroupId = signal<string>('');
  readonly selectedGroup = computed<GroupTreeRow | null>(() => {
    const list = this.groups();
    return list.find((g) => g.id === this.selectedGroupId()) ?? list[0] ?? null;
  });
  selectGroup(g: GroupTreeRow): void {
    this.selectedGroupId.set(g.id);
  }

  private activeGroupId = '';
  private activeQuestionId = '';
  /** Id of the node being edited (empty in create mode). */
  private editingId = '';

  // ---- Feature 010: answer types ------------------------------------------
  readonly types = TYPE_ORDER;
  /** Mirrors `questionForm.controls.type` so the template can react to it. */
  readonly selectedType = signal<QuestionType>('SINGLE_SELECT');
  /** Standing money-binding warnings for the whole pool (FR-048/FR-049). */
  readonly bindingWarnings = signal<PublishWarning[]>([]);
  /**
   * A question that already carries answers cannot change type: the stored
   * answers would no longer match their question's shape.
   */
  readonly typeLocked = signal(false);

  isChoice(type: QuestionType): boolean {
    return isChoiceQuestionType(type);
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
      const min = q.numericMinValue ?? '—';
      const max = q.numericMaxValue ?? '—';
      return $localize`:@@qedit.rule_numeric:Number from ${min}:min: to ${max}:max: ${unit}:unit:`;
    }
    return '';
  }

  pickType(type: QuestionType): void {
    if (this.typeLocked()) return;
    this.questionForm.controls.type.setValue(type);
    this.selectedType.set(type);
  }

  /** Live guard mirroring the server's `numeric.maxValue` rule, for fast feedback. */
  numericRangeInverted(): boolean {
    const { minValue, maxValue } = this.questionForm.controls.numeric.getRawValue();
    if (!minValue || !maxValue) return false;
    const min = Number(minValue);
    const max = Number(maxValue);
    return Number.isFinite(min) && Number.isFinite(max) && max < min;
  }

  /** `meta.binding` names which of the four money figures is unclaimed. */
  bindingOf(w: PublishWarning): string {
    return String(w.meta['binding'] ?? w.meta['questionCode'] ?? '');
  }

  /** Localized via the shared error-code catalog — no per-component mapping (A22). */
  warningMessage(w: PublishWarning): string {
    return this.errorCodes.toLocalizedMessage(w.code as never, w.meta);
  }

  readonly groupForm = new FormGroup({
    titleEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    titleAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
  });
  readonly questionForm = new FormGroup({
    questionEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    questionAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
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
  });
  readonly optionForm = new FormGroup({
    labelEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    labelAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  cancel(): void {
    this.mode.set(null);
  }

  startGroup(): void {
    this.editingId = '';
    this.editing.set(false);
    this.groupForm.reset({ titleEn: '', titleAr: '', displayOrder: this.groups().length });
    this.mode.set('group');
  }
  editGroup(g: GroupTreeRow): void {
    this.editingId = g.id;
    this.editing.set(true);
    this.groupForm.reset({ titleEn: g.titleEn, titleAr: g.titleAr, displayOrder: g.displayOrder });
    this.mode.set('group');
  }

  startQuestion(g: GroupTreeRow): void {
    this.activeGroupId = g.id;
    this.editingId = '';
    this.editing.set(false);
    this.typeLocked.set(false);
    this.selectedType.set('SINGLE_SELECT');
    this.questionForm.reset({
      displayOrder: g.questions.length,
      isRequired: true,
      type: 'SINGLE_SELECT',
      numeric: { minValue: '', maxValue: '', step: '', unitEn: '', unitAr: '' },
      text: { maxLength: null },
    } as never);
    this.mode.set('question');
  }
  editQuestion(q: QuestionRow): void {
    this.editingId = q.id;
    this.editing.set(true);
    // Changing the type of an answered question would orphan those answers, so
    // the picker locks. Options are the admin's signal that answers may exist;
    // the server is the authority and rejects the change regardless.
    this.typeLocked.set(true);
    this.selectedType.set(q.type);
    this.questionForm.reset({
      questionEn: q.questionEn,
      questionAr: q.questionAr,
      displayOrder: q.displayOrder,
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
    } as never);
    this.mode.set('question');
  }

  startOption(questionId: string): void {
    this.activeQuestionId = questionId;
    this.editingId = '';
    this.editing.set(false);
    this.optionForm.reset({ displayOrder: 0 } as never);
    this.mode.set('option');
  }
  editOption(o: OptionRow): void {
    this.editingId = o.id;
    this.editing.set(true);
    this.optionForm.reset({
      labelEn: o.labelEn,
      labelAr: o.labelAr,
      displayOrder: o.displayOrder,
    } as never);
    this.mode.set('option');
  }

  async submitGroup(): Promise<void> {
    if (this.groupForm.invalid) return;
    const v = this.groupForm.getRawValue();
    if (this.editing()) {
      await this.api.updateGroup(this.editingId, {
        titleEn: v.titleEn,
        titleAr: v.titleAr,
        displayOrder: v.displayOrder,
      });
      this.message.success($localize`:@@qedit.group_saved:Group saved`);
    } else {
      const created = await this.api.createGroup(v);
      // Jump the canvas to the group just created.
      this.selectedGroupId.set(created.id);
      this.message.success($localize`:@@qedit.group_added:Group added`);
    }
    this.mode.set(null);
    await this.reload();
  }

  async submitQuestion(): Promise<void> {
    if (this.questionForm.invalid || this.numericRangeInverted()) return;
    const v = this.questionForm.getRawValue();
    // Send only the rule block the chosen type owns. Sending both would fail the
    // server's QUESTION_TYPE_RULES_INVALID check; sending `null` clears the other.
    const rules = {
      numeric: v.type === 'NUMERIC' ? blankToNull(v.numeric) : null,
      text:
        v.type === 'TEXT'
          ? { maxLength: v.text.maxLength ?? undefined }
          : null,
    };
    if (this.editing()) {
      // `code` is immutable (A33) — never sent. `type` is not sent either: it is
      // locked in edit mode, because answers already reference this shape.
      await this.api.updateQuestion(this.editingId, {
        questionEn: v.questionEn,
        questionAr: v.questionAr,
        displayOrder: v.displayOrder,
        isRequired: v.isRequired,
        ...rules,
      });
      this.message.success($localize`:@@qedit.question_saved:Question saved`);
    } else {
      await this.api.createQuestion({
        groupId: this.activeGroupId,
        questionEn: v.questionEn,
        questionAr: v.questionAr,
        displayOrder: v.displayOrder,
        isRequired: v.isRequired,
        type: v.type,
        ...rules,
      });
      this.message.success($localize`:@@qedit.question_added:Question added`);
    }
    this.mode.set(null);
    await this.reload();
  }

  async submitOption(): Promise<void> {
    if (this.optionForm.invalid) return;
    const v = this.optionForm.getRawValue();
    if (this.editing()) {
      await this.api.updateOption(this.editingId, {
        labelEn: v.labelEn,
        labelAr: v.labelAr,
        displayOrder: v.displayOrder,
      });
      this.message.success($localize`:@@qedit.option_saved:Option saved`);
    } else {
      await this.api.createOption(this.activeQuestionId, {
        labelEn: v.labelEn,
        labelAr: v.labelAr,
        displayOrder: v.displayOrder,
      });
      this.message.success($localize`:@@qedit.option_added:Option added`);
    }
    this.mode.set(null);
    await this.reload();
  }

  // ---- Deletes (soft-delete server-side; typed-error toasts via interceptor) --
  confirmDeleteGroup(g: GroupTreeRow): void {
    this.modal.confirm({
      nzTitle: $localize`:@@qedit.del_group_title:Delete this group?`,
      // Name the target AND the consequence: the delete is a deactivation, and it
      // is refused while the group still holds questions.
      nzContent: $localize`:@@qedit.del_group_body:"${
        this.isAr ? g.titleAr : g.titleEn
      }:name:" will be hidden from the questionnaire. Answers already given are kept. Move or delete its questions first — a group that still holds questions can't be deleted.`,
      nzCentered: true,
      nzIconType: 'delete',
      nzOkText: $localize`:@@qedit.del_ok:Delete`,
      nzOkDanger: true,
      nzCancelText: $localize`:@@qedit.del_cancel:Cancel`,
      nzOnOk: async () => {
        try {
          await this.api.deleteGroup(g.id);
          this.message.success($localize`:@@qedit.group_deleted:Group deleted`);
          await this.reload();
        } catch {
          /* blocked / failed — localized toast already shown by the interceptor */
        }
      },
    });
  }

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
          await this.reload();
        } catch {
          /* blocked / failed — localized toast already shown by the interceptor */
        }
      },
    });
  }

  /** Load the global tree + published state. */
  private async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [tree, history, warnings] = await Promise.all([
        this.api.tree(),
        this.api.versionHistory(),
        this.api.bindingWarnings(),
      ]);
      this.groups.set(tree ?? []);
      this.published.set((history ?? []).some((v) => v.isActive));
      this.bindingWarnings.set(warnings ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  /** After a mutation, re-fetch the tree. Every mutation auto-publishes server-side. */
  private async reload(): Promise<void> {
    const [tree, warnings] = await Promise.all([this.api.tree(), this.api.bindingWarnings()]);
    this.groups.set(tree ?? []);
    this.published.set(true);
    this.bindingWarnings.set(warnings ?? []);
  }
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
