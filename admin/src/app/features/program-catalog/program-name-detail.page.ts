import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  ArrowLeftOutline,
  ArrowRightOutline,
  CloseCircleOutline,
  ExclamationCircleOutline,
} from '@ant-design/icons-angular/icons';
import { PageHeaderComponent, WizardStepsComponent, type WizardStepItem } from '@shared/ui';
import { IncomeAssumptionSectionComponent } from '@shared/income-rule/income-assumption-section.component';
import { incomeRuleHasError } from '@shared/income-rule/income-rule.rules';
import { catalogRuleOf } from '@shared/income-rule/catalog-rule';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import {
  incomeMethodShape,
  registryFacts,
  type IncomeAssumptionConfig,
  type IncomeAssumptionStrategy,
  type IncomeBand,
  type IncomeKeyTableRow,
  type StepFigures,
  type ProgramNameIncomeRule,
  type ProductRuleOutput,
  type RuleGate,
  type RuleStep,
} from '@features/bank-programs/bank-programs.types';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { LOAN_CATEGORIES, categoryLabel, type LoanCategory } from '@core/loan-category';
import { LookupsApiService } from '../lookups/lookups.api.service';
import { ENUM_TYPE, absorbProgramNames, type ProgramNameRow } from './program-name-row';
import { PRODUCT_BASE } from './program-catalog.paths';

