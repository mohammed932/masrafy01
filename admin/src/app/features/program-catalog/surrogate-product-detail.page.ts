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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  ArrowLeftOutline,
  DeleteOutline,
  ExclamationCircleOutline,
  InfoCircleOutline,
  PlusOutline,
} from '@ant-design/icons-angular/icons';
import { SkeletonRowsComponent, WizardStepsComponent } from '@shared/ui';
import type { WizardStepItem } from '@shared/ui';
import { LookupValuesPanelComponent } from '@shared/lookups/lookup-values-panel.component';
import { ParentClassBoardComponent } from '@shared/lookups/parent-class-board.component';
import { EnumerationTypesService } from '@shared/lookups/enumeration-types.service';
import { IncomeAssumptionSectionComponent } from '@shared/income-rule/income-assumption-section.component';
import { ProductRuleBuilderComponent } from '@shared/income-rule/product-rule-builder.component';
import { productRuleHasError } from '@shared/income-rule/income-rule.rules';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { categoryLabel, type LoanCategory } from '@core/loan-category';
import {
  LookupsApiService,
  type EnumerationTypeSummary,
} from '@features/lookups/lookups.api.service';
import { QuestionnaireApiService } from '@features/questionnaire/questionnaire.api.service';
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
  type SurrogateProductDetail,
} from '@features/bank-programs/bank-programs.types';

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
}

/** One thing this product asks the applicant: a question, its fact, and the list behind it. */
interface AskedThing {
  readonly factKey: string;
  readonly questionLabel: string;
  readonly questionCode: string;
  /** `true` for a figure the applicant types, `false` for a pick from a list. */
  readonly numeric: boolean;
  /** Empty when the question is asked of nobody — the product can never quote. */
  readonly askedIn: readonly LoanCategory[];
  readonly listType: string | null;
  /** The question is bound but inactive: it exists and is asked of no one. */
  readonly inactive: boolean;
}

