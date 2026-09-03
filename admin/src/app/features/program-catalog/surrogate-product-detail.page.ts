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
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowLeftOutline,
  CheckOutline,
  ExclamationCircleOutline,
  InfoCircleOutline,
  PoweroffOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { NzInputModule } from 'ng-zorro-antd/input';
import { toSignal } from '@angular/core/rxjs-interop';
import { RailTabsComponent, SkeletonRowsComponent, WizardStepsComponent } from '@shared/ui';
import type { RailTabItem, WizardStepItem } from '@shared/ui';
import { LookupValuesPanelComponent } from '@shared/lookups/lookup-values-panel.component';
import {
  ParentClassBoardComponent,
  type BoardAttention,
} from '@shared/lookups/parent-class-board.component';
import { EnumerationTypesService } from '@shared/lookups/enumeration-types.service';
import { IncomeAssumptionSectionComponent } from '@shared/income-rule/income-assumption-section.component';
import { ProductRuleEditorComponent } from '@shared/income-rule/product-rule-editor.component';
import { listFigureState, type ListFigureState } from '@shared/income-rule/figure-slots';
import { incomeKeyTableErrorFor, productRuleHasError } from '@shared/income-rule/income-rule.rules';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { categoryLabel, isLoanCategory, type LoanCategory } from '@core/loan-category';
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
  type AskWriteResult,
  type ProductAsksBoard,
  type SurrogateProductDetail,
} from '@features/bank-programs/bank-programs.types';
import { PRODUCT_BASE, surrogateBoardLink } from './program-catalog.paths';
import { askInFor, askSections, askStepStatus, askTabs, type AskCard } from './product-asks';

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
}

