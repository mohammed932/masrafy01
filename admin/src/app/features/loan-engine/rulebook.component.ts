import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  ArrowRightOutline,
  PlusOutline,
  SafetyCertificateOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { SkeletonRowsComponent, openFormDrawer } from '@shared/ui';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { LOAN_CATEGORIES, categoryLabel, type LoanCategory } from '@core/loan-category';
import {
  LOAN_ENGINE_EFFECTS,
  LoanEngineApiService,
  type Criterion,
  type LoanEngineEffect,
  type LoanEngineProgramSlice,
  type LoanEngineRuleView,
  type LoanEngineRulebook,
  type LoanEngineRulebookProgram,
  type LoanEngineRulebookQuestion,
} from './loan-engine.api.service';
import {
  bandText,
  effectLabel,
  figureText,
  gateReasonErrorCode,
  noMatchText,
  readOnlyLabel,
} from './loan-engine.labels';
import { EffectRowsSheetComponent, type EffectRowsSheetData } from './effect-rows.sheet';
import { ConditionsSheetComponent, type ConditionsSheetData } from './conditions.sheet';

/** One "if the answer is … then …" line of a rule. */
interface Clause {
  when: string;
  then: string;
}

interface RuleVm {
  key: string;
  questionCode: string;
  question: string;
  effect: LoanEngineEffect;
  effectName: string;
  clauses: Clause[];
  otherwise: string | null;
  refusesOtherwise: boolean;
}

interface ConditionVm {
  id: string;
  anyOf: string[];
  reason: string;
}

interface ProgramVm {
  p: LoanEngineRulebookProgram;
  rules: RuleVm[];
  conditions: ConditionVm[];
  elsewhere: string[];
  haystack: string;
}

interface CategoryGroup {
  category: LoanCategory;
  programs: ProgramVm[];
}

/**
 * Feature 013 — the Loan Engine's first view: the RULES, read program by program.
 *
 * Each program says, in sentences, who it quotes (its conditions) and what each answer
 * changes (its tables on a linked question's figure). Nothing here is a second copy of a
 * rule: a line opens the same sheet the by-question matrix opens, against the same slice
 * the server builds, so the two views are two readings of one row.
 */