/**
 * One catalog program name, in two steps.
 *
 * Replaces the rail board this feature shipped with (`program-categories`), which
 * asked the operator to hold a 16×4 assignment in their head on a screen of its
 * own. The assignment is a fact about ONE name, so it belongs on one screen about
 * that name — reached by opening it from the catalog, the way every other object
 * in this dashboard is reached.
 *
 * - **How the income is worked out** — one proof for the whole name, whichever
 *   product it is sold as. Explicitly saved, because the write can be refused.
 * - **Where it is offered** — the authoritative per-loan-type assignment. The
 *   bank-program builder filters its Program name picker on it and the API rejects
 *   an unassigned pair. Saved on every tap.
 *
 * The screen used to carry a third step, a per-loan-type question list the name
 * "suggests scoring on". Approval scoring is gone from the platform, and with it
 * the only thing that ever read that list, so the step and its storage went with
 * it. What a no-payslip product actually READS is a different axis with a real,
 * engine-read home — `surrogate_product_ask`, on the surrogate product screens.
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
    IncomeAssumptionSectionComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      ArrowRightOutline,
      CloseCircleOutline,
      ExclamationCircleOutline,
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
            subtitle="Two steps: how the income is worked out, and which loan types banks may sell it under. The income proof has its own Save; turning a loan type on or off saves as you tap."
            i18n-subtitle="@@pnd.sub2"
          >
            <div class="header-aside">
              <span class="usage">
                @if (n.usage.programs === 0) {
                  <span i18n="@@pnd.usage_none">Not offered by any bank yet</span>
                } @else {
                  {{ usageLabel(n) }}
                }
              </span>
              <!-- Only true of THIS step. Step 1 is saved with a button, and a page-wide
                   chip claiming otherwise is the thing a draft layer must not leave on
                   screen. -->
              @if (stepIndex() === 1) {
                <span class="autosave" i18n="@@pnd.autosave_offer"
                  >Turning a loan type on or off saves at once</span
                >
              }
            </div>
          </app-page-header>

          <!-- ── Two steps, in the order the decisions depend on each other ──
               The screen used to stack both on one scroll: a rule card and, under it,
               a tab rail with a switch behind each tab. One of those is per LOAN TYPE
               and one is not, so the page asked the operator to hold "which of these
               is per tab?" in their head the whole way down — and the assignment they
               came to set was four tab-clicks apart.

               Non-linear on purpose. This is a settings screen, not a creation flow:
               every step is reachable at any time and each saves on its own terms (the
               rule has its own Save, the offer switches write as they are tapped), and
               nothing is submitted at the end. The rail is the shared wizard rail, so a
               step here reads exactly like a step in the bank-program wizard. -->
          <app-wizard-steps
            [steps]="wizardSteps()"
            [activeIndex]="stepIndex()"
            [ariaLabel]="stepsAria"
            [caption]="stepCaption()"
            (stepSelect)="goToStep($event)"
          />

          @switch (stepIndex()) {
            @case (0) {
              <!-- ── STEP 1 · The ONE income proof ─────────────────────────────────
               Its own step, because it is NOT per loan type: one name reads one
               figure, whichever product it is sold as. Under a tab it would say the
               opposite four times. -->
              <section class="card is-bare rule-card">
                <header class="rule-head">
                  <div>
                    <!-- No sub-line: the rail's caption one line above says the same thing
                         in fewer words, and the pipeline's own closing note says the "starts
                         from these amounts" half again at the foot of the step. -->
                    <h2 class="rule-title" i18n="@@pnd.rule_title">How the income is worked out</h2>
                  </div>
                  @if (ruleDirty() && !linked()) {
                    <button
                      nz-button
                      nzType="primary"
                      type="button"
                      [nzLoading]="ruleSaving()"
                      (click)="saveRule()"
                      i18n="@@pnd.rule_save"
                    >
                      Save the income rule
                    </button>
                  }
                </header>

                @if (ruleError(); as err) {
                  <p class="rule-error" role="alert">
                    <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
                    <span>{{ err }}</span>
                  </p>
                }

                @if (ruleLoading()) {
                  <!-- Shape-matched: a picker's height then three figure rows, because that
                   is what arrives. A spinner here would say "something", not "this". -->
                  <div class="rule-skeleton" aria-hidden="true">
                    <span class="sk sk-picker"></span>
                    <span class="sk sk-row"></span>
                    <span class="sk sk-row"></span>
                    <span class="sk sk-row"></span>
                  </div>
                } @else {
                  @if (linked(); as product) {
                    <!-- LINKED. The calculation belongs to the surrogate product, so this page
                     names it and sends the operator there rather than offering an editor that
                     would fork it. The pipeline itself still renders below, read-only: an
                     operator on this page needs to UNDERSTAND what the name sells. -->
                    <p class="rule-linked">
                      <span
                        nz-icon
                        nzType="info-circle"
                        nzTheme="outline"
                        aria-hidden="true"
                      ></span>
                      <span>
                        <span i18n="@@pnd.rule_linked"
                          >This name works its income out from the
                          <strong>{{ productLabel() }}</strong> surrogate product, so the
                          calculation is edited there and every name using it stays in step.</span
                        >
                        <a
                          class="rule-linked-go"
                          [routerLink]="[productBase, product]"
                          i18n="@@pnd.rule_open_product"
                          >Open the surrogate product</a
                        >
                      </span>
                    </p>
                  } @else if (!ruleDecided() && !ruleTouched()) {
                    <!-- Names the consequence, and the picker below IS the action — so this is
                     one line above the control rather than a card that replaces it. -->
                    <p class="rule-empty" i18n="@@pnd.rule_empty">
                      Nobody has said what this name reads its income from, so no bank can sell it
                      on a surrogate basis yet. Pick the figure below.
                    </p>
                  }

                  @if (!linked()) {
                    <app-income-assumption-section
                      variant="catalog"
                      [group]="ruleGroup"
                      [keyTable]="ruleKeyTable()"
                      (keyTableChange)="onRuleKeyTable($event)"
                      [bands]="ruleBands()"
                      (bandsChange)="onRuleBands($event)"
                      [ruleSteps]="ruleSteps()"
                      [ruleGates]="ruleGates()"
                      [ruleOutput]="ruleOutput()"
                      [stepFigures]="ruleStepFigures()"
                      (stepFiguresChange)="onRuleStepFigures($event)"
                      (stepFiguresTouched)="markRuleDirty()"
                    ></app-income-assumption-section>
                  }

                  <!-- Who reads this. Quiet by design: it is a fact, not a warning — and it
                   is the same list the server names when it refuses a proof change, so
                   the operator sees the obstacle before they hit it. -->
                  <p class="rule-usage">
                    @if (ruleReaders().length === 0) {
                      <span i18n="@@pnd.rule_readers_none"
                        >No bank sells this name on a surrogate basis yet.</span
                      >
                    } @else {
                      <span>{{ ruleReadersLabel() }}</span>
                    }
                  </p>
                }
              </section>
            }
            @case (1) {
              <!-- ── STEP 2 · Where it is offered ──────────────────────────────
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

                <ul class="gates" role="list">
                  @for (c of categories; track c) {
                    <li>
                      <div class="gate" [class.on]="isOffered(c)">
                        <button
                          type="button"
                          role="switch"
                          class="switch"
                          [attr.aria-checked]="isOffered(c)"
                          [attr.aria-label]="offerLabel(n, c)"
                          [attr.aria-busy]="savingOffer()"
                          (click)="toggleOffered(c)"
                        >
                          <span class="track" aria-hidden="true"><span class="thumb"></span></span>
                          <span class="switch-text">
                            <!-- The LOAN TYPE, not the sentence. Four rows each opening
                                 with the program name repeated it four times under an H1
                                 that already says it, and pushed every title to two
                                 lines. The full sentence stays on the aria-label, where a
                                 screen reader has no H1 in view to lean on. -->
                            <span class="switch-title">{{ categoryNameOf(c) }}</span>
                            <span class="switch-hint">
                              @if (isOffered(c)) {
                                <!-- Says WHO sees the effect and WHERE. "Banks can sell it"
                                   described a business fact the admin cannot see; the name
                                   appearing in a picker is the thing they can go and check.
                                   "of this type" rather than the type's name: the row IS the
                                   type, and interpolating it forced "a Auto Loan". -->
                                <span i18n="@@pnd.gate_on_hint"
                                  >A bank adding a program of this type can pick this name.</span
                                >
                              } @else {
                                <span i18n="@@pnd.gate_off_hint"
                                  >No bank program can pick this name here.</span
                                >
                              }
                            </span>
                          </span>
                        </button>
                      </div>
                    </li>
                  }
                </ul>

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
          }

          <!-- Back / Next as well as the rail, because a rail is a map and these are
               the two moves. No "Finish": nothing is submitted here — the offer switches
               save as they are tapped and the rule has its own Save inside step 1. -->
          <!-- The rule's Save and its refusal text live inside step 1, so leaving that step
               with edits pending used to remove the only way to keep them from the DOM — no
               prompt, no marker (the rail suppresses a status on the step you are standing
               on), and the edits gone the moment the page was left. Carried here instead, so
               the pending state and its Save travel with the operator. -->
          @if (ruleDirty() && !linked() && stepIndex() !== 0) {
            <p class="stepnav-unsaved" role="status">
              <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@pnd.rule_unsaved">
                How the income is worked out has changes you have not saved.
              </span>
              <button
                nz-button
                nzType="primary"
                nzSize="small"
                type="button"
                [nzLoading]="ruleSaving()"
                (click)="saveRule()"
                i18n="@@pnd.rule_save_short"
              >
                Save it
              </button>
            </p>
          }
          @if (ruleError(); as err) {
            @if (stepIndex() !== 0) {
              <p class="rule-error" role="alert">
                <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
                <span>{{ err }}</span>
              </p>
            }
          }

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
            @if (stepIndex() < 1) {
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

      /* --- The ONE income proof -------------------------------------------- */
      /* is-bare for the reason step 1 of the wizard uses it: the editor inside already
         draws its own bordered blocks, and a filled card around them would be a card
         holding cards. */
      .rule-card {
        display: flex;
        flex-direction: column;
        margin-block-end: var(--space-5);
      }

      .rule-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
        margin-block-end: var(--space-4);
      }

      .rule-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        color: var(--text-primary);
      }

      .rule-sub {
        margin: var(--space-1) 0 0;
        max-inline-size: 68ch;
        font-size: 0.8125rem;
        line-height: 1.55;
        color: var(--text-secondary);
      }

      /* The refusal renders WHERE the control is, not as a toast: the in-use refusal
         names the programs that block the change, and a toast takes that list away
         before it can be read. */
      .rule-error {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0 0 var(--space-4);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        border-inline-start: var(--rule-width-accent) solid var(--ant-error-color);
        background: var(--color-error-bg);
        color: var(--text-primary);
        font-size: 0.8125rem;
        line-height: 1.55;
      }

      .rule-error [nz-icon] {
        color: var(--ant-error-color);
        margin-block-start: 0.15em;
      }

      .rule-linked {
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

      .rule-linked strong {
        color: var(--text-primary);
        font-weight: var(--font-semibold);
      }

      .rule-linked-go {
        display: inline-block;
        margin-inline-start: var(--space-2);
        color: var(--primary-visible);
        text-decoration: none;
        cursor: pointer;
        font-weight: var(--font-medium);
      }

      .rule-linked-go:hover {
        text-decoration: underline;
      }

      .rule-linked-go:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }

      .rule-empty {
        margin: 0 0 var(--space-4);
        max-inline-size: 66ch;
        font-size: 0.8125rem;
        line-height: 1.55;
        color: var(--text-secondary);
      }

      /* A fact, not a badge row: the operator reads it once. Tabular numerals so the
         three counts line up when the block re-renders after a save. */
      .rule-usage {
        margin: var(--space-4) 0 0;
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--border-subtle);
        font-size: 0.75rem;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }

      /* Shape-matched: the picker's height, then three figure rows — which is what
         arrives. A centred spinner would say "something is loading", not "this is". */
      .rule-skeleton {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .rule-skeleton .sk {
        display: block;
        border-radius: var(--radius-md);
        background: linear-gradient(
          90deg,
          var(--color-surface-elevated) 25%,
          var(--color-surface-muted) 37%,
          var(--color-surface-elevated) 63%
        );
        background-size: 400% 100%;
        animation: rule-sk var(--motion-ambient) ease-in-out infinite;
      }

      .rule-skeleton .sk-picker {
        block-size: 32px;
        max-inline-size: 320px;
      }

      .rule-skeleton .sk-row {
        block-size: 24px;
        max-inline-size: 460px;
      }

      @keyframes rule-sk {
        0% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0 50%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .rule-skeleton .sk {
          animation: none;
        }
      }

      @media (max-width: 640px) {
        .rule-head {
          flex-direction: column;
          align-items: stretch;
        }
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
      .stepnav-unsaved {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-3);
        padding: var(--space-2) var(--space-3);
        border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface-default));
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }

      .stepnav-unsaved button {
        margin-inline-start: auto;
      }

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
  protected readonly productBase = PRODUCT_BASE;

  private readonly api = inject(LookupsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly routeKey = signal<string>(this.route.snapshot.paramMap.get('key') ?? '');
  protected readonly name = signal<ProgramNameRow | null>(null);

  protected readonly loading = signal(true);
  protected readonly savingOffer = signal(false);

  // --- The ONE income proof --------------------------------------------------
  //
  // Explicitly SAVED. Three reasons, and the first alone decides it: the write can be
  // REFUSED (the proof is in use, the table has a duplicate key), and an autosave that
  // fails leaves the operator looking at a screen claiming it saved. The rule is also a
  // multi-field form whose intermediate states are legitimately invalid — a half-typed
  // band table would fire a rejection on every keystroke — and a proof change moves real
  // money at every bank that inherits, which deserves a deliberate click.

  private readonly programsApi = inject(BankProgramsApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly fb = inject(FormBuilder);
  /** Only for a `fact:` method's editor shape — the picker itself reads its own copy. */
  private readonly enums = inject(PlatformEnumerationsService);

  protected readonly ruleLoading = signal(true);
  protected readonly ruleSaving = signal(false);
  protected readonly ruleError = signal<string | null>(null);
  /** The server's answer, as last read or written. `null` = the name states nothing. */
  protected readonly rule = signal<ProgramNameIncomeRule | null>(null);
  /** Whether a proof is stored. Drives the empty state, not `rule() === null`. */
  protected readonly ruleDecided = computed(() => this.rule()?.incomeRule != null);
  /** True once the operator has picked anything, so the empty-state copy steps aside. */
  protected readonly ruleTouched = signal(false);
  protected readonly ruleDirty = signal(false);

  /**
   * Same shape the wizard builds, because the SAME editor renders it. `combinationRule`
   * and the two policy controls are here even though the catalog hides them: the
   * component reads the group by control name, and a missing control is a template
   * error rather than a hidden field.
   */
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

  /** The two table shapes are signals, for the reason the wizard states: one owner. */
  protected readonly ruleKeyTable = signal<IncomeKeyTableRow[]>([]);
  protected readonly ruleBands = signal<IncomeBand[]>([]);
  /**
   * A pipeline product's DEFAULT figures — the numbers every bank filed under this name
   * starts from. The steps themselves stay the catalog's to state and nobody's to author
   * here; these are the amounts, which is the half a bank can go on to override.
   */
  protected readonly ruleStepFigures = signal<Record<string, StepFigures>>({});

  /**
   * The method picker and the scalar field are FORM controls, not signals, so nothing was
   * watching them: picking a different proof, or typing the percentage a bank starts from,
   * left the block silently un-saveable. Subscribed rather than turned into a computed
   * because the flag is a fact about what the operator DID, and only they can raise it —
   * `absorbRule` resets the group with `emitEvent: false` so a page load never does.
   */
  private readonly ruleEdits = this.ruleGroup.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.markRuleDirty());

  // --- The two steps ---------------------------------------------------------
  //
  // Which step is on stage lives in the URL, so a colleague pasting a link and a reload
  // after a save both land where the operator was rather than back at step one.

  protected readonly stepIndex = signal<number>(this.initialStep());

  /** The four loan types, for the assignment step's `@for`. Order is the platform's. */
  protected readonly categories = LOAN_CATEGORIES;

  protected readonly stepsAria = $localize`:@@pnd.steps_aria:Setting up this program name`;

  private readonly stepLabels: readonly string[] = [
    $localize`:@@pnd.step_income:How the income is worked out`,
    $localize`:@@pnd.step_offered:Where it is offered`,
  ];

  /**
   * The rail's status per step, and the one place the two answers are compared.
   *
   * Step 2 is the only one that can be WRONG in what it HOLDS: a name offered under no
   * loan type is a name no bank can pick, which is unsellable rather than merely
   * unfinished. Step 1 is legitimately blank (a payslip product states no rule), so it is
   * never short of an answer. It can be UNSAVED, though, and that is what `invalid`
   * reports on it — the rail is the only marker for a step the operator is not standing
   * on.
   */
  protected readonly wizardSteps = computed<WizardStepItem[]>(() => [
    {
      id: 'income',
      label: this.stepLabels[0] ?? '',
      // A LINKED name is decided by construction — the product states the calculation —
      // so it can never read as todo or invalid on this page, where it cannot be edited.
      status: this.linked()
        ? 'done'
        : this.ruleDirty()
          ? 'invalid'
          : this.ruleDecided()
            ? 'done'
            : 'todo',
    },
    {
      id: 'offered',
      label: this.stepLabels[1] ?? '',
      status: this.offeredCount() > 0 ? 'done' : 'invalid',
    },
  ]);

  /** One sentence under the rail: what this step decides, and what it does not. */
  protected readonly stepCaption = computed<string>(() => {
    if (this.stepIndex() === 0) {
      return this.linked()
        ? $localize`:@@pnd.step_income_cap_linked:Taken from a surrogate product, so every name using that product stays in step. Edited there, not here.`
        : $localize`:@@pnd.step_income_cap:Set once for the name. Every bank selling it on a surrogate basis reads this one figure.`;
    }
    return $localize`:@@pnd.step_offered_cap:${this.offeredCount()}:OFFERED: of ${this.categories.length}:TOTAL: loan types are on. This is what a bank's program picker filters on.`;
  });

  protected nextStepLabel(): string {
    return this.stepLabels[this.stepIndex() + 1] ?? '';
  }

  protected goToStep(index: number): void {
    const next = Math.min(Math.max(index, 0), this.stepLabels.length - 1);
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

  /** The same question asked about any category — what the assignment step renders. */
  protected isOffered(category: LoanCategory): boolean {
    return this.name()?.categories.includes(category) ?? false;
  }

  /** How many of the four are on. Drives the rail's status and its caption. */
  protected readonly offeredCount = computed(() => this.name()?.categories.length ?? 0);

  ngOnInit(): void {
    void this.load();
    // A separate read, deliberately not awaited with the other: the income rule comes
    // from the bank-programs API and the row from the lookups API, so a slow or failing
    // one must not hold up the other. Each surface reports its own state.
    void this.loadRule();
  }

  // --- Display helpers -------------------------------------------------------

  protected nameOf(row: ProgramNameRow): string {
    return this.isAr ? row.labelAr : row.labelEn;
  }

  protected usageLabel(row: ProgramNameRow): string {
    return $localize`:@@pnd.usage_value:${row.usage.programs}:PROGRAMS: bank programs · ${row.usage.banks}:BANKS: banks`;
  }

  protected categoryNameOf(category: LoanCategory): string {
    return categoryLabel(category);
  }

  /**
   * Quotes the name when the caller has the row. "Offered as a Personal Loan" read
   * as a property of nothing in particular on a page that already shows the name in
   * the H1 — spelling out who does the offering is what makes the switch a sentence.
   */
  protected offerLabel(row: ProgramNameRow, category: LoanCategory): string {
    // "as a ${category}" cannot be made grammatical for every label in every locale
    // ("a Auto Loan"), and this string is now read aloud rather than shown — the row's
    // visible title is the loan type on its own.
    return $localize`:@@pnd.gate_label:Offer “${this.nameOf(row)}:name:” under ${categoryLabel(category)}:category:`;
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

  // --- The ONE income proof --------------------------------------------------

  /** The surrogate programs reading this name, split by whose figures they use. */
  protected readonly ruleReaders = computed(() => this.rule()?.programs ?? []);

  protected readonly ruleReadersLabel = computed(() => {
    const readers = this.ruleReaders();
    const own = readers.filter((p) => p.ownAmounts).length;
    const inherited = readers.length - own;
    // One sentence with three counts rather than three tags: it is a fact the operator
    // reads once, and badges would give it the weight of a warning.
    return $localize`:@@pnd.rule_readers:${readers.length}:total: bank program(s) read this figure · ${inherited}:inherited: take these amounts · ${own}:own: set their own`;
  });

  /**
   * Every typed edit routes through one of these three.
   *
   * They exist because the bindings used to be bare `.set()` calls, and `ruleDirty` was
   * only ever raised by the marker and structure handlers — so typing an income amount,
   * or changing the method, left the Save button unrendered and the operator with no way
   * to keep what they had just written. The figures are the whole point of the block.
   */
  protected onRuleKeyTable(rows: IncomeKeyTableRow[]): void {
    this.ruleKeyTable.set(rows);
    this.markRuleDirty();
  }

  protected onRuleBands(bands: IncomeBand[]): void {
    this.ruleBands.set(bands);
    this.markRuleDirty();
  }

  protected onRuleStepFigures(figures: Record<string, StepFigures>): void {
    this.ruleStepFigures.set(figures);
    this.markRuleDirty();
  }

  protected markRuleDirty(): void {
    this.ruleTouched.set(true);
    this.ruleDirty.set(true);
    // Cleared on the first edit: a refusal the operator has since acted on must not keep
    // sitting above the form as though it were still true.
    this.ruleError.set(null);
  }

  private async loadRule(): Promise<void> {
    this.ruleLoading.set(true);
    try {
      const { data } = await this.programsApi.getProgramNameIncomeRule(this.routeKey());
      this.absorbRule(data);
    } catch (err) {
      // A read failure is reported where the block is, not as a toast: the block is the
      // only thing that is broken, and the rest of the page still works.
      this.ruleError.set(this.localizedError(err));
    } finally {
      this.ruleLoading.set(false);
    }
  }

  /** Server answer → the form, the two tables, and the marker map. */
  private absorbRule(data: ProgramNameIncomeRule): void {
    this.rule.set(data);
    const rule = data.incomeRule;
    this.ruleGroup.reset(
      {
        strategy: rule?.strategy ?? 'declared',
        scalar: {
          value: rule?.scalar?.value ?? null,
          unit: rule?.scalar?.unit ?? 'percent',
        },
        dbrCapPercentOverride: null,
        requiredDocuments: [],
        combinationRule: null,
        // `emitEvent: false`, because the valueChanges subscription in the constructor is
        // what makes the method picker and the scalar field raise the Save button. Loading a
        // rule is not an edit, and without this every page load would offer to save what it
        // had just read.
      },
      { emitEvent: false },
    );
    this.ruleKeyTable.set(rule?.keyTable ? [...rule.keyTable] : []);
    this.ruleBands.set(rule?.bands ? [...rule.bands] : []);
    // Cloned a level deeper than the two tables: a step's figures are themselves a table
    // or a pair of bounds, and handing the editor the response's own arrays would have it
    // mutate the loaded snapshot in place.
    this.ruleStepFigures.set(
      Object.fromEntries(
        Object.entries(rule?.stepParams ?? {}).map(([id, figures]) => [
          id,
          {
            ...figures,
            ...(figures.keyTable ? { keyTable: figures.keyTable.map((row) => ({ ...row })) } : {}),
            ...(figures.bands ? { bands: figures.bands.map((band) => ({ ...band })) } : {}),
          },
        ]),
      ),
    );
    this.ruleTouched.set(false);
    this.ruleDirty.set(false);
  }

  /**
   * A product rule's structure, as stored on this name.
   *
   * The catalog variant renders it read-only: the pipeline is what an operator needs to
   * UNDERSTAND the product and to know which figures its banks must fill, and authoring one —
   * adding a step, wiring a reference — is still an API or seed action. Stated in the section's
   * own note rather than left for the operator to discover by finding no Add button.
   */
  /**
   * The rule this page RENDERS — the product's when the name links to one, else the name's.
   *
   * A linked name carries NULL in its own `incomeRule` (that is what makes the link a link
   * rather than a fork), so reading only `incomeRule` here would render every collateral
   * name as a product with no calculation at all.
   */
  private readonly effectiveRule = computed<IncomeAssumptionConfig | null>(() =>
    catalogRuleOf(this.rule()),
  );

  /** The product key this name links to, or `null` when it states its own rule. */
  protected readonly linked = computed<string | null>(
    () => this.rule()?.surrogateProduct?.key ?? null,
  );

  /** The product's name in the operator's language, for the linked notice. */
  protected readonly productLabel = computed(() => {
    const p = this.rule()?.surrogateProduct;
    if (!p) return '';
    return this.isAr ? p.labelAr : p.labelEn;
  });

  protected readonly ruleSteps = computed<readonly RuleStep[]>(
    () => this.effectiveRule()?.steps ?? [],
  );
  protected readonly ruleGates = computed<readonly RuleGate[]>(
    () => this.effectiveRule()?.gates ?? [],
  );
  protected readonly ruleOutput = computed<ProductRuleOutput | null>(
    () => this.effectiveRule()?.output ?? null,
  );

  /**
   * Save the rule, or refuse locally first.
   *
   * The client-side check is the SAME `incomeRuleHasError` the wizard's save gate uses.
   * It is not a second opinion: it exists so a duplicate key or a gapped band table is
   * answered instantly and in place, instead of costing a round trip to be told the same
   * thing. Everything the server refuses that the client cannot know — the proof being
   * in use, a key the registry has retired — comes back as `ruleError`.
   */
  protected async saveRule(): Promise<void> {
    const strategy = this.ruleGroup.controls.strategy.value;
    const local = incomeRuleHasError({
      // A pipeline's figures are its banks' — `incomeRuleHasError` returns `false` for it, and
      // the server validates a catalog rule with `figuresRequired: false` for the same reason.
      shape: incomeMethodShape(strategy, this.factsForShape()),
      keyTable: this.ruleKeyTable(),
      bands: this.ruleBands(),
      scalarValue: this.ruleGroup.controls.scalar.controls.value.value,
      isValueMethod: strategy === 'byCDValue' || strategy === 'byTotalDeposits',
    });
    if (local) {
      this.ruleError.set($localize`:@@pnd.rule_invalid:Check the amounts below before saving.`);
      return;
    }

    this.ruleSaving.set(true);
    this.ruleError.set(null);
    try {
      const { data } = await this.programsApi.setProgramNameIncomeRule(this.routeKey(), {
        incomeRule: this.ruleFromForm(strategy),
        // `valueSources` is OMITTED, deliberately. This screen has no control that marks a
        // figure, so it has nothing to say about markers — and saying `{}` said something
        // false: the server read it as "the full set is empty" and deleted every
        // team-estimated marker on the name, on a save about an unrelated figure, with no
        // control on this page able to put them back. Absent means "not touching them".
      });
      this.absorbRule(data);
    } catch (err) {
      this.ruleError.set(this.localizedError(err));
    } finally {
      this.ruleSaving.set(false);
    }
  }

  /**
   * The form → the wire shape, carrying ONLY the selected method's figures.
   *
   * Shape-gated rather than "send everything and let the server strip it": the operator
   * may have typed a band table, switched to a key method and typed that too, and
   * sending both would make the stored blob disagree with the screen.
   */
  private ruleFromForm(strategy: IncomeAssumptionStrategy): IncomeAssumptionConfig {
    const shape = incomeMethodShape(strategy, this.factsForShape());
    const scalar = this.ruleGroup.controls.scalar.getRawValue();
    return {
      strategy,
      ...(shape === 'keyTable' ? { keyTable: this.ruleKeyTable() } : {}),
      ...(shape === 'bands' ? { bands: this.ruleBands() } : {}),
      ...(shape === 'scalar' && scalar.value
        ? { scalar: { value: scalar.value, unit: scalar.unit } }
        : {}),
      // A pipeline's DEFAULT figures. Sent under the same shape gate as the other three,
      // so switching a name off a pipeline does not carry its step figures along.
      //
      // The STRUCTURE is deliberately not sent: `steps`/`gates`/`output` are what the
      // catalog already stores and this screen cannot author, so re-posting the copy it
      // rendered would make the save able to destroy the very thing it is editing.
      // Omitted entirely when empty, because `{}` on the wire is a rule that offers no
      // defaults, not a rule that leaves them untouched.
      ...(shape === 'steps' && Object.keys(this.ruleStepFigures()).length > 0
        ? { stepParams: this.ruleStepFigures() }
        : {}),
    };
  }

  /**
   * A rejection → the shared error-code vocabulary. Never a per-component English
   * string for a code the backend also reports (A22): the refusals here are the same
   * ones a bank program's save raises, so the operator reads one message per problem
   * whichever screen surfaced it.
   */
  private localizedError(err: unknown): string {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })?.error;
    return this.errors.toLocalizedMessage(
      (envelope?.code ?? 'INTERNAL_ERROR') as Parameters<ErrorCodeService['toLocalizedMessage']>[0],
      envelope?.meta,
    );
  }

  /**
   * The fact registry, for deriving a `fact:` method's editor shape.
   *
   * Read through the same service the editor uses, so the shape this page sends and the
   * shape the editor rendered can never come from two different registries.
   */
  private factsForShape(): ReturnType<typeof registryFacts> {
    return registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr);
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
