import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PageHeaderComponent, openFormDrawer } from '@shared/ui';
import { AuthService } from '@core/auth/auth.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { LOAN_CATEGORIES, categoryLabel, type LoanCategory } from '@core/loan-category';
import { QuestionnaireApiService } from '../questionnaire/questionnaire.api.service';
import {
  LOAN_ENGINE_EFFECTS,
  LoanEngineApiService,
  type EffectState,
  type LoanEngineEffect,
  type LoanEngineProgramSlice,
  type LoanEngineQuestionDetail,
  type LoanEngineQuestionSummary,
} from './loan-engine.api.service';
import { effectLabel, readOnlyLabel } from './loan-engine.labels';
import { EffectRowsSheetComponent, type EffectRowsSheetData } from './effect-rows.sheet';
import { ConditionsSheetComponent, type ConditionsSheetData } from './conditions.sheet';

/**
 * Feature 013 — the Loan Engine: one question's effects on every bank program, and each
 * program's eligibility conditions.
 *
 * Rules are PER PROGRAM (Principle II): a cell is one bank's figures for one effect of the
 * question picked on the left. A table owned elsewhere — inherited from a product's plans,
 * or keyed on another answer — is shown with the reason and is not edited from here, so this
 * screen and the program form can never hold two versions of one table.
 */
