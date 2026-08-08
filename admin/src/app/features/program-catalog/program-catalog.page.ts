import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzModalService } from 'ng-zorro-antd/modal';
import { RouterLink } from '@angular/router';
import {
  PlusOutline,
  EditOutline,
  MinusCircleOutline,
  SearchOutline,
  HistoryOutline,
  InboxOutline,
  AppstoreOutline,
  CheckCircleOutline,
  PoweroffOutline,
  WarningOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  StatStripComponent,
  type StatStripItem,
} from '@shared/ui';
import {
  LOAN_CATEGORIES,
  canonicalCategories,
  categoryLabel,
  type LoanCategory,
} from '@core/loan-category';
import { LookupsApiService, type EnumerationRow } from '../lookups/lookups.api.service';
import {
  EnumerationEditDialogComponent,
  type EnumerationEditDialogData,
} from '../lookups/components/enumeration-edit.dialog';

const ENUM_TYPE = 'program_name';

/** How many parked names the health panel names before it stops listing. */
const PARKED_NAMES_SHOWN = 6;

/**
 * Program catalog — the predefined loan program names that feed the bank-program
 * builder's "Program name" picker. A name is JUST A NAME: it carries no lending
 * values of its own — every bank program authors its own specs. Names are DATA
 * (Principle II).
 *
 * One flat list, not per-category lanes: a name can be offered under several loan
 * types, so it has no single lane to sit in. Each card OPENS the name, where the
 * two per-category facts are configured together — which loan types may offer it,
 * and what each of those types scores on. The card shows the summary of both, so
 * the list answers "what is left to set up?" without opening anything.
 *
 * The health panel is inherited from the assignment board this list replaced. It
 * watches the one failure the list cannot show per row: a loan CATEGORY with no
 * names at all leaves the builder's picker empty, and nothing on a name's own
 * card can reveal that.
 *
 * Super-admin only (route-guarded).
 */
