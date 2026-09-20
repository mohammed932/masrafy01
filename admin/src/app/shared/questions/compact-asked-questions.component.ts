import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  CheckCircleOutline,
  CheckOutline,
  ExclamationCircleOutline,
  LeftOutline,
  RightOutline,
  SearchOutline,
  UserOutline,
} from '@ant-design/icons-angular/icons';
import { RailTabsComponent, type RailTabItem } from '@shared/ui/rail-tabs.component';
import { categoryLabel, type LoanCategory } from '@core/loan-category';
import {
  askedSections,
  askedTabs,
  coreChecks,
  isValidatedCategory,
  type AskableQuestion,
  type AskedPicks,
  type AskedRow,
  type CoreCheck,
  type ServedCount,
} from './asked-questions.rules';

/**
 * The create flow's questions step: only what an applicant WILL be asked, not the pool.
 *
 * The full board lists every question in the pool under a heading, which on a real database
 * is fifty-odd cards where the operator wanted a handful. This one shows four things and no
 * more: whether the loan type is QUOTABLE (the checklist the engine needs), the questions it
 * already REQUIRES, what the operator has ADDED, and a search to add another. The rest of the
 * pool is reachable only by searching for it.
 *
 * Same rules module as the full board and the same add-only contract: `question_loan_category`
 * is global, so a tick widens a question's loan types and nothing here can un-ask one.
 */