@Component({
  selector: 'app-loan-engine-rulebook',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    SkeletonRowsComponent,
  ],
  providers: [
    provideNzIconsPatch([ArrowRightOutline, PlusOutline, SafetyCertificateOutline, SearchOutline]),
  ],
  template: `
    <div class="rb__bar">
      <div class="rb__cats" role="group" [attr.aria-label]="catsAria">
        <button
          type="button"
          class="rb__cat"
          [class.on]="category() === null"
          [attr.aria-pressed]="category() === null"
          (click)="category.set(null)"
          i18n="@@lengine.cat.all"
        >
          All
        </button>
        @for (c of categories; track c) {
          <button
            type="button"
            class="rb__cat"
            [class.on]="category() === c"
            [attr.aria-pressed]="category() === c"
            [style.--cat]="catColor(c)"
            (click)="category.set(c)"
          >
            <span class="rb__dot" aria-hidden="true"></span>{{ catLabel(c) }}
          </button>
        }
      </div>
      <nz-input-group class="rb__search" [nzPrefix]="searchIcon">
        <input
          nz-input
          type="search"
          [formControl]="search"
          [placeholder]="searchPlaceholder"
          [attr.aria-label]="searchPlaceholder"
        />
      </nz-input-group>
      <ng-template #searchIcon
        ><span nz-icon nzType="search" aria-hidden="true"></span
      ></ng-template>
    </div>

    @if (error(); as e) {
      <p class="rb__error" role="alert">{{ e }}</p>
    }

    @if (loading()) {
      <app-skeleton-rows [rows]="6" [cols]="[3, 2, 5]" [ariaLabel]="loadingAria" />
    } @else {
      <p class="rb__summary" aria-live="polite">{{ summary() }}</p>

      @for (g of groups(); track g.category) {
        <section class="rb__group" [style.--cat]="catColor(g.category)">
          <h2 class="rb__group-h">
            <span class="rb__dot" aria-hidden="true"></span>{{ catLabel(g.category) }}
          </h2>

          @for (vm of g.programs; track vm.p.programCode) {
            <article class="rb__prog" [attr.aria-labelledby]="'rb-' + vm.p.programCode">
              <header class="rb__prog-h">
                <div class="rb__who">
                  <span class="rb__bank">{{ vm.p.bankName }}</span>
                  <h3 class="rb__name" [id]="'rb-' + vm.p.programCode">
                    {{ vm.p.friendlyName }}
                  </h3>
                  <code class="rb__code">{{ vm.p.programCode }}</code>
                </div>
                <div class="rb__acts">
                  @if (canEdit()) {
                    <button nz-button nzSize="small" type="button" (click)="startAdd(vm.p)">
                      <span nz-icon nzType="plus" aria-hidden="true"></span>
                      <span i18n="@@lengine.rb.add_rule">Add rule</span>
                    </button>
                  }
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    (click)="openConditions(vm.p)"
                    i18n="@@lengine.rb.edit_conditions"
                  >
                    Conditions
                  </button>
                </div>
              </header>

              <div class="rb__block">
                <h4 class="rb__label" i18n="@@lengine.rb.who_quotes">Who it quotes</h4>
                @if (vm.conditions.length === 0) {
                  <p class="rb__none" i18n="@@lengine.rb.no_conditions">
                    Everyone in this loan type — no condition refuses an applicant.
                  </p>
                } @else {
                  <ul class="rb__conds">
                    @for (c of vm.conditions; track c.id) {
                      <li class="rb__cond">
                        <span nz-icon nzType="safety-certificate" aria-hidden="true"></span>
                        <span>
                          <span i18n="@@lengine.rb.only_if">Only if</span>
                          @for (a of c.anyOf; track $index; let last = $last) {
                            <strong class="rb__crit">{{ a }}</strong>
                            @if (!last) {
                              <span class="rb__or" i18n="@@lengine.rb.or">or</span>
                            }
                          }
                          <span class="rb__refused">
                            <span i18n="@@lengine.rb.otherwise_refused">otherwise refused:</span>
                            {{ c.reason }}
                          </span>
                        </span>
                      </li>
                    }
                  </ul>
                }
              </div>

              <div class="rb__block">
                <h4 class="rb__label" i18n="@@lengine.rb.what_changes">What the answers change</h4>
                @if (vm.rules.length === 0) {
                  <p class="rb__none" i18n="@@lengine.rb.no_rules">
                    No answer changes this program's figures yet.
                  </p>
                } @else {
                  <ul class="rb__rules">
                    @for (r of vm.rules; track r.key) {
                      <li>
                        <button
                          type="button"
                          class="rb__rule"
                          [disabled]="opening() !== null"
                          (click)="openRule(vm.p, r.questionCode, r.effect)"
                        >
                          <span class="rb__rule-h">
                            <span class="rb__q">{{ r.question }}</span>
                            <span class="rb__eff">{{ r.effectName }}</span>
                          </span>
                          <span class="rb__clauses">
                            @for (cl of r.clauses; track $index) {
                              <span class="rb__clause">
                                <span class="rb__if">{{ cl.when }}</span>
                                <span
                                  nz-icon
                                  nzType="arrow-right"
                                  class="rb__arrow"
                                  aria-hidden="true"
                                ></span>
                                <span class="rb__then">{{ cl.then }}</span>
                              </span>
                            }
                            @if (r.otherwise !== null) {
                              <span class="rb__clause rb__clause--else">
                                <span class="rb__if" i18n="@@lengine.rb.anything_else"
                                  >any other answer</span
                                >
                                <span
                                  nz-icon
                                  nzType="arrow-right"
                                  class="rb__arrow"
                                  aria-hidden="true"
                                ></span>
                                <span
                                  class="rb__then"
                                  [class.rb__then--refuse]="r.refusesOtherwise"
                                  >{{ r.otherwise }}</span
                                >
                              </span>
                            }
                          </span>
                        </button>
                      </li>
                    }
                  </ul>
                }
                @if (adding() === vm.p.programCode) {
                  <ng-container
                    [ngTemplateOutlet]="addForm"
                    [ngTemplateOutletContext]="{ $implicit: vm.p }"
                  />
                }
              </div>

              @if (vm.elsewhere.length > 0) {
                <p class="rb__elsewhere">
                  <span i18n="@@lengine.rb.elsewhere">Also read, edited on the program:</span>
                  {{ vm.elsewhere.join(' · ') }}
                </p>
              }
            </article>
          }
        </section>
      } @empty {
        @if (quiet().length === 0) {
          <p class="rb__none" i18n="@@lengine.rb.nothing_matches">No program matches.</p>
        }
      }

      @if (quiet().length > 0) {
        <details class="rb__quiet" [open]="groups().length === 0">
          <summary i18n="@@lengine.rb.quiet">
            {{ quiet().length }} programs with no rules yet
          </summary>
          <ul class="rb__quiet-list">
            @for (p of quiet(); track p.programCode) {
              <li class="rb__quiet-row">
                <span class="rb__quiet-who" [style.--cat]="catColor(p.category)">
                  <span class="rb__dot" aria-hidden="true"></span>
                  <span class="rb__bank">{{ p.bankName }}</span>
                  <span class="rb__quiet-name">{{ p.friendlyName }}</span>
                  @if (p.elsewhere.length > 0) {
                    <span class="rb__tag" i18n="@@lengine.rb.has_plans">tables on the program</span>
                  }
                </span>
                @if (canEdit()) {
                  <span class="rb__acts">
                    <button
                      nz-button
                      nzSize="small"
                      nzType="text"
                      type="button"
                      (click)="startAdd(p)"
                    >
                      <span nz-icon nzType="plus" aria-hidden="true"></span>
                      <span i18n="@@lengine.rb.add_rule">Add rule</span>
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzType="text"
                      type="button"
                      (click)="openConditions(p)"
                      i18n="@@lengine.rb.add_condition"
                    >
                      Add condition
                    </button>
                  </span>
                }
                @if (adding() === p.programCode) {
                  <ng-container
                    [ngTemplateOutlet]="addForm"
                    [ngTemplateOutletContext]="{ $implicit: p }"
                  />
                }
              </li>
            }
          </ul>
        </details>
      }
    }

    <ng-template #addForm let-p>
      <form class="rb__add" (ngSubmit)="confirmAdd(p)">
        <div class="rb__add-field">
          <span [id]="'rb-addq-' + p.programCode" i18n="@@lengine.rb.add_when"
            >When the answer to</span
          >
          <nz-select
            [attr.aria-labelledby]="'rb-addq-' + p.programCode"
            [formControl]="addQuestion"
            nzShowSearch
            [nzPlaceHolder]="pickQuestion"
            class="rb__add-q"
          >
            @for (q of questionsFor(p.category); track q.questionCode) {
              <nz-option [nzValue]="q.questionCode" [nzLabel]="qLabel(q)"></nz-option>
            }
          </nz-select>
        </div>
        <div class="rb__add-field">
          <span [id]="'rb-adde-' + p.programCode" i18n="@@lengine.rb.add_changes">changes its</span>
          <nz-select
            [formControl]="addEffect"
            class="rb__add-e"
            [attr.aria-labelledby]="'rb-adde-' + p.programCode"
          >
            @for (e of effectsFor(addQuestionCode()); track e) {
              <nz-option [nzValue]="e" [nzLabel]="effectName(e)"></nz-option>
            }
          </nz-select>
        </div>
        <span class="rb__add-acts">
          <button
            nz-button
            nzType="primary"
            type="submit"
            [disabled]="addQuestionCode() === ''"
            [nzLoading]="opening() !== null"
            i18n="@@lengine.rb.add_continue"
          >
            Write the rule
          </button>
          <button
            nz-button
            nzType="text"
            type="button"
            (click)="adding.set(null)"
            i18n="@@lengine.rb.add_cancel"
          >
            Cancel
          </button>
        </span>
      </form>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: var(--space-4);
        min-inline-size: 0;
      }
      .rb__bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .rb__cats {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }
      .rb__cat {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        min-block-size: 2.25rem;
        padding: var(--space-1) var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-default);
        color: var(--color-text-secondary);
        cursor: pointer;
        transition:
          background-color 160ms ease-out,
          border-color 160ms ease-out,
          color 160ms ease-out;
      }
      .rb__cat:hover {
        color: var(--color-text-primary);
      }
      .rb__cat.on {
        border-color: var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
      }
      .rb__dot {
        inline-size: 0.5rem;
        block-size: 0.5rem;
        flex: none;
        border-radius: var(--radius-pill);
        background: var(--cat, var(--color-cat-other));
      }
      .rb__search {
        inline-size: min(100%, 22rem);
      }
      .rb__summary {
        margin: 0;
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums;
      }
      .rb__group {
        display: grid;
        gap: var(--space-3);
      }
      .rb__group + .rb__group {
        margin-block-start: var(--space-4);
      }
      .rb__group-h {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
      }
      .rb__group-h .rb__dot {
        inline-size: 0.625rem;
        block-size: 0.625rem;
      }
      .rb__prog {
        display: grid;
        gap: var(--space-4);
        padding: var(--space-4) var(--space-5);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
      }
      .rb__prog-h {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .rb__who {
        display: grid;
        gap: var(--space-0-5);
        min-inline-size: 0;
      }
      .rb__bank {
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }
      .rb__name {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        text-wrap: balance;
      }
      .rb__code {
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
      }
      .rb__acts {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .rb__block {
        display: grid;
        gap: var(--space-2);
      }
      .rb__label {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
      }
      .rb__none {
        margin: 0;
        color: var(--color-text-tertiary);
      }
      .rb__conds,
      .rb__rules,
      .rb__quiet-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-2);
      }
      .rb__cond {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        line-height: 1.6;
      }
      .rb__cond > [nz-icon] {
        color: var(--color-tonal-accent-ink);
      }
      .rb__crit {
        font-weight: var(--font-weight-semibold);
      }
      .rb__or {
        color: var(--color-text-tertiary);
      }
      .rb__crit,
      .rb__or {
        margin-inline-start: var(--space-1);
      }
      .rb__refused {
        margin-inline-start: var(--space-1);
        color: var(--color-error);
      }
      .rb__rule {
        display: grid;
        grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr);
        gap: var(--space-2) var(--space-4);
        inline-size: 100%;
        padding: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-page);
        color: var(--color-text-primary);
        text-align: start;
        cursor: pointer;
        transition:
          border-color 160ms ease-out,
          background-color 160ms ease-out;
      }
      .rb__rule:hover:not(:disabled) {
        border-color: var(--color-brand-primary);
        background: var(--color-surface-row-hover);
      }
      .rb__rule:disabled {
        cursor: progress;
      }
      @media (max-width: 720px) {
        .rb__rule {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .rb__rule-h {
        display: grid;
        align-content: start;
        gap: var(--space-1);
      }
      .rb__q {
        font-weight: var(--font-weight-semibold);
      }
      .rb__eff {
        justify-self: start;
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
      }
      .rb__clauses {
        display: flex;
        flex-wrap: wrap;
        align-content: start;
        gap: var(--space-1-5);
      }
      .rb__clause {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        max-inline-size: 100%;
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-sm);
        background: var(--color-surface-default);
      }
      .rb__clause--else {
        border-style: dashed;
      }
      .rb__if,
      .rb__then,
      .rb__crit {
        unicode-bidi: isolate;
      }
      .rb__if {
        color: var(--color-text-secondary);
        overflow-wrap: anywhere;
      }
      .rb__arrow {
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
      }
      :host-context([dir='rtl']) .rb__arrow {
        transform: scaleX(-1);
      }
      .rb__then {
        font-weight: var(--font-weight-semibold);
        font-family: var(--font-family-numeric, inherit);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .rb__then--refuse {
        color: var(--color-error);
      }
      .rb__elsewhere {
        margin: 0;
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--border-default);
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }
      .rb__quiet {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
      }
      .rb__quiet > summary {
        padding: var(--space-3) var(--space-5);
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
      }
      .rb__quiet-list {
        gap: 0;
        padding-block-end: var(--space-2);
      }
      .rb__quiet-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-5);
        border-block-start: 1px solid var(--border-default);
      }
      .rb__quiet-who {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .rb__quiet-name {
        color: var(--color-text-primary);
      }
      .rb__tag {
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
      }
      .rb__add {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: var(--space-3);
        inline-size: 100%;
        padding: var(--space-3);
        border: 1px dashed var(--color-brand-primary);
        border-radius: var(--radius-md);
        background: var(--color-tonal-accent-bg);
      }
      .rb__add-field {
        display: grid;
        gap: var(--space-1);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }
      .rb__add-q {
        inline-size: min(22rem, 70vw);
      }
      .rb__add-e {
        inline-size: 12rem;
      }
      .rb__add-acts {
        display: inline-flex;
        gap: var(--space-2);
      }
      .rb__cat:focus-visible,
      .rb__rule:focus-visible,
      .rb__quiet > summary:focus-visible {
        outline: 2px solid var(--focus-ring-color);
        outline-offset: 2px;
      }
      .rb__error {
        margin: 0;
        color: var(--color-error);
      }
      @media (prefers-reduced-motion: reduce) {
        .rb__cat,
        .rb__rule {
          transition: none;
        }
      }
    `,
  ],
})
export class LoanEngineRulebookComponent {
  private readonly api = inject(LoanEngineApiService);
  private readonly drawer = inject(NzDrawerService);
  private readonly errors = inject(ErrorCodeService);
  private readonly isAr = document.documentElement.lang.startsWith('ar');

