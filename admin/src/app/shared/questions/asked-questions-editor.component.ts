import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CheckOutline, SearchOutline, UserOutline } from '@ant-design/icons-angular/icons';
import { RailTabsComponent, type RailTabItem } from '@shared/ui/rail-tabs.component';
import { categoryLabel, type LoanCategory } from '@core/loan-category';
import {
  askedSections,
  askedTabs,
  groupRows,
  type AskableQuestion,
  type AskedPicks,
  type AskedRow,
  type ServedCount,
} from './asked-questions.rules';

/**
 * What applicants of each loan type are asked — the board a catalog name's flow ends on, and
 * the same one its detail page carries for editing later.
 *
 * PRESENTATIONAL. It knows nothing about WHEN a write happens: the create flow batches every
 * tick into one request at Finish, because the name does not exist yet and a per-tick write
 * would cut a questionnaire version for a name the operator may cancel out of; the detail
 * page writes on each tap, because the name exists and there is no Finish. Same component,
 * same rules module, two write models, and the difference lives entirely in the host.
 *
 * ADD-ONLY, and the reason is on screen rather than implied. A tick writes
 * `question_loan_category`, which is GLOBAL — it says which loan types ask a question, for
 * every program name at once. Widening it is additive and safe. Narrowing it would stop
 * asking that question for every program of that loan type, so nothing here can un-ask a
 * question and the row that owns removal links out to the screen that owns it.
 *
 * `blankStart` is the create flow's reading of the same board, and it is a rendering
 * difference only — no write changes. The name does not exist yet, so NOTHING on this board
 * describes it: the ticked list opens empty and fills only with the operator's own picks,
 * and a question the loan type already asks waits in the second list wearing a tag that says
 * so. That tag is what keeps the blank start honest — leaving such a row un-ticked does not
 * stop it being asked, because this board cannot narrow a global list. Taking back one of
 * your own ticks IS offered there, since nothing has been written and a pick you cannot undo
 * before Finish is a trap.
 */
