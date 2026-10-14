import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  ArrowLeftOutline,
  ArrowRightOutline,
  CloseCircleOutline,
} from '@ant-design/icons-angular/icons';
import {
  LoanCategorySwitchesComponent,
  PageHeaderComponent,
  WizardStepsComponent,
  type WizardStepItem,
} from '@shared/ui';
import { toAskablePool } from '@shared/questions/to-askable';
import { CompactAskedQuestionsComponent } from '@shared/questions/compact-asked-questions.component';
import {
  additionWithChain,
  additionsToSave,
  exclusionsToSave,
  type AskableQuestion,
  type ServedCount,
  type AskedPicks,
  type AskedRow,
} from '@shared/questions/asked-questions.rules';
import {
  QuestionnaireApiService,
} from '@features/questionnaire/questionnaire.api.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { LOAN_CATEGORIES, categoryLabel, type LoanCategory } from '@core/loan-category';
import { LookupsApiService } from '../lookups/lookups.api.service';
import { ENUM_TYPE, absorbProgramNames, type ProgramNameRow } from './program-name-row';

/**
 * One catalog program name, in two steps.
 *
 * Replaces the rail board this feature shipped with (`program-categories`), which
 * asked the operator to hold a 16×4 assignment in their head on a screen of its
 * own. The assignment is a fact about ONE name, so it belongs on one screen about
 * that name — reached by opening it from the catalog, the way every other object
 * in this dashboard is reached.
 *
 * - **Where it is offered** — the authoritative per-loan-type assignment. The
 *   bank-program builder filters its Program name picker on it and the API rejects
 *   an unassigned pair. Saved on every tap.
 * - **What applicants are asked** — per-name skips and additions. Saved on every tap.
 *
 * The screen used to open on a third step, "How the income is worked out": the
 * name's one surrogate income rule. Cut for the MVP — Add program makes income-proof
 * names only (v30.8.0), a no-payslip name's calculation is edited on its surrogate
 * product, and the stored rule is still read by every bank program under the name.
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
    LoanCategorySwitchesComponent,
    CompactAskedQuestionsComponent,
  ],
  providers: [provideNzIconsPatch([ArrowLeftOutline, ArrowRightOutline, CloseCircleOutline])],
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
            subtitle="Two steps: which loan types banks may sell it under, and what its applicants are asked. Every change saves as you tap."
            i18n-subtitle="@@pnd.sub3"
          >
            <div class="header-aside">
              <span class="usage">
                @if (n.usage.programs === 0) {
                  <span i18n="@@pnd.usage_none">Not offered by any bank yet</span>
                } @else {
                  {{ usageLabel(n) }}
                }
              </span>
              @if (stepIndex() === 0) {
                <span class="autosave" i18n="@@pnd.autosave_offer"
                  >Turning a loan type on or off saves at once</span
                >
              }
            </div>
          </app-page-header>

          <!-- ── Two steps, in the order the decisions depend on each other ──
               Non-linear on purpose. This is a settings screen, not a creation flow:
               every step is reachable at any time, every tap writes, and nothing is
               submitted at the end. The rail is the shared wizard rail, so a step here
               reads exactly like a step in the bank-program wizard. -->
          <app-wizard-steps
            [steps]="wizardSteps()"
            [activeIndex]="stepIndex()"
            [ariaLabel]="stepsAria"
            [caption]="stepCaption()"
            (stepSelect)="goToStep($event)"
          />

          @switch (stepIndex()) {
            @case (0) {
              <!-- ── STEP 1 · Where it is offered ──────────────────────────────
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

                <!-- Extracted on the second use: the create flow asks the same question,
                     and the component owns the WORDS as well as the markup, so an operator
                     reads the same sentence while creating a name as while editing it. -->
                <app-loan-category-switches
                  [value]="n.categories"
                  [busy]="savingOffer()"
                  [subject]="nameOf(n)"
                  (toggled)="toggleOffered($event)"
                />

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

            @case (1) {
              <!-- ── STEP 2 · What applicants are asked ────────────────────────
                   The screen carried a third step once and lost it with approval
                   scoring: a per-loan-type list the name "suggests scoring on", read
                   by nothing. This one writes the axis the engine actually asks from
                   — the question-to-loan-type table, the same rows the "Who gets asked
                   what" screen sets — so the decision an operator makes while creating a name is
                   editable afterwards in the same words and the same control.

                   Every tick here is about THIS name: an untick skips a question the
                   loan type asks (program_name_question_exclusion) and a tick under
                   "Other questions" asks one it does not (program_name_question_addition).
                   The loan type's own list is set on Questionnaire, Categories. Each tick
                   writes on its own, because the name exists and there is no Finish to
                   batch into. -->
              <section class="card is-bare stage-card">
                <header class="stage-head">
                  <h2 class="stage-title" i18n="@@pnd.asks_title">
                    What are these applicants asked?
                  </h2>
                  <p class="stage-sub" i18n="@@pnd.asks_sub">
                    One tab per loan type this name is offered under. What you untick or tick here
                    applies to this program only.
                  </p>
                </header>

                @if (asksError(); as err) {
                  <p class="stage-warn" role="alert">
                    <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
                    <span>{{ err }}</span>
                  </p>
                }

                <!-- Not the full board: what is REQUIRED, what was added in this visit, and a
                     search that suggests the rest. The whole pool grouped by section is one
                     click away by searching, not the first thing on the screen. -->
                <app-compact-asked-questions
                  [pool]="pool()"
                  [offered]="n.categories"
                  [category]="askCategory()"
                  [picks]="sessionPicks()"
                  [search]="askSearch()"
                  [isAr]="isAr"
                  [busy]="savingAsk().size > 0"
                  [removable]="false"
                  [served]="served()"
                  (categorySelect)="setAskCategory($event)"
                  (searchChange)="askSearch.set($event)"
                  [excluded]="excludedHere()"
                  [locks]="locks()"
                  [added]="addedHere()"
                  (add)="askToAdd($event)"
                  (exclude)="setSkipped($event, true)"
                  (include)="setSkipped($event, false)"
                  (addHere)="addForName($event)"
                  (removeHere)="removeForName($event)"
                />
              </section>
            }
          }

          <!-- Back / Next as well as the rail, because a rail is a map and these are
               the two moves. No "Finish": nothing is submitted here — every change saves
               as it is tapped. -->
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
            @if (stepIndex() < stepLabels.length - 1) {
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
  private readonly api = inject(LookupsApiService);
  private readonly questionnaire = inject(QuestionnaireApiService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly routeKey = signal<string>(this.route.snapshot.paramMap.get('key') ?? '');
  protected readonly name = signal<ProgramNameRow | null>(null);

  protected readonly loading = signal(true);
  protected readonly savingOffer = signal(false);

  private readonly errors = inject(ErrorCodeService);

  // --- The two steps ---------------------------------------------------------
  //
  // Which step is on stage lives in the URL, so a colleague pasting a link and a reload
  // after a save both land where the operator was rather than back at step one.

  /**
   * DECLARED BEFORE `stepIndex`, and that is load-bearing rather than tidy.
   *
   * `initialStep()` clamps a pasted `?step=` against this list's length, and class fields
   * initialise in source order — so with the signal above it, `this.stepLabels` was
   * `undefined` at the moment it was read. It survived because the clamp short-circuits:
   * with no `?step=` at all, `Number.isInteger(NaN)` is false and the length is never
   * reached. EVERY deep link that named a step threw — including the one this feature's own
   * create flow sends every freshly created name to.
   */
  protected readonly stepLabels: readonly string[] = [
    $localize`:@@pnd.step_offered:Where it is offered`,
    $localize`:@@pnd.step_asks:What applicants are asked`,
  ];

  protected readonly stepIndex = signal<number>(this.initialStep());

  /** The four loan types, for the assignment step's `@for`. Order is the platform's. */
  protected readonly categories = LOAN_CATEGORIES;

  protected readonly stepsAria = $localize`:@@pnd.steps_aria:Setting up this program name`;

  /**
   * The rail's status per step. "Where it is offered" is the only one that can be WRONG in
   * what it HOLDS: a name offered under no loan type is a name no bank can pick.
   */
  protected readonly wizardSteps = computed<WizardStepItem[]>(() => [
    {
      id: 'offered',
      label: this.stepLabels[0] ?? '',
      status: this.offeredCount() > 0 ? 'done' : 'invalid',
    },
    {
      id: 'asks',
      label: this.stepLabels[1] ?? '',
      // Never `invalid`, and never `todo`: what a loan type asks is a fact this step
      // reports and can widen, not an answer this name owes. It is unreachable while the
      // name is offered nowhere, because there is nothing to put a tab on.
      status: 'done',
      disabled: this.offeredCount() === 0,
    },
  ]);

  /** One sentence under the rail: what this step decides, and what it does not. */
  protected readonly stepCaption = computed<string>(() => {
    if (this.stepIndex() === 0) {
      return $localize`:@@pnd.step_offered_cap:${this.offeredCount()}:OFFERED: of ${this.categories.length}:TOTAL: loan types are on. This is what a bank's program picker filters on.`;
    }
    return $localize`:@@pnd.step_asks_cap:Ticks and unticks here apply to this program only. The loan type's own list is set on Questionnaire → Categories.`;
  });

  protected nextStepLabel(): string {
    return this.stepLabels[this.stepIndex() + 1] ?? '';
  }

  protected goToStep(index: number): void {
    const next = Math.min(Math.max(index, 0), this.stepLabels.length - 1);
    if (next === 1) void this.loadPool();
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

  /** How many of the four are on. Drives the rail's status and its caption. */
  protected readonly offeredCount = computed(() => this.name()?.categories.length ?? 0);

  // --- Step 2 · what applicants are asked ------------------------------------

  /**
   * The global question pool, read on first arrival at step 2 and not before.
   *
   * The heaviest read on the page — every active question with every answer. Deferring it
   * keeps the step that does not need it off its latency.
   */
  protected readonly pool = signal<readonly AskableQuestion[]>([]);
  /** What an applicant of this name is served per loan type; empty until the read lands. */
  protected readonly served = signal<readonly ServedCount[]>([]);
  protected readonly poolLoading = signal(false);
  protected readonly asksError = signal<string | null>(null);
  private poolRequested = false;
  /** Ids with a write in flight. This page writes per tap; the create flow batches. */
  protected readonly savingAsk = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly askSearch = signal('');
  private readonly askTab = signal<LoanCategory | null>(null);
  /**
   * Nothing is "pending" on this page: a tick is written at once and comes back in the
   * pool, so the board's session-pick layer is always empty here. One frozen instance
   * rather than a fresh `new Map()` per change detection, which would make the editor's
   * `computed`s recompute on every tick of the app.
   */
  /** Questions ticked during THIS visit, per loan type — what "You added" lists. */
  protected readonly sessionPicks = signal<AskedPicks>(new Map<LoanCategory, ReadonlySet<string>>());

  /** Questions this name skips, per loan type — as stored, re-read after every write. */
  private readonly skipped = signal<ReadonlyMap<LoanCategory, ReadonlySet<string>>>(
    new Map<LoanCategory, ReadonlySet<string>>(),
  );
  /** Codes this name may not skip: the engine's inputs and what its bank programs read. */
  protected readonly locks = signal<ReadonlyMap<string, 'engine' | 'program'>>(
    new Map<string, 'engine' | 'program'>(),
  );
  protected readonly excludedHere = computed<ReadonlySet<string>>(
    () => this.skipped().get(this.askCategory()) ?? new Set<string>(),
  );
  /** Questions this name ADDS, per loan type — as stored, re-read after every write. */
  private readonly addedByCat = signal<ReadonlyMap<LoanCategory, ReadonlySet<string>>>(
    new Map<LoanCategory, ReadonlySet<string>>(),
  );
  protected readonly addedHere = computed<ReadonlySet<string>>(
    () => this.addedByCat().get(this.askCategory()) ?? new Set<string>(),
  );

  /** Clamped to a loan type the name is actually offered under — see the create flow. */
  protected readonly askCategory = computed<LoanCategory>(() => {
    const on = this.name()?.categories ?? [];
    const picked = this.askTab();
    if (picked !== null && on.includes(picked)) return picked;
    return on[0] ?? 'personal';
  });

  protected setAskCategory(category: LoanCategory): void {
    this.askTab.set(category);
  }

  /**
   * A tick, written immediately. ADD-ONLY, and confirmed when the question is required.
   *
   * Requiredness is enforced from the live assignment table while customers are served a
   * frozen snapshot, so widening a required question refuses every application already in
   * flight in that loan type until it is answered.
   */
  protected askToAdd(row: AskedRow): void {
    if (!row.isRequired) {
      void this.writeAsk(row.id);
      return;
    }
    const type = categoryLabel(this.askCategory());
    this.modal.confirm({
      nzTitle: $localize`:@@pnd.req_title:Ask “${row.label}:QUESTION:” of every ${type}:TYPE: applicant?`,
      nzContent: $localize`:@@pnd.req_body:It must be answered, so every ${type}:TYPE: application already in progress has to answer it before it can be submitted.`,
      nzOkText: $localize`:@@pnd.req_ok:Ask it`,
      nzCancelText: $localize`:@@pnd.req_cancel:Leave it`,
      nzOnOk: () => {
        void this.writeAsk(row.id);
        // `nzOnOk` must RETURN TRUE: a void handler is read as a cancel, and the modal
        // then reports the operator's confirmation as a dismissal.
        return true;
      },
    });
  }

  /**
   * ADD-ONLY on the wire, not just in the UI. `setQuestionCategories` would replace the
   * whole set from a copy of the pool this page read minutes ago — so a loan type somebody
   * else ticked in between would be silently un-asked. The add endpoint has no field that
   * can express a removal.
   *
   * No optimistic patch: the write returns what actually moved, and the pool is re-read
   * from it. A tick that the server folded into "already asked" must not leave a row
   * looking added.
   */
  private async writeAsk(questionId: string): Promise<void> {
    if (this.savingAsk().has(questionId)) return;
    this.savingAsk.update((set) => new Set([...set, questionId]));
    this.asksError.set(null);
    try {
      const category = this.askCategory();
      await this.questionnaire.addQuestionCategoriesBulk([{ questionId, categories: [category] }]);
      const next = new Map(this.sessionPicks());
      next.set(category, new Set([...(next.get(category) ?? []), questionId]));
      this.sessionPicks.set(next);
      this.poolRequested = false;
      await this.loadPool();
    } catch (err) {
      this.asksError.set(this.localizedError(err));
    } finally {
      this.savingAsk.update((set) => {
        const next = new Set(set);
        next.delete(questionId);
        return next;
      });
    }
  }

  /**
   * Untick (or tick again) one question for THIS name, written at once. The loan type's own
   * assignment is not touched, so its other names keep asking it.
   */
  protected async setSkipped(row: AskedRow, skip: boolean): Promise<void> {
    if (this.savingAsk().has(row.id)) return;
    const category = this.askCategory();
    const set = new Set(this.skipped().get(category) ?? []);
    if (skip) set.add(row.id);
    else set.delete(row.id);
    this.savingAsk.update((ids) => new Set([...ids, row.id]));
    this.asksError.set(null);
    try {
      const saved = await this.api.setProgramNameQuestionExclusions(
        this.routeKey(),
        category,
        exclusionsToSave(this.pool(), set, this.locks()),
      );
      const next = new Map(this.skipped());
      next.set(category, new Set(saved));
      this.skipped.set(next);
      void this.loadServed();
    } catch (err) {
      this.asksError.set(this.localizedError(err));
      // A lock the page did not know about (a bank program filed since the read): re-read.
      void this.loadScope();
    } finally {
      this.savingAsk.update((ids) => {
        const next = new Set(ids);
        next.delete(row.id);
        return next;
      });
    }
  }

  /**
   * A tick under "Other questions": this name asks it too, written at once with the gate
   * sources it needs. Confirmed when REQUIRED, because an application already in progress
   * under this name then has to answer it before it can be submitted — the same consequence
   * the loan-type-wide tick names, for one program instead of all of them.
   */
  protected addForName(row: AskedRow): void {
    const question = this.pool().find((q) => q.id === row.id);
    if (question === undefined) return;
    const category = this.askCategory();
    const current = this.addedByCat().get(category) ?? new Set<string>();
    const ids = additionWithChain(this.pool(), question, category, this.sessionPicks(), current);
    const write = (): void =>
      void this.writeAdditions(category, new Set([...current, ...ids]), row.id);
    if (!row.isRequired) {
      write();
      return;
    }
    this.modal.confirm({
      nzTitle: $localize`:@@pnd.add_req_title:Ask “${row.label}:QUESTION:” of this program's applicants?`,
      nzContent: $localize`:@@pnd.add_req_body:It must be answered, so an application already in progress under this program has to answer it before it can be submitted. No other program changes.`,
      nzOkText: $localize`:@@pnd.req_ok:Ask it`,
      nzCancelText: $localize`:@@pnd.req_cancel:Leave it`,
      nzOnOk: () => {
        write();
        return true;
      },
    });
  }

  /** Untick an added question, written at once. A source another added one needs is locked. */
  protected removeForName(row: AskedRow): void {
    const category = this.askCategory();
    const set = new Set(this.addedByCat().get(category) ?? []);
    if (!set.delete(row.id)) return;
    void this.writeAdditions(category, set, row.id);
  }

  /**
   * Replace this name's added set for one loan type. When the server had to put a question
   * into the loan type for the first time it republished the questionnaire, and the pool this
   * page holds no longer says which rows are opt-in — so it is re-read; otherwise only the
   * served counts move.
   */
  private async writeAdditions(
    category: LoanCategory,
    set: ReadonlySet<string>,
    busyId: string,
  ): Promise<void> {
    if (this.savingAsk().has(busyId)) return;
    this.savingAsk.update((ids) => new Set([...ids, busyId]));
    this.asksError.set(null);
    try {
      const saved = await this.api.setProgramNameQuestionAdditions(
        this.routeKey(),
        category,
        additionsToSave(this.pool(), set),
      );
      const next = new Map(this.addedByCat());
      next.set(category, new Set(saved.added));
      this.addedByCat.set(next);
      if (saved.published) {
        this.poolRequested = false;
        await this.loadPool();
      } else {
        void this.loadServed();
      }
    } catch (err) {
      this.asksError.set(this.localizedError(err));
      void this.loadScope();
    } finally {
      this.savingAsk.update((ids) => {
        const next = new Set(ids);
        next.delete(busyId);
        return next;
      });
    }
  }

  private async loadScope(): Promise<void> {
    try {
      const scope = await this.api.programNameQuestionScope(this.routeKey());
      this.locks.set(new Map(scope.locks.map((l) => [l.code, l.reason])));
      this.skipped.set(
        new Map(
          Object.entries(scope.excludedByCategory).map(([category, ids]) => [
            category as LoanCategory,
            new Set(ids ?? []),
          ]),
        ),
      );
      this.addedByCat.set(
        new Map(
          Object.entries(scope.addedByCategory ?? {}).map(([category, ids]) => [
            category as LoanCategory,
            new Set(ids ?? []),
          ]),
        ),
      );
    } catch (err) {
      this.asksError.set(this.localizedError(err));
    }
  }

  /** Advisory: a failed read leaves the callout off rather than blocking the board. */
  private async loadServed(): Promise<void> {
    const key = this.routeKey();
    try {
      this.served.set(await this.questionnaire.servedForName(key));
    } catch {
      this.served.set([]);
    }
  }

  private async loadPool(): Promise<void> {
    if (this.poolRequested) return;
    this.poolRequested = true;
    this.poolLoading.set(true);
    try {
      const [tree] = await Promise.all([this.questionnaire.tree(), this.loadScope()]);
      this.pool.set(toAskablePool(tree));
      void this.loadServed();
    } catch (err) {
      this.asksError.set(this.localizedError(err));
      this.pool.set([]);
    } finally {
      this.poolLoading.set(false);
    }
  }

  ngOnInit(): void {
    // A deep link can land straight on step 2 — `newNameLanding` sends every freshly
    // created name there — so the pool read cannot wait for a click on the rail.
    if (this.stepIndex() === 1) void this.loadPool();
    void this.load();
  }

  // --- Display helpers -------------------------------------------------------

  protected nameOf(row: ProgramNameRow): string {
    return this.isAr ? row.labelAr : row.labelEn;
  }

  protected usageLabel(row: ProgramNameRow): string {
    return $localize`:@@pnd.usage_value:${row.usage.programs}:PROGRAMS: bank programs · ${row.usage.banks}:BANKS: banks`;
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

  /**
   * A rejection → the shared error-code vocabulary. Never a per-component English
   * string for a code the backend also reports (A22).
   */
  private localizedError(err: unknown): string {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })?.error;
    return this.errors.toLocalizedMessage(
      (envelope?.code ?? 'INTERNAL_ERROR') as Parameters<ErrorCodeService['toLocalizedMessage']>[0],
      envelope?.meta,
    );
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

