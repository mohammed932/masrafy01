/**
 * One surrogate product's workspace.
 *
 * THREE STEPS, NON-LINEAR — a settings screen, not a creation flow. Every step is reachable
 * at any time, each saves on its own terms, nothing is submitted at the end and there is no
 * Finish. Same posture, and the same shared rail, as the catalog name's own page.
 *
 *   ① How the income is worked out — the calculation, and the figures every bank starts from
 *   ② The lists it reads          — the operator-managed values the calculation looks up
 *   ③ Who uses it                 — catalog names, and the bank programs under them
 *
 * STEP ② IS THE POINT OF THE SCREEN. Compounds and compound classes used to live under
 * Manage values, three clicks from the only product whose calculation reads them: an operator
 * filing a compound under a class had no way to see which product they had just changed the
 * price of. The lists are DERIVED — `factKeysReadBy` gives the facts this rule reads, and each
 * fact's bound question reports which registry list its options came from — so nothing here
 * knows what a compound is. A product reading military grades would surface that list instead,
 * with no code change.
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
import {
  ArrowLeftOutline,
  ExclamationCircleOutline,
  InfoCircleOutline,
} from '@ant-design/icons-angular/icons';
import { SkeletonRowsComponent, WizardStepsComponent } from '@shared/ui';
import type { WizardStepItem } from '@shared/ui';
import { LookupValuesPanelComponent } from '@shared/lookups/lookup-values-panel.component';
import { ParentClassBoardComponent } from '@shared/lookups/parent-class-board.component';
import { enumerationTypeLabel } from '@shared/lookups/lookup-constants';
import { IncomeAssumptionSectionComponent } from '@shared/income-rule/income-assumption-section.component';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
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

/** One operator-managed list this product's calculation reads. */
interface ReadList {
  readonly type: string;
  readonly title: string;
  readonly description: string;
  /** True when values of this type are filed under a parent list — it gets the board. */
  readonly hasBoard: boolean;
}

@Component({
  selector: 'app-surrogate-product-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  providers: [provideNzIconsPatch([ArrowLeftOutline, ExclamationCircleOutline, InfoCircleOutline])],
  template: `
    <section class="page">
      <a class="back" routerLink="/program-catalog/products">
        <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@spd.back">All surrogate products</span>
      </a>

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

                <div class="actions">
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    [disabled]="!dirty() || saving()"
                    [nzLoading]="saving()"
                    (click)="save()"
                  >
                    <span i18n="@@spd.save">Save the calculation</span>
                  </button>
                </div>
              </section>
            }

            @case (1) {
              <section class="panel" [attr.aria-label]="steps()[1]?.label ?? ''">
                @if (readLists().length === 0) {
                  <!-- Stated, never an empty section. A calculation that reads no
                     operator-managed list is a real and common answer — every figure
                     comes from a number the applicant types — and an empty panel would
                     read as a screen that failed to load. -->
                  <p class="notice">
                    <span nz-icon nzType="info-circle" nzTheme="outline"></span>
                    <span i18n="@@spd.lists_none"
                      >This calculation reads no operator-managed list. Every figure it uses comes
                      from what the applicant answers, so there is nothing to curate here.</span
                    >
                  </p>
                } @else {
                  @for (list of readLists(); track list.type) {
                    <app-lookup-values-panel
                      [type]="list.type"
                      [title]="list.title"
                      [description]="list.description"
                      (changed)="onListChanged()"
                    />
                  }

                  @if (boardList(); as board) {
                    <app-parent-class-board
                      [childType]="board.type"
                      [parentType]="board.parentType"
                    />
                  }
                }
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
  private readonly errors = inject(ErrorCodeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  private readonly key = this.route.snapshot.paramMap.get('key') ?? '';

  protected readonly loading = signal(true);
  protected readonly product = signal<SurrogateProductDetail | null>(null);
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

  // --- the lists this calculation reads --------------------------------------

  private readonly facts = computed(() =>
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
    const keys = new Set(factKeysReadBy(this.ruleSteps(), this.ruleGates()));
    const byKey = new Map(this.facts().map((f) => [f.key, f]));
    const seen = new Set<string>();
    const out: ReadList[] = [];

    for (const key of keys) {
      const question = byKey.get(key)?.question;
      const type = question?.optionsEnumerationType;
      if (!type || seen.has(type)) continue;
      seen.add(type);
      out.push({
        type,
        title: enumerationTypeLabel(type),
        description: $localize`:@@spd.list_desc:The values an applicant can pick when answering “${question?.label ?? key}:question:”.`,
        hasBoard: Boolean(question?.parentEnumerationType),
      });

      // The PARENT list too — a bank keys its table by the class while the customer picks
      // a value by name, so an operator who cannot see the classes cannot file anything.
      const parentType = question?.parentEnumerationType;
      if (parentType && !seen.has(parentType)) {
        seen.add(parentType);
        out.push({
          type: parentType,
          title: enumerationTypeLabel(parentType),
          description: $localize`:@@spd.parent_desc:The classes a bank keys its table by. Each value above is filed under one of these.`,
          hasBoard: false,
        });
      }
    }
    return out;
  });

  /** The child/parent pair the assignment board is about, when there is one. */
  protected readonly boardList = computed<{ type: string; parentType: string } | null>(() => {
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
    $localize`:@@spd.step_rule:How the income is worked out`,
    $localize`:@@spd.step_lists:The lists it reads`,
    $localize`:@@spd.step_uses:Who uses it`,
  ];

  /**
   * Status is derived and only step ① can ask for attention — an unsaved edit.
   *
   * Step ② is never wrong: a curated list is the operator's judgement, not a validation.
   * Step ③ is a report, and a product nothing sells yet is a legitimate state, not an error.
   */
  protected readonly steps = computed<WizardStepItem[]>(() => {
    const p = this.product();
    return [
      {
        id: 'rule',
        label: this.stepLabels[0] ?? '',
        status: this.dirty() ? 'invalid' : p?.strategy ? 'done' : 'todo',
      },
      {
        id: 'lists',
        label: this.stepLabels[1] ?? '',
        status: this.readLists().length > 0 ? 'done' : 'todo',
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
        return $localize`:@@spd.cap_rule:What the bank reads instead of a payslip, and the figures every bank filing under this product starts from.`;
      case 1:
        return $localize`:@@spd.cap_lists:The values an applicant picks from, and the classes a bank keys its table by. Curated here because this is the calculation that reads them.`;
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
    void this.load();
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
   * `steps`/`gates`/`output` are deliberately NOT sent: they are the product's structure,
   * which this screen renders but cannot author, so re-posting the copy it rendered would
   * let a stale screen replace the product itself. The server overlays the stored structure
   * onto a figures-only write.
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
