import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  ArrowLeftOutline,
  CheckOutline,
  ExclamationCircleOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { RailTabsComponent, type RailTabItem } from '@shared/ui';
import { LookupsApiService } from './lookups.api.service';
import type { EnumerationRow } from './lookups.api.service';

/** A compound as this board renders it: the row, plus where it sits right now. */
interface BoardCompound {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly parentKey: string | null;
  readonly active: boolean;
}

/**
 * Where each compound is priced — the class board.
 *
 * ─── The problem it exists to solve ───────────────────────────────────────────
 *
 * A bank keys its compound cap table by CLASS (three rows) while the customer picks a
 * compound by NAME (hundreds), and `factParentTable` walks one to the other through the
 * compound's `parentKey`. So the single most consequential thing an operator does to this
 * product is decide which tier a compound is priced in — and until this screen, the only way
 * to do it was to open one compound at a time in the shared value dialog and pick from a
 * dropdown labelled "Filed under". Re-tiering nine compounds was nine dialogs, and there was
 * nowhere to see the tiers as a set at all.
 *
 * This board inverts it: pick a class, see every compound at once, split into the ones priced
 * here and the ones priced elsewhere, and move as many as you like in one action.
 *
 * ─── What a tick means, and what unticking costs ──────────────────────────────
 *
 * A compound's class is a SINGLE parent, so the count is at most one: ticking a candidate MOVES
 * it here from wherever it was — never adds a second class — and unticking takes it out of this
 * one without putting it in another. A candidate card therefore names the class it would LEAVE.
 *
 * Unticking is a real and costly answer, not an undo. An unfiled compound is still offered to
 * the customer, and `factParentTable` then answers `no_matching_row` — which is NOT a skippable
 * reason, so the rule stops and every bank keying its cap table by the class quotes that
 * applicant nothing. That is why it can only be said through this screen and through the one
 * endpoint built for moves: create refuses it, and a label-only patch cannot reach it.
 *
 * The board already had the vocabulary for the state before it could produce it — a `No class`
 * warn tag, unfiled-first ordering, and a notice counting them at the top of the panel. Those
 * are the feedback for this action, along with `npm run check:collateral`, whose registry
 * invariant fails while any compound is not under a live class.
 *
 * ─── The rank tint ────────────────────────────────────────────────────────────
 *
 * Money is deliberately absent. What a class pays is per BANK — EG Bank's Class A is
 * 6 000 000 and another bank's need not be — so a figure here would be a lie the moment a
 * second bank configures the product. What the board CAN say honestly is the ORDER, which is
 * the registry's own `sortOrder`: the accent strength descends with rank, and the active class
 * says its position in words. A scale you can see beats a number that is only sometimes true.
 */
