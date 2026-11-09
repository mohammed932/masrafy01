/**
 * One surrogate product's workspace.
 *
 * THREE STEPS, NON-LINEAR — a settings screen, not a creation flow. Every step is reachable
 * at any time, each saves on its own terms, nothing is submitted at the end and there is no
 * Finish. Same posture, and the same shared rail, as the catalog name's own page.
 *
 *   ① What it asks                — the questions, the lists behind them, and the facts
 *   ② How the income is worked out — the calculation, and the figures every bank starts from
 *   ③ Who uses it                 — catalog names, and the bank programs under them
 *
 * STEP ① IS THE POINT OF THE SCREEN, and it is why a no-payslip product is no longer a
 * release. What one reads is three rows in three tables that are only correct together — a
 * LIST, a QUESTION whose option codes ARE that list's keys, and a FACT binding the two — and
 * before `20260827090000` nothing but a seed script could produce the combination. The
 * questions this product authored are here, with their values, and adding another is a dialog
 * rather than a deploy.
 *
 * IT SHOWS TWO KINDS OF LIST, and the difference is provenance, not permission:
 *
 *   OWNED   — authored here, `enumeration_type_def.surrogateProductKey` says so, and kept off
 *             the global Manage-values rail because it exists to answer one question.
 *   BORROWED — read by the calculation but authored elsewhere (`employment_type`, say).
 *             Derived, exactly as before: `factKeysReadBy` gives the facts the steps and gates
 *             consult, and each fact's bound question reports which registry list its options
 *             came from. Shown, and editable, because an operator changing a figure needs to
 *             see the keys it is written against — with a line saying it is shared.
 *
 * The two answer different questions and both are needed: the derived one is unanswerable
 * while the product is being BUILT (there is no rule yet to derive from), and the stored one
 * says nothing about what the finished calculation actually reads.
 *
 * Step index lives in the URL as `?step=`, so a pasted link and a reload land where the
 * operator was. 1-based on the wire, 0-based in the signal, matching the catalog page.
 */
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  LOCALE_ID,
  computed,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowLeftOutline,
  CheckOutline,
  CloseCircleFill,
  CopyOutline,
  DeleteOutline,
  EditOutline,
  ExclamationCircleOutline,
  InfoCircleOutline,
  PlusOutline,
  PoweroffOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormDrawerComponent,
  RailTabsComponent,
  SkeletonRowsComponent,
  WizardStepsComponent,
  openFormDrawer,
  PageHeaderComponent,
} from '@shared/ui';
import type { MaxLoanByFactConfig, ProductCapShape, RailTabItem, WizardStepItem } from '@shared/ui';
import { FactGridEditorComponent } from '@shared/ui/fact-grid-editor.component';
import {
  emptyFactGrid,
  type FactGridConfig,
  type FactGridValueKind,
} from '@shared/ui/fact-grid.rules';
import {
  PlanRowsEditorComponent,
  type PlanRemoveRequest,
} from '@shared/ui/plan-rows-editor.component';
import {
  planRowsErrorFor,
  planRowsFrom,
  planRowsWhyNot,
  planSlotMonthsBound,
  planSlotValueKind,
  type PlanIncompatibleReason,
  type PlanSlotKey,
} from '@shared/ui/plan-rows.rules';
import { LookupValuesPanelComponent } from '@shared/lookups/lookup-values-panel.component';
import {
  ParentClassBoardComponent,
  type BoardAttention,
} from '@shared/lookups/parent-class-board.component';
import { EnumerationTypesService } from '@shared/lookups/enumeration-types.service';
import type { PlanDefaults } from '../bank-programs/bank-programs.types';
import { IncomeAssumptionSectionComponent } from '@shared/income-rule/income-assumption-section.component';
import { ProductRuleEditorComponent } from '@shared/income-rule/product-rule-editor.component';
import { FigureFieldComponent } from '@shared/income-rule/figure-field.component';
import { incomeBandsErrorFor } from '@shared/income-rule/income-bands-editor.component';
import { I_SCORE_CLASS_TYPE, bandsFromIScoreClasses } from '@shared/income-rule/iscore-classes';
import { listFigureState, type ListFigureState } from '@shared/income-rule/figure-slots';
import { suggestedBandsBySlot } from '@shared/income-rule/suggested-bands';
import { incomeKeyTableErrorFor, productRuleHasError } from '@shared/income-rule/income-rule.rules';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { isLoanCategory, type LoanCategory } from '@core/loan-category';
import {
  LookupsApiService,
  type EnumerationTypeSummary,
} from '@features/lookups/lookups.api.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import {
  factKeysReadBy,
  incomeMethodLabel,
  incomeMethodShape,
  registryFacts,
  type IncomeAssumptionConfig,
  type IncomeAssumptionStrategy,
  type IncomeBand,
  type IncomeKeyTableRow,
  type ProductRuleOutput,
  type RuleGate,
  type RuleStep,
  type StepFigures,
  type AskQuestionType,
  type ProductAsksBoard,
  type SurrogateProductDetail,
  type SurrogateProductNotReadyReason,
  type LoanAmountDefaults,
  type RateBasis,
  type RateDefaults,
  type TenorDefaults,
  type ProductBlueprint,
} from '@features/bank-programs/bank-programs.types';
import { PRODUCT_BASE, surrogateBoardLink } from './program-catalog.paths';
import { productStepLabels } from './product-steps';
import { ServedPagesComponent, type ServedRowState } from './served-pages.component';
import { AddableQuestionsComponent, type AddableRow } from './addable-questions.component';
import type { ServedPage } from '@shared/questions/asked-questions.rules';
import {
  DeleteProductDialogComponent,
  type DeleteProductDialogData,
} from './delete-product.dialog';
import { ProductTestPanelComponent } from './product-test-panel.component';
import { ProductUsesStepComponent } from './product-uses-step.component';
import { ProductTemplatePage } from './product-template.page';
import {
  SellAsProgramDrawerComponent,
  type SellAsProgramDrawerData,
  type SellAsProgramDrawerResult,
} from './sell-as-program.drawer';
import {
  ASK_PAGE_SIZE,
  askMatchCount,
  askPagedSections,
  askSections,
  askStepStatus,
  type AskCard,
  type AskSectionKey,
} from './product-asks';
import {
  neededFixableCount,
  neededGapCount,
  neededGroups,
  neededRows,
  type NeededGroupKey,
  type NeededRow,
} from './product-needed';
import { EngineRulesApiService } from '../questionnaire/engine-rules/engine-rules.api.service';

/** One operator-managed list surfaced on step ①. */
interface ReadList {
  readonly type: string;
  readonly title: string;
  readonly description: string;
  /** True when values of this type are filed under a parent list — it gets the board. */
  readonly hasBoard: boolean;
  /**
   * False when the list was authored elsewhere and this product merely reads it.
   *
   * Rendered as a line, not as a lock: editing a shared list from here is legitimate — the
   * operator is looking at the calculation whose figures are keyed by it — but they should
   * know the change reaches every other product reading the same list.
   */
  readonly owned: boolean;
  /**
   * What this list carries: a figure per value, a figure stated on the class each value is
   * filed under, or none at all.
   *
   * DERIVED from the rule, never stored — which is what lets the same screen serve every
   * product. A list of three hundred compound names is `byClass`, and saying "no default
   * set" against each of them would invent a defect where there is none.
   */
  readonly figures: ListFigureState;
  /**
   * The list the figures are actually on, when they are not on this one — and `null`
   * whenever they are, or whenever there is more than one home to name.
   *
   * A rail id, so the note can offer the trip rather than describe it: the operator's next
   * move after reading "the amounts are on the school stages" is to go there, and the tab
   * that holds them is one click away on the rail directly above.
   */
  readonly pricedOn: string | null;
}

