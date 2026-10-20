import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { EditOutline, SearchOutline } from '@ant-design/icons-angular/icons';
import { categoryLabel, type LoanCategory } from '@core/loan-category';
import { CanDirective } from '@shared/can.directive';
import { EmptyStateComponent } from '@shared/empty-state.component';
import {
  RailTabsComponent,
  SkeletonRowsComponent,
  StatusPillComponent,
  openFormDrawer,
  type RailTabItem,
} from '@shared/ui';
import { AnswerMeaningsComponent } from './answer-meanings.component';
import {
  AnswerWordingDrawerComponent,
  type AnswerWordingDrawerData,
} from './answer-wording.drawer';
import { EngineRulesApiService } from './engine-rules.api.service';
import {
  labelOf,
  lockBaseLabel,
  lockEngineLabel,
  lockPills,
  lockProgramLabel,
  numericRuleParts,
  readerText,
  textRuleText,
  wordingOf,
} from './engine-rules.labels';
import {
  WHO_FILTERS,
  filterRules,
  isWhoFilter,
  whoCounts,
  type WhoFilter,
} from './engine-rules.rules';
import type { EngineRuleOption, EngineRuleQuestion, LabelledKey } from './engine-rules.types';

/** Answers shown before "Show all" — enough for every band list, short of the long lists. */
const ANSWERS_SHOWN = 6;

/**
 * LOAN ENGINE RULES — the third Questionnaire tab (v30.12.0).
 *
 * Every question the loan engine reads, with who reads it and what each answer means to it,
 * and ONE thing an admin can change: the wording of an answer, in a side sheet. Nothing here
 * adds, removes, reorders or retypes anything — the server refuses those on every screen —
 * and a reword keeps the quantities it states ("Less than 6 months" may become "Under 6
 * months", never "Under 12 months"): the engine reads the answer's code, the applicant picks
 * by its words.
 *
 * A question whose answers ARE a Manage-values list (compounds, club branches, grades) is shown
 * read-only with the list named: the list owns those labels and re-syncs them on every write,
 * so a reword made here would be overwritten.
 */