@Component({
  selector: 'app-compact-asked-questions',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, NzIconModule, RailTabsComponent],
  providers: [
    provideNzIconsPatch([
      CheckOutline,
      CheckCircleOutline,
      ExclamationCircleOutline,
      LeftOutline,
      RightOutline,
      SearchOutline,
      UserOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tabs().length === 0) {
      <p class="none" role="status" i18n="@@caq.no_types">
        Pick at least one loan type first — what applicants are asked is set per loan type.
      </p>
    } @else {
      <app-rail-tabs
        [items]="railItems()"
        [activeId]="category()"
        [ariaLabel]="railAria"
        idPrefix="caq"
        appearance="segmented"
        [uniform]="true"
        (select)="pickCategory($event)"
      />

      <p class="total" role="status">
        <span>{{ totalText() }}</span>
      </p>
      @if (servedHere(); as sv) {
        <p class="servedline" role="status">
          <span nz-icon nzType="user" nzTheme="outline" aria-hidden="true"></span>
          <span>{{ servedText(sv) }}</span>
        </p>
      }

      @if (validated()) {
        <section class="check" [class.is-bad]="problems() > 0" aria-labelledby="caq-check-h">
          <h3 class="sec" id="caq-check-h">
            <span class="sec-t" i18n="@@caq.check_h">Needed to price {{ typeName() }}</span>
            <span class="sec-n tabular">{{ ready() }}/{{ checks().length }}</span>
          </h3>
          <p class="hint" role="status">
            @if (problems() === 0) {
              <span i18n="@@caq.check_ok">Everything the quote reads is asked. Ready.</span>
            } @else {
              <span i18n="@@caq.check_bad"
                >Applicants of this type cannot be priced until these are asked.</span
              >
            }
          </p>
          <ul class="checks">
            @for (c of checks(); track c.code) {
              <li class="chk" [class.is-bad]="c.state === 'not_asked' || c.state === 'unavailable'">
                <span
                  nz-icon
                  [nzType]="isOk(c) ? 'check-circle' : 'exclamation-circle'"
                  nzTheme="outline"
                  aria-hidden="true"
                ></span>
                <span class="chk-label">{{ c.label }}</span>
                <span class="chk-state">{{ stateLabel(c) }}</span>
                @if (c.state === 'not_asked') {
                  <button
                    type="button"
                    class="chk-add"
                    [disabled]="busy()"
                    (click)="addCore(c)"
                    i18n="@@caq.check_add"
                  >
                    Ask it
                  </button>
                }
              </li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="caq-req-h">
        <h3 class="sec" id="caq-req-h">
          <span class="sec-t" i18n="@@caq.req_h">Also required of {{ typeName() }} applicants</span>
          <span class="sec-n tabular">{{ required().length }}</span>
        </h3>
        @if (required().length === 0) {
          <p class="empty" i18n="@@caq.req_none">No other question is required.</p>
        } @else {
          <ul class="grid is-paged" [style.--caq-cols]="cols()">
            @for (row of requiredPage(); track row.id) {
              <li>
                <p class="card is-on">
                  <span class="tick" aria-hidden="true"
                    ><span nz-icon nzType="check" nzTheme="outline"></span
                  ></span>
                  <span class="text">
                    <span class="label">{{ row.label }}</span>
                    <span class="meta">
                      <span class="tag" i18n="@@caq.tag_required">Required</span>
                      @if (typeLabel(row); as t) {
                        <span class="tag is-type">{{ t }}</span>
                      }
                      @if (row.gated) {
                        <span class="tag is-type" i18n="@@caq.tag_gated">Only if it applies</span>
                      }
                    </span>
                  </span>
                </p>
              </li>
            }
          </ul>
          @if (pageCount() > 1) {
            <ng-container
              [ngTemplateOutlet]="pagerTpl"
              [ngTemplateOutletContext]="{
                key: 'req',
                page: page(),
                count: pageCount(),
                label: rangeLabel(),
              }"
            />
          }
        }
      </section>

      <section aria-labelledby="caq-mine-h">
        <h3 class="sec" id="caq-mine-h">
          <span class="sec-t" i18n="@@caq.mine_h">You added</span>
          <span class="sec-n tabular">{{ mine().length }}</span>
        </h3>
        @if (mine().length === 0) {
          <p class="empty" i18n="@@caq.mine_none">Nothing added. Search below to ask another.</p>
        } @else {
          <ul class="grid">
            @for (row of mine(); track row.id) {
              <li>
                @if (removable()) {
                  <button
                    type="button"
                    class="card is-on is-new"
                    [disabled]="busy()"
                    [attr.aria-label]="removeAria(row)"
                    (click)="remove.emit(row)"
                  >
                  <span class="tick" aria-hidden="true"
                    ><span nz-icon nzType="check" nzTheme="outline"></span
                  ></span>
                  <span class="text">
                    <span class="label">{{ row.label }}</span>
                    <span class="meta">
                      @if (row.isRequired) {
                        <span class="tag" i18n="@@caq.tag_required">Required</span>
                      }
                      @if (typeLabel(row); as t) {
                        <span class="tag is-type">{{ t }}</span>
                      }
                    </span>
                  </span>
                  </button>
                } @else {
                  <p class="card is-on is-new">
                  <span class="tick" aria-hidden="true"
                    ><span nz-icon nzType="check" nzTheme="outline"></span
                  ></span>
                  <span class="text">
                    <span class="label">{{ row.label }}</span>
                    <span class="meta">
                      @if (row.isRequired) {
                        <span class="tag" i18n="@@caq.tag_required">Required</span>
                      }
                      @if (typeLabel(row); as t) {
                        <span class="tag is-type">{{ t }}</span>
                      }
                    </span>
                  </span>
                  </p>
                }
              </li>
            }
          </ul>
        }
      </section>

      <section aria-labelledby="caq-add-h">
        <h3 class="sec is-quiet" id="caq-add-h">
          <span class="sec-t">
            @if (search().trim() === '') {
              <span i18n="@@caq.suggested_h">Suggested questions</span>
            } @else {
              <span i18n="@@caq.results_h">Results</span>
            }
          </span>
          <span class="sec-n tabular">{{ matches().length }}</span>
        </h3>
        <label class="search">
          <span class="sr-only" i18n="@@caq.search_aria">Search the question pool</span>
          <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
          <input
            type="search"
            [ngModel]="search()"
            (ngModelChange)="searchChange.emit($event)"
            placeholder="Search the {{ poolSize() }} questions by wording, answer or code"
            i18n-placeholder="@@caq.search_ph"
          />
        </label>
        @if (matches().length === 0) {
          <p class="empty">
            @if (search().trim() === '') {
              <span i18n="@@caq.no_suggestions">No other question to suggest.</span>
            } @else {
              <span i18n="@@caq.no_match">Nothing else matches “{{ search() }}”.</span>
            }
          </p>
        } @else {
          <ul class="grid is-quiet is-paged" [style.--caq-cols]="cols()">
            @for (row of resultsPage(); track row.id) {
              <li>
                <button
                  type="button"
                  class="card"
                  [class.is-off]="!row.isActive"
                  [disabled]="!row.isActive || busy()"
                  [attr.aria-label]="addAria(row)"
                  (click)="add.emit(row)"
                >
                  <span class="tick is-empty" aria-hidden="true"
                    ><span nz-icon nzType="check" nzTheme="outline"></span
                  ></span>
                  <span class="text">
                    <span class="label">{{ row.label }}</span>
                    <span class="meta">
                      @if (!row.isActive) {
                        <span class="tag" i18n="@@caq.tag_off">Switched off</span>
                      } @else {
                        @if (row.alreadyAsked) {
                          <span class="tag" i18n="@@caq.tag_already">Already asked</span>
                        }
                        @if (row.isRequired) {
                          <span class="tag" i18n="@@caq.tag_required">Required</span>
                        }
                        @if (typeLabel(row); as t) {
                          <span class="tag is-type">{{ t }}</span>
                        }
                      }
                    </span>
                  </span>
                </button>
              </li>
            }
          </ul>
          @if (resultsPageCount() > 1) {
            <ng-container
              [ngTemplateOutlet]="pagerTpl"
              [ngTemplateOutletContext]="{
                key: 'res',
                page: resPage(),
                count: resultsPageCount(),
                label: resultsRange(),
              }"
            />
          }
        }
      </section>

      <ng-template #pagerTpl let-key="key" let-page="page" let-count="count" let-label="label">
        <nav class="pager" [attr.aria-label]="pagerAria">
          <button
            type="button"
            class="pg"
            [disabled]="page === 0"
            [attr.aria-label]="prevAria"
            (click)="goTo(key, page - 1)"
          >
            <span nz-icon nzType="left" nzTheme="outline" aria-hidden="true"></span>
          </button>
          <span class="pg-range tabular" role="status">{{ label }}</span>
          <button
            type="button"
            class="pg"
            [disabled]="page >= count - 1"
            [attr.aria-label]="nextAria"
            (click)="goTo(key, page + 1)"
          >
            <span nz-icon nzType="right" nzTheme="outline" aria-hidden="true"></span>
          </button>
        </nav>
      </ng-template>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .tabular {
        font-variant-numeric: tabular-nums lining-nums;
      }
      .none,
      .empty {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }
      .none {
        padding: var(--space-5);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-lg);
      }
      .total {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }
      .servedline {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--border-default);
        border-inline-start: 3px solid var(--primary);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
        font-size: var(--text-sm);
      }
      .sec {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-3);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .sec-n {
        padding: 1px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
      }
      .hint {
        margin: 0 0 var(--space-3);
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }

      .check {
        padding: var(--space-4);
        border: 1px solid var(--border-default);
        border-inline-start: 3px solid var(--success);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .check.is-bad {
        border-inline-start-color: var(--warning);
      }
      .checks {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .chk {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding-block: var(--space-1);
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      .chk [nz-icon] {
        color: var(--success);
      }
      .chk.is-bad [nz-icon] {
        color: var(--warning);
      }
      .chk-label {
        flex: 1 1 12rem;
        min-inline-size: 0;
      }
      .chk-state {
        color: var(--text-secondary);
        font-size: var(--text-xs);
      }
      .chk-add {
        min-block-size: 32px;
        padding: 0 var(--space-3);
        border: 1px solid var(--primary);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        color: var(--primary-visible);
        font: inherit;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        cursor: pointer;
      }
      .chk-add:focus-visible,
      .card:focus-visible,
      .search input:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--space-3);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .grid > li {
        display: flex;
      }
      .card {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2-5);
        inline-size: 100%;
        margin: 0;
        padding: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        color: var(--text-primary);
        text-align: start;
        font: inherit;
      }
      button.card {
        cursor: pointer;
      }
      button.card:hover:not(:disabled) {
        border-color: var(--primary);
      }
      button.card:disabled {
        cursor: not-allowed;
        opacity: 0.7;
      }
      .card.is-on {
        border-color: color-mix(in srgb, var(--primary) 45%, var(--border-default));
        background: color-mix(in srgb, var(--primary) 6%, var(--bg-surface));
      }
      .tick {
        display: grid;
        place-items: center;
        flex: none;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        border-radius: var(--radius-sm);
        background: var(--primary);
        color: var(--text-inverse);
        font-size: var(--text-xs);
      }
      .tick.is-empty {
        background: transparent;
        color: transparent;
        box-shadow: inset 0 0 0 1.5px var(--border-strong);
      }
      .text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .label {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        line-height: var(--leading-snug);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .tag {
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }
      .tag.is-type {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--border-default);
      }

      .search {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        block-size: var(--size-field);
        margin-block-end: var(--space-3);
        padding-inline: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-secondary);
      }
      .search input {
        flex: 1;
        min-inline-size: 0;
        border: 0;
        background: none;
        color: var(--text-primary);
        font: inherit;
        font-size: var(--text-sm);
      }
      .search input:focus-visible {
        outline-offset: 4px;
      }

      /* Explicit columns, so "three rows" is a number rather than whatever auto-fill lands on. */
      .grid.is-paged {
        grid-template-columns: repeat(var(--caq-cols, 1), minmax(0, 1fr));
      }
      .pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        margin-block-start: var(--space-3);
      }
      .pg {
        display: grid;
        place-items: center;
        inline-size: 2rem;
        block-size: 2rem;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        color: var(--text-primary);
        cursor: pointer;
      }
      .pg:hover:not(:disabled) {
        border-color: var(--primary);
      }
      .pg:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .pg:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .pg-range {
        min-inline-size: 7rem;
        text-align: center;
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }
      /* The arrows point along the reading direction. */
      :host-context([dir='rtl']) .pg [nz-icon] {
        transform: scaleX(-1);
      }

      @media (hover: none) {
        .pg {
          inline-size: 44px;
          block-size: 44px;
        }
        .card,
        .chk-add {
          min-block-size: 44px;
        }
      }
    `,
  ],
})
export class CompactAskedQuestionsComponent {
  readonly pool = input.required<readonly AskableQuestion[]>();
  readonly offered = input.required<readonly LoanCategory[]>();
  readonly category = input.required<LoanCategory>();
  readonly picks = input.required<AskedPicks>();
  readonly search = input<string>('');
  readonly isAr = input<boolean>(false);
  readonly busy = input<boolean>(false);
  /**
   * Whether "You added" rows can be taken back. True on the create flow, where nothing has been
   * written yet; false on a name's own page, where a tick is already saved and un-asking it is
   * not this screen's to do (the assignment is global).
   */
  readonly removable = input<boolean>(true);
  /** What an applicant of the name is served, per loan type — `null` on the create flow. */
  readonly served = input<readonly ServedCount[] | null>(null);

  readonly add = output<AskedRow>();
  readonly remove = output<AskedRow>();
  readonly categorySelect = output<LoanCategory>();
  readonly searchChange = output<string>();

  protected readonly railAria = $localize`:@@caq.rail_aria:Loan types this name is offered under`;

  protected readonly tabs = computed(() =>
    askedTabs(this.pool(), this.offered(), this.picks(), true),
  );

  /**
   * How many questions each loan type ASKS in total — stored assignments plus this session's
   * ticks. The board above counts only what it lists; this is the number the name's own page
   * reports as "asked here", so the two screens agree.
   */
  private readonly totals = computed(() => askedTabs(this.pool(), this.offered(), this.picks()));
  protected readonly askedTotal = computed(
    () => this.totals().find((t) => t.category === this.category())?.asked ?? 0,
  );
  protected readonly requiredTotal = computed(
    () =>
      this.pool().filter(
        (q) =>
          q.isActive &&
          q.isRequired &&
          (q.categories.includes(this.category()) ||
            (this.picks().get(this.category())?.has(q.id) ?? false)),
      ).length,
  );
  protected readonly optionalTotal = computed(() =>
    Math.max(0, this.askedTotal() - this.requiredTotal()),
  );

  protected readonly railItems = computed<RailTabItem[]>(() =>
    this.tabs().map((tab) => ({
      id: tab.category,
      label: categoryLabel(tab.category),
      count: this.totals().find((t) => t.category === tab.category)?.asked ?? tab.asked,
      countLabel: $localize`:@@caq.tab_count:questions asked`,
    })),
  );

  protected readonly validated = computed(() => isValidatedCategory(this.category()));
  protected readonly checks = computed(() =>
    coreChecks(this.pool(), this.category(), this.picks(), this.isAr()),
  );
  protected readonly ready = computed(() => this.checks().filter((c) => this.isOk(c)).length);
  protected readonly problems = computed(() => this.checks().length - this.ready());

  /** Every row, with the operator's own ticks in `asked` (blank-start reading). */
  private readonly all = computed(() =>
    askedSections(this.pool(), this.category(), this.picks(), '', this.isAr(), true),
  );

  private readonly coreCodes = computed(() => new Set(this.checks().map((c) => c.code)));

  /** Required and already asked here — minus the ones the checklist above already shows. */
  protected readonly required = computed(() =>
    this.all().rest.filter(
      (r) => r.alreadyAsked && r.isRequired && r.isActive && !this.coreCodes().has(r.code),
    ),
  );

  /** Rows per page, and how many columns they are laid out in. */
  private static readonly ROWS = 3;
  private readonly wide = signal(false);
  protected readonly cols = computed(() => (this.wide() ? 2 : 1));
  private readonly pageSize = computed(() => this.cols() * CompactAskedQuestionsComponent.ROWS);

  protected readonly page = signal(0);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.required().length / this.pageSize())),
  );
  protected readonly requiredPage = computed(() => {
    const size = this.pageSize();
    const at = Math.min(this.page(), this.pageCount() - 1);
    return this.required().slice(at * size, at * size + size);
  });
  protected readonly rangeLabel = computed(() => {
    const size = this.pageSize();
    const from = Math.min(this.page(), this.pageCount() - 1) * size + 1;
    const to = Math.min(from + size - 1, this.required().length);
    return $localize`:@@caq.range:${from}:FROM:–${to}:TO: of ${this.required().length}:TOTAL:`;
  });
  protected readonly pagerAria = $localize`:@@caq.pager_aria:Required questions, pages`;
  protected readonly prevAria = $localize`:@@caq.prev:Previous page`;
  protected readonly nextAria = $localize`:@@caq.next:Next page`;

  protected goTo(key: 'req' | 'res', next: number): void {
    if (key === 'req') this.page.set(Math.min(Math.max(next, 0), this.pageCount() - 1));
    else this.resPage.set(Math.min(Math.max(next, 0), this.resultsPageCount() - 1));
  }

  protected readonly mine = computed(() => this.all().asked);

  /**
   * Suggestions when the box is empty, hits when it is not — the same list, narrowed.
   * Questions this loan type does NOT ask yet come first: those are the ticks that change
   * something; the rest are already asked and are listed after them.
   */
  protected readonly matches = computed(() => {
    const found = askedSections(
      this.pool(),
      this.category(),
      this.picks(),
      this.search(),
      this.isAr(),
      true,
    ).rest;
    const shown = new Set(this.required().map((r) => r.id));
    const rows = found.filter((r) => !shown.has(r.id));
    return [...rows.filter((r) => !r.alreadyAsked), ...rows.filter((r) => r.alreadyAsked)];
  });

  protected readonly resPage = signal(0);
  protected readonly resultsPageCount = computed(() =>
    Math.max(1, Math.ceil(this.matches().length / this.pageSize())),
  );
  protected readonly resultsPage = computed(() => {
    const size = this.pageSize();
    const at = Math.min(this.resPage(), this.resultsPageCount() - 1);
    return this.matches().slice(at * size, at * size + size);
  });
  protected readonly resultsRange = computed(() => {
    const size = this.pageSize();
    const total = this.matches().length;
    const from = Math.min(this.resPage(), this.resultsPageCount() - 1) * size + 1;
    return $localize`:@@caq.range:${from}:FROM:–${Math.min(from + size - 1, total)}:TO: of ${total}:TOTAL:`;
  });
  protected readonly poolSize = computed(() => this.pool().length);

  constructor() {
    // Two columns from 640px up; one below. Kept in JS rather than CSS because the PAGE SIZE
    // depends on it — "three rows" must be three rows at either width.
    const mq = window.matchMedia('(min-width: 640px)');
    this.wide.set(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => this.wide.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
    // A different loan type is a different list: start at its first page.
    effect(() => {
      this.category();
      untracked(() => {
        this.page.set(0);
        this.resPage.set(0);
      });
    });
    // A new query is a new list.
    effect(() => {
      this.search();
      untracked(() => this.resPage.set(0));
    });
  }

  protected readonly servedHere = computed(
    () => this.served()?.find((r) => r.category === this.category()) ?? null,
  );

  protected servedText(sv: ServedCount): string {
    return $localize`:@@askq.served:An applicant who picks this name answers ${sv.servedTotal}:SERVED: of ${sv.categoryTotal}:TOTAL: ${this.typeName()}:TYPE: questions, ${sv.servedRequired}:REQUIRED: of them required.`;
  }

  protected totalText(): string {
    return $localize`:@@caq.total:${this.typeName()}:TYPE: applicants are asked ${this.askedTotal()}:TOTAL: questions in all — ${this.requiredTotal()}:REQUIRED: required, ${this.optionalTotal()}:OPTIONAL: optional. Required ones and your additions are listed here; the optional ones are in the suggestions below. Each applicant is then asked only what a bank program behind this name reads.`;
  }

  protected typeName(): string {
    return categoryLabel(this.category());
  }

  protected pickCategory(id: string): void {
    const match = this.tabs().find((t) => t.category === id);
    if (match) this.categorySelect.emit(match.category);
  }

  protected isOk(c: CoreCheck): boolean {
    return c.state === 'asked' || c.state === 'picked';
  }

  protected stateLabel(c: CoreCheck): string {
    switch (c.state) {
      case 'asked':
        return $localize`:@@caq.state_asked:Asked`;
      case 'picked':
        return $localize`:@@caq.state_picked:Added by you`;
      case 'not_asked':
        return $localize`:@@caq.state_not_asked:Not asked yet`;
      default:
        return $localize`:@@caq.state_unavailable:Not in the question pool`;
    }
  }

  /** Ticks a checklist question, by looking its row up rather than re-deriving one. */
  protected addCore(c: CoreCheck): void {
    const row = this.all().rest.find((r) => r.id === c.questionId);
    if (row) this.add.emit(row);
  }

  protected typeLabel(row: AskedRow): string | null {
    switch (row.type) {
      case 'SINGLE_SELECT':
        return $localize`:@@askq.type_single:Pick one`;
      case 'MULTI_SELECT':
        return $localize`:@@askq.type_multi:Pick several`;
      case 'NUMERIC':
        return $localize`:@@askq.type_number:Number`;
      case 'TEXT':
        return $localize`:@@askq.type_text:Text`;
      default:
        return null;
    }
  }

  protected addAria(row: AskedRow): string {
    return $localize`:@@caq.add_aria:Ask ${row.label}:QUESTION: of every ${this.typeName()}:TYPE: applicant`;
  }

  protected removeAria(row: AskedRow): string {
    return $localize`:@@caq.remove_aria:Untick ${row.label}:QUESTION:`;
  }
}