@Component({
  selector: 'app-surrogate-product-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    PageHeaderComponent,
    RouterLink,
    ReactiveFormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzPaginationModule,
    NzToolTipModule,
    SkeletonRowsComponent,
    WizardStepsComponent,
    RailTabsComponent,
    LookupValuesPanelComponent,
    ParentClassBoardComponent,
    IncomeAssumptionSectionComponent,
    ProductRuleEditorComponent,
    FactGridEditorComponent,
    PlanRowsEditorComponent,
    FigureFieldComponent,
    ProductTestPanelComponent,
    ProductTemplatePage,
    ProductUsesStepComponent,
    ServedPagesComponent,
    AddableQuestionsComponent,
    FormDrawerComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      CheckOutline,
      CloseCircleFill,
      CopyOutline,
      DeleteOutline,
      EditOutline,
      ExclamationCircleOutline,
      InfoCircleOutline,
      PlusOutline,
      PoweroffOutline,
      SearchOutline,
    ]),
  ],
  template: `
    <section class="page">
      <div class="chrome">
        <a class="back" [routerLink]="backLink.commands" [queryParams]="backLink.queryParams">
          <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@spd.back">All surrogate products</span>
        </a>
        @if (product(); as p) {
          <!-- The product's lifecycle (v33.0.0): rename, duplicate and delete as quiet text
               actions, and the power switch last with the weight of the consequential one.
               OFF is the reversible way to stop a product; Delete is refused while anything
               still quotes from it, and its dialog names what does. -->
          <div class="life-actions">
            @if (!p.capOnly) {
              <a
                class="ghost-action"
                [routerLink]="[productBase, 'new']"
                [queryParams]="{ copy: p.key }"
              >
                <span nz-icon nzType="copy" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@spd.life.copy">Copy</span>
              </a>
            }
            <button type="button" class="ghost-action" (click)="openDelete()">
              <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@spd.life.delete">Delete</span>
            </button>
          </div>
        }
      </div>

      @if (offPending(); as pending) {
        <!-- STATES THE CONSEQUENCE, rather than asking "are you sure". The program codes are
             already on this screen, which is why the confirmation lives here and not in a
             dialog: the operator reads what stops quoting against the list of what quotes. -->
        <div class="confirm" role="alert">
          <p class="confirm-title">
            <span
              class="confirm-glyph"
              nz-icon
              nzType="poweroff"
              nzTheme="outline"
              aria-hidden="true"
            ></span>
            <span i18n="@@spd.power.off_title">While this is off, nothing quotes from it.</span>
          </p>
          @if (pending.programCodes.length > 0) {
            <p class="confirm-body" i18n="@@spd.power.off_body">
              {{ pending.names.length }} catalog name(s) take their calculation from this, so the
              {{ pending.programCodes.length }} bank program(s) below stop matching anybody. Offers
              already issued keep their own figures. Nothing is deleted, and you can switch it back
              on at any time.
            </p>
            <ul class="code-chips">
              @for (code of pending.programCodes; track code) {
                <li>{{ code }}</li>
              }
            </ul>
          } @else if (pending.names.length > 0) {
            <p class="confirm-body" i18n="@@spd.power.off_body_names">
              {{ pending.names.length }} catalog name(s) take their calculation from this and will
              work out no income while it is off. No bank quotes from it yet. Nothing is deleted,
              and you can switch it back on at any time.
            </p>
          } @else {
            <p class="confirm-body" i18n="@@spd.power.off_body_free">
              No catalog name takes its calculation from this yet, so nothing stops quoting. Nothing
              is deleted, and you can switch it back on at any time.
            </p>
          }
          @if (pending.factsAffected.length > 0) {
            <p class="confirm-body" i18n="@@spd.power.off_body_facts">
              The question it asks stops being read, so each bank's own maximum for that answer
              falls back to whatever the bank chose for an answer it has no row for.
            </p>
          }
          <div class="confirm-actions">
            <button
              type="button"
              class="ghost-action"
              (click)="cancelOff()"
              i18n="@@spd.power.keep"
            >
              Keep it on
            </button>
            <button
              type="button"
              class="danger-action solid"
              [disabled]="saving()"
              (click)="setActive(false)"
              i18n="@@spd.power.off_confirm"
            >
              Switch it off
            </button>
          </div>
        </div>
      }

      @if (loading()) {
        <app-skeleton-rows [rows]="5" [cols]="[3, 1, 1]" [ariaLabel]="loadingLabel" />
      } @else {
        @if (product(); as p) {
          <header class="head">
            <app-page-header [title]="label(p)" [subtitle]="lede()" />
          </header>

          <!-- READINESS (v33.0.0). A product an operator creates starts OFF and cannot go live
               until it can work a figure out; this says what is missing and where to fix it,
               instead of a disabled button that does not say why. -->
          @if (!p.active && notReady().length > 0) {
            <div class="ready-card" role="status">
              <p class="ready-title" i18n="@@spd.ready.title">Before this can go live</p>
              <ul class="ready-list">
                @if (notReady().includes('asks_nothing')) {
                  <li>
                    <span i18n="@@spd.ready.asks">It asks the applicant nothing yet.</span>
                    <button
                      type="button"
                      class="linkish"
                      (click)="goToStep(1)"
                      i18n="@@spd.ready.asks_go"
                    >
                      Add a question
                    </button>
                  </li>
                }
                @if (notReady().includes('no_calculation')) {
                  <li>
                    <span i18n="@@spd.ready.calc">It has no calculation yet.</span>
                    <button
                      type="button"
                      class="linkish"
                      (click)="goToStep(2)"
                      i18n="@@spd.ready.calc_go"
                    >
                      Build the calculation
                    </button>
                  </li>
                }
              </ul>
            </div>
          } @else if (!p.active && isDraft()) {
            <div class="ready-card is-ok" role="status">
              <p class="ready-title" i18n="@@spd.ready.ok_title">Ready to go live</p>
              <p class="ready-body" i18n="@@spd.ready.ok_body4">
                It has what it needs. Try it and go live on the last step, then sell it as a
                program.
              </p>
            </div>
          }

          <app-wizard-steps
            [steps]="steps()"
            [activeIndex]="stepIndex()"
            [ariaLabel]="stepsAria"
            [caption]="stepCaption()"
            (stepSelect)="goToStep($event)"
          />

          @switch (stepIndex()) {
            @case (0) {
              <!-- NAME (v33.3.0): the names, edited in place and saved with everything else by
                   the one Save bar. The key is shown, never edited: bank programs, catalog names
                   and figures all address the product by it. -->
              <section class="panel" [attr.aria-label]="steps()[0]?.label ?? ''">
                <form class="name-grid" [formGroup]="nameForm">
                  <label class="name-field">
                    <span class="name-label" i18n="@@pform.name_en">Name (English)</span>
                    <input nz-input formControlName="labelEn" autocomplete="off" />
                  </label>
                  <label class="name-field">
                    <span class="name-label" i18n="@@pform.name_ar">Name (Arabic)</span>
                    <input nz-input formControlName="labelAr" dir="rtl" autocomplete="off" />
                  </label>
                </form>
                <p class="name-key">
                  <span i18n="@@spd.name.key">Key</span>
                  <span class="code"
                    ><bdi>{{ p.key }}</bdi></span
                  >
                  <span i18n="@@spd.name.key_hint"
                    >— never changes; banks and programs point at it.</span
                  >
                </p>
              </section>
            }
            @case (1) {
              <section class="panel" [attr.aria-label]="steps()[1]?.label ?? ''">
                <!-- WHICH LOAN TYPE, first. A tick here does two things — this product starts
                     reading the answer, and the loan type on this rail starts asking the
                     question — so the rail is above the grid rather than beside it: the
                     second half of the sentence is decided before the click, not after. -->
                @if (asksState() === 'loading') {
                  <!-- Shape-matched, not a spinner: the board is a list of questions, and an
                       in-flight read used to render as a finished, empty one. -->
                  <app-skeleton-rows [rows]="6" [cols]="[3, 1]" [ariaLabel]="loadingLabel" />
                } @else if (asksState() === 'error') {
                  <!-- Says the READ failed. Never "no questions": the empty board and the
                       broken one look identical once the interceptor's toast has gone. -->
                  <div class="confirm" role="alert">
                    <p class="confirm-title">
                      <span
                        class="confirm-glyph"
                        nz-icon
                        nzType="exclamation-circle"
                        nzTheme="outline"
                        aria-hidden="true"
                      ></span>
                      <span i18n="@@spd.ask.load_failed_title"
                        >The question list did not load.</span
                      >
                    </p>
                    <p class="confirm-body" i18n="@@spd.ask.load_failed">
                      Nothing has changed — what this product asks could not be read just now, so
                      none of it can be shown or ticked.
                    </p>
                    <div class="confirm-actions">
                      <button
                        type="button"
                        class="ghost-action"
                        (click)="retryAsks()"
                        i18n="@@spd.ask.retry"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                } @else {
                  <!-- A BAND, not four loose chips. The rail is the only closed axis on
                       this step and it was drawn as four free-standing pills at the top of a
                       wide empty card: nothing named the axis on screen (the name existed for
                       assistive tech only, in the tablist's aria-label), and nothing tied the strip to the
                       grid it switches. The label names it in the house micro-label scale the
                       section headings below already use, and the hairline is the tab
                       baseline — which is also what makes the whitespace on the trailing edge
                       read as a band's own air rather than as a strip that stopped short.
                       aria-hidden on the label: the tablist keeps its own accessible name,
                       so announcing the same words twice would be the only thing it added. -->
                  <!-- WHAT THE ENGINE NEEDS, above the rail because it does not change with
                       the tab: every answer this product's calculation, plan tables, cap and
                       selling programmes read, and whether an applicant is asked it. Gaps
                       lead; covered rows fold into one line so a product with nothing to do
                       reads as done. The server decides each status (neededFor).
                       Hidden on every product for now (neededPanelShown); flip the signal
                       to bring it back. -->
                  @if (neededPanelShown() && neededRowsList().length > 0) {
                    <section class="need" aria-labelledby="spd-need-title">
                      <div class="need-head">
                        <div class="need-heading">
                          <h3 id="spd-need-title" class="need-title" i18n="@@spd.needed.title">
                            Questions the engine needs
                          </h3>
                          @if (neededGaps() === 0) {
                            <p class="need-summary is-done">
                              <span
                                nz-icon
                                nzType="check-circle"
                                nzTheme="outline"
                                aria-hidden="true"
                              ></span>
                              <span i18n="@@spd.needed.all_asked"
                                >Every answer the engine reads for this product is asked ({{
                                  neededRowsList().length
                                }}).</span
                              >
                            </p>
                          } @else {
                            <p class="need-summary">
                              <span i18n="@@spd.needed.gaps"
                                >{{ neededGaps() }} of {{ neededRowsList().length }} answers the
                                engine reads are not asked yet.</span
                              >
                            </p>
                          }
                        </div>
                        @if (neededFixable() > 1) {
                          <button
                            nz-button
                            nzType="primary"
                            type="button"
                            [nzLoading]="neededBusy() === '*'"
                            [disabled]="neededBusy() !== null"
                            (click)="actOnNeeded(null)"
                          >
                            <span i18n="@@spd.needed.fix_all">Fix all ({{ neededFixable() }})</span>
                          </button>
                        }
                      </div>

                      @if (neededResult()) {
                        <p class="need-note">{{ neededResult() }}</p>
                      }

                      <!-- A STATUS STRIP: one bordered fold row per group, named by WHO asks
                           the question — a gap to close, this product, or the platform. Sentence
                           case and a bordered row, deliberately unlike the uppercase section
                           heads of the board below: this panel is the verdict on the product,
                           the board is where questions are ticked, and the two used to read as
                           one list said twice. Gaps start open, covered groups start folded;
                           the open state lives in a signal so a board refresh after "Ask it"
                           does not snap a group shut. -->
                      @for (group of neededGroupList(); track group.key) {
                        <details
                          #fold
                          class="need-group"
                          [class.is-action]="group.key === 'action'"
                          [open]="neededOpen().has(group.key)"
                          (toggle)="setNeededOpen(group.key, fold.open)"
                        >
                          <summary class="need-group-head">
                            <span class="need-dot" aria-hidden="true"></span>
                            <h4 class="need-group-title" [id]="'spd-need-' + group.key">
                              <span class="need-group-count">{{ group.rows.length }}</span>
                              @switch (group.key) {
                                @case ('action') {
                                  <span i18n="@@spd.needed.group_action">Needs your action</span>
                                }
                                @case ('product') {
                                  <span i18n="@@spd.needed.group_product"
                                    >Asked by this product</span
                                  >
                                }
                                @case ('platform') {
                                  <span i18n="@@spd.needed.group_platform"
                                    >Asked by the platform</span
                                  >
                                }
                              }
                            </h4>
                            <!-- Inline SVG, like the structure fold's chevron and for its
                                 reason: a projected nz-icon resolves the nearest patch service.
                                 Points down, so it needs no RTL mirror; it turns to point up. -->
                            <svg
                              class="need-chev"
                              viewBox="0 0 16 16"
                              width="14"
                              height="14"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                d="M3.5 6 8 10.5 12.5 6"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.75"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </summary>
                          <div class="need-body">
                            @switch (group.key) {
                              @case ('product') {
                                <p class="need-group-note" i18n="@@spd.needed.group_product_note">
                                  This product adds these to the questionnaire. Untick one below to
                                  stop asking it.
                                </p>
                              }
                              @case ('platform') {
                                <p class="need-group-note" i18n="@@spd.needed.group_platform_note">
                                  Every applicant in this loan type is asked these, whatever the
                                  product.
                                </p>
                              }
                            }
                            <ul class="need-list" [attr.aria-labelledby]="'spd-need-' + group.key">
                              @for (row of group.rows; track row.factKey) {
                                <li class="need-row">
                                  <span class="need-label">{{ row.label }}</span>
                                  <div class="need-side">
                                    @if (group.key === 'action') {
                                      <span class="need-status">
                                        @switch (row.status) {
                                          @case ('parked') {
                                            <span i18n="@@spd.needed.status_parked"
                                              >Question switched off</span
                                            >
                                          }
                                          @case ('noQuestion') {
                                            <span i18n="@@spd.needed.status_no_question"
                                              >No question yet</span
                                            >
                                          }
                                          @case ('noFact') {
                                            <span i18n="@@spd.needed.status_no_question"
                                              >No question yet</span
                                            >
                                          }
                                          @default {
                                            <span i18n="@@spd.needed.status_not_asked2"
                                              >Not read by this product yet</span
                                            >
                                          }
                                        }
                                      </span>
                                    }
                                    <!-- Where the answer is read, as a count; the engine's own
                                         names for those places (rate table, financed-share
                                         table, the programme code) sit one hover or focus
                                         deeper, where the operator who needs them looks. -->
                                    <span
                                      class="need-uses"
                                      tabindex="0"
                                      nz-tooltip
                                      [nzTooltipTitle]="neededUsedIn(row)"
                                      [attr.aria-label]="neededUsedIn(row)"
                                      i18n="@@spd.needed.uses"
                                      >{neededUseCount(row), plural,
                                        =1 {Read in 1 place}
                                        other {Read in {{ neededUseCount(row) }} places}
                                      }</span
                                    >
                                    @switch (row.action) {
                                      @case ('ask') {
                                        <button
                                          nz-button
                                          nzSize="small"
                                          type="button"
                                          [nzLoading]="neededBusy() === row.factKey"
                                          [disabled]="neededBusy() !== null"
                                          (click)="actOnNeeded(row)"
                                          i18n="@@spd.needed.ask"
                                        >
                                          Ask it
                                        </button>
                                      }
                                      @case ('create') {
                                        <button
                                          nz-button
                                          nzSize="small"
                                          type="button"
                                          [nzLoading]="neededBusy() === row.factKey"
                                          [disabled]="neededBusy() !== null"
                                          (click)="actOnNeeded(row)"
                                          i18n="@@spd.needed.create"
                                        >
                                          Create question
                                        </button>
                                      }
                                    }
                                  </div>
                                </li>
                              }
                            </ul>
                          </div>
                        </details>
                      }
                    </section>
                  }

                  <!-- WHAT APPLICANTS ARE ASKED (v36.1.0): the income-proof program page's own
                       list and side sheet, for one look across the catalog. Fixed questions are
                       locked; this product's own can be removed unless its calculation reads
                       them; Add opens the pool in a side sheet. Held until Save, like every
                       other change on this page. -->
                  <p class="sr-only" role="status" aria-live="polite">{{ askStatus() }}</p>
                  <header class="asks-head">
                    <p class="asks-sub" i18n="@@spd.asks_sub">
                      Fixed questions are asked on every no-payslip program. Add the ones this
                      product needs.
                    </p>
                    <button nz-button nzType="primary" type="button" (click)="openAddSheet()">
                      <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                      <span i18n="@@spd.add_question">Add a question</span>
                    </button>
                  </header>
                  <app-served-pages
                    [pages]="askedPages()"
                    [isAr]="isAr"
                    [states]="askedStates()"
                    [editable]="!savingAll()"
                    (remove)="removeAskByCode($event)"
                  />
                }

                @if (readLists().length > 0) {
                  <h2 class="sub" i18n="@@spd.lists_title">The answers they pick from</h2>

                  <!-- ONE LIST ON STAGE, not all of them stacked.
                       Measured before this rail existed: step ① was 10 187px on the compound
                       product — four value panels, four amount editors and the filing board,
                       thirteen sibling blocks with nothing grouping them, and the one Save
                       button 9 000px below the first box it saves.

                       A rail and not a nested stepper, for the reason the catalog name's own
                       screen already states: these lists have no ORDER (the operator opens the
                       one they came to edit and leaves), a second Back/Next pair a few hundred
                       pixels from the first doubles "where am I?", and the group count is DATA —
                       a product with one list would get a one-step stepper apologising for
                       itself. The rail shows every list's state at once, which is the half a
                       stepper hides, and disappears below two lists. -->
                  @if (listTabs().length > 1) {
                    <app-rail-tabs
                      appearance="segmented"
                      idPrefix="spd-lists"
                      [items]="listTabs()"
                      [activeId]="activeListType()"
                      [ariaLabel]="listsAria"
                      (select)="listTab.set($event)"
                    />
                  }

                  @if (activeList(); as list) {
                    <div
                      class="stage"
                      [id]="'spd-lists-panel-' + list.type"
                      [attr.role]="listTabs().length > 1 ? 'tabpanel' : null"
                      [attr.aria-labelledby]="
                        listTabs().length > 1 ? 'spd-lists-tab-' + list.type : null
                      "
                    >
                      @if (list.owned) {
                        <app-lookup-values-panel
                          [type]="list.type"
                          [title]="list.title"
                          [description]="list.description"
                          [deletable]="deletableType(list.type)"
                          (changed)="onListChanged()"
                        />
                      } @else {
                        <!-- SHARED (v36.1.0): other products read this list, so its values are
                             edited on Manage values, once — not a second full editor here. -->
                        <p class="hint">
                          <span i18n="@@spd.list_shared_link"
                            >A shared list — its values are edited on</span
                          >
                          <a
                            class="linkish"
                            [routerLink]="['/lookups']"
                            [queryParams]="{ type: list.type }"
                            i18n="@@spd.list_manage_values"
                            >Manage values</a
                          >.
                        </p>
                      }

                      <!-- The amounts keyed by that list, under the list itself.
                           SAME STORE as step ②, and the same editor: a figure belongs to a
                           step, not to a value, so a second editor that knew how to name one
                           would be a second authority on what it means. What changes here is
                           only which slots are on screen. -->
                      <section class="defaults">
                        @switch (list.figures) {
                          @case ('keyed') {
                            <h4 class="defaults-title">
                              @if (isClassList(list)) {
                                <span i18n="@@spd.def.title_classes"
                                  >The amount each class carries</span
                                >
                              } @else {
                                <span i18n="@@spd.def.title">The amount each answer carries</span>
                              }
                            </h4>
                            <p class="defaults-lede">
                              <span i18n="@@spd.def.lede"
                                >Every bank filing under this product starts from these. A bank that
                                types its own keeps its own copy instead.</span
                              >
                              @if (!list.owned) {
                                <span i18n="@@spd.def.lede_shared"
                                  >The list is shared with other products; these amounts are this
                                  product's alone.</span
                                >
                              }
                            </p>
                            <app-product-rule-editor
                              layout="inline"
                              variant="catalog"
                              [onlyKeyedBy]="list.type"
                              [suggestedBands]="suggestedBands()"
                              [steps]="ruleSteps()"
                              [gates]="ruleGates()"
                              [output]="ruleOutput()"
                              [facts]="facts()"
                              [figures]="stepFigures()"
                              (figuresChange)="onStepFigures($event)"
                              (figuresTouched)="markDirty()"
                            />
                          }
                          @case ('byClass') {
                            <p class="defaults-note">
                              <span i18n="@@spd.def.priced_by_class"
                                >These answers are not priced one by one. Each carries the amount of
                                the class it is filed under, and that is where the figures are
                                set.</span
                              >
                              <ng-container
                                [ngTemplateOutlet]="goToFigures"
                                [ngTemplateOutletContext]="{ $implicit: list.pricedOn }"
                              />
                            </p>
                          }
                          <!-- A COLUMN OF SOMEBODY ELSE'S TABLE, and the state this screen
                               used to report as "no amount is keyed by these answers": the
                               teachers' product prices three stages against two school types,
                               so a school type moves every figure it has — six of them, all
                               entered one axis over, on the stages. -->
                          @case ('asColumn') {
                            <p class="defaults-note">
                              @if (listTitle(list.pricedOn); as home) {
                                <span i18n="@@spd.def.as_column"
                                  >These answers carry no amount of their own. They pick which
                                  column of the amounts on {{ home }} is read — so each of them does
                                  have a figure, one for every value on that list.</span
                                >
                              } @else {
                                <span i18n="@@spd.def.as_column_plain"
                                  >These answers carry no amount of their own. They pick which
                                  column of another list's amounts is read.</span
                                >
                              }
                              <ng-container
                                [ngTemplateOutlet]="goToFigures"
                                [ngTemplateOutletContext]="{ $implicit: list.pricedOn }"
                              />
                            </p>
                          }
                          @default {
                            @if (p.outputKind === null) {
                              <p class="defaults-note" i18n="@@spd.def.cap_only">
                                This product works out no amount of its own. Each bank states its
                                own maximum for these answers on its own program.
                              </p>
                            } @else {
                              <p class="defaults-note" i18n="@@spd.def.no_slot">
                                No amount is keyed by these answers. They steer the calculation
                                rather than carry a figure.
                              </p>
                            }
                          }
                        }
                      </section>

                      <!-- THE BOARD BELONGS TO THE LIST IT FILES, and this is the half the old
                           stacked layout got wrong rather than merely made long: the compounds
                           panel and the board that files those same compounds were 6 000px
                           apart, so the list and the only screen that can change a value's class
                           were never visible together. It renders only in that list's own tab. -->
                      @if (boardFor(list.type); as board) {
                        <!-- FOLDED, because it is a SECOND full-length view of the list
                             directly above it: three hundred compounds rendered as rows, then
                             the same three hundred rendered again as cards under their
                             classes. Open, that tab measured 7 794px. A value's class is also
                             editable per row in the panel above; this is the bulk tool for it,
                             and a bulk tool is something you go to, not something you scroll
                             through on the way to the Save button. -->
                        <details class="structure">
                          <!-- The summary names the ACTION, never the board's own title: the
                               board draws that title as an h2 forty pixels below, and the two
                               together read as the same words said twice at two sizes. -->
                          <summary>
                            <!-- Inline SVG, not nz-icon: a projected icon resolves the
                                 NEAREST NzIconPatchService, so a glyph patched here can be
                                 shadowed by whichever shell it renders inside (v19.1.0). -->
                            <svg
                              class="chev"
                              viewBox="0 0 16 16"
                              width="12"
                              height="12"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                d="M6 3.5 10.5 8 6 12.5"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.6"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                            <span i18n="@@spd.board_fold">Move values between classes</span>
                            @if (boardAttention(); as a) {
                              @if (a.unfiled > 0) {
                                <span class="tag is-warn"
                                  >{{ a.unfiled }}
                                  <span i18n="@@spd.board_unfiled">with no class</span></span
                                >
                              }
                              @if (a.inFallback > 0) {
                                <span class="tag is-warn"
                                  >{{ a.inFallback }}
                                  <span i18n="@@spd.board_catchall">in the catch-all</span></span
                                >
                              }
                            }
                          </summary>
                          <app-parent-class-board
                            [childType]="board.type"
                            [parentType]="board.parentType"
                            [productKey]="key"
                            (changed)="onListChanged()"
                            (attention)="boardAttention.set($event)"
                          />
                        </details>
                      }
                    </div>
                  }
                }

                <!-- The same Save as step ②, because the amounts typed above are the same
                     unsaved object. Withheld on a product with no pipeline: nothing on this
                     step edits a figure there, so the button would never have anything to do. -->
                @if (isPipeline()) {
                  <ng-container [ngTemplateOutlet]="ruleActions"></ng-container>
                }
              </section>
            }
            @case (2) {
              <!-- HOW IT IS WORKED OUT (v33.1.0): the calculation builder, inline. It saves its
                   own shape; the figures stay on the Figures step. Held back while that step has
                   unsaved figures, because a calculation save carries the figures it read. -->
              @if (p.capOnly || dirty()) {
                <section class="panel" [attr.aria-label]="steps()[2]?.label ?? ''">
                  @if (p.capOnly) {
                    <p class="notice" role="status" i18n="@@spd.calc.cap_only">
                      A cap-only product works out no income, so there is no calculation to build.
                      It asks one answer, and each bank caps its own maximum by it.
                    </p>
                  } @else if (dirty()) {
                    <p class="notice" role="status" i18n="@@spd.calc.dirty2">
                      You have changed figures that are not saved yet. Save or discard them first —
                      a calculation change replaces the figures it was built on.
                    </p>
                  }
                </section>
              }
            }
            @case (3) {
              <section class="panel" [attr.aria-label]="steps()[3]?.label ?? ''">
                @if (calcDirty()) {
                  <p class="notice" role="status">
                    @if (saveAllBlocked(); as why) {
                      <span i18n="@@spd.figures.calc_unfinished"
                        >The calculation was changed but isn't finished: {{ why }}</span
                      >
                    } @else {
                      <span i18n="@@spd.figures.calc_unsaved"
                        >The calculation was changed. Save or discard it first.</span
                      >
                    }
                    <button
                      type="button"
                      class="linkish"
                      (click)="goToStep(2)"
                      i18n="@@spd.figures.calc_go"
                    >
                      Go to Calculation
                    </button>
                  </p>
                } @else {
                  <!-- ─── ① PLANS BY DEPOSIT ──────────────────────────────────────────────
                     FIRST, and under a heading of its own. It used to be the LAST of three
                     blocks inside "what every bank falls back to", labelled by an h3 drawn at
                     12px uppercase -- the smallest type on the page naming the biggest control
                     on it, and the same treatment as the single per-cent box two blocks up.
                     Measured, an operator reached it 1 500px down a 2 869px step.

                     It is grouped with those two by STORAGE (all three are inherited), which
                     is a fact about the database and not about the work. The work here is
                     pricing a car loan, and this is the table that does it. -->
                  <!-- Plans price a CAR by its down payment: on a product no car loan sells the
                       section is simply not drawn (v36.1.0). -->
                  @if (isPipeline() && plansApply()) {
                    <!-- FIVE TABLES AS FIVE ROWS.
                         Open, the five measured 3 801px of a 5 237px step — 73% of it — and
                         repeated the same scaffolding four times over: an axis picker, a
                         column header, the identical twenty-word sentence about how a range
                         reads, and a two-radio "If no row matches the customer", once per
                         table. The chrome was louder than the figures.

                         Closed, each row STATES what its table holds, which is what an
                         operator scans this list for, and one is opened to change it. A row
                         with something wrong in it is FORCED open and its toggle refuses:
                         a table that blocks Save must not be hideable. -->
                    <section class="step-sec">
                      <h2 class="sub" i18n="@@spd.plans.title">Plans by deposit</h2>
                      <p class="sec-lede" i18n="@@spd.plans.lede">
                        What the bank charges, how long it lends, how much of the price it finances
                        and the smallest loan it writes — each by the deposit the customer puts
                        down.
                      </p>

                      <!-- ONE PLAN PER LINE. The deposit band is the row and everything a
                           plan states is a column across it, which is how the bank's own card
                           reads: "put 30% down, the rate is 9%, we lend over 72 months, we
                           finance 70%". Five collapsed tables said the same thing in four
                           dialects and made an operator join them on a number labelled in
                           none of them. -->
                      @if (planTable() !== null && !planAdvancedOpen()) {
                        <app-plan-rows-editor
                          [grids]="planValue()"
                          [facts]="facts()"
                          (gridsChange)="onPlanGrids($event)"
                          (removeRequest)="onPlanRemove($event)"
                        />
                      } @else if (planTable() === null && planWhyNotLabel() !== '') {
                        <p class="plan-fallback-note" role="status">{{ planWhyNotLabel() }}</p>
                      }

                      @if (planError(); as broken) {
                        <p class="fb-error" role="alert">
                          <span i18n="@@spd.plans.err3"
                            >The {{ broken }} table is not finished: {{ planErrorDetail() }} — or
                            clear what you typed.</span
                          >
                        </p>
                      }
                      <!-- ONE TABLE AT A TIME. The shape the card above cannot draw, and the
                           only door to the FIRST table on a product that states none. Each row
                           folds as the operator says; an unfinished one says so when closed. -->
                      @if (planTable() !== null) {
                        <button
                          type="button"
                          class="plan-advanced-toggle"
                          (click)="toggleAdvanced()"
                          [attr.aria-expanded]="planAdvancedOpen()"
                          [attr.aria-controls]="planAdvancedOpen() ? 'plan-advanced' : null"
                        >
                          <svg
                            class="chev"
                            viewBox="0 0 16 16"
                            width="12"
                            height="12"
                            aria-hidden="true"
                            focusable="false"
                          >
                            <path
                              d="M6 3.5 10.5 8 6 12.5"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.6"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                          @if (planAdvancedOpen()) {
                            <span i18n="@@spd.plans.as_one">Show the plans as one table</span>
                          } @else {
                            <span i18n="@@spd.plans.advanced">Edit one table at a time</span>
                          }
                        </button>
                      }

                      @if (planAdvancedOpen()) {
                        <div class="plan-advanced" id="plan-advanced">
                          <!-- role="list" restated because list-style: none strips list semantics
                           in Safari/VoiceOver, which is why the three sibling lists on this
                           page carry it too. Five rows announced as five is the whole point of
                           closing them. -->
                          <ul class="plan-list" role="list">
                            @for (slot of planSlots; track slot.key) {
                              <li class="plan-slot">
                                <!-- ONE row and ONE editor whether or not the table is stated
                                     yet, so the first keystroke into an empty table does not swap
                                     the editor (and the focus) out from under the operator.
                                     aria-controls is set only while the region exists. -->
                                <button
                                  type="button"
                                  class="plan-row"
                                  (click)="togglePlanSlot(slot.key)"
                                  [attr.aria-expanded]="planSlotOpen(slot.key)"
                                  [attr.aria-controls]="
                                    planSlotOpen(slot.key) ? 'plan-body-' + slot.key : null
                                  "
                                >
                                  <!-- Inline SVG, not nz-icon: a projected icon resolves the
                                       NEAREST NzIconPatchService (v19.1.0). -->
                                  <svg
                                    class="chev"
                                    viewBox="0 0 16 16"
                                    width="12"
                                    height="12"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path
                                      d="M6 3.5 10.5 8 6 12.5"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="1.6"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    />
                                  </svg>
                                  <span class="plan-row-title">{{ slot.title }}</span>
                                  @if (planSlotUnfinished(slot.key)) {
                                    <span class="plan-row-state is-warn">{{
                                      planUnfinishedLabel
                                    }}</span>
                                  } @else if (planGrid(slot.key)) {
                                    <span class="plan-row-state">{{ planSummary(slot.key) }}</span>
                                  } @else {
                                    <span class="plan-row-state">{{ planNotSet }}</span>
                                  }
                                </button>
                                @if (planSlotOpen(slot.key)) {
                                  <div class="plan-body" [id]="'plan-body-' + slot.key">
                                    @if (!planGrid(slot.key)) {
                                      <p class="plan-empty-note">{{ slot.empty }}</p>
                                    }
                                    <app-fact-grid-editor
                                      [config]="planGrid(slot.key) ?? emptyPlanGrid"
                                      (configChange)="setPlanGrid(slot.key, $event)"
                                      [facts]="facts()"
                                      [valueKind]="slotValueKind(slot.key)"
                                      [monthsBound]="slotMonthsBound(slot.key)"
                                    />
                                    @if (planGrid(slot.key)) {
                                      <p class="plan-body-foot">
                                        <button
                                          type="button"
                                          class="link-btn"
                                          (click)="clearPlanGrid(slot.key)"
                                          [attr.aria-label]="slot.removeAria"
                                          i18n="@@spd.plans.remove"
                                        >
                                          Remove this table
                                        </button>
                                      </p>
                                    }
                                  </div>
                                }
                              </li>
                            }
                          </ul>
                          @if (planBandMismatch(); as note) {
                            <p class="plan-mismatch" role="status">{{ note }}</p>
                          }
                        </div>
                      }

                      @if (planReaders(); as readers) {
                        <p class="tenor-readers">
                          <!-- WHO IS COUNTED, said accurately. followsPlans is the OPTED-IN
                               set, and "states no plans of its own" is a different population:
                               a program can state none AND not read these, which is the
                               explicit opt-out this whole field exists to make sayable. The
                               old wording described the opt-out as if it were inheritance. -->
                          <span i18n="@@spd.plans.readers2"
                            >{{ readers }} bank program(s) read these plans. A change here reaches
                            all of them.</span
                          >
                        </p>
                      }
                    </section>
                  }

                  <!-- (2026-11-08) Only what some product states is drawn here: the term and the
                       loan size. The debt-burden default, the interest-rate default, the I-Score
                       table and the starting cap table were stated by no product and are gone
                       from this tab; every bank program states those itself. -->
                  <!-- ─── ② WHAT EVERY BANK FALLS BACK TO ──────────────────────────────────
                     Two figures, and they are here rather than on each bank's wizard for the
                     one reason they share: each is a single statement about this product that
                     every program selling it reads unless it states its own, so a change here
                     moves live quotes. That promise is said ONCE, by the lede.

                     THREE BOXES ON ONE LINE, not three blocks down a scroll. Each carried an
                     h3 micro-label plus a two-line lede above a 9rem field -- ~110px of prose
                     over a 44px control, twice, saying between them what the section's own
                     lede already says. The labels are the fields' own now, which is what
                     figure-field's own label input is for and what the two month boxes already
                     did; each keeps its error line and its reader count, because those carry
                     refusals nothing else states.

                     Grouped by a heading, spacing and hairlines — never a card. The panel
                     is already a container and a box inside a box is the nesting this
                     screen was rebuilt to remove (v25.1.0). -->
                  @if (isPipeline()) {
                    <section class="step-sec">
                      <h2 class="sub" i18n="@@spd.sec.inherited">
                        Defaults for every bank that sells this product
                      </h2>
                      <p class="sec-lede" i18n="@@spd.sec.inherited_lede2">
                        A bank uses these where its own program states nothing. Changes reach live
                        quotes.
                      </p>

                      <section class="fb-block">
                        <div class="fb-row">
                          <!-- Two boxes and not one field, because the two ends are two
                             decisions a sheet prints separately. -->
                          <app-figure-field
                            fieldId="product-tenor-min"
                            unit="months"
                            [label]="tenorMinLabel"
                            [value]="tenorMinValue() ?? ''"
                            (valueChange)="setTenorMin($event)"
                            [ariaLabel]="tenorMinAria"
                            [placeholderNote]="tenorBlankNote"
                          ></app-figure-field>
                          <app-figure-field
                            fieldId="product-tenor-max"
                            unit="months"
                            [label]="tenorMaxLabel"
                            [value]="tenorMaxValue() ?? ''"
                            (valueChange)="setTenorMax($event)"
                            [ariaLabel]="tenorMaxAria"
                            [placeholderNote]="tenorBlankNote"
                          ></app-figure-field>
                        </div>
                        @if (tenorError(); as problem) {
                          <p class="fb-error" role="alert">
                            @switch (problem) {
                              @case ('range') {
                                <span i18n="@@spd.tenor.err_range"
                                  >Each figure must be a whole number of months between 1 and
                                  480.</span
                                >
                              }
                              @case ('inverted') {
                                <span i18n="@@spd.tenor.err_inverted"
                                  >The longest term must be at least the shortest.</span
                                >
                              }
                              @case ('half') {
                                <span i18n="@@spd.tenor.err_half"
                                  >State both months or neither — one on its own is a range nobody
                                  set.</span
                                >
                              }
                            }
                          </p>
                        }
                        @if (tenorClearBlocked() && tenorReaders(); as readers) {
                          <p class="tenor-readers is-warn">
                            <span i18n="@@spd.tenor.readers_clear"
                              >{{ readers }} bank program(s) have no duration of their own and are
                              using these months. Emptying the boxes would leave them unable to
                              quote, so it will be refused — give each of them its own duration
                              first.</span
                            >
                          </p>
                        }

                        <!-- THE SIZE, on its own row rather than squeezed onto the one above:
                           five boxes across wrapped into a ragged second line at card width,
                           and these two are one decision that has to read as a pair. Two
                           boxes and not one field, for the reason the months are two: the
                           ends are two figures a sheet prints separately. -->
                        <div class="fb-row">
                          <app-figure-field
                            fieldId="product-amount-min"
                            unit="EGP"
                            [money]="true"
                            [label]="amountMinLabel"
                            [value]="amountMinValue() ?? ''"
                            (valueChange)="setAmountMin($event)"
                            [ariaLabel]="amountMinAria"
                            [placeholderNote]="amountBlankNote"
                          ></app-figure-field>
                          <app-figure-field
                            fieldId="product-amount-max"
                            unit="EGP"
                            [money]="true"
                            [label]="amountMaxLabel"
                            [value]="amountMaxValue() ?? ''"
                            (valueChange)="setAmountMax($event)"
                            [ariaLabel]="amountMaxAria"
                            [placeholderNote]="amountBlankNote"
                          ></app-figure-field>
                        </div>
                        @if (amountError(); as problem) {
                          <p class="fb-error" role="alert">
                            @switch (problem) {
                              @case ('range') {
                                <span i18n="@@spd.amount.err_range"
                                  >Each amount must be a figure above zero, to at most two
                                  decimals.</span
                                >
                              }
                              @case ('inverted') {
                                <span i18n="@@spd.amount.err_inverted"
                                  >The largest loan must be at least the smallest.</span
                                >
                              }
                              @case ('half') {
                                <span i18n="@@spd.amount.err_half"
                                  >State both amounts or neither — one on its own is a range nobody
                                  set.</span
                                >
                              }
                            }
                          </p>
                        }
                        @if (amountClearBlocked() && amountReaders(); as readers) {
                          <p class="tenor-readers is-warn">
                            <span i18n="@@spd.amount.readers_clear"
                              >{{ readers }} bank program(s) have no amounts of their own and are
                              using these. Emptying the boxes would leave them unable to quote, so
                              it will be refused — give each of them its own amounts first.</span
                            >
                          </p>
                        }
                      </section>
                    </section>
                  }

                  <!-- ─── ④ THE CALCULATION ───────────────────────────────────────────────
                     LAST, and folded. The steps are the LIBRARY's: they are authored by a form
                     on another screen, they are the same for every bank selling this product,
                     and an operator opens this page to move a rate, not to re-read the
                     arithmetic. What is editable here is the figures those steps start from --
                     so the toggle says how many steps there are and whether one of them is
                     unfinished, and nothing is hidden without being reported.

                     Opens by itself while a step is unfinished; the operator can still close
                     it, and the toggle keeps saying a step is not finished. -->
                  <section class="step-sec">
                    <h2 class="sub" i18n="@@spd.sec.calc_figures">The calculation's own figures</h2>

                    @if (isPipeline()) {
                      <button
                        type="button"
                        class="plan-advanced-toggle"
                        (click)="toggleCalc()"
                        [attr.aria-expanded]="calcOpen()"
                        [attr.aria-controls]="calcOpen() ? 'calc-body' : null"
                      >
                        <svg
                          class="chev"
                          viewBox="0 0 16 16"
                          width="12"
                          height="12"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            d="M6 3.5 10.5 8 6 12.5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.6"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        <span>{{ calcToggleLabel() }}</span>
                      </button>
                    }

                    @if (calcOpen()) {
                      <div class="calc-body" id="calc-body">
                        @if (hasTemplate()) {
                          <!-- Authored through the form: say what it does in words, and offer the
                         form. The steps stay reachable below, but they are not the door. -->
                          <p class="notice" role="status">
                            <span i18n="@@spd.form.lede"
                              >This calculation was built from a form, so it can be changed by
                              answering the same questions again.</span
                            >
                            <button
                              type="button"
                              class="linkish"
                              (click)="goToStep(2)"
                              i18n="@@spd.form.edit"
                            >
                              Change how the income is worked out
                            </button>
                          </p>
                        } @else if (isPipeline()) {
                          <p class="notice" role="status">
                            <span i18n="@@spd.form.handbuilt"
                              >This calculation was built step by step rather than from a form, so
                              there is no form to open for it.</span
                            >
                          </p>
                        }

                        @if (!isPipeline()) {
                          <p class="notice" role="status">
                            <span i18n="@@spd.structure.offer">
                              This product works its income out from a single figure. Answer three
                              questions and we will build the calculation for you.
                            </span>
                            <button
                              type="button"
                              class="linkish"
                              (click)="goToStep(2)"
                              i18n="@@spd.structure.form"
                            >
                              Build it from a form
                            </button>
                          </p>
                        }

                        <form [formGroup]="ruleGroup">
                          <app-income-assumption-section
                            variant="catalog"
                            [group]="ruleGroup"
                            [keyTable]="ruleKeyTable()"
                            (keyTableChange)="onKeyTable($event)"
                            [bands]="ruleBands()"
                            (bandsChange)="onBands($event)"
                            [ruleSteps]="ruleSteps()"
                            [ruleGates]="ruleGates()"
                            [ruleOutput]="ruleOutput()"
                            [stepFigures]="stepFigures()"
                            (stepFiguresChange)="onStepFigures($event)"
                            (stepFiguresTouched)="markDirty()"
                          ></app-income-assumption-section>
                        </form>
                      </div>
                    }
                  </section>

                  @if (p.usedBy.length === 0) {
                    <p class="reach">
                      <span i18n="@@spd.reach_none"
                        >Nothing sells this yet, so a change here reaches no bank.</span
                      >
                    </p>
                  }

                  <ng-container [ngTemplateOutlet]="ruleActions"></ng-container>
                }
              </section>
            }

            @case (4) {
              <!-- CHECK AND GO LIVE (v36.1.0; Try it and Review were two steps): sample answers
                   through the calculation, then what this product is, the one switch, and who
                   sells it. The test sits first — it is what tells the operator to go live. -->
              @if (!p.capOnly) {
                <section class="panel">
                  <app-product-test-panel [productKey]="key" />
                </section>
              }
              <section class="panel review" [attr.aria-label]="steps()[4]?.label ?? ''">
                <dl class="review-facts">
                  <div class="review-fact">
                    <dt i18n="@@spd.review.status">Status</dt>
                    <dd>{{ statusLabel() }}</dd>
                  </div>
                  <div class="review-fact">
                    <dt i18n="@@spd.review.asks">Questions it asks</dt>
                    <dd>{{ reviewAsks() }}</dd>
                  </div>
                  <div class="review-fact">
                    <dt i18n="@@spd.review.calc">How it is worked out</dt>
                    <dd>{{ lede() }}</dd>
                  </div>
                  <div class="review-fact">
                    <dt i18n="@@spd.review.sold">Sold as</dt>
                    <dd>{{ reviewSold() }}</dd>
                  </div>
                </dl>

                @if (changeCount() > 0) {
                  <p class="notice" role="status" i18n="@@spd.review.unsaved">
                    You have changes that are not saved yet — save them before going live.
                  </p>
                } @else if (!p.active && notReady().length > 0) {
                  <p class="notice" role="status" i18n="@@spd.review.not_ready">
                    It can't go live yet — see “Before this can go live” above.
                  </p>
                }

                <div class="review-actions">
                  @if (p.active) {
                    <button nz-button type="button" [disabled]="saving()" (click)="confirmOff()">
                      <span nz-icon nzType="poweroff" nzTheme="outline" aria-hidden="true"></span>
                      <span i18n="@@spd.power.off">Switch this calculation off</span>
                    </button>
                  } @else {
                    <button
                      nz-button
                      nzType="primary"
                      type="button"
                      [disabled]="saving() || notReady().length > 0 || changeCount() > 0"
                      (click)="setActive(true)"
                    >
                      <span nz-icon nzType="poweroff" nzTheme="outline" aria-hidden="true"></span>
                      <span i18n="@@spd.power.go_live">Go live</span>
                    </button>
                  }
                </div>

                <h2 class="review-h" i18n="@@spd.review.uses">Who uses it</h2>
                <app-product-uses-step [product]="p" (sell)="openSell()" />
              </section>
            }
          }

          <!-- The calculation builder lives OUTSIDE the steps (v33.2.0) so its unsaved answers
               survive moving between them; it is shown on step 2 only. -->
          @if (!p.capOnly) {
            <div class="calc-host" [hidden]="stepIndex() !== 2 || dirty()">
              <app-product-template-page [embeddedKey]="key" [askedCodes]="ownAskCodes()" />
            </div>
          }

          <nav class="stepnav" [attr.aria-label]="stepsAria">
            <button
              nz-button
              type="button"
              [disabled]="stepIndex() === 0"
              (click)="goToStep(stepIndex() - 1)"
            >
              <span i18n="@@spd.back_step">Back</span>
            </button>
            <button
              nz-button
              type="button"
              [disabled]="stepIndex() === lastStep"
              (click)="goToStep(stepIndex() + 1)"
            >
              {{ nextLabel() }}
            </button>
          </nav>

          <!-- ONE SAVE for the whole product (v33.2.0): question ticks, the calculation and the
               figures are all held until here. A live product asks before it saves. -->
          @if (changeCount() > 0 || savingAll()) {
            <div class="save-bar" role="region" [attr.aria-label]="saveBarAria">
              <p class="save-bar-text">
                @if (saveAllError(); as message) {
                  <span class="save-bar-error" role="alert">{{ message }}</span>
                } @else if (saveAllBlocked()) {
                  {{ changeLabel() }} — {{ saveAllBlocked() }}
                } @else {
                  {{ changeLabel() }}
                }
              </p>
              <button nz-button type="button" [disabled]="savingAll()" (click)="discardAll()">
                <span i18n="@@spd.bar.discard">Discard</span>
              </button>
              <button
                nz-button
                nzType="primary"
                type="button"
                [nzLoading]="savingAll()"
                [disabled]="saveAllBlocked() !== null"
                [attr.title]="saveAllBlocked()"
                (click)="requestSaveAll()"
              >
                <span i18n="@@spd.bar.save">Save changes</span>
              </button>
            </div>
          }
        } @else {
          <p class="notice is-bad" role="alert">
            <span nz-icon nzType="exclamation-circle" nzTheme="outline"></span>
            <span i18n="@@spd.not_found"
              >This surrogate product could not be loaded. It may have been removed.</span
            >
          </p>
        }
      }
    </section>

    <!-- ONE Save for the whole product. The figures on step ① and the figures on step ② are
         two viewports on one unsaved object, so two buttons would be two writes racing over
         one JSON blob, and the write posts the entire figure set either way. -->
    <ng-template #ruleActions>
      @if (saveError(); as message) {
        <p class="notice is-bad" role="alert">
          <span nz-icon nzType="exclamation-circle" nzTheme="outline"></span>
          <span>{{ message }}</span>
        </p>
      }

      @if (ruleBlocked()) {
        <p class="notice is-bad" role="alert">
          <span nz-icon nzType="exclamation-circle" nzTheme="outline"></span>
          <span i18n="@@spd.save_blocked"
            >Some steps have no figures yet, or a step offering several ways to reach the figure has
            none of them filled in. The save would be refused.</span
          >
        </p>
      }
    </ng-template>

    <!-- THE TRIP, not a description of it. A list whose figures live on another list has
         one useful next move, and that list is a tab on the rail directly above — so the
         note ends in the click rather than in the name of a place to go looking for.
         Withheld when the figures have more than one home (a pick whose two columns read
         different facts): naming one would hide the other. -->
    <ng-template #goToFigures let-target>
      @if (listTitle(target); as home) {
        <button class="linkish" type="button" (click)="listTab.set(target)">
          <span i18n="@@spd.def.go_figures">Open {{ home }}</span>
        </button>
      }
    </ng-template>

    <!-- Add a question: the program page's side sheet over the list it adds to. An Add is held
         until Save, like every change here, so the sheet's one exit is Done. -->
    <ng-template #addSheet>
      <app-form-drawer
        [title]="addSheetTitle"
        [subtitle]="addSheetSub"
        [submitLabel]="doneLabel"
        [showCancel]="false"
        (cancelled)="closeAddSheet()"
        (submitted)="closeAddSheet()"
      >
        <span drawerIcon nz-icon nzType="plus" nzTheme="outline"></span>
        <app-addable-questions [rows]="addableRows()" (add)="addAskByCode($event.code)" />
      </app-form-drawer>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        /* The Program catalog's frame, the same on every page of the section. */
        padding: var(--space-6);
        max-inline-size: 1120px;
        margin-inline: auto;
      }

      .back {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--text-secondary);
        text-decoration: none;
        cursor: pointer;
        align-self: flex-start;
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }

      .back:hover {
        color: var(--primary);
      }

      .back:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }

      /* The arrow points back along the reading direction, so it mirrors in Arabic. */
      :host-context([dir='rtl']) .back [nz-icon] {
        transform: scaleX(-1);
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      /* A LABEL plus links, not a sentence with the names interpolated into it: the count
         and the list would need plural and verb agreement in Arabic, and the names are
         operator-typed content that must not sit inside a translated phrase. */
      .panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-6);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }

      /* Narrow-screen inset. This used to buy back the SECOND frame the shared income
         section drew for itself — 32px of panel plus 16px of section on each side left
         228px of a 390px screen for the figures. That section is frameless now
         (see section.styles.scss), so the doubling is gone and this is what it says it is:
         a phone-sized panel, still bordered because the border is what separates the
         stage from the rail. */
      @media (max-width: 640px) {
        .panel {
          gap: var(--space-5);
          padding: var(--space-5);
        }
        /* Two rows at this width, so centre them rather than pushing the range
           line to one edge and the pages to the other. */
        .ask-pager {
          justify-content: center;
        }
      }

      /* A disclosure inside the stage, folded by default. Its one caller is the filing
         board, whose own header supplies the title and counts once opened — the summary is a
         trigger, not a second heading. */
      .structure {
        border-inline-start: 2px solid var(--border-subtle);
        padding-inline-start: var(--space-4);
      }
      .structure > summary {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-field);
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: 600;
        cursor: pointer;
        list-style: none;
      }
      .structure > summary::-webkit-details-marker {
        display: none;
      }
      /* The only affordance this row has: with the native marker suppressed and no border of
         its own, a summary is a line of text that happens to be clickable. It mirrors in RTL
         because it points along the reading direction, and rotates rather than swapping to a
         second glyph so the two states are one object moving. */
      .structure > summary .chev {
        flex: none;
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      :host-context([dir='rtl']) .structure > summary .chev {
        transform: scaleX(-1);
      }
      .structure[open] > summary .chev {
        transform: rotate(90deg);
      }
      :host-context([dir='rtl']) .structure[open] > summary .chev {
        transform: scaleX(-1) rotate(90deg);
      }
      @media (prefers-reduced-motion: reduce) {
        .structure > summary .chev {
          transition: none;
        }
      }
      .structure > summary:hover {
        background: var(--bg-subtle);
        color: var(--text-primary);
      }
      .structure > summary:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      /* THE FILLED BLUE BUTTON IS GONE, and so is the box it sat in. It was a card inside
         the panel -- the nesting this screen's own comment says it was rebuilt to remove --
         and it carried the loudest element on a 2 869px step for the rarest action on it:
         re-answering the form that built the calculation. Meanwhile Save, the only thing an
         operator presses every visit, was grey and 2 800px below. A sentence and a text link
         say the same thing; the filled primary is Save's alone. */
      .structure[open] > summary {
        margin-block-end: var(--space-4);
      }
      .linkish {
        border: 0;
        background: none;
        padding: 0;
        margin-inline-start: var(--space-2);
        color: var(--accent);
        font: inherit;
        font-weight: 600;
        text-decoration: underline;
        cursor: pointer;
      }
      .linkish:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .chrome {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      /* ─── One Save (v33.2.0) ─────────────────────────────────────────────────── */
      .save-bar {
        position: sticky;
        inset-block-end: var(--space-3);
        z-index: 5;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--border-default));
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        box-shadow: var(--shadow-md);
      }
      .save-bar-text {
        margin: 0;
        margin-inline-end: auto;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .save-bar-error {
        color: var(--error-strong);
      }
      .ask-pending {
        flex: none;
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--warning) 14%, var(--bg-surface));
        color: var(--text-primary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }
      .review {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .review-facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
        gap: var(--space-3);
        margin: 0;
      }
      .review-fact {
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .review-fact dt {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
      }
      .review-fact dd {
        margin: var(--space-1) 0 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      .review-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .review-h {
        margin: var(--space-2) 0 0;
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .name-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
        gap: var(--space-4);
      }
      .name-field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .name-label {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .name-key {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin: var(--space-4) 0 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .life-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      /* Readiness: what a new product still needs before it can go live (v33.0.0). */
      .ready-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--color-border-default));
        border-radius: var(--radius-md);
        background: var(--bg-surface);
      }
      .ready-card.is-ok {
        border-inline-start-color: var(--color-success);
      }
      .ready-title {
        margin: 0;
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .ready-body {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .ready-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        margin: 0;
        padding-inline-start: var(--space-5);
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      /* All four states on both buttons — the ghost had only a focus ring, so the
         everyday pointer gesture landed on a control that never acknowledged it. */
      .danger-action,
      .ghost-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        min-block-size: var(--size-field);
        padding-inline: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: 500;
        cursor: pointer;
        transition:
          background-color 120ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 120ms cubic-bezier(0.4, 0, 0.2, 1),
          color 120ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .ghost-action:hover:not(:disabled) {
        border-color: var(--border-strong);
        background: var(--bg-subtle);
        color: var(--text-primary);
      }
      /* --error is a wash-and-dot colour: as a label on the page surface it measures
         3.81:1 in light, and under white ink as a fill it measures the same. Both under
         AA, both fixed by the strong pair — 7.80:1 in light, 6.76 / 5.57 in dark. */
      .danger-action:hover:not(:disabled) {
        border-color: var(--error-strong);
        background: color-mix(in srgb, var(--error) 8%, var(--bg-surface));
        color: var(--error-strong);
      }
      .danger-action.solid {
        background: var(--error-strong);
        border-color: var(--error-strong);
        color: var(--text-on-accent);
        font-weight: 600;
      }
      .danger-action.solid:hover:not(:disabled) {
        background: color-mix(in srgb, var(--error-strong) 88%, var(--text-primary));
        border-color: color-mix(in srgb, var(--error-strong) 88%, var(--text-primary));
        color: var(--text-on-accent);
      }
      .danger-action:active:not(:disabled),
      .ghost-action:active:not(:disabled) {
        transform: translateY(1px);
      }
      .danger-action:disabled,
      .ghost-action:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .danger-action:focus-visible,
      .ghost-action:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      /* A CONFIRMATION, not a notice. The .notice rule is a flex ROW built for one glyph beside
         one sentence; these blocks carry a title, a paragraph, a list of program codes and
         two buttons, and as row children they laid out side by side — the consequence, the
         evidence and the decision reading as three unrelated columns. This is the column
         stack that shape actually wants: one thing under the next, in reading order. */
      .confirm {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        margin: 0;
        padding: var(--space-4) var(--space-5);
        border-inline-start: 3px solid var(--error-strong);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--error) 8%, var(--bg-surface));
        color: var(--text-primary);
        line-height: 1.6;
        animation: confirm-in 160ms cubic-bezier(0.4, 0, 0.2, 1) both;
      }
      @keyframes confirm-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .confirm {
          animation: none;
        }
        .danger-action:active:not(:disabled),
        .ghost-action:active:not(:disabled) {
          transform: none;
        }
      }
      .confirm-title {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-base);
        font-weight: 600;
        color: var(--text-primary);
      }
      .confirm-glyph {
        color: var(--error-strong);
        font-size: var(--text-base);
      }
      /* Capped measure: the banner spans the page, and an uncapped paragraph on a 1440px
         shell runs past the length an eye can track back from. */
      .confirm-body {
        max-inline-size: 68ch;
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      /* Program codes are discrete items, not prose — chips, not bullets. */
      .code-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .code-chips li {
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-sm);
        background: color-mix(in srgb, var(--error) 14%, var(--bg-surface));
        color: var(--text-primary);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
      }
      /* Start-aligned with the sentence they answer: this is a banner in flow, not a
         modal footer, so the decision sits under the text that argues for it. */
      .confirm-actions {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        margin-block-start: var(--space-1);
      }
      .notice {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-4);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .notice.is-bad {
        background: color-mix(in srgb, var(--error) 8%, var(--bg-surface));
        color: var(--text-primary);
      }

      .reach {
        margin: 0;
        max-inline-size: 60ch;
        font-size: var(--text-sm);
        line-height: 1.6;
        color: var(--text-secondary);
      }

      /* ─── THE THREE NAMED SECTIONS OF STEP ② ────────────────────────────────────────
         Seven blocks used to sit on one scroll with nothing naming the difference between
         them, and the difference is the whole model: what the product WORKS OUT, what every
         bank FALLS BACK TO while its own program states nothing, and what a new program
         merely COPIES when it is created. Each block re-explained that in a lede of its own,
         in near-identical words, three times over.

         A heading, a hairline and space — never a card. The panel is already a container,
         and a box inside a box is the nesting this screen was rebuilt to remove (v25.1.0). */
      .step-sec {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      /* The panel's own flex gap already separates them; the rule and the extra space are
         what make three sections read as three rather than as one long column. */
      .step-sec + .step-sec {
        padding-block-start: var(--space-6);
        border-block-start: 1px solid var(--border-subtle);
      }

      /* .sub carries a top margin for the one place step ① uses it, mid-column. Here the
         flex gap owns the spacing and the margin would double it. */
      .step-sec > .sub {
        margin: 0;
      }

      /* SECONDARY, like every other lede on this step: it states that a change moves live
         quotes at every bank reading it, which is the one thing an operator must read.
         Tertiary measures 3.83:1 on this ground in light mode (DESIGN_SYSTEM.md). */
      .sec-lede {
        margin: 0;
        max-inline-size: 60ch;
        font-size: var(--text-sm);
        line-height: 1.6;
        color: var(--text-secondary);
      }

      /* ONE decision under a micro-label, laid out on the panel's own ground rather than in
         a card of its own: the panel is already a container and a box inside a box is the
         nesting this screen was rebuilt to remove (v25.1.0).

         Named for what it is — a thing every bank FALLS BACK to — and not dbr-cap, which
         was the first of the three to be written and then wrapped a loan duration and five
         plan tables under a name that says debt burden. */
      .fb-block {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .fb-title {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-secondary);
      }

      /* SECONDARY, not tertiary: this sentence states that a change here moves live quotes at
         every bank reading it, which is the one thing an operator must actually read. Tertiary
         measures 3.83:1 on this ground in light mode (DESIGN_SYSTEM.md). */
      .fb-lede {
        margin: 0;
        max-inline-size: 60ch;
        font-size: var(--text-sm);
        line-height: 1.6;
        color: var(--text-secondary);
      }

      /* Side by side down to the narrowest column this panel gets: the two ends of one range
         read as one decision, and stacked they read as two unrelated numbers. */
      /* ONE LINE. Three single figures every bank inherits, so they are read across, not
         down; they wrap to two and then one on their own, because the row is a flex with no
         breakpoint and each box states its own width. */
      .fb-row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: var(--space-3) var(--space-5);
      }

      .calc-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .tenor-fields {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
      }

      /* SECONDARY, like the lede above it and for the same reason: it states how many live
         programs a change here moves, which is the sentence an operator has to read. */
      /* The tier table and its heading, set as the fourth statement in the defaults group
         rather than as a card: the panel is already a container and a box inside a box is
         the nesting this screen was rebuilt to remove (v25.1.0). Separated from the rows
         above by space alone, like every other sub-statement here. */
      .fb-tiers {
        margin-block-start: var(--space-5);
        /* AND a bottom margin, which the three statements above this one do not need: they
           are followed by more content inside the block, where this is its LAST child. Its
           reader line ended flush with the block's own bottom edge (measured: both at
           892.06px), so the sentence butted straight against the next section's hairline
           with no breathing space -- it read as clipped text. */
        margin-block-end: var(--space-5);
      }
      /* Same ramp and ink as .sub, one step down: it names a table inside a section that
         already has a heading. */
      .fb-tiers-title {
        margin: 0 0 var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }

      .tenor-readers {
        margin: 0;
        max-inline-size: 60ch;
        font-size: var(--text-sm);
        line-height: 1.6;
        color: var(--text-secondary);
      }

      /* Not an error — nothing is wrong. It says the clear will be refused, which is a
         consequence of a state the operator has not asked for yet. */
      .tenor-readers.is-warn {
        color: var(--text-primary);
        font-weight: var(--font-medium);
      }

      .rate-legend {
        display: block;
        padding: 0;
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }

      .radio {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--text-primary);
        cursor: pointer;
      }

      .rate-variable {
        margin-block-start: var(--space-1);
      }

      .rate-note {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        max-inline-size: 42rem;
      }

      /* --error is #C1666B, which measures 3.81:1 on this card's ground in light mode — under
         AA, on the one sentence an operator MUST read to get Save back. --error-strong is the
         same hue at a weight that clears it, and it is the token the theme already defines for
         exactly this: error text, as opposed to an error border or wash. */
      .fb-error {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--error-strong);
      }

      /* ─── THE FIVE PLAN TABLES, AS FIVE ROWS ────────────────────────────────────────
         Every table open at once measured 3 801px of a 5 237px step, and four of those
         pixels in five were scaffolding rather than figures: an axis picker, a column
         header, the identical twenty-word sentence about how a range reads, and a
         two-radio "If no row matches the customer", once per table.

         So the list closes. A row states what its table holds — the thing an operator
         scans a list of five for — and opens to be changed. Hairlines and not boxes:
         five cards inside a card is the shape this page already refuses one step to the
         left. */
      .plan-list {
        list-style: none;
        margin: 0;
        padding: 0;
        border-block-end: 1px solid var(--border-subtle);
      }

      .plan-slot {
        display: flex;
        flex-direction: column;
        border-block-start: 1px solid var(--border-subtle);
      }

      /* ONE LINE: glyph, title, state — the settings-row shape, with the state on the end
         edge where a list of them reads as a column. It took two lines only because the
         state was a sentence or three chained question names; now it is "20 rows" or "Not
         set", both of which sit beside a title at any width. The glyph column is fixed so
         the titles align down the list whether the row holds a chevron or a plus. */
      .plan-row {
        display: grid;
        grid-template-columns: 12px minmax(0, 1fr) auto;
        column-gap: var(--space-3);
        align-items: center;
        inline-size: 100%;
        min-block-size: 44px;
        margin: 0;
        padding-block: var(--space-3);
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: start;
      }

      button.plan-row {
        cursor: pointer;
      }

      button.plan-row:hover {
        background: var(--bg-subtle);
      }

      /* The house ring, not the local --accent one two disclosures to the left: that one
         resolves to a tan that measures under 3:1 against both grounds this row sits on, and
         SC 1.4.11 is about the indicator, not the text. Inset, because the row is full-bleed
         to the hairline above it. */
      button.plan-row:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: calc(var(--focus-ring-offset) * -1);
      }

      /* A row whose table blocks Save is FORCED open and refuses to close, so its toggle
         is announced as unavailable rather than as a control that does nothing. Never the
         the disabled attribute: that drops it out of the tab order, and the reason it is
         open is two lines below it. */
      button.plan-row[aria-disabled='true'] {
        cursor: default;
      }

      button.plan-row[aria-disabled='true']:hover {
        background: none;
      }

      .plan-row .chev {
        grid-area: 1 / 1;
        flex: none;
        color: var(--text-secondary);
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }

      /* It points along the reading direction, and rotates rather than swapping to a second
         glyph so the two states are one object moving — the same pair the disclosure one
         step to the left already uses. */
      :host-context([dir='rtl']) .plan-row .chev {
        transform: scaleX(-1);
      }

      button.plan-row[aria-expanded='true'] .chev {
        transform: rotate(90deg);
      }

      :host-context([dir='rtl']) button.plan-row[aria-expanded='true'] .chev {
        transform: scaleX(-1) rotate(90deg);
      }

      @media (prefers-reduced-motion: reduce) {
        .plan-row .chev {
          transition: none;
        }
      }

      .plan-row-title {
        grid-area: 1 / 2;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }

      /* The plus shares the chevron's column, ink and size — one glyph column down the
         list, whether the row opens a table or states one. */
      .plan-add {
        grid-area: 1 / 1;
        flex: none;
        color: var(--text-secondary);
      }

      button.plan-row:hover .plan-add,
      button.plan-row:hover .chev {
        color: var(--text-primary);
      }

      /* SECONDARY, not tertiary: it is the value of the row, read on every pass, and
         tertiary measures 3.83:1 on this ground in light mode. Tabular figures because
         five of these stack into a column of counts, and proportional digits make a
         column of numbers look ragged at the one place it should look like a column. */
      .plan-row-state {
        grid-area: 1 / 3;
        text-align: end;
        font-size: var(--text-sm);
        font-variant-numeric: tabular-nums;
        color: var(--text-secondary);
      }

      .plan-row-state.is-warn {
        color: var(--color-warning);
      }

      .plan-empty-note {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      .plan-na {
        margin-block-end: 0;
      }

      .plan-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding-block-end: var(--space-4);
      }

      /* Remove lives in the body and not on the row: on the closed row it would be a
         destructive verb one pixel from the control that merely opens the thing. */
      .plan-body-foot {
        margin: 0;
      }

      /* Advice, not a refusal — a status line, inked like the lede rather than like the error
         above it. It reports that two tables disagree about which deposits they cover, which
         the five tables cannot show by being looked at, and which a CLOSED list cannot show
         at all — so it is the one line here that had to survive the fold. */
      /* The sentence that replaces the fused card when the stored shape cannot be drawn as
         one. Secondary, not tertiary: it is a sentence somebody has to read to know why the
         screen changed shape, and tertiary measures 3.83:1 on this ground in light mode. */
      .plan-fallback-note {
        margin: 0 0 var(--space-3);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .plan-advanced-toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-size: var(--text-sm);
        color: var(--primary);
        cursor: pointer;
      }
      .plan-advanced-toggle:hover {
        color: var(--primary-hover);
      }
      .plan-advanced-toggle:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }
      .plan-advanced-toggle .chev {
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      :host-context([dir='rtl']) .plan-advanced-toggle .chev {
        transform: scaleX(-1);
      }
      .plan-advanced-toggle[aria-expanded='true'] .chev {
        transform: rotate(90deg);
      }
      :host-context([dir='rtl']) .plan-advanced-toggle[aria-expanded='true'] .chev {
        transform: scaleX(-1) rotate(90deg);
      }
      @media (prefers-reduced-motion: reduce) {
        .plan-advanced-toggle .chev {
          transition: none;
        }
      }
      .plan-advanced {
        margin-block-start: var(--space-3);
      }
      .plan-mismatch {
        margin: 0;
        max-inline-size: 60ch;
        font-size: var(--text-sm);
        line-height: 1.6;
        color: var(--text-primary);
        font-weight: var(--font-medium);
      }

      /* A verb, drawn as a link because it is one — never a second primary button beside the
         Save this page already has. */
      .link-btn {
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-size: var(--text-sm);
        color: var(--primary);
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }

      /* --primary-strong is defined by no palette in this theme, so the fallback resolved to
         --primary — the resting colour — and hover was a no-op on every verb in this card.
         --primary-hover is the token that exists, and it moves in both themes. */
      .link-btn:hover {
        color: var(--primary-hover);
      }

      .link-btn:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }

      /* The everyday gesture on a touch screen is adding or removing a table, and a bare text
         link is a 20px target. */
      @media (hover: none) {
        .link-btn {
          min-block-size: 44px;
        }
      }

      /* IN FLOW at the end of the step, never pinned — and the first cut of this change got
         that wrong, which is worth writing down because the pin looks obviously right. Made
         sticky against the shell scrollport it rendered over the asks list at scroll 0: an
         opaque bar with a rule above it, cutting between two questions, reading as a row of
         the list rather than as the panel's footer. The bank wizard removed its own footer
         pin for the same reason.

         What makes it unnecessary is the rail above: a tab is 1 200–1 800px where the figures
         actually are, so the Save is one scroll from the box. The one long tab is the compound
         NAMES list, and nothing on that tab is saveable — its answers are priced by class.

         The hairline stays: it is what separates the footer from the stage. */
      /* PINNED. Save sat at the foot of a 2 869px step, so an operator who changed a rate
         near the top scrolled past everything to reach it and past everything to get back.
         The scroller is main.content and .panel sets no overflow of its own, so sticky
         resolves against the page and the bar rides the bottom edge of the viewport until
         the real foot of the panel catches up with it.

         It is the panel's own surface with a hairline above, never a shadow: every shadow
         token in this theme casts DOWNWARD, and a bar pinned to the bottom needs its lift
         on the side the content is coming from. */
      .actions {
        position: sticky;
        inset-block-end: 0;
        z-index: 1;
        display: flex;
        align-items: baseline;
        justify-content: flex-end;
        gap: var(--space-4);
        flex-wrap: wrap;
        margin-block-start: calc(var(--space-2) * -1);
        padding-block: var(--space-4);
        border-block-start: 1px solid var(--border-subtle);
        background: var(--bg-surface);
      }

      .save-hint {
        margin: 0;
        margin-inline-end: auto;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }

      /* Secondary, never tertiary. --text-tertiary measures 3.83:1 on the card and 3.28:1
         on a hovered row in LIGHT mode — under 4.5:1, and neither of these is large text.
         DESIGN_SYSTEM.md's claim that tertiary is "never below 4.5:1" is false in this
         theme; corrected there in the same change. */
      .tag {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }

      .muted {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      /* --- step ①: what it asks --------------------------------------- */

      .notice.is-warn {
        background: color-mix(in srgb, var(--warning) 10%, var(--bg-surface));
        color: var(--text-primary);
      }

      /* A LIST OF ROWS, not a stack of cards. Six asks as bordered cards inside the panel's
         own card is a box in a box, and it cost 849px to report six read-only lines — the
         fact key and its "Edit the wording" link each took a row of their own under a
         question they sit beside. Rows on a hairline, question and provenance in the reading
         column, key and action pinned to the trailing edge. */
      .asks {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .ask {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        column-gap: var(--space-4);
        row-gap: var(--space-1);
        padding-block: var(--space-3);
        border-block-end: 1px solid var(--border-subtle);
      }

      .ask:last-child {
        border-block-end: 0;
        padding-block-end: 0;
      }

      .ask:first-child {
        padding-block-start: 0;
      }

      .ask-q {
        grid-column: 1;
        margin: 0;
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }

      .ask-meta {
        grid-column: 1;
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }

      /* Trailing edge, spanning both rows of the reading column: the key NAMES the question
         beside it and the link acts on it, so neither earns a line of its own. */
      .ask-foot {
        grid-column: 2;
        grid-row: 1 / span 2;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-1);
        text-align: end;
      }

      /* One column below the reading measure — the trailing block would otherwise squeeze the
         question it belongs to into two or three words per line. */
      @media (max-width: 720px) {
        .ask {
          grid-template-columns: minmax(0, 1fr);
        }
        .ask-foot {
          grid-column: 1;
          grid-row: auto;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          inline-size: 100%;
        }
      }
      .ask-acts {
        display: inline-flex;
        align-items: center;
        gap: var(--space-4);
      }
      .linkish.is-danger {
        color: var(--color-error);
      }
      .linkish[disabled] {
        opacity: 0.55;
        cursor: default;
      }
      .ask-key {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }

      /* A chip darkens the ground under its own text, so the warn variant takes primary
         ink rather than the tertiary the row runs at. */
      .tag.is-warn {
        color: var(--text-primary);
        background: color-mix(in srgb, var(--warning) 16%, var(--bg-surface));
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
      }

      .sub {
        margin: var(--space-4) 0 0;
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }

      /* The rail's panel. No border and no ground of its own — the rail is directly above it
         and the panel's card is already the frame; a third box would be the card-in-card the
         defaults rule below exists to avoid. */
      .stage {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      /* The values and the amounts keyed BY them are two subjects in one column with no
         card edge between them, so the amounts read as more of the list. A full-width rule
         under the panel, not a top border on .defaults — that would corner-join its own
         start-side rail and draw a box, which is the thing the rail exists instead of. */
      .stage > app-lookup-values-panel {
        display: block;
        padding-block-end: var(--space-4);
        border-block-end: 1px solid var(--color-border-default);
      }

      /* A region set off by a hairline, not a card: this already sits inside the panel's
         card, and a box in a box reads as two unrelated things. */
      .defaults {
        margin-block: 0;
        padding-inline-start: var(--space-4);
        border-inline-start: 1px solid var(--color-border-default);
      }

      .defaults-title {
        margin: 0 0 var(--space-1);
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .defaults-lede,
      .defaults-note {
        margin: 0 0 var(--space-3);
        max-inline-size: 72ch;
        /* Secondary, never tertiary: these are sentences somebody reads, and tertiary ink
           on this ground measures under 4.5:1 in light mode. */
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
      }

      .defaults-note {
        margin-block-end: 0;
      }

      .hint {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      /* --- the ask board -----------------------------------------------------
         Same vocabulary as the catalog name's scoring grid, deliberately: the two
         screens ask the operator for the same GESTURE, and a second look for it
         would read as a second kind of act. */

      /* The rail's own band: label, chips, then the baseline the stage hangs from. */
      .ask-rail {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding-block-end: var(--space-4);
        border-block-end: 1px solid var(--border-subtle);
      }

      /* The same micro-label as the section headings inside the stage — this is the
         same kind of word about the same board, and a second scale for it would read
         as a second kind of thing. */
      .ask-rail-label {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }

      /* No margin of its own: the panel's own gap already sits below the band's rule,
         and the two together used to put 40px of nothing between the chips and the
         first line of the panel they switch. */
      .ask-stage {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .ask-alert {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border: 1px solid color-mix(in srgb, var(--color-warning) 40%, transparent);
        border-radius: var(--radius-md);
        /* Inked at primary on a wash, never warning-on-warning: the accent colour on its
           own 14% tint measures 2.5:1, which this repo has measured twice. */
        background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface-default));
        color: var(--color-text-primary);
        font-size: var(--text-xs);
      }

      .ask-controls {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
      }

      /* Grows into the row and never past a comfortable line — a 90ch search box reads as
         a form field for a paragraph. */
      .ask-search {
        flex: 1 1 14rem;
        max-inline-size: 22rem;
      }

      /* An affix, so it takes the field's own ink rather than a link's: it is not a place
         to navigate to. Negative inline-end margin pulls it into the padding antd
         reserves for a suffix, so the glyph sits on the field's edge instead of a text
         column's. */
      .ask-clear {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 1.5rem;
        block-size: 1.5rem;
        margin-inline-end: -0.25rem;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: none;
        /* Tertiary at rest — the box has a word in it and the word is what should be read
           — going to secondary under the pointer, where the target is deliberate. */
        color: var(--color-text-tertiary);
        cursor: pointer;
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }

      .ask-clear:hover,
      .ask-clear:active {
        color: var(--color-text-secondary);
      }

      .ask-clear:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        .ask-clear {
          transition: none;
        }
      }

      /* A real target under the finger for the one control that appears mid-typing. */
      @media (hover: none) {
        .ask-clear {
          inline-size: 2rem;
          block-size: 2rem;
        }

        .ask-nomatch .linkish {
          min-block-size: 44px;
        }
      }

      /* Not a card and not an alert: nothing is wrong, a word just matched nothing. One
         hairline and the page ground, so it reads as the grid's own state rather than as
         a notice stacked above it. */
      .ask-nomatch {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-4);
        border: 1px dashed var(--border-subtle);
        border-radius: var(--radius-md);
        max-inline-size: 72ch;
        font-size: var(--text-xs);
        /* Secondary, not tertiary: this sentence is read, and tertiary sits under 4.5:1
           at this size in light mode. */
        color: var(--color-text-secondary);
      }

      /* The default state of "Not read yet": one quiet line instead of a grid the operator
         almost never scrolls. Same dashed-hairline posture as .ask-nomatch — nothing is
         wrong here either, the pool is just resting until somebody searches it. */
      .ask-collapsed {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: 0;
        max-inline-size: 72ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      /* --- step ①: what the engine needs --------------------------------- */
      /* The income-proof page's step head: the line on the start, Add on the end. */
      .asks-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3) var(--space-4);
        margin-block-end: var(--space-4);
      }
      .asks-sub {
        margin: 0;
        max-inline-size: 60ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .fixed-asks {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-block-start: var(--space-6);
      }
      .fixed-asks-title::-webkit-details-marker {
        display: none;
      }
      .fixed-chev {
        flex: none;
        color: var(--text-secondary);
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      :host-context([dir='rtl']) .fixed-chev {
        transform: scaleX(-1);
      }
      .fixed-asks[open] .fixed-chev {
        transform: rotate(90deg);
      }
      .fixed-asks-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        list-style: none;
        cursor: pointer;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .fixed-asks-title .count-pill {
        min-inline-size: 24px;
        padding: 1px var(--space-2);
        border-radius: var(--radius-pill, 999px);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      .fixed-asks-hint {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        line-height: 1.55;
        color: var(--text-secondary);
      }
      .fixed-asks-hint [nz-icon] {
        flex: none;
        margin-block-start: 0.25em;
        color: var(--text-tertiary);
      }
      .fixed-asks-list {
        margin: 0;
        padding: 0;
        list-style: none;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
      }
      .fixed-ask {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1) var(--space-3);
        min-block-size: var(--size-field);
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      .fixed-ask + .fixed-ask {
        border-block-start: 1px solid var(--border-subtle);
      }
      .fixed-ask-label {
        flex: 1 1 16rem;
        min-inline-size: 0;
      }
      .fixed-ask .muted {
        font-size: var(--text-xs);
      }
      .need {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
      }
      .need-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-3);
      }
      .need-heading {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .need-title {
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .need-summary {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .need-summary.is-done [nz-icon] {
        color: var(--color-success);
      }
      .need-note {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      /* A group is a bordered fold row: it has to read as something to open, and as the
         panel's verdict rather than as another uppercase section of the board below. */
      .need-group {
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        overflow: hidden;
      }
      .need-group-head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        cursor: pointer;
        list-style: none;
        transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .need-group-head::-webkit-details-marker {
        display: none;
      }
      .need-group-head:hover {
        background: var(--bg-muted);
      }
      .need-group-head:focus-visible {
        outline: 2px solid var(--focus-ring-color);
        outline-offset: -2px;
      }
      .need-dot {
        flex: none;
        inline-size: 0.5rem;
        block-size: 0.5rem;
        border-radius: var(--radius-pill);
        background: var(--color-success);
      }
      .need-group.is-action .need-dot {
        background: var(--color-warning);
      }
      .need-group-title {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        flex: 1 1 auto;
        min-inline-size: 0;
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }
      .need-group-count {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
      }
      /* The only affordance the row has once the native marker is gone. It rotates rather
         than swapping glyphs, so the two states read as one object turning. */
      .need-chev {
        flex: none;
        color: var(--color-text-secondary);
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .need-group-head:hover .need-chev {
        color: var(--color-text-primary);
      }
      .need-group[open] .need-chev {
        transform: rotate(180deg);
      }
      @media (prefers-reduced-motion: reduce) {
        .need-chev,
        .need-group-head {
          transition: none;
        }
      }
      .need-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-3) var(--space-1);
        border-block-start: 1px solid var(--border-subtle);
      }
      .need-group-note {
        margin: 0;
        max-inline-size: 72ch;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .need-list {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .need-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-4);
        padding-block: var(--space-2);
        border-block-end: 1px solid var(--border-subtle);
      }
      .need-row:last-child {
        border-block-end: 0;
      }
      .need-label {
        flex: 1 1 16rem;
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        overflow-wrap: anywhere;
      }
      .need-side {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-shrink: 0;
      }
      .need-uses {
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        color: var(--color-text-secondary);
        text-decoration: underline dotted;
        text-underline-offset: 3px;
        cursor: help;
        border-radius: var(--radius-sm);
      }
      .need-uses:focus-visible {
        outline: 2px solid var(--focus-ring-color);
        outline-offset: 2px;
      }
      .need-status {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }

      .ask-sec {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      /* Title and the box on one line, the box on the end edge, wrapping to its own line
         before it squeezes the heading. Logical properties throughout, so RTL mirrors. */
      .ask-sec-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-3);
      }

      .ask-sec-title {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }

      /* Order mode: one column, the step named above each list. */
      .order-step {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: var(--space-3) 0 0;
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--color-text-secondary);
      }

      .order-list {
        margin: 0;
        padding: 0;
        list-style: none;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
      }

      .order-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border-block-end: 1px solid var(--border-subtle);
        background: var(--bg-surface);
      }

      .order-row:last-child {
        border-block-end: 0;
      }

      .order-handle,
      .order-btn {
        display: grid;
        place-items: center;
        flex: none;
        inline-size: var(--space-6);
        block-size: var(--space-6);
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        background: none;
        color: var(--text-secondary);
        cursor: pointer;
      }

      .order-handle {
        cursor: grab;
      }

      .order-handle:focus-visible,
      .order-btn:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      .order-btn:hover:not(:disabled) {
        border-color: var(--border-subtle);
        background: var(--bg-subtle);
      }

      .order-handle:disabled,
      .order-btn:disabled {
        cursor: default;
        opacity: 0.4;
      }

      .order-n {
        display: grid;
        place-items: center;
        flex: none;
        inline-size: var(--space-5);
        block-size: var(--space-5);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-pill);
        font-size: var(--text-xs);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--text-secondary);
      }

      .order-label {
        flex: 1 1 auto;
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
      }

      .order-acts {
        display: flex;
        flex: none;
        gap: var(--space-1);
      }

      .order-ghost {
        block-size: var(--space-6);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-sm);
        background: var(--bg-subtle);
      }

      .order-row.cdk-drag-preview {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
      }

      .order-row.cdk-drag-placeholder > :not(.order-ghost) {
        visibility: hidden;
      }

      .ask-sec-count {
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: normal;
        color: var(--color-text-primary);
      }

      .ask-sec-empty,
      .ask-sec-note {
        margin: 0;
        max-inline-size: 72ch;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .ask-grid {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        /* Every row as tall as the tallest card, so the grid reads as one set of equal boxes. */
        grid-auto-rows: 1fr;
        gap: var(--space-3);
      }
      .ask-grid > li {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }

      /* The pager reads as part of the grid above it, so no card, no border box —
         one hairline is enough to say the row below the cards is not another card. */
      .ask-pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin-block-start: var(--space-3);
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--border-subtle);
      }

      .ask-pager-range {
        margin: 0;
        font-size: var(--text-xs);
        /* Secondary, not tertiary: this line is read, and tertiary sits under 4.5:1
           at this size in light mode. */
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums;
      }

      .ask-card {
        flex: 1 1 auto;
        inline-size: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
        text-align: start;
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }

      /* Hover lifts the EDGE and never repaints the fill: the fill is the read/not-read
         signal, and a hover that changes it makes the card read as already ticked. */
      .ask-card:hover:not(.is-blocked) {
        border-color: var(--color-border-strong);
        box-shadow: var(--shadow-sm);
      }

      .ask-card:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      /* The fourth state. A card with hover, focus and a resting look but no PRESSED look
         gives no feedback in the moment between the click and the response — which on this
         grid is a network round trip. Not on a card that refuses the click. */
      .ask-card:active:not(.is-blocked) {
        transform: translateY(1px);
      }

      @media (prefers-reduced-motion: reduce) {
        .ask-card:active:not(.is-blocked) {
          transform: none;
        }
      }

      .ask-card.on {
        border-color: color-mix(
          in srgb,
          var(--color-brand-primary) 40%,
          var(--color-border-default)
        );
        background: color-mix(in srgb, var(--color-brand-primary) 5%, var(--color-surface-default));
      }

      /* After the .on rule, which would otherwise win and leave a ticked card with no
         feedback at all. */
      .ask-card.on:hover {
        border-color: var(--color-brand-primary);
      }

      /* What recedes on a card that cannot be ticked is the AFFORDANCE — a dashed edge and a
         hollow tick box — never the words. An opacity low enough to read as unavailable puts
         the reason under 4.5:1, and a sentence nobody can read is not information. */
      .ask-card.is-blocked {
        background: var(--color-surface-muted);
        cursor: default;
      }

      /* READ and fixed at once — the dashed edge says fixed, the tint says read. The muted
         fill alone would drop the one signal the operator came for. */
      .ask-card.on.is-blocked {
        background: color-mix(in srgb, var(--color-brand-primary) 5%, var(--color-surface-default));
        border-color: color-mix(
          in srgb,
          var(--color-brand-primary) 40%,
          var(--color-border-default)
        );
      }

      .ask-card[aria-busy='true'] {
        opacity: 0.65;
      }

      .ask-card.is-partial {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border: 1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-border-default));
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface-default));
      }

      .ask-card-head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      /* On the TITLE's line, not the card's vertical centre: centred, it sits beside the
         third line of the reason text and reads as a tick on the sentence. */
      .ask-tick {
        flex: none;
        inline-size: 18px;
        block-size: 18px;
        display: grid;
        place-items: center;
        border: 1px solid var(--color-border-strong);
        border-radius: var(--radius-sm);
        /* --color-text-inverse is defined by NO palette in this theme, and a var() with no
           fallback is invalid at computed-value time — the check glyph would inherit the
           body ink and sit dark-on-azure. Same defect class v19.0.0 found six of. */
        color: var(--text-inverse, #fff);
        font-size: 12px;
      }

      .ask-card.on .ask-tick {
        border-color: var(--color-brand-primary);
        background: var(--color-brand-primary);
      }

      .ask-tick.is-warn {
        border-color: var(--color-warning);
        color: var(--color-warning);
      }

      /* Two lines at most (the full wording is the card's accessible name), so one long
         question doesn't stretch every row. */
      .ask-label {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .ask-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        /* Pinned to the card's foot, so the type tags line up across a row. */
        margin-block-start: auto;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      /* The question's TYPE is a permanent taxonomy, not a state, and it was drawn in the
         same pill as the warn tag beside it — one costume for two meanings, the heavier of
         which then read before the question's own wording. It is the quieter of the two now:
         a squared micro-label rather than a lozenge (a pill at this size is read as a status),
         set at --text-2xs with the tracking opened to 0.08em, which is what keeps two
         uppercase words legible once the size drops. line-height 1.2 so the box tracks the
         cap height instead of a body line's leading. Ink and fill are unchanged, so the measured 5.29:1 light /
         7.56:1 dark still holds. */
      .ask-type {
        flex: none;
        align-self: center;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        line-height: 1.2;
      }

      /* The house .tag class is bare tertiary text, which measures 3.83:1 on a card in light
         mode — under 4.5:1 — and reads as a run-on word rather than a chip. Scoped to this
         grid rather than changed globally: the same class is a plain label elsewhere. */
      .ask-meta .tag {
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }

      /* Equal specificity to the .ask-meta .tag rule and declared after it, or the muted fill above
         wins on source order and the one warn state on this grid renders as a plain chip —
         which is what it did. Primary ink on the 16% wash, per the house pattern: the
         warning colour on its own wash measures 2.53:1. */
      .ask-meta .tag.is-warn {
        color: var(--color-text-primary);
        background: color-mix(in srgb, var(--color-warning) 16%, var(--color-surface-default));
      }

      /* The refusal glyph sits on the title's line, pushed to the end edge so a
         column of refused cards lines its markers up. Warning-inked, not the
         card's own ink: it is the one thing on the card that is not the
         question. Sized to the label so it cannot outweigh it. */
      .ask-why-hint {
        margin-inline-start: auto;
        display: inline-flex;
        align-items: center;
        flex: none;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        line-height: 1;
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

      .ask-acts {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
      }

      /* A link and a button in the same row need a real target under the finger. */
      @media (hover: none) {
        .ask-acts .linkish {
          min-block-size: 44px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ask-card {
          transition: none;
        }
      }

      .stepnav {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
      }
    `,
  ],
})
export class SurrogateProductDetailPage {
  /** Back to the board, with the Surrogate side already showing. */
  protected readonly backLink = surrogateBoardLink();
  protected readonly productBase = PRODUCT_BASE;

