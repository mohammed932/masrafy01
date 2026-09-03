import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, map } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import {
  CheckOutline,
  ExclamationCircleOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { RailTabsComponent, type RailTabItem } from '@shared/ui';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import type { EnumerationRow } from '@features/lookups/lookups.api.service';
import { PARENT_KEYS_BULK_MAX } from '@features/lookups/lookups.api.service';
import { slugify } from './slug';
import { pageSlice, type ValuePage } from './value-groups';

/** One value as this board renders it: the row, plus where it sits right now. */
interface BoardValue {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly parentKey: string | null;
  readonly active: boolean;
}

/**
 * What on the board needs a human — reported to the host so a FOLDED board can still say so.
 *
 * Two counts and not one, because the two are different failures: an unfiled value quotes
 * nothing at all, a catch-all value quotes the catch-all's figure. Collapsing them into
 * "N problems" would let the survivable one hide the fatal one.
 */
export interface BoardAttention {
  readonly unfiled: number;
  readonly inFallback: number;
}

/**
 * Where each value is priced — the class board.
 *
 * ─── The problem it exists to solve ───────────────────────────────────────────
 *
 * A bank keys its cap table by CLASS (a handful of rows) while the customer picks a value by
 * NAME (as many as the operator typed), and `factParentTable` walks one to the other through
 * the value's `parentKey`. So the single most consequential thing an operator does to such a
 * product is decide which tier a value is priced in — and without this screen, the only way to
 * do it is to open one value at a time in the shared value dialog and pick from a dropdown
 * labelled "Filed under". Re-tiering nine values is nine dialogs, and there is nowhere to see
 * the tiers as a set at all.
 *
 * This board inverts it: pick a class, see every value at once, split into the ones priced
 * here and the ones priced elsewhere, and move as many as you like in one action.
 *
 * ─── What a tick means, and what unticking costs ──────────────────────────────
 *
 * A value's class is a SINGLE parent, so the count is at most one: ticking a candidate MOVES
 * it here from wherever it was — never adds a second class — and unticking takes it out of this
 * one without putting it in another. A candidate card therefore names the class it would LEAVE.
 *
 * Unticking is a real and costly answer, not an undo. An unfiled value is still offered to
 * the customer, and `factParentTable` then answers `no_matching_row` — which is NOT a skippable
 * reason, so the rule stops and every bank keying its cap table by the class quotes that
 * applicant nothing. That is why it can only be said through this screen and through the one
 * endpoint built for moves: create refuses it, and a label-only patch cannot reach it.
 *
 * The board already had the vocabulary for the state before it could produce it — a `No class`
 * warn tag, unfiled-first ordering, and a notice counting them at the top of the panel. Those
 * are the feedback for this action.
 *
 * ─── The rank tint ────────────────────────────────────────────────────────────
 *
 * Money is deliberately absent. What a class pays is per BANK — EG Bank's Class A is
 * 6 000 000 and another bank's need not be — so a figure here would be a lie the moment a
 * second bank configures the product. What the board CAN say honestly is the ORDER, which is
 * the registry's own `sortOrder`: the accent strength descends with rank, and the active class
 * says its position in words. A scale you can see beats a number that is only sometimes true.
 */
/**
 * How long the board waits before re-filtering. Long enough to skip the intermediate states of
 * a typed word, short enough that the list still feels attached to the box.
 */
const SEARCH_DEBOUNCE_MS = 200;

/**
 * Cards on one page of either group.
 *
 * PAGED rather than capped: the previous version rendered the first two hundred candidates and
 * told the operator to search for the rest, which is only an answer when they know what they
 * are looking for — filing seventy compounds means walking the whole list, and a name is
 * unreachable until you can spell it. Sixteen fills the three-column grid just over five rows
 * deep, so a page is one screen with the pager in view rather than one scroll.
 *
 * `pageSlice` is the shared clamp the values list and the ask grid already use, so a page
 * index that goes out of range (a move empties the group, a search narrows it) lands on the
 * last page that exists instead of an empty grid under a pager reading "4 of 2".
 */
const CARD_PAGE_SIZE = 16;

@Component({
  selector: 'app-parent-class-board',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzPaginationModule,
    RailTabsComponent,
  ],
  providers: [provideNzIconsPatch([CheckOutline, ExclamationCircleOutline, SearchOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="head">
        <h2 class="title" i18n="@@clsb.title">Where each value is priced</h2>
        <p class="lede" i18n="@@clsb.lede">
          A bank states one amount per class. A customer picks a value by name. This is where the
          two meet — so a value in the wrong class is priced at the wrong ceiling.
        </p>
        @if (!loading()) {
          <p class="counts">
            <span>{{ boardValues().length }} <span i18n="@@clsb.count_values">values</span></span>
            <span class="dot" aria-hidden="true">·</span>
            <span>{{ classes().length }} <span i18n="@@clsb.count_classes">classes</span></span>
          </p>
        }
      </header>

      @if (loadError()) {
        <p class="notice is-bad" role="alert">
          <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@clsb.load_failed">
            The lists could not be loaded, so nothing can be moved yet. Retry shortly.
          </span>
        </p>
      } @else if (loading()) {
        <!-- Shape-matched: a rail, then the two card grids that arrive. A spinner here would
             say "something is happening", not "this is what is coming". -->
        <div class="skeleton" aria-hidden="true">
          <span class="sk sk-rail"></span>
          <span class="sk sk-line"></span>
          <div class="sk-grid">
            @for (n of [1, 2, 3, 4, 5, 6]; track n) {
              <span class="sk sk-card"></span>
            }
          </div>
        </div>
      } @else if (classes().length === 0) {
        <p class="notice is-bad" role="alert">
          <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@clsb.no_classes">
            There are no classes to price these values in yet. Add one to the class list first.
          </span>
        </p>
      } @else {
        @if (unfiled().length > 0) {
          <!-- Loud on purpose, and only when it is true. A value with no live class is not
               a smaller offer — it is one the customer can pick and no bank can price. -->
          <p class="notice is-warn" role="status">
            <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
            <span>{{ unfiledLabel() }}</span>
            <button
              nz-button
              nzType="default"
              nzSize="small"
              type="button"
              (click)="showOnlyUnfiled()"
            >
              <span i18n="@@clsb.show_unfiled">Show them</span>
            </button>
          </p>
        }

        @if (inFallback().length > 0 && !onFallbackTab()) {
          <!-- Quieter than the unfiled notice, and deliberately a different tone. An unfiled
               value quotes NOTHING; a catch-all value quotes the catch-all figure, which is a
               real answer that may or may not be the intended one. Info, not warn. -->
          <p class="notice is-info" role="status">
            <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
            <span>{{ inFallbackLabel() }}</span>
            <button
              nz-button
              nzType="default"
              nzSize="small"
              type="button"
              (click)="showFallback()"
            >
              <span i18n="@@clsb.show_fallback">Show them</span>
            </button>
          </p>
        }

        <app-rail-tabs
          [items]="tabs()"
          [activeId]="activeClassKey()"
          [ariaLabel]="railAria"
          idPrefix="ccb"
          appearance="segmented"
          (select)="pickClass($event)"
        />

        <section
          class="panel"
          role="tabpanel"
          [id]="'ccb-panel-' + activeClassKey()"
          [attr.aria-labelledby]="'ccb-tab-' + activeClassKey()"
          [style.--ccb-accent]="accentFor(activeIndex())"
        >
          <header class="panel-head">
            <div class="panel-name">
              <span class="rank" aria-hidden="true">{{ activeIndex() + 1 }}</span>
              <h2 class="panel-title">{{ activeClassLabel() }}</h2>
              <span class="tier">{{ tierLabel() }}</span>
            </div>
            <p class="panel-sub">{{ filedSummary() }}</p>
          </header>

          <div class="toolbar">
            <nz-input-group [nzPrefix]="searchIcon" class="search">
              <input
                nz-input
                type="search"
                [attr.aria-label]="searchAria"
                [placeholder]="searchPlaceholder"
                [ngModel]="query()"
                (ngModelChange)="onQuery($event)"
                [ngModelOptions]="{ standalone: true }"
              />
            </nz-input-group>
            <ng-template #searchIcon>
              <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            </ng-template>
            @if (query()) {
              <span class="matches">{{ matchesLabel() }}</span>
            }
            @if (candidates().length > 1) {
              <!-- Visible and DISABLED above the cap, never hidden: a button that vanishes
                   teaches nothing, and the operator's next move (narrow the search) is only
                   obvious if the reason is on the control. -->
              <button
                nz-button
                nzType="default"
                type="button"
                class="bulk"
                [nzLoading]="bulkSaving()"
                [disabled]="bulkOverLimit()"
                [attr.aria-describedby]="bulkOverLimit() ? 'ccb-bulk-why' : null"
                (click)="moveAllListed()"
              >
                {{ moveAllLabel() }}
              </button>
              @if (bulkOverLimit()) {
                <span class="bulk-why" id="ccb-bulk-why">{{ bulkOverLimitLabel() }}</span>
              }
            }
          </div>

          <!-- FILED HERE -->
          <h3 class="group" i18n="@@clsb.group_filed">Priced in this class</h3>
          @if (filed().length === 0) {
            <p class="empty" i18n="@@clsb.filed_empty">
              Nothing is priced here yet. Move one in from the list below — a class no value reaches
              is an amount the bank states and nobody can quote.
            </p>
          } @else if (onFallbackTab()) {
            <!-- The CATCH-ALL's own tab. These cards are chips, not checkboxes: there is
                 genuinely no untick here — unticking sends a value to the catch-all and
                 these are already in it. Rendering an inert checkbox would be a dead
                 affordance to explain; removing it says the same thing in less. -->
            <p class="note is-info" i18n="@@clsb.fallback_panel">
              These have no class of their own, so a bank prices them at the
              {{ activeClassLabel() }}
              figure. Tick one on another class's tab to price it there.
            </p>
            <ul class="grid">
              @for (c of filedPage().rows; track c.id) {
                <li class="cell">
                  <span class="card is-filed is-static">
                    <span class="tick" aria-hidden="true">
                      <span nz-icon nzType="check" nzTheme="outline"></span>
                    </span>
                    <span class="name">{{ c.label }}</span>
                    @if (!c.active) {
                      <span class="tag" i18n="@@clsb.tag_off">Off</span>
                    }
                  </span>
                </li>
              }
            </ul>
          } @else {
            <ul class="grid" [class.is-stagger]="stagger()">
              @for (c of filedPage().rows; track c.id) {
                <li class="cell" [style.--i]="$index">
                  <button
                    type="button"
                    class="card is-filed"
                    [class.is-moved]="justMoved().has(c.id)"
                    role="checkbox"
                    aria-checked="true"
                    [attr.aria-busy]="saving().has(c.id)"
                    [attr.aria-label]="filedAria(c)"
                    (click)="unfileToFallback(c)"
                  >
                    <span class="tick" aria-hidden="true">
                      <span nz-icon nzType="check" nzTheme="outline"></span>
                    </span>
                    <span class="name">{{ c.label }}</span>
                    @if (!c.active) {
                      <span class="tag" i18n="@@clsb.tag_off">Off</span>
                    }
                  </button>
                </li>
              }
            </ul>
          }
          @if (filedPage().pages > 1) {
            <!-- Only past one page: a pager whose only state is "1 of 1" is chrome, not
                 navigation. -->
            <nav class="pager" [attr.aria-label]="pagerFiledAria">
              <p class="pager-range">{{ rangeLabel(filedPage()) }}</p>
              <nz-pagination
                [nzPageIndex]="filedPage().page"
                [nzPageSize]="CARD_PAGE_SIZE"
                [nzTotal]="filedPage().total"
                nzSize="small"
                (nzPageIndexChange)="setFiledPage($event)"
              />
            </nav>
          }

          <!-- EVERYWHERE ELSE -->
          <h3 class="group" i18n="@@clsb.group_elsewhere">Priced somewhere else</h3>
          @if (candidates().length === 0) {
            <p class="empty">{{ candidatesEmpty() }}</p>
          } @else {
            <ul class="grid" [class.is-stagger]="stagger()">
              @for (c of candidatePage().rows; track c.id) {
                <li class="cell" [style.--i]="$index">
                  <button
                    type="button"
                    class="card"
                    [class.is-unfiled]="wantsAttention(c)"
                    role="checkbox"
                    aria-checked="false"
                    [attr.aria-busy]="saving().has(c.id)"
                    [attr.aria-label]="candidateAria(c)"
                    (click)="move(c)"
                  >
                    <span class="tick is-empty" aria-hidden="true"></span>
                    <span class="name">{{ c.label }}</span>
                    <span class="tag" [class.is-warn]="wantsAttention(c)">{{ whereLabel(c) }}</span>
                  </button>
                </li>
              }
            </ul>
            @if (candidatePage().pages > 1) {
              <nav class="pager" [attr.aria-label]="pagerElsewhereAria">
                <p class="pager-range">{{ rangeLabel(candidatePage()) }}</p>
                <nz-pagination
                  [nzPageIndex]="candidatePage().page"
                  [nzPageSize]="CARD_PAGE_SIZE"
                  [nzTotal]="candidatePage().total"
                  nzSize="small"
                  (nzPageIndexChange)="setCandidatePage($event)"
                />
              </nav>
            }
          }

          <p class="foot" i18n="@@clsb.foot">
            A value is priced in at most one class, so ticking it here takes it out of the one it
            was in. Unticking sends it to {{ fallbackLabel() }} — it is still offered to the
            customer and still priced, at the {{ fallbackLabel() }} figure.
          </p>
        </section>
      }

      <!-- Bulk actions and single moves are both announced: a grid of cards silently
           rearranging is invisible to a screen reader. -->
      <p class="sr-only" role="status" aria-live="polite">{{ announcement() }}</p>
    </section>
  `,
  styles: [
    `
      /* EMBEDDED, NOT ROUTED. This began as a routed page of its own and
         kept that page's own measure and gutters after the extraction; its only
         consumer now renders it inside a panel on a page that already owns both.
         Nested, the paddings stacked — at 360px main(32) + product panel(32) +
         this(24) + class panel(24) left 132px of a 360px screen for the cards,
         and the 72rem cap fought the host's. The host owns the frame. */
      .page {
        display: block;
      }

      .back {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: 2.75rem;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        text-decoration: none;
      }
      .back:hover {
        color: var(--color-brand-primary);
      }
      :host-context([dir='rtl']) .back [nz-icon] {
        transform: scaleX(-1);
      }

      .head {
        margin-block-end: var(--space-5);
      }
      .eyebrow {
        margin: 0;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .title {
        margin: var(--space-1) 0 0;
        color: var(--color-text-primary);
        font-size: var(--text-3xl);
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .lede {
        margin: var(--space-2) 0 0;
        max-inline-size: 46rem;
        color: var(--color-text-secondary);
        line-height: 1.6;
      }
      .counts {
        display: flex;
        gap: var(--space-2);
        margin: var(--space-3) 0 0;
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
      }

      .notice {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-4);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .notice button {
        margin-inline-start: auto;
      }
      .notice.is-warn {
        border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
        background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface-default));
      }
      /* Info, not warn, and the difference is the message: an unfiled value quotes NOTHING,
         a catch-all value quotes the catch-all figure — a real answer that may not be the
         intended one. Two tones because they are two different asks. */
      .notice.is-info {
        border-color: color-mix(in srgb, var(--color-info) 35%, transparent);
        background: color-mix(in srgb, var(--color-info) 8%, var(--color-surface-default));
      }
      .notice.is-bad {
        border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
        background: color-mix(in srgb, var(--color-error) 8%, var(--color-surface-default));
      }
      .notice [nz-icon] {
        flex: none;
      }

      /* ── The class panel ───────────────────────────────────────────────────
         One surface, not a card inside a card: the rail sits above it and the
         two grids sit inside it, so the panel is the only container on stage. */
      .panel {
        margin-block-start: var(--space-4);
        padding: var(--space-5);
        border: 1px solid var(--color-border-default);
        /* The rank accent, strongest at the top tier. Hairline only — a filled
           header would compete with the cards it is meant to introduce. */
        border-block-start: 2px solid var(--ccb-accent);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
      }

      .panel-head {
        margin-block-end: var(--space-4);
      }
      .panel-name {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
      }
      .rank {
        display: grid;
        place-items: center;
        /* A flex item with an inline-size still shrinks; the rank read as a
           squashed oval next to a wrapping title on a phone. */
        flex: none;
        inline-size: 1.75rem;
        block-size: 1.75rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--ccb-accent) 18%, var(--color-surface-page));
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .panel-title {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-xl);
        font-weight: 600;
      }
      .tier {
        padding: var(--space-0-5) var(--space-2);
        border-radius: 999px;
        background: var(--color-surface-page);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }
      .panel-sub {
        margin: var(--space-2) 0 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
        margin-block-end: var(--space-4);
      }
      .search {
        max-inline-size: 22rem;
      }
      .matches {
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
        font-variant-numeric: tabular-nums;
      }
      .bulk {
        margin-inline-start: auto;
      }
      /* Secondary ink, not tertiary: this is read, not decoration, and tertiary sits under
         4.5:1 at this size. */
      /* The pager sits UNDER its own grid and inside the group it pages, so two of them on
         one panel never read as one control for both lists. */
      .pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
        margin: var(--space-3) 0 0;
      }
      .pager-range {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }
      .bulk-why {
        flex-basis: 100%;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
      }

      /* A card on the catch-all's own tab: the same object, with no gesture attached. It
         keeps the tick and the full text contrast — it is FILED, not disabled. The cursor
         stays default rather than not-allowed, which would read as a refusal. */
      .card.is-static {
        cursor: default;
      }
      .card.is-static:hover {
        border-color: var(--color-border-default);
        background: var(--color-surface-default);
      }

      .group {
        margin: var(--space-5) 0 var(--space-3);
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .group:first-of-type {
        margin-block-start: 0;
      }
      .empty {
        margin: 0;
        max-inline-size: 44rem;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: 1.6;
      }

      /* min() on the track floor: a bare 17rem is a HARD minimum, so inside the
         product page's panel on a 360px phone the cards were 272px wide in a 230px
         column and their trailing edge — the tick, the class tag — was cut off. */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .cell {
        display: block;
      }

      .card {
        display: flex;
        align-items: center;
        /* On a phone the tick, the name and the class tag cannot share a line
           without squeezing the name to ~80px, narrow enough to split a long value name
           across two lines. The tag drops under the name instead — it still reads
           as that card's class, and the name gets the full width back. */
        flex-wrap: wrap;
        gap: var(--space-3);
        inline-size: 100%;
        block-size: 100%;
        min-block-size: 3rem;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        text-align: start;
        cursor: pointer;
        transition:
          border-color 160ms cubic-bezier(0.4, 0, 0.2, 1),
          background-color 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .card:hover {
        border-color: color-mix(in srgb, var(--ccb-accent) 55%, var(--color-border-default));
        background: color-mix(in srgb, var(--ccb-accent) 6%, var(--color-surface-default));
      }
      .card:focus-visible {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: var(--focus-ring-offset);
      }
      .card[aria-busy='true'] {
        opacity: 0.6;
      }

      /* Already here: the accent is EARNED, so it is the filled state. It presses like any
         other card — unticking is a real action, and the hover deepens the accent rather
         than tinting toward it, so the two directions do not look like the same gesture. */
      .card.is-filed {
        border-color: color-mix(in srgb, var(--ccb-accent) 45%, transparent);
        background: color-mix(in srgb, var(--ccb-accent) 8%, var(--color-surface-default));
      }
      .card.is-filed:hover {
        border-color: color-mix(in srgb, var(--ccb-accent) 70%, transparent);
        background: color-mix(in srgb, var(--ccb-accent) 14%, var(--color-surface-default));
      }
      .card.is-unfiled {
        border-color: color-mix(in srgb, var(--color-warning) 45%, transparent);
      }

      .tick {
        display: grid;
        place-items: center;
        flex: none;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        border-radius: 999px;
        background: var(--ccb-accent);
        color: var(--color-text-on-brand);
        font-size: 0.75rem;
      }
      .tick.is-empty {
        border: 1px solid var(--color-border-default);
        background: transparent;
      }

      /* The name is the whole identity of the card — a value the operator
         cannot read is one they cannot file, so it WRAPS rather than
         ellipsing.
         break-word, NOT anywhere: 'anywhere' also drops the min-content size to a
         single character, so once the card was narrow (a phone, beside a class
         tag) flex handed the name almost nothing and it split mid-word even where
         a space was available — 'Another / compoun / d'. break-word splits an
         unbroken token only when one genuinely will not fit, which is what the
         rule above was always describing. */
      .name {
        /* The basis is what makes the card's wrap fire: below it there is no
           longer room for the name and the tag on one line. */
        flex: 1 1 7rem;
        min-inline-size: 0;
        overflow-wrap: break-word;
        line-height: 1.35;
      }
      .tag {
        flex: none;
        /* Holds the end edge on its own wrapped line too. */
        margin-inline-start: auto;
        padding: var(--space-0-5) var(--space-2);
        border-radius: 999px;
        background: var(--color-surface-page);
        /* Secondary, not tertiary: a chip darkens the ground under its own text,
           and tertiary on this tint lands under 4.5:1. */
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }
      .tag.is-warn {
        background: color-mix(in srgb, var(--color-warning) 18%, var(--color-surface-page));
        color: var(--color-text-primary);
      }

      .foot {
        margin: var(--space-5) 0 0;
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
        line-height: 1.6;
      }

      /* ── Motion ────────────────────────────────────────────────────────────
         Entry only, ease-out, 12px of travel. The stagger is capped so a long
         list does not turn into a wave the operator has to wait out. */
      .grid.is-stagger .cell {
        animation: ccb-in 220ms cubic-bezier(0.4, 0, 0.2, 1) backwards;
        animation-delay: calc(min(var(--i), 11) * 18ms);
      }
      @keyframes ccb-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
      }
      .card.is-moved {
        animation: ccb-settle 420ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes ccb-settle {
        from {
          border-color: var(--ccb-accent);
          background: color-mix(in srgb, var(--ccb-accent) 22%, var(--color-surface-default));
        }
      }

      .skeleton {
        display: grid;
        gap: var(--space-3);
        margin-block-start: var(--space-4);
      }
      .sk {
        display: block;
        border-radius: var(--radius-md);
        background: linear-gradient(
          90deg,
          var(--color-surface-page) 25%,
          color-mix(in srgb, var(--color-surface-page) 60%, var(--color-surface-default)) 37%,
          var(--color-surface-page) 63%
        );
        background-size: 400% 100%;
        animation: ccb-shimmer 1400ms ease-in-out infinite;
      }
      .sk-rail {
        block-size: 2.75rem;
      }
      .sk-line {
        block-size: 1rem;
        max-inline-size: 18rem;
      }
      .sk-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
        gap: var(--space-2);
      }
      .sk-card {
        block-size: 3rem;
      }
      @keyframes ccb-shimmer {
        from {
          background-position: 100% 0;
        }
        to {
          background-position: 0 0;
        }
      }

      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .grid.is-stagger .cell,
        .card.is-moved,
        .sk {
          animation: none;
        }
        .card {
          transition: none;
        }
      }
    `,
  ],
})
export class ParentClassBoardComponent {
  private readonly api = inject(LookupsApiService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /**
   * The type filed under a class, and the class list itself. Both registry types.
   *
   * REQUIRED, with no defaults. They used to default to the value pair, which was the only
   * axis that existed — and that default outlived it: the value demo is retired, every axis
   * is now one a PRODUCT authored, and a board silently fetching `value` would render an
   * empty screen with no clue why.
   *
   * THE COPY IS GENERIC, and that is a change of position from the previous draft. It used to
   * named compounds throughout, on the argument that Arabic plural, verb agreement and pronoun
   * suffix all agree with a specific noun and substituting one produces text that is wrong for
   * most nouns — which is true, and is exactly why the strings do not substitute a noun at all.
   * They say "value" / "عنصر", which agrees with itself in both languages whatever list is on
   * screen. What identifies the list is the panel it sits under and the class names on its own
   * rail, both of which carry the operator's own words.
   */
  readonly childType = input.required<string>();
  readonly parentType = input.required<string>();
  /**
   * Where an untick sends a value, by class key. `null` = derive it.
   *
   * An input rather than a constant because the answer lives on the KIND
   * (`enumeration_type_def.fallbackParentKey`) and the host is what reads the registry. When
   * it is not supplied the board derives one, so a list authored before the column existed
   * still behaves — see `fallbackKey`.
   */
  readonly fallbackParentKey = input<string | null>(null);

  /**
   * Raised after any move that changed a row.
   *
   * The board cannot know what else on the host depends on these values — a product page
   * renders the child list in a sibling panel that holds its own fetched copy — so it
   * reports rather than guesses. Without it, re-filing a value left the list above it
   * showing the old class badge until a manual reload: the exact "it did not work" reading
   * the server-side cache invalidation was widened to avoid.
   */
  readonly changed = output<void>();

  /**
   * What on this board needs a human, reported to the host on every load and after every
   * move: values with no live class (they quote NOTHING) and values sitting in the catch-all
   * (they quote the catch-all's figure, which may or may not be the intended one).
   *
   * It exists because a host may legitimately keep the board FOLDED — the product page does,
   * since the board is a second full-length view of the list directly above it — and a
   * warning only visible once you open the thing that carries it is a warning nobody reads.
   * The board keeps drawing its own notices; this is the same facts, for a closed summary.
   */
  readonly attention = output<BoardAttention>();

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly classRows = signal<readonly EnumerationRow[]>([]);
  protected readonly valueRows = signal<readonly EnumerationRow[]>([]);
  protected readonly query = signal('');

  /**
   * What the two lists are FILTERED by — the search box, 200ms behind.
   *
   * The box itself stays bound to `query`, so typing is instant. What is debounced is the
   * work: on a several-hundred-value board one keystroke re-filters, re-sorts and hands every
   * `@for` a fresh array identity, so up to five hundred cards re-diff per character.
   *
   * Through `toObservable`/`toSignal` rather than a `BehaviorSubject`, so state is a signal at
   * both ends (Principle XVIII / A11). `toSignal` was already imported in this file.
   */
  private readonly appliedQuery = toSignal(
    toObservable(this.query).pipe(debounceTime(SEARCH_DEBOUNCE_MS)),
    { initialValue: '' },
  );
  protected readonly saving = signal<ReadonlySet<string>>(new Set());
  protected readonly bulkSaving = signal(false);
  protected readonly justMoved = signal<ReadonlySet<string>>(new Set());
  protected readonly announcement = signal('');
  /** Off for the first paint after a move, so the moved card settles instead of re-entering. */
  protected readonly stagger = signal(true);

  protected readonly railAria = $localize`:@@clsb.rail_aria:Classes`;
  protected readonly searchAria = $localize`:@@clsb.search_aria:Search values by name`;
  protected readonly searchPlaceholder = $localize`:@@clsb.search:Search values`;
  protected readonly pagerFiledAria = $localize`:@@clsb.pager_filed:Pages of values priced in this class`;
  protected readonly pagerElsewhereAria = $localize`:@@clsb.pager_elsewhere:Pages of values priced somewhere else`;

  /** `?class=` — so a pasted link and a reload both land on the class being worked on. */
  private readonly classParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('class'))),
    { initialValue: null },
  );

  constructor() {
    // An EFFECT, not a bare call: signal inputs are not set at construction time, so
    // reading `childType()`/`parentType()` in the constructor returns their DEFAULTS and
    // silently ignores whatever the host bound — which, while the inputs still had compound
    // defaults, meant a product reading any other parented list rendered somebody else's
    // values and filed them into somebody else's classes.
    //
    // `allowSignalWrites` because `load` sets `loading` synchronously before its first
    // await — reacting to an input change by writing state is what this effect is for.
    effect(
      () => {
        const pair = `${this.childType()}\u0000${this.parentType()}`;
        void pair;
        void this.reload();
      },
      { allowSignalWrites: true },
    );

    // Reports what it can SEE. While loading or after a failure it says nothing rather than
    // zero — "no values need attention" and "we do not know yet" must not render the same.
    effect(() => {
      if (this.loading() || this.loadError()) return;
      this.attention.emit({
        unfiled: this.unfiled().length,
        inFallback: this.inFallback().length,
      });
    });
  }

  // ── data ───────────────────────────────────────────────────────────────────

  /**
   * Re-read classes and values.
   *
   * PUBLIC, because the board is not the only thing on a product's screen reading this list:
   * the values panel directly above it adds and retires the very rows this board files, and
   * neither can see the other's write. The host wires both directions on `changed`.
   *
   * `silent` keeps the rows on screen while re-reading — a host-driven refresh after somebody
   * else's write must not blank a board the operator is working in.
   */
  async reload(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loading.set(true);
    this.loadError.set(false);
    try {
      const [classes, values] = await Promise.all([
        this.api.list(this.parentType()),
        this.api.list(this.childType()),
      ]);
      this.classRows.set(classes);
      this.valueRows.set(values);
    } catch {
      // Rendered as a stated failure rather than as an empty board: "no values" and
      // "we could not read the values" are different facts with the same shape.
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * The classes a value may be filed under: ACTIVE only.
   *
   * A retired class is not a target — the server refuses it — and offering it would be
   * offering a save that quotes nothing. It also cannot hold children any more: retiring a
   * class with values in it is refused server-side for exactly that reason.
   */
  protected readonly classes = computed<readonly EnumerationRow[]>(() =>
    this.classRows()
      .filter((row) => row.active && row.deprecatedAt === null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)),
  );

  private readonly liveClassKeys = computed(() => new Set(this.classes().map((c) => c.key)));

  /** Every value, including deactivated ones — a value that is off still needs a class. */
  protected readonly boardValues = computed<readonly BoardValue[]>(() =>
    this.valueRows()
      .map((row) => ({
        id: row.id,
        key: row.key,
        label: this.isAr ? row.labelAr : row.labelEn,
        parentKey: row.parentKey,
        active: row.active,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  protected readonly activeClassKey = computed(() => {
    const requested = this.classParam();
    const live = this.classes();
    if (requested && live.some((c) => c.key === requested)) return requested;
    return live[0]?.key ?? '';
  });

  protected readonly activeIndex = computed(() =>
    Math.max(
      0,
      this.classes().findIndex((c) => c.key === this.activeClassKey()),
    ),
  );

  protected readonly activeClassLabel = computed(() => {
    const row = this.classes()[this.activeIndex()];
    return row ? (this.isAr ? row.labelAr : row.labelEn) : '';
  });

  /** One pass over the values, not one filter per class. Six classes × 500 values was 3 000. */
  private readonly countByClass = computed(() => {
    const counts = new Map<string, number>();
    for (const value of this.boardValues()) {
      if (value.parentKey === null) continue;
      counts.set(value.parentKey, (counts.get(value.parentKey) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly tabs = computed<readonly RailTabItem[]>(() =>
    this.classes().map((row) => ({
      id: row.key,
      label: this.isAr ? row.labelAr : row.labelEn,
      note: this.countNote(this.countByClass().get(row.key) ?? 0),
    })),
  );

  // ── the two lists ──────────────────────────────────────────────────────────

  private readonly matching = computed<readonly BoardValue[]>(() => {
    const needle = this.appliedQuery().trim().toLowerCase();
    if (needle === '') return this.boardValues();
    return this.boardValues().filter(
      (c) => c.label.toLowerCase().includes(needle) || c.key.toLowerCase().includes(needle),
    );
  });

  protected readonly filed = computed(() =>
    this.matching().filter((c) => c.parentKey === this.activeClassKey()),
  );

  /**
   * The values NOT priced here — with the unfiled ones first.
   *
   * Unfiled first because they are the only rows on this screen that are actually broken:
   * every other value is priced correctly somewhere, and these are priced nowhere.
   */
  protected readonly candidates = computed(() => {
    const active = this.activeClassKey();
    const rest = this.matching().filter((c) => c.parentKey !== active);
    return [...rest].sort((a, b) => {
      const ua = this.isUnfiled(a) ? 0 : 1;
      const ub = this.isUnfiled(b) ? 0 : 1;
      return ua - ub || a.label.localeCompare(b.label);
    });
  });

  /**
   * The page each group is on, and the page each group RENDERS.
   *
   * Two indexes, because the two groups are read for different reasons and page apart: an
   * operator checking what is priced here does not want the candidate list to jump.
   *
   * The requested index is a plain signal reset by the two things that change what is in the
   * list — picking a class and typing in the search box — and both are event handlers, never
   * an `effect`, because a signal written from an effect is the NG0600 this file's sibling
   * shipped (v22.1.0). Everything else that moves the list (a move, a bulk move, a reload)
   * needs no reset at all: `pageSlice` clamps, so the operator lands on the last page that
   * exists rather than on an empty grid.
   *
   * `moveAllListed` still acts on the full `candidates()` set, not on the page: the button
   * names the real number, and paging the ACTION would make "move all listed" quietly mean
   * "move the twenty-four on screen".
   */
  private readonly filedPageRequest = signal(1);
  private readonly candidatePageRequest = signal(1);

  protected readonly filedPage = computed(() =>
    pageSlice<BoardValue>(this.filed(), this.filedPageRequest(), CARD_PAGE_SIZE),
  );
  protected readonly candidatePage = computed(() =>
    pageSlice<BoardValue>(this.candidates(), this.candidatePageRequest(), CARD_PAGE_SIZE),
  );

  protected readonly CARD_PAGE_SIZE = CARD_PAGE_SIZE;

  protected setFiledPage(page: number): void {
    // Paging is not a move: the stagger would re-animate every card on arrival.
    this.stagger.set(false);
    this.filedPageRequest.set(page);
  }

  protected setCandidatePage(page: number): void {
    this.stagger.set(false);
    this.candidatePageRequest.set(page);
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.filedPageRequest.set(1);
    this.candidatePageRequest.set(1);
  }

  /** The range, in TS so both pagers share ONE message instead of two ids saying the same. */
  protected rangeLabel(page: ValuePage<BoardValue>): string {
    return $localize`:@@clsb.page_range:Showing ${page.from}:FROM:–${page.to}:TO: of ${page.total}:TOTAL:`;
  }

  /**
   * The catch-all class — where an untick lands.
   *
   * The input wins. Failing that, two derivations, first match wins, and BOTH are stated
   * because a convention nobody can see is one that breaks silently:
   *   1. an active class whose key slugs to `other`
   *   2. failing that, the LAST class in registry order
   *
   * `null` only when there are no classes at all, and the tick then goes inert rather than
   * writing a value into nowhere.
   *
   * Nothing on screen relies on this being invisible: every string that depends on it names
   * the class by its LABEL, so an operator can see where a card went.
   */
  protected readonly fallbackKey = computed<string | null>(() => {
    const declared = this.fallbackParentKey();
    if (declared !== null && declared !== '') return declared;
    const all = this.classes();
    if (all.length === 0) return null;
    const named = all.find((c) => c.active && slugify(c.key).endsWith('other'));
    if (named) return named.key;
    return all[all.length - 1]?.key ?? null;
  });

  /** Above the server's per-request cap, so "move all" would be refused before it started. */
  protected readonly bulkOverLimit = computed(
    () => this.candidates().length > PARENT_KEYS_BULK_MAX,
  );

  protected bulkOverLimitLabel(): string {
    return $localize`:@@clsb.bulk_over_limit:Too many at once. Narrow the search to ${PARENT_KEYS_BULK_MAX}:MAX: or fewer.`;
  }

  protected inFallbackLabel(): string {
    const count = this.inFallback().length;
    const cls = this.fallbackLabel();
    return count === 1
      ? $localize`:@@clsb.in_fallback_one:1 value is in ${cls}:CLASS:, the catch-all. Check that is intended.`
      : $localize`:@@clsb.in_fallback_many:${count}:COUNT: values are in ${cls}:CLASS:, the catch-all. Check that is intended.`;
  }

  protected showFallback(): void {
    const key = this.fallbackKey();
    if (key !== null) this.pickClass(key);
  }

  /**
   * A card worth an amber tag: unfiled (quotes nothing) OR in the catch-all (quotes the
   * catch-all figure, which may not be the intended one). Two different problems, one
   * "look at this" — the tag itself names which, so nothing rides on the colour.
   */
  protected wantsAttention(value: BoardValue): boolean {
    return this.isUnfiled(value) || value.parentKey === this.fallbackKey();
  }

  protected readonly fallbackLabel = computed(() => {
    const key = this.fallbackKey();
    return this.classes().find((c) => c.key === key)?.labelEn ?? '';
  });

  /** Whether the class currently on stage IS the catch-all. Changes what its cards can do. */
  protected readonly onFallbackTab = computed(
    () => this.fallbackKey() !== null && this.activeClassKey() === this.fallbackKey(),
  );

  /** Values sitting in the catch-all — a quieter warning than an unfiled one, but a warning. */
  protected readonly inFallback = computed(() => {
    const key = this.fallbackKey();
    return key === null ? [] : this.boardValues().filter((c) => c.parentKey === key);
  });

  protected readonly unfiled = computed(() => this.boardValues().filter((c) => this.isUnfiled(c)));

  protected isUnfiled(value: BoardValue): boolean {
    return value.parentKey === null || !this.liveClassKeys().has(value.parentKey);
  }

  // ── labels ─────────────────────────────────────────────────────────────────

  private countNote(count: number): string {
    return count === 1
      ? $localize`:@@clsb.note_one:1 value`
      : $localize`:@@clsb.note_many:${count}:COUNT: values`;
  }

  protected readonly tierLabel = computed(() => {
    const total = this.classes().length;
    const index = this.activeIndex();
    if (total < 2) return $localize`:@@clsb.tier_only:The only class`;
    if (index === 0) return $localize`:@@clsb.tier_top:Highest tier`;
    if (index === total - 1) return $localize`:@@clsb.tier_low:Lowest tier`;
    return $localize`:@@clsb.tier_mid:Middle tier`;
  });

  protected readonly filedSummary = computed(() => {
    const count = this.boardValues().filter((c) => c.parentKey === this.activeClassKey()).length;
    const total = this.boardValues().length;
    return $localize`:@@clsb.filed_summary:${count}:COUNT: of ${total}:TOTAL: values are priced in this class.`;
  });

  protected readonly matchesLabel = computed(() => {
    const shown = this.matching().length;
    const total = this.boardValues().length;
    return $localize`:@@clsb.matches:${shown}:SHOWN: of ${total}:TOTAL:`;
  });

  protected readonly moveAllLabel = computed(() => {
    const count = this.candidates().length;
    return $localize`:@@clsb.move_all:Move all ${count}:COUNT: here`;
  });

  protected readonly unfiledLabel = computed(() => {
    const count = this.unfiled().length;
    return count === 1
      ? $localize`:@@clsb.unfiled_one:1 value has no class, so no bank can price it.`
      : $localize`:@@clsb.unfiled_many:${count}:COUNT: values have no class, so no bank can price them.`;
  });

  protected readonly candidatesEmpty = computed(() =>
    this.query()
      ? $localize`:@@clsb.candidates_empty_search:Every value matching your search is already priced in this class.`
      : $localize`:@@clsb.candidates_empty:Every value is priced in this class. Nothing left to move.`,
  );

  /** Which class a candidate would LEAVE — the half a plain checkbox cannot say. */
  protected whereLabel(value: BoardValue): string {
    if (this.isUnfiled(value)) return $localize`:@@clsb.where_none:No class`;
    const row = this.classes().find((c) => c.key === value.parentKey);
    return row ? (this.isAr ? row.labelAr : row.labelEn) : (value.parentKey ?? '');
  }

  protected filedAria(value: BoardValue): string {
    // Names the consequence, not just the action: with no H1 in view a screen-reader user has
    // only this string to tell "untick" from "delete", and the two are a class apart.
    // Names the CONSEQUENCE, not the gesture: a screen reader has no H1 in view here, and
    // "untick" and "re-price at the catch-all figure" are the same click.
    return $localize`:@@clsb.aria_filed:Move ${value.label}:NAME: out of ${this.activeClassLabel()}:CLASS: and into ${this.fallbackLabel()}:FALLBACK:. Any bank pricing off the class will then quote it the ${this.fallbackLabel()}:FALLBACK2: figure.`;
  }

  protected candidateAria(value: BoardValue): string {
    return $localize`:@@clsb.aria_move:Move ${value.label}:NAME: from ${this.whereLabel(value)}:FROM: to ${this.activeClassLabel()}:TO:`;
  }

  /**
   * The rank accent: full strength at the top tier, quieter down the scale.
   *
   * `color-mix` toward the page ground rather than a second hue, so three classes read as one
   * scale instead of three unrelated identities — and so adding a fourth class needs no new
   * token, no new colour decision and no edit here.
   */
  protected accentFor(index: number): string {
    const total = Math.max(1, this.classes().length);
    const strength = Math.round(100 - (index / total) * 45);
    return `color-mix(in srgb, var(--color-brand-primary) ${strength}%, var(--color-text-tertiary))`;
  }

  // ── actions ────────────────────────────────────────────────────────────────

  protected pickClass(key: string): void {
    this.stagger.set(true);
    this.filedPageRequest.set(1);
    this.candidatePageRequest.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { class: key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected showOnlyUnfiled(): void {
    // Not a filter chip: the unfiled set has no shared name to search for. Clearing the query
    // and letting the unfiled-first ordering do the work is the honest version of "show them".
    this.onQuery('');
    this.announcement.set(this.unfiledLabel());
  }

  /**
   * Move one value into the active class — optimistically, then confirmed.
   *
   * Optimistic because the operator's next action is usually the next card, and a spinner
   * between every tick makes a nine-card re-tiering feel like nine round trips. Rolled back on
   * failure, with the interceptor's toast carrying the reason.
   */
  protected async move(value: BoardValue): Promise<void> {
    const target = this.activeClassKey();
    if (target === '' || value.parentKey === target) return;
    const previous = value.parentKey;

    this.stagger.set(false);
    this.setSaving(value.id, true);
    this.applyLocal(value.id, target);
    try {
      await this.api.setParentKeysBulk([{ id: value.id, parentKey: target }]);
      this.flashMoved(value.id);
      this.changed.emit();
      this.announcement.set(
        $localize`:@@clsb.moved_one:${value.label}:NAME: is now priced in ${this.activeClassLabel()}:CLASS:.`,
      );
    } catch {
      this.applyLocal(value.id, previous);
    } finally {
      this.setSaving(value.id, false);
    }
  }

  /**
   * Take one value OUT of the active class, leaving it in none.
   *
   * The mirror of `move`, deliberately down to the rollback: same optimistic write, same
   * per-card `saving` flag, same live-region announcement. What differs is only the target —
   * `null`, which the bulk endpoint accepts from this screen and from nowhere else.
   *
   * No confirmation step. The action is one click to undo (tick it again), and the panel's own
   * warn notice fires the moment the count goes above zero, naming what it costs — which is a
   * louder and more useful signal than a modal the operator dismisses on the way through.
   */
  protected async unfileToFallback(value: BoardValue): Promise<void> {
    const previous = value.parentKey;
    const target = this.fallbackKey();
    // On the catch-all's own tab there is genuinely nowhere to go, which is why those cards
    // are rendered as plain chips rather than as a checkbox that does nothing.
    if (previous === null || target === null || previous === target) return;

    this.stagger.set(false);
    this.setSaving(value.id, true);
    this.applyLocal(value.id, target);
    try {
      // `null` on the wire, not the key: the SERVER owns where an unfile lands
      // (`resolveParentKey` reads the kind's declared `fallbackParentKey`), and sending the
      // key from here would make the client a second authority on a pricing decision. The
      // optimistic write above is a PREDICTION of the server's answer, corrected by the
      // reload the host runs on `changed`.
      await this.api.setParentKeysBulk([{ id: value.id, parentKey: null }]);
      this.flashMoved(value.id);
      this.changed.emit();
      this.announcement.set(
        $localize`:@@clsb.removed_one:${value.label}:NAME: is now in ${this.fallbackLabel()}:CLASS: — the catch-all.`,
      );
    } catch {
      this.applyLocal(value.id, previous);
    } finally {
      this.setSaving(value.id, false);
    }
  }

  /**
   * Move everything currently LISTED — the visible set, not the whole registry.
   *
   * Scoped to what the search shows on purpose: a bulk action whose reach is wider than the
   * screen is a bulk action nobody can check before pressing.
   */
  protected async moveAllListed(): Promise<void> {
    const target = this.activeClassKey();
    const moving = this.candidates();
    if (target === '' || moving.length === 0) return;
    // Refuse, do not chunk. Chunking splits ONE bulk move into two transactions — exactly the
    // half-applied state the endpoint's own doc says it exists to prevent. The button states
    // the reason rather than vanishing; see `bulkOverLimit`.
    if (moving.length > PARENT_KEYS_BULK_MAX) return;

    // Moving everything into the CATCH-ALL is the one destructive direction: every bank
    // pricing off the class then quotes all of them the same figure. Confirmed through
    // `NzModalService` so the scrim covers the viewport (A34) rather than being trapped
    // inside `section.page`'s own containing block.
    if (this.onFallbackTab()) {
      const ok = await new Promise<boolean>((resolve) => {
        this.modal.confirm({
          nzTitle: $localize`:@@clsb.bulk_fallback_title:Move ${moving.length}:COUNT: values into ${this.activeClassLabel()}:CLASS:?`,
          nzContent: $localize`:@@clsb.bulk_fallback_body:${this.activeClassLabel()}:CLASS: is the catch-all. Every bank pricing off the class will quote all of them the same figure.`,
          nzOkText: $localize`:@@clsb.bulk_fallback_ok:Move them`,
          nzOnOk: () => resolve(true),
          nzOnCancel: () => resolve(false),
        });
      });
      if (!ok) return;
    }

    const before = new Map(moving.map((c) => [c.id, c.parentKey]));
    this.stagger.set(false);
    this.bulkSaving.set(true);
    for (const c of moving) this.applyLocal(c.id, target);
    try {
      const { moved } = await this.api.setParentKeysBulk(
        moving.map((c) => ({ id: c.id, parentKey: target })),
      );
      for (const c of moving) this.flashMoved(c.id);
      this.changed.emit();
      this.announcement.set(
        $localize`:@@clsb.moved_many:${moved}:COUNT: values are now priced in ${this.activeClassLabel()}:CLASS:.`,
      );
    } catch {
      for (const [id, parentKey] of before) this.applyLocal(id, parentKey ?? null);
    } finally {
      this.bulkSaving.set(false);
    }
  }

  private applyLocal(id: string, parentKey: string | null): void {
    this.valueRows.set(
      this.valueRows().map((row) => (row.id === id ? { ...row, parentKey } : row)),
    );
  }

  private setSaving(id: string, on: boolean): void {
    const next = new Set(this.saving());
    if (on) next.add(id);
    else next.delete(id);
    this.saving.set(next);
  }

  /** Marks a card for the settle animation, then lets it go so a re-render is clean. */
  private flashMoved(id: string): void {
    const next = new Set(this.justMoved());
    next.add(id);
    this.justMoved.set(next);
    setTimeout(() => {
      const after = new Set(this.justMoved());
      after.delete(id);
      this.justMoved.set(after);
    }, 500);
  }
}