@Component({
  standalone: true,
  selector: 'app-engine-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzToolTipModule,
    CanDirective,
    EmptyStateComponent,
    RailTabsComponent,
    SkeletonRowsComponent,
    StatusPillComponent,
    AnswerMeaningsComponent,
  ],
  providers: [provideNzIconsPatch([EditOutline, SearchOutline])],
  template: `
    <section class="page">
      <p class="sr-only" role="status" aria-live="polite">{{ status() }}</p>
      <header class="bar">
        <div class="bar-lead">
          <p class="eyebrow" i18n="@@qcat.eyebrow">Matching engine</p>
          <h1 i18n="@@qrules.title">Loan engine rules</h1>
          <p class="sub" i18n="@@qrules.sub">
            The questions the loan engine reads, who reads each one and what each answer means. The
            engine reads an answer's code, not its words — reword an answer freely, but keep its
            numbers.
          </p>
        </div>
        <span class="autosave" i18n="@@qcat.autosave">Saves &amp; publishes automatically</span>
      </header>

      @if (loading()) {
        <app-skeleton-rows [rows]="6" [cols]="[3, 2, 2]" [ariaLabel]="loadingAria" />
      } @else if (loadFailed()) {
        <app-empty-state [title]="loadFailedTitle" [subtitle]="loadFailedSub">
          <button nz-button nzType="primary" type="button" (click)="retry()" i18n="@@qrules.retry">
            Try again
          </button>
        </app-empty-state>
      } @else {
        <div class="toolbar">
          <div class="search" role="search">
            <label class="sr-only" for="qrules-search" i18n="@@qrules.search_label"
              >Search the rules</label
            >
            <nz-input-group [nzPrefix]="searchIcon">
              <input
                nz-input
                id="qrules-search"
                type="search"
                autocomplete="off"
                [value]="search()"
                [placeholder]="searchPlaceholder"
                (input)="onSearch($event)"
              />
            </nz-input-group>
            <ng-template #searchIcon>
              <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            </ng-template>
          </div>
          <label class="numbers-only">
            <input type="checkbox" [checked]="numbersOnly()" (change)="onNumbersOnly($event)" />
            <span i18n="@@qrules.only_numbers">Only answers with numbers</span>
          </label>
        </div>

        <app-rail-tabs
          appearance="pill"
          idPrefix="qrules-who"
          [items]="whoItems()"
          [activeId]="who()"
          [ariaLabel]="whoAria"
          (select)="setWho($event)"
        />

        <div
          class="panel"
          role="tabpanel"
          [id]="'qrules-who-panel-' + who()"
          [attr.aria-labelledby]="'qrules-who-tab-' + who()"
        >
          <p class="showing">{{ showing() }}</p>
          @if (visible().length === 0) {
            @if (questions().length === 0) {
              <app-empty-state [title]="emptyTitle" />
            } @else {
              <app-empty-state [title]="noMatchTitle" [subtitle]="noMatchSub">
                <button nz-button type="button" (click)="clearFilters()" i18n="@@qrules.clear">
                  Clear filters
                </button>
              </app-empty-state>
            }
          } @else {
            <ol class="rules">
              @for (q of visible(); track q.id) {
                <li class="rule" [attr.aria-labelledby]="'qr-q-' + q.id">
                  <div class="rule-head">
                    <div class="rule-title">
                      <h2 class="q" [id]="'qr-q-' + q.id">{{ wording(q) }}</h2>
                      <!-- The other language, isolated inline: its own direction for its own
                           letters, the page's direction for where the line starts. -->
                      <p class="q-alt">
                        <bdi [attr.lang]="altLang">{{ altWording(q) }}</bdi>
                      </p>
                    </div>
                    <div class="rule-meta">
                      @for (p of pills(q); track p.label) {
                        <app-status-pill [label]="p.label" [tone]="p.tone" />
                      }
                      <bdi class="code">{{ q.code }}</bdi>
                    </div>
                  </div>

                  <dl class="facts">
                    <div class="fact">
                      <dt i18n="@@qrules.asked_in">Asked in</dt>
                      <dd>
                        <ul class="cats">
                          @for (c of q.categories; track c) {
                            <li class="cat" [style.--cat]="catColor(c)">{{ catLabel(c) }}</li>
                          }
                          @for (c of q.optInCategories; track c) {
                            <li class="cat opt-in" [style.--cat]="catColor(c)">
                              {{ optInLabel(c) }}
                            </li>
                          }
                          @if (q.categories.length + q.optInCategories.length === 0) {
                            <li class="cat none" i18n="@@qrules.asked_nowhere">
                              Not asked in any loan type
                            </li>
                          }
                        </ul>
                      </dd>
                    </div>
                    <div class="fact">
                      <dt i18n="@@qrules.readers_title">Who reads it</dt>
                      <dd>
                        <ul class="readers">
                          @for (line of readers(q); track $index) {
                            <li>{{ line }}</li>
                          }
                        </ul>
                      </dd>
                    </div>
                    @if (q.type === 'NUMERIC' || q.type === 'TEXT') {
                      <div class="fact">
                        <dt i18n="@@qrules.rule_title">Fixed rule</dt>
                        <dd>{{ ruleText(q) }}</dd>
                      </div>
                    }
                  </dl>

                  @if (q.options.length > 0) {
                    <div class="answers">
                      <div class="answers-head">
                        <h3 i18n="@@qrules.answers_title">Answers</h3>
                        @if (q.mirroredList; as list) {
                          <p class="note">
                            {{ mirroredNote(list) }}
                            <a
                              *can="['super_admin']"
                              [routerLink]="['/lookups']"
                              [queryParams]="{ type: list.key }"
                              i18n="@@qrules.mirrored_link"
                              >Open the list</a
                            >
                          </p>
                        } @else {
                          <p class="note" i18n="@@qrules.no_add_note">
                            Answers can't be added or removed here: each one means something to the
                            loan engine.
                          </p>
                        }
                      </div>
                      <ul class="answer-list" [id]="'qr-answers-' + q.id">
                        @for (o of shownOptions(q); track o.id) {
                          <li class="answer" [class.editable]="q.mirroredList === null">
                            <div class="answer-text">
                              <span class="label">{{ isAr ? o.labelAr : o.labelEn }}</span>
                              <span class="label-alt"
                                ><bdi [attr.lang]="altLang">{{
                                  isAr ? o.labelEn : o.labelAr
                                }}</bdi></span
                              >
                              <app-answer-meanings [meanings]="o.meanings" [isAr]="isAr" />
                            </div>
                            @if (q.mirroredList === null) {
                              <button
                                type="button"
                                class="edit"
                                [id]="'qr-edit-' + o.id"
                                [attr.aria-label]="editAria(o)"
                                nz-tooltip
                                [nzTooltipTitle]="editTip"
                                (click)="edit(q, o)"
                              >
                                <span
                                  nz-icon
                                  nzType="edit"
                                  nzTheme="outline"
                                  aria-hidden="true"
                                ></span>
                              </button>
                            }
                          </li>
                        }
                      </ul>
                      @if (q.options.length > answersShown) {
                        <button
                          type="button"
                          class="show-all"
                          [attr.aria-expanded]="isExpanded(q)"
                          [attr.aria-controls]="'qr-answers-' + q.id"
                          (click)="toggle(q)"
                        >
                          {{ isExpanded(q) ? showLess : showAll(q) }}
                        </button>
                      }
                    </div>
                  }
                </li>
              }
            </ol>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        inline-size: 100%;
        min-block-size: 100%;
        padding: var(--space-6);
        background: var(--bg-base);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
        margin-block-end: var(--space-5);
      }
      .bar-lead {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
        max-inline-size: 72ch;
      }
      .eyebrow {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-tonal-accent);
      }
      h1 {
        margin: 0;
        font-family: var(--heading-font);
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        letter-spacing: -0.015em;
        line-height: var(--leading-tight);
        color: var(--text-primary);
      }
      .sub {
        margin: 0;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .autosave {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3) var(--space-5);
        margin-block-end: var(--space-3);
      }
      .search {
        flex: 1 1 18rem;
        max-inline-size: 30rem;
      }
      .numbers-only {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: var(--size-field);
        font-size: var(--text-sm);
        color: var(--text-primary);
        cursor: pointer;
      }
      .numbers-only input {
        inline-size: var(--space-4);
        block-size: var(--space-4);
        accent-color: var(--primary);
        cursor: pointer;
      }
      .numbers-only input:focus-visible,
      .edit:focus-visible,
      .show-all:focus-visible,
      .note a:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .panel {
        margin-block-start: var(--space-4);
      }
      .showing {
        margin: 0 0 var(--space-3);
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .rules {
        display: grid;
        gap: var(--space-4);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .rule {
        display: grid;
        gap: var(--space-4);
        padding: var(--space-5);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        min-inline-size: 0;
      }
      .rule-head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .rule-title {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
        flex: 1 1 20rem;
      }
      .q {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-tight);
        color: var(--text-primary);
      }
      .q-alt,
      .label-alt {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .rule-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-secondary);
        overflow-wrap: anywhere;
      }
      .facts {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: var(--space-2) var(--space-5);
        margin: 0;
      }
      .fact {
        display: contents;
      }
      .facts dt {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        padding-block-start: var(--space-0-5);
      }
      .facts dd {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
        min-inline-size: 0;
      }
      .cats,
      .readers {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .readers {
        display: grid;
      }
      .cat {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        font-size: var(--text-xs);
        color: var(--text-primary);
      }
      .cat::before {
        content: '';
        inline-size: var(--space-2);
        block-size: var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--cat, var(--border-strong));
      }
      .cat.opt-in {
        background: transparent;
        border: 1px dashed var(--border-default);
      }
      .cat.none::before {
        display: none;
      }
      .answers {
        display: grid;
        gap: var(--space-2);
        border-block-start: 1px solid var(--border-subtle);
        padding-block-start: var(--space-4);
      }
      .answers-head {
        display: grid;
        gap: var(--space-1);
      }
      .answers-head h3 {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
      }
      .note {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .note a {
        color: var(--primary-visible);
        font-weight: var(--font-weight-semibold);
      }
      .answer-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .answer {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-2);
        border-radius: var(--radius-md);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .answer + .answer {
        border-block-start: 1px solid var(--border-subtle);
      }
      /* A reading aid, not an affordance: only a row with a pencil lights up, so the eye can
         follow a label across to its pencil on a wide screen. */
      .answer.editable:hover {
        background: var(--bg-subtle);
      }
      .answer-text {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }
      .edit {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: var(--size-field);
        block-size: var(--size-field);
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .edit:hover {
        background: var(--bg-muted);
        color: var(--primary-visible);
      }
      .edit:active {
        transform: translateY(1px);
      }
      .show-all {
        justify-self: start;
        min-block-size: var(--size-field);
        padding: 0 var(--space-2);
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--primary-visible);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .show-all:hover {
        background: var(--bg-subtle);
      }
      @media (max-width: 768px) {
        .page {
          padding: var(--space-4);
        }
        .rule {
          padding: var(--space-4);
        }
        .facts {
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-1);
        }
        .facts dd + dt {
          margin-block-start: var(--space-2);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .answer,
        .edit {
          transition: none;
        }
        .edit:active {
          transform: none;
        }
      }
    `,
  ],
})
export class EngineRulesPageComponent implements OnInit {
  private readonly api = inject(EngineRulesApiService);
  private readonly drawer = inject(NzDrawerService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Arabic primary (Principle IV): wording and names in the UI language, the other beneath. */
  protected readonly isAr = document.documentElement.lang.startsWith('ar');
  protected readonly altLang = this.isAr ? 'en' : 'ar';
  protected readonly answersShown = ANSWERS_SHOWN;

  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly questions = signal<readonly EngineRuleQuestion[]>([]);
  protected readonly who = signal<WhoFilter>('all');
  protected readonly search = signal('');
  protected readonly numbersOnly = signal(false);
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly visible = computed(() =>
    filterRules(this.questions(), {
      who: this.who(),
      search: this.search(),
      numbersOnly: this.numbersOnly(),
    }),
  );
  private readonly counts = computed(() =>
    whoCounts(this.questions(), { search: this.search(), numbersOnly: this.numbersOnly() }),
  );
  protected readonly whoItems = computed<RailTabItem[]>(() => {
    const counts = this.counts();
    return WHO_FILTERS.map((id) => {
      const n = counts[id];
      return {
        id,
        label: this.whoLabel(id),
        count: n,
        countLabel: $localize`:@@qrules.count_label:${n}:count: questions`,
      };
    });
  });
  protected readonly showing = computed(() => {
    const shown = this.visible().length;
    const total = this.questions().length;
    return $localize`:@@qrules.showing:${shown}:shown: of ${total}:total: questions`;
  });
  protected readonly status = computed(() => (this.loading() ? '' : this.showing()));

  protected readonly loadingAria = $localize`:@@qrules.loading_aria:Loading the loan engine rules`;
  protected readonly loadFailedTitle = $localize`:@@qrules.load_failed:Couldn't load the loan engine rules`;
  protected readonly loadFailedSub = $localize`:@@qrules.load_failed_sub:Check your connection and try again.`;
  protected readonly emptyTitle = $localize`:@@qrules.empty_title:The loan engine reads no question yet`;
  protected readonly noMatchTitle = $localize`:@@qrules.no_match_title:No question matches these filters`;
  protected readonly noMatchSub = $localize`:@@qrules.no_match_sub:Try removing one, or clear them all.`;
  protected readonly searchPlaceholder = $localize`:@@qrules.search_ph:Search questions, answers or codes`;
  protected readonly whoAria = $localize`:@@qrules.who_aria:Filter by who reads it`;
  protected readonly showLess = $localize`:@@qrules.show_less:Show fewer answers`;
  protected readonly editTip = $localize`:@@qrules.edit_tip:Edit wording`;
  private readonly savedText = $localize`:@@qrules.saved:Answer wording saved and published`;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const who = params.get('who');
    if (isWhoFilter(who)) this.who.set(who);
    this.search.set(params.get('search') ?? '');
    this.numbersOnly.set(params.get('numbers') === '1');
    void this.load(true);
  }

