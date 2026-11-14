/**
 * A no-payslip product, on ONE page (v37.0.0).
 *
 * Four steps — Name · Questions · Amount · Who can't get it — and a "Try it as a customer"
 * panel beside every one of them that re-prices on each edit, unsaved edits included (the
 * server compiles the form exactly as a preview does and runs it; nothing is stored).
 *
 * WHAT IT WRITES is what the page it replaced wrote, through the same endpoints: the names,
 * what the product asks, the calculation (`ProductTemplatePage`, mounted once), the duration,
 * the loan size and the plan tables. One Save, in dependency order: a question is asked before
 * the calculation reads it, and stops being asked only after the calculation stops reading it.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  LOCALE_ID,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  FormDrawerComponent,
  RailTabsComponent,
  openFormDrawer,
  type RailTabItem,
} from '@shared/ui';
import {
  PlanRowsEditorComponent,
  type PlanRemoveRequest,
} from '@shared/ui/plan-rows-editor.component';
import { planRowsErrorFor, planRowsFrom } from '@shared/ui/plan-rows.rules';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import {
  registryFacts,
  type PlanDefaults,
  type ProductAsksBoard,
  type SurrogateProductDetail,
} from '@features/bank-programs/bank-programs.types';
import { EngineRulesApiService } from '../questionnaire/engine-rules/engine-rules.api.service';
import { surrogateBoardLink } from './program-catalog.paths';
import { askSections, type AskCard } from './product-asks';
import {
  ServedPagesComponent,
  type QuestionBasis,
  type ServedRowState,
} from './served-pages.component';
import { AddableQuestionsComponent, type AddableRow } from './addable-questions.component';
import type { ServedPage } from '@shared/questions/asked-questions.rules';
import type { FixedServedOn } from '@core/income-basis';
import { ProductTemplatePage } from './product-template.page';
import {
  DeleteProductDialogComponent,
  type DeleteProductDialogData,
} from './delete-product.dialog';
import {
  SellAsProgramDrawerComponent,
  type SellAsProgramDrawerData,
  type SellAsProgramDrawerResult,
} from './sell-as-program.drawer';

type StepKey = 'name' | 'questions' | 'amount' | 'rules';

@Component({
  selector: 'app-product-studio-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ProductTemplatePage,
    PlanRowsEditorComponent,
    RailTabsComponent,
    ServedPagesComponent,
    FormDrawerComponent,
    AddableQuestionsComponent,
  ],
  template: `
    <section class="studio-page">
      <a class="back" [routerLink]="backLink.commands" [queryParams]="backLink.queryParams">
        <span aria-hidden="true">←</span> <span i18n="@@spd.back">All surrogate products</span>
      </a>

      @if (loading()) {
        <p class="muted" i18n="@@ps.loading">Loading…</p>
      } @else if (product()) {
        @let p = product()!;
        <header class="ph">
          <div class="ph-names">
            <h1>{{ nameForm.controls.labelEn.value || p.labelEn }}</h1>
            <span class="ar" dir="rtl">{{ nameForm.controls.labelAr.value || p.labelAr }}</span>
          </div>
          <div class="ph-act">
            @if (p.active) {
              <span class="pill live" i18n="@@ps.live">Live</span>
            } @else {
              <span class="pill" i18n="@@ps.draft">Draft</span>
            }
            @if (changeCount() > 0) {
              <button
                type="button"
                class="btn"
                (click)="discardAll()"
                [disabled]="saving()"
                i18n="@@ps.discard"
              >
                Discard
              </button>
              <button
                type="button"
                class="btn primary"
                (click)="requestSave()"
                [disabled]="saving() || saveBlock() !== null"
                [attr.title]="saveBlock()"
              >
                @if (saving()) {
                  <span i18n="@@ps.saving">Saving…</span>
                } @else {
                  <span i18n="@@ps.save">Save changes</span>
                }
              </button>
            } @else if (p.active) {
              <button type="button" class="btn" (click)="confirmOff()" i18n="@@ps.switch_off">
                Switch off
              </button>
            } @else {
              <button
                type="button"
                class="btn primary"
                (click)="setActive(true)"
                i18n="@@ps.go_live"
              >
                Go live
              </button>
            }
            <div class="menu">
              <button
                type="button"
                class="btn icon"
                [attr.aria-expanded]="menuOpen()"
                (click)="menuOpen.set(!menuOpen())"
                [attr.aria-label]="moreAria"
              >
                ⋯
              </button>
              @if (menuOpen()) {
                <div class="menu-pop" role="menu">
                  @if (!p.capOnly) {
                    <button type="button" role="menuitem" (click)="openSell()" i18n="@@ps.sell">
                      Sell it as a program
                    </button>
                  }
                  <button
                    type="button"
                    role="menuitem"
                    class="danger"
                    (click)="openDelete()"
                    i18n="@@ps.delete"
                  >
                    Delete product
                  </button>
                </div>
              }
            </div>
          </div>
        </header>
        @if (saveError(); as err) {
          <p class="err" role="alert">{{ err }}</p>
        } @else if (saveBlock()) {
          <p class="warn">{{ saveBlock() }}</p>
        }

        <div class="studio">
          <div class="main">
            <ol class="steps">
              @for (s of steps(); track s.key; let i = $index) {
                <li>
                  <button
                    type="button"
                    class="step"
                    [class.on]="i === stepIndex()"
                    [class.done]="i < stepIndex()"
                    [attr.aria-current]="i === stepIndex() ? 'step' : null"
                    (click)="goTo(i)"
                  >
                    <span class="num">{{ i < stepIndex() ? '✓' : i + 1 }}</span>
                    <span class="sl">{{ s.label }}</span>
                  </button>
                </li>
              }
            </ol>

            @switch (step()) {
              @case ('name') {
                <section class="blk">
                  <h2 i18n="@@ps.called">What is it called?</h2>
                  <div class="names" [formGroup]="nameForm">
                    <label class="fl"
                      ><span i18n="@@ps.name_en">Name in English</span
                      ><input formControlName="labelEn" />
                    </label>
                    <label class="fl"
                      ><span i18n="@@ps.name_ar">Name in Arabic</span
                      ><input formControlName="labelAr" dir="rtl" />
                    </label>
                  </div>
                </section>
              }
              @case ('questions') {
                <section class="blk">
                  <div class="blk-h">
                    <h2 i18n="@@ps.asked_title">What applicants are asked</h2>
                    <button
                      type="button"
                      class="btn"
                      (click)="openAddSheet()"
                      i18n="@@ps.add_questions"
                    >
                      + Add questions
                    </button>
                  </div>
                  <app-rail-tabs
                    class="asktabs"
                    appearance="segmented"
                    [uniform]="true"
                    idPrefix="ps-asktab"
                    [items]="askTabs()"
                    [activeId]="askTab()"
                    [ariaLabel]="askTabsAria"
                    (select)="pickAskTab($event)"
                  />
                  <p class="hint">
                    @if (askTab() === 'fixed') {
                      <span i18n="@@spd.asktab_fixed_hint"
                        >Asked on every program. Change them on Questionnaire.</span
                      >
                    } @else if (askTab() === 'all') {
                      <span i18n="@@ps.asktab_all_hint"
                        >Everything this product's customers are asked: the fixed questions, then
                        the ones added here.</span
                      >
                    } @else {
                      <span i18n="@@ps.asktab_added_hint"
                        >Asked only on this product. Removing one also takes it out of the amount
                        and the rules.</span
                      >
                    }
                  </p>
                  @if (askTab() === 'other' && ownCards().length === 0) {
                    <p class="hint">
                      <span i18n="@@spd.asktab_added_empty">No questions added yet.</span>
                      <button
                        type="button"
                        class="link"
                        (click)="openAddSheet()"
                        i18n="@@ps.add_questions"
                      >
                        + Add questions
                      </button>
                    </p>
                  } @else {
                    <div class="served">
                      <app-served-pages
                        [pages]="askedPages()"
                        [isAr]="isAr"
                        [states]="askedStates()"
                        [basis]="askedBasis()"
                        [editable]="!saving()"
                        (remove)="removeByCode($event)"
                      />
                    </div>
                  }
                </section>
              }
              @case ('amount') {
                @if (!p.capOnly) {
                  <section class="blk">
                    <h2 i18n="@@ps.means">What does the amount mean?</h2>
                    @if (calc()) {
                      @let c = calc()!;
                      <div class="seg" role="radiogroup" [attr.aria-label]="meansAria">
                        <button
                          type="button"
                          role="radio"
                          [attr.aria-checked]="c.form.controls.outputKind.value === 'monthlyIncome'"
                          (click)="setOutput('monthlyIncome')"
                          i18n="@@ps.means_income"
                        >
                          A salary we count for them
                        </button>
                        <button
                          type="button"
                          role="radio"
                          [attr.aria-checked]="c.form.controls.outputKind.value === 'maxAmount'"
                          (click)="setOutput('maxAmount')"
                          i18n="@@ps.means_limit"
                        >
                          The biggest loan they can get
                        </button>
                      </div>
                      @if (c.form.controls.outputKind.value === 'maxAmount') {
                        <p class="hint" i18n="@@ps.means_limit_eg">
                          The loan itself: e.g. a Mivida owner can borrow up to EGP 6,000,000.
                        </p>
                      } @else {
                        <p class="hint" i18n="@@ps.means_income_eg">
                          Like a payslip: e.g. a Colonel counts as earning EGP 45,000 a month. Each
                          bank then works out the loan from it.
                        </p>
                      }
                    }
                  </section>
                }
                @if (p.capOnly) {
                  <section class="blk">
                    <h2 i18n="@@ps.cap_title">Which answer sets the cap?</h2>
                    <p class="hint" i18n="@@ps.cap_body">
                      Each bank sets the biggest payslip loan for each answer of the questions this
                      product asks, on its own program.
                    </p>
                  </section>
                }
              }
            }

            <!-- The calculation: mounted ONCE, so an edit survives moving between steps. -->
            @if (!p.capOnly) {
              <div class="calc-host" [class.hide]="step() !== 'amount' && step() !== 'rules'">
                <app-product-template-page
                  [embeddedKey]="p.key"
                  [part]="step() === 'rules' ? 'rules' : 'amount'"
                  [askedCodes]="askedCodes()"
                  [fixedCodes]="fixedCodeList()"
                  (goQuestions)="goTo(1)"
                />
              </div>
            }

            @if (step() === 'amount' && !p.capOnly) {
              @if (!limitsOpen()) {
                <button
                  type="button"
                  class="link"
                  (click)="limitsOpen.set(true)"
                  i18n="@@ps.limits_add"
                >
                  + Loan limits (optional): debt burden, duration, loan size, plans by down payment
                </button>
              } @else {
                <section class="blk">
                  <h2>
                    <span i18n="@@ps.limits">Loan limits</span>
                    <small class="muted" i18n="@@ps.limits_note"
                      >optional — each bank starts from these</small
                    >
                  </h2>
                  @if (calc(); as c) {
                    @if (c.form.controls.outputKind.value === 'maxAmount') {
                      <p class="line">
                        <span i18n="@@ps.dbr_a">A monthly payment can take up to</span>
                        <input
                          class="edge"
                          inputmode="decimal"
                          [value]="c.form.controls.baselineDbrPercent.value"
                          (change)="c.form.controls.baselineDbrPercent.setValue(val($event))"
                          [placeholder]="bankSets"
                          [attr.aria-label]="dbrAria"
                        />
                        <span i18n="@@ps.dbr_b">% of their income</span>
                      </p>
                    }
                  }
                  <p class="line">
                    <span i18n="@@ps.months_a">Pay back over</span>
                    <input
                      class="edge"
                      inputmode="numeric"
                      [value]="tenorMin()"
                      (change)="setTerm('tenorMin', val($event))"
                      [attr.aria-label]="fromAria"
                    />
                    <span i18n="@@ps.to">to</span>
                    <input
                      class="edge"
                      inputmode="numeric"
                      [value]="tenorMax()"
                      (change)="setTerm('tenorMax', val($event))"
                      [attr.aria-label]="toAria"
                    />
                    <span i18n="@@ps.months_b">months</span>
                  </p>
                  <p class="line">
                    <span i18n="@@ps.lend_a">Lend from EGP</span>
                    <input
                      class="edge wide"
                      inputmode="decimal"
                      [value]="fmt(amountMin())"
                      (change)="setTerm('amountMin', val($event))"
                      [attr.aria-label]="fromAria"
                    />
                    <span i18n="@@ps.to">to</span>
                    <input
                      class="edge wide"
                      inputmode="decimal"
                      [value]="fmt(amountMax())"
                      (change)="setTerm('amountMax', val($event))"
                      [attr.aria-label]="toAria"
                    />
                  </p>
                  @if (termError(); as e) {
                    <p class="warn">{{ e }}</p>
                  }
                  @if (planTable() !== null) {
                    <p class="hint" i18n="@@ps.plans">Plans by down payment</p>
                    <app-plan-rows-editor
                      [grids]="planValue()"
                      [facts]="facts()"
                      (gridsChange)="onPlans($event)"
                      (removeRequest)="onPlanRemove($event)"
                    />
                  } @else if (planValue() === null && readsDownPayment()) {
                    <button type="button" class="link" (click)="startPlans()" i18n="@@ps.plans_add">
                      + Plans by down payment (rate, longest term, share financed)
                    </button>
                  } @else if (planValue() !== null) {
                    <p class="hint" i18n="@@ps.plans_other">
                      This product's plan tables cannot be shown as one table here.
                    </p>
                  }
                </section>
              }
            }

            <div class="foot">
              @if (stepIndex() > 0) {
                <button type="button" class="btn" (click)="goTo(stepIndex() - 1)" i18n="@@ps.back">
                  Back
                </button>
              } @else {
                <span></span>
              }
              @if (stepIndex() < steps().length - 1) {
                <button type="button" class="btn primary" (click)="goTo(stepIndex() + 1)">
                  {{ nextLabel() }}
                </button>
              }
            </div>
          </div>
        </div>
      } @else {
        <p class="err" i18n="@@ps.not_found">This product could not be found.</p>
      }
    </section>

    <ng-template #addSheet>
      <app-form-drawer
        [title]="addSheetTitle"
        [subtitle]="addSheetSub"
        [submitLabel]="doneLabel"
        [showCancel]="false"
        (cancelled)="closeAddSheet()"
        (submitted)="closeAddSheet()"
      >
        <app-addable-questions [rows]="addableRows()" (add)="addByCode($event.code)" />
      </app-form-drawer>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .studio-page {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding-block: var(--space-4) var(--space-8);
      }
      .back {
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: var(--text-sm);
        align-self: flex-start;
      }
      .back:hover {
        color: var(--color-text-link);
      }
      .muted,
      .hint {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .pad {
        padding: var(--space-2);
      }
      .err {
        margin: 0;
        color: var(--color-error);
      }
      .warn {
        margin: 0;
        color: var(--color-warning);
        font-size: var(--text-sm);
      }
      .ph {
        display: flex;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
        align-items: flex-start;
      }
      .ph-names {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      h1 {
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }
      .ar {
        color: var(--color-text-secondary);
        align-self: flex-start;
      }
      .ph-act {
        display: flex;
        gap: var(--space-2-5);
        align-items: center;
        flex-wrap: wrap;
      }
      .pill {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        padding: var(--space-0-5) var(--space-2-5);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .pill.live {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .btn {
        border: 1px solid var(--color-border-default);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .btn:hover:not(:disabled) {
        border-color: var(--color-border-strong);
      }
      .btn.primary {
        background: var(--color-brand-primary);
        border-color: var(--color-brand-primary);
        color: var(--color-text-on-brand);
      }
      .btn.primary:hover:not(:disabled) {
        background: var(--color-brand-primary-hover);
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn.icon {
        padding: var(--space-2) var(--space-3);
      }
      .menu {
        position: relative;
      }
      .menu-pop {
        position: absolute;
        inset-inline-end: 0;
        inset-block-start: calc(100% + var(--space-1));
        z-index: 30;
        min-inline-size: 13rem;
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        padding: var(--space-1);
        display: flex;
        flex-direction: column;
      }
      .menu-pop button {
        border: 0;
        background: none;
        text-align: start;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-sm);
        font: inherit;
        color: var(--color-text-primary);
        cursor: pointer;
      }
      .menu-pop button:hover {
        background: var(--color-surface-row-hover);
      }
      .menu-pop .danger {
        color: var(--color-error);
      }
      .studio {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
      }
      .main {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-width: 0;
      }
      .steps {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: var(--space-2);
      }
      .steps li {
        min-width: 0;
      }
      .step {
        inline-size: 100%;
        display: flex;
        align-items: center;
        gap: var(--space-2-5);
        border: 1px solid var(--color-border-default);
        background: var(--color-surface-default);
        border-radius: var(--radius-md);
        padding: var(--space-2-5) var(--space-3);
        cursor: pointer;
        text-align: start;
        font: inherit;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        min-width: 0;
      }
      .step .num {
        flex: none;
        inline-size: 1.625rem;
        block-size: 1.625rem;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--color-surface-muted);
        font-size: var(--text-sm);
      }
      .step .sl {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .step.done .num {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .step.on {
        border-color: var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
      }
      .step.on .num {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
      }
      .blk {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        align-items: flex-start;
        min-width: 0;
      }
      h2 {
        margin: 0;
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        display: flex;
        gap: var(--space-2);
        align-items: baseline;
        flex-wrap: wrap;
      }
      h2 small {
        font-weight: var(--font-weight-regular);
      }
      .blk-h {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3);
        inline-size: 100%;
        flex-wrap: wrap;
      }
      .served {
        inline-size: 100%;
      }
      .asktabs {
        --rail-seg-min: 11rem;
      }
      .names {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: var(--space-3);
        inline-size: 100%;
        max-inline-size: 40rem;
      }
      .fl {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      input,
      select {
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-sm);
        padding: var(--space-2) var(--space-2-5);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        font-weight: var(--font-weight-regular);
        max-inline-size: 100%;
        inline-size: auto;
      }
      input:focus-visible,
      select:focus-visible,
      button:focus-visible,
      a:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .seg {
        display: inline-flex;
        flex-wrap: wrap;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .seg button {
        border: 0;
        background: var(--color-surface-default);
        padding: var(--space-2) var(--space-3);
        cursor: pointer;
        font: inherit;
        color: var(--color-text-primary);
      }
      .seg button + button {
        border-inline-start: 1px solid var(--color-border-default);
      }
      .seg button[aria-checked='true'] {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        font-weight: var(--font-weight-semibold);
      }
      .link {
        border: 0;
        background: none;
        color: var(--color-text-link);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        padding: var(--space-0-5) 0;
        align-self: flex-start;
        text-align: start;
      }
      .x {
        border: 0;
        background: none;
        color: var(--color-text-secondary);
        cursor: pointer;
        border-radius: var(--radius-sm);
        padding: var(--space-0-5) var(--space-1-5);
        font: inherit;
      }
      .x:hover {
        color: var(--color-error);
        background: var(--color-error-bg);
      }
      .asked {
        margin: 0;
        padding-inline-start: var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        inline-size: 100%;
        max-inline-size: 44rem;
      }
      .asked li {
        padding-inline-start: var(--space-1);
      }
      .asked li > * {
        vertical-align: middle;
      }
      .asked .q {
        margin-inline-end: var(--space-2);
      }
      .tag {
        font-size: var(--text-xxs);
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
        margin-inline-start: var(--space-1-5);
      }
      .tag.pend {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .picker {
        position: relative;
      }
      .add-q {
        border: 1px dashed var(--color-border-strong);
        background: var(--color-surface-default);
        border-radius: var(--radius-pill);
        padding: var(--space-1-5) var(--space-3);
        cursor: pointer;
        font: inherit;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-link);
      }
      .pop {
        position: absolute;
        z-index: 20;
        inset-inline-start: 0;
        inset-block-start: calc(100% + var(--space-1-5));
        inline-size: min(28rem, 82vw);
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        padding: var(--space-2);
      }
      .pop-q {
        inline-size: 100%;
      }
      .opts {
        max-block-size: 20rem;
        overflow-y: auto;
        margin-block-start: var(--space-1-5);
      }
      .opt {
        inline-size: 100%;
        text-align: start;
        border: 0;
        background: none;
        padding: var(--space-1-5) var(--space-2);
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--space-2-5);
        font: inherit;
        color: var(--color-text-primary);
      }
      .opt:hover {
        background: var(--color-surface-row-hover);
      }
      .opt small {
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      .opt-t {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .opt-t em {
        font-style: normal;
        font-size: var(--text-xxs);
        color: var(--color-text-secondary);
      }
      .box {
        flex: none;
        inline-size: 1.125rem;
        block-size: 1.125rem;
        border: 1.5px solid var(--color-border-strong);
        border-radius: var(--radius-sm);
        display: grid;
        place-items: center;
        font-size: var(--text-xs);
        color: var(--color-text-on-brand);
      }
      .opt[aria-checked='true'] .box {
        background: var(--color-brand-primary);
        border-color: var(--color-brand-primary);
      }
      .pop-f {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-block-start: 1px solid var(--color-border-default);
        margin-block-start: var(--space-1-5);
        padding: var(--space-2) var(--space-1) 0;
        font-size: var(--text-sm);
      }
      .btn-sm {
        border: 0;
        border-radius: var(--radius-md);
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        padding: var(--space-1) var(--space-3);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .calc-host.hide {
        display: none;
      }
      .line {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .edge {
        inline-size: 5.5rem;
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .edge.wide {
        inline-size: 8.5rem;
      }
      .edge::placeholder {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }
      .foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3);
      }
    `,
  ],
})
export class ProductStudioPage {
  private readonly api = inject(BankProgramsApiService);
  private readonly engineRules = inject(EngineRulesApiService);
  private readonly modal = inject(NzModalService);
  private readonly drawer = inject(NzDrawerService);
  private readonly message = inject(NzMessageService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly errors = inject(ErrorCodeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly backLink = surrogateBoardLink();
  protected readonly key = this.route.snapshot.paramMap.get('key') ?? '';

  protected readonly loading = signal(true);
  protected readonly product = signal<SurrogateProductDetail | null>(null);
  protected readonly calc = viewChild(ProductTemplatePage);

  protected readonly removeAria = $localize`:@@ps.remove:Remove`;
  protected readonly searchAria = $localize`:@@ps.search_q:Search questions…`;
  protected readonly moreAria = $localize`:@@ps.more:More actions`;
  protected readonly meansAria = $localize`:@@ps.means:What does the amount mean?`;
  protected readonly bankSets = $localize`:@@ps.bank_sets:bank sets`;
  protected readonly dbrAria = $localize`:@@ps.dbr:Debt burden`;
  protected readonly fromAria = $localize`:@@spt.v2.from_col:From`;
  protected readonly toAria = $localize`:@@spt.v2.to_col:Up to`;

  // --- steps -----------------------------------------------------------------

  protected readonly steps = computed<ReadonlyArray<{ key: StepKey; label: string }>>(() => {
    const all: Array<{ key: StepKey; label: string }> = [
      { key: 'name', label: $localize`:@@ps.step_name:Name` },
      { key: 'questions', label: $localize`:@@ps.step_questions:Questions` },
      { key: 'amount', label: $localize`:@@ps.step_amount:Amount` },
      // "Who can't get it" is hidden for now (operator's call). Its rules stay stored and are
      // saved back unchanged; the step returns by adding it here again:
      // { key: 'rules', label: $localize`:@@ps.step_rules:Who can't get it` },
    ];
    return all;
  });
  protected readonly stepIndex = signal(this.initialStep());
  protected readonly step = computed<StepKey>(
    () => this.steps()[Math.min(this.stepIndex(), this.steps().length - 1)]?.key ?? 'name',
  );
  protected readonly nextLabel = computed(() => {
    const next = this.steps()[this.stepIndex() + 1]?.label ?? '';
    return $localize`:@@ps.next:Next: ${next}:STEP:`;
  });

  private initialStep(): number {
    const raw = Number(this.route.snapshot.queryParamMap.get('step'));
    // The create page sends ?step=2 meaning "the questions" on the page this replaced.
    return Number.isFinite(raw) && raw >= 1 ? Math.min(raw - 1, 2) : 0;
  }

  protected goTo(i: number): void {
    this.stepIndex.set(Math.max(0, Math.min(i, this.steps().length - 1)));
    void this.router.navigate([], {
      queryParams: { step: this.stepIndex() + 1 },
      replaceUrl: true,
    });
    const top = (this.host.nativeElement as HTMLElement).getBoundingClientRect().top;
    if (top < 0) window.scrollBy({ top });
  }

  // --- name --------------------------------------------------------------------

  protected readonly nameForm = this.fb.nonNullable.group({ labelEn: '', labelAr: '' });
  private readonly nameRev = signal(0);
  protected readonly nameDirty = computed(() => {
    this.nameRev();
    const p = this.product();
    const v = this.nameForm.getRawValue();
    return !!p && (v.labelEn.trim() !== p.labelEn || v.labelAr.trim() !== p.labelAr);
  });

  protected setOutput(kind: 'monthlyIncome' | 'maxAmount'): void {
    const c = this.calc();
    if (!c) return;
    c.form.controls.outputKind.setValue(kind);
    if (kind === 'monthlyIncome') c.form.controls.baselineDbrPercent.setValue('');
  }

  // --- questions ---------------------------------------------------------------

  protected readonly asksBoard = signal<ProductAsksBoard | null>(null);
  protected readonly fixedAsks = signal<
    ReadonlyArray<{
      code: string;
      label: string;
      type: string;
      isRequired: boolean;
      servedOn: FixedServedOn | null;
    }>
  >([]);
  protected readonly stagedAttach = signal<ReadonlySet<string>>(new Set());
  protected readonly stagedDetach = signal<ReadonlySet<string>>(new Set());

  protected readonly fixedSet = computed(() => new Set(this.fixedAsks().map((q) => q.code)));
  protected readonly fixedCodeList = computed(() => this.fixedAsks().map((q) => q.code));

  private readonly sections = computed(() =>
    askSections({
      board: this.asksBoard(),
      search: '',
      isAr: this.isAr,
      attaching: new Set(),
      detaching: new Set(),
      stagedAttach: this.stagedAttach(),
      stagedDetach: this.stagedDetach(),
    }),
  );

  /** What this product asks of its own — the fixed questions are asked anyway. */
  protected readonly ownCards = computed(() =>
    (this.sections().find((s) => s.key === 'asked')?.cards ?? []).filter(
      (c) => c.code !== '' && !this.fixedSet().has(c.code),
    ),
  );

  /** Which questions the list shows: all, the fixed ones, or the ones added here. */
  protected readonly askTab = signal<'all' | 'fixed' | 'other'>('all');
  protected readonly askTabsAria = $localize`:@@spd.asktabs_aria:Which questions`;
  protected pickAskTab(id: string): void {
    this.askTab.set(id === 'fixed' || id === 'other' ? id : 'all');
  }
  protected readonly askTabs = computed<RailTabItem[]>(() => [
    {
      id: 'all',
      label: $localize`:@@spd.asktab_all:All`,
      note: String(this.fixedAsks().length + this.ownCards().length),
    },
    {
      id: 'fixed',
      label: $localize`:@@spd.asktab_fixed:Fixed`,
      note: String(this.fixedAsks().length),
    },
    {
      id: 'other',
      label: $localize`:@@spd.asktab_added:Added`,
      note: String(this.ownCards().length),
    },
  ]);

  /** One page: the fixed questions first, then this product's own. */
  protected readonly askedPages = computed<readonly ServedPage[]>(() => {
    const row = (code: string, label: string, type: string, i: number, isRequired: boolean) => ({
      code,
      type,
      questionAr: label,
      questionEn: label,
      isRequired,
      displayOrder: i,
      enabledWhen: null,
      options: [],
    });
    const fixed = this.fixedAsks().map((q, i) => row(q.code, q.label, q.type, i, q.isRequired));
    const own = this.ownCards().map((c, i) => row(c.code, c.label, c.type ?? '', i, true));
    const tab = this.askTab();
    const shown =
      tab === 'fixed'
        ? fixed
        : tab === 'other'
          ? own
          : [...fixed, ...own.map((q, i) => ({ ...q, displayOrder: fixed.length + i }))];
    const title =
      tab === 'fixed'
        ? $localize`:@@spd.asktab_fixed_title:Fixed questions`
        : tab === 'other'
          ? $localize`:@@spd.asktab_added_title:Added for this product`
          : $localize`:@@spd.asktab_all_title:All questions`;
    return [{ code: 'asked', titleAr: title, titleEn: title, displayOrder: 0, questions: shown }];
  });

  /** Fixed → locked; this product's own → removable (it leaves the calculation too). */
  protected readonly askedStates = computed<ReadonlyMap<string, ServedRowState>>(() => {
    const out = new Map<string, ServedRowState>();
    for (const q of this.fixedAsks()) out.set(q.code, 'fixed');
    for (const c of this.ownCards()) if (!out.has(c.code)) out.set(c.code, 'added');
    return out;
  });

  /** A fixed question says where it is asked; one added here is asked without a payslip. */
  protected readonly askedBasis = computed<ReadonlyMap<string, QuestionBasis>>(() => {
    const out = new Map<string, QuestionBasis>();
    for (const q of this.fixedAsks()) {
      out.set(
        q.code,
        q.servedOn === 'income_proof'
          ? 'income_proof'
          : q.servedOn === 'income_surrogate'
            ? 'surrogate'
            : 'both',
      );
    }
    for (const c of this.ownCards()) if (!out.has(c.code)) out.set(c.code, 'surrogate');
    return out;
  });

  /** The pool this product does not ask yet — never a fixed one, never one already asked. */
  protected readonly addableRows = computed<readonly AddableRow[]>(() => {
    const group = $localize`:@@spd.add_group:Questions`;
    const asked = new Set(this.ownCards().map((c) => c.code));
    return (this.sections().find((sec) => sec.key === 'rest')?.cards ?? [])
      .filter(
        (c) =>
          c.code !== '' &&
          !c.blocked &&
          !c.questionInactive &&
          !this.fixedSet().has(c.code) &&
          !asked.has(c.code),
      )
      .map((c) => ({
        id: c.code,
        code: c.code,
        label: c.label,
        groupKey: 'pool',
        group,
        isRequired: false,
        alsoAdds: [],
        chainIds: [],
        haystack: `${c.label} ${c.code}`.toLowerCase(),
      }));
  });

  private readonly addSheet = viewChild.required<TemplateRef<unknown>>('addSheet');
  private addSheetRef: {
    close(): void;
    afterClose: { subscribe(fn: () => void): unknown };
  } | null = null;
  protected readonly addSheetTitle = $localize`:@@ps.add_questions_title:Add questions`;
  protected readonly addSheetSub = $localize`:@@ps.add_sheet_sub:Asked of this product's applicants.`;
  protected readonly doneLabel = $localize`:@@pnd.add_sheet_done:Done`;

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

  protected addByCode(code: string): void {
    const card = (this.sections().find((sec) => sec.key === 'rest')?.cards ?? []).find(
      (c) => c.code === code,
    );
    if (card) void this.addQuestion(card);
  }

  protected removeByCode(code: string): void {
    const card = this.ownCards().find((c) => c.code === code);
    if (card) this.removeQuestion(card);
  }

  /** What the calculation may pick from: the fixed questions and this product's own. */
  protected readonly askedCodes = computed(() => [
    ...this.fixedCodeList(),
    ...this.ownCards().map((c) => c.code),
  ]);

  /**
   * A draft product takes a new question at once, so the Amount step can pick it straight away;
   * a live one holds it until Save, like every other change customers would see.
   */
  private async addQuestion(card: AskCard): Promise<void> {
    if (card.pending) {
      this.unstage(card);
      return;
    }
    if (this.product()?.active) {
      this.stagedAttach.update((s) => new Set(s).add(card.code));
      return;
    }
    try {
      const res = await this.api.attachProductAsk(this.key, card.code);
      this.asksBoard.set(res.data.state);
      await this.enums.refresh('surrogate_fact');
    } catch {
      // The interceptor's toast says why.
    }
  }

  /** Stop asking it — and take it out of the amount and the rules first. */
  protected removeQuestion(card: AskCard): void {
    if (card.pending) {
      this.unstage(card);
      return;
    }
    if (card.factKey === '') return;
    this.calc()?.dropFact(card.factKey);
    this.stagedDetach.update((s) => new Set(s).add(card.factKey));
  }

  private unstage(card: AskCard): void {
    this.stagedAttach.update((s) => {
      const next = new Set(s);
      next.delete(card.code);
      return next;
    });
    this.stagedDetach.update((s) => {
      const next = new Set(s);
      next.delete(card.factKey);
      return next;
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const inMenu = event
      .composedPath()
      .some((el) => el instanceof HTMLElement && el.classList.contains('menu'));
    if (!inMenu) this.menuOpen.set(false);
  }

  // --- loan limits -------------------------------------------------------------

  protected readonly facts = computed(() =>
    registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr),
  );
  protected readonly tenorMin = signal('');
  protected readonly tenorMax = signal('');
  protected readonly amountMin = signal('');
  protected readonly amountMax = signal('');
  private readonly termsDirty = signal(false);
  protected readonly planValue = signal<PlanDefaults | null>(null);
  private readonly plansDirty = signal(false);
  protected readonly limitsOpen = signal(false);
  protected readonly planTable = computed(() => planRowsFrom(this.planValue()));

  protected readonly readsDownPayment = computed(() =>
    (this.calc()?.tryFacts() ?? []).some((f) => f.key === 'car_down_payment'),
  );

  protected setTerm(which: 'tenorMin' | 'tenorMax' | 'amountMin' | 'amountMax', raw: string): void {
    this[which].set(raw.replace(/,/g, '').trim());
    this.termsDirty.set(true);
  }

  protected readonly termError = computed(() => {
    const half = (a: string, b: string) => (a === '') !== (b === '');
    if (half(this.tenorMin(), this.tenorMax()) || half(this.amountMin(), this.amountMax())) {
      return $localize`:@@ps.term_both:Type both ends, or leave both empty.`;
    }
    return null;
  });

  protected onPlans(next: PlanDefaults | null): void {
    this.planValue.set(next);
    this.plansDirty.set(true);
  }

  protected onPlanRemove(request: PlanRemoveRequest): void {
    this.onPlans(request.next);
  }

  /** A first plan table, keyed by the share of the price put down. */
  protected startPlans(): void {
    this.onPlans({
      rateByFact: {
        axes: [{ factKey: 'car_down_payment_percent' }],
        cells: [{ keys: [{ fromInclusive: '20', toExclusive: null }], value: '' }],
        onNoMatch: 'useFallback',
      },
    } as PlanDefaults);
  }

  // --- save --------------------------------------------------------------------

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly changeCount = computed(() => {
    const calcDirty = this.calc()?.dirty() ?? false;
    return (
      (this.nameDirty() ? 1 : 0) +
      this.stagedAttach().size +
      this.stagedDetach().size +
      (calcDirty ? 1 : 0) +
      (this.termsDirty() ? 1 : 0) +
      (this.plansDirty() ? 1 : 0)
    );
  });

  protected readonly saveBlock = computed<string | null>(() => {
    if (this.changeCount() === 0) return null;
    const v = this.nameForm.getRawValue();
    if (v.labelEn.trim() === '' || v.labelAr.trim() === '') {
      return $localize`:@@ps.need_names:Give the product a name in English and Arabic.`;
    }
    if (this.termError()) return this.termError();
    if (this.plansDirty() && this.planValue() !== null) {
      const broken = planRowsErrorFor(this.planValue());
      if (broken !== null)
        return $localize`:@@ps.plans_unfinished:A plan by down payment is not finished.`;
    }
    const c = this.calc();
    if (c?.dirty()) return c.saveBlockReason();
    return null;
  });

  hasUnsavedChanges(): boolean {
    return this.changeCount() > 0;
  }

  confirmLeave(): Promise<boolean> {
    if (!this.hasUnsavedChanges()) return Promise.resolve(true);
    return new Promise((resolve) => {
      this.modal.confirm({
        nzTitle: $localize`:@@spd.leave.title:Leave without saving?`,
        nzContent: $localize`:@@spd.leave.body:${this.changeCount()}:N: change(s) on this product are not saved and will be lost.`,
        nzOkText: $localize`:@@spd.leave.ok:Leave`,
        nzCancelText: $localize`:@@spd.leave.stay:Stay`,
        nzOkDanger: true,
        nzOnOk: () => resolve(true),
        nzOnCancel: () => resolve(false),
      });
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  protected requestSave(): void {
    const p = this.product();
    if (!p || this.saveBlock() !== null) return;
    if (!p.active || p.names.length === 0) {
      void this.saveAll();
      return;
    }
    const programs = p.names.reduce((n, name) => n + name.programs.length, 0);
    this.modal.confirm({
      nzTitle: $localize`:@@spd.confirm.title:Save changes to a live product?`,
      nzContent: $localize`:@@spd.confirm.body:${p.names.length}:NAMES: program name(s) and ${programs}:PROGRAMS: bank program(s) quote from this product. They use the change from the next quote. Offers already issued keep their own figures.`,
      nzOkText: $localize`:@@spd.confirm.ok:Save changes`,
      nzCancelText: $localize`:@@spd.confirm.cancel:Not yet`,
      nzOnOk: () => this.saveAll(),
    });
  }

  /**
   * In dependency order: the names; the questions it starts asking (the calculation may read
   * them); the calculation; the questions it stops asking (only once nothing reads them); then
   * the loan limits. Stops at the first refusal and keeps what did not land.
   */
  private async saveAll(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      if (this.nameDirty()) {
        const v = this.nameForm.getRawValue();
        await this.api.renameSurrogateProduct(this.key, {
          labelEn: v.labelEn.trim(),
          labelAr: v.labelAr.trim(),
        });
      }
      for (const code of this.stagedAttach()) {
        await this.api.attachProductAsk(this.key, code);
        this.stagedAttach.update((s) => {
          const next = new Set(s);
          next.delete(code);
          return next;
        });
      }
      if (this.stagedAttach().size === 0) await this.enums.refresh('surrogate_fact');
      const c = this.calc();
      if (c && c.dirty() && !(await c.saveNow())) {
        this.saveError.set(
          c.saveBlockReason() ??
            $localize`:@@ps.calc_failed:The amount was not saved — see the Amount step.`,
        );
        return;
      }
      for (const factKey of this.stagedDetach()) {
        await this.api.detachProductAsk(this.key, factKey);
        this.stagedDetach.update((s) => {
          const next = new Set(s);
          next.delete(factKey);
          return next;
        });
      }
      if (this.termsDirty()) {
        const tenor =
          this.tenorMin() === ''
            ? null
            : { minMonths: Number(this.tenorMin()), maxMonths: Number(this.tenorMax()) };
        await this.api.setSurrogateProductTenorDefaults(this.key, { tenor });
        const loanAmounts =
          this.amountMin() === ''
            ? null
            : { minAmountEGP: this.amountMin(), maxAmountEGP: this.amountMax() };
        await this.api.setSurrogateProductLoanAmountDefaults(this.key, { loanAmounts });
        this.termsDirty.set(false);
      }
      if (this.plansDirty()) {
        await this.api.setSurrogateProductPlanDefaults(this.key, { plans: this.planValue() });
        this.plansDirty.set(false);
      }
      this.message.success($localize`:@@spd.bar.saved:Changes saved.`);
    } catch (err) {
      this.saveError.set(this.localizedError(err));
    } finally {
      this.saving.set(false);
      await Promise.all([this.load({ silent: true }), this.loadAsks()]);
    }
  }

  protected async discardAll(): Promise<void> {
    this.stagedAttach.set(new Set());
    this.stagedDetach.set(new Set());
    this.saveError.set(null);
    await Promise.all([this.load({ silent: true }), this.calc()?.discard()]);
  }

  // --- status and the menu -------------------------------------------------------

  protected readonly menuOpen = signal(false);

  protected setActive(active: boolean): void {
    void this.doSetActive(active);
  }

  private async doSetActive(active: boolean): Promise<void> {
    try {
      await this.api.setSurrogateProductActive(this.key, active);
      await this.load({ silent: true });
      this.message.success(
        active
          ? $localize`:@@ps.now_live:The product is live.`
          : $localize`:@@ps.now_off:The product is switched off.`,
      );
    } catch {
      // The interceptor's toast says why (SURROGATE_PRODUCT_NOT_READY names what is missing).
    }
  }

  protected confirmOff(): void {
    const p = this.product();
    if (!p) return;
    const programs = p.names.reduce((n, name) => n + name.programs.length, 0);
    this.modal.confirm({
      nzTitle: $localize`:@@ps.off_title:Switch this product off?`,
      nzContent: $localize`:@@ps.off_body:${programs}:N: bank program(s) stop quoting it from the next quote. Nothing is deleted, and you can switch it back on.`,
      nzOkText: $localize`:@@ps.switch_off:Switch off`,
      nzOkDanger: true,
      nzOnOk: () => this.doSetActive(false),
    });
  }

  protected openSell(): void {
    const p = this.product();
    this.menuOpen.set(false);
    if (!p) return;
    const ref = openFormDrawer<
      SellAsProgramDrawerComponent,
      SellAsProgramDrawerData,
      SellAsProgramDrawerResult | undefined
    >(this.drawer, {
      content: SellAsProgramDrawerComponent,
      data: { productKey: p.key, labelEn: p.labelEn, labelAr: p.labelAr },
    });
    ref.afterClose.subscribe((res) => {
      if (res) void this.load({ silent: true });
    });
  }

  protected openDelete(): void {
    const p = this.product();
    this.menuOpen.set(false);
    if (!p) return;
    const ref = this.modal.create<
      DeleteProductDialogComponent,
      DeleteProductDialogData,
      boolean | undefined
    >({
      nzContent: DeleteProductDialogComponent,
      nzData: { key: p.key, label: this.isAr ? p.labelAr : p.labelEn },
      nzWidth: 520,
      nzFooter: null,
    });
    ref.afterClose.subscribe((deleted) => {
      if (deleted) {
        void this.router.navigate(this.backLink.commands, {
          queryParams: this.backLink.queryParams,
        });
      }
    });
  }

  protected fmt(raw: string): string {
    return /^\d+(\.\d+)?$/.test(raw)
      ? Number(raw).toLocaleString('en-US', { maximumFractionDigits: 4 })
      : raw;
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  // --- load ------------------------------------------------------------------------

  constructor() {
    void this.enums.load('surrogate_fact');
    this.nameForm.valueChanges.subscribe(() => this.nameRev.update((n) => n + 1));
    void this.load();
    void this.loadAsks();
    void this.loadFixedAsks();
  }

  private async load(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loading.set(true);
    try {
      const res = await this.api.getSurrogateProduct(this.key);
      const p = res.data;
      this.product.set(p);
      this.nameForm.reset({ labelEn: p.labelEn, labelAr: p.labelAr });
      if (!this.termsDirty()) {
        this.tenorMin.set(p.tenorDefaults ? String(p.tenorDefaults.minMonths) : '');
        this.tenorMax.set(p.tenorDefaults ? String(p.tenorDefaults.maxMonths) : '');
        this.amountMin.set(p.loanAmountDefaults?.minAmountEGP ?? '');
        this.amountMax.set(p.loanAmountDefaults?.maxAmountEGP ?? '');
      }
      if (!this.plansDirty()) this.planValue.set(p.planDefaults);
      if (
        p.tenorDefaults ||
        p.loanAmountDefaults ||
        p.planDefaults ||
        (p.template?.baselineDbrPercent ?? '') !== ''
      ) {
        this.limitsOpen.set(true);
      }
    } catch {
      this.product.set(null);
    } finally {
      if (!opts.silent) this.loading.set(false);
    }
  }

  private async loadAsks(): Promise<void> {
    try {
      const res = await this.api.getProductAsks(this.key);
      this.asksBoard.set(res.data);
    } catch {
      this.asksBoard.set(null);
    }
  }

  private async loadFixedAsks(): Promise<void> {
    try {
      const view = await this.engineRules.rules();
      this.fixedAsks.set(
        view.questions
          .filter((q) => q.noPayslip !== 'never')
          .map((q) => ({
            code: q.code,
            label: this.isAr ? q.questionAr : q.questionEn,
            type: q.type,
            isRequired: q.isRequired,
            servedOn: q.fixedServedOn ?? null,
          })),
      );
    } catch {
      this.fixedAsks.set([]);
    }
  }

  private localizedError(err: unknown): string {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })?.error;
    return this.errors.toLocalizedMessage(
      (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
      envelope?.meta,
    );
  }
}