  private readonly api = inject(BankProgramsApiService);
  private readonly engineRules = inject(EngineRulesApiService);
  /** Via NzModalService so the scrim covers the whole viewport, never the panel (A34). */
  private readonly modal = inject(NzModalService);
  private readonly drawer = inject(NzDrawerService);
  private readonly message = inject(NzMessageService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly lookups = inject(LookupsApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly key = this.route.snapshot.paramMap.get('key') ?? '';

  /** The route key, as a signal so the owned-list computeds can read it. */
  protected readonly productKey = signal(this.key);

  protected readonly loading = signal(true);
  protected readonly product = signal<SurrogateProductDetail | null>(null);
  /**
   * Per-type delete permission, fetched ONCE for however many panels this step renders.
   *
   * `GET /enumerations/types` counts active, deprecated and referenced rows for every
   * registry type — one aggregate, not one per panel.
   */
  private readonly typeSummaries = signal<readonly EnumerationTypeSummary[]>([]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly dirty = signal(false);

  protected readonly stepsAria = $localize`:@@spd.steps_aria:Surrogate product setup`;
  protected readonly loadingLabel = $localize`:@@spd.loading:Loading the surrogate product`;

  // --- the calculation form (same shape the catalog name's page uses) --------

  protected readonly ruleGroup = this.fb.nonNullable.group({
    strategy: new FormControl<IncomeAssumptionStrategy>('declared', { nonNullable: true }),
    scalar: this.fb.group({
      value: new FormControl<string | null>(null),
      unit: new FormControl<'percent' | 'multiplier'>('percent', { nonNullable: true }),
    }),
    // NOT the debt-burden cap: that one is a signal (`dbrCapValue`), like the two tables and
    // the step figures beside it. A control read through `valueChanges` cannot work here —
    // `absorb` resets with `emitEvent: false`, so the stored value never reached the field and
    // the box read empty over a product that states 45%. Measured in a browser, not reasoned
    // about: the save wrote 45, the audit recorded it, and the reload showed nothing.
    requiredDocuments: new FormControl<string[]>([], { nonNullable: true }),
    combinationRule: new FormControl<'lesser_of' | 'greater_of' | null>(null),
  });

  protected readonly ruleKeyTable = signal<IncomeKeyTableRow[]>([]);
  protected readonly ruleBands = signal<IncomeBand[]>([]);
  protected readonly stepFigures = signal<Record<string, StepFigures>>({});

  /**
   * Subscribed rather than computed: the dirty flag is a fact about what the OPERATOR did,
   * and only they can raise it. `absorb` resets with `emitEvent: false`, so a page load
   * never offers to save what it has just read.
   */
  private readonly edits = this.ruleGroup.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.markDirty());

  protected readonly ruleSteps = computed<readonly RuleStep[]>(
    () => (this.product()?.incomeRule as { steps?: RuleStep[] } | null | undefined)?.steps ?? [],
  );
  protected readonly ruleGates = computed<readonly RuleGate[]>(
    () => (this.product()?.incomeRule as { gates?: RuleGate[] } | null | undefined)?.gates ?? [],
  );
  protected readonly ruleOutput = computed<ProductRuleOutput | null>(
    () =>
      (this.product()?.incomeRule as { output?: ProductRuleOutput } | null | undefined)?.output ??
      null,
  );

  // --- the calculation, as the server last agreed to it -----------------------
  //
  // Read straight off the last response, and no longer editable here. The raw step builder
  // is GONE: a calculation is shaped by the predefined library or by the form it compiles to,
  // and a graph editor asking an operator to wire step 3 back at steps 1 and 2 was
  // programming with a mouse. What remains is the FIGURES — which is what an operator on this
  // screen came to change — and the read-only flow further down, which says what the
  // calculation does in words.
  //
  // A product the form cannot describe keeps quoting exactly as it did; what it no longer has
  // is a door to be hand-edited through, and the screen says so rather than implying one.

  /**
   * Would the server refuse this pipeline?
   *
   * The shared client-side mirror of `unconfigured_step` and `coalesce_empty`. It was
   * already written and already used by the bank-program wizard; this screen — which is
   * where a pipeline is actually AUTHORED — had no gate at all, so an operator could press
   * Save on a half-written rule and get back a token naming a step id.
   *
   * Advisory, never the authority: the server re-checks and its answer stands.
   */
  // --- the product's debt-burden cap -----------------------------------------------------
  //
  // Stored on the rule blob (`incomeAssumption.dbrCapPercentOverride`) because it is scoped to
  // the calculation: the engine applies it only to a figure this rule produced, never to a
  // salary an applicant states. What is new is that a BANK program which states none of its own
  // reads it (`withInheritedDbrCap`), which is what makes this one field worth a control.

  /** The stored cap as text, or `null` when the product states none. */
  protected readonly dbrCapValue = signal<string | null>(null);

  /**
   * The I-SCORE TIERS this product hands every bank selling it.
   *
   * A PLAIN SIGNAL seeded from the response, never `toSignal(control.valueChanges)` — the
   * v26.2.0 bug where the debt-burden cap beside it read back EMPTY over a stored value,
   * because `absorb` resets with `emitEvent: false` so the stored figure never reached the
   * box. The save wrote it, the audit recorded it, the reload showed nothing.
   *
   * Stored in its OWN COLUMN (`platform_enumeration.iScoreDefaults`), not on the rule blob:
   * the tiers stopped being part of the calculation at v30.3.0, and folding them back in
   * would make a tier edit read as a rule change in the audit log.
   */
  protected readonly iScoreTiers = signal<IncomeBand[]>([]);

  /** Its own dirty flag, read BEFORE the first write — the trap `save()` already documents. */
  protected iScoreDirty = false;

  protected readonly iScoreRangeUnit = $localize`:@@spd.iscore.unit:score`;
  protected readonly iScoreValueLabel = $localize`:@@spd.iscore.value:Percentage (%)`;

  /** The I-Score classes on Manage values, as a table — loaded once, `[]` if unreachable. */
  protected readonly iScoreClassBands = signal<IncomeBand[]>([]);

  protected iScoreClassBandsCopy(): IncomeBand[] {
    return this.iScoreClassBands().map((band) => ({ ...band }));
  }

  protected setIScoreTiers(bands: IncomeBand[]): void {
    this.iScoreTiers.set(bands);
    this.iScoreDirty = true;
    // BOTH flags, and the second is what took a browser to notice. `iScoreDirty` decides
    // whether the tier WRITE fires; `dirty()` is what enables Save at all
    // (`!dirty() || saving() || ruleBlocked()`). Without this the operator types a table and
    // the button stays dead with nothing saying why — the exact shape of defect v26.2.0
    // recorded against this screen, and every sibling setter here calls `markDirty()`.
    this.markDirty();
  }

  /**
   * Does the table on screen have a shape error? Gates Save.
   *
   * v26.2.0's defect 2 in one line: judging whether a table HAS rows and never its shape left
   * Save enabled with the editor's own error on screen and the refusal arriving later.
   */
  protected readonly iScoreError = computed<boolean>(() => {
    const bands = this.iScoreTiers();
    if (bands.length === 0) return false;
    return incomeBandsErrorFor(bands, { coverAll: true }) !== null;
  });

  protected readonly dbrCapLabel = $localize`:@@spd.dbr.label:Debt burden`;
  protected readonly dbrCapAriaLabel = $localize`:@@spd.dbr.aria:Debt-burden cap for this calculation's figure, per cent`;
  protected readonly dbrCapBlankNote = $localize`:@@spd.dbr.blank_note:Blank — each bank's own cap applies.`;

  /**
   * Empty is legal and is the state every product ships in; anything else must be in (0, 100].
   *
   * Not gated on touched or dirty: the control carries no validator, so an out-of-range figure
   * would otherwise draw nothing, let Save through, and be refused by the server as
   * `INCOME_RULE_DBR_OVERRIDE_INVALID`. Same reasoning as the wizard's own copy of this field.
   */
  protected readonly dbrCapError = computed<boolean>(() => {
    const raw = this.dbrCapValue();
    if (raw === null || raw.trim() === '') return false;
    const value = Number(raw);
    return !Number.isFinite(value) || value <= 0 || value > 100;
  });

  /**
   * Blank stores `null`, which the save path turns into an absent key — never `''`.
   *
   * Raises `dirty` itself: the flag is subscribed to `ruleGroup.valueChanges` and a signal
   * write is not a form change, exactly as `onStepFigures` has to say so too.
   */
  protected setDbrCap(raw: string): void {
    const value = raw.trim();
    this.dbrCapValue.set(value === '' ? null : value);
    this.markDirty();
  }

  // --- the product's default loan duration -----------------------------------------------
  //
  // Its own column (`platform_enumeration.tenorDefaults`), not part of the rule blob: a
  // repayment term is not a statement about income, and the engine reads it from a different
  // field on the program. What it shares with the cap above is the thing that matters here —
  // a program stating none of its own READS it, so a change moves live quotes.

  // --- the product's default PLAN tables ---
  // Their own column (`platform_enumeration.planDefaults`), read live by every program whose
  // `plansSource` is `product`. What they share with the cap and the duration above is the
  // thing that matters here: a change moves live quotes.

  /**
   * The five tables, and what each one's figures mean.
   *
   * Stated once here rather than five near-identical template blocks, because the only thing
   * that differs between them is the value kind and the words — and five copies is five
   * places for one of them to drift out of step with the server's own list.
   */
  /**
   * What an unstated row says — once, instead of five sentences saying it five ways.
   *
   * Each row used to carry its own ("No table — each bank lends from its own shortest
   * term."), which is the block's own lede — "A bank selling this product falls back to each
   * of these while its own program states nothing in its place" — repeated per row, in the
   * widest possible form, on the rows that hold the least. The rule is stated above the list;
   * the row states the STATE.
   */
  protected readonly planNotSet = $localize`:@@spd.plans.not_set:Not set`;
  /** What an unstated table opens to: empty, held only once something is typed. */
  protected readonly emptyPlanGrid = emptyFactGrid();

  /** The five tables, and what each one's figures mean — stated once, not five template blocks. */
  protected readonly planSlots = [
    {
      key: 'rateByFact' as const,
      title: $localize`:@@spd.plans.rate:Interest rate`,
      empty: $localize`:@@spd.plans.rate_empty:No rate table — each bank prices from its own rate.`,
      removeAria: $localize`:@@spd.plans.rate_remove_aria:Remove the rate table`,
    },
    {
      key: 'maxMonthsByFact' as const,
      title: $localize`:@@spd.plans.max_months:Longest term`,
      empty: $localize`:@@spd.plans.max_months_empty:No table — each bank lends over its own longest term.`,
      removeAria: $localize`:@@spd.plans.max_months_remove_aria:Remove the longest-term table`,
    },
    {
      key: 'minMonthsByFact' as const,
      title: $localize`:@@spd.plans.min_months:Shortest term`,
      empty: $localize`:@@spd.plans.min_months_empty:No table — each bank lends from its own shortest term.`,
      removeAria: $localize`:@@spd.plans.min_months_remove_aria:Remove the shortest-term table`,
    },
    {
      key: 'ltvCeilingByFact' as const,
      title: $localize`:@@spd.plans.ltv:Share of the price financed`,
      empty: $localize`:@@spd.plans.ltv_empty:No table — each bank finances its own share.`,
      removeAria: $localize`:@@spd.plans.ltv_remove_aria:Remove the financed-share table`,
    },
    {
      key: 'minAmountByFact' as const,
      title: $localize`:@@spd.plans.floor:Smallest loan`,
      empty: $localize`:@@spd.plans.floor_empty:No table — each bank writes from its own smallest loan.`,
      removeAria: $localize`:@@spd.plans.floor_remove_aria:Remove the smallest-loan table`,
    },
  ];

  /**
   * What a figure in each table MEANS, and which end of the term the two month tables state.
   *
   * Read from the rules module rather than restated beside the words above, because the
   * fused table and the free-form list have to agree about it — and the kind is what decides
   * whether a box refuses 120 as a share or accepts it as a rate.
   */
  protected slotValueKind(slot: PlanSlotKey): FactGridValueKind {
    return planSlotValueKind(slot);
  }

  protected slotMonthsBound(slot: PlanSlotKey): 'max' | 'min' {
    return planSlotMonthsBound(slot);
  }

  /**
   * Plain signal seeded from the response, never `toSignal(control.valueChanges)`: the cap
   * two cards up was written that way once and read back EMPTY over a stored value, because
   * `reset` runs with `emitEvent: false` and the value never reached the box.
   */
  protected readonly planValue = signal<PlanDefaults | null>(null);
  private plansDirty = false;

  protected planGrid(slot: PlanSlotKey): FactGridConfig | null {
    return this.planValue()?.[slot] ?? null;
  }

  protected setPlanGrid(slot: PlanSlotKey, grid: FactGridConfig): void {
    // Typing in the one-table-at-a-time list keeps the operator there: the moment a table
    // becomes one the combined view can draw, the page must not swap that view in under them.
    this.keepListOpen();
    const next = { ...(this.planValue() ?? {}) };
    // Everything typed cleared again: the table goes back to not stated, not to a broken one.
    if (blankGrid(grid)) delete next[slot];
    else next[slot] = grid;
    this.planValue.set(Object.keys(next).length === 0 ? null : next);
    this.planChanged();
  }

  /** What the plans were when last loaded or saved — so undoing a change is no change. */
  private planBaseline = 'null';

  /** Unsaved figures other than the plans (rate, DBR, terms, I-Score, the rule's figures). */
  private otherDirty = false;

  private planChanged(): void {
    this.plansDirty = JSON.stringify(this.planValue() ?? null) !== this.planBaseline;
    this.dirty.set(this.otherDirty || this.plansDirty);
    this.saveError.set(null);
  }

  /**
   * Remove one plan table — CONFIRMED while programs are reading it.
   *
   * The server does not refuse this, deliberately: a cleared plan table leaves an inheriting
   * program on its own rate, floor and financed share, every one of which still exists, so
   * nothing stops quoting and a refusal would be a gate over what is merely a change.
   *
   * But "nothing stops quoting" is not "nothing happens", and that is why this asks. On the one
   * product that has plans, removing the rate table re-prices every reader from the 5-12% its
   * rows state to the program's own placeholder base rate; removing the financed share halves
   * what a 20%-down buyer can borrow; removing the floor drops the smallest loan by a factor of
   * ten. All of it silent, all of it frozen onto immutable offers (Principle I / A6). A dialog
   * naming the count is the cheapest honest thing between "refuse it" and "say nothing".
   *
   * Only when somebody is reading. Clearing a table nobody has opted into is a change to a
   * draft, and a dialog there would teach the operator to click through this one.
   */
  protected clearPlanGrid(slot: PlanSlotKey): void {
    const commit = (): void => {
      const next = { ...(this.planValue() ?? {}) };
      delete next[slot];
      // An object with no table left is `null`, not `{}` — two spellings of "states no plans"
      // is how one of them stops being recognised.
      this.planValue.set(Object.keys(next).length === 0 ? null : next);
      this.planChanged();
    };

    const readers = this.planReaders();
    if (readers === 0) {
      commit();
      return;
    }
    const title = $localize`:@@spd.plans.remove_confirm_title:Remove this table?`;
    const body = $localize`:@@spd.plans.remove_confirm_body:${readers}:readers: bank program(s) read these plans. Each one falls back to its own figure for this table, which changes what it quotes. Nothing is saved until you press Save.`;
    this.modal.confirm({
      nzTitle: title,
      nzContent: body,
      nzOkText: $localize`:@@spd.plans.remove_confirm_ok:Remove the table`,
      nzCancelText: $localize`:@@spd.plans.remove_confirm_cancel:Keep it`,
      nzOnOk: commit,
    });
  }

  /**
   * ONE PLAN PER LINE — the five tables projected into the card a bank actually prints.
   *
   * Derived, never stored: `planValue` stays the state and this is a read of it, so there is
   * no second copy of the plans to drift. `null` means the stored shape cannot be drawn as
   * one table — a grid keyed by something other than the deposit, two figures for one band —
   * and the free-form list below takes over, which is a fallback and never a refusal.
   */
  protected readonly planTable = computed(() => planRowsFrom(this.planValue()));

  /** Why the fused table could not be drawn, said in words above the list that replaces it. */
  protected readonly planWhyNot = computed<PlanIncompatibleReason | null>(() =>
    planRowsWhyNot(this.planValue()),
  );

  protected planWhyNotLabel(): string {
    switch (this.planWhyNot()) {
      case null:
      case 'no_plans':
        return '';
      case 'not_keyed_by_deposit':
        return $localize`:@@spd.plans.why_not_deposit:One of these tables is keyed by something other than the deposit, so the plans cannot be read as one card. Each table is below on its own.`;
      case 'deposit_via_class':
        return $localize`:@@spd.plans.why_not_class:One table reads the deposit through a class rather than the number, so the plans cannot be read as one card. Each table is below on its own.`;
      case 'key_on_deposit_axis':
      case 'wildcard_deposit':
        return $localize`:@@spd.plans.why_not_band:One table states something other than a deposit range in its first column, so the plans cannot be read as one card. Each table is below on its own.`;
      case 'band_on_extra_axis':
        return $localize`:@@spd.plans.why_not_extra_band:One table splits a second column by a range rather than by an answer, so the plans cannot be read as one card. Each table is below on its own.`;
      case 'overlapping_bands':
        return $localize`:@@spd.plans.why_not_overlap:Two rows of one table cover the same deposit, so there is no single figure to show. Each table is below on its own.`;
      case 'edge_not_numeric':
        return $localize`:@@spd.plans.why_not_number:A deposit range has something in it that is not a number. Each table is below on its own.`;
      case 'too_many_bands':
        return $localize`:@@spd.plans.why_not_many:These tables state more deposit bands than one card can show. Each table is below on its own.`;
    }
  }

  /**
   * Whatever the fused table cannot say, said one table at a time.
   *
   * Open by force ONLY when the card above could not be drawn — and not, as the five-row
   * list does one level down, whenever a table blocks Save. The rule there is that a
   * half-typed table must not be hideable, and it still holds: every error the projection
   * survives is a box visible IN the card above, so the operator fixes it where they are
   * rather than being thrown into the editor they were moved off. An error the projection
   * does NOT survive leaves `planTable()` null, which is the first clause.
   *
   * It is also the only door to the FIRST table on a product that states none, which is why
   * it stays reachable while the card above is drawing fine.
   */
  private readonly advancedOpen = signal(false);

  /** The list is on screen and in use: it stays until the operator switches view. */
  private keepListOpen(): void {
    if (this.planAdvancedOpen()) this.advancedOpen.set(true);
  }

  /**
   * The calculation folds. It is the LIBRARY's arithmetic — authored by a form on another
   * screen, identical for every bank selling this product — while the figures an operator
   * comes here to move are two sections up. Folded it costs one click; unfolded it cost
   * every visit ~900px of scroll before the first control anybody was looking for.
   *
   * It is never folded when there is no toggle to unfold it (a product with no pipeline has
   * nothing else in the section), and never folded over something that blocks Save.
   */
  /** `null` until the operator toggles it: then it follows whether a step is unfinished. */
  private readonly calcExpanded = signal<boolean | null>(null);

  protected calcOpen(): boolean {
    return !this.isPipeline() || (this.calcExpanded() ?? this.calcBlocked());
  }

  protected toggleCalc(): void {
    // Always the operator's: an unfinished step is still named on the toggle when closed.
    this.calcExpanded.set(!this.calcOpen());
  }

  /** What the closed section is hiding, said on the toggle rather than left to a click. */
  protected calcToggleLabel(): string {
    const steps = this.ruleSteps().length;
    if (this.calcBlocked()) {
      return $localize`:@@spd.calc.toggle_bad:${steps}:steps: steps — one of them is not finished`;
    }
    return this.calcOpen()
      ? $localize`:@@spd.calc.toggle_open:Hide the ${steps}:steps: steps this product runs`
      : $localize`:@@spd.calc.toggle:Show the ${steps}:steps: steps this product runs`;
  }

  protected planAdvancedOpen(): boolean {
    return this.planTable() === null || this.advancedOpen();
  }

  protected toggleAdvanced(): void {
    this.advancedOpen.set(!this.advancedOpen());
  }

  /**
   * The fused table wrote something back.
   *
   * The writers return the CALLER'S OWN object when a keystroke changed no figure, so the
   * identity test is what keeps the form from going dirty on a re-typed number — the
   * difference between a Save that writes nothing and one that re-posts the plans.
   */
  protected onPlanGrids(next: PlanDefaults | null): void {
    if (next === this.planValue()) return;
    this.planValue.set(next);
    this.planChanged();
  }

  /**
   * A delete from inside the fused table — CONFIRMED while programs are reading these plans.
   *
   * The same rule `clearPlanGrid` states: the server does not refuse any of this, because
   * every figure removed leaves the program's own standing, so nothing stops quoting. But
   * "nothing stops quoting" is not "nothing happens" — a removed band re-prices everybody in
   * it — and a dialog naming the count is the cheapest honest thing between refusing and
   * saying nothing. Nobody reading means nobody is re-priced, and a dialog there would teach
   * the operator to click through this one.
   */
  protected onPlanRemove(request: PlanRemoveRequest): void {
    const commit = (): void => this.onPlanGrids(request.next);
    const readers = this.planReaders();
    if (readers === 0) {
      commit();
      return;
    }
    this.modal.confirm({
      nzTitle: $localize`:@@spd.plan_table.remove_title:Remove ${request.what}:what:?`,
      nzContent: $localize`:@@spd.plan_table.remove_body:${request.figuresLost}:figures: figure(s) go, and ${readers}:readers: bank program(s) read these plans. Each one falls back to its own figure, which changes what it quotes. Nothing is saved until you press Save.`,
      nzOkText: $localize`:@@spd.plan_table.remove_ok:Remove it`,
      nzCancelText: $localize`:@@spd.plans.remove_confirm_cancel:Keep it`,
      nzOnOk: commit,
    });
  }

  /**
   * Which slots are open, and the ONE that is open whether the operator likes it or not.
   *
   * The list is closed by default because five open tables measured 3 801px of a 5 237px
   * step. Independent toggles rather than an accordion: the one thing five tables cannot
   * show by being looked at is that their deposit bands disagree, so comparing two of them
   * side by side is exactly the reason somebody opens this list.
   */
  private readonly openPlanSlots = signal<ReadonlySet<PlanSlotKey>>(new Set(['rateByFact']));

  /** The first slot with something wrong in it, or null. Gates Save, and forces its row open. */
  protected readonly erroredPlanSlot = computed<PlanSlotKey | null>(
    () => planRowsErrorFor(this.planValue())?.slot ?? null,
  );

  /** WHAT is missing from the unfinished table, in the operator's words. */
  protected planErrorDetail(): string {
    switch (planRowsErrorFor(this.planValue())?.error) {
      case 'AXES_EMPTY':
      case 'AXIS_MISSING_FACT':
        return $localize`:@@spd.plans.err_question:pick the question it goes by`;
      case 'AXIS_DUPLICATE':
        return $localize`:@@spd.plans.err_duplicate:two columns go by the same question`;
      case 'CELL_VALUE_INVALID':
        return $localize`:@@spd.plans.err_value:fill in the value of every row`;
      default:
        return $localize`:@@spd.plans.err_range:fill in the range of every row`;
    }
  }

  /** The first thing wrong with any stated table, or `null`. Gates Save. */
  protected readonly planError = computed<string | null>(() => {
    const key = this.erroredPlanSlot();
    if (key === null) return null;
    return this.planSlots.find((slot) => slot.key === key)?.title ?? null;
  });

  /**
   * A row is open when the operator opened it — and closes when they close it, finished or
   * not. An unfinished table is not hidden by that: its closed row says "Not finished", and
   * the line under the list names it while it blocks Save.
   */
  protected planSlotOpen(slot: PlanSlotKey): boolean {
    return this.openPlanSlots().has(slot);
  }

  /** A closed row whose table blocks Save. */
  protected planSlotUnfinished(slot: PlanSlotKey): boolean {
    return this.erroredPlanSlot() === slot && !this.planSlotOpen(slot);
  }

  protected readonly planUnfinishedLabel = $localize`:@@spd.plans.unfinished:Not finished`;

  protected togglePlanSlot(slot: PlanSlotKey): void {
    this.keepListOpen();
    const next = new Set(this.openPlanSlots());
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    this.openPlanSlots.set(next);
  }

  /**
   * What a closed row says its table holds: HOW MANY ROWS, and nothing else.
   *
   * It used to chain the axis names on as well — "20 row(s), by Down payment (% of the
   * price) · Where the car was built · What the car runs on" — which is three question
   * SENTENCES joined with separators. That was the longest string on the step, it wrapped at
   * every width, and it is the whole reason the row was laid out on two lines. The axes are
   * named authoritatively ONE CLICK AWAY, in the column headers of the table the row opens,
   * so the closed row was restating something already stated and paying a line for it.
   *
   * Derived from the stored grid rather than kept beside it, so it cannot go stale — the
   * mistake a second list saying what a table contains would make on its first edit.
   *
   * Two flat messages rather than one with `row(s)` in it: a parenthesised plural is a
   * translator's problem printed at the customer, and Arabic does not form a plural that way
   * at all.
   */
  protected planSummary(slot: PlanSlotKey): string {
    const grid = this.planGrid(slot);
    if (grid === null) return '';
    const rows = grid.cells.length;
    return rows === 1
      ? $localize`:@@spd.plans.rows_one:1 row`
      : $localize`:@@spd.plans.rows_many:${String(rows)}:rows: rows`;
  }

  /**
   * A deposit this product PRICES that another table would REFUSE.
   *
   * Advisory and never a gate — the server validates each table on its own, and a mirror that
   * refused more than the server would tell an operator their card is unsavable with nothing
   * to fix. It exists because the one thing five separate tables cannot show by being looked
   * at is that a plan added to one of them is missing from another.
   *
   * COVERAGE, not set-equality, and the difference is whether anybody reads it. Comparing band
   * SETS made this line permanent on the only product that has plans: the term table
   * deliberately states one row for 40% and up where the rate table states three, and the floor
   * table deliberately states one row at all — both because they say something only where they
   * DIFFER. A warning that is always on is a warning nobody reads, and it costs the one thing
   * this line exists to say.
   *
   * Scoped to tables whose miss is a REFUSAL, which is the whole hazard. On `useFallback` an
   * uncovered deposit takes the program's own figure, which is what a coarser table MEANS; on
   * `reject` it is an applicant who is quoted a rate by one table and turned away by another.
   */
  protected readonly planBandMismatch = computed<string | null>(() => {
    const plans = this.planValue();
    const rate = plans?.rateByFact;
    if (plans === null || rate === undefined) return null;

    /** The deposit bands of a grid's first axis, as numeric intervals. `null` upper = no end. */
    const bandsOf = (grid: FactGridConfig): { from: number; to: number | null }[] =>
      grid.cells
        .map((c) => c.keys[0])
        .filter(
          (k): k is { fromInclusive?: string; toExclusive?: string | null } =>
            k !== null && k !== undefined && !('key' in k),
        )
        .map((k) => ({
          from: Number(k.fromInclusive ?? '0'),
          to: k.toExclusive === null || k.toExclusive === undefined ? null : Number(k.toExclusive),
        }))
        .filter((b) => Number.isFinite(b.from) && (b.to === null || Number.isFinite(b.to)));

    const covers = (outer: { from: number; to: number | null }, inner: typeof outer): boolean =>
      outer.from <= inner.from &&
      (outer.to === null || (inner.to !== null && outer.to >= inner.to));

    const priced = bandsOf(rate);
    const off = this.planSlots
      .filter((slot) => slot.key !== 'rateByFact')
      .filter((slot) => {
        const grid = plans[slot.key];
        // A table that falls back is not refusing anybody — a band it does not state is the
        // program's own figure, stated by omission.
        if (grid === undefined || grid.onNoMatch !== 'reject') return false;
        const bands = bandsOf(grid);
        return priced.some((p) => !bands.some((b) => covers(b, p)));
      })
      .map((slot) => slot.title);
    if (off.length === 0) return null;
    const names = off.join(', ');
    return $localize`:@@spd.plans.mismatch2:A deposit this product prices is not covered by ${names}:names:, which turns that customer away instead of quoting them. Add the missing rows, or let that table fall back to the bank's own figure.`;
  });

  /**
   * How many bank programs are reading these tables right now.
   *
   * Counted off the response this screen already has, rather than asked for separately: it is
   * the same walk step ③ renders, and a second endpoint answering "who is affected" would be
   * a second answer.
   */
  protected readonly planReaders = computed<number>(
    () =>
      this.product()
        ?.names.flatMap((n) => n.programs)
        .filter((prog) => prog.followsPlans === true).length ?? 0,
  );

  /** The stored months as text, or `null` when the product states none. */
  protected readonly tenorMinValue = signal<string | null>(null);
  protected readonly tenorMaxValue = signal<string | null>(null);

  protected readonly tenorMinLabel = $localize`:@@spd.tenor.min:Shortest`;
  protected readonly tenorMaxLabel = $localize`:@@spd.tenor.max:Longest`;
  protected readonly tenorMinAria = $localize`:@@spd.tenor.min_aria:Shortest term every program selling this product lends over, in months`;
  protected readonly tenorMaxAria = $localize`:@@spd.tenor.max_aria:Longest term every program selling this product lends over, in months`;
  protected readonly tenorBlankNote = $localize`:@@spd.tenor.blank_note:Blank — each bank states its own.`;

  /**
   * `null` when there is nothing to say, otherwise WHICH of the three things is wrong.
   *
   * Three and not one, because the fixes are different: a figure out of range is retyped, an
   * inverted pair is swapped, and a half-stated pair is a box somebody forgot. Mirrors the
   * server (`SurrogateProductTenorDto` plus the inversion check in the service) and must not
   * out-refuse it — an empty pair is legal here and is the state every product ships in.
   */
  protected readonly tenorError = computed<'range' | 'inverted' | 'half' | null>(() => {
    const min = (this.tenorMinValue() ?? '').trim();
    const max = (this.tenorMaxValue() ?? '').trim();
    if (min === '' && max === '') return null;
    if (min === '' || max === '') return 'half';
    const lo = Number(min);
    const hi = Number(max);
    const legal = (n: number) => Number.isInteger(n) && n >= 1 && n <= 480;
    if (!legal(lo) || !legal(hi)) return 'range';
    return lo > hi ? 'inverted' : null;
  });

  /**
   * How many bank programs are reading these months right now.
   *
   * Counted off the response this screen already has — `names[].programs[].ownTenor` — rather
   * than asked for separately: it is the same walk step ③ renders, and a second endpoint
   * answering "who is affected" would be a second answer.
   */
  protected readonly tenorReaders = computed<number>(
    () =>
      this.product()
        ?.names.flatMap((n) => n.programs)
        .filter((prog) => !prog.ownTenor).length ?? 0,
  );

  /**
   * Would emptying the boxes be refused?
   *
   * Says it BEFORE the server has to, on the screen where the boxes are. Only a CLEAR is
   * refused — changing the months is free and deliberately so, which is why this fires on the
   * transition to empty and not on any edit.
   */
  protected readonly tenorClearBlocked = computed<boolean>(() => {
    if (this.tenorReaders() === 0) return false;
    if (this.product()?.tenorDefaults == null) return false;
    return (this.tenorMinValue() ?? '').trim() === '' && (this.tenorMaxValue() ?? '').trim() === '';
  });

  protected setTenorMin(raw: string): void {
    const value = raw.trim();
    this.tenorMinValue.set(value === '' ? null : value);
    this.tenorDirty = true;
    this.markDirty();
  }

  protected setTenorMax(raw: string): void {
    const value = raw.trim();
    this.tenorMaxValue.set(value === '' ? null : value);
    this.tenorDirty = true;
    this.markDirty();
  }

  /**
   * Its own flag beside `capDirty`, for the same reason that one exists: the duration is a
   * SECOND write, and sending it on every Save would refuse a product whose duration nobody
   * has touched the moment programs are reading it.
   */
  private tenorDirty = false;

  // ── The loan SIZE every bank falls back to ───────────────────────────────
  // The duration's twin, drawn from the same template throughout: both amounts or neither,
  // inherited live rather than copied, and a CLEAR is the one move the server can refuse.

  protected readonly amountMinValue = signal<string | null>(null);
  protected readonly amountMaxValue = signal<string | null>(null);

  // "Smallest"/"Largest" and not "Smallest loan", which is what the plan table's own floor
  // column is called one section down. Two identically-labelled money boxes on one screen
  // that mean different things — a flat default and a per-deposit-band floor — is the
  // collision; bare adjectives also make these read as the months' peers, which they are.
  protected readonly amountMinLabel = $localize`:@@spd.amount.min:Smallest`;
  protected readonly amountMaxLabel = $localize`:@@spd.amount.max:Largest`;
  protected readonly amountMinAria = $localize`:@@spd.amount.min_aria:Smallest loan every program selling this product lends, in EGP`;
  protected readonly amountMaxAria = $localize`:@@spd.amount.max_aria:Largest loan every program selling this product lends, in EGP`;
  protected readonly amountBlankNote = $localize`:@@spd.amount.blank_note:Blank — each bank states its own.`;

  /**
   * `null` when there is nothing to say, otherwise WHICH of the three things is wrong —
   * mirroring `tenorError` exactly, including that an empty pair is legal and is the state
   * every product ships in.
   *
   * Compared as NUMBERS, never as strings: '900000' > '1000000' is true lexically, which is
   * how an inverted pair passes a check that looks right.
   */
  protected readonly amountError = computed<'range' | 'inverted' | 'half' | null>(() => {
    const min = (this.amountMinValue() ?? '').trim();
    const max = (this.amountMaxValue() ?? '').trim();
    if (min === '' && max === '') return null;
    if (min === '' || max === '') return 'half';
    const legal = (raw: string) => /^\d+(\.\d{1,2})?$/.test(raw) && Number(raw) <= 99999999999.99;
    if (!legal(min) || !legal(max)) return 'range';
    const lo = Number(min);
    const hi = Number(max);
    // A ceiling of zero is a program that can never lend — refused by the server too.
    if (hi <= 0) return 'range';
    return lo > hi ? 'inverted' : null;
  });

  /**
   * How many bank programs are reading these amounts right now.
   *
   * Counted off `names[].programs[].ownLoanAmounts`, NOT `ownAmounts`: that one is the
   * income-FIGURES axis (whose tables a program quotes from), a different question with a
   * confusingly similar name. Counting it here reported programs that had typed their own
   * sizes as reading these.
   */
  protected readonly amountReaders = computed<number>(
    () =>
      this.product()
        ?.names.flatMap((n) => n.programs)
        .filter((prog) => !prog.ownLoanAmounts).length ?? 0,
  );

  /** Would emptying the boxes be refused? Says it BEFORE the server has to. */
  protected readonly amountClearBlocked = computed<boolean>(() => {
    if (this.amountReaders() === 0) return false;
    if (this.product()?.loanAmountDefaults == null) return false;
    return (
      (this.amountMinValue() ?? '').trim() === '' && (this.amountMaxValue() ?? '').trim() === ''
    );
  });

  protected setAmountMin(raw: string): void {
    const value = raw.trim();
    this.amountMinValue.set(value === '' ? null : value);
    this.amountDirty = true;
    this.markDirty();
  }

  protected setAmountMax(raw: string): void {
    const value = raw.trim();
    this.amountMaxValue.set(value === '' ? null : value);
    this.amountDirty = true;
    this.markDirty();
  }

  /** Its own flag beside `tenorDirty`, and for the same reason: it is a separate write. */
  private amountDirty = false;

  // ── The PRICE every bank falls back to ───────────────────────────────────
  // The third of the family, drawn from the duration's template like the size above it —
  // and the one that carries the most: the bank-program wizard's rate card was deleted, so
  // for every programme under this product that states nothing, this is where the price is.

  protected readonly rateValue = signal<string | null>(null);
  protected readonly rateVariable = signal<boolean>(false);
  protected readonly rateNoteValue = signal<string | null>(null);
  protected readonly rateBasisValue = signal<RateBasis>('reducing');

  protected readonly rateLabel = $localize`:@@spd.rate.label:Interest rate`;
  protected readonly rateEffectiveLabel = $localize`:@@spd.rate.effective_label:Rate right now`;
  protected readonly rateAria = $localize`:@@spd.rate.aria:Yearly interest rate every program selling this product is quoted at, in percent`;
  protected readonly rateEffectiveAria = $localize`:@@spd.rate.effective_aria:Rate every program selling this product is quoted at today, in percent, until the next reset`;
  protected readonly rateBlankNote = $localize`:@@spd.rate.blank_note:Blank — each bank states its own.`;

  /**
   * Does this product's own PLAN table already price every applicant?
   *
   * The twin of the wizard's `ratePricedByTable` and of the server's `aRateGridPrices`, and
   * it takes both halves of their test: a grid must APPLY, and it must REFUSE on no-match.
   * `useFallback` hands an unmatched applicant back down the cascade to the flat figure, so a
   * table that falls back has not priced everyone and the box below it is still a real
   * question.
   *
   * Read off the LIVE `planValue`, not the loaded row, for the reason every other computed on
   * this screen reads the controls: the plan tables are edited on this same step, and a
   * section that only noticed after a Save would be describing the product it used to be.
   */
  protected readonly ratePricedByPlans = computed<boolean>(
    () => this.planValue()?.rateByFact?.onNoMatch === 'reject',
  );

  /**
   * `null` when there is nothing to say, otherwise WHICH of the two things is wrong.
   *
   * An empty box is legal and is the state every product ships in — a CLEAR, refused
   * separately while programs are reading it. What is not legal is a variable rate with no
   * figure: the server refuses that pair (`INVALID_VARIABLE_RATE_CONFIGURATION`), and a
   * refusal that arrives after Save is a refusal about a control the operator has scrolled
   * past.
   */
  protected readonly rateError = computed<'range' | 'half' | null>(() => {
    // Nothing to be wrong with a box nobody is being asked to fill. Judged here rather than
    // at the Save gate so the two cannot disagree: a refusal on a field the screen has stopped
    // showing is a Save blocked with nothing on screen to fix.
    if (this.ratePricedByPlans()) return null;
    const raw = (this.rateValue() ?? '').trim();
    if (raw === '') return this.rateVariable() ? 'half' : null;
    // Four decimals, matching the column (`DECIMAL(7,4)`) and the DTO's `DecimalRange`.
    if (!/^\d{1,3}(\.\d{1,4})?$/.test(raw)) return 'range';
    const value = Number(raw);
    return !Number.isFinite(value) || value <= 0 ? 'range' : null;
  });

  /**
   * How many bank programs are priced at this rate right now.
   *
   * Counted off `names[].programs[].ownRate`, the axis the server derives through the same
   * `statesOwnRate` the quote path uses — so this count and the refusal cannot disagree.
   */
  protected readonly rateReaders = computed<number>(
    () =>
      this.product()
        ?.names.flatMap((n) => n.programs)
        .filter((prog) => !prog.ownRate).length ?? 0,
  );

  /** Would emptying the box be refused? Says it BEFORE the server has to. */
  protected readonly rateClearBlocked = computed<boolean>(() => {
    if (this.rateReaders() === 0) return false;
    if (this.product()?.rateDefaults == null) return false;
    return (this.rateValue() ?? '').trim() === '';
  });

  protected setRate(raw: string): void {
    const value = raw.trim();
    this.rateValue.set(value === '' ? null : value);
    this.rateDirty = true;
    this.markDirty();
  }

  /**
   * Ticking the box changes WHICH figure the box holds, so the figure is not carried across.
   *
   * The server refuses a variable rate carrying a base one and vice versa — the same rule a
   * bank program's own pricing has always been held to — and silently reinterpreting a fixed
   * 24% as "what it happens to sit at today" would be stating a reset rule nobody published.
   */
  protected setRateVariable(event: Event): void {
    this.rateVariable.set((event.target as HTMLInputElement).checked);
    this.rateValue.set(null);
    this.rateNoteValue.set(null);
    this.rateDirty = true;
    this.markDirty();
  }

  protected setRateNote(raw: string): void {
    const value = raw.trim();
    this.rateNoteValue.set(value === '' ? null : value);
    this.rateDirty = true;
    this.markDirty();
  }

  /** Its own flag beside `amountDirty`, and for the same reason: it is a separate write. */
  private rateDirty = false;

  /**
   * The box as one statement, or `null` — the CLEAR, which the server can refuse.
   *
   * The unused figure is never sent: `isVariableRate` decides which of the two boxes is the
   * price, and sending both is the one shape the server rejects outright.
   */
  private rateFromForm(): RateDefaults | null {
    const figure = (this.rateValue() ?? '').trim();
    if (figure === '') return null;
    const variable = this.rateVariable();
    const note = (this.rateNoteValue() ?? '').trim();
    return {
      isVariableRate: variable,
      ...(variable ? { currentEffectiveRatePercent: figure } : { baseRatePercent: figure }),
      ...(variable && note !== '' ? { variableRateNote: note } : {}),
      rateBasis: this.rateBasisValue(),
    };
  }

  protected readonly ruleBlocked = computed(() => {
    // An out-of-range cap is refused by the server, so Save is held here too — on a screen
    // where the field is in view rather than three steps away.
    if (this.dbrCapError()) return true;
    // Same, for the TIERS: a table with a gap, or one that does not start at 0 and leave its
    // top open, is refused by `validateIScoreTiers`. Judged by SHAPE and not by presence —
    // v26.2.0's defect 2, where a cleared tier figure left Save enabled with the editor's own
    // error on screen.
    if (this.iScoreError()) return true;
    // Same, for the duration: a half-stated or inverted pair is refused, and a refusal that
    // arrives after Save is a refusal about a field the operator has scrolled past.
    if (this.tenorError() !== null) return true;
    // And for the loan size, on exactly the same terms.
    if (this.amountError() !== null) return true;
    // And for the PRICE, on the same terms again — with the sharpest consequence of the
    // three behind it: a refused rate save leaves every program under this product on
    // whatever it was quoting before, and the operator has no other screen to fix it on.
    if (this.rateError() !== null) return true;
    // And for a plan table with a half-typed row: every one of them is validated on the
    // server, and the same sentence is better read beside the table it is about.
    if (this.planError() !== null) return true;
    return this.calcBlocked();
  });

  /**
   * The calculation section's OWN half of the refusal, split out because that section folds
   * and a folded section that blocks Save must not hide what is wrong with it. Narrow on
   * purpose: an out-of-range debt-burden cap is not the calculation's problem and must not
   * force its disclosure open, or every refusal on the step would open every section.
   */
  protected readonly calcBlocked = computed(() => {
    if (!this.isPipeline()) return false;
    if (
      productRuleHasError({
        steps: this.ruleSteps(),
        gates: this.ruleGates(),
        figures: this.stepFigures(),
      })
    ) {
      return true;
    }
    // Band tables are judged inside `productRuleHasError` (`stepBandsHaveError`), including
    // the I-Score tiers' total-coverage rule. What is left here is the KEY tables.
    //
    // A row with a key and no amount reads as CONFIGURED to the check above — the table has
    // rows — and is refused by the server as `incomeInvalid`, naming a step id. An EMPTY
    // table is skipped: that is a way the product offers and this bank declines, which the
    // check above already judges.
    return Object.values(this.stepFigures()).some((figures) => {
      const rows = figures.keyTable;
      return rows !== undefined && rows.length > 0 && incomeKeyTableErrorFor(rows) !== null;
    });
  });

  protected readonly hasTemplate = computed(() => this.product()?.template != null);

  protected readonly isPipeline = computed(() => this.ruleSteps().length > 0);

  // --- switching the product on and off ---------------------------------------

  /**
   * The consequence the operator is being shown, or `null` when nothing is pending.
   *
   * Derived from `product()`, which this page already fetched: the names that take their
   * calculation from this product and the bank programs under them are exactly what the
   * reachability walk on the server returned, and they are already rendered further down the
   * screen. So the confirmation and the list it refers to cannot disagree.
   */
  protected readonly offPending = signal<{
    names: readonly string[];
    programCodes: readonly string[];
    factsAffected: readonly string[];
  } | null>(null);

  /**
   * Ask before switching OFF, never before switching on.
   *
   * On restores service and can destroy nothing. Off stops every program under every linked
   * name from quoting — reversibly, and with nothing deleted, which is why the confirmation
   * STATES that rather than asking whether the operator is sure.
   */
  protected confirmOff(): void {
    const p = this.product();
    if (!p) return;
    this.offPending.set({
      names: p.names.map((n) => n.key),
      programCodes: p.names.flatMap((n) => n.programs.map((prog) => prog.programCode)),
      // NO fact keys, deliberately, and this is a correction. It used to list the facts
      // filed under this product (`platform_enumeration.surrogateProductKey`) while the
      // server flips the ones the BLUEPRINT declares — two different sets. It happened to
      // UNDER-state, because a cap blueprint files its facts under nothing; now that an
      // operator can attach a fact of their own it would start OVER-stating, promising that
      // answers stop being read which the server will not touch. The consequence is stated
      // in words instead, and `doSetActive` reports the `factsChanged` the response carries.
      factsAffected: [],
    });
  }

  protected cancelOff(): void {
    this.offPending.set(null);
  }

  protected setActive(active: boolean): void {
    void this.doSetActive(active);
  }

  private async doSetActive(active: boolean): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.setSurrogateProductActive(this.key, active);
      this.offPending.set(null);
      // Re-read rather than patch the signal: switching a cap-only product off also moves its
      // facts, and this screen renders those. Patching one field would leave the rest of the
      // page describing the state before the click.
      await this.load();
    } catch {
      // Already a toast from the global interceptor; re-stating it inline would say the same
      // thing twice, and the switch simply did not happen.
    } finally {
      this.saving.set(false);
    }
  }