  /** super_admin writes; everyone else reads (the page decides). */
  readonly canEdit = input(false);

  readonly categories = LOAN_CATEGORIES;
  readonly catsAria = $localize`:@@lengine.cats_aria:Loan type`;
  readonly searchPlaceholder = $localize`:@@lengine.rb.search:Search a bank, program or question`;
  readonly loadingAria = $localize`:@@lengine.rb.loading:Loading the rules`;
  readonly pickQuestion = $localize`:@@lengine.rb.pick_question:Pick a question`;

  readonly category = signal<LoanCategory | null>(null);
  readonly search = new FormControl<string>('', { nonNullable: true });
  private readonly searchText = toSignal(this.search.valueChanges, { initialValue: '' });

  readonly book = signal<LoanEngineRulebook | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** `programCode:questionCode:effect` while its sheet is being prepared. */
  readonly opening = signal<string | null>(null);

  readonly adding = signal<string | null>(null);
  readonly addQuestion = new FormControl<string>('', { nonNullable: true });
  readonly addEffect = new FormControl<LoanEngineEffect>('rate', { nonNullable: true });
  readonly addQuestionCode = toSignal(this.addQuestion.valueChanges, { initialValue: '' });

  private readonly questionsByCode = computed(
    () => new Map((this.book()?.questions ?? []).map((q) => [q.questionCode, q])),
  );
  private readonly questionsByFact = computed(
    () => new Map((this.book()?.questions ?? []).map((q) => [q.factKey, q])),
  );

