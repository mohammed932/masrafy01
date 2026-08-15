import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import type { EnumerationRow } from '../lookups.api.service';

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
  imports: [ReactiveFormsModule, NzIconModule, NzInputModule, NzToolTipModule, NzPopconfirmModule],
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
      <ul class="values" role="list">
        @for (r of view().live; track r.id) {
          <li class="value" [class.inactive]="!r.active">
            <div class="value-main">
              <span class="labels">
                <span class="label-en">{{ r.labelEn }}</span>
              </span>
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
              <span class="status" [class.off]="!r.active">
                {{ r.active ? activeLabel : inactiveLabel }}
              </span>
              <div class="row-actions">
                <button
                  class="icon-action"
                  type="button"
                  (click)="edit.emit(r)"
                  nz-tooltip
                  [nzTooltipTitle]="editLabel"
                  [attr.aria-label]="editLabel"
                >
                  <span nz-icon nzType="edit" nzTheme="outline"></span>
                </button>
                <button
                  class="icon-action"
                  type="button"
                  [disabled]="r.systemOnly"
                  (click)="toggleActive.emit({ row: r, next: !r.active })"
                  nz-tooltip
                  [nzTooltipTitle]="r.active ? deactivateLabel : activateLabel"
                  [attr.aria-label]="r.active ? deactivateLabel : activateLabel"
                >
                  <span nz-icon nzType="poweroff" nzTheme="outline"></span>
                </button>
                <!-- Two ways out, not three. Deactivate parks a value something
                     already uses (reversible, keeps every saved reference working);
                     delete removes one nothing uses. Deprecate was a third state that
                     did what deactivate does and could never be undone from here, so
                     the board no longer offers it — existing deprecated rows still
                     render below, they just cannot be created any more. -->
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
                  [attr.aria-label]="deleteLabel"
                >
                  <span nz-icon nzType="delete" nzTheme="outline"></span>
                </button>
              </div>
            </div>
          </li>
        }

        @if (view().deprecated.length > 0) {
          <li class="divider" aria-hidden="true">
            <span nz-icon nzType="history" nzTheme="outline"></span>
            <span i18n="@@lookups.deprecated">Deprecated</span>
          </li>
          @for (r of view().deprecated; track r.id) {
            <li class="value deprecated">
              <div class="value-main">
                <span class="labels">
                  <span class="label-en">{{ r.labelEn }}</span>
                </span>
              </div>
              <div class="value-side">
                <span class="status dep">{{ deprecatedLabel }}</span>
                <div class="row-actions">
                  <button
                    class="icon-action"
                    type="button"
                    (click)="edit.emit(r)"
                    nz-tooltip
                    [nzTooltipTitle]="editLabel"
                    [attr.aria-label]="editLabel"
                  >
                    <span nz-icon nzType="edit" nzTheme="outline"></span>
                  </button>
                  <!-- The tombstone case: deprecating was the safe move at the time,
                       and once the last reference is gone the row is pure noise. -->
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
                    [attr.aria-label]="deleteLabel"
                  >
                    <span nz-icon nzType="delete" nzTheme="outline"></span>
                  </button>
                </div>
              </div>
            </li>
          }
        }
      </ul>
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
      .counts {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .values {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .value {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .value:hover {
        border-color: var(--color-tonal-accent);
        box-shadow: var(--shadow-sm);
      }
      .value.inactive .label-en,
      .value.deprecated .label-en {
        color: var(--color-text-tertiary);
      }
      .value.deprecated {
        background: var(--color-surface-elevated);
      }
      .value-main {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
        min-inline-size: 0;
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
      .value-side {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
      }
      .status {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-success);
        white-space: nowrap;
      }
      .status.off {
        color: var(--color-text-tertiary);
      }
      .status.dep {
        color: var(--color-warning);
      }
      .row-actions {
        display: inline-flex;
        align-items: center;
        gap: 2px;
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
      .divider {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: var(--space-3) 0 var(--space-1);
        padding-inline: var(--space-2);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
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
      @media (max-width: 640px) {
        .value {
          align-items: flex-start;
          flex-direction: column;
          gap: var(--space-3);
        }
        .value-side {
          inline-size: 100%;
          justify-content: space-between;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .value,
        .icon-action {
          transition: none;
        }
      }
    `,
  ],
})
export class LookupValueListComponent {
  readonly rows = input.required<readonly EnumerationRow[]>();

  readonly edit = output<EnumerationRow>();
  readonly toggleActive = output<LookupActiveToggle>();
  /** Hard delete — the row is gone, not parked. The server refuses one still in use. */
  readonly remove = output<EnumerationRow>();

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

  protected readonly searchLabel = $localize`:@@lookups.search:Filter values…`;
  protected readonly clearLabel = $localize`:@@lookups.search.clear:Clear filter`;
  protected readonly editLabel = $localize`:@@lookups.edit:Edit`;
  protected readonly deleteLabel = $localize`:@@lookups.delete:Delete`;
  protected readonly activateLabel = $localize`:@@lookups.activate:Activate`;
  protected readonly deactivateLabel = $localize`:@@lookups.deactivate:Deactivate`;
  protected readonly activeLabel = $localize`:@@lookups.status.active:Active`;
  protected readonly inactiveLabel = $localize`:@@lookups.status.inactive:Inactive`;
  protected readonly deprecatedLabel = $localize`:@@lookups.status.deprecated:Deprecated`;
}