  // --- what this product asks (step ①) ---------------------------------------

  /**
   * The whole board, absorbed from one response after every click.
   *
   * Not three signals fed by three reads. The question pool sits behind a stricter role, the
   * fact registry arrives through a per-session cache a tick cannot invalidate, and "who else
   * reads this fact" is answerable only server-side — three answers that can disagree about
   * what one tick did.
   */
  protected readonly asksBoard = signal<ProductAsksBoard | null>(null);

  /**
   * Whether the board is on its way, here, or refused — a state, not a null board.
   *
   * A failed read used to be indistinguishable from a finished one: `askCards` returns
   * nothing for a null board and `askSections` then drops the "not asked here" and "not read
   * yet" sections outright, so a 404 rendered as "this product asks nothing and there is
   * nothing to tick". Those are opposite facts and the operator cannot tell them apart, so
   * the failure says so and offers the read again.
   */
  protected readonly asksState = signal<'loading' | 'ready' | 'error'>('loading');

  /** The fixed questions a no-payslip applicant is asked (the server's `noPayslip`). */
  // ---- What applicants are asked, drawn as the income-proof program page draws it -----------

  /** This product's own questions — what it reads, Save-held changes included. */
  private readonly ownAsks = computed<readonly AskCard[]>(
    () => this.askSections().find((sec) => sec.key === 'asked')?.cards ?? [],
  );