@Component({
  selector: 'app-loan-engine-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NzButtonModule, NzInputModule, NzSpinModule, PageHeaderComponent],
  template: `
    <section class="page">
      <app-page-header [eyebrow]="eyebrow" [title]="titleText" [subtitle]="subtitleText" />

      <div class="le">
        <aside class="le__list" [attr.aria-label]="listAria">
          <input
            nz-input
            type="search"
            class="le__search"
            [formControl]="search"
            [placeholder]="searchPlaceholder"
            [attr.aria-label]="searchPlaceholder"
          />
          <div class="le__cats" role="group" [attr.aria-label]="catsAria">
            <button
              type="button"
              class="le__cat"
              [class.on]="category() === null"
              (click)="category.set(null)"
              i18n="@@lengine.cat.all"
            >
              All
            </button>
            @for (c of categories; track c) {
              <button
                type="button"
                class="le__cat"
                [class.on]="category() === c"
                (click)="category.set(c)"
              >
                {{ catLabel(c) }}
              </button>
            }
          </div>
          @if (loadingList()) {
            <nz-spin nzSimple />
          } @else {
            <ul class="le__qs">
              @for (q of shownQuestions(); track q.questionCode) {
                <li>
                  <button
                    type="button"
                    class="le__q"
                    [class.on]="q.questionCode === selectedCode()"
                    [attr.aria-current]="q.questionCode === selectedCode() ? 'true' : null"
                    (click)="select(q.questionCode)"
                  >
                    <span class="le__q-label">{{ label(q) }}</span>
                    <span class="le__q-meta">
                      @if (q.factKey === null) {
                        <span class="le__chip le__chip--muted" i18n="@@lengine.q.not_linked"
                          >Not linked</span
                        >
                      } @else if (q.readingProgramCount > 0) {
                        <span class="le__chip" i18n="@@lengine.q.read_by"
                          >Read by {{ q.readingProgramCount }}</span
                        >
                      } @else {
                        <span class="le__chip le__chip--muted" i18n="@@lengine.q.unread"
                          >No figure yet</span
                        >
                      }
                    </span>
                  </button>
                </li>
              } @empty {
                <li class="le__empty" i18n="@@lengine.q.none">No question matches.</li>
              }
            </ul>
          }
        </aside>

        <div class="le__main">
          @if (loadingDetail()) {
            <nz-spin nzSimple />
          }
          @if (detail(); as d) {
            <header class="le__head">
              <h2 class="le__title">{{ isAr ? d.labelAr : d.labelEn }}</h2>
              <p class="le__sub">
                <code>{{ d.questionCode }}</code>
                @if (d.factKey !== null) {
                  <span i18n="@@lengine.d.answers_figure"
                    >answers the figure <code>{{ d.factKey }}</code></span
                  >
                }
              </p>
            </header>

            @if (d.factKey === null) {
              <div class="le__callout" role="status">
                <p i18n="@@lengine.d.link_first">
                  This question doesn't answer a figure yet, so no bank table can read it. Link it
                  to create one.
                </p>
                @if (canEdit()) {
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    [nzLoading]="linking()"
                    (click)="link(d.questionCode)"
                    i18n="@@lengine.d.link"
                  >
                    Link it to a figure
                  </button>
                }
              </div>
            } @else {
              <div class="le__tools">
                <label class="le__toggle">
                  <input type="checkbox" [formControl]="onlyReading" />
                  <span i18n="@@lengine.d.only_reading">Only programs that already use it</span>
                </label>
                <span class="le__count" i18n="@@lengine.d.count"
                  >{{ shownPrograms().length }} of {{ d.programs.length }} programs</span
                >
              </div>

              <div class="le__scroll" tabindex="0" [attr.aria-label]="tableAria">
                <table class="le__table">
                  <thead>
                    <tr>
                      <th scope="col" i18n="@@lengine.t.program">Program</th>
                      @for (e of effects; track e) {
                        <th scope="col" [class.hl]="e === highlight()">{{ effectName(e) }}</th>
                      }
                      <th scope="col" i18n="@@lengine.t.conditions">Conditions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of shownPrograms(); track p.programCode) {
                      <tr>
                        <th scope="row" class="le__prog">
                          <span class="le__bank">{{ p.bankName }}</span>
                          <span class="le__name">{{ p.friendlyName }}</span>
                          <span class="le__code">{{ p.programCode }}</span>
                        </th>
                        @for (e of effects; track e) {
                          <td [class.hl]="e === highlight()">
                            @if (p.effects[e]; as s) {
                              @if (s.editable) {
                                <button
                                  type="button"
                                  class="le__cell"
                                  [class.le__cell--set]="s.rows.length > 0"
                                  (click)="openEffect(d, p, e)"
                                >
                                  {{ cellText(s) }}
                                </button>
                              } @else {
                                <span class="le__ro" [attr.title]="roTitle(s)">{{
                                  roText(s)
                                }}</span>
                              }
                            }
                          </td>
                        }
                        <td>
                          <button
                            type="button"
                            class="le__cell"
                            [class.le__cell--set]="p.conditions.length > 0"
                            (click)="openConditions(p)"
                          >
                            {{ conditionsText(p, d.factKey) }}
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td
                          [attr.colspan]="effects.length + 2"
                          class="le__empty"
                          i18n="@@lengine.t.none"
                        >
                          No program uses this question yet. Clear the filter to start one.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          } @else if (!loadingDetail()) {
            <p class="le__pick" i18n="@@lengine.d.pick">
              Pick a question to see what it changes for each bank.
            </p>
          }
          @if (error(); as e) {
            <p class="le__error" role="alert">{{ e }}</p>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .page {
        padding: var(--space-6);
        inline-size: 100%;
        min-block-size: 100%;
        background: var(--color-surface-page);
      }
      .le {
        display: grid;
        grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
        gap: var(--space-5);
        margin-block-start: var(--space-5);
      }
      @media (max-width: 960px) {
        .le {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .le__list {
        display: grid;
        align-content: start;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .le__cats {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }
      .le__cat {
        padding: var(--space-1) var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-default);
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .le__cat.on {
        border-color: var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
      }
      .le__qs {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-1);
        max-block-size: 70vh;
        overflow-y: auto;
      }
      .le__q {
        display: grid;
        gap: var(--space-1);
        inline-size: 100%;
        padding: var(--space-2) var(--space-3);
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text-primary);
        text-align: start;
        cursor: pointer;
      }
      .le__q:hover {
        background: var(--color-surface-row-hover);
      }
      .le__q.on {
        border-color: var(--color-brand-primary);
        background: var(--color-surface-default);
      }
      .le__q:focus-visible,
      .le__cat:focus-visible,
      .le__cell:focus-visible,
      .le__scroll:focus-visible {
        outline: 2px solid var(--focus-ring-color);
        outline-offset: 2px;
      }
      .le__chip {
        display: inline-block;
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
        font-size: var(--text-xxs);
      }
      .le__chip--muted {
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
      }
      .le__main {
        display: grid;
        align-content: start;
        gap: var(--space-4);
        min-inline-size: 0;
      }
      .le__title {
        margin: 0;
        color: var(--color-text-primary);
      }
      .le__sub {
        margin: var(--space-1) 0 0;
        color: var(--color-text-secondary);
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .le__callout {
        display: grid;
        gap: var(--space-3);
        justify-items: start;
        padding: var(--space-4);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
      }
      .le__callout p {
        margin: 0;
      }
      .le__tools {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .le__toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .le__count {
        color: var(--color-text-tertiary);
      }
      .le__scroll {
        overflow-x: auto;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
      }
      .le__table {
        inline-size: 100%;
        border-collapse: collapse;
      }
      .le__table th,
      .le__table td {
        padding: var(--space-2) var(--space-3);
        border-block-end: 1px solid var(--border-default);
        text-align: start;
        vertical-align: middle;
        white-space: nowrap;
      }
      .le__table thead th {
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-semibold);
        font-size: var(--text-xxs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .le__table .hl {
        background: var(--color-tonal-accent-bg);
      }
      .le__prog {
        display: grid;
        gap: 0;
        font-weight: var(--font-weight-regular);
      }
      .le__bank {
        color: var(--color-text-secondary);
        font-size: var(--text-xxs);
      }
      .le__code {
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
      }
      .le__cell {
        padding: var(--space-1) var(--space-2);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .le__cell--set {
        border-style: solid;
        border-color: var(--color-brand-primary);
        color: var(--color-text-primary);
      }
      .le__ro {
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
      }
      .le__empty,
      .le__pick {
        color: var(--color-text-secondary);
      }
      .le__error {
        color: var(--color-error);
      }
    `,
  ],
})
export class LoanEnginePageComponent {
  private readonly api = inject(LoanEngineApiService);
  private readonly questionnaire = inject(QuestionnaireApiService);
  private readonly drawer = inject(NzDrawerService);
  private readonly auth = inject(AuthService);
  private readonly errors = inject(ErrorCodeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly isAr = document.documentElement.lang.startsWith('ar');

  readonly eyebrow = $localize`:@@lengine.eyebrow:Matching engine`;
  readonly titleText = $localize`:@@lengine.title:Loan Engine`;
  readonly subtitleText = $localize`:@@lengine.subtitle:What each answer changes, bank by bank: rates, caps, terms, extra income — and who each program quotes at all.`;
  readonly listAria = $localize`:@@lengine.list_aria:Questions`;
  readonly catsAria = $localize`:@@lengine.cats_aria:Loan type`;
  readonly tableAria = $localize`:@@lengine.table_aria:Effects by program`;
  readonly searchPlaceholder = $localize`:@@lengine.search:Search questions`;

  readonly categories = LOAN_CATEGORIES;
  readonly effects = LOAN_ENGINE_EFFECTS;
  readonly canEdit = computed(() => this.auth.role() === 'super_admin');

  readonly search = new FormControl<string>('', { nonNullable: true });
  private readonly searchText = toSignal(this.search.valueChanges, { initialValue: '' });
  readonly onlyReading = new FormControl<boolean>(false, { nonNullable: true });
  private readonly onlyReadingOn = toSignal(this.onlyReading.valueChanges, { initialValue: false });

  readonly category = signal<LoanCategory | null>(null);
  readonly questions = signal<LoanEngineQuestionSummary[]>([]);
  readonly loadingList = signal(true);
  readonly detail = signal<LoanEngineQuestionDetail | null>(null);
  readonly loadingDetail = signal(false);
  readonly linking = signal(false);
  readonly error = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap);
  readonly selectedCode = computed(() => this.params()?.get('question') ?? null);
  readonly highlight = computed(() => {
    const e = this.params()?.get('effect');
    return (LOAN_ENGINE_EFFECTS as readonly string[]).includes(e ?? '')
      ? (e as LoanEngineEffect)
      : null;
  });