  private readonly programs = computed<ProgramVm[]>(() =>
    (this.book()?.programs ?? []).map((p) => this.vmOf(p)),
  );

  private readonly filtered = computed(() => {
    const cat = this.category();
    const needle = this.searchText().trim().toLowerCase();
    return this.programs().filter(
      (vm) =>
        (cat === null || vm.p.category === cat) && (needle === '' || vm.haystack.includes(needle)),
    );
  });

  readonly groups = computed<CategoryGroup[]>(() => {
    const withRules = this.filtered().filter(
      (vm) => vm.rules.length > 0 || vm.conditions.length > 0,
    );
    return LOAN_CATEGORIES.map((category) => ({
      category,
      programs: withRules.filter((vm) => vm.p.category === category),
    })).filter((g) => g.programs.length > 0);
  });

  readonly quiet = computed(() =>
    this.filtered()
      .filter((vm) => vm.rules.length === 0 && vm.conditions.length === 0)
      .map((vm) => vm.p),
  );

  readonly summary = computed(() => {
    const shown = this.filtered();
    const programs = shown.filter((vm) => vm.rules.length > 0 || vm.conditions.length > 0).length;
    const rules = shown.reduce((n, vm) => n + vm.rules.length, 0);
    const conditions = shown.reduce((n, vm) => n + vm.conditions.length, 0);
    return $localize`:@@lengine.rb.summary:${rules}:rules: answer rules and ${conditions}:conditions: conditions across ${programs}:programs: of ${shown.length}:total: programs`;
  });