@Component({
  selector: 'app-asked-questions-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NzIconModule, RailTabsComponent],
  providers: [provideNzIconsPatch([CheckOutline, SearchOutline, UserOutline])],
  template: `
    @if (tabs().length === 0) {
      <p class="none" role="status" i18n="@@askq.no_types">
        Pick at least one loan type first — what applicants are asked is set per loan type.
      </p>
    } @else {
      <app-rail-tabs
        [items]="railItems()"
        [activeId]="category()"
        [ariaLabel]="railAria"
        idPrefix="askq"
        appearance="segmented"
        [uniform]="true"
        (select)="pickCategory($event)"
      />

      <p class="reach">
        @if (blankStart()) {
          <span i18n="@@askq.reach_blank"
            >Nothing is ticked. You pick what these applicants are asked.</span
          >
          <span class="reach-more" i18n="@@askq.reach_blank_global"
            >A tick asks it of every {{ categoryName() }} applicant, not only this program — and a
            question this loan type already asks stays asked whether you tick it or not.</span
          >
        } @else {
          <span i18n="@@askq.reach"
            >These are the questions every {{ categoryName() }} applicant answers — not only this
            program.</span
          >
          <!-- Said once, here, because 57 ticks read as a promise otherwise: the applicant is
             served a narrower set still, worked out per request from what a bank's program
             behind this name can actually be quoted from. A name with no bank programs yet is
             served the whole list. -->
          <span class="reach-more" i18n="@@askq.reach_narrow"
            >Each applicant is then asked only the ones a bank program behind this name reads.</span
          >
        }
      </p>

      @if (servedHere(); as sv) {
        <!-- What a tick costs an applicant of THIS name, counted off the snapshot the customer
             is actually served (same figure the surrogate product board reports). -->
        <p class="served" role="status">
          <span nz-icon nzType="user" nzTheme="outline" aria-hidden="true"></span>
          <span>{{ servedText(sv) }}</span>
        </p>
      }

      <div class="head">
        <p class="count">
          <strong class="tabular">{{ sections().asked.length }}</strong>
          @if (blankStart()) {
            <span i18n="@@askq.count_ticked">ticked</span>
          } @else {
            <span i18n="@@askq.count">asked here</span>
            @if (addingHere() > 0) {
              <span class="adding" i18n="@@askq.adding">+{{ addingHere() }} you added</span>
            }
          }
        </p>
        <label class="search">
          <span class="sr-only" i18n="@@askq.search_aria">Search the question pool</span>
          <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
          <input
            type="search"
            [ngModel]="search()"
            (ngModelChange)="searchChange.emit($event)"
            placeholder="Search questions, answers or codes"
            i18n-placeholder="@@askq.search_ph"
          />
        </label>
      </div>

      @if (pinned().length > 0) {
        <!-- The questions an applicant of THIS name is actually served, on top. Everything
             else this loan type asks sits below, folded by section, so the list an operator
             reads first is the one that matters for the name they are on. -->
        <p class="sec" [id]="'askq-sec-pinned-' + category()">
          @if (pinnedIsServed()) {
            <span i18n="@@askq.sec_pinned">Asked of this name's applicants</span>
          } @else {
            <span i18n="@@askq.sec_pinned_req">Required of {{ categoryName() }} applicants</span>
          }
          <span class="sec-n tabular">{{ pinned().length }}</span>
        </p>
        <ul class="grid" [attr.aria-labelledby]="'askq-sec-pinned-' + category()">
          @for (row of pinnedShown(); track row.id) {
            <li>
              <p class="card is-on">
                <span class="tick" aria-hidden="true">
                  <span nz-icon nzType="check" nzTheme="outline"></span>
                </span>
                <span class="text">
                  <span class="label">{{ row.label }}</span>
                  @if (optionsLine(row); as line) {
                    <span class="opts">{{ line }}</span>
                  }
                  <span class="meta">
                    @if (row.isRequired) {
                      <span class="tag" i18n="@@askq.tag_required">Required</span>
                    }
                    @if (typeLabel(row); as t) {
                      <span class="tag is-type">{{ t }}</span>
                    }
                  </span>
                </span>
              </p>
            </li>
          }
        </ul>
        @if (pinned().length > PINNED_ROWS) {
          <button
            type="button"
            class="link pinned-toggle"
            [attr.aria-expanded]="pinnedAll()"
            (click)="pinnedAll.set(!pinnedAll())"
          >
            {{ pinnedToggleLabel() }}
          </button>
        }
      }

      <p class="sec" [id]="'askq-sec-asked-' + category()">
        @if (blankStart()) {
          <span i18n="@@askq.sec_ticked">Ticked by you</span>
        } @else if (pinned().length > 0) {
          <span i18n="@@askq.sec_asked_also">Also asked in this loan type</span>
        } @else {
          <span i18n="@@askq.sec_asked">Asked in this loan type</span>
        }
        <span class="sec-n tabular">{{ askedRest().length }}</span>
      </p>
      @if (askedRest().length === 0) {
        @if (blankStart()) {
          <p class="sec-empty" i18n="@@askq.sec_ticked_empty">
            Nothing ticked yet. Tick a question below to have it asked.
          </p>
        } @else {
          <p class="sec-empty" i18n="@@askq.sec_asked_empty">
            Nothing is asked here yet. Tick a question below and every applicant of this loan type
            will be asked it.
          </p>
        }
      } @else {
        @for (g of askedGroups(); track g.key) {
        <details class="grp">
          @if (g.title) {
            <summary class="grp-title">
              <span>{{ g.title }}</span>
              <span class="sec-n tabular">{{ g.rows.length }}</span>
            </summary>
          }
        <ul class="grid" [attr.aria-labelledby]="'askq-sec-asked-' + category()">
          @for (row of g.rows; track row.id) {
            <li>
              <!-- Pressable ONLY on a blank-start board, where every row in this list is a
                   tick of the operator's own that has not been written yet, so taking it back
                   costs nothing and is the other half of "you decide". Everywhere else this is
                   stored state: the only thing a press could do is un-ask the question for
                   every program of this loan type, which is not this screen's to do — so it
                   stays a statement, and the way to change it is named once below. -->
              @if (blankStart()) {
                <button
                  type="button"
                  class="card is-on is-new"
                  [disabled]="busy()"
                  [attr.aria-label]="removeAria(row)"
                  (click)="remove.emit(row)"
                >
                  <span class="tick" aria-hidden="true">
                    <span nz-icon nzType="check" nzTheme="outline"></span>
                  </span>
                  <span class="text">
                    <span class="label">{{ row.label }}</span>
                    @if (optionsLine(row); as line) {
                      <span class="opts">{{ line }}</span>
                    }
                    <span class="meta">
                    @if (typeLabel(row); as t) {
                      <span class="tag is-type">{{ t }}</span>
                    }
                      @if (row.isRequired) {
                        <span class="tag" i18n="@@askq.tag_required">Required</span>
                      }
                      @if (row.alreadyAsked) {
                        <span class="tag" i18n="@@askq.tag_already">Already asked anyway</span>
                      }
                    </span>
                  </span>
                </button>
              } @else {
                <p class="card is-on" [class.is-new]="row.justPicked">
                  <span class="tick" aria-hidden="true">
                    <span nz-icon nzType="check" nzTheme="outline"></span>
                  </span>
                  <span class="text">
                    <span class="label">{{ row.label }}</span>
                    @if (optionsLine(row); as line) {
                      <span class="opts">{{ line }}</span>
                    }
                    <span class="meta">
                    @if (typeLabel(row); as t) {
                      <span class="tag is-type">{{ t }}</span>
                    }
                      @if (row.justPicked) {
                        <span class="tag is-new" i18n="@@askq.tag_added">Added by you</span>
                      }
                      @if (row.isRequired) {
                        <span class="tag" i18n="@@askq.tag_required">Required</span>
                      }
                    </span>
                  </span>
                </p>
              }
            </li>
          }
        </ul>
        </details>
        }
      }

      <p class="sec is-quiet" [id]="'askq-sec-rest-' + category()">
        @if (blankStart()) {
          <span i18n="@@askq.sec_not_ticked">Not ticked</span>
        } @else {
          <span i18n="@@askq.sec_rest">Not asked here</span>
        }
        <span class="sec-n tabular">{{ sections().rest.length }}</span>
      </p>
      @if (sections().rest.length === 0) {
        <p class="sec-empty">
          @if (search().trim() !== '') {
            <span i18n="@@askq.no_match">Nothing in the pool matches “{{ search() }}”.</span>
            <button type="button" class="link" (click)="searchChange.emit('')" i18n="@@askq.clear">
              Clear the search
            </button>
          } @else {
            @if (blankStart()) {
              <span i18n="@@askq.sec_not_ticked_empty"
                >You have ticked every question in the pool.</span
              >
            } @else {
              <span i18n="@@askq.sec_rest_empty"
                >Every question in the pool is already asked for this loan type.</span
              >
            }
          }
        </p>
      } @else {
        @for (g of restGroups(); track g.key) {
        <details class="grp" [attr.open]="search().trim() !== '' ? '' : null">
          @if (g.title) {
            <summary class="grp-title">
              <span>{{ g.title }}</span>
              <span class="sec-n tabular">{{ g.rows.length }}</span>
            </summary>
          }
        <ul class="grid is-quiet" [attr.aria-labelledby]="'askq-sec-rest-' + category()">
          @for (row of g.rows; track row.id) {
            <li>
              <button
                type="button"
                class="card"
                [class.is-off]="!row.isActive"
                [disabled]="!row.isActive || busy()"
                [attr.aria-busy]="saving().has(row.id) ? 'true' : null"
                [attr.aria-label]="addAria(row)"
                (click)="add.emit(row)"
              >
                <span class="tick is-empty" aria-hidden="true">
                  <span nz-icon nzType="check" nzTheme="outline"></span>
                </span>
                <span class="text">
                  <span class="label">{{ row.label }}</span>
                    @if (optionsLine(row); as line) {
                      <span class="opts">{{ line }}</span>
                    }
                  <span class="meta">
                    @if (typeLabel(row); as t) {
                      <span class="tag is-type">{{ t }}</span>
                    }
                    @if (!row.isActive) {
                      <span class="tag" i18n="@@askq.tag_parked">Switched off — asks nobody</span>
                    } @else {
                      @if (row.isRequired) {
                        <span class="tag" i18n="@@askq.tag_required">Required</span>
                      }
                      @if (row.alsoAdds.length > 0) {
                        <span class="tag is-chain">{{ alsoAddsLabel(row) }}</span>
                      }
                    }
                  </span>
                </span>
              </button>
            </li>
          }
        </ul>
        </details>
        }
      }

      <p class="foot">
        <span i18n="@@askq.remove_hint"
          >To stop a question being asked, change it where every loan type's questions are set
          —</span
        >
        <a [href]="manageHref()" i18n="@@askq.remove_link">Who gets asked what</a>
      </p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
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
      .none {
        margin: 0;
        padding: var(--space-5);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-lg);
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }

      /* Said before the first tick, so it is read as a condition of the board rather than
         discovered as a consequence of one. */
      .reach {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        margin: var(--space-4) 0 var(--space-5);
        color: var(--text-secondary);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }
      .reach-more {
        color: var(--text-secondary);
      }

      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-block-end: var(--space-4);
      }
      .count {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }
      .count strong {
        color: var(--text-primary);
        font-size: var(--text-lg);
        font-weight: var(--font-bold);
      }
      .adding {
        color: var(--primary-visible);
        font-weight: var(--font-semibold);
      }

      .search {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 16rem;
        block-size: var(--size-field);
        padding-inline: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-field);
        background: var(--bg-subtle);
        color: var(--text-tertiary);
      }
      .search:focus-within {
        border-color: var(--primary);
        box-shadow: var(--focus-halo);
      }
      .search input {
        flex: 1 1 auto;
        min-inline-size: 0;
        border: 0;
        background: none;
        color: var(--text-primary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
      }
      .search input:focus {
        outline: none;
      }

      .sec {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: var(--space-5) 0 var(--space-3);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .sec-n {
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
        letter-spacing: 0;
      }
      .sec-empty {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
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
        min-block-size: 68px;
        margin: 0;
        padding: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        color: var(--text-primary);
        text-align: start;
        font: inherit;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      button.card {
        cursor: pointer;
      }
      button.card:hover:not(:disabled) {
        border-color: var(--primary);
        background: var(--bg-subtle);
      }
      button.card:active:not(:disabled) {
        background: var(--bg-muted);
      }
      button.card:focus-visible {
        /* Opaque, never the translucent halo on its own — that measures 1.24:1 in light and
           is not an indicator when nothing else carries the contrast. */
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      button.card:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .card.is-on {
        border-color: color-mix(in srgb, var(--primary) 40%, var(--border-default));
        background: color-mix(in srgb, var(--primary) 5%, var(--bg-surface));
      }
      .card.is-new {
        border-color: var(--primary);
      }

      .tick {
        display: grid;
        flex: 0 0 auto;
        place-items: center;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        margin-block-start: 2px;
        border-radius: var(--radius-sm);
        background: var(--primary);
        color: var(--text-inverse);
        font-size: 12px;
      }
      .tick.is-empty {
        border: 1px solid var(--border-strong);
        background: none;
        color: transparent;
      }
      button.card:hover:not(:disabled) .tick.is-empty {
        border-color: var(--primary);
        color: color-mix(in srgb, var(--primary) 45%, transparent);
      }

      .text {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .label {
        color: var(--text-primary);
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
      .tag.is-new {
        background: color-mix(in srgb, var(--primary) 12%, var(--bg-surface));
        color: var(--primary-visible);
      }
      .tag.is-chain {
        background: color-mix(in srgb, var(--warning) 14%, var(--bg-surface));
        /* Primary ink on the wash: the warning colour AS ink measures 2.53:1 here. */
        color: var(--text-primary);
      }

      .served {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0 0 var(--space-4);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--border-default);
        border-inline-start: 3px solid var(--primary);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
        color: var(--text-primary);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }

      .grp {
        margin: 0 0 var(--space-4);
      }
      .grp-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-end: var(--space-2);
        padding-block: var(--space-1);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        list-style: none;
      }
      .grp-title::-webkit-details-marker {
        display: none;
      }
      .grp-title::before {
        content: '';
        inline-size: 0.45rem;
        block-size: 0.45rem;
        border-inline-end: 2px solid currentColor;
        border-block-end: 2px solid currentColor;
        transform: rotate(-45deg);
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .grp[open] > .grp-title::before {
        transform: rotate(45deg);
      }
      :host-context([dir='rtl']) .grp:not([open]) > .grp-title::before {
        transform: rotate(135deg);
      }
      .grp-title:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }

      .opts {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: var(--text-secondary);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
      }
      .tag.is-type {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--border-default);
      }

      .pinned-toggle {
        margin-block-start: var(--space-3);
      }

      .foot {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: var(--space-5) 0 0;
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--border-default);
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }
      .link,
      .foot a {
        border: 0;
        background: none;
        color: var(--primary-visible);
        font: inherit;
        font-weight: var(--font-semibold);
        text-decoration: underline;
        cursor: pointer;
      }
      .link:focus-visible,
      .foot a:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }

      @media (hover: none) {
        .card {
          min-block-size: 44px;
        }
        .link,
        .foot a {
          min-block-size: 44px;
          display: inline-flex;
          align-items: center;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .card {
          transition: none;
        }
      }
    `,
  ],
})
export class AskedQuestionsEditorComponent {
  readonly pool = input.required<readonly AskableQuestion[]>();
  readonly offered = input.required<readonly LoanCategory[]>();
  readonly category = input.required<LoanCategory>();
  readonly picks = input.required<AskedPicks>();
  readonly search = input<string>('');
  readonly isAr = input<boolean>(false);
  /** Ids with a write in flight — the detail page writes per tap; the create flow never sets it. */
  readonly saving = input<ReadonlySet<string>>(new Set<string>());
  readonly busy = input<boolean>(false);
  /**
   * Render as a blank slate: the ticked list starts empty and holds only this session's
   * picks. See the class docblock — the create flow sets it, the detail page never does.
   */
  readonly blankStart = input<boolean>(false);