  /** What the Calculation step may pick from: this product's own questions, held edits included. */
  /**
   * What the Calculation step may pick from: every question the Questions tab lists — this
   * product's own (held edits included) AND the fixed ones. Card limit share reads the fixed
   * card-limit question and car cross-sell the fixed car-instalment one, so leaving the fixed
   * questions out made both impossible to build.
   */
  protected readonly ownAskCodes = computed(() => [
    ...this.fixedAsks().map((q) => q.code),
    ...this.ownAsks()
      .map((c) => c.code)
      .filter((c) => c !== ''),
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
    const own = this.ownAsks()
      .filter((c) => c.code !== '')
      // A question the product reads is required of its applicants (question-scope.ts).
      .map((c, i) => row(c.code, c.label, c.type ?? '', fixed.length + i, true));
    const title = $localize`:@@spd.asks_page:Questions`;
    return [
      {
        code: 'asked',
        titleAr: title,
        titleEn: title,
        displayOrder: 0,
        questions: [...fixed, ...own],
      },
    ];
  });

  /** Fixed → locked; read by the calculation → locked; otherwise this product's to remove. */
  protected readonly askedStates = computed<ReadonlyMap<string, ServedRowState>>(() => {
    const out = new Map<string, ServedRowState>();
    for (const q of this.fixedAsks()) out.set(q.code, 'fixed');
    for (const c of this.ownAsks()) {
      if (c.code !== '' && !out.has(c.code)) out.set(c.code, c.detachBlocked ? 'calc' : 'added');
    }
    return out;
  });