@Component({
  selector: 'app-surrogate-product-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    ReactiveFormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    SkeletonRowsComponent,
    WizardStepsComponent,
    RailTabsComponent,
    LookupValuesPanelComponent,
    ParentClassBoardComponent,
    IncomeAssumptionSectionComponent,
    ProductRuleEditorComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      CheckOutline,
      ExclamationCircleOutline,
      InfoCircleOutline,
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
          <!-- Where Delete used to sit, one for one: the same position and the same weight
               class, because switching a product off is now the consequential decision on
               this screen. Nothing here deletes anything. -->
          <button
            type="button"
            [class.danger-action]="p.active"
            [class.ghost-action]="!p.active"
            [disabled]="saving()"
            (click)="p.active ? confirmOff() : setActive(true)"
          >
            <span nz-icon nzType="poweroff" nzTheme="outline" aria-hidden="true"></span>
            @if (p.active) {
              <span i18n="@@spd.power.off">Switch this calculation off</span>
            } @else {
              <span i18n="@@spd.power.on">Switch it back on</span>
            }
          </button>
        }
      </div>

      @if (offPending(); as pending) {
        <!-- STATES THE CONSEQUENCE, rather than asking "are you sure". The program codes are
             already on this screen, which is why the confirmation lives here and not in a
             dialog: the operator reads what stops quoting against the list of what quotes. -->
        <div class="notice is-bad" role="alert">
          <p class="notice-title" i18n="@@spd.power.off_title">
            While this is off, nothing quotes from it.
          </p>
          @if (pending.programCodes.length > 0) {
            <p i18n="@@spd.power.off_body">
              {{ pending.names.length }} catalog name(s) take their calculation from this, so the
              {{ pending.programCodes.length }} bank program(s) below stop matching anybody. Offers
              already issued keep their own figures. Nothing is deleted, and you can switch it back
              on at any time.
            </p>
            <ul class="blocked-list">
              @for (code of pending.programCodes; track code) {
                <li class="mono">{{ code }}</li>
              }
            </ul>
          } @else if (pending.names.length > 0) {
            <p i18n="@@spd.power.off_body_names">
              {{ pending.names.length }} catalog name(s) take their calculation from this and will
              work out no income while it is off. No bank quotes from it yet. Nothing is deleted,
              and you can switch it back on at any time.
            </p>
          } @else {
            <p i18n="@@spd.power.off_body_free">
              No catalog name takes its calculation from this yet, so nothing stops quoting. Nothing
              is deleted, and you can switch it back on at any time.
            </p>
          }
          @if (pending.factsAffected.length > 0) {
            <p i18n="@@spd.power.off_body_facts">
              The question it asks stops being read, so each bank's own maximum for that answer
              falls back to whatever the bank chose for an answer it has no row for.
            </p>
          }
          <div class="notice-actions">
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
            <p class="eyebrow" i18n="@@spd.eyebrow">Surrogate product</p>
            <h1 class="title">{{ label(p) }}</h1>
            <p class="lede">{{ lede() }}</p>
          </header>

          <app-wizard-steps
            [steps]="steps()"
            [activeIndex]="stepIndex()"
            [ariaLabel]="stepsAria"
            [caption]="stepCaption()"
            (stepSelect)="goToStep($event)"
          />

          @switch (stepIndex()) {
            @case (0) {
              <section class="panel" [attr.aria-label]="steps()[0]?.label ?? ''">
                <!-- WHICH LOAN TYPE, first. A tick here does two things — this product starts
                     reading the answer, and the loan type on this rail starts asking the
                     question — so the rail is above the grid rather than beside it: the
                     second half of the sentence is decided before the click, not after. -->
                <app-rail-tabs
                  [uniform]="true"
                  idPrefix="spd-asks"
                  [items]="askTabItems()"
                  [activeId]="askCategory()"
                  [ariaLabel]="asksAria"
                  (select)="pickAskCategory($event)"
                />

                <div
                  class="ask-stage"
                  [id]="'spd-asks-panel-' + askCategory()"
                  role="tabpanel"
                  [attr.aria-labelledby]="'spd-asks-tab-' + askCategory()"
                >
                  <p class="hint hint-lede" i18n="@@spd.ask.lede">
                    Tick a question and this product reads its answer. It also starts being asked of
                    {{ askCategoryLabel() }} applicants, so they have an answer to give.
                  </p>

                  @if (askUnpublished()) {
                    <!-- The one outcome a toast would lie about: the tick DID land and the
                         questionnaire version did not, so no applicant is being served the
                         question yet. Stated persistently, because it needs an action. -->
                    <p class="ask-alert" role="alert">
                      <span
                        nz-icon
                        nzType="exclamation-circle"
                        nzTheme="outline"
                        aria-hidden="true"
                      ></span>
                      <span i18n="@@spd.ask.unpublished"
                        >The question is attached, but the questionnaire was not published, so
                        nobody is being asked it yet. Tick it again to retry.</span
                      >
                      <button
                        type="button"
                        class="linkish"
                        (click)="dismissAskAlert()"
                        i18n="@@spd.ask.dismiss"
                      >
                        Dismiss
                      </button>
                    </p>
                  }

                  <div class="ask-controls">
                    <nz-input-group [nzPrefix]="askSearchIcon" class="ask-search">
                      <input
                        nz-input
                        [formControl]="askSearch"
                        placeholder="Search questions"
                        i18n-placeholder="@@spd.ask.search_ph"
                        [attr.aria-label]="askSearchAria"
                      />
                    </nz-input-group>
                    <ng-template #askSearchIcon>
                      <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
                    </ng-template>
                    @if (askSearch.value) {
                      <button
                        type="button"
                        class="linkish"
                        (click)="askSearch.setValue('')"
                        i18n="@@spd.ask.clear"
                      >
                        Clear
                      </button>
                    }
                  </div>

                  <p class="sr-only" role="status" aria-live="polite">{{ askStatus() }}</p>

                  @for (section of askSections(); track section.key) {
                    <section class="ask-sec">
                      <h3 class="ask-sec-title">
                        @switch (section.key) {
                          @case ('asked') {
                            <span i18n="@@spd.ask.sec_asked">Read, and asked here</span>
                          }
                          @case ('unasked') {
                            <span i18n="@@spd.ask.sec_unasked"
                              >Read, but not asked of {{ askCategoryLabel() }} applicants</span
                            >
                          }
                          @default {
                            <span i18n="@@spd.ask.sec_rest">Not read yet</span>
                          }
                        }
                        <span class="ask-sec-count">{{ section.cards.length }}</span>
                      </h3>

                      @if (section.cards.length === 0) {
                        <p class="ask-sec-empty" i18n="@@spd.ask.none_read">
                          Nothing yet — tap a question below and this product reads its answer.
                        </p>
                      } @else {
                        @if (section.key === 'unasked') {
                          <p class="ask-sec-note" i18n="@@spd.ask.unasked_note">
                            This product reads these, but nobody applying for this loan type is
                            asked them, so it gets no answer from them.
                          </p>
                        }
                        @if (section.key === 'asked' && fixedAskCount() > 0) {
                          <!-- Once, for the section, rather than on every card: on a seeded
                               product this is the state of all of them. -->
                          <p class="ask-sec-note" i18n="@@spd.ask.fixed_note">
                            {{ fixedAskCount() }} of these come with the product and cannot be
                            removed here — switch the whole product off instead if it should not be
                            sold.
                          </p>
                        }
                        <ul class="ask-grid" role="list">
                          @for (card of section.cards; track card.code || card.factKey) {
                            <li>
                              @if (section.key === 'unasked') {
                                <!-- NOT a checkbox: this row offers two different acts —
                                     start asking it here, or stop reading it — and nesting a
                                     second control inside a role="checkbox" button is invalid
                                     markup that a screen reader reads as one thing. -->
                                <div class="ask-card is-partial">
                                  <span class="ask-card-head">
                                    <span class="ask-tick is-warn" aria-hidden="true">
                                      <span
                                        nz-icon
                                        nzType="exclamation-circle"
                                        nzTheme="outline"
                                      ></span>
                                    </span>
                                    <span class="ask-label">{{ card.label }}</span>
                                  </span>
                                  <span class="ask-meta">
                                    <span class="ask-type">{{ askTypeLabel(card.type) }}</span>
                                    @if (card.askedIn.length === 0) {
                                      <span class="tag is-warn" i18n="@@spd.ask.nobody"
                                        >Asked of nobody</span
                                      >
                                    } @else {
                                      <span class="muted">{{ askedInLabel(card.askedIn) }}</span>
                                    }
                                  </span>
                                  <span class="ask-acts">
                                    <button
                                      nz-button
                                      nzSize="small"
                                      type="button"
                                      [disabled]="card.saving || askBusy()"
                                      (click)="askHere(card)"
                                      i18n="@@spd.ask.ask_here"
                                    >
                                      Ask it here
                                    </button>
                                    @if (card.detachBlocked) {
                                      <span class="ask-why">{{ detachWhy(card) }}</span>
                                    } @else {
                                      <button
                                        type="button"
                                        class="linkish"
                                        [disabled]="card.saving || askBusy()"
                                        (click)="stopReading(card)"
                                        i18n="@@spd.ask.stop"
                                      >
                                        Stop reading this
                                      </button>
                                    }
                                  </span>
                                </div>
                              } @else {
                                <button
                                  type="button"
                                  class="ask-card"
                                  role="checkbox"
                                  [class.on]="card.read"
                                  [class.is-blocked]="!!card.blocked || !!card.detachBlocked"
                                  [attr.aria-checked]="card.read"
                                  [attr.aria-disabled]="!!card.blocked || !!card.detachBlocked"
                                  [attr.aria-describedby]="
                                    card.blocked || card.detachBlocked
                                      ? 'spd-why-' + card.code
                                      : null
                                  "
                                  [attr.aria-label]="askCardAria(card)"
                                  [attr.aria-busy]="card.saving || askBusy()"
                                  (click)="toggleAsk(card)"
                                >
                                  <span class="ask-card-head">
                                    <span class="ask-tick" aria-hidden="true">
                                      @if (card.read) {
                                        <span nz-icon nzType="check" nzTheme="outline"></span>
                                      }
                                    </span>
                                    <span class="ask-label">{{ card.label }}</span>
                                  </span>
                                  <span class="ask-meta">
                                    <span class="ask-type">{{ askTypeLabel(card.type) }}</span>
                                    @if (card.questionInactive) {
                                      <span class="tag is-warn" i18n="@@spd.ask.off"
                                        >The question is switched off</span
                                      >
                                    }
                                    @if (card.readByRule) {
                                      <span class="tag" i18n="@@spd.ask.in_calc"
                                        >In the calculation</span
                                      >
                                    }
                                    @if (card.detachBlocked) {
                                      <span class="tag" [id]="'spd-why-' + card.code">{{
                                        detachTag(card)
                                      }}</span>
                                    }
                                    @if (card.alsoAskedBy.length > 0) {
                                      <span class="muted">{{
                                        alsoAskedLabel(card.alsoAskedBy)
                                      }}</span>
                                    }
                                  </span>
                                  <!-- The REASON A TICK WOULD DO NOTHING, in full: it is the
                                       whole information such a card carries, each reason has
                                       a different fix, and the operator is reading it because
                                       they just tried. Visible and inked at full contrast —
                                       an opacity low enough to read as unavailable puts it
                                       under 4.5:1, so what recedes is the affordance.

                                       The reason an UNTICK is refused is a TAG instead, above:
                                       on a seeded product that is every card, and the same
                                       three lines repeated down a grid stops being read at
                                       the second one. The sentence is stated once for the
                                       section. -->
                                  @if (card.blocked) {
                                    <span class="ask-why" [id]="'spd-why-' + card.code">{{
                                      blockedWhy(card)
                                    }}</span>
                                  }
                                </button>
                              }
                            </li>
                          }
                        </ul>
                      }
                    </section>
                  }
                </div>

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
                      @if (!list.owned) {
                        <!-- On the LIST it is about, not as a count in a header sentence
                             covering all four: the consequence is this list's, and an operator
                             reads it at the moment they are about to type into it. -->
                        <p class="hint" i18n="@@spd.list_shared_one">
                          This list is shared with other products — editing it reaches every
                          calculation that reads it.
                        </p>
                      }

                      <app-lookup-values-panel
                        [type]="list.type"
                        [title]="list.title"
                        [description]="list.description"
                        [deletable]="deletableType(list.type)"
                        (changed)="onListChanged()"
                      />

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
                            <p class="defaults-note" i18n="@@spd.def.priced_by_class">
                              These answers are not priced one by one. Each carries the amount of
                              the class it is filed under, and that is where the figures are set.
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
                        <details class="structure" [open]="boardNeedsAttention()">
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
            @case (1) {
              <section class="panel" [attr.aria-label]="steps()[1]?.label ?? ''">
                @if (hasTemplate()) {
                  <!-- Authored through the form: say what it does in words, and offer the
                       form. The steps stay reachable below, but they are not the door. -->
                  <div class="from-form">
                    <p class="from-form-lede">
                      <span i18n="@@spd.form.lede"
                        >This calculation was built from a form, so it can be changed by answering
                        the same questions again.</span
                      >
                    </p>
                    <a
                      class="from-form-cta"
                      [routerLink]="[productBase, key, 'calculation']"
                      i18n="@@spd.form.edit"
                      >Change how the income is worked out</a
                    >
                  </div>
                } @else if (isPipeline()) {
                  <p class="notice" role="status">
                    <span i18n="@@spd.form.handbuilt"
                      >This calculation was built step by step rather than from a form, so there is
                      no form to open for it.</span
                    >
                  </p>
                }

                @if (!isPipeline()) {
                  <p class="notice" role="status">
                    <span i18n="@@spd.structure.offer">
                      This product works its income out from a single figure. Answer three questions
                      and we will build the calculation for you.
                    </span>
                    <a
                      class="linkish"
                      [routerLink]="[productBase, key, 'calculation']"
                      i18n="@@spd.structure.form"
                      >Build it from a form</a
                    >
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

                <p class="reach">
                  @if (p.usedBy.length === 0) {
                    <span i18n="@@spd.reach_none"
                      >Nothing sells this yet, so a change here reaches no bank.</span
                    >
                  } @else {
                    <span i18n="@@spd.reach"
                      >A change here reaches {{ p.usedBy.length }} catalog name(s) and every bank
                      program under them that takes catalog amounts.</span
                    >
                  }
                </p>

                <ng-container [ngTemplateOutlet]="ruleActions"></ng-container>
              </section>
            }

            @case (2) {
              <section class="panel" [attr.aria-label]="steps()[2]?.label ?? ''">
                @if (p.names.length === 0) {
                  <p class="notice">
                    <span nz-icon nzType="info-circle" nzTheme="outline"></span>
                    <span i18n="@@spd.uses_none"
                      >No catalog program name takes its calculation from this product yet. Link one
                      from the program catalog, and every bank filing a program under that name
                      quotes from here.</span
                    >
                  </p>
                } @else {
                  <ul class="names" role="list">
                    @for (n of p.names; track n.key) {
                      <li class="name">
                        <a class="name-key" [routerLink]="['/program-catalog', n.key]">{{
                          n.key
                        }}</a>
                        @if (n.programs.length === 0) {
                          <span class="muted" i18n="@@spd.no_programs"
                            >No bank offers this name yet</span
                          >
                        } @else {
                          <ul class="programs" role="list">
                            @for (prog of n.programs; track prog.programCode) {
                              <li>
                                <span class="code">{{ prog.programCode }}</span>
                                @if (!prog.ownAmounts) {
                                  <span class="tag" i18n="@@spd.takes_catalog"
                                    >takes these amounts</span
                                  >
                                }
                              </li>
                            }
                          </ul>
                        }
                      </li>
                    }
                  </ul>
                }
              </section>
            }
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
              [disabled]="stepIndex() === 2"
              (click)="goToStep(stepIndex() + 1)"
            >
              {{ nextLabel() }}
            </button>
          </nav>
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

      <div class="actions">
        <p class="save-hint" i18n="@@spd.save_hint">
          One Save covers every amount on this product, on both steps.
        </p>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!dirty() || saving() || ruleBlocked()"
          [nzLoading]="saving()"
          (click)="save()"
        >
          <span i18n="@@spd.save">Save the calculation</span>
        </button>
      </div>
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
        outline: none;
        box-shadow: var(--focus-halo);
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

      .eyebrow {
        margin: 0;
        font-size: var(--text-xs);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }

      .title {
        margin: 0;
        font-family: var(--font-display);
        font-size: var(--text-2xl);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }

      .lede {
        margin: 0;
        max-inline-size: 62ch;
        font-size: var(--text-base);
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-6);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }

      /* Step 1 renders the shared income section, which draws its own bordered
         surface — so on a phone the operator paid for two frames at once: 32px of
         panel and 16px of section on each side left 228px of a 390px screen for the
         figures being edited. The panel keeps the border (it is what separates the
         stage from the rail) and gives up the inset. */
      @media (max-width: 640px) {
        .panel {
          gap: var(--space-5);
          padding: var(--space-4);
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
      .from-form {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }
      .from-form-lede {
        margin: 0;
        flex: 1 1 20rem;
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }
      .from-form-cta {
        display: inline-flex;
        align-items: center;
        min-block-size: var(--size-field);
        padding-inline: var(--space-4);
        border-radius: var(--radius-field);
        background: var(--primary);
        color: var(--text-on-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        text-decoration: none;
      }
      .from-form-cta:hover {
        background: var(--primary-hover);
      }
      .from-form-cta:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }
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
      .danger-action,
      .ghost-action {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: var(--size-field);
        padding-inline: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font: inherit;
        font-size: var(--text-sm);
        cursor: pointer;
      }
      .danger-action:hover:not(:disabled) {
        border-color: var(--error);
        color: var(--error);
      }
      .danger-action.solid {
        background: var(--error);
        border-color: var(--error);
        color: var(--text-on-accent, #fff);
      }
      .danger-action:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .danger-action:focus-visible,
      .ghost-action:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .notice-title {
        margin: 0;
        font-weight: 600;
      }
      .blocked-list {
        margin: 0;
        padding-inline-start: var(--space-5);
        font-size: var(--text-sm);
      }
      .notice-actions {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
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
        font-size: var(--text-sm);
        color: var(--text-tertiary);
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
      .actions {
        display: flex;
        align-items: baseline;
        justify-content: flex-end;
        gap: var(--space-4);
        flex-wrap: wrap;
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--border-subtle);
      }

      .save-hint {
        margin: 0;
        margin-inline-end: auto;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }

      .names {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      .name {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding-inline-start: var(--space-4);
        border-inline-start: var(--rule-width-accent) solid var(--border-default);
      }

      .name-key {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--primary-visible);
        text-decoration: none;
        cursor: pointer;
        align-self: flex-start;
      }

      .name-key:hover {
        text-decoration: underline;
      }

      .name-key:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-radius: var(--radius-sm);
      }

      .programs {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .programs li {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }

      .code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
      }

      .tag {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      }

      .muted {
        font-size: var(--text-sm);
        color: var(--text-tertiary);
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
        color: var(--text-tertiary);
      }

      .mono {
        font-family: var(--font-mono);
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
        color: var(--text-tertiary);
      }

      /* --- the ask board -----------------------------------------------------
         Same vocabulary as the catalog name's scoring grid, deliberately: the two
         screens ask the operator for the same GESTURE, and a second look for it
         would read as a second kind of act. */

      .ask-stage {
        margin-block-start: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .hint-lede {
        max-inline-size: 72ch;
        /* Secondary, not tertiary: this sentence states the SECOND half of what a tick
           does, and tertiary ink on this ground measures under 4.5:1 in light mode. */
        color: var(--color-text-secondary);
        line-height: var(--leading-relaxed);
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
        font-size: var(--text-sm);
      }

      .ask-controls {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .ask-search {
        max-inline-size: 24rem;
      }

      .ask-sec {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .ask-sec-title {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }

      .ask-sec-count {
        font-size: var(--text-sm);
        font-weight: 700;
        letter-spacing: normal;
        color: var(--color-text-primary);
      }

      .ask-sec-empty,
      .ask-sec-note {
        margin: 0;
        max-inline-size: 72ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .ask-grid {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--space-3);
      }

      .ask-card {
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
        border-style: dashed;
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

      .ask-card.is-blocked .ask-tick {
        border-style: dashed;
      }

      .ask-tick.is-warn {
        border-color: var(--color-warning);
        color: var(--color-warning);
      }

      .ask-label {
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .ask-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .ask-type {
        color: var(--color-text-secondary);
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

      .ask-why {
        font-size: var(--text-xs);
        line-height: var(--leading-relaxed);
        /* Live ink, measured: this is the whole information the card carries. */
        color: var(--color-text-secondary);
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
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly lookups = inject(LookupsApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

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
    dbrCapPercentOverride: new FormControl<string | null>(null),
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
  protected readonly ruleBlocked = computed(() => {
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

  /** Which loan type's tab is open. Decides what a tick will start asking. */
  protected readonly askCategory = signal<LoanCategory>('personal');

  protected readonly askSearch = new FormControl<string>('', { nonNullable: true });
  private readonly askQuery = toSignal(this.askSearch.valueChanges, { initialValue: '' });

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
  /** Set when a tick landed and the questionnaire publish did not. */
  protected readonly askUnpublished = signal(false);
  protected readonly askStatus = signal('');

  protected readonly asksAria = $localize`:@@spd.ask.rail_aria:Loan type`;
  protected readonly askSearchAria = $localize`:@@spd.ask.search_aria:Search questions`;

  private askInput() {
    return {
      board: this.asksBoard(),
      category: this.askCategory(),
      search: this.askQuery(),
      isAr: this.isAr,
      attaching: this.attaching(),
      detaching: this.detaching(),
    };
  }

  protected readonly askSections = computed(() => askSections(this.askInput()));

  protected readonly askTabItems = computed<RailTabItem[]>(() =>
    askTabs(this.asksBoard()).map((tab) => ({
      id: tab.id,
      label: categoryLabel(tab.id),
      count: tab.reads,
      countLabel: $localize`:@@spd.ask.tab_count:answers read`,
      // The warn accent is for the state that makes the product quote nothing HERE: it reads
      // a fact this loan type never asks. A loan type that reads nothing at all is not
      // warned about — a product not sold as a mortgage is the normal case.
      warn: tab.unasked > 0 && tab.reads > 0,
      warnLabel:
        tab.unasked > 0 && tab.reads > 0
          ? $localize`:@@spd.ask.tab_warn:${tab.unasked}:COUNT: read but not asked here`
          : undefined,
    })),
  );

  protected readonly askCategoryLabel = computed(() => categoryLabel(this.askCategory()));

  protected pickAskCategory(id: string): void {
    if (!isLoanCategory(id)) return;
    this.askCategory.set(id);
    // Mirrored onto the URL beside `?step=`, so a pasted link and a reload land on the loan
    // type the operator was looking at. `replaceUrl`, or flipping tabs fills the back button
    // with filter states.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { loan: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected askTypeLabel(type: AskQuestionType | null): string {
    switch (type) {
      case 'SINGLE_SELECT':
        return $localize`:@@spd.ask.t_one:One of a list`;
      case 'NUMERIC':
        return $localize`:@@spd.ask.t_number:A number they type`;
      case 'MULTI_SELECT':
        return $localize`:@@spd.ask.t_many:Several answers`;
      case 'TEXT':
        return $localize`:@@spd.ask.t_text:Free text`;
      default:
        return $localize`:@@spd.ask.t_unknown:Unknown`;
    }
  }

  /**
   * Why a question cannot be read as an answer.
   *
   * One sentence per reason, because the FIXES differ — a free-text answer is not a key any
   * bank can list in advance, while the declared salary is the very figure a no-payslip
   * product exists not to read. A single "this one won't work" would tell the operator
   * nothing to act on.
   */
  protected blockedWhy(card: AskCard): string {
    switch (card.blocked) {
      case 'text':
        return $localize`:@@spd.ask.why_text:Free text — a bank cannot key a table by an answer nobody can list in advance.`;
      case 'multi_select':
        return $localize`:@@spd.ask.why_multi:More than one answer — there is no single value to look a figure up against.`;
      case 'money_binding':
        return $localize`:@@spd.ask.why_money:This is part of what the customer is asking for, or the salary they declared — not something about them a bank can price without a payslip.`;
      case 'obligation_item':
        return $localize`:@@spd.ask.why_obligation:One of the customer's existing debts. Debt only means something as a total, so a bank cannot work an income out from one of them.`;
      case 'bank_axis':
      case 'debt_types':
        return $localize`:@@spd.ask.why_axis:The platform works this one out per bank, so a product cannot read it as an answer.`;
      default:
        return '';
    }
  }

  /**
   * The untick state, as a chip.
   *
   * Two or three words, not the sentence: on a seeded product every ask is the library's, so
   * the sentence would repeat down the whole grid — three identical lines per card, which
   * stops being read at the second one. The sentence is stated once, for the section.
   */
  protected detachTag(card: AskCard): string {
    switch (card.detachBlocked) {
      case 'blueprint_owned':
        return $localize`:@@spd.ask.tag_fixed:comes with the product`;
      case 'read_by_own_rule':
        return $localize`:@@spd.ask.tag_in_rule:the calculation reads it`;
      case 'fact_still_read':
        return $localize`:@@spd.ask.tag_in_use:a bank reads it`;
      default:
        return '';
    }
  }

  /** How many of the asks on stage came with the product. Drives the section's one note. */
  protected readonly fixedAskCount = computed(
    () =>
      this.askSections()
        .find((section) => section.key === 'asked')
        ?.cards.filter((card) => card.detachBlocked === 'blueprint_owned').length ?? 0,
  );

  /** Why an untick is refused, and what to do instead. */
  protected detachWhy(card: AskCard): string {
    switch (card.detachBlocked) {
      case 'blueprint_owned':
        return $localize`:@@spd.ask.why_blueprint:This question comes with the product, so it cannot be removed here. Switch the whole product off instead if it should not be sold.`;
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
      : $localize`:@@spd.ask.aria_read:Read ${name}:NAME: and ask it of ${this.askCategoryLabel()}:TYPE: applicants`;
  }

  /**
   * The tick.
   *
   * An early return rather than `[disabled]`, the rule this page's sibling states: a disabled
   * button leaves the tab order mid-keyboard-pass, and the reason bound to it by
   * `aria-describedby` is then announced to nobody.
   */
  protected toggleAsk(card: AskCard): void {
    if (card.blocked || card.detachBlocked || card.saving || this.askBusy()) return;
    if (card.read) void this.runDetach(card);
    else void this.runAttach(card, askInFor(this.askCategory()));
  }

  /** Start asking a question this product already reads of the loan type on the rail. */
  protected askHere(card: AskCard): void {
    if (card.saving || this.askBusy()) return;
    void this.runAttach(card, askInFor(this.askCategory()));
  }

  protected stopReading(card: AskCard): void {
    if (card.detachBlocked || card.saving || this.askBusy()) return;
    void this.runDetach(card);
  }

  protected dismissAskAlert(): void {
    this.askUnpublished.set(false);
  }

  private async runAttach(card: AskCard, askIn: readonly LoanCategory[]): Promise<void> {
    if (card.code === '') return;
    this.markAttaching(card.code, true);
    this.askBusy.set(true);
    try {
      const res = await this.api.attachProductAsk(this.key, card.code, askIn);
      this.absorbAskWrite(res.data);
      this.askStatus.set(
        $localize`:@@spd.ask.said_read:${card.label}:NAME: is now read by this product`,
      );
    } catch {
      // The interceptor has already said why (A22). Dropping the overlay restores the
      // derived truth, so there is nothing to roll back.
      this.askUnpublished.set(false);
    } finally {
      this.markAttaching(card.code, false);
      this.askBusy.set(false);
    }
  }

  private async runDetach(card: AskCard): Promise<void> {
    if (card.factKey === '') return;
    this.markDetaching(card.factKey, true);
    this.askBusy.set(true);
    try {
      const res = await this.api.detachProductAsk(this.key, card.factKey);
      this.absorbAskWrite(res.data);
      this.askStatus.set(
        $localize`:@@spd.ask.said_stopped:${card.label}:NAME: is no longer read by this product`,
      );
    } catch {
      // Same posture as the attach.
    } finally {
      this.markDetaching(card.factKey, false);
      this.askBusy.set(false);
    }
  }

  /**
   * Absorb one write's board, and re-read what depends on it.
   *
   * `refresh`, never `load`, on the fact cache: `load()` returns whatever is cached, so
   * without this the new fact would be invisible to step ②'s method picker for the rest of
   * the session — the exact bug v19.0.0 recorded. And the product itself is re-read because
   * a new fact can bring a LIST on stage below the grid, with `keepEdits` so an unsaved
   * figure survives it.
   */
  private absorbAskWrite(result: AskWriteResult): void {
    this.asksBoard.set(result.state);
    this.askUnpublished.set(result.changed.widened.length > 0 && !result.changed.published);
    void this.enums.refresh('surrogate_fact');
    void this.enumTypes.refresh();
    void this.load({ silent: true, keepEdits: true });
  }

  private markAttaching(code: string, on: boolean): void {
    const next = new Set(this.attaching());
    if (on) next.add(code);
    else next.delete(code);
    this.attaching.set(next);
  }

  private markDetaching(factKey: string, on: boolean): void {
    const next = new Set(this.detaching());
    if (on) next.add(factKey);
    else next.delete(factKey);
    this.detaching.set(next);
  }

  private async loadAsks(): Promise<void> {
    try {
      const res = await this.api.getProductAsks(this.key);
      this.asksBoard.set(res.data);
    } catch {
      // The board stays null and step ① renders its empty state; the toast has said why.
      this.asksBoard.set(null);
    }
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
      out.push({
        type,
        title: this.enumTypes.label(type, this.isAr),
        description,
        hasBoard,
        owned: owned.has(type),
        // One join, stated in a pure module and shared with the editor that renders the
        // boxes — derived twice, the two would disagree the first time a pick carried two
        // columns keyed by different facts, and disagree silently.
        figures: listFigureState(steps, gates, facts, type).state,
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
   * What the filing board says needs a human — `null` until it has loaded.
   *
   * The board owns the answer (it is the only thing that has fetched both lists), so this is
   * reported rather than re-derived: a second count taken from a different fetch would
   * disagree with the notices inside the board the moment somebody moved a value.
   */
  protected readonly boardAttention = signal<BoardAttention | null>(null);

  /**
   * The fold opens itself only when something is WRONG — an unfiled value quotes nothing, a
   * catch-all value may be quoting a figure nobody chose. A board with nothing to report
   * stays shut, which is what keeps the closed state meaningful: it opening IS the signal.
   */
  protected readonly boardNeedsAttention = computed(() => {
    const a = this.boardAttention();
    return a !== null && (a.unfiled > 0 || a.inFallback > 0);
  });

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

  protected readonly stepIndex = signal<number>(this.initialStep());

  private readonly stepLabels = [
    $localize`:@@spd.step_asks:What it asks`,
    $localize`:@@spd.step_rule:How the income is worked out`,
    $localize`:@@spd.step_uses:Who uses it`,
  ];

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
        id: 'asks',
        // Step ① carries the amounts keyed by each list, so an unsaved edit is as much this
        // step's as step ②'s — it is one object, saved by one button on both.
        label: this.stepLabels[0] ?? '',
        // `invalid` is reachable here now, and it is a strict improvement: a product whose
        // only fact is asked in NO loan type used to read `done` and could never quote.
        status: askStepStatus(this.asksBoard(), this.dirty()),
      },
      {
        id: 'rule',
        label: this.stepLabels[1] ?? '',
        status: this.dirty() ? 'invalid' : p?.strategy ? 'done' : 'todo',
      },
      {
        id: 'uses',
        label: this.stepLabels[2] ?? '',
        status: (p?.usedBy.length ?? 0) > 0 ? 'done' : 'todo',
      },
    ];
  });

  protected readonly stepCaption = computed(() => {
    switch (this.stepIndex()) {
      case 0:
        return $localize`:@@spd.cap_asks:The questions this product puts to the applicant, the answers they pick from, the classes a bank keys its table by, and the amount each one carries.`;
      case 1:
        return $localize`:@@spd.cap_rule:What the bank reads instead of a payslip, and the figures every bank filing under this product starts from.`;
      default:
        return $localize`:@@spd.cap_uses:Every catalog name selling this product, and the bank programs underneath.`;
    }
  });

  protected readonly nextLabel = computed(
    () => this.stepLabels[Math.min(this.stepIndex() + 1, 2)] ?? '',
  );

  protected readonly lede = computed(() => {
    const p = this.product();
    if (!p) return '';
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
    void this.lookups
      .listTypes()
      .then((s) => this.typeSummaries.set(s))
      // Absent means NOT LOADED, and `deletableType` then answers `true` — the button stays
      // as it was rather than vanishing because a summary call failed.
      .catch(() => this.typeSummaries.set([]));
    void this.load();
    void this.loadAsks();
    // In the constructor, because `takeUntilDestroyed` needs an injection context.
    this.watchAskCategory();
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

  protected askedInLabel(cats: readonly LoanCategory[]): string {
    return cats.map((c) => categoryLabel(c)).join(' · ');
  }

  protected label(p: SurrogateProductDetail): string {
    return this.isAr ? p.labelAr : p.labelEn;
  }

  protected goToStep(index: number): void {
    const next = Math.min(Math.max(index, 0), 2);
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
    return Number.isInteger(raw) && raw >= 1 && raw <= 3 ? raw - 1 : 0;
  }

  /**
   * The loan type step ①'s rail opens on, from `?loan=`.
   *
   * The signal is the truth and the URL is a copy of it (mirrored with `replaceUrl`, so
   * flipping tabs does not fill the back button with filter states) — the same posture
   * `?step=` takes here and on the catalog name's page. An unknown value falls back rather
   * than throwing: it is a URL somebody typed.
   *
   * SUBSCRIBED, not read once from the snapshot, and that is not a nicety. Angular REUSES
   * this component when only the query string changes, so a constructor-time read leaves the
   * rail on `personal` while the URL says `business` — measured in a browser, where the tab
   * strip said "6 read but not asked here" and the grid below it, still on the old category,
   * showed all seven as asked. Two halves of one screen disagreeing about which loan type is
   * open. This also makes the back button work.
   */
  private watchAskCategory(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const raw = params.get('loan');
      this.askCategory.set(raw !== null && isLoanCategory(raw) ? raw : 'personal');
    });
  }

  protected markDirty(): void {
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
  protected onListChanged(): void {
    void this.enums.refresh('surrogate_fact');
    void this.load({ silent: true, keepEdits: true });
  }

  protected async save(): Promise<void> {
    const p = this.product();
    if (!p) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const res = await this.api.setSurrogateProductIncomeRule(p.key, {
        incomeRule: this.ruleFromForm(),
      });
      this.absorb(res.data);
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
    };
  }

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
    this.product.set(data);
    // The row is refreshed either way — the lists, the names and the structure all follow
    // the write — but an unsaved figure is the operator's, not the server's.
    if (keepEdits && this.dirty()) return;
    const rule = data.incomeRule;
    this.ruleGroup.reset(
      {
        strategy: rule?.strategy ?? 'declared',
        scalar: { value: rule?.scalar?.value ?? null, unit: rule?.scalar?.unit ?? 'percent' },
        dbrCapPercentOverride: null,
        requiredDocuments: [],
        combinationRule: null,
      },
      // Loading a rule is not an edit — without this every load would offer to save what
      // it had just read.
      { emitEvent: false },
    );
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