  constructor() {
    void this.load();
  }

  catLabel(c: LoanCategory): string {
    return categoryLabel(c);
  }

  catColor(c: LoanCategory): string {
    return `var(--color-cat-${c})`;
  }

  effectName(e: LoanEngineEffect): string {
    return effectLabel(e);
  }

  qLabel(q: LoanEngineRulebookQuestion): string {
    return this.isAr ? q.labelAr : q.labelEn;
  }

  questionsFor(category: LoanCategory): LoanEngineRulebookQuestion[] {
    return (this.book()?.questions ?? []).filter((q) => q.categories.includes(category));
  }

  /** Extra income is a share of a typed amount, so only a NUMBER question can carry it. */
  effectsFor(questionCode: string): readonly LoanEngineEffect[] {
    const q = this.questionsByCode().get(questionCode);
    return q === undefined || q.type === 'NUMERIC'
      ? LOAN_ENGINE_EFFECTS
      : LOAN_ENGINE_EFFECTS.filter((e) => e !== 'extra_income');
  }

  startAdd(p: LoanEngineRulebookProgram): void {
    this.addQuestion.setValue('');
    this.addEffect.setValue('rate');
    this.error.set(null);
    this.adding.set(p.programCode);
  }

  confirmAdd(p: LoanEngineRulebookProgram): void {
    const code = this.addQuestion.value;
    if (code === '') return;
    const effect = this.effectsFor(code).includes(this.addEffect.value)
      ? this.addEffect.value
      : 'rate';
    void this.openRule(p, code, effect);
  }