  /**
   * What an applicant of the name on this page is served, per loan type — `null` on the create
   * flow, where the name does not exist yet and there is nothing to count.
   */
  readonly served = input<readonly ServedCount[] | null>(null);

  readonly add = output<AskedRow>();
  /** A pick taken back. Emitted on a blank-start board only; nothing else can un-tick. */
  readonly remove = output<AskedRow>();
  readonly categorySelect = output<LoanCategory>();
  readonly searchChange = output<string>();

  protected readonly railAria = $localize`:@@askq.rail_aria:Loan types this name is offered under`;

  protected readonly sections = computed(() =>
    askedSections(
      this.pool(),
      this.category(),
      this.picks(),
      this.search(),
      this.isAr(),
      this.blankStart(),
    ),
  );

  /**
   * Served rows pinned to the top: the asked questions an applicant of this name actually
   * answers. Only when the name narrows anything — a name with no programs behind it is served
   * the whole list, and pinning all of it would just repeat the section below.
   */
  protected readonly pinned = computed<readonly AskedRow[]>(() => {
    if (this.blankStart()) return [];
    const row = this.served()?.find((r) => r.category === this.category());
    const codes = row?.servedQuestionCodes;
    const narrowed = row !== undefined && codes !== undefined && row.servedTotal < row.categoryTotal;
    const asked = this.sections().asked;
    if (narrowed) {
      const wanted = new Set(codes);
      return asked.filter((r) => wanted.has(r.code)).sort((a, b) => Number(b.isRequired) - Number(a.isRequired));
    }
    // Nothing narrows this name (no bank program behind it yet), so it is served the whole
    // list. Lead with the REQUIRED ones instead — the part every applicant must answer —
    // and leave the optional rest folded below.
    return asked.filter((r) => r.isRequired && r.isActive);
  });
  /** True when the pinned list is what this name's applicants are served, not just required. */
  protected readonly pinnedIsServed = computed(() => {
    const row = this.served()?.find((r) => r.category === this.category());
    return row !== undefined && row.servedQuestionCodes !== undefined && row.servedTotal < row.categoryTotal;
  });
  /** Three rows of two on first sight; the rest one click away. */
  protected readonly PINNED_ROWS = 6;
  protected readonly pinnedAll = signal(false);
  protected readonly pinnedShown = computed(() =>
    this.pinnedAll() ? this.pinned() : this.pinned().slice(0, this.PINNED_ROWS),
  );
  protected pinnedToggleLabel(): string {
    return this.pinnedAll()
      ? $localize`:@@askq.pinned_less:Show fewer`
      : $localize`:@@askq.pinned_more:Show all ${this.pinned().length}:COUNT:`;
  }
  protected readonly askedRest = computed(() => {
    const top = new Set(this.pinned().map((r) => r.id));
    return this.sections().asked.filter((r) => !top.has(r.id));
  });
  protected readonly askedGroups = computed(() => groupRows(this.askedRest()));
  protected readonly restGroups = computed(() => groupRows(this.sections().rest));