  protected retry(): void {
    void this.load(true);
  }

  protected setWho(id: string): void {
    if (!isWhoFilter(id)) return;
    this.who.set(id);
    this.syncUrl();
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.syncUrl();
  }

  protected onNumbersOnly(event: Event): void {
    this.numbersOnly.set((event.target as HTMLInputElement).checked);
    this.syncUrl();
  }

  protected clearFilters(): void {
    this.who.set('all');
    this.search.set('');
    this.numbersOnly.set(false);
    this.syncUrl();
  }

  protected edit(q: EngineRuleQuestion, o: EngineRuleOption): void {
    if (q.mirroredList !== null) return;
    const ref = openFormDrawer<AnswerWordingDrawerComponent, AnswerWordingDrawerData, boolean>(
      this.drawer,
      { content: AnswerWordingDrawerComponent, data: { question: q, option: o } },
    );
    ref.afterClose.subscribe((saved) => {
      if (saved !== true) {
        this.focusEdit(o.id);
        return;
      }
      this.message.success(this.savedText);
      void this.load(false).then(() => this.focusEdit(o.id));
    });
  }

  protected toggle(q: EngineRuleQuestion): void {
    const next = new Set(this.expanded());
    if (next.has(q.id)) next.delete(q.id);
    else next.add(q.id);
    this.expanded.set(next);
  }