  /** The same sheet the by-question matrix opens, on the slice the server builds. */
  async openRule(
    p: LoanEngineRulebookProgram,
    questionCode: string,
    effect: LoanEngineEffect,
  ): Promise<void> {
    this.opening.set(`${p.programCode}:${questionCode}:${effect}`);
    this.error.set(null);
    try {
      const detail = await this.api.question(questionCode);
      const slice = detail.programs.find((x) => x.programCode === p.programCode);
      const state = slice?.effects[effect];
      if (slice === undefined || state === undefined) return;
      if (!state.editable) {
        this.error.set(`${effectLabel(effect)} — ${readOnlyLabel(state.readOnlyReason)}`);
        return;
      }
      const question: EffectRowsSheetData['question'] = {
        questionCode: detail.questionCode,
        type: detail.type,
        labelAr: detail.labelAr,
        labelEn: detail.labelEn,
        categories: detail.categories,
        factKey: detail.factKey,
        options: detail.options,
      };
      const ref = openFormDrawer<
        EffectRowsSheetComponent,
        EffectRowsSheetData,
        LoanEngineProgramSlice
      >(this.drawer, {
        content: EffectRowsSheetComponent,
        data: { question, program: slice, effect, canEdit: this.canEdit() },
        width: 'min(720px, calc(100vw - 32px))',
      });
      ref.afterClose.subscribe((fresh) => {
        if (fresh !== undefined && fresh !== null) {
          this.adding.set(null);
          void this.load();
        }
      });
    } catch (err) {
      this.showError(err);
    } finally {
      this.opening.set(null);
    }
  }

  openConditions(p: LoanEngineRulebookProgram): void {
    const questions = this.questionsFor(p.category).map((q) => ({
      questionCode: q.questionCode,
      type: q.type,
      labelAr: q.labelAr,
      labelEn: q.labelEn,
      categories: q.categories,
      factKey: q.factKey,
      readingProgramCount: 0,
    }));
    const ref = openFormDrawer<
      ConditionsSheetComponent,
      ConditionsSheetData,
      LoanEngineProgramSlice
    >(this.drawer, {
      content: ConditionsSheetComponent,
      data: { program: p, questions, canEdit: this.canEdit() },
      width: 'min(760px, calc(100vw - 32px))',
    });
    ref.afterClose.subscribe((fresh) => {
      if (fresh !== undefined && fresh !== null) void this.load();
    });
  }

