import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import type { LookupType } from '../lookups.constants';

/** One rail tile: the type meta plus its live counts from the API summary. */
export interface LookupTypeCard extends LookupType {
  readonly active: number;
  readonly deprecated: number;
}

/**
 * Category rail — presentational. Renders one tile per lookup type and reports
 * the picked type; all loading / fetching lives in the page.
 */
@Component({
  selector: 'app-lookup-type-rail',
  standalone: true,
  imports: [NzIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="rail" [attr.aria-label]="ariaLabel">
      @for (t of cards(); track t.type) {
        <button
          type="button"
          class="tile"
          [class.selected]="selected() === t.type"
          [attr.aria-current]="selected() === t.type ? 'true' : null"
          (click)="select.emit(t.type)"
        >
          <span class="tile-icon" aria-hidden="true">
            <span nz-icon [nzType]="t.icon" nzTheme="outline"></span>
          </span>
          <span class="tile-name">{{ t.label }}</span>
          <span class="tile-counts">
            <span class="count-active">{{ activeCountLabel(t.active) }}</span>
            @if (t.deprecated > 0) {
              <span class="count-deprecated">
                <span nz-icon nzType="history" nzTheme="outline" aria-hidden="true"></span>
                {{ t.deprecated }}
              </span>
            }
          </span>
        </button>
      }
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .rail {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-3);
      }
      .tile {
        appearance: none;
        position: relative;
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) auto;
        gap: var(--space-3);
        align-items: center;
        min-block-size: 68px;
        padding: var(--space-3) var(--space-4);
        text-align: start;
        cursor: pointer;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .tile::before {
        content: '';
        position: absolute;
        inset-inline-start: 0;
        inset-block: 12px;
        inline-size: 3px;
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        background: transparent;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .tile:hover {
        border-color: var(--color-tonal-accent);
        box-shadow: var(--shadow-sm);
        transform: translateY(-1px);
      }
      .tile:active {
        transform: translateY(0);
      }
      .tile:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .tile.selected {
        border-color: var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
      }
      .tile.selected::before {
        background: var(--color-brand-primary);
      }
      .tile-icon {
        inline-size: 36px;
        block-size: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
        color: var(--color-tonal-accent);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .tile.selected .tile-icon {
        background: var(--color-surface-default);
        color: var(--color-brand-primary);
      }
      /* Wraps instead of truncating: "Salary categories" and "Required documents"
         are the whole point of the tile — an ellipsis hides the word that tells
         them apart. Two lines fit inside the 68px tile floor. */
      .tile-name {
        min-inline-size: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .tile-counts {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .count-active {
        padding: 2px 10px;
        border-radius: var(--radius-pill);
        background: var(--color-success-bg);
        color: var(--color-success);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        white-space: nowrap;
      }
      .count-deprecated {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      @media (prefers-reduced-motion: reduce) {
        .tile,
        .tile::before,
        .tile-icon {
          transition: none;
        }
        .tile:hover {
          transform: none;
        }
      }
    `,
  ],
})
export class LookupTypeRailComponent {
  readonly cards = input.required<readonly LookupTypeCard[]>();
  readonly selected = input<string | null>(null);
  readonly select = output<string>();

  protected readonly ariaLabel = $localize`:@@lookups.rail.aria:Lookup categories`;

  protected activeCountLabel(n: number): string {
    return $localize`:@@lookups.rail.activeCount:${n}:count: active`;
  }
}