  protected removeAskByCode(code: string): void {
    const card = this.ownAsks().find((c) => c.code === code);
    if (card) this.toggleAsk(card);
  }

  /** The pool this product does not ask yet — what the side sheet offers. */
  protected readonly addableRows = computed<readonly AddableRow[]>(() => {
    const group = $localize`:@@spd.add_group:Questions`;
    return (this.askSections().find((sec) => sec.key === 'rest')?.cards ?? [])
      .filter((c) => c.code !== '' && !c.blocked && !c.questionInactive)
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

  protected addAskByCode(code: string): void {
    const card = (this.askSections().find((sec) => sec.key === 'rest')?.cards ?? []).find(
      (c) => c.code === code,
    );
    if (card) this.toggleAsk(card);
  }

  private readonly addSheet = viewChild.required<TemplateRef<unknown>>('addSheet');
  private addSheetRef: {
    close(): void;
    afterClose: { subscribe(fn: () => void): unknown };
  } | null = null;
  protected readonly addSheetTitle = $localize`:@@spd.add_question:Add a question`;
  protected readonly addSheetSub = $localize`:@@spd.add_sheet_sub:Asked of this product's applicants. Saved with your other changes.`;
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

  protected readonly fixedAsks = signal<
    readonly {
      code: string;
      label: string;
      type: string;
      unlessDerived: boolean;
      isRequired: boolean;
    }[]
  >([]);

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
            unlessDerived: q.noPayslip === 'unless_derived',
            isRequired: q.isRequired,
          })),
      );
    } catch {
      // A list to look at, not to act on: the block stays away rather than say "none".
      this.fixedAsks.set([]);
    }
  }

  protected readonly askSearch = new FormControl<string>('', { nonNullable: true });
  /**
   * The query as a SIGNAL, and the template reads this rather than `askSearch.value`.
   *
   * A control's `.value` in a template is a stale read waiting to happen — it re-renders
   * only because something else on the same pass happens to be reactive — and the Clear
   * button's visibility is exactly the kind of thing that then lags a keystroke behind.
   */
  protected readonly askQuery = computed(() => this.askQueryRaw().trim());
  private readonly askQueryRaw = toSignal(this.askSearch.valueChanges, { initialValue: '' });

  protected clearAskSearch(): void {
    this.askSearch.setValue('');
  }

  /**
   * "Not read yet" collapses to a one-line count by default — 66 unrelated questions from the
   * whole pool was the single biggest source of always-visible clutter on this step, and
   * almost never what the operator came to browse; they came with one question in mind and
   * typed it. This toggle is the escape hatch for the rarer case of actually wanting to scan
   * the pool, so browsing stays possible — nothing here removes a capability, only its default
   * visibility.
   */
  protected readonly askRestExpanded = signal(false);

  protected toggleAskRestExpanded(): void {
    this.askRestExpanded.update((v) => !v);
  }

  /**
   * The in-flight overlay, in both directions, keyed by what each write is addressed by.
   *
   * An overlay rather than a patched copy of the board, because the truth here lives in a
   * response this page does not own: there is no second copy to roll back wrong. The tick
   * flips instantly; on failure the overlay is dropped and the derived truth reappears.
   */
  private readonly attaching = signal<ReadonlySet<string>>(new Set());
  private readonly detaching = signal<ReadonlySet<string>>(new Set());
  protected readonly askBusy = signal(false);
  protected readonly askStatus = signal('');

  // ── What the engine needs ───────────────────────────────────────────────────
  /**
   * The panel is switched off on every product. Everything behind it stays wired, so turning
   * it back on is this one value.
   */
  protected readonly neededPanelShown = signal(false);
  /** Rows of the "what the engine needs" panel, gaps first. */
  protected readonly neededRowsList = computed(() => neededRows(this.asksBoard(), this.isAr));
  protected readonly neededGaps = computed(() => neededGapCount(this.neededRowsList()));
  protected readonly neededFixable = computed(() => neededFixableCount(this.neededRowsList()));
  /** The same rows, grouped by who answers them — gaps, this product, the platform. */
  protected readonly neededGroupList = computed(() => neededGroups(this.neededRowsList()));
  /** Which groups are unfolded. Gaps start open; the covered groups start folded. */
  protected readonly neededOpen = signal<ReadonlySet<NeededGroupKey>>(new Set(['action']));
  /** The fact a click is working on, or `*` for "Fix all". */
  protected readonly neededBusy = signal<string | null>(null);
  /** What the last click did, said on screen until the next one. */
  protected readonly neededResult = signal<string>('');

  protected readonly askSearchAria = $localize`:@@spd.ask.search_aria:Search questions`;
  protected readonly askPagerAria = $localize`:@@spd.ask.pager_aria:Question pages`;

  private askInput() {
    return {
      board: this.asksBoard(),
      search: this.askQuery(),
      isAr: this.isAr,
      attaching: this.attaching(),
      detaching: this.detaching(),
      stagedAttach: this.stagedAttach(),
      stagedDetach: this.stagedDetach(),
    };
  }

  protected readonly askSections = computed(() => askSections(this.askInput()));

  /** What the filter did, for the live region. Empty with an empty box — see the template. */
  protected readonly askSearchStatus = computed(() => {
    const q = this.askQuery();
    if (q.length === 0) return '';
    const n = askMatchCount(this.askSections());
    return n === 0
      ? $localize`:@@spd.ask.status_none:No question matches ${q}:QUERY:`
      : $localize`:@@spd.ask.status_some:${n}:COUNT: questions match ${q}:QUERY:`;
  });

  protected readonly ASK_PAGE_SIZE = ASK_PAGE_SIZE;

  /**
   * The page each section is on, held against the search it was chosen under.
   *
   * The key travels WITH the pages rather than being reset by an effect: typing in the search
   * box builds a different list, and a page 4 carried into it would open on cards nobody asked
   * to see (and, when the new list is shorter, on the clamped last page — which reads as the
   * search having found less than it did). A stale key means page 1 everywhere, derived, so
   * nothing writes a signal from a computed.
   */
  private readonly askPageKey = computed(() => this.askQuery().trim().toLowerCase());
  private readonly askPageState = signal<{
    key: string;
    pages: Partial<Record<AskSectionKey, number>>;
  }>({ key: '', pages: {} });

  /** The sections as rendered: each narrowed to its page, each still counting its whole set. */
  protected readonly askSectionPages = computed(() => {
    const state = this.askPageState();
    const pages = state.key === this.askPageKey() ? state.pages : {};
    return askPagedSections(this.askSections(), pages);
  });

  protected setAskPage(key: AskSectionKey, page: number): void {
    const current = this.askPageState();
    const live = current.key === this.askPageKey();
    this.askPageState.set({
      key: this.askPageKey(),
      pages: { ...(live ? current.pages : {}), [key]: page },
    });
  }

  /** The loan types the names selling this product are filed under, as read off the board. */
  private readonly soldCategories = computed<LoanCategory[]>(() => {
    const board = this.asksBoard();
    if (!board) return [];
    return [...new Set(board.served.map((row) => row.category))].filter(isLoanCategory);
  });

  /**
   * Can a plan table mean anything here? Every one is keyed by the share of a CAR's price put
   * down, so only a product a car loan sells can match an applicant against one.
   *
   * Errs toward SHOWING: stated plans are never hidden (a table nobody can see is a table
   * nobody can clear), and a product whose loan types are not known yet — the board still
   * loading, or no name selling it — keeps the section, since the answer may be car.
   */
  protected readonly plansApply = computed<boolean>(() => {
    if (this.planValue() !== null) return true;
    if (this.asksBoard() === null) return true;
    const sold = this.soldCategories();
    return sold.length === 0 || sold.includes('car');
  });

  protected askTypeLabel(type: AskQuestionType | null): string {
    switch (type) {
      case 'SINGLE_SELECT':
        return $localize`:@@spd.ask.t_one:Single select`;
      case 'NUMERIC':
        return $localize`:@@spd.ask.t_number:Number`;
      case 'MULTI_SELECT':
        return $localize`:@@spd.ask.t_many:Multi select`;
      case 'TEXT':
        return $localize`:@@spd.ask.t_text:Text`;
      default:
        return $localize`:@@spd.ask.t_unknown:Unknown`;
    }
  }

  /**
   * Why a question cannot be read as an answer.
   *
   * ONE reason left, and in practice no card carries it: every question in the pool is
   * tickable, whatever its type and whatever its figure means. It is kept because it is the
   * SAME field the attach path refuses on — a question type added to the schema before the
   * engine can read it must show as blocked here rather than as a tick that fails.
   */
  protected blockedWhy(card: AskCard): string {
    return card.blocked === undefined
      ? ''
      : $localize`:@@spd.ask.why_unsupported:This kind of answer has no reader yet, so a bank could not look a figure up against it.`;
  }

  /**
   * Why THIS card refuses, whichever way it refuses.
   *
   * One accessor because the card has one marker: the glyph on the title's line and the
   * `spd-why-` id `aria-describedby` names. A tick refused and an untick refused are the
   * same thing to the operator standing in front of the card — the difference is in the
   * sentence, not in a second control.
   */
  protected askWhy(card: AskCard): string {
    return card.blocked ? this.blockedWhy(card) : this.detachWhy(card);
  }

  /** Why an untick is refused, and what to do instead. */
  protected detachWhy(card: AskCard): string {
    switch (card.detachBlocked) {
      case 'read_by_own_rule':
        return $localize`:@@spd.ask.why_in_rule:The calculation on the next step still reads this answer. Take it out of the calculation first.`;
      case 'fact_still_read':
        return $localize`:@@spd.ask.why_in_use:A bank program still reads this answer, so it cannot be removed yet.`;
      default:
        return '';
    }
  }

  protected alsoAskedLabel(products: readonly string[]): string {
    return $localize`:@@spd.ask.also:${products.length}:COUNT: other products read this too`;
  }

  protected askCardAria(card: AskCard): string {
    const name = card.label;
    if (card.blocked) return `${name} — ${this.blockedWhy(card)}`;
    if (card.detachBlocked) return `${name} — ${this.detachWhy(card)}`;
    return card.read
      ? $localize`:@@spd.ask.aria_stop:Stop reading ${name}:NAME:`
      : $localize`:@@spd.ask.aria_read2:Read ${name}:NAME:`;
  }

  /**
   * The tick.
   *
   * An early return rather than `[disabled]`, the rule this page's sibling states: a disabled
   * button leaves the tab order mid-keyboard-pass, and the reason bound to it by
   * `aria-describedby` is then announced to nobody.
   */
  protected toggleAsk(card: AskCard): void {
    if (card.blocked || card.detachBlocked || card.saving || this.savingAll()) return;
    // HELD, not written (v33.2.0): a click changes what Save will do. Clicking a held card
    // again takes the change back.
    if (card.pending) {
      this.unstage(card);
      return;
    }
    if (card.read) this.stageDetach(card);
    else this.stageAttach(card);
  }

  protected stopReading(card: AskCard): void {
    if (card.detachBlocked || card.saving || this.savingAll()) return;
    if (card.pending) this.unstage(card);
    else this.stageDetach(card);
  }

  private stageAttach(card: AskCard): void {
    if (card.code === '') return;
    this.stagedAttach.update((s) => new Set(s).add(card.code));
    this.askStatus.set(
      $localize`:@@spd.ask.held_read:${card.label}:NAME: will be read once you save`,
    );
  }

  private stageDetach(card: AskCard): void {
    if (card.factKey === '') return;
    this.stagedDetach.update((s) => new Set(s).add(card.factKey));
    this.askStatus.set(
      $localize`:@@spd.ask.held_stop:${card.label}:NAME: will stop being read once you save`,
    );
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
    this.askStatus.set($localize`:@@spd.ask.held_undo:${card.label}:NAME: — change taken back`);
  }

  protected setNeededOpen(key: NeededGroupKey, open: boolean): void {
    if (this.neededOpen().has(key) === open) return;
    this.neededOpen.update((keys) => {
      const next = new Set(keys);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  protected actOnNeeded(row: NeededRow | null): void {
    if (this.neededBusy() !== null || this.savingAll()) return;
    // HELD (v33.2.0), like a tick: Save runs it with everything else.
    this.stagedNeeded.update((s) => new Set(s).add(row?.factKey ?? '*'));
    const said = $localize`:@@spd.needed.held:Will be asked once you save.`;
    this.neededResult.set(said);
    this.askStatus.set(said);
  }

  // --- NAME (v33.3.0) ---------------------------------------------------------

  /** Both names, edited on step 1 and saved by the one Save bar. */
  protected readonly nameForm = new FormGroup({
    labelEn: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    labelAr: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
  });
  private readonly nameValue = toSignal(this.nameForm.valueChanges, {
    initialValue: this.nameForm.getRawValue(),
  });
  protected readonly nameDirty = computed(() => {
    const p = this.product();
    const v = this.nameValue();
    if (!p) return false;
    return (v.labelEn ?? '').trim() !== p.labelEn || (v.labelAr ?? '').trim() !== p.labelAr;
  });

  // --- ONE SAVE (v33.2.0) -----------------------------------------------------

  /** Question codes ticked, not saved. */
  protected readonly stagedAttach = signal<ReadonlySet<string>>(new Set());
  /** Fact keys unticked, not saved. */
  protected readonly stagedDetach = signal<ReadonlySet<string>>(new Set());
  /** Needed answers to ask on save — a fact key, or `*` for "all of them". */
  protected readonly stagedNeeded = signal<ReadonlySet<string>>(new Set());

  /** The inline calculation builder, kept alive across steps so its edits survive. */
  private readonly calc = viewChild(ProductTemplatePage);
  protected readonly calcDirty = computed(() => this.calc()?.dirty() ?? false);

  protected readonly savingAll = signal(false);
  protected readonly saveAllError = signal<string | null>(null);

  /** Everything Save would write, counted the way the operator made it. */
  protected readonly changeCount = computed(
    () =>
      this.stagedAttach().size +
      this.stagedDetach().size +
      this.stagedNeeded().size +
      (this.nameDirty() ? 1 : 0) +
      (this.dirty() ? 1 : 0) +
      (this.calcDirty() ? 1 : 0),
  );

  protected readonly changeLabel = computed(() => {
    const n = this.changeCount();
    return n === 1
      ? $localize`:@@spd.bar.one:1 change not saved yet`
      : $localize`:@@spd.bar.many:${n}:N: changes not saved yet`;
  });

  protected readonly saveBarAria = $localize`:@@spd.bar.aria:Unsaved changes`;

  /** What would refuse the save, said on the button rather than after the click. */
  protected readonly saveAllBlocked = computed<string | null>(() => {
    if (this.savingAll()) return '';
    if (this.nameDirty() && this.nameForm.invalid) {
      return $localize`:@@spd.bar.blocked_name:Both names are needed — see the first step.`;
    }
    const unfinished = this.planError();
    if (this.dirty() && unfinished !== null) {
      return $localize`:@@spd.bar.blocked_plan:Finish or clear the ${unfinished}:TABLE: table.`;
    }
    if (this.dirty() && this.ruleBlocked()) {
      // On the Figures step itself, name the section rather than the step the operator is on.
      return this.stepIndex() === 3
        ? $localize`:@@spd.bar.blocked_calc_here:Fill in the calculation's own figures, at the bottom of this step.`
        : $localize`:@@spd.bar.blocked_figures:Some figures are missing — see the Figures step.`;
    }
    if (this.calcDirty()) return this.calc()?.saveBlockReason() ?? null;
    return null;
  });

  /** Unsaved work on this page — what the leave guard and the tab-close prompt read. */
  hasUnsavedChanges(): boolean {
    return this.changeCount() > 0;
  }

  /** The route guard's question: leave, losing the changes? */
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

  /**
   * Save, asking first on a LIVE product something sells: the change reaches customers on
   * the next quote, so the operator confirms against what it reaches.
   */
  protected requestSaveAll(): void {
    const p = this.product();
    if (!p || this.saveAllBlocked() !== null) return;
    const programs = p.names.reduce((n, name) => n + name.programs.length, 0);
    if (!p.active || p.names.length === 0) {
      void this.saveAll();
      return;
    }
    this.modal.confirm({
      nzTitle: $localize`:@@spd.confirm.title:Save changes to a live product?`,
      nzContent: $localize`:@@spd.confirm.body:${p.names.length}:NAMES: program name(s) and ${programs}:PROGRAMS: bank program(s) quote from this product. They use the change from the next quote. Offers already issued keep their own figures.`,
      nzOkText: $localize`:@@spd.confirm.ok:Save changes`,
      nzCancelText: $localize`:@@spd.confirm.cancel:Not yet`,
      nzOnOk: () => this.saveAll(),
    });
  }

  /**
   * Every held change, in the order they depend on each other: what the product asks first
   * (a calculation may read a new answer), then the calculation, then the figures. Stops at
   * the first refusal and keeps whatever has not landed, so nothing is half-said.
   */
  private async saveAll(): Promise<void> {
    if (this.savingAll()) return;
    this.savingAll.set(true);
    this.saveAllError.set(null);
    try {
      if (this.nameDirty()) {
        const v = this.nameForm.getRawValue();
        await this.api.renameSurrogateProduct(this.key, {
          labelEn: v.labelEn.trim(),
          labelAr: v.labelAr.trim(),
        });
      }
      for (const factKey of this.stagedDetach()) {
        await this.api.detachProductAsk(this.key, factKey);
        this.stagedDetach.update((s) => {
          const next = new Set(s);
          next.delete(factKey);
          return next;
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
      for (const fact of this.stagedNeeded()) {
        await this.api.askNeeded(this.key, fact === '*' ? null : fact);
        this.stagedNeeded.update((s) => {
          const next = new Set(s);
          next.delete(fact);
          return next;
        });
      }
      const calc = this.calc();
      if (calc && calc.dirty() && !(await calc.saveNow())) {
        this.saveAllError.set(
          $localize`:@@spd.bar.calc_failed:The calculation was not saved — see step 2.`,
        );
        return;
      }
      if (this.dirty()) {
        await this.save();
        if (this.saveError() !== null) {
          this.saveAllError.set(this.saveError());
          return;
        }
      }
      this.neededResult.set('');
      this.message.success($localize`:@@spd.bar.saved:Changes saved.`);
    } catch (err) {
      this.saveAllError.set(this.localizedError(err));
    } finally {
      this.savingAll.set(false);
      void this.enums.refresh('surrogate_fact');
      void this.enumTypes.refresh();
      await Promise.all([this.load({ silent: true, keepEdits: true }), this.loadAsks()]);
      if (!this.calc()?.dirty()) void this.calc()?.discard();
    }
  }

  /** Throw every held change away and show what is stored. */
  protected async discardAll(): Promise<void> {
    this.stagedAttach.set(new Set());
    this.stagedDetach.set(new Set());
    this.stagedNeeded.set(new Set());
    this.neededResult.set('');
    this.saveAllError.set(null);
    this.saveError.set(null);
    const p = this.product();
    if (p) this.nameForm.reset({ labelEn: p.labelEn, labelAr: p.labelAr });
    await Promise.all([this.load({ silent: true }), this.calc()?.discard()]);
  }

  /**
   * Where one row's answer is read: the product's own places (calculation, cap, tables) and
   * the bank programmes that also read it. A programme usually reads the same tables its
   * product does, so tables are said once — listing each twice, bare and behind the
   * programme code, is what once put eleven chips on a single row.
   */
  private neededPlaces(row: NeededRow): { places: string[]; programs: string[] } {
    const places: string[] = [];
    const programs: string[] = [];
    for (const reader of row.readers) {
      const label =
        reader.kind === 'calculation'
          ? this.neededCalculationLabel
          : reader.kind === 'cap'
            ? this.neededCapLabel
            : (this.neededTableLabels[reader.table] ?? reader.table);
      if (!places.includes(label)) places.push(label);
      if (reader.kind === 'program' && !programs.includes(reader.programCode)) {
        programs.push(reader.programCode);
      }
    }
    return { places, programs };
  }

  /** "Read in N places" — the tables and calculation, not the programmes reading them. */
  protected neededUseCount(row: NeededRow): number {
    return this.neededPlaces(row).places.length;
  }

  /** The tooltip: "Calculation · Rate table · Bank program NATIONAL-CAR-C483". */
  protected neededUsedIn(row: NeededRow): string {
    const { places, programs } = this.neededPlaces(row);
    const parts = [...places];
    const [onlyProgram] = programs;
    if (programs.length === 1 && onlyProgram !== undefined) {
      parts.push($localize`:@@spd.needed.used_program:Bank program ${onlyProgram}:CODE:`);
    } else if (programs.length > 1) {
      parts.push($localize`:@@spd.needed.used_programs:${programs.length}:COUNT: bank programs`);
    }
    const via = row.derivedFrom ? this.neededDerivedLabels[row.derivedFrom] : undefined;
    if (via) parts.push(via);
    return parts.join(' · ');
  }

  protected readonly neededCalculationLabel = $localize`:@@spd.needed.reader_calculation:Calculation`;
  protected readonly neededCapLabel = $localize`:@@spd.needed.reader_cap:Loan cap`;
  private readonly neededTableLabels: Readonly<Record<string, string>> = {
    rateByFact: $localize`:@@spd.needed.table_rate:Rate table`,
    maxMonthsByFact: $localize`:@@spd.needed.table_max_months:Longest-term table`,
    minMonthsByFact: $localize`:@@spd.needed.table_min_months:Shortest-term table`,
    ltvCeilingByFact: $localize`:@@spd.needed.table_ltv:Financed-share table`,
    minAmountByFact: $localize`:@@spd.needed.table_min_amount:Smallest-loan table`,
    carInsuranceRateByFact: $localize`:@@spd.needed.table_insurance:Insurance table`,
    maxLoanByFact: $localize`:@@spd.needed.table_max_loan:Loan cap table`,
    maxVehicleAgeYearsByFact: $localize`:@@spd.needed.table_vehicle_age:Car-age table`,
  };
  protected readonly neededDerivedLabels: Readonly<Record<string, string>> = {
    car_down_payment_percent: $localize`:@@spd.needed.via_down_payment:Through the down-payment share`,
    car_age_years: $localize`:@@spd.needed.via_car_age:Through the car's age`,
  };

  private async loadAsks(): Promise<void> {
    this.asksState.set('loading');
    try {
      const res = await this.api.getProductAsks(this.key);
      this.asksBoard.set(res.data);
      this.asksState.set('ready');
    } catch {
      // The interceptor's toast has said why, and it is gone by the time anybody looks — so
      // the state is kept and step ① renders the failure with a way to ask again.
      this.asksBoard.set(null);
      this.asksState.set('error');
    }
  }

  /** The retry on the failure notice. One read, no page reload. */
  protected retryAsks(): void {
    void this.loadAsks();
  }

  // --- the lists this calculation reads --------------------------------------

  // `protected`, not private: the builder's input picker renders this list.
  protected readonly facts = computed(() =>
    registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr),
  );

  /**
   * Which operator-managed lists this product reads, DERIVED from the rule.
   *
   * Two hops, neither of them hardcoded: `factKeysReadBy` says which facts the steps and
   * gates consult, and each fact's bound question reports which registry list its options
   * came from (`optionsEnumerationType`, derived server-side by coverage). A product reading
   * military grades surfaces that list here with no code change — which is the whole reason
   * this is not a compound-shaped screen.
   *
   * A fact whose question is not backed by a list — a yes/no, a numeric — contributes
   * nothing, correctly: there is no list to curate.
   */
  protected readonly readLists = computed<ReadList[]>(() => {
    // TWO SOURCES, unioned, because they answer different questions and each is silent
    // exactly when the other is not. The stored one knows what this product AUTHORED, which
    // is the only answer available before there is a rule; the derived one knows what the
    // finished calculation READS, including lists somebody else owns.
    const owned = new Set(this.enumTypes.listsOwnedBy(this.productKey()).map((d) => d.key));
    const read = new Set(factKeysReadBy(this.ruleSteps(), this.ruleGates()));
    const byKey = new Map(this.facts().map((f) => [f.key, f]));
    const seen = new Set<string>();
    const out: ReadList[] = [];

    const steps = this.ruleSteps();
    const gates = this.ruleGates();
    const facts = this.facts();

    const push = (type: string, description: string, hasBoard: boolean): void => {
      if (seen.has(type)) return;
      seen.add(type);
      // One join, stated in a pure module and shared with the editor that renders the
      // boxes — derived twice, the two would disagree the first time a pick carried two
      // columns keyed by different facts, and disagree silently.
      const figures = listFigureState(steps, gates, facts, type);
      out.push({
        type,
        title: this.enumTypes.label(type, this.isAr),
        description,
        hasBoard,
        owned: owned.has(type),
        figures: figures.state,
        pricedOn: figures.pricedOn,
      });
    };

    // Owned, and ANSWER LISTS BEFORE THE CLASSES THEY ARE FILED UNDER, whatever order they
    // were created in. The operator reads down the page from the question, and a class list
    // is only meaningful once you have seen what is filed under it.
    //
    // Which of the two a list IS comes from the axis, not from its name: a list with children
    // is a class list, and one with a parent is an answer list filed under those classes. The
    // first cut keyed off `parentTypeKey` alone and so called the class list "the answers to
    // one of the questions above", which is the one thing it is not.
    const ownedDefs = [...this.enumTypes.listsOwnedBy(this.productKey())].sort(
      (a, b) =>
        Number(this.enumTypes.childTypesOf(a.key).length > 0) -
        Number(this.enumTypes.childTypesOf(b.key).length > 0),
    );
    for (const def of ownedDefs) {
      const isClassList = this.enumTypes.childTypesOf(def.key).length > 0;
      push(
        def.key,
        isClassList
          ? $localize`:@@spd.list_owned_classes:The classes a bank keys its table by. Each answer above is filed under one of these.`
          : def.parentTypeKey === null
            ? $localize`:@@spd.list_owned:The answers to one of the questions above.`
            : $localize`:@@spd.list_owned_filed:The answers to one of the questions above, each filed under a class.`,
        def.parentTypeKey !== null,
      );
    }

    for (const key of read) {
      const question = byKey.get(key)?.question;
      const type = question?.optionsEnumerationType;
      if (!type) continue;
      push(
        type,
        $localize`:@@spd.list_desc:The values an applicant can pick when answering “${question?.label ?? key}:question:”.`,
        Boolean(question?.parentEnumerationType),
      );

      // The PARENT list too — a bank keys its table by the class while the customer picks
      // a value by name, so an operator who cannot see the classes cannot file anything.
      const parentType = question?.parentEnumerationType;
      if (parentType) {
        push(
          parentType,
          $localize`:@@spd.parent_desc:The classes a bank keys its table by. Each value above is filed under one of these.`,
          false,
        );
      }
    }
    return out;
  });

  // --- step ①'s inner rail: one list on stage -------------------------------

  protected readonly listsAria = $localize`:@@spd.lists_aria:The answers they pick from`;

  /**
   * Which list is on stage. NOT on the URL, deliberately, and this is the one place this
   * screen's own `?step=` convention does not extend: `?step=` survives a reload because an
   * operator pastes a link to a STEP, and the rail's items are DATA — a tab id is a list key
   * that a shared list can lose the moment another product stops reading it, and a stale one
   * on the wire would land on an empty stage rather than on the list somebody meant.
   * `activeListType()` resolves it against what is actually there instead.
   */
  protected readonly listTab = signal<string | null>(null);

  /**
   * The rail. A count is deliberately absent: the values panel fetches its own rows, so a
   * number here would either be a second fetch of every list on the step — four requests to
   * label four chips — or a figure that disagrees with the panel one click later.
   */
  protected readonly listTabs = computed<RailTabItem[]>(() =>
    this.readLists().map((l) => ({
      id: l.type,
      label: l.title,
      // Provenance, on the chip, because it changes what an edit COSTS. `note` and not a
      // warn marker: a shared list is normal, not a defect.
      note: l.owned ? undefined : $localize`:@@spd.list_tab_shared:Shared`,
    })),
  );

  /**
   * Resolved against the lists that exist right now. `readLists()` is derived from the rule
   * and the registry, so it changes under the rail — adding a value to a mirrored list
   * reloads the product — and a tab id held from before that must not strand the stage.
   */
  protected readonly activeListType = computed(() => {
    const lists = this.readLists();
    const want = this.listTab();
    if (want && lists.some((l) => l.type === want)) return want;
    return lists[0]?.type ?? '';
  });

  protected readonly activeList = computed<ReadList | null>(
    () => this.readLists().find((l) => l.type === this.activeListType()) ?? null,
  );

  /**
   * The rail title of another list on this step, or `null` when the rail does not carry it.
   *
   * Resolved against `readLists()` and NOT against the registry's label, so a note can never
   * name — or offer a trip to — a tab that is not on stage: `pricedOn` is derived from the
   * rule, and a list only reaches the rail once a fact reads it AND its question reports a
   * backing list. Same posture as `activeListType()`, which resolves the rail's own id
   * against what is actually there.
   */
  protected listTitle(type: string | null): string | null {
    if (type === null) return null;
    return this.readLists().find((l) => l.type === type)?.title ?? null;
  }

  /**
   * What the filing board says needs a human — `null` until it has loaded.
   *
   * The board owns the answer (it is the only thing that has fetched both lists), so this is
   * reported rather than re-derived: a second count taken from a different fetch would
   * disagree with the notices inside the board the moment somebody moved a value.
   */
  protected readonly boardAttention = signal<BoardAttention | null>(null);

  /**
   * The two surfaces that read the list on stage from the server themselves.
   *
   * One of each at most: the rail puts ONE list on stage, and the board renders only inside
   * that list's own tab. Queried rather than pushed a reload flag, because each owns its own
   * fetch and neither can be told what to hold — see `onListChanged`.
   */
  private readonly valuesPanel = viewChild(LookupValuesPanelComponent);
  private readonly classBoard = viewChild(ParentClassBoardComponent);

  /** The filing board, if the list on stage is the one it files. */
  protected boardFor(type: string): { type: string; parentType: string } | null {
    const board = this.boardList();
    return board && board.type === type ? board : null;
  }

  /** The child/parent pair the assignment board is about, when there is one. */
  protected readonly boardList = computed<{ type: string; parentType: string } | null>(() => {
    // OWNED first, and without consulting the rule: the board is how an operator re-files a
    // value, and they need it the moment the list exists — not once a step reads it. The
    // registry states the axis directly (`parentTypeKey`), so this needs no fact at all.
    for (const def of this.enumTypes.listsOwnedBy(this.productKey())) {
      if (def.parentTypeKey !== null) return { type: def.key, parentType: def.parentTypeKey };
    }
    const keys = new Set(factKeysReadBy(this.ruleSteps(), this.ruleGates()));
    for (const fact of this.facts()) {
      if (!keys.has(fact.key)) continue;
      const q = fact.question;
      if (q?.optionsEnumerationType && q.parentEnumerationType) {
        return { type: q.optionsEnumerationType, parentType: q.parentEnumerationType };
      }
    }
    return null;
  });

  // --- the steps -------------------------------------------------------------

  /** Index of the last step — "Check and go live" (v36.1.0). */
  protected readonly lastStep = 4;

  protected readonly stepIndex = signal<number>(this.initialStep());

  private readonly stepLabels = productStepLabels();

  /**
   * Status is derived, and two of the three steps can ask for attention.
   *
   * Step ① is WRONG when the product asks nothing — a no-payslip product that reads no answer
   * has nothing to work an income out from, and every quote under it stops at
   * `fact_not_answered` — and on an unsaved edit, because the amounts keyed by each list are
   * typed there too. Step ② is wrong on the same unsaved edit: it is one object with one
   * Save, so it would be dishonest for only one of the two to say so. Step ③ is a report, and
   * a product nothing sells yet is a legitimate state rather than an error.
   */
  protected readonly steps = computed<WizardStepItem[]>(() => {
    const p = this.product();
    return [
      {
        id: 'name',
        label: this.stepLabels[0] ?? '',
        status: this.nameDirty() ? 'invalid' : 'done',
      },
      {
        id: 'asks',
        // Step ① carries the amounts keyed by each list, so an unsaved edit is as much this
        // step's as step ②'s — it is one object, saved by one button on both.
        label: this.stepLabels[1] ?? '',
        // `invalid` is reachable here now, and it is a strict improvement: a product whose
        // only fact is asked in NO loan type used to read `done` and could never quote.
        status: askStepStatus(this.asksBoard(), this.dirty()),
      },
      {
        id: 'calc',
        label: this.stepLabels[2] ?? '',
        // Cap-only works nothing out by design, so there is nothing missing here.
        status: p?.capOnly || p?.strategy ? 'done' : 'todo',
      },
      {
        id: 'rule',
        label: this.stepLabels[3] ?? '',
        status: this.dirty() ? 'invalid' : p?.strategy ? 'done' : 'todo',
      },
      {
        id: 'review',
        label: this.stepLabels[4] ?? '',
        status: p?.active ? 'done' : 'todo',
      },
    ];
  });

  /**
   * What stops this product going live — the server's `notReady`, kept current as the
   * operator ticks questions on step ① (the asks board is re-read on every tick; the product
   * is not). The server refuses `PUT …/active` on the same two reasons.
   */
  protected readonly notReady = computed<SurrogateProductNotReadyReason[]>(() => {
    const p = this.product();
    if (!p) return [];
    const reasons: SurrogateProductNotReadyReason[] = [];
    if (!p.capOnly && p.strategy === null) reasons.push('no_calculation');
    const board = this.asksBoard();
    const asks = board ? board.asks.length : (p.askCount ?? 1);
    if (asks === 0) reasons.push('asks_nothing');
    return reasons;
  });

  protected readonly statusLabel = computed(() => {
    const p = this.product();
    if (!p) return '';
    if (p.active) return $localize`:@@spd.review.live:Live`;
    return this.isDraft()
      ? $localize`:@@spd.review.draft:Draft — not live yet`
      : $localize`:@@spd.review.off:Switched off`;
  });

  protected readonly reviewAsks = computed(() => {
    const n = this.asksBoard()?.asks.length ?? this.product()?.askCount ?? 0;
    return n === 0
      ? $localize`:@@spd.review.asks_none:None yet`
      : $localize`:@@spd.review.asks_n:${n}:N: question(s)`;
  });

  protected readonly reviewSold = computed(() => {
    const p = this.product();
    if (!p) return '';
    const programs = p.names.reduce((n, name) => n + name.programs.length, 0);
    return p.names.length === 0
      ? $localize`:@@spd.review.sold_none:Not sold as a program yet`
      : $localize`:@@spd.review.sold_n:${p.names.length}:NAMES: program name(s), ${programs}:PROGRAMS: bank program(s)`;
  });

  /** OFF and sold by nothing yet — a product being built, rather than one switched off. */
  protected readonly isDraft = computed(() => {
    const p = this.product();
    return !!p && !p.active && p.usedBy.length === 0;
  });

  // --- lifecycle (v33.0.0) ---------------------------------------------------

  /** A no-payslip program name, born linked to this product (v33.1.0). */
  protected openSell(): void {
    const p = this.product();
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
      if (res) void this.load({ silent: true, keepEdits: true });
    });
  }

  protected openDelete(): void {
    const p = this.product();
    if (!p) return;
    const ref = this.modal.create<
      DeleteProductDialogComponent,
      DeleteProductDialogData,
      boolean | undefined
    >({
      nzContent: DeleteProductDialogComponent,
      nzData: { key: p.key, label: this.label(p) },
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

  protected readonly stepCaption = computed(() => {
    switch (this.stepIndex()) {
      case 0:
        return $localize`:@@spd.cap_name2:What it is called.`;
      case 1:
        return $localize`:@@spd.cap_asks2:What the applicant is asked for this product.`;
      case 2:
        return $localize`:@@spd.cap_calc4:Which questions decide the customer's assumed monthly income.`;
      case 3:
        return $localize`:@@spd.cap_figures2:The figures every bank selling this product starts from.`;
      case 4:
        return $localize`:@@spd.cap_live:Try sample answers, then switch it on. Nothing you try is saved.`;
      default:
        return $localize`:@@spd.cap_uses:Every catalog name selling this product, and the bank programs underneath.`;
    }
  });

  protected readonly nextLabel = computed(
    () => this.stepLabels[Math.min(this.stepIndex() + 1, this.lastStep)] ?? '',
  );

  protected readonly lede = computed(() => {
    const p = this.product();
    if (!p) return '';
    if (p.capOnly) {
      return $localize`:@@spd.lede_cap:Works out no income — it asks one answer, and each bank caps its own maximum by it.`;
    }
    return p.strategy === null
      ? $localize`:@@spd.lede_none:This product states no calculation yet, so nothing filed under it can quote.`
      : // No prefix: every method label is already a complete phrase — "Worked out step by
        // step from what the customer owns", "By Academic rank" — so "Works the income out
        // from …" in front of it says the same thing twice.
        incomeMethodLabel(p.strategy as IncomeAssumptionStrategy, this.facts());
  });

  constructor() {
    // `membersFor` is a lazily-populated cache that returns `[]` until someone asks for the
    // type. Without this the fact registry is empty, `readLists()` finds nothing, and every
    // product — including the compound one, which reads two lists — reports reading none.
    void this.enums.load('surrogate_fact');
    // The I-Score classes, for the "standard classes" button. A failure only hides it.
    this.lookups
      .list(I_SCORE_CLASS_TYPE)
      .then((rows) => this.iScoreClassBands.set(bandsFromIScoreClasses(rows)))
      .catch(() => this.iScoreClassBands.set([]));
    void this.lookups
      .listTypes()
      .then((s) => this.typeSummaries.set(s))
      // Absent means NOT LOADED, and `deletableType` then answers `true` — the button stays
      // as it was rather than vanishing because a summary call failed.
      .catch(() => this.typeSummaries.set([]));
    void this.load();
    void this.loadAsks();
    void this.loadFixedAsks();
  }

  /**
   * Whether the server will entertain a delete for a type. Absent = not loaded, so the
   * button stays as it was rather than disappearing on an old backend.
   */
  /**
   * A list of CLASSES rather than of answers — it has children filed under it.
   *
   * The axis says which it is, not the name: `hasBoard` marks the child list (the one with
   * a parent), so reading it here would have called the class list "the answers".
   */
  protected isClassList(list: ReadList): boolean {
    return this.enumTypes.childTypesOf(list.type).length > 0;
  }

  protected deletableType(type: string): boolean {
    return this.typeSummaries().find((s) => s.type === type)?.deletable ?? true;
  }

  protected label(p: SurrogateProductDetail): string {
    return this.isAr ? p.labelAr : p.labelEn;
  }

  protected goToStep(index: number): void {
    const next = Math.min(Math.max(index, 0), this.lastStep);
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
    // An old link to the sixth step (Review, before v36.1.0) lands on the last one.
    return Number.isInteger(raw) && raw >= 1 ? Math.min(raw, this.lastStep + 1) - 1 : 0;
  }

  protected markDirty(): void {
    this.otherDirty = true;
    this.dirty.set(true);
    this.saveError.set(null);
  }

  protected onKeyTable(rows: IncomeKeyTableRow[]): void {
    this.ruleKeyTable.set(rows);
    this.markDirty();
  }

  protected onBands(bands: IncomeBand[]): void {
    this.ruleBands.set(bands);
    this.markDirty();
  }

  protected onStepFigures(figures: Record<string, StepFigures>): void {
    this.stepFigures.set(figures);
    this.markDirty();
  }

  // --- the maximum-loan grid every new program starts from ------------------

  /** The grid this product's blueprint declares, or `null` when it declares none. */
  protected readonly productCap = computed<ProductCapShape | null>(
    () => this.product()?.cap ?? null,
  );

  /**
   * The default amounts, in the shape the editor edits.
   *
   * The editor speaks `MaxLoanByFactConfig` because the same control draws a bank's own
   * table; the product stores only the ROWS, since the axes are the blueprint's and are
   * resolved on every read. This wraps and unwraps that one difference in one place.
   */
  protected readonly capConfig = signal<MaxLoanByFactConfig | null>(null);

  protected onCapConfig(config: MaxLoanByFactConfig | null): void {
    this.capConfig.set(config);
    this.capDirty = true;
    this.markDirty();
  }

  /**
   * Whether the grid was touched, so an untouched Save does not write it.
   *
   * A flag rather than a value comparison, because an empty `rows` CLEARS the defaults:
   * "nothing was typed" and "everything was deleted" are the same payload, and only the
   * operator's action tells them apart.
   */
  private capDirty = false;

  private capConfigFromProduct(p: SurrogateProductDetail): MaxLoanByFactConfig | null {
    const cap = p.cap;
    const rows = p.capDefaults ?? [];
    if (cap === null || rows.length === 0) return null;
    return {
      factKey: cap.factKey,
      onNoMatch: cap.onNoMatch,
      rows: rows.map((row) => ({ ...row })),
      ...(cap.columnFactKey !== undefined ? { columnFactKey: cap.columnFactKey } : {}),
      ...(cap.rowVia !== undefined ? { rowVia: cap.rowVia } : {}),
      ...(cap.columnVia !== undefined ? { columnVia: cap.columnVia } : {}),
    };
  }

  /**
   * A value the board or a panel changed can move what the calculation resolves to, so the
   * product is re-read rather than assumed unchanged.
   *
   * TWO things this has to get right now that the figures are typed on this step.
   *
   * (1) UNSAVED FIGURES SURVIVE. The re-read used to overwrite them and clear `dirty`, so
   * adding a compound after typing three amounts discarded all three silently. Adding a
   * value cannot change the rule's STRUCTURE — only the option list behind it — so keeping
   * the edits is safe by construction.
   *
   * (2) THE FACT CACHE IS REFETCHED. `load()` on the enumerations service returns the cache
   * when it has one, so a newly added value never reached `facts()`, never reached the key
   * table's option list, and the row for it could not be added until a hard reload. The
   * server has already re-mirrored the option; the admin is the half that goes stale.
   */
  /**
   * A list on stage changed — from the values panel, or from the class board under it.
   *
   * BOTH ARE RELOADED, whichever raised it, and that is the defect this closes rather than a
   * tidy-up: the two surfaces read the SAME rows through two independent fetches, so filing
   * two compounds into Class AB on the board left the panel above it still holding the rows
   * it fetched on arrival — its class tabs then read `Class AA 2 · Other 69` against a board
   * saying `Class AA 1 · Class AB 3 · Other 67`. A tab is derived from the rows (an empty
   * class is not a tab), so a stale fetch does not merely show a stale count: the class the
   * operator just filed into has no tab at all, which reads as the move not having landed.
   *
   * Silent on purpose. Each surface has already applied its own write — the panel re-read
   * before emitting, the board patched its cards optimistically — so this is the OTHER half
   * catching up, and blanking it to a skeleton would flash a loss neither operation caused.
   */
  protected onListChanged(): void {
    void this.enums.refresh('surrogate_fact');
    void this.load({ silent: true, keepEdits: true });
    void this.valuesPanel()?.reload(undefined, { silent: true });
    void this.classBoard()?.reload({ silent: true });
  }

  protected async save(): Promise<void> {
    const p = this.product();
    if (!p) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      // READ BEFORE THE FIRST WRITE. `absorb` re-seeds the screen from the response and
      // clears `capDirty` with it, so asking afterwards always answered "no" and the second
      // write never fired — the grid took the figures, the Save succeeded, and nothing was
      // stored. Both the flag and the rows are taken here, while they still mean something.
      const capRows = this.capDirty ? (this.capConfig()?.rows ?? []) : null;
      // Same rule, same reason: read while the flag still means something. `undefined` is
      // "not touching it" and `null` is the clear, which is a real operation the server can
      // refuse — so the two must not collapse into one.
      const tenor = this.tenorDirty ? this.tenorFromForm() : undefined;
      // Same rule, same reason: read while the flag still means something. `absorb` below
      // re-seeds the screen and clears it, so asking afterwards always answers "no".
      const plans = this.plansDirty ? this.planValue() : undefined;
      // Same rule, same reason, for the SIZE: `undefined` is "not touching it" and `null` is
      // the clear, which the server can refuse.
      const loanAmounts = this.amountDirty ? this.amountsFromForm() : undefined;
      // Same rule, same reason, for the TIERS: `undefined` is "not touching it" and `null`
      // is the clear, which the server accepts — a cleared table leaves every reader
      // counting the figure in full, which is a priceable quote.
      // Same rule, same reason, for the PRICE: `undefined` is "not touching it" and `null`
      // is the clear, which the server can refuse while programs are priced at it.
      //
      // AND NOT AT ALL once the plan table prices everyone. The boxes are off screen in that
      // state, so a figure typed before the table was made to refuse would otherwise be
      // written by a Save whose effect the operator can no longer see — and it would price
      // nobody either way. A stored rate is left where it is rather than cleared: clearing is
      // a decision, and this is not the screen making it.
      const rate = this.rateDirty && !this.ratePricedByPlans() ? this.rateFromForm() : undefined;
      const iScoreTiers = this.iScoreDirty
        ? this.iScoreTiers().length === 0
          ? null
          : { bands: this.iScoreTiers().map((band) => ({ ...band })) }
        : undefined;

      const res = await this.api.setSurrogateProductIncomeRule(p.key, {
        incomeRule: this.ruleFromForm(),
      });
      this.absorb(res.data);

      // SECOND, and only when it moved. The two live in different columns, and the cap write
      // refuses a product whose blueprint declares no grid — so an unconditional call would
      // fail every product that has none, on a Save that had nothing to do with it.
      if (capRows !== null) {
        const capRes = await this.api.setSurrogateProductCapDefaults(p.key, { rows: capRows });
        this.absorb(capRes.data);
      }

      // THIRD, and only when the boxes moved. Its own column and its own refusal — a clear
      // is rejected while programs are reading it — so folding it into either write above
      // would make a duration edit read as a rule or a grid change in the audit log.
      if (tenor !== undefined) {
        const tenorRes = await this.api.setSurrogateProductTenorDefaults(p.key, { tenor });
        this.absorb(tenorRes.data);
      }

      // FOURTH, and only when the tables moved. Its own column again, and `undefined` is
      // "not touching it" while `null` is the clear — which is a real operation here, and one
      // the server accepts: a cleared table leaves each program on its own rate, floor and
      // share, so nothing stops quoting and nothing needs refusing.
      if (plans !== undefined) {
        const planRes = await this.api.setSurrogateProductPlanDefaults(p.key, { plans });
        this.absorb(planRes.data);
      }

      // FIFTH, and only when the boxes moved. Its own column and its own refusal, exactly as
      // the duration's write above — folding it in would make an amount edit read as a rule
      // change in the audit log.
      if (loanAmounts !== undefined) {
        const amountRes = await this.api.setSurrogateProductLoanAmountDefaults(p.key, {
          loanAmounts,
        });
        this.absorb(amountRes.data);
      }

      // SIXTH, and only when the box moved. Its own column and its own refusal, exactly as
      // the duration's and the size's writes above: a clear is rejected while programs are
      // priced at it, and folding a rate edit into the rule write would make it read as a
      // change to the calculation in the audit log — which a price is not.
      if (rate !== undefined) {
        const rateRes = await this.api.setSurrogateProductRateDefaults(p.key, { rate });
        this.absorb(rateRes.data);
      }

      // SEVENTH, and only when the table moved. Its own column, like the five writes above,
      // and for the reason each of them states: folding a tier edit into the rule write
      // would make it read as a change to the calculation in the audit log, which it is not
      // — the tiers stopped being part of the calculation at v30.3.0.
      if (iScoreTiers !== undefined) {
        const iScoreRes = await this.api.setSurrogateProductIScoreDefaults(p.key, {
          tiers: iScoreTiers,
        });
        this.absorb(iScoreRes.data);
      }
    } catch (err) {
      this.saveError.set(this.localizedError(err));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * The rule to POST.
   *
   * `steps`/`gates`/`output` are sent ONLY when the builder was touched. Untouched, this
   * stays a figures-only write and the server overlays the stored structure
   * (`withStoredStructure`) — which is the behaviour that has to survive, because re-posting
   * a structure the screen merely RENDERED would let a stale tab replace the product itself.
   *
   * All three travel together or none of them do: `withStoredStructure` returns the incoming
   * rule verbatim as soon as any one of the three keys is present, so sending `steps` alone
   * would drop the stored gates and output rather than keeping them.
   */
  /**
   * The duration to POST: the pair, or `null` to clear it.
   *
   * Both or neither by construction — `tenorError` holds Save on a half-stated pair, so by
   * the time this runs the two boxes agree about whether anything was stated.
   */
  private tenorFromForm(): TenorDefaults | null {
    const min = (this.tenorMinValue() ?? '').trim();
    const max = (this.tenorMaxValue() ?? '').trim();
    if (min === '' || max === '') return null;
    return { minMonths: Number(min), maxMonths: Number(max) };
  }

  /**
   * The amounts to PUT, or `null` for the clear.
   *
   * Sent as the STRINGS the operator typed, never `Number`-ed: these are money (Principle I),
   * and a round trip through a float is exactly the precision this platform stores decimals
   * to avoid.
   */
  private amountsFromForm(): LoanAmountDefaults | null {
    const min = (this.amountMinValue() ?? '').trim();
    const max = (this.amountMaxValue() ?? '').trim();
    if (min === '' || max === '') return null;
    return { minAmountEGP: min, maxAmountEGP: max };
  }

  private ruleFromForm(): IncomeAssumptionConfig {
    const strategy = this.ruleGroup.controls.strategy.getRawValue();
    const shape = incomeMethodShape(strategy, this.facts());
    const scalar = this.ruleGroup.controls.scalar.getRawValue();
    return {
      strategy,
      ...(shape === 'keyTable' ? { keyTable: this.ruleKeyTable() } : {}),
      ...(shape === 'bands' ? { bands: this.ruleBands() } : {}),
      ...(shape === 'scalar' && scalar.value
        ? { scalar: { value: scalar.value, unit: scalar.unit } }
        : {}),
      // FIGURES only. Nothing on this screen edits the shape any more, and a write that
      // omits `steps`/`gates`/`output` is exactly what makes the server keep the stored
      // structure (`withStoredStructure`) — the property that stops a stale tab replacing a
      // product it merely rendered.
      ...(shape === 'steps' && Object.keys(this.stepFigures()).length > 0
        ? { stepParams: this.stepFigures() }
        : {}),
      // ALWAYS sent, and `null` when empty. An absent key means "not touching it" on the
      // server (`carryStoredPolicy` keeps what is stored), so there would be no way to clear
      // a cap once typed; `null` is the clear, and the server drops the key before validating
      // it (`dropClearedPolicy`). Never `''` — the DTO refuses that as a non-decimal.
      dbrCapPercentOverride: this.dbrCapValue() ?? null,
    };
  }

  // --- the brackets a published sheet prints --------------------------------

  /**
   * The blueprint behind this product, fetched only when there IS one.
   *
   * Read once per product, not per list tab, and never for a hand-shaped product: a product
   * that came from no library pays nothing for a list it would not use.
   */
  private readonly blueprint = signal<ProductBlueprint | null>(null);

  private async loadBlueprint(key: string): Promise<void> {
    try {
      const res = await this.api.listProductBlueprints();
      this.blueprint.set(res.data.find((blueprint) => blueprint.key === key) ?? null);
    } catch {
      // Step ① works without it — it loses the OFFER of a bracket list, and the operator can
      // still add a band by hand. Not worth failing a screen whose job is the amounts.
      this.blueprint.set(null);
    }
  }

  /**
   * The brackets offered inside each band box, keyed by the slot they belong in.
   *
   * SAME MAPPING as the figures screen, from the same pure module: the doctors' product
   * states one bracket list and three tier columns read it, so an operator setting an amount
   * per tier is offered the six edges rather than retyping them off a photograph three times.
   */
  protected readonly suggestedBands = computed(() => {
    const blueprint = this.blueprint();
    if (blueprint === null) return {};
    return suggestedBandsBySlot(blueprint.suggestedBands, this.ruleSteps());
  });

  private async load(opts: { silent?: boolean; keepEdits?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loading.set(true);
    try {
      const res = await this.api.getSurrogateProduct(this.key);
      this.absorb(res.data, opts.keepEdits === true);
    } catch {
      // The toast interceptor has already said why; the template renders the not-found
      // state off `product() === null`.
      this.product.set(null);
    } finally {
      if (!opts.silent) this.loading.set(false);
    }
  }

  private absorb(data: SurrogateProductDetail, keepEdits = false): void {
    // Read BEFORE the product moves: dirt is measured against the product on screen.
    const keepName = keepEdits && this.nameDirty();
    this.product.set(data);
    if (!keepName) this.nameForm.reset({ labelEn: data.labelEn, labelAr: data.labelAr });
    // The bracket offer, not the figures: `blueprintKey` is what says this product came from
    // the library, and a re-read must not re-fetch a list that cannot have changed.
    const blueprintKey = data.template?.blueprintKey;
    if (blueprintKey !== undefined && this.blueprint()?.key !== blueprintKey) {
      void this.loadBlueprint(blueprintKey);
    }
    // The row is refreshed either way — the lists, the names and the structure all follow
    // the write — but an unsaved figure is the operator's, not the server's.
    if (keepEdits && this.dirty()) return;
    const rule = data.incomeRule;
    this.ruleGroup.reset(
      {
        strategy: rule?.strategy ?? 'declared',
        scalar: { value: rule?.scalar?.value ?? null, unit: rule?.scalar?.unit ?? 'percent' },
        requiredDocuments: [],
        combinationRule: null,
      },
      // Loading a rule is not an edit — without this every load would offer to save what
      // it had just read.
      { emitEvent: false },
    );
    // READ, not cleared. This used to be reset to null on every load while the payload never
    // sent it, so the field was a control over a value the screen could neither see nor write
    // — which is why a product's cap could not be stated at all.
    this.dbrCapValue.set(rule?.dbrCapPercentOverride ?? null);
    this.ruleKeyTable.set(rule?.keyTable ? [...rule.keyTable] : []);
    this.ruleBands.set(rule?.bands ? [...rule.bands] : []);
    // Cloned a level deeper than the two tables: a step's figures are themselves a table or
    // a pair of bounds, and handing the editor the response's own arrays would have it
    // mutate the loaded snapshot in place.
    this.stepFigures.set(
      Object.fromEntries(
        Object.entries(rule?.stepParams ?? {}).map(([id, figures]) => [
          id,
          {
            ...figures,
            ...(figures.keyTable ? { keyTable: figures.keyTable.map((r) => ({ ...r })) } : {}),
            ...(figures.bands ? { bands: figures.bands.map((b) => ({ ...b })) } : {}),
          },
        ]),
      ),
    );
    this.capConfig.set(this.capConfigFromProduct(data));
    this.capDirty = false;
    // Plain signals seeded from the response, never `toSignal(control.valueChanges)`: the
    // cap one field up was written that way once and read back EMPTY over a stored value,
    // because `reset` above runs with `emitEvent: false` and the value never reached the box.
    this.tenorMinValue.set(
      data.tenorDefaults === null ? null : String(data.tenorDefaults.minMonths),
    );
    this.tenorMaxValue.set(
      data.tenorDefaults === null ? null : String(data.tenorDefaults.maxMonths),
    );
    this.tenorDirty = false;
    this.amountMinValue.set(data.loanAmountDefaults?.minAmountEGP ?? null);
    this.amountMaxValue.set(data.loanAmountDefaults?.maxAmountEGP ?? null);
    this.amountDirty = false;
    // The PRICE, seeded from the response for the reason the two above are: which of the two
    // figures the box holds is decided by the stored flag, never by which key happens to be
    // filled — a blob carrying both is one the server refused to write.
    const rate = data.rateDefaults;
    this.rateVariable.set(rate?.isVariableRate ?? false);
    this.rateValue.set(
      rate == null
        ? null
        : ((rate.isVariableRate ? rate.currentEffectiveRatePercent : rate.baseRatePercent) ?? null),
    );
    this.rateNoteValue.set(rate?.variableRateNote ?? null);
    this.rateBasisValue.set(rate?.rateBasis ?? 'reducing');
    this.rateDirty = false;
    this.planValue.set(data.planDefaults);
    this.planBaseline = JSON.stringify(data.planDefaults ?? null);
    this.plansDirty = false;
    // A plain signal seeded from the response, for the reason the duration two fields up
    // spells out: `toSignal(control.valueChanges)` read back EMPTY over a stored value at
    // v26.2.0, because the reset above runs with `emitEvent: false`.
    this.iScoreTiers.set((data.iScoreDefaults?.bands ?? []).map((band) => ({ ...band })));
    this.iScoreDirty = false;
    this.otherDirty = false;
    this.dirty.set(false);
  }

  /**
   * A rejection → the shared error-code vocabulary. Never a per-component English string
   * for a code the backend also reports (A22).
   */
  private localizedError(err: unknown): string {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })?.error;
    return this.errors.toLocalizedMessage(
      (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
      envelope?.meta,
    );
  }
}

/** Nothing picked, nothing typed: the shape an empty table opens in. */
function blankGrid(grid: FactGridConfig): boolean {
  const blankKey = (key: unknown): boolean => {
    if (key === null || key === undefined) return true;
    const k = key as { key?: string; fromInclusive?: string | null; toExclusive?: string | null };
    return (
      (k.key ?? '') === '' &&
      (k.fromInclusive ?? '').toString().trim() === '' &&
      (k.toExclusive ?? '').toString().trim() === ''
    );
  };
  return (
    grid.axes.every((a) => (a.factKey ?? '') === '') &&
    grid.cells.every((c) => (c.value ?? '').trim() === '' && c.keys.every(blankKey))
  );
}