@Component({
  selector: 'app-compound-class-board',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    RailTabsComponent,
  ],
  providers: [
    provideNzIconsPatch([ArrowLeftOutline, CheckOutline, ExclamationCircleOutline, SearchOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <a class="back" routerLink="/lookups" [queryParams]="{ type: 'compound' }">
        <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@ccb.back">All values</span>
      </a>

      <header class="head">
        <p class="eyebrow" i18n="@@ccb.eyebrow">Manage values</p>
        <h1 class="title" i18n="@@ccb.title">Where each compound is priced</h1>
        <p class="lede" i18n="@@ccb.lede">
          A bank states one amount per class. A customer picks a compound by name. This is where the
          two meet — so a compound in the wrong class is priced at the wrong ceiling.
        </p>
        @if (!loading()) {
          <p class="counts">
            <span
              >{{ compounds().length }} <span i18n="@@ccb.count_compounds">compounds</span></span
            >
            <span class="dot" aria-hidden="true">·</span>
            <span>{{ classes().length }} <span i18n="@@ccb.count_classes">classes</span></span>
          </p>
        }
      </header>

      @if (loadError()) {
        <p class="notice is-bad" role="alert">
          <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@ccb.load_failed">
            The compound lists could not be loaded, so nothing can be moved yet. Retry shortly.
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
          <span i18n="@@ccb.no_classes">
            There are no classes to price compounds in yet. Add one under Compound classes first.
          </span>
        </p>
      } @else {
        @if (unfiled().length > 0) {
          <!-- Loud on purpose, and only when it is true. A compound with no live class is not
               a smaller offer — it is a compound the customer can pick and no bank can price. -->
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
              <span i18n="@@ccb.show_unfiled">Show them</span>
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
                (ngModelChange)="query.set($event)"
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
              <button
                nz-button
                nzType="default"
                type="button"
                class="bulk"
                [nzLoading]="bulkSaving()"
                (click)="moveAllListed()"
              >
                {{ moveAllLabel() }}
              </button>
            }
          </div>

          <!-- FILED HERE -->
          <h3 class="group" i18n="@@ccb.group_filed">Priced in this class</h3>
          @if (filed().length === 0) {
            <p class="empty" i18n="@@ccb.filed_empty">
              Nothing is priced here yet. Move a compound in from the list below — a class no
              compound reaches is an amount the bank states and nobody can quote.
            </p>
          } @else {
            <ul class="grid" [class.is-stagger]="stagger()">
              @for (c of filed(); track c.id) {
                <li class="cell" [style.--i]="$index">
                  <button
                    type="button"
                    class="card is-filed"
                    [class.is-moved]="justMoved().has(c.id)"
                    role="checkbox"
                    aria-checked="true"
                    [attr.aria-busy]="saving().has(c.id)"
                    [attr.aria-label]="filedAria(c)"
                    (click)="unfile(c)"
                  >
                    <span class="tick" aria-hidden="true">
                      <span nz-icon nzType="check" nzTheme="outline"></span>
                    </span>
                    <span class="name">{{ c.label }}</span>
                    @if (!c.active) {
                      <span class="tag" i18n="@@ccb.tag_off">Off</span>
                    }
                  </button>
                </li>
              }
            </ul>
          }

          <!-- EVERYWHERE ELSE -->
          <h3 class="group" i18n="@@ccb.group_elsewhere">Priced somewhere else</h3>
          @if (candidates().length === 0) {
            <p class="empty">{{ candidatesEmpty() }}</p>
          } @else {
            <ul class="grid" [class.is-stagger]="stagger()">
              @for (c of candidates(); track c.id) {
                <li class="cell" [style.--i]="$index">
                  <button
                    type="button"
                    class="card"
                    [class.is-unfiled]="isUnfiled(c)"
                    role="checkbox"
                    aria-checked="false"
                    [attr.aria-busy]="saving().has(c.id)"
                    [attr.aria-label]="candidateAria(c)"
                    (click)="move(c)"
                  >
                    <span class="tick is-empty" aria-hidden="true"></span>
                    <span class="name">{{ c.label }}</span>
                    <span class="tag" [class.is-warn]="isUnfiled(c)">{{ whereLabel(c) }}</span>
                  </button>
                </li>
              }
            </ul>
          }

          <p class="foot" i18n="@@ccb.foot">
            A compound is priced in at most one class, so ticking it here takes it out of the one it
            was in. Unticking leaves it in no class at all — it is still offered to the customer,
            and any bank pricing off the class can then quote it nothing.
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
      .page {
        display: block;
        max-inline-size: 72rem;
        margin-inline: auto;
        padding: var(--space-6) var(--space-5) var(--space-8);
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
        gap: var(--space-3);
      }
      .rank {
        display: grid;
        place-items: center;
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

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
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

      /* The name is the whole identity of the card — a compound the operator
         cannot read is a compound they cannot file, so it WRAPS rather than
         ellipsing. The anywhere value only ever splits a single unbroken token. */
      .name {
        flex: 1 1 auto;
        min-inline-size: 0;
        overflow-wrap: anywhere;
        line-height: 1.35;
      }
      .tag {
        flex: none;
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
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
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
export class CompoundClassBoardPage {
  private readonly api = inject(LookupsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /** The type filed under a class, and the class list itself. Both registry types. */
  private static readonly CHILD_TYPE = 'compound';
  private static readonly PARENT_TYPE = 'compound_category';

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly classRows = signal<readonly EnumerationRow[]>([]);
  protected readonly compoundRows = signal<readonly EnumerationRow[]>([]);
  protected readonly query = signal('');
  protected readonly saving = signal<ReadonlySet<string>>(new Set());
  protected readonly bulkSaving = signal(false);
  protected readonly justMoved = signal<ReadonlySet<string>>(new Set());
  protected readonly announcement = signal('');
  /** Off for the first paint after a move, so the moved card settles instead of re-entering. */
  protected readonly stagger = signal(true);

  protected readonly railAria = $localize`:@@ccb.rail_aria:Compound classes`;
  protected readonly searchAria = $localize`:@@ccb.search_aria:Search compounds by name`;
  protected readonly searchPlaceholder = $localize`:@@ccb.search:Search compounds`;

  /** `?class=` — so a pasted link and a reload both land on the class being worked on. */
  private readonly classParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('class'))),
    { initialValue: null },
  );

  constructor() {
    void this.load();
  }

  // ── data ───────────────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [classes, compounds] = await Promise.all([
        this.api.list(CompoundClassBoardPage.PARENT_TYPE),
        this.api.list(CompoundClassBoardPage.CHILD_TYPE),
      ]);
      this.classRows.set(classes);
      this.compoundRows.set(compounds);
    } catch {
      // Rendered as a stated failure rather than as an empty board: "no compounds" and
      // "we could not read the compounds" are different facts with the same shape.
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * The classes a compound may be filed under: ACTIVE only.
   *
   * A retired class is not a target — the server refuses it — and offering it would be
   * offering a save that quotes nothing. It also cannot hold children any more: retiring a
   * class with compounds in it is refused server-side for exactly that reason.
   */
  protected readonly classes = computed<readonly EnumerationRow[]>(() =>
    this.classRows()
      .filter((row) => row.active && row.deprecatedAt === null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)),
  );

  private readonly liveClassKeys = computed(() => new Set(this.classes().map((c) => c.key)));

  /** Every compound, including deactivated ones — a compound that is off still needs a class. */
  protected readonly compounds = computed<readonly BoardCompound[]>(() =>
    this.compoundRows()
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

  protected readonly tabs = computed<readonly RailTabItem[]>(() =>
    this.classes().map((row) => ({
      id: row.key,
      label: this.isAr ? row.labelAr : row.labelEn,
      note: this.countNote(this.compounds().filter((c) => c.parentKey === row.key).length),
    })),
  );

  // ── the two lists ──────────────────────────────────────────────────────────

  private readonly matching = computed<readonly BoardCompound[]>(() => {
    const needle = this.query().trim().toLowerCase();
    if (needle === '') return this.compounds();
    return this.compounds().filter(
      (c) => c.label.toLowerCase().includes(needle) || c.key.toLowerCase().includes(needle),
    );
  });

  protected readonly filed = computed(() =>
    this.matching().filter((c) => c.parentKey === this.activeClassKey()),
  );

  /**
   * The compounds NOT priced here — with the unfiled ones first.
   *
   * Unfiled first because they are the only rows on this screen that are actually broken:
   * every other compound is priced correctly somewhere, and these are priced nowhere.
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

  protected readonly unfiled = computed(() => this.compounds().filter((c) => this.isUnfiled(c)));

  protected isUnfiled(compound: BoardCompound): boolean {
    return compound.parentKey === null || !this.liveClassKeys().has(compound.parentKey);
  }

  // ── labels ─────────────────────────────────────────────────────────────────

  private countNote(count: number): string {
    return count === 1
      ? $localize`:@@ccb.note_one:1 compound`
      : $localize`:@@ccb.note_many:${count}:COUNT: compounds`;
  }

  protected readonly tierLabel = computed(() => {
    const total = this.classes().length;
    const index = this.activeIndex();
    if (total < 2) return $localize`:@@ccb.tier_only:The only class`;
    if (index === 0) return $localize`:@@ccb.tier_top:Highest tier`;
    if (index === total - 1) return $localize`:@@ccb.tier_low:Lowest tier`;
    return $localize`:@@ccb.tier_mid:Middle tier`;
  });

  protected readonly filedSummary = computed(() => {
    const count = this.compounds().filter((c) => c.parentKey === this.activeClassKey()).length;
    const total = this.compounds().length;
    return $localize`:@@ccb.filed_summary:${count}:COUNT: of ${total}:TOTAL: compounds are priced in this class.`;
  });

  protected readonly matchesLabel = computed(() => {
    const shown = this.matching().length;
    const total = this.compounds().length;
    return $localize`:@@ccb.matches:${shown}:SHOWN: of ${total}:TOTAL:`;
  });

  protected readonly moveAllLabel = computed(() => {
    const count = this.candidates().length;
    return $localize`:@@ccb.move_all:Move all ${count}:COUNT: here`;
  });

  protected readonly unfiledLabel = computed(() => {
    const count = this.unfiled().length;
    return count === 1
      ? $localize`:@@ccb.unfiled_one:1 compound has no class, so no bank can price it.`
      : $localize`:@@ccb.unfiled_many:${count}:COUNT: compounds have no class, so no bank can price them.`;
  });

  protected readonly candidatesEmpty = computed(() =>
    this.query()
      ? $localize`:@@ccb.candidates_empty_search:Every compound matching your search is already priced in this class.`
      : $localize`:@@ccb.candidates_empty:Every compound is priced in this class. Nothing left to move.`,
  );

  /** Which class a candidate would LEAVE — the half a plain checkbox cannot say. */
  protected whereLabel(compound: BoardCompound): string {
    if (this.isUnfiled(compound)) return $localize`:@@ccb.where_none:No class`;
    const row = this.classes().find((c) => c.key === compound.parentKey);
    return row ? (this.isAr ? row.labelAr : row.labelEn) : (compound.parentKey ?? '');
  }

  protected filedAria(compound: BoardCompound): string {
    // Names the consequence, not just the action: with no H1 in view a screen-reader user has
    // only this string to tell "untick" from "delete", and the two are a class apart.
    return $localize`:@@ccb.aria_filed:Take ${compound.label}:NAME: out of ${this.activeClassLabel()}:CLASS:. It will then be in no class, and any bank pricing off the class can quote it nothing.`;
  }

  protected candidateAria(compound: BoardCompound): string {
    return $localize`:@@ccb.aria_move:Move ${compound.label}:NAME: from ${this.whereLabel(compound)}:FROM: to ${this.activeClassLabel()}:TO:`;
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
    this.query.set('');
    this.announcement.set(this.unfiledLabel());
  }

  /**
   * Move one compound into the active class — optimistically, then confirmed.
   *
   * Optimistic because the operator's next action is usually the next card, and a spinner
   * between every tick makes a nine-card re-tiering feel like nine round trips. Rolled back on
   * failure, with the interceptor's toast carrying the reason.
   */
  protected async move(compound: BoardCompound): Promise<void> {
    const target = this.activeClassKey();
    if (target === '' || compound.parentKey === target) return;
    const previous = compound.parentKey;

    this.stagger.set(false);
    this.setSaving(compound.id, true);
    this.applyLocal(compound.id, target);
    try {
      await this.api.setParentKeysBulk([{ id: compound.id, parentKey: target }]);
      this.flashMoved(compound.id);
      this.announcement.set(
        $localize`:@@ccb.moved_one:${compound.label}:NAME: is now priced in ${this.activeClassLabel()}:CLASS:.`,
      );
    } catch {
      this.applyLocal(compound.id, previous);
    } finally {
      this.setSaving(compound.id, false);
    }
  }

  /**
   * Take one compound OUT of the active class, leaving it in none.
   *
   * The mirror of `move`, deliberately down to the rollback: same optimistic write, same
   * per-card `saving` flag, same live-region announcement. What differs is only the target —
   * `null`, which the bulk endpoint accepts from this screen and from nowhere else.
   *
   * No confirmation step. The action is one click to undo (tick it again), and the panel's own
   * warn notice fires the moment the count goes above zero, naming what it costs — which is a
   * louder and more useful signal than a modal the operator dismisses on the way through.
   */
  protected async unfile(compound: BoardCompound): Promise<void> {
    const previous = compound.parentKey;
    if (previous === null) return;

    this.stagger.set(false);
    this.setSaving(compound.id, true);
    this.applyLocal(compound.id, null);
    try {
      await this.api.setParentKeysBulk([{ id: compound.id, parentKey: null }]);
      this.flashMoved(compound.id);
      this.announcement.set(
        $localize`:@@ccb.removed_one:${compound.label}:NAME: is now in no class, so no bank can price it.`,
      );
    } catch {
      this.applyLocal(compound.id, previous);
    } finally {
      this.setSaving(compound.id, false);
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

    const before = new Map(moving.map((c) => [c.id, c.parentKey]));
    this.stagger.set(false);
    this.bulkSaving.set(true);
    for (const c of moving) this.applyLocal(c.id, target);
    try {
      const { moved } = await this.api.setParentKeysBulk(
        moving.map((c) => ({ id: c.id, parentKey: target })),
      );
      for (const c of moving) this.flashMoved(c.id);
      this.announcement.set(
        $localize`:@@ccb.moved_many:${moved}:COUNT: compounds are now priced in ${this.activeClassLabel()}:CLASS:.`,
      );
    } catch {
      for (const [id, parentKey] of before) this.applyLocal(id, parentKey ?? null);
    } finally {
      this.bulkSaving.set(false);
    }
  }

  private applyLocal(id: string, parentKey: string | null): void {
    this.compoundRows.set(
      this.compoundRows().map((row) => (row.id === id ? { ...row, parentKey } : row)),
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