  private async load(): Promise<void> {
    try {
      this.book.set(await this.api.rulebook());
    } catch (err) {
      this.showError(err);
    } finally {
      this.loading.set(false);
    }
  }

  private vmOf(p: LoanEngineRulebookProgram): ProgramVm {
    const rules = p.rules.map((r) => this.ruleVm(p, r));
    const conditions = p.conditions.map(
      (c): ConditionVm => ({
        id: c.id,
        anyOf: c.anyOf.map((l) => {
          const q =
            (l.questionCode === null ? undefined : this.questionsByCode().get(l.questionCode)) ??
            this.questionsByFact().get(l.factKey);
          const name = q === undefined ? l.factKey : this.qLabel(q);
          return `${name}: ${bandText(l.criterion, (o) => this.optionLabel(q, o))}`;
        }),
        reason: this.errors.toLocalizedMessage(gateReasonErrorCode(c.reasonCode) as ErrorCode),
      }),
    );
    const byReason = new Map<string, string[]>();
    for (const e of p.elsewhere) {
      const reason = readOnlyLabel(e.reason);
      const list = byReason.get(reason) ?? [];
      const name = effectLabel(e.effect);
      if (!list.includes(name)) list.push(name);
      byReason.set(reason, list);
    }
    const elsewhere = [...byReason].map(([reason, names]) => `${names.join(', ')} (${reason})`);
    const haystack = [
      p.bankName,
      p.friendlyName,
      p.programCode,
      ...rules.map((r) => r.question),
      ...conditions.flatMap((c) => c.anyOf),
    ]
      .join(' ')
      .toLowerCase();
    return { p, rules, conditions, elsewhere, haystack };
  }

  private ruleVm(p: LoanEngineRulebookProgram, r: LoanEngineRuleView): RuleVm {
    const q = this.questionsByCode().get(r.questionCode);
    const clauses: Clause[] = [];
    if (r.effect === 'extra_income') {
      const value = r.rows[0]?.value ?? '0';
      clauses.push({
        when: $localize`:@@lengine.rb.counts:the bank counts`,
        then: $localize`:@@lengine.rb.counts_of:${figureText('extra_income', value)}:share: of it as income`,
      });
    } else {
      // Options that share one figure are said once: "Germany, Japan, Korea → 7,000,000 EGP".
      const byOption = new Map<string, string[]>();
      for (const row of r.rows) {
        if (row.criterion !== null && 'option' in row.criterion) {
          const list = byOption.get(row.value) ?? [];
          list.push(this.optionLabel(q, row.criterion.option));
          byOption.set(row.value, list);
        } else {
          clauses.push({
            when: this.criterionLine(q, row.criterion),
            then: figureText(r.effect, row.value),
          });
        }
      }
      for (const [value, labels] of byOption) {
        clauses.push({
          when: labels.join(this.isAr ? '، ' : ', '),
          then: figureText(r.effect, value),
        });
      }
    }
    return {
      key: `${p.programCode}:${r.questionCode}:${r.effect}`,
      questionCode: r.questionCode,
      question: q === undefined ? r.questionCode : this.qLabel(q),
      effect: r.effect,
      effectName: effectLabel(r.effect),
      clauses,
      otherwise: r.effect === 'extra_income' ? null : noMatchText(r.onNoMatch),
      refusesOtherwise: r.onNoMatch === 'reject',
    };
  }

  private criterionLine(q: LoanEngineRulebookQuestion | undefined, c: Criterion | null): string {
    return bandText(c, (o) => this.optionLabel(q, o));
  }

  private optionLabel(q: LoanEngineRulebookQuestion | undefined, code: string): string {
    const o = q?.options.find((x) => x.code === code);
    return o === undefined ? code : this.isAr ? o.labelAr : o.labelEn;
  }

  private showError(err: unknown): void {
    const body =
      err instanceof HttpErrorResponse
        ? (err.error as { code?: string; meta?: Record<string, unknown> })
        : null;
    this.error.set(
      this.errors.toLocalizedMessage((body?.code ?? 'INTERNAL_ERROR') as ErrorCode, body?.meta),
    );
  }
}