@Component({
  selector: 'app-surrogate-product-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ProductRuleBuilderComponent,
    RouterLink,
    ReactiveFormsModule,
    NzButtonModule,
    NzIconModule,
    SkeletonRowsComponent,
    WizardStepsComponent,
    LookupValuesPanelComponent,
    ParentClassBoardComponent,
    IncomeAssumptionSectionComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      DeleteOutline,
      ExclamationCircleOutline,
      InfoCircleOutline,
      PlusOutline,
    ]),
  ],
  template: `
    <section class="page">
      <div class="chrome">
        <a class="back" routerLink="/surrogate-products">
          <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@spd.back">All surrogate products</span>
        </a>
        @if (product()) {
          <button type="button" class="danger-action" (click)="confirmDelete()">
            <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@spd.delete">Delete this product</span>
          </button>
        }
      </div>

      @if (deleteBlocked(); as blocked) {
        <div class="notice is-bad" role="alert">
          <p class="notice-title" i18n="@@spd.delete.blocked.title">
            This product is being sold. Deleting it destroys more than the calculation.
          </p>
          <p i18n="@@spd.delete.blocked.body">
            {{ blocked.names.length }} catalog name(s) would be unlinked and
            {{ blocked.programCodes.length }} bank program(s) would be deleted outright. Customer
            offers already issued keep their own figures and are not touched.
          </p>
          <ul class="blocked-list">
            @for (code of blocked.programCodes; track code) {
              <li class="mono">{{ code }}</li>
            }
          </ul>
          <div class="notice-actions">
            <button
              type="button"
              class="ghost-action"
              (click)="cancelDelete()"
              i18n="@@common.cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              class="danger-action solid"
              [disabled]="deleting()"
              (click)="doDelete(true)"
              i18n="@@spd.delete.confirm"
            >
              Delete it and everything listed
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
                @if (askedThings().length === 0) {
                  <!-- Stated, never an empty section. This is also the one empty state on
                     the screen that is a real problem: a no-payslip product that asks
                     nothing has no answer to work an income out from. -->
                  <p class="notice is-warn" role="status">
                    <span nz-icon nzType="info-circle" nzTheme="outline"></span>
                    <span i18n="@@spd.asks_none"
                      >This product asks the applicant nothing yet, so there is no answer for it to
                      work an income out from. Add the first thing it reads.</span
                    >
                  </p>
                } @else {
                  <ul class="asks" role="list">
                    @for (thing of askedThings(); track thing.factKey) {
                      <li class="ask">
                        <p class="ask-q">{{ thing.questionLabel }}</p>
                        <p class="ask-meta">
                          @if (thing.numeric) {
                            <span class="tag" i18n="@@spd.ask.number">A number they type</span>
                          } @else {
                            <span class="tag" i18n="@@spd.ask.choice">One of a list</span>
                          }
                          @if (thing.askedIn.length === 0) {
                            <span class="tag is-warn" i18n="@@spd.ask.unasked"
                              >Asked of nobody</span
                            >
                          } @else {
                            <span class="muted">{{ askedInLabel(thing.askedIn) }}</span>
                          }
                          @if (thing.inactive) {
                            <span class="tag is-warn" i18n="@@spd.ask.inactive"
                              >The question is switched off</span
                            >
                          }
                        </p>
                        <div class="ask-foot">
                          <span class="ask-key mono">{{ thing.factKey }}</span>
                          <span class="ask-acts">
                            <a
                              class="linkish"
                              routerLink="/questionnaire/questions"
                              i18n="@@spd.ask.edit"
                              >Edit the wording</a
                            >
                            <button
                              type="button"
                              class="linkish is-danger"
                              [disabled]="removing() === thing.factKey"
                              (click)="removeAsk(thing)"
                            >
                              <span i18n="@@spd.ask.remove">Remove</span>
                            </button>
                          </span>
                        </div>
                      </li>
                    }
                  </ul>
                }

                @if (askError(); as message) {
                  <p class="notice is-bad" role="alert">
                    <span nz-icon nzType="exclamation-circle" nzTheme="outline"></span>
                    <span>{{ message }}</span>
                  </p>
                }

                <div class="actions">
                  <button nz-button nzType="default" type="button" (click)="addAsk()">
                    <span nz-icon nzType="plus" nzTheme="outline"></span>
                    <span i18n="@@spd.ask.add">Add something it asks</span>
                  </button>
                </div>

                @if (readLists().length > 0) {
                  <h2 class="sub" i18n="@@spd.lists_title">The answers they pick from</h2>
                  @if (borrowedCount() > 0) {
                    <p class="hint" i18n="@@spd.lists_shared">
                      {{ borrowedCount() }} of these list(s) are shared with other products —
                      editing one reaches every calculation that reads it.
                    </p>
                  }
                  @for (list of readLists(); track list.type) {
                    <app-lookup-values-panel
                      [type]="list.type"
                      [title]="list.title"
                      [description]="list.description"
                      [deletable]="deletableType(list.type)"
                      (changed)="onListChanged()"
                    />
                  }

                  @if (boardList(); as board) {
                    <app-parent-class-board
                      [childType]="board.type"
                      [parentType]="board.parentType"
                      (changed)="onListChanged()"
                    />
                  }
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
                      [routerLink]="['/surrogate-products', key, 'calculation']"
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
                    <a class="linkish" routerLink="/surrogate-products/new" i18n="@@spd.form.start"
                      >Start a new product from a shape</a
                    >
                  </p>
                }

                @if (isPipeline()) {
                  @if (hasTemplate() && !rawStepsShown()) {
                    <!-- A form-built product is changed BY the form, so the raw steps are not
                         on stage. Read cold they are fourteen unexplained rows whose only
                         offered action is one-way, while the plain-language flow further down
                         already says what the calculation does. Withheld, never removed: a
                         product that outgrows the seven shapes still has to have a door. -->
                    <p class="notice" role="status">
                      <span i18n="@@spd.structure.hidden"
                        >The steps behind this calculation are hidden. Change it from the form above
                        — the list further down says what it works out, in words.</span
                      >
                      <button type="button" class="linkish" (click)="revealRawSteps()">
                        <span i18n="@@spd.structure.reveal">Show the raw steps</span>
                      </button>
                    </p>
                  } @else {
                    <details class="structure" [open]="structureOpen()">
                      <summary (click)="toggleStructure($event)">
                        <span i18n="@@spd.structure.title">The steps this product runs</span>
                        <span class="structure-count">{{ ruleSteps().length }}</span>
                      </summary>
                      @if (hasTemplate()) {
                        <!-- Stated where the damage would happen, not in a modal after the
                             fact: editing here is one-way, and the operator should know before
                             they touch a control rather than after. -->
                        <p class="warn-line" role="status">
                          <span i18n="@@spd.structure.one_way"
                            >Editing the steps by hand switches the form off for this product, for
                            good. A calculation the form cannot describe is one it must not pretend
                            to.</span
                          >
                        </p>
                      }
                      <app-product-rule-builder
                        [steps]="builderSteps()"
                        (stepsChange)="onBuilderSteps($event)"
                        [gates]="builderGates()"
                        (gatesChange)="onBuilderGates($event)"
                        [output]="builderOutput()"
                        (outputChange)="onBuilderOutput($event)"
                        [facts]="facts()"
                        (touched)="markStructureDirty()"
                      />
                    </details>
                  }
                } @else {
                  <p class="notice" role="status">
                    <span i18n="@@spd.structure.offer">
                      This product works its income out from a single figure. Answer three questions
                      and we will build the calculation, or write the steps yourself.
                    </span>
                    <a
                      class="linkish"
                      [routerLink]="['/surrogate-products', key, 'calculation']"
                      i18n="@@spd.structure.form"
                      >Build it from a form</a
                    >
                    <button type="button" class="linkish" (click)="startPipeline()">
                      <span i18n="@@spd.structure.start">Work it out step by step</span>
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

                @if (saveError(); as message) {
                  <p class="notice is-bad" role="alert">
                    <span nz-icon nzType="exclamation-circle" nzTheme="outline"></span>
                    <span>{{ message }}</span>
                  </p>
                }

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

                @if (ruleBlocked()) {
                  <p class="notice is-bad" role="alert">
                    <span nz-icon nzType="exclamation-circle" nzTheme="outline"></span>
                    <span i18n="@@spd.save_blocked"
                      >Some steps have no figures yet, or a step offering several ways to reach the
                      figure has none of them filled in. The save would be refused.</span
                    >
                  </p>
                }

                <div class="actions">
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

      /* The structure builder, folded away by default: on the compound product it is
         twenty steps, and an operator arriving to change one figure should not have to
         scroll past the whole calculation to reach it. */
      .structure {
        border-inline-start: 2px solid var(--border-subtle);
        padding-inline-start: var(--space-4);
        margin-block-end: var(--space-5);
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
      .warn-line {
        margin: 0 0 var(--space-3);
        font-size: var(--text-sm);
        color: var(--color-warning);
        line-height: var(--line-height-base);
      }
      .structure-count {
        min-inline-size: 1.5rem;
        padding-inline: var(--space-2);
        border-radius: 999px;
        background: var(--bg-subtle);
        color: var(--text-tertiary);
        font-variant-numeric: tabular-nums;
        text-align: center;
        font-weight: 500;
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

      .actions {
        display: flex;
        justify-content: flex-end;
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

      .asks {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .ask {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-4);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }

      .ask-q {
        margin: 0;
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }

      .ask-meta {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }

      .ask-foot {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
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

      .hint {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-tertiary);
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
  private readonly api = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly modals = inject(NzModalService);
  private readonly lookups = inject(LookupsApiService);
  private readonly questions = inject(QuestionnaireApiService);
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
  protected readonly addAskTitle = $localize`:@@spd.ask.add_title:Add something this product asks`;
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

  // --- authoring the structure -----------------------------------------------
  //
  // A DRAFT held apart from `ruleSteps()` / `ruleGates()` / `ruleOutput()`, which are read
  // straight off the last server response. Editing those computeds is not possible and
  // should not be: the rendered structure is what the server last agreed to, and the draft
  // is what the operator is proposing. `absorb()` re-seeds the draft from the response, so a
  // reload discards an unsaved edit exactly as it discards an unsaved figure.

  protected readonly builderSteps = signal<RuleStep[]>([]);
  protected readonly builderGates = signal<RuleGate[]>([]);
  protected readonly builderOutput = signal<ProductRuleOutput | null>(null);

  /**
   * Whether the structure was EDITED, not whether it exists.
   *
   * This is the flag that decides whether the save carries `steps`/`gates`/`output` at all.
   * Untouched, the write stays figures-only and the server keeps the stored structure — the
   * property that stops a stale tab replacing a product it merely rendered.
   */
  protected readonly structureDirty = signal(false);
  protected readonly structureOpen = signal(false);

  /**
   * Has the operator asked for the raw step builder on a FORM-built product?
   *
   * Session-only and deliberately not persisted: the reveal is an escape hatch for the one
   * product that has outgrown its shape, not a preference. A hand-built pipeline has no form
   * to fall back on, so it never passes through this gate at all — hiding the builder there
   * would leave its calculation uneditable in the browser.
   */
  protected readonly rawStepsShown = signal(false);

  /**
   * Was this calculation built from the form?
   *
   * Read off the server's own answer rather than inferred from the steps: a hand-authored
   * pipeline and a compiled one are the same shape by construction, so there is nothing in
   * the steps to tell them apart — which is exactly why the form is stored.
   */
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
    return productRuleHasError({
      steps: this.builderSteps().length > 0 ? this.builderSteps() : this.ruleSteps(),
      gates: this.builderGates().length > 0 ? this.builderGates() : this.ruleGates(),
      figures: this.stepFigures(),
    });
  });

  protected readonly hasTemplate = computed(() => this.product()?.template != null);

  protected readonly isPipeline = computed(
    () => this.builderSteps().length > 0 || this.ruleSteps().length > 0,
  );

  protected onBuilderSteps(steps: RuleStep[]): void {
    this.builderSteps.set(steps);
  }

  protected onBuilderGates(gates: RuleGate[]): void {
    this.builderGates.set(gates);
  }

  protected onBuilderOutput(output: ProductRuleOutput | null): void {
    this.builderOutput.set(output);
  }

  // --- deleting the product ---------------------------------------------------

  protected readonly deleting = signal(false);
  /**
   * What the refusal said would be destroyed, or `null` when nothing is pending.
   *
   * Held as the SERVER'S answer rather than derived from `product()!.names`, which the page
   * already has: the two can disagree if someone linked a name in another tab, and the list
   * an operator confirms against must be the one the delete will actually act on.
   */
  protected readonly deleteBlocked = signal<{
    names: readonly string[];
    programCodes: readonly string[];
  } | null>(null);

  /**
   * First call without cascade. A product nothing points at dies here; one that is being
   * sold comes back refused, and the refusal is what the confirmation renders.
   *
   * No `nzModal.confirm` for the first step: the refusal already IS the confirmation, and a
   * dialog asking "are you sure?" before the server has said what is at stake would be
   * asking the operator to confirm something neither of them has seen yet.
   */
  protected confirmDelete(): void {
    void this.doDelete(false);
  }

  protected cancelDelete(): void {
    this.deleteBlocked.set(null);
  }

  protected async doDelete(cascade: boolean): Promise<void> {
    if (this.deleting()) return;
    this.deleting.set(true);
    try {
      await this.api.deleteSurrogateProduct(this.key, { cascade });
      void this.router.navigate(['/surrogate-products']);
    } catch (err) {
      const body = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
      if (body?.code === 'SURROGATE_PRODUCT_IN_USE') {
        this.deleteBlocked.set({
          names: (body.meta?.['names'] as string[] | undefined) ?? [],
          programCodes: (body.meta?.['programCodes'] as string[] | undefined) ?? [],
        });
        return;
      }
      // Anything else is already a toast from the global interceptor; re-stating it inline
      // would say the same thing twice.
    } finally {
      this.deleting.set(false);
    }
  }

  protected markStructureDirty(): void {
    this.structureDirty.set(true);
    this.markDirty();
  }

  protected toggleStructure(event: Event): void {
    event.preventDefault();
    this.structureOpen.update((open) => !open);
  }

  /**
   * Opens as well as reveals: an operator who asked for the steps asked to SEE them, and a
   * collapsed `<details>` appearing where the link was reads as the click having failed.
   */
  protected revealRawSteps(): void {
    this.rawStepsShown.set(true);
    this.structureOpen.set(true);
  }

  /**
   * Turn a single-figure product into a pipeline.
   *
   * Needed as its own control because `'steps'` is deliberately absent from the method
   * picker — a pipeline is not a twelfth income method — so without this a freshly created
   * product could never become one from the browser at all. Opens with one step and the
   * answer pointing at it, which is the smallest rule that validates.
   */
  protected startPipeline(): void {
    this.builderSteps.set([{ id: 'step_1', op: 'constant' }]);
    this.builderGates.set([]);
    this.builderOutput.set({ kind: 'monthlyIncome', from: 'step_1' });
    this.ruleGroup.controls.strategy.setValue('steps');
    this.structureOpen.set(true);
    this.markStructureDirty();
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

    const push = (type: string, description: string, hasBoard: boolean): void => {
      if (seen.has(type)) return;
      seen.add(type);
      out.push({
        type,
        title: this.enumTypes.label(type, this.isAr),
        description,
        hasBoard,
        owned: owned.has(type),
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

  /**
   * What this product asks the applicant — its OWN facts, whatever the rule does with them.
   *
   * Owned, not derived: a fact this product authored belongs on its page from the moment it
   * exists, and a rule that does not read it yet is the normal state five minutes after the
   * dialog closes. What the rule reads is step ②'s question, and the builder's picker offers
   * every fact regardless of who made it.
   */
  protected readonly removing = signal<string | null>(null);
  protected readonly askError = signal<string | null>(null);

  /**
   * Remove something the product asks.
   *
   * Adding an ask was create-only: there was no way to fix a mistake and no way to take one
   * back, so a typo in a question was permanent and a fact bound to the wrong question stayed
   * bound. This is the taking-back half.
   *
   * THE ORDER IS FORCED, not chosen:
   *
   *   unbind first   `platform_enumeration.boundQuestionId` points AT the question. Deleting
   *                  the question first would leave the fact bound to nothing for as long as
   *                  it took to notice, and `surrogateFactRegistry()` would drop it silently.
   *   fact next      while a live rule still reads `fact:<key>`, `countReferences` refuses —
   *                  which is the right answer, and the message says which rule.
   *   question last  soft-deleted, so answers already given keep resolving. `QUESTION_IN_USE`
   *                  refuses one another question branches on.
   *
   * No confirm dialog before the first call, for the reason the product delete gives: the
   * refusal IS the confirmation, and a dialog asking "are you sure?" before the server has
   * said what is at stake asks the operator to confirm something neither of them has seen.
   */
  protected async removeAsk(thing: AskedThing): Promise<void> {
    if (this.removing() !== null) return;
    this.removing.set(thing.factKey);
    this.askError.set(null);
    try {
      const rows = await this.lookups.list('surrogate_fact');
      const fact = rows.find((r) => r.key === thing.factKey);
      if (fact) {
        await this.lookups.setBoundQuestion(fact.id, null);
        await this.lookups.remove(fact.id);
      }

      if (thing.questionCode) {
        // The question's id is not on the fact registry — that projection carries the CODE,
        // which is what every other surface speaks. One tree read to resolve it is cheap for
        // an action taken this rarely, and avoids a second id on a hot projection.
        const tree = await this.questions.tree();
        const question = tree
          .flatMap((group) => group.questions)
          .find((q) => q.code === thing.questionCode);
        if (question) await this.questions.deleteQuestion(question.id);
      }

      await this.enumTypes.refresh();
      await this.enums.refresh('surrogate_fact');
      await this.load({ silent: true });
    } catch (err) {
      this.askError.set(this.localizedError(err));
    } finally {
      this.removing.set(null);
    }
  }

  protected readonly askedThings = computed<AskedThing[]>(() => {
    const key = this.productKey();
    return this.facts()
      .filter((f) => f.ownedBy === key)
      .map((f) => ({
        factKey: f.key,
        questionLabel: f.question?.label ?? f.label,
        questionCode: f.question?.code ?? '',
        numeric: f.question?.type === 'NUMERIC',
        askedIn: f.question?.askedIn ?? [],
        listType: f.question?.optionsEnumerationType ?? null,
        inactive: f.question?.active === false,
      }));
  });

  /** The lists the calculation reads that this product did NOT author. */
  protected readonly borrowedCount = computed(
    () => this.readLists().filter((l) => !l.owned).length,
  );

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
   * `fact_not_answered`. Step ② is wrong on an unsaved edit. Step ③ is a report, and a product
   * nothing sells yet is a legitimate state rather than an error.
   */
  protected readonly steps = computed<WizardStepItem[]>(() => {
    const p = this.product();
    return [
      {
        id: 'asks',
        label: this.stepLabels[0] ?? '',
        status: this.askedThings().length > 0 ? 'done' : 'todo',
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
        return $localize`:@@spd.cap_asks:The questions this product puts to the applicant, the answers they pick from, and the classes a bank keys its table by.`;
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
  }

  /**
   * Whether the server will entertain a delete for a type. Absent = not loaded, so the
   * button stays as it was rather than disappearing on an old backend.
   */
  protected deletableType(type: string): boolean {
    return this.typeSummaries().find((s) => s.type === type)?.deletable ?? true;
  }

  protected askedInLabel(cats: readonly LoanCategory[]): string {
    return cats.map((c) => categoryLabel(c)).join(' · ');
  }

  /**
   * Author one more thing this product asks — list, question and fact in one pass.
   *
   * ITS OWN SCREEN (`/surrogate-products/:key/asks/new`), not a dialog: the form branches
   * on the kind of answer, grows two lists of rows and runs four writes, and a run that
   * stops halfway needs a URL to come back to. The product page reloads on return because
   * navigating back creates it fresh.
   */
  protected addAsk(): void {
    if (!this.product()) return;
    void this.router.navigate(['/surrogate-products', this.key, 'asks', 'new']);
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
   */
  protected onListChanged(): void {
    void this.load({ silent: true });
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
      ...(shape === 'steps' && Object.keys(this.stepFigures()).length > 0
        ? { stepParams: this.stepFigures() }
        : {}),
      ...(this.structureDirty()
        ? {
            steps: this.builderSteps(),
            gates: this.builderGates(),
            output: this.builderOutput() ?? undefined,
          }
        : {}),
    };
  }

  private async load(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loading.set(true);
    try {
      const res = await this.api.getSurrogateProduct(this.key);
      this.absorb(res.data);
    } catch {
      // The toast interceptor has already said why; the template renders the not-found
      // state off `product() === null`.
      this.product.set(null);
    } finally {
      if (!opts.silent) this.loading.set(false);
    }
  }

  private absorb(data: SurrogateProductDetail): void {
    this.product.set(data);
    const rule = data.incomeRule;
    // Re-seed the draft from what the server agreed to, and clear the dirty flag with it:
    // a reload discards an unsaved structural edit exactly as it discards an unsaved figure.
    // Cloned one level so the builder's own `update` calls cannot mutate the response object
    // the read-only panels below are still rendering from.
    const structural = rule as
      | { steps?: RuleStep[]; gates?: RuleGate[]; output?: ProductRuleOutput }
      | null
      | undefined;
    this.builderSteps.set((structural?.steps ?? []).map((step) => ({ ...step })));
    this.builderGates.set((structural?.gates ?? []).map((gate) => ({ ...gate })));
    this.builderOutput.set(structural?.output ? { ...structural.output } : null);
    this.structureDirty.set(false);
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