  protected isExpanded(q: EngineRuleQuestion): boolean {
    return this.expanded().has(q.id);
  }

  protected shownOptions(q: EngineRuleQuestion): readonly EngineRuleOption[] {
    return this.isExpanded(q) ? q.options : q.options.slice(0, ANSWERS_SHOWN);
  }

  protected wording(q: EngineRuleQuestion): string {
    return wordingOf(q, this.isAr);
  }

  protected altWording(q: EngineRuleQuestion): string {
    return wordingOf(q, !this.isAr);
  }

  protected pills(q: EngineRuleQuestion) {
    return lockPills(q);
  }

  protected readers(q: EngineRuleQuestion): string[] {
    return q.readers.map((r) => readerText(r, this.isAr));
  }

  protected ruleText(q: EngineRuleQuestion): string {
    return q.type === 'TEXT'
      ? textRuleText(q)
      : numericRuleParts(q, this.isAr).join(this.isAr ? '، ' : ' · ');
  }

  protected catLabel(c: LoanCategory): string {
    return categoryLabel(c);
  }

  protected catColor(c: LoanCategory): string {
    return `var(--color-cat-${c})`;
  }

  protected optInLabel(c: LoanCategory): string {
    const category = categoryLabel(c);
    return $localize`:@@qrules.opt_in:${category}:category: · some names`;
  }

