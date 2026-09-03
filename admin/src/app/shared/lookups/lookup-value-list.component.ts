import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  CloseCircleOutline,
  DeleteOutline,
  EditOutline,
  InboxOutline,
  LockOutline,
  PoweroffOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { RailTabsComponent } from '@shared/ui';
import type { EnumerationRow } from '@features/lookups/lookups.api.service';
import {
  GROUP_ALL,
  GROUP_DEPRECATED,
  VALUE_PAGE_SIZE,
  groupValues,
  pageSlice,
  resolveValueTab,
  shouldGroup,
  valueTabs,
} from './value-groups';

/** Emitted when the operator flips a value's active flag. */
export interface LookupActiveToggle {
  row: EnumerationRow;
  next: boolean;
}

/**
 * Value list for one lookup type — presentational. Owns only its local filter;
 * every mutation is emitted upward so the page keeps the single source of truth.
 */
@Component({
  selector: 'app-lookup-value-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzIconModule,
    NzInputModule,
    NzToolTipModule,
    NzPopconfirmModule,
    NzPaginationModule,
    RailTabsComponent,
  ],
  // Registers the icons IT renders. This component previously registered none and relied on
  // whichever host happened to have patched them — fine while Manage values was the only
  // host, order-dependent the moment a second one (a surrogate product's workspace) mounted
  // it. A presentational component that renders an icon owns that icon.
  providers: [
    provideNzIconsPatch([
      CloseCircleOutline,
      DeleteOutline,
      EditOutline,
      // Rendered by the empty state and never registered — a blank box where the icon goes.
      InboxOutline,
      LockOutline,
      PoweroffOutline,
      SearchOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <nz-input-group [nzPrefix]="searchIcon" [nzSuffix]="clearIcon" class="search">
        <input
          nz-input
          [formControl]="filter"
          placeholder="Filter values…"
          i18n-placeholder="@@lookups.search"
          [attr.aria-label]="searchLabel"
        />
      </nz-input-group>
      <ng-template #searchIcon>
        <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
      </ng-template>
      <ng-template #clearIcon>
        @if (query()) {
          <button
            type="button"
            class="clear"
            (click)="filter.setValue('')"
            [attr.aria-label]="clearLabel"
          >
            <span nz-icon nzType="close-circle" nzTheme="outline"></span>
          </button>
        }
      </ng-template>
      <span class="counts">{{ countsLabel() }}</span>
    </div>

    @if (view().live.length === 0 && view().deprecated.length === 0) {
      <div class="empty">
        <span
          nz-icon
          [nzType]="query() ? 'search' : 'inbox'"
          nzTheme="outline"
          aria-hidden="true"
        ></span>
        @if (query()) {
          <p class="empty-title" i18n="@@lookups.empty.filtered.title">
            Nothing matches “{{ query() }}”
          </p>
          <p class="empty-text" i18n="@@lookups.empty.filtered.text">
            Filtering searches the label and the key.
          </p>
        } @else {
          <p class="empty-title" i18n="@@lookups.empty.title">No values yet</p>
          <p class="empty-text" i18n="@@lookups.empty.text">
            Add the first one — it shows up in the admin and the mobile wizard immediately.
          </p>
        }
      </div>
    } @else {
      <!-- ONE CLASS ON STAGE, not every class stacked.
           The accordion this replaces put the operator back in front of the whole list the
           moment they opened the big group — on the real compound list that is 69 rows under
           one heading — and said nothing about how far through them they were. A rail states
           every class and its size at once, which is the half a stack of headings hides, and
           the pager states where in one class the eye is.

           An All tab leads it whenever the list is split: an operator searching for a compound
           does not know which class it is filed under, and without All the only way to see the
           whole list is to read every tab. -->
      @if (tabs().length > 1) {
        <app-rail-tabs
          appearance="segmented"
          idPrefix="lv"
          [items]="tabs()"
          [activeId]="activeTab() ?? ''"
          [ariaLabel]="tabsAria"
          (select)="pickTab($event)"
        />
      }

      <div
        class="stage"
        [id]="'lv-panel-' + activeTab()"
        [attr.role]="tabs().length > 1 ? 'tabpanel' : null"
        [attr.aria-labelledby]="tabs().length > 1 ? 'lv-tab-' + activeTab() : null"
      >
        <ul class="values" role="list">
          @for (r of page().rows; track r.id) {
            <li
              class="value"
              [class.inactive]="!r.active"
              [class.deprecated]="onDeprecated()"
              [style.--lv-accent]="accentFor(r.parentKey)"
            >
              <div class="value-main">
                <span class="labels">
                  <span class="label-en">{{ labelOf(r) }}</span>
                  <!-- The CLASS this value is filed under, where its type has one — but only
                       on the All tab. Inside a class tab it is the tab's own name repeated on
                       every row: on the real compound list that was the word "Other" printed
                       69 times, a column carrying no information at all while hiding the two
                       rows that differ.

                       A SECOND LINE, not a pill beside the name. "Cairo, Giza and Alexandria"
                       is twice the length of "Cairo", so as a chip it out-shouted the value it
                       qualifies and set every cell's width from the class rather than from the
                       name. Under the name it is plainly subordinate, and every cell in a grid
                       row is then the same height. -->
                  @if (showsParent() && showsAll() && r.parentKey) {
                    <span class="parent-line">
                      <span class="rank-dot" aria-hidden="true"></span>
                      {{ parentLabel(r.parentKey) }}
                    </span>
                  }
                </span>
                <!-- Filed under nothing is the one class state that costs a quote, so it keeps
                     the chip the ordinary case just gave up. -->
                @if (showsParent() && showsAll() && !r.parentKey) {
                  <span class="badge parent-missing" i18n="@@lookups.value.unclassified"
                    >No class</span
                  >
                }
                @if (r.systemOnly) {
                  <span
                    class="badge system"
                    nz-tooltip
                    nzTooltipTitle="System-managed — labels are editable, the key and lifecycle are locked"
                    i18n-nzTooltipTitle="@@lookups.systemTooltip"
                  >
                    <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
                    <span i18n="@@lookups.system">System</span>
                  </span>
                }
              </div>

              <div class="value-side">
                <!-- Only the states that are NOT the norm. "ACTIVE" on all 71 rows was
                     not a status, it was one word 71 times; the count in the toolbar
                     says it once, and an inactive row now stands out instead of being
                     one of 71 identical pills. -->
                @if (onDeprecated()) {
                  <span class="status dep">{{ deprecatedLabel }}</span>
                } @else if (!r.active) {
                  <span class="status off">{{ inactiveLabel }}</span>
                }
                <div class="row-actions">
                  <button
                    class="icon-action"
                    type="button"
                    (click)="edit.emit(r)"
                    nz-tooltip
                    [nzTooltipTitle]="editLabel"
                    [attr.aria-label]="editAria(r)"
                  >
                    <span nz-icon nzType="edit" nzTheme="outline"></span>
                  </button>
                  @if (!onDeprecated()) {
                    <button
                      class="icon-action"
                      type="button"
                      [disabled]="r.systemOnly"
                      (click)="toggleActive.emit({ row: r, next: !r.active })"
                      nz-tooltip
                      [nzTooltipTitle]="r.active ? deactivateLabel : activateLabel"
                      [attr.aria-label]="activeAria(r)"
                    >
                      <span nz-icon nzType="poweroff" nzTheme="outline"></span>
                    </button>
                  }
                  <!-- Two ways out, not three. Deactivate parks a value something
                       already uses (reversible, keeps every saved reference working);
                       delete removes one nothing uses. Deprecate was a third state that
                       did what deactivate does and could never be undone from here, so
                       the board no longer offers it — existing deprecated rows still get
                       their own tab, they just cannot be created any more. -->
                  @if (deletable()) {
                    <button
                      class="icon-action danger"
                      type="button"
                      [disabled]="r.systemOnly"
                      nz-popconfirm
                      nzPopconfirmTitle="Delete this value for good? Only possible while nothing uses it."
                      i18n-nzPopconfirmTitle="@@lookups.delete.confirm"
                      nzPopconfirmPlacement="topRight"
                      (nzOnConfirm)="remove.emit(r)"
                      nz-tooltip
                      [nzTooltipTitle]="deleteLabel"
                      [attr.aria-label]="deleteAria(r)"
                    >
                      <span nz-icon nzType="delete" nzTheme="outline"></span>
                    </button>
                  }
                </div>
              </div>
            </li>
          }
        </ul>

        <!-- Below the list, and only past one page: a control whose only state is "page 1 of
             1" is chrome, not navigation. -->
        @if (page().pages > 1) {
          <nav class="pager" [attr.aria-label]="pagerAria">
            <p class="pager-range" i18n="@@lookups.page_range">
              Showing {{ page().from }}–{{ page().to }} of {{ page().total }}
            </p>
            <nz-pagination
              [nzPageIndex]="page().page"
              [nzPageSize]="VALUE_PAGE_SIZE"
              [nzTotal]="page().total"
              nzSize="small"
              (nzPageIndexChange)="setPage($event)"
            />
          </nav>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .search {
        flex: 1 1 320px;
        max-inline-size: 420px;
      }
      .clear {
        appearance: none;
        display: inline-flex;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--color-text-tertiary);
        cursor: pointer;
      }
      .clear:hover {
        color: var(--color-text-primary);
      }
      /* Secondary, not tertiary. Measured at 3.83:1 in light mode, which fails AA — and this
         line now carries the load the per-row ACTIVE pill used to: it is the only place that
         says how many of these values are live. */
      .counts {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      /* The rail and the rows under it are ONE control, so the gap between them is tighter
         than the gap that separates the whole thing from the toolbar above. */
      .stage {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
        padding-block: var(--space-3);
      }
      /* Secondary, not tertiary: this line is READ — it is the only thing that says how much
         of the class is off screen — and tertiary ink measures under 4.5:1 at this size. */
      .pager-range {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }

      /* ─── A GRID OF CELLS, not a column of full-width rows ───────────────────
         A value is a short label and up to two badges — on the compound list, about
         a dozen characters — so a full-width row spent 1 400px saying "Palm Hills"
         and put its three actions a screen's width from the name they act on. Ten
         of those is ten near-empty bands the eye has to travel end to end.

         The earlier hairline-separated rows replaced 71 bordered cards, and the
         argument for that no longer holds: since the list is PAGED there are ten
         cells on stage, never seventy-one, so a border per cell is ten borders and
         it is what tells one column from the next. Same vocabulary as the ask grid
         two steps to the left on this screen — the same gap, the same edge — so the
         two lists on one product read as one system. */
      /* An ALIGNED grid, not wrapping flex. Content-sized cells put a ragged edge down
         the trailing side and started every column in a different place — three cells
         per row, none of them lining up with the row above — and the last row of a page
         left a half-screen void beside two cells. Equal tracks give the page one vertical
         rhythm, a flush trailing edge, and rows of equal height whatever the names do. */
      .values {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
        gap: var(--space-3);
      }
      .value {
        position: relative;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--space-3);
        min-inline-size: 0;
        padding: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
        box-shadow: var(--shadow-sm);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* Lifts the EDGE, never the fill: the actions that appear on hover carry the cell's own
         ground so they cover nothing, and a hover that repainted that ground would leave them
         sitting on a patch of the old colour. What moves is the edge, the shadow and one
         pixel of height — and the edge takes the CLASS's accent, so hovering says which tier
         the value is filed under as well as that it is under the cursor. */
      .value:hover,
      .value:focus-within {
        border-color: color-mix(
          in srgb,
          var(--lv-accent, var(--color-border-strong)) 55%,
          var(--color-border-default)
        );
        box-shadow: var(--shadow-md);
        transform: translateY(-1px);
      }
      /* A parked value recedes as a WHOLE cell, which a row could only say in the one
         word at its trailing edge — but through the EDGE, never the fill: --bg-muted is
         darker than the surface in light and LIGHTER in dark, so a muted fill would make
         a parked cell the brightest thing in the grid in one of the two themes.
         --border-subtle is the lower-contrast edge in both. */
      .value.inactive,
      .value.deprecated {
        border-color: var(--border-subtle);
        /* No lift either: a parked value is not one of the live cards standing off the page. */
        box-shadow: none;
      }
      .value.inactive .label-en {
        color: var(--color-text-secondary);
      }
      /* Context, not a status, so no chip: a line of secondary ink under the name.
         Secondary and not tertiary — tertiary measures 3.83:1 in light and this line is
         read, since it is the only thing on the All tab that says where the value is filed. */
      .parent-line {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--text-xxs);
        line-height: 1.4;
        color: var(--color-text-secondary);
        overflow-wrap: anywhere;
      }
      /* The class's RANK, as a colour rather than a number — the same descent the class board
         already draws from the registry's own sortOrder, so the two screens say the tier the
         same way. It is not decoration: on the real compound list 65 of 71 values sit in the
         catch-all, so the handful that are filed higher are the only ones the eye needs to
         find, and a grey word repeated 65 times could not point at them.

         Never the only carrier — the class is written out beside it in words. */
      .rank-dot {
        flex: 0 0 auto;
        inline-size: 6px;
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--lv-accent, var(--color-text-tertiary));
      }

      /* Not an error state — a value nobody has classified yet is ordinary — but it is the
         thing on this row that costs a quote, so it reads louder than the class itself. */
      .badge.parent-missing {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }

      .value.deprecated .label-en {
        color: var(--color-text-tertiary);
      }
      .value-main {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        min-inline-size: 0;
        flex: 1 1 auto;
      }
      .labels {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      /* Same rule as the rail tiles: a value's name is the row's whole identity,
         so long names wrap onto a second line instead of being cut. */
      .label-en {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
        letter-spacing: -0.005em;
        overflow-wrap: anywhere;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        white-space: nowrap;
      }
      /* The cell's trailing edge, on the name's own line — nothing is reserved below it,
         so a cell whose name wrapped is taller and a cell whose name did not is not. */
      .value-side {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-2);
        flex: 0 0 auto;
        min-block-size: 32px;
      }
      .status {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      /* Secondary, not tertiary: this is now the one row in seventy that is off, so it is
         read rather than skimmed, and tertiary ink is under 4.5:1 at this size. */
      .status.off {
        color: var(--color-text-secondary);
      }
      .status.dep {
        color: var(--color-warning);
      }
      /* Revealed, never removed. Three icons on every row is 213 controls on the compound
         list, which turns the trailing edge into a texture rather than an action. Opacity
         and not display, so the buttons stay in the tab order and :focus-within brings them
         up for a keyboard; on touch, where there is no hover to reveal them, they stay on. */
      .row-actions {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        /* Pushed to the trailing edge on a cell whose status word is absent — which is
           every active cell, i.e. the norm — so the actions sit in one place down the
           column rather than wherever the status left them. */
        margin-inline-start: auto;
        opacity: 0;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* Where there IS a hover, three hidden buttons must not reserve their own width:
         in flow they took ~110px out of every cell, so a 15rem track had barely a third
         of itself left for the name. Lifted out of flow they cost nothing until revealed,
         and the cell's own ground carries them so they never sit over the label.
         Only under hover: hover — on touch there is no reveal, so they stay in flow
         where they can cover nothing. */
      @media (hover: hover) {
        .row-actions {
          position: absolute;
          /* Aligned to the NAME's line, not centred: centred, the buttons sat across the
             class line underneath and cut it mid-word. On the name's own line there is
             room beside it — a governorate is one short word — and the class stays read. */
          inset-block-start: var(--space-1);
          inset-inline-end: 1px;
          padding-inline: var(--space-6) var(--space-2);
          /* The ground fades in rather than starting as a hard edge, so the longest class
             name passing under the buttons trails off instead of being chopped. */
          background: linear-gradient(
            to right,
            transparent,
            var(--color-surface-default) var(--space-6)
          );
          border-start-end-radius: var(--radius-md);
        }
      }
      /* A gradient has no logical direction; the mirror is the one thing that must be stated
         twice. */
      :host-context([dir='rtl']) .row-actions {
        background: linear-gradient(
          to left,
          transparent,
          var(--color-surface-default) var(--space-6)
        );
      }
      .value:hover .row-actions,
      .value:focus-within .row-actions {
        opacity: 1;
      }
      @media (hover: none) {
        .row-actions {
          opacity: 1;
        }
        /* No hover to reveal them means they are always on, and always on means they are
           tapped: 32px is under the 44px minimum, and three of them sit side by side. */
        .icon-action {
          inline-size: 44px;
          block-size: 44px;
        }
        .value-side {
          min-block-size: 44px;
        }
      }
      .icon-action {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 32px;
        block-size: 32px;
        font-size: 16px;
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .icon-action:hover:not(:disabled) {
        background: var(--color-surface-row-hover);
        border-color: var(--color-border-default);
        color: var(--color-text-primary);
      }
      .icon-action.danger:hover:not(:disabled) {
        background: var(--color-error-bg);
        border-color: var(--color-error-bg);
        color: var(--color-error);
      }
      .icon-action:disabled {
        color: var(--color-text-disabled);
        cursor: not-allowed;
      }
      .icon-action:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-8) var(--space-5);
        text-align: center;
        background: var(--color-surface-default);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-lg);
      }
      .empty [nz-icon] {
        font-size: 32px;
        color: var(--color-border-strong);
      }
      .empty-title {
        margin: 0;
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .empty-text {
        margin: 0;
        max-inline-size: 46ch;
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
      }
      /* One column below the cell's own minimum — auto-fill already does this, but the
         padding is worth trimming once a cell is the whole width. */
      @media (max-width: 480px) {
        .values {
          grid-template-columns: 1fr;
        }
        .value {
          padding: var(--space-3);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .value,
        .icon-action,
        .row-actions {
          transition: none;
        }
        .value:hover,
        .value:focus-within {
          transform: none;
        }
      }
    `,
  ],
})
export class LookupValueListComponent {
  readonly rows = input.required<readonly EnumerationRow[]>();
  /**
   * The rows of the list these values are FILED UNDER, when their type has one.
   *
   * Passed in rather than fetched: the page already holds every type's rows, and a second
   * fetch here would let the two lists disagree about which classes are live.
   */
  /**
   * Whether the server will entertain a hard delete of this type at all.
   *
   * A delete is only possible where every reader can be counted, and no enumeration key
   * carries a foreign key — so for a compound or a compound class the answer is always 422.
   * The button used to render anyway, which taught the operator that Delete is broken rather
   * than that this type is retired by deactivating it.
   */
  readonly deletable = input<boolean>(true);
  readonly parents = input<readonly EnumerationRow[]>([]);

  readonly edit = output<EnumerationRow>();
  readonly toggleActive = output<LookupActiveToggle>();
  /** Hard delete — the row is gone, not parked. The server refuses one still in use. */
  readonly remove = output<EnumerationRow>();

  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /**
   * The label in the operator's own locale.
   *
   * This list rendered `labelEn` unconditionally, so an Arabic operator read their own
   * values in English — recorded as found-not-fixed twice. The filter has always searched
   * both, so only the rendering was ever one-sided.
   */
  protected labelOf(row: EnumerationRow): string {
    return (this.isAr ? row.labelAr : row.labelEn) || row.labelEn;
  }

  /** Whether this type is filed under another list at all. */
  protected readonly showsParent = computed(() => this.parents().length > 0);

  /**
   * The accent for the class a value is filed under — strongest at the top tier, faintest at
   * the bottom, exactly as the class board derives it from the same `sortOrder`-ordered list.
   *
   * What a class PAYS is per bank, so a figure here would be a lie the moment a second bank
   * configures the product; the ORDER is the platform's own and is always true. A value filed
   * under a class the live list no longer holds takes the warning accent — it quotes nothing,
   * and that is the one class state worth colouring differently rather than faintly.
   */
  protected accentFor(key: string | null | undefined): string {
    const classes = this.parents();
    if (!key || classes.length === 0) return 'var(--color-border-strong)';
    const index = classes.findIndex((p) => p.key === key);
    if (index < 0) return 'var(--color-warning)';
    // A WIDER descent than the class board's, and for a reason the board does not have: it
    // tints one panel at a time, where a shallow scale is enough to say "this tier is high".
    // Here eight dots sit side by side, and on the real compound list 65 of the 71 are the
    // bottom tier — at the board's slope every one of them still read as brand blue, so the
    // scale said nothing. Bottom rank lands on the neutral, top rank on the full accent.
    const last = Math.max(1, classes.length - 1);
    const strength = Math.round(100 - (index / last) * 80);
    return `color-mix(in srgb, var(--color-brand-primary) ${strength}%, var(--color-text-tertiary))`;
  }

  protected parentLabel(key: string): string {
    // The KEY when the class is not in the live list — a value filed under a retired class
    // quotes nothing, and blanking the badge would hide exactly that.
    const row = this.parents().find((p) => p.key === key);
    return row ? this.labelOf(row) : key;
  }

  protected readonly filter = new FormControl<string>('', { nonNullable: true });
  protected readonly query = toSignal(this.filter.valueChanges, { initialValue: '' });

  /** Live rows, deprecated rows and the counts behind the toolbar summary. */
  protected readonly view = computed(() => {
    const q = this.query().trim().toLowerCase();
    const matches = (r: EnumerationRow): boolean =>
      !q ||
      r.labelEn.toLowerCase().includes(q) ||
      r.labelAr.toLowerCase().includes(q) ||
      r.key.toLowerCase().includes(q);
    const hits = this.rows().filter(matches);
    const live = hits.filter((r) => !r.deprecatedAt);
    return {
      live,
      deprecated: hits.filter((r) => !!r.deprecatedAt),
      active: live.filter((r) => r.active).length,
      inactive: live.filter((r) => !r.active).length,
    };
  });

  /**
   * The list split by the class each value is filed under.
   *
   * Warn groups first — a value in no class, and a value under a class that has been
   * retired, are the only rows on this screen that quote nothing, so they are the rows
   * worth putting first. Live classes then follow in registry order, which is the order the
   * class rail and the class board both use, so the two halves of the product screen agree.
   *
   * Row order INSIDE a group is left exactly as the server sent it: `sortOrder` is the order
   * the customer's own picker offers these values in, and re-sorting the screen alphabetically
   * would quietly stop the screen agreeing with the wizard.
   */
  protected readonly groups = computed(() =>
    groupValues({
      live: this.view().live,
      deprecated: this.view().deprecated,
      parents: this.grouped() ? this.parents() : [],
      labelOf: (row) => this.labelOf(row),
      unfiledLabel: this.unfiledGroupLabel,
      deprecatedLabel: this.deprecatedGroupLabel,
    }),
  );

  /** Whether there is anything to group BY, and enough rows for it to be worth doing. */
  protected readonly grouped = computed(() =>
    shouldGroup({ live: this.view().live, parents: this.parents() }),
  );

  /**
   * The rail. Rendered by the template only past one tab — a single tab is not a choice, it
   * is a heading that costs a click.
   */
  protected readonly tabs = computed(() =>
    valueTabs({
      groups: this.groups(),
      liveCount: this.view().live.length,
      grouped: this.grouped(),
      allLabel: this.allTabLabel,
      countLabel: this.tabCountLabel,
      warnLabel: this.tabWarnLabel,
    }),
  );

  /** Only what the operator has explicitly picked — the answer itself stays derived. */
  private readonly pickedTab = signal<string | null>(null);

  /**
   * Which tab is on stage.
   *
   * Derived through `resolveValueTab` rather than stored, because the rail moves under the
   * operator: filtering empties a class, and a class that matched nothing stops being a tab.
   * The fallback is what turns that into "the search landed somewhere" instead of an empty
   * panel under a tab still lit for rows that are gone.
   */
  protected readonly activeTab = computed(() => resolveValueTab(this.tabs(), this.pickedTab()));

  protected pickTab(id: string): void {
    this.pickedTab.set(id);
  }

  /** The class badge earns its place only where the tab is not already the class. */
  protected readonly showsAll = computed(() => this.activeTab() === GROUP_ALL);
  protected readonly onDeprecated = computed(() => this.activeTab() === GROUP_DEPRECATED);

  /**
   * The rows behind the open tab.
   *
   * The All tab of a SPLIT list is the only one with no group of its own: it is every live
   * row, in the order the server sent them, which is the order the customer's picker offers.
   * Unsplit, the anonymous group IS the All tab, so the lookup finds it and the same
   * expression covers both.
   */
  private readonly activeRows = computed(() => {
    const key = this.activeTab();
    const group = this.groups().find((g) => g.key === key);
    return group ? group.rows : this.view().live;
  });

  /**
   * The page each tab is on.
   *
   * Per TAB, not per list: paging through one class and stepping over to another is one
   * question asked twice, and coming back to a class the operator was halfway through should
   * not start again at the top. `pageSlice` clamps, so a remembered index can never outlive
   * the rows behind it.
   */
  private readonly pages = signal<ReadonlyMap<string, number>>(new Map());

  protected readonly page = computed(() =>
    pageSlice(this.activeRows(), this.pages().get(this.activeTab() ?? '') ?? 1),
  );

  protected setPage(page: number): void {
    const key = this.activeTab();
    if (key === null) return;
    const next = new Map(this.pages());
    next.set(key, page);
    this.pages.set(next);
  }

  /** Read by the pager in the template. */
  protected readonly VALUE_PAGE_SIZE = VALUE_PAGE_SIZE;

  constructor() {
    // The reset that keeps the pager honest. Without it, filtering a 500-row list down to
    // three would leave the operator on the page they were on, which `pageSlice` then clamps
    // to somewhere nobody asked for. Writing a signal from an effect needs saying so out loud:
    // without the flag this threw NG0600 on every screen that renders a values panel — twice
    // on the surrogate product, which renders one panel per list.
    effect(
      () => {
        this.query();
        this.pages.set(new Map());
      },
      { allowSignalWrites: true },
    );

    // The open tab goes with the LIST, not with the component instance. A panel is reused when
    // the operator picks another type on Manage values, and a class key from the previous list
    // would either miss — landing on the first tab, harmless — or, for the three reserved keys,
    // HIT: arriving on "Deprecated" of a list nobody asked about. Deliberately not folded into
    // the effect above: that one also fires on the filter, and typing must not move the
    // operator off the class they were working in.
    effect(
      () => {
        this.rows();
        this.pickedTab.set(null);
        this.pages.set(new Map());
      },
      { allowSignalWrites: true },
    );
  }

  protected readonly countsLabel = computed(() => {
    const v = this.view();
    const parts = [$localize`:@@lookups.count.active:${v.active}:count: active`];
    if (v.inactive > 0)
      parts.push($localize`:@@lookups.count.inactive:${v.inactive}:count: inactive`);
    if (v.deprecated.length > 0) {
      parts.push($localize`:@@lookups.count.deprecated:${v.deprecated.length}:count: deprecated`);
    }
    return parts.join(' · ');
  });

  /**
   * The row is in the accessible name, not only in the tooltip.
   *
   * Seventy-one rows of "Edit / Deactivate / Delete" is the same three names read out
   * seventy-one times, with nothing saying which value is about to be deleted.
   */
  protected editAria(row: EnumerationRow): string {
    return $localize`:@@lookups.edit.aria:Edit ${this.labelOf(row)}:VALUE:`;
  }

  protected activeAria(row: EnumerationRow): string {
    const name = this.labelOf(row);
    return row.active
      ? $localize`:@@lookups.deactivate.aria:Deactivate ${name}:VALUE:`
      : $localize`:@@lookups.activate.aria:Activate ${name}:VALUE:`;
  }

  protected deleteAria(row: EnumerationRow): string {
    return $localize`:@@lookups.delete.aria:Delete ${this.labelOf(row)}:VALUE:`;
  }

  protected readonly allTabLabel = $localize`:@@lookups.tab.all:All`;
  protected readonly tabsAria = $localize`:@@lookups.tabs.aria:Show the values one class at a time`;
  protected readonly tabCountLabel = $localize`:@@lookups.tab.count:values`;
  protected readonly tabWarnLabel = $localize`:@@lookups.tab.warn:No bank can price these`;
  protected readonly pagerAria = $localize`:@@lookups.pager.aria:Pages of values`;
  protected readonly unfiledGroupLabel = $localize`:@@lookups.group.unfiled:In no class`;
  protected readonly deprecatedGroupLabel = $localize`:@@lookups.group.deprecated:Deprecated`;
  protected readonly searchLabel = $localize`:@@lookups.search:Filter values…`;
  protected readonly clearLabel = $localize`:@@lookups.search.clear:Clear filter`;
  protected readonly editLabel = $localize`:@@lookups.edit:Edit`;
  protected readonly deleteLabel = $localize`:@@lookups.delete:Delete`;
  protected readonly activateLabel = $localize`:@@lookups.activate:Activate`;
  protected readonly deactivateLabel = $localize`:@@lookups.deactivate:Deactivate`;
  protected readonly inactiveLabel = $localize`:@@lookups.status.inactive:Inactive`;
  protected readonly deprecatedLabel = $localize`:@@lookups.status.deprecated:Deprecated`;
}