@Component({
  selector: 'app-program-catalog-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzIconModule,
    NzButtonModule,
    NzInputModule,
    NzToolTipModule,
    NzPopconfirmModule,
    PageHeaderComponent,
    StatStripComponent,
  ],
  providers: [
    provideNzIconsPatch([
      PlusOutline,
      EditOutline,
      MinusCircleOutline,
      SearchOutline,
      HistoryOutline,
      InboxOutline,
      AppstoreOutline,
      CheckCircleOutline,
      PoweroffOutline,
      WarningOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header
        eyebrow="Reference data"
        i18n-eyebrow="@@program_catalog.eyebrow"
        title="Program catalog"
        i18n-title="@@program_catalog.title"
        subtitle="Curated loan program names — Doctor, Military, New Car. Pick these in the bank-program builder instead of free-typing. Open a name to set which loan types offer it and what each one scores on."
        i18n-subtitle="@@program_catalog.subtitle"
      >
        @if (gaps().length > 0 || parked().length > 0) {
          <button
            type="button"
            class="health-toggle"
            [attr.aria-expanded]="healthOpen()"
            aria-controls="pcl-health"
            (click)="healthOpen.set(!healthOpen())"
          >
            <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@program_catalog.health"
              >{{ gaps().length + parked().length }} to look at</span
            >
          </button>
        }
      </app-page-header>

      @if (healthOpen() && (gaps().length > 0 || parked().length > 0)) {
        <div class="health" id="pcl-health">
          @if (gaps().length > 0) {
            <p class="hp-line">
              <span i18n="@@program_catalog.health.gaps"
                >No name is offered under {{ labels(gaps()) }}, so the bank-program builder has
                nothing to pick there. Open a name and turn that loan type on.</span
              >
            </p>
          }
          @if (parked().length > 0) {
            <p class="hp-line">
              <span i18n="@@program_catalog.health.parked"
                >Offered under no loan type, so nobody can pick them:
                {{ names(parked()) }}.</span
              >
            </p>
          }
        </div>
      }

      @if (!loading()) {
        <app-stat-strip
          [items]="stats()"
          ariaLabel="Program catalog statistics"
          i18n-ariaLabel="@@program_catalog.stats.aria"
        />
      }

      <div class="toolbar">
        <nz-input-group [nzPrefix]="searchIcon" class="search">
          <input
            nz-input
            [formControl]="searchControl"
            placeholder="Search program names…"
            i18n-placeholder="@@program_catalog.search"
            aria-label="Search program names"
            i18n-aria-label="@@program_catalog.search"
          />
        </nz-input-group>
        <ng-template #searchIcon>
          <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
        </ng-template>
        <span class="toolbar-spacer"></span>
        <button nz-button nzType="primary" class="add-btn" (click)="add()">
          <span nz-icon nzType="plus" nzTheme="outline"></span>
          <span i18n="@@program_catalog.add">Add program</span>
        </button>
      </div>

      @if (loading()) {
        <div class="cards" aria-hidden="true">
          @for (c of skeletonCards; track c) {
            <span class="sk sk-card"></span>
          }
        </div>
      } @else if (live().length === 0 && deprecated().length === 0) {
        @if (search().trim()) {
          <div class="board-empty">
            <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            <p i18n="@@program_catalog.no_matches">No programs match “{{ search() }}”.</p>
          </div>
        } @else {
          <div class="board-empty">
            <span nz-icon nzType="inbox" nzTheme="outline" aria-hidden="true"></span>
            <p i18n="@@program_catalog.empty">No programs here yet — add the first one.</p>
          </div>
        }
      } @else {
        <ul class="cards" role="list">
          @for (r of live(); track r.id) {
            <li class="card" [class.muted]="!r.active">
              <!-- The whole card opens the name: one anchor, stretched over the
                   card by ::after, with the action row lifted above it. A row of
                   small "configure" links instead would give every card three
                   competing targets and still leave the biggest one dead. -->
              <a class="open" [routerLink]="[r.key]" [attr.aria-label]="openLabel(r)">
                <!-- Same head anatomy as the stat cards above (tonal chip +
                     label), so the board reads as one system rather than two
                     grids that happen to share a page. -->
                <span class="card-head">
                  <span
                    class="chip"
                    [attr.data-tone]="r.active ? 'brand' : 'muted'"
                    aria-hidden="true"
                  >
                    <span
                      nz-icon
                      [nzType]="r.active ? 'appstore' : 'poweroff'"
                      nzTheme="outline"
                    ></span>
                  </span>
                  <span class="name">{{ nameOf(r) }}</span>
                </span>

                <!-- What is configured, in the two axes the detail screen owns.
                     Without this the list said only that a name exists, and
                     "which of my sixteen names is still unconfigured?" meant
                     opening all sixteen. -->
                <span class="config">
                  @if (categoriesOf(r).length === 0) {
                    <span class="cat-none" i18n="@@program_catalog.card.parked"
                      >No loan types yet</span
                    >
                  } @else {
                    <span class="cats">
                      @for (c of categoriesOf(r); track c) {
                        <span class="cat" [style.--cat-accent]="'var(--color-cat-' + c + ')'">
                          <span class="cat-dot" aria-hidden="true"></span>
                          {{ label(c) }}
                        </span>
                      }
                    </span>
                    @if (questionCount(r) === 0) {
                      <span class="q-none" i18n="@@program_catalog.card.no_questions"
                        >No questions picked</span
                      >
                    } @else {
                      <span class="q-count">{{ questionLabel(r) }}</span>
                    }
                  }
                </span>
              </a>

              <div class="card-foot">
                <!-- Does any bank actually sell this program? The row actions are
                     hover-only, so the board has to answer it at rest. -->
                <span class="usage" [class.zero]="usageOf(r).programs === 0">
                  @if (usageOf(r).programs === 0) {
                    <span i18n="@@program_catalog.usage.none">Not offered yet</span>
                  } @else {
                    {{ usageLabel(r) }}
                  }
                </span>
                <!-- Only the EXCEPTION is badged. Nearly every name is active, so
                     an ACTIVE pill on all sixteen cards said nothing and cost a
                     row of colour; absence now means active. -->
                @if (!r.active) {
                  <span class="tag">{{ inactiveLabel }}</span>
                }
                <span class="foot-spacer"></span>
                <div class="row-actions">
                  <button
                    class="icon-action"
                    type="button"
                    (click)="edit(r)"
                    nz-tooltip
                    nzTooltipTitle="Edit"
                    i18n-nzTooltipTitle="@@program_catalog.edit"
                    [attr.aria-label]="editLabel"
                  >
                    <span nz-icon nzType="edit" nzTheme="outline"></span>
                  </button>
                  <button
                    class="icon-action"
                    type="button"
                    (click)="toggleActive(r, !r.active)"
                    nz-tooltip
                    [nzTooltipTitle]="r.active ? deactivateLabel : activateLabel"
                    [attr.aria-label]="r.active ? deactivateLabel : activateLabel"
                  >
                    <span nz-icon nzType="poweroff" nzTheme="outline"></span>
                  </button>
                  <button
                    class="icon-action danger"
                    type="button"
                    nz-popconfirm
                    nzPopconfirmTitle="Deprecate this program? It stops appearing in the picker."
                    i18n-nzPopconfirmTitle="@@program_catalog.deprecate.confirm"
                    nzPopconfirmPlacement="topRight"
                    (nzOnConfirm)="deprecate(r)"
                    nz-tooltip
                    nzTooltipTitle="Deprecate"
                    i18n-nzTooltipTitle="@@program_catalog.deprecate"
                    [attr.aria-label]="deprecateLabel"
                  >
                    <span nz-icon nzType="minus-circle" nzTheme="outline"></span>
                  </button>
                </div>
              </div>
            </li>
          }

          @if (deprecated().length > 0) {
            <li class="cards-divider" aria-hidden="true">
              <span nz-icon nzType="history" nzTheme="outline"></span>
              <span i18n="@@program_catalog.deprecated">Deprecated</span>
            </li>
            @for (r of deprecated(); track r.id) {
              <li class="card deprecated">
                <div class="card-head">
                  <span class="chip" data-tone="warning" aria-hidden="true">
                    <span nz-icon nzType="history" nzTheme="outline"></span>
                  </span>
                  <span class="name">{{ nameOf(r) }}</span>
                </div>
                <div class="card-foot">
                  <span class="tag warn">{{ deprecatedLabel }}</span>
                  <span class="foot-spacer"></span>
                  <div class="row-actions">
                    <button
                      class="icon-action"
                      type="button"
                      (click)="edit(r)"
                      nz-tooltip
                      nzTooltipTitle="Edit"
                      i18n-nzTooltipTitle="@@program_catalog.edit"
                      [attr.aria-label]="editLabel"
                    >
                      <span nz-icon nzType="edit" nzTheme="outline"></span>
                    </button>
                  </div>
                </div>
              </li>
            }
          }
        </ul>
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
        gap: var(--space-5);
        padding: var(--space-6);
        max-inline-size: 1120px;
        margin-inline: auto;
      }
      .toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
      }
      .search {
        max-inline-size: 420px;
        inline-size: 100%;
        flex: 1 1 240px;
      }
      .toolbar-spacer {
        flex: 1;
      }
      .add-btn [nz-icon] {
        margin-inline-end: var(--space-1);
      }
      .health-toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        min-block-size: 32px;
        padding-inline: var(--space-3);
        border: 1px solid var(--color-warning);
        border-radius: var(--radius-pill);
        background: var(--color-warning-bg);
        color: var(--color-warning);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .health-toggle:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .health {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-4);
        border: 1px solid var(--color-warning);
        border-radius: var(--radius-md);
        background: var(--color-warning-bg);
      }
      .hp-line {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .board-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-6);
        color: var(--color-text-tertiary);
        text-align: center;
      }
      .board-empty [nz-icon] {
        font-size: 32px;
        opacity: 0.6;
      }
      .board-empty p {
        margin: 0;
        font-size: var(--text-sm);
      }
      .sk {
        display: block;
        border-radius: var(--radius-sm);
        background: linear-gradient(
          90deg,
          var(--color-surface-elevated) 0%,
          var(--color-surface-muted) 50%,
          var(--color-surface-elevated) 100%
        );
        background-size: 200% 100%;
        animation: catalog-shimmer 1.2s ease-in-out infinite;
      }
      /* Matches the real card: 36px chip/name head + 12px gap + 30px action
         floor + 2×16px padding. */
      .sk-card {
        block-size: 110px;
        border-radius: var(--radius-lg);
      }
      @keyframes catalog-shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sk {
          animation: none;
          background: var(--color-surface-muted);
        }
      }
      .cards {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
        /* Same gap as the stat strip above, so at 1120px both grids land on
           three columns whose edges line up. */
        gap: var(--space-4);
      }
      /* Two rows: a chip/name head, then a meta/action floor. Column layout so
         the name owns the card's full width — the status pill + hover actions
         used to reserve ~130px inline and squeeze longer names ("Government
         Employees") into an ellipsis.

         Shell tokens are the stat card's, one for one — radius-lg, the DEFAULT
         border, resting shadow-sm, shadow-md + brand edge on hover — because the
         two grids sit ten pixels apart and any divergence reads as two different
         products. Surface-DEFAULT, not -elevated: on this palette "elevated"
         (#F5F3F0) is a shade DARKER than the page (#F8F6F4), and a name board of
         nine recessed tiles reads as one flat grey field. */
      .card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-3);
        padding: var(--space-4);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        transition:
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--color-brand-primary);
      }
      /* Recessed instead of faded: the "Inactive" tag already carries the state,
         and dimming the whole card only cost the name its contrast. */
      .card.muted {
        background: var(--color-surface-elevated);
      }
      .card.muted .name {
        color: var(--color-text-secondary);
      }
      /* Dashed is reserved for deprecated — the one destructive state here.
         A retired name is not a resting object, so it drops the shadow too. */
      .card.deprecated {
        background: var(--color-surface-elevated);
        border-style: dashed;
        border-color: var(--color-border-default);
        box-shadow: none;
      }
      /* Declared after .card.deprecated, which ties on specificity and would
         otherwise pin the border back to default on the hover it is meant to
         answer. Warning, not brand: the only action left here is Edit. */
      .card.deprecated:hover {
        border-color: var(--color-warning);
        box-shadow: var(--shadow-sm);
      }
      /* The open link owns the card's body, and its ::after stretches the hit area
         over the whole card so the target is the card, not the text — while the
         anchor itself stays a normal flow element, which is what keeps the name
         selectable and the focus ring tight around the content. */
      .open {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        min-inline-size: 0;
        color: inherit;
        text-decoration: none;
        border-radius: var(--radius-sm);
      }
      .open::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: var(--radius-lg);
      }
      .open:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
      }
      .card-head {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      /* Config summary: which loan types, then how many questions. Two lines of
         metadata, not a card of its own — nesting a panel inside a card to hold
         two facts is hierarchy for its own sake. */
      .config {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .cats {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
      }
      .cat {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      /* A dot, not a coloured pill: four filled pills per card across a 16-card
         grid is a confetti field, and the label already carries the meaning. The
         dot only has to make the set countable at a glance. */
      .cat-dot {
        inline-size: 6px;
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--cat-accent, var(--color-cat-other));
      }
      .cat-none,
      .q-none {
        font-size: var(--text-xs);
        color: var(--color-text-disabled);
      }
      .q-count {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      /* The stat strip's 36px tonal chip, same size and radius. It is decoration
         with a job: it gives every card a fixed optical anchor so a three-column
         grid of ragged, wrapping names still scans down a straight edge. */
      .chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        inline-size: 36px;
        block-size: 36px;
        border-radius: var(--radius-md);
        font-size: var(--text-lg);
        background: color-mix(in srgb, var(--color-brand-primary) 12%, transparent);
        color: var(--color-brand-primary);
      }
      .chip[data-tone='muted'] {
        background: color-mix(in srgb, var(--color-text-tertiary) 14%, transparent);
        color: var(--color-text-tertiary);
      }
      .chip[data-tone='warning'] {
        background: color-mix(in srgb, var(--color-warning) 12%, transparent);
        color: var(--color-warning);
      }
      /* Names wrap in full — never truncated (they are the card's whole point).
         text-lg is the system's card-title size; a name IS this card's title. */
      .name {
        min-inline-size: 0;
        padding-block-start: 2px;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
        text-wrap: balance;
        overflow-wrap: break-word;
      }
      /* Usage line: whether any bank actually sells this program. */
      /* text-xs, the system's metadata floor — xxs (11px) sat below it. */
      .usage {
        min-inline-size: 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* No italics — Arabic has no italic tradition and synthesised slant is ugly
         at this size (Principle IV). Tone alone carries the "unused" signal, and
         the card border stays solid: dashed is reserved for deprecated, the one
         destructive state on this board. */
      .usage.zero {
        color: var(--color-text-disabled);
      }
      /* Pinned to the card floor so the meta + action rows align across a grid
         row regardless of how many lines each name takes. */
      .card-foot {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: auto;
      }
      .foot-spacer {
        flex: 1;
      }
      .tag {
        flex: none;
        padding-inline: var(--space-2);
        padding-block: 1px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        /* Matches .usage — the two share the foot row and any size gap between
           them reads as a mistake at this scale. */
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        white-space: nowrap;
      }
      .tag.warn {
        background: color-mix(in srgb, var(--color-warning) 14%, transparent);
        color: var(--color-warning);
      }
      /* Lifted above the stretched open-link, or the buttons would be unclickable
         — the overlay covers them. */
      .row-actions {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        opacity: 0;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover .row-actions,
      .card:focus-within .row-actions {
        opacity: 1;
      }
      .icon-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 30px;
        block-size: 30px;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .icon-action:hover {
        background: var(--color-surface-row-hover);
        color: var(--color-text-primary);
      }
      .icon-action.danger:hover {
        color: var(--color-error);
      }
      .icon-action:active {
        background: var(--color-tonal-accent-bg);
      }
      .icon-action:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 1px;
      }
      .cards-divider {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-2);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      @media (hover: none) {
        .row-actions {
          opacity: 1;
        }
        .icon-action {
          inline-size: 40px;
          block-size: 40px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .card,
        .row-actions {
          transition: none;
        }
        .card:hover {
          transform: none;
        }
      }
      @media (max-width: 720px) {
        .page {
          padding: var(--space-4);
        }
        .cards {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProgramCatalogPage implements OnInit {
  private readonly api = inject(LookupsApiService);
  private readonly modal = inject(NzModalService);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly loading = signal(true);
  protected readonly healthOpen = signal(false);
  private readonly rows = signal<EnumerationRow[]>([]);

  /** Fixed-length placeholders for the shape-matched loading skeleton. */
  protected readonly skeletonCards = [0, 1, 2, 3, 4, 5];

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly search = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  // Localized action labels reused across tooltips + aria.
  protected readonly inactiveLabel = $localize`:@@program_catalog.status.inactive:Inactive`;
  protected readonly deprecatedLabel = $localize`:@@program_catalog.status.deprecated:Deprecated`;
  protected readonly editLabel = $localize`:@@program_catalog.edit:Edit`;
  protected readonly activateLabel = $localize`:@@program_catalog.activate:Activate`;
  protected readonly deactivateLabel = $localize`:@@program_catalog.deactivate:Deactivate`;
  protected readonly deprecateLabel = $localize`:@@program_catalog.deprecate:Deprecate`;

  /** Search-filtered rows — one flat list, since a name may serve several loan
   *  types and so has no single lane. Deprecated names sit in their own tail
   *  section. */
  private readonly filtered = computed<EnumerationRow[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(
      (r) =>
        r.labelEn.toLowerCase().includes(q) ||
        r.labelAr.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q),
    );
  });

  protected readonly live = computed(() => this.filtered().filter((r) => !r.deprecatedAt));
  protected readonly deprecated = computed(() => this.filtered().filter((r) => r.deprecatedAt));

  protected readonly stats = computed<StatStripItem[]>(() => {
    const all = this.rows();
    const active = all.filter((r) => r.active && !r.deprecatedAt).length;
    const deprecated = all.filter((r) => r.deprecatedAt).length;
    return [
      {
        label: $localize`:@@program_catalog.stat.total:Programs`,
        value: all.length,
        icon: 'appstore',
        hint: $localize`:@@program_catalog.stat.total.hint:across all loan types`,
      },
      {
        label: $localize`:@@program_catalog.stat.active:Active`,
        value: active,
        tone: 'success',
        icon: 'check-circle',
      },
      {
        label: $localize`:@@program_catalog.stat.deprecated:Deprecated`,
        value: deprecated,
        tone: 'warning',
        icon: 'history',
      },
    ];
  });

  /**
   * Loan categories no live name is offered under. The builder's Program name
   * picker is EMPTY for these, which is a hard stop for whoever is trying to add
   * a car loan — and the one failure a per-name card cannot show, since every
   * card looks fine.
   *
   * Inactive names count as offered: reactivating one is a single click and its
   * assignment survives, so a category served only by an inactive name is not a
   * gap, it is a switch someone has to flip.
   */
  protected readonly gaps = computed<LoanCategory[]>(() => {
    const offered = new Set<LoanCategory>();
    for (const r of this.rows()) {
      if (r.deprecatedAt) continue;
      for (const c of this.categoriesOf(r)) offered.add(c);
    }
    return LOAN_CATEGORIES.filter((c) => !offered.has(c));
  });

  /** Live names offered under nothing — kept and editable, pickable nowhere. */
  protected readonly parked = computed<EnumerationRow[]>(() =>
    this.rows().filter((r) => !r.deprecatedAt && this.categoriesOf(r).length === 0),
  );

  ngOnInit(): void {
    void this.reload();
  }

  add(): void {
    this.openDialog({ mode: 'create', type: ENUM_TYPE });
  }

  edit(row: EnumerationRow): void {
    this.openDialog({ mode: 'edit', type: ENUM_TYPE, row });
  }

  // --- Card meta ------------------------------------------------------------

  /**
   * ONE name per card, in the reading locale — not the en/ar pair the board used
   * to stack. Both labels are still authored in the edit dialog and both are
   * still searchable; showing them together only doubled every card's height for
   * a translation the operator can already read. Locale-aware rather than
   * hardcoded English so the ar-EG build stays Arabic-first (Principle IV).
   */
  nameOf(row: EnumerationRow): string {
    return this.isAr ? row.labelAr : row.labelEn;
  }

  /** Server omits `usage` for non-`program_name` types; treat that as unused. */
  usageOf(row: EnumerationRow): { programs: number; banks: number } {
    return row.usage ?? { programs: 0, banks: 0 };
  }

  usageLabel(row: EnumerationRow): string {
    const u = this.usageOf(row);
    return $localize`:@@program_catalog.usage.value:${u.programs}:PROGRAMS: programs · ${u.banks}:BANKS: banks`;
  }

  /**
   * Loan categories this name may be offered under, in canonical order.
   *
   * `categories` is absent on a backend that has not deployed the assignment
   * endpoints; that reads as "unknown", not as parked, so the card falls back to
   * an empty list and the health panel counts it — an operator seeing "no loan
   * types" on every card will look, which is the correct outcome for a version
   * skew.
   */
  protected categoriesOf(row: EnumerationRow): LoanCategory[] {
    return canonicalCategories(row.categories ?? []);
  }

  protected label(category: LoanCategory): string {
    return categoryLabel(category);
  }

  protected labels(categories: readonly LoanCategory[]): string {
    return categories.map((c) => categoryLabel(c)).join(this.isAr ? '، ' : ', ');
  }

  protected names(rows: readonly EnumerationRow[]): string {
    const shown = rows.slice(0, PARKED_NAMES_SHOWN).map((r) => this.nameOf(r));
    const rest = rows.length - shown.length;
    const list = shown.join(this.isAr ? '، ' : ', ');
    return rest > 0 ? $localize`:@@program_catalog.health.more:${list}:NAMES: and ${rest}:REST: more` : list;
  }

  /**
   * Suggested questions across the loan types this name is actually OFFERED
   * under. Deliberately not the sum over all four: a set left behind under a
   * withdrawn loan type is kept on purpose (nothing prunes it), and counting it
   * here would tell an operator their name is configured when the questions it
   * points at are inert.
   */
  protected questionCount(row: EnumerationRow): number {
    const byCategory = row.questionsByCategory;
    if (!byCategory) return 0;
    return this.categoriesOf(row).reduce((n, c) => n + (byCategory[c]?.length ?? 0), 0);
  }

  protected questionLabel(row: EnumerationRow): string {
    const count = this.questionCount(row);
    return $localize`:@@program_catalog.card.questions:${count}:COUNT: questions scored`;
  }

  protected openLabel(row: EnumerationRow): string {
    return $localize`:@@program_catalog.card.open:Set up ${this.nameOf(row)}:NAME:`;
  }

  async toggleActive(row: EnumerationRow, next: boolean): Promise<void> {
    this.patchRow(row.id, { active: next });
    try {
      await this.api.update(row.id, { active: next });
    } catch {
      this.patchRow(row.id, { active: !next });
    }
  }

  async deprecate(row: EnumerationRow): Promise<void> {
    const stampedAt = new Date().toISOString();
    this.patchRow(row.id, { deprecatedAt: stampedAt, active: false });
    try {
      await this.api.update(row.id, { deprecate: true });
    } catch {
      this.patchRow(row.id, { deprecatedAt: null });
    }
  }

  private patchRow(id: string, patch: Partial<EnumerationRow>): void {
    this.rows.update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  private openDialog(data: EnumerationEditDialogData): void {
    const ref = this.modal.create<EnumerationEditDialogComponent, EnumerationEditDialogData, boolean>(
      {
        nzContent: EnumerationEditDialogComponent,
        nzData: data,
        nzTitle:
          data.mode === 'create'
            ? $localize`:@@program_catalog.dialog.add:Add program name`
            : $localize`:@@program_catalog.dialog.edit:Edit program name`,
        nzWidth: 'min(640px, calc(100vw - 48px))',
        nzFooter: null,
        nzMaskClosable: true,
      },
    );
    ref.afterClose.subscribe((saved: boolean | undefined) => {
      if (saved) void this.reload({ silent: true });
    });
  }

  /** Silent reload keeps the board on screen (no skeleton flash) after a save. */
  private async reload(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loading.set(true);
    try {
      this.rows.set(await this.api.list(ENUM_TYPE));
    } finally {
      if (!opts.silent) this.loading.set(false);
    }
  }
}