  readonly shownQuestions = computed(() => {
    const cat = this.category();
    const needle = this.searchText().trim().toLowerCase();
    return this.questions()
      .filter((q) => cat === null || q.categories.includes(cat))
      .filter(
        (q) =>
          needle === '' ||
          q.questionCode.includes(needle) ||
          q.labelEn.toLowerCase().includes(needle) ||
          q.labelAr.includes(needle),
      );
  });

  readonly shownPrograms = computed(() => {
    const d = this.detail();
    if (d === null) return [];
    const cat = this.category();
    return d.programs
      .filter((p) => cat === null || p.category === cat)
      .filter((p) => !this.onlyReadingOn() || this.usesQuestion(p, d.factKey));
  });

  constructor() {
    void this.loadList();
    // The URL is the selection; loading writes signals, so it runs untracked.
    effect(() => {
      const code = this.selectedCode();
      untracked(() => {
        if (code !== null) void this.loadDetail(code);
        else this.detail.set(null);
      });
    });
  }

  label(q: LoanEngineQuestionSummary): string {
    return this.isAr ? q.labelAr : q.labelEn;
  }

  catLabel(c: LoanCategory): string {
    return categoryLabel(c);
  }

  effectName(e: LoanEngineEffect): string {
    return effectLabel(e);
  }