  protected readonly servedHere = computed(
    () => this.served()?.find((r) => r.category === this.category()) ?? null,
  );

  protected servedText(sv: ServedCount): string {
    return $localize`:@@askq.served:An applicant who picks this name answers ${sv.servedTotal}:SERVED: of ${sv.categoryTotal}:TOTAL: ${this.categoryName()}:TYPE: questions, ${sv.servedRequired}:REQUIRED: of them required.`;
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

  /** First few answers, so a card says what the applicant chooses between. */
  protected optionsLine(row: AskedRow): string | null {
    if (row.options.length === 0) return null;
    const shown = row.options.slice(0, 3).join(' · ');
    const more = row.options.length - 3;
    return more > 0 ? `${shown} · +${more}` : shown;
  }

  protected readonly tabs = computed(() =>
    askedTabs(this.pool(), this.offered(), this.picks(), this.blankStart()),
  );

  protected readonly railItems = computed<RailTabItem[]>(() =>
    this.tabs().map((tab) => ({
      id: tab.category,
      label: categoryLabel(tab.category),
      count: tab.asked,
      // The rail counts what the board shows, so on a blank start it counts TICKS — and a
      // number labelled "questions asked" that moves only when the operator clicks would be
      // claiming their tick is the whole of what this loan type asks, which it is not.
      countLabel: this.blankStart()
        ? $localize`:@@askq.tab_count_ticked:questions ticked`
        : $localize`:@@askq.tab_count:questions asked`,
    })),
  );

  protected readonly addingHere = computed(
    () => this.tabs().find((t) => t.category === this.category())?.adding ?? 0,
  );

  protected categoryName(): string {
    return categoryLabel(this.category());
  }

  protected pickCategory(id: string): void {
    const match = this.tabs().find((t) => t.category === id);
    if (match) this.categorySelect.emit(match.category);
  }

  /** The screen that owns removal, deep-linked to the loan type on stage. */
  protected manageHref(): string {
    return `/questionnaire/categories?cat=${this.category()}`;
  }

  protected alsoAddsLabel(row: AskedRow): string {
    return $localize`:@@askq.also_adds:Also adds ${row.alsoAdds.join(' · ')}:QUESTIONS:`;
  }

  /**
   * The row's accessible name. A screen reader has no section heading in view at the moment
   * of the press, so the name says the ACT and the loan type, not just the wording.
   */
  protected addAria(row: AskedRow): string {
    return $localize`:@@askq.add_aria:Ask ${row.label}:QUESTION: of every ${this.categoryName()}:TYPE: applicant`;
  }

  /** Same reasoning as `addAria`: the act first, because no heading is in view. */
  protected removeAria(row: AskedRow): string {
    return $localize`:@@askq.remove_aria:Untick ${row.label}:QUESTION:`;
  }
}
