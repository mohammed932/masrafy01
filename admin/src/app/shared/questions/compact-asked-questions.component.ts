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
  LockOutline,
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
  otherRows,
  untickLocks,
  type AskableQuestion,
  type AskedPicks,
  type AskedRow,
  type CoreCheck,
  type OtherRow,
  type ServedCount,
  type UntickLock,
} from './asked-questions.rules';

/**
 * A program name's questions step — on the create flow and on the name's own page.
 *
 * Three lists, and every tick on them is about THIS program name only:
 *
 *   - the checklist of what the quote needs, for the loan type;
 *   - "Asked of {type} applicants": what the loan type asks every name. Untick one and this
 *     name skips it (`program_name_question_exclusion`); the ones the quote reads are locked
 *     (`untickLocks`);
 *   - "Other questions": every other live question in the pool. Tick one and this name asks it
 *     too (`program_name_question_addition`, on an opt-in row) while every other name of the
 *     loan type goes on as before. A question every quote reads is the loan type's call and is
 *     shown but not tickable. The search box narrows this list; it never gates it.
 *
 * The only loan-type-wide write left here is the checklist's "Ask it", for a question the
 * quote cannot be priced without. Ten questions a page.
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
      LockOutline,
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
                } @else if (c.state === 'picked' && removable()) {
                  <button
                    type="button"
                    class="chk-add"
                    [disabled]="busy()"
                    (click)="undoCore(c)"
                    i18n="@@caq.check_undo"
                  >
                    Undo
                  </button>
                }
              </li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="caq-req-h">
        <h3 class="sec" id="caq-req-h">
          <span class="sec-t" i18n="@@caq.asked_h">Asked of {{ typeName() }} applicants</span>
          <span class="sec-n tabular">{{ required().length }}</span>
        </h3>
        <p class="hint" i18n="@@caq.asked_hint">
          Untick a question this program should not ask. Other programs of this loan type still ask
          it. Locked ones are what the loan amount is worked out from.
        </p>
        @if (skipped() > 0) {
          <p class="hint" role="status">{{ skippedText() }}</p>
        }
        @if (required().length === 0) {
          <p class="empty" i18n="@@caq.asked_none">No other question is asked.</p>
        } @else {
          <ul class="grid is-paged" [style.--caq-cols]="cols()">
            @for (row of requiredPage(); track row.id) {
              <li>
                @if (lockOf(row); as lock) {
                  <p class="card is-on is-locked">
                    <span class="tick" aria-hidden="true"
                      ><span nz-icon nzType="check" nzTheme="outline"></span
                    ></span>
                    <span class="text">
                      <span class="label">{{ row.label }}</span>
                      <span class="meta">
                        <span class="tag is-lock"
                          ><span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span
                          >{{ lockLabel(lock) }}</span
                        >
                        <ng-container
                          [ngTemplateOutlet]="rowTags"
                          [ngTemplateOutletContext]="{ $implicit: row }"
                        />
                      </span>
                    </span>
                  </p>
                } @else {
                  <button
                    type="button"
                    class="card"
                    [class.is-on]="!isSkipped(row)"
                    [class.is-skipped]="isSkipped(row)"
                    [attr.aria-pressed]="!isSkipped(row)"
                    [attr.aria-label]="toggleAria(row)"
                    [disabled]="busy()"
                    (click)="toggle(row)"
                  >
                    <span class="tick" [class.is-empty]="isSkipped(row)" aria-hidden="true"
                      ><span nz-icon nzType="check" nzTheme="outline"></span
                    ></span>
                    <span class="text">
                      <span class="label">{{ row.label }}</span>
                      <span class="meta">
                        @if (isSkipped(row)) {
                          <span class="tag is-skip" i18n="@@caq.tag_skipped"
                            >Not asked by this program</span
                          >
                        }
                        <ng-container
                          [ngTemplateOutlet]="rowTags"
                          [ngTemplateOutletContext]="{ $implicit: row }"
                        />
                      </span>
                    </span>
                  </button>
                }
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

      <ng-template #rowTags let-row>
        @if (row.isRequired) {
          <span class="tag" i18n="@@caq.tag_required">Required</span>
        } @else {
          <span class="tag" i18n="@@caq.tag_optional">Optional</span>
        }
        @if (typeLabel(row); as t) {
          <span class="tag is-type">{{ t }}</span>
        }
        @if (row.gated) {
          <span class="tag is-type" i18n="@@caq.tag_gated">Only if it applies</span>
        }
      </ng-template>

      <section aria-labelledby="caq-other-h">
        <h3 class="sec" id="caq-other-h">
          <span class="sec-t" i18n="@@caq.other_h">Other questions</span>
          <span class="sec-n tabular">{{ others().length }}</span>
        </h3>
        <p class="hint" i18n="@@caq.other_hint">
          Questions {{ typeName() }} does not ask every applicant. Tick one to ask it of this
          program's applicants too — no other program changes.
        </p>
        @if (addedCount() > 0) {
          <p class="hint" role="status">{{ addedText() }}</p>
        }
        <label class="search">
          <span class="sr-only" i18n="@@caq.other_search_aria">Search the other questions</span>
          <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
          <input
            type="search"
            [ngModel]="search()"
            (ngModelChange)="searchChange.emit($event)"
            placeholder="Search by wording, answer or code"
            i18n-placeholder="@@caq.other_search_ph"
          />
        </label>
        @if (others().length === 0) {
          <p class="empty">
            @if (search().trim() === '') {
              <span i18n="@@caq.other_none"
                >{{ typeName() }} already asks every question in the pool.</span
              >
            } @else {
              <span i18n="@@caq.no_match">Nothing else matches “{{ search() }}”.</span>
            }
          </p>
        } @else {
          <ul class="grid is-paged" [style.--caq-cols]="cols()">
            @for (row of otherPage(); track row.id) {
              <li>
                @if (row.loanTypeWide) {
                  <p class="card is-fixed">
                    <span class="tick is-empty" aria-hidden="true"
                      ><span nz-icon nzType="check" nzTheme="outline"></span
                    ></span>
                    <span class="text">
                      <span class="label">{{ row.label }}</span>
                      <span class="meta">
                        <span class="tag is-lock"
                          ><span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span
                          ><span i18n="@@caq.tag_loan_type_wide"
                            >Set for the whole loan type</span
                          ></span
                        >
                        <ng-container
                          [ngTemplateOutlet]="otherTags"
                          [ngTemplateOutletContext]="{ $implicit: row }"
                        />
                      </span>
                    </span>
                  </p>
                } @else if (row.heldByGate) {
                  <p class="card is-on is-locked">
                    <span class="tick" aria-hidden="true"
                      ><span nz-icon nzType="check" nzTheme="outline"></span
                    ></span>
                    <span class="text">
                      <span class="label">{{ row.label }}</span>
                      <span class="meta">
                        <span class="tag is-lock"
                          ><span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span
                          >{{ lockLabel('gate') }}</span
                        >
                        <span class="tag is-added" i18n="@@caq.tag_added"
                          >Added for this program</span
                        >
                        <ng-container
                          [ngTemplateOutlet]="otherTags"
                          [ngTemplateOutletContext]="{ $implicit: row }"
                        />
                      </span>
                    </span>
                  </p>
                } @else {
                  <button
                    type="button"
                    class="card"
                    [class.is-on]="row.added"
                    [attr.aria-pressed]="row.added"
                    [attr.aria-label]="otherAria(row)"
                    [disabled]="busy()"
                    (click)="toggleOther(row)"
                  >
                    <span class="tick" [class.is-empty]="!row.added" aria-hidden="true"
                      ><span nz-icon nzType="check" nzTheme="outline"></span
                    ></span>
                    <span class="text">
                      <span class="label">{{ row.label }}</span>
                      <span class="meta">
                        @if (row.added) {
                          <span class="tag is-added" i18n="@@caq.tag_added"
                            >Added for this program</span
                          >
                        }
                        <ng-container
                          [ngTemplateOutlet]="otherTags"
                          [ngTemplateOutletContext]="{ $implicit: row }"
                        />
                      </span>
                    </span>
                  </button>
                }
              </li>
            }
          </ul>
          @if (otherPageCount() > 1) {
            <ng-container
              [ngTemplateOutlet]="pagerTpl"
              [ngTemplateOutletContext]="{
                key: 'oth',
                page: otherPageAt(),
                count: otherPageCount(),
                label: otherRange(),
              }"
            />
          }
        }
      </section>

      <ng-template #otherTags let-row>
        <ng-container [ngTemplateOutlet]="rowTags" [ngTemplateOutletContext]="{ $implicit: row }" />
        @if (row.askedIn.length > 0) {
          <span class="tag is-type">{{ askedInText(row) }}</span>
        }
        @if (!row.added && row.alsoAdds.length > 0) {
          <span class="tag is-type">{{ alsoAddsText(row) }}</span>
        }
      </ng-template>

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
      .tag.is-lock {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        background: var(--bg-surface);
        box-shadow: inset 0 0 0 1px var(--border-default);
        color: var(--text-primary);
      }
      .tag.is-skip {
        background: var(--bg-surface);
        box-shadow: inset 0 0 0 1px var(--border-strong);
        color: var(--text-primary);
      }
      .card.is-locked .tick {
        background: var(--text-secondary);
      }
      .tag.is-added {
        background: color-mix(in srgb, var(--primary) 12%, var(--bg-surface));
        color: var(--primary-visible);
      }
      .card.is-fixed {
        background: var(--bg-subtle);
      }
      .card.is-fixed .label {
        color: var(--text-secondary);
      }
      /* Not a checkbox anyone can tick: a lighter, dimmed box, so it does not read as the
         empty-but-live box beside it. The lock chip still says why, in words. */
      .card.is-fixed .tick.is-empty {
        box-shadow: inset 0 0 0 1.5px var(--border-default);
        opacity: 0.6;
      }
      .card.is-skipped .label {
        color: var(--text-secondary);
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
   * Whether a checklist "Ask it" can be taken back. True on the create flow, where nothing has
   * been written yet; false on a name's own page, where it is already saved for the whole loan
   * type and un-asking it is not this screen's to do.
   */
  readonly removable = input<boolean>(true);
  /** What an applicant of the name is served, per loan type — `null` on the create flow. */
  readonly served = input<readonly ServedCount[] | null>(null);
  /** Question ids THIS name skips under the shown loan type. */
  readonly excluded = input<ReadonlySet<string>>(new Set<string>());
  /** Codes it may not skip, from the server (`questionLockReason`). */
  readonly locks = input<ReadonlyMap<string, 'engine' | 'program'>>(
    new Map<string, 'engine' | 'program'>(),
  );
  readonly exclude = output<AskedRow>();
  readonly include = output<AskedRow>();
  /**
   * Question ids THIS name adds under the shown loan type — asked of its applicants although
   * the loan type does not ask them of every name. Held by the host, gate chain included.
   */
  readonly added = input<ReadonlySet<string>>(new Set<string>());
  /** Tick in "Other questions": ask it of this name's applicants too. */
  readonly addHere = output<AskedRow>();
  /** Untick an added question. */
  readonly removeHere = output<AskedRow>();

  /** The checklist's loan-type-wide "Ask it", and its undo on the create flow. */
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

  /**
   * No count on the chip. It carried "how many questions this loan type asks in total",
   * which is the one number this screen is not about: the board below lists what is
   * REQUIRED and what you picked, so a chip reading 63 invited the operator to go looking
   * for sixty-three rows that were never meant to be on the page. The total still has a
   * home — the name's own page reports "asked here".
   */
  protected readonly railItems = computed<RailTabItem[]>(() =>
    this.tabs().map((tab) => ({
      id: tab.category,
      label: categoryLabel(tab.category),
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

  /**
   * Everything this loan type already asks, required first — minus the ones the checklist above
   * already shows. Each can be unticked for THIS name unless it is locked.
   */
  protected readonly required = computed(() => {
    const rows = this.all().rest.filter(
      (r) => r.alreadyAsked && r.isActive && !this.coreCodes().has(r.code),
    );
    return [...rows.filter((r) => r.isRequired), ...rows.filter((r) => !r.isRequired)];
  });
  /** Which rows cannot be unticked, and why. */
  private readonly untick = computed(() =>
    untickLocks(this.pool(), this.category(), this.picks(), this.excluded(), this.locks()),
  );
  protected readonly skipped = computed(
    () => this.required().filter((r) => this.isSkipped(r)).length,
  );

  /** Ten questions a page at any width; the grid lays them out in one or two columns. */
  private static readonly PAGE_SIZE = 10;
  private readonly wide = signal(false);
  protected readonly cols = computed(() => (this.wide() ? 2 : 1));
  private readonly pageSize = computed(() => CompactAskedQuestionsComponent.PAGE_SIZE);

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
  protected readonly pagerAria = $localize`:@@caq.pager_aria:Questions, pages`;
  protected readonly prevAria = $localize`:@@caq.prev:Previous page`;
  protected readonly nextAria = $localize`:@@caq.next:Next page`;

  protected goTo(key: 'req' | 'oth', next: number): void {
    if (key === 'req') this.page.set(Math.min(Math.max(next, 0), this.pageCount() - 1));
    else this.otherPageAt.set(Math.min(Math.max(next, 0), this.otherPageCount() - 1));
  }

  /**
   * "Other questions": every live question this loan type does not ask of every name, the
   * checklist's own excepted (drawn above). Listed in full — this list is where an extra
   * question is picked from — and narrowed only when the operator types.
   */
  protected readonly others = computed(() =>
    otherRows(
      this.pool(),
      this.category(),
      this.picks(),
      this.added(),
      this.search(),
      this.isAr(),
      this.locks(),
      this.coreCodes(),
    ),
  );
  /** How many this name adds under the shown loan type — the list's own count, unsearched. */
  protected readonly addedCount = computed(
    () => [...this.added()].filter((id) => this.pool().some((q) => q.id === id)).length,
  );

  protected readonly otherPageAt = signal(0);
  protected readonly otherPageCount = computed(() =>
    Math.max(1, Math.ceil(this.others().length / this.pageSize())),
  );
  protected readonly otherPage = computed(() => {
    const size = this.pageSize();
    const at = Math.min(this.otherPageAt(), this.otherPageCount() - 1);
    return this.others().slice(at * size, at * size + size);
  });
  protected readonly otherRange = computed(() => {
    const size = this.pageSize();
    const total = this.others().length;
    const from = Math.min(this.otherPageAt(), this.otherPageCount() - 1) * size + 1;
    return $localize`:@@caq.range:${from}:FROM:–${Math.min(from + size - 1, total)}:TO: of ${total}:TOTAL:`;
  });

  protected toggleOther(row: OtherRow): void {
    if (row.loanTypeWide || row.heldByGate) return;
    if (row.added) this.removeHere.emit(row);
    else this.addHere.emit(row);
  }

  protected otherAria(row: OtherRow): string {
    return row.added
      ? $localize`:@@caq.exclude_aria:Stop asking ${row.label}:QUESTION: for this program`
      : $localize`:@@caq.add_here_aria:Ask ${row.label}:QUESTION: of this program's applicants too`;
  }

  protected askedInText(row: OtherRow): string {
    const types = row.askedIn.map((c) => categoryLabel(c)).join(' · ');
    return $localize`:@@caq.tag_asked_in:Asked in ${types}:TYPES:`;
  }

  protected alsoAddsText(row: OtherRow): string {
    const names = row.alsoAdds.join(' · ');
    return $localize`:@@caq.tag_also_adds:Also adds ${names}:QUESTIONS:`;
  }

  protected addedText(): string {
    return $localize`:@@caq.added_count:${this.addedCount()}:COUNT: added for this program.`;
  }

  protected lockOf(row: AskedRow): UntickLock | null {
    return this.untick().get(row.id) ?? null;
  }

  /** Unticked for this name, and not held by a lock (a locked row is asked whatever is stored). */
  protected isSkipped(row: AskedRow): boolean {
    return this.excluded().has(row.id) && this.lockOf(row) === null;
  }

  protected toggle(row: AskedRow): void {
    if (this.lockOf(row) !== null) return;
    if (this.isSkipped(row)) this.include.emit(row);
    else this.exclude.emit(row);
  }

  protected lockLabel(lock: UntickLock): string {
    switch (lock) {
      case 'engine':
        return $localize`:@@caq.lock_engine:Needed for every quote`;
      case 'program':
        return $localize`:@@caq.lock_program:Read by a bank program under this name`;
      default:
        return $localize`:@@caq.lock_gate:Another asked question depends on it`;
    }
  }

  protected skippedText(): string {
    return $localize`:@@caq.skipped:${this.skipped()}:COUNT: of these are not asked by this program.`;
  }

  protected toggleAria(row: AskedRow): string {
    return this.isSkipped(row)
      ? $localize`:@@caq.include_aria:Ask ${row.label}:QUESTION: again for this program`
      : $localize`:@@caq.exclude_aria:Stop asking ${row.label}:QUESTION: for this program`;
  }

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
        this.otherPageAt.set(0);
      });
    });
    // A new query is a new list.
    effect(() => {
      this.search();
      untracked(() => this.otherPageAt.set(0));
    });
  }

  protected readonly servedHere = computed(
    () => this.served()?.find((r) => r.category === this.category()) ?? null,
  );

  protected servedText(sv: ServedCount): string {
    // No bank program under the name yet: the name axis is off, so its unticks and additions
    // are saved but the applicant is asked what the loan type asks. Saying so beats a count
    // that silently ignores what the operator just did.
    if (sv.nameAxisActive === false) {
      return $localize`:@@caq.served_inactive:No bank program is filed under this name yet, so its applicants are asked what ${this.typeName()}:TYPE: asks. What you untick or add here takes effect once one is.`;
    }
    const extra = sv.servedExtra ?? 0;
    if (extra > 0) {
      return $localize`:@@caq.served_extra:An applicant who picks this name answers ${sv.servedTotal}:SERVED: questions — ${sv.servedTotal - extra}:OWN: of the ${sv.categoryTotal}:TOTAL: ${this.typeName()}:TYPE: questions, plus ${extra}:EXTRA: asked only for this program — ${sv.servedRequired}:REQUIRED: of them required.`;
    }
    return $localize`:@@askq.served:An applicant who picks this name answers ${sv.servedTotal}:SERVED: of ${sv.categoryTotal}:TOTAL: ${this.typeName()}:TYPE: questions, ${sv.servedRequired}:REQUIRED: of them required.`;
  }

  protected totalText(): string {
    return $localize`:@@caq.total:${this.typeName()}:TYPE: applicants are asked ${this.askedTotal()}:TOTAL: questions in all — ${this.requiredTotal()}:REQUIRED: required, ${this.optionalTotal()}:OPTIONAL: optional. Untick any this program should not ask, and tick any of the other questions below to ask it of this program's applicants only. Each applicant is then asked only what a bank program behind this name reads.`;
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

  /** Takes a checklist tick back — the create flow only, where nothing is written yet. */
  protected undoCore(c: CoreCheck): void {
    const row = this.all().asked.find((r) => r.id === c.questionId);
    if (row) this.remove.emit(row);
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
}