  cellText(s: EffectState): string {
    if (s.rows.length === 1) return $localize`:@@lengine.cell.row_one:1 row`;
    if (s.rows.length > 1) return $localize`:@@lengine.cell.rows:${s.rows.length}:n: rows`;
    return this.canEdit() ? $localize`:@@lengine.cell.add:Add` : '—';
  }

  roText(s: EffectState): string {
    return readOnlyLabel(s.readOnlyReason);
  }

  roTitle(s: EffectState): string {
    return s.otherFactKey === undefined
      ? readOnlyLabel(s.readOnlyReason)
      : `${readOnlyLabel(s.readOnlyReason)}: ${s.otherFactKey}`;
  }

  conditionsText(p: LoanEngineProgramSlice, factKey: string | null): string {
    if (p.conditions.length === 0) return this.canEdit() ? $localize`:@@lengine.cell.add:Add` : '—';
    const mine = p.conditions.filter((c) => c.anyOf.some((l) => l.factKey === factKey)).length;
    return mine > 0
      ? $localize`:@@lengine.cell.cond_mine:${p.conditions.length}:n: (${mine}:mine: on this)`
      : $localize`:@@lengine.cell.cond:${p.conditions.length}:n:`;
  }

  select(code: string): void {
    void this.router.navigate([], {
      queryParams: { question: code, effect: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  openEffect(d: LoanEngineQuestionDetail, p: LoanEngineProgramSlice, e: LoanEngineEffect): void {
    const question: EffectRowsSheetData['question'] = {
      questionCode: d.questionCode,
      type: d.type,
      labelAr: d.labelAr,
      labelEn: d.labelEn,
      categories: d.categories,
      factKey: d.factKey,
      options: d.options,
    };
    const ref = openFormDrawer<
      EffectRowsSheetComponent,
      EffectRowsSheetData,
      LoanEngineProgramSlice
    >(this.drawer, {
      content: EffectRowsSheetComponent,
      data: { question, program: p, effect: e, canEdit: this.canEdit() },
      width: 'min(720px, calc(100vw - 32px))',
    });
    ref.afterClose.subscribe((fresh) => this.replaceProgram(fresh));
  }

  openConditions(p: LoanEngineProgramSlice): void {
    const questions = this.questions().filter(
      (q) => q.factKey !== null && q.categories.includes(p.category),
    );
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
      // The conditions response carries no effects; re-read the question to stay whole.
      if (fresh !== undefined && fresh !== null) {
        const code = this.selectedCode();
        if (code !== null) void this.loadDetail(code);
        void this.loadList();
      }
    });
  }

  async link(code: string): Promise<void> {
    this.linking.set(true);
    this.error.set(null);
    try {
      await this.questionnaire.linkQuestionFact(code, null, { silent: true });
      await Promise.all([this.loadDetail(code), this.loadList()]);
    } catch (err) {
      this.showError(err);
    } finally {
      this.linking.set(false);
    }
  }

  private usesQuestion(p: LoanEngineProgramSlice, factKey: string | null): boolean {
    return (
      LOAN_ENGINE_EFFECTS.some((e) => p.effects[e].rows.length > 0) ||
      p.conditions.some((c) => c.anyOf.some((l) => l.factKey === factKey))
    );
  }

  private replaceProgram(fresh: LoanEngineProgramSlice | undefined | null): void {
    if (fresh === undefined || fresh === null) return;
    const d = this.detail();
    if (d === null) return;
    this.detail.set({
      ...d,
      programs: d.programs.map((p) => (p.programCode === fresh.programCode ? fresh : p)),
    });
    void this.loadList();
  }

  private async loadList(): Promise<void> {
    try {
      this.questions.set(await this.api.questions());
    } catch (err) {
      this.showError(err);
    } finally {
      this.loadingList.set(false);
    }
  }

  private async loadDetail(code: string): Promise<void> {
    this.loadingDetail.set(this.detail()?.questionCode !== code);
    this.error.set(null);
    try {
      this.detail.set(await this.api.question(code));
    } catch (err) {
      this.detail.set(null);
      this.showError(err);
    } finally {
      this.loadingDetail.set(false);
    }
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