  protected mirroredNote(list: LabelledKey): string {
    const name = labelOf(list, this.isAr);
    return $localize`:@@qrules.mirrored_note:These answers are the values of the list “${name}:list:” and are reworded there.`;
  }

  protected editAria(o: EngineRuleOption): string {
    const label = this.isAr ? o.labelAr : o.labelEn;
    return $localize`:@@qrules.edit_aria:Edit the wording of “${label}:label:”`;
  }

  protected showAll(q: EngineRuleQuestion): string {
    const n = q.options.length;
    return $localize`:@@qrules.show_all:Show all ${n}:count: answers`;
  }

  private whoLabel(id: WhoFilter): string {
    switch (id) {
      case 'all':
        return $localize`:@@qrules.who_all:All`;
      case 'engine':
        return lockEngineLabel();
      case 'base':
        return lockBaseLabel();
      case 'program':
        return lockProgramLabel();
    }
  }

  /** First load shows the skeleton; a reload after a save keeps the list, filters and focus. */
  private async load(first: boolean): Promise<void> {
    if (first) {
      this.loading.set(true);
      this.loadFailed.set(false);
    }
    try {
      this.questions.set((await this.api.rules()).questions);
      this.loadFailed.set(false);
    } catch {
      if (first) this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private syncUrl(): void {
    const search = this.search().trim();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        who: this.who() === 'all' ? null : this.who(),
        search: search === '' ? null : search,
        numbers: this.numbersOnly() ? '1' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private focusEdit(optionId: string): void {
    requestAnimationFrame(() => document.getElementById('qr-edit-' + optionId)?.focus());
  }
}
