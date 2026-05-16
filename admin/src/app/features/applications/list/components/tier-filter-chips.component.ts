import { ChangeDetectionStrategy, Component, EventEmitter, Output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTagModule } from 'ng-zorro-antd/tag';

export type TierFilter = 'high' | 'medium' | 'needs_coaching' | null;

export interface TierFilterCounts {
  high: number;
  medium: number;
  needs_coaching: number;
}

/**
 * Three filter chips aligned to the tier-bucket table. Single-select.
 * See specs/004-approval-probability-display/design/promax-list-pill.md.
 */
@Component({
  selector: 'app-tier-filter-chips',
  standalone: true,
  imports: [CommonModule, NzTagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chip-set" role="listbox" [attr.aria-label]="ariaLabel">
      <nz-tag
        class="chip"
        [class.selected]="selected() === 'high'"
        nzMode="checkable"
        [nzChecked]="selected() === 'high'"
        (nzCheckedChange)="toggle('high')"
        role="option"
        [attr.aria-selected]="selected() === 'high'"
        tabindex="0"
      >
        @if (selected() === 'high') {
          <span class="dot" aria-hidden="true">●</span>
        }
        <span i18n="@@applications.filter.tier.high">High probability leads</span>
        <span class="count">· {{ counts()?.high ?? 0 }}</span>
      </nz-tag>
      <nz-tag
        class="chip"
        [class.selected]="selected() === 'medium'"
        nzMode="checkable"
        [nzChecked]="selected() === 'medium'"
        (nzCheckedChange)="toggle('medium')"
        role="option"
        [attr.aria-selected]="selected() === 'medium'"
        tabindex="0"
      >
        @if (selected() === 'medium') {
          <span class="dot" aria-hidden="true">●</span>
        }
        <span i18n="@@applications.filter.tier.medium">Medium probability</span>
        <span class="count">· {{ counts()?.medium ?? 0 }}</span>
      </nz-tag>
      <nz-tag
        class="chip"
        [class.selected]="selected() === 'needs_coaching'"
        nzMode="checkable"
        [nzChecked]="selected() === 'needs_coaching'"
        (nzCheckedChange)="toggle('needs_coaching')"
        role="option"
        [attr.aria-selected]="selected() === 'needs_coaching'"
        tabindex="0"
      >
        @if (selected() === 'needs_coaching') {
          <span class="dot" aria-hidden="true">●</span>
        }
        <span i18n="@@applications.filter.tier.needs_coaching">Needs coaching</span>
        <span class="count">· {{ counts()?.needs_coaching ?? 0 }}</span>
      </nz-tag>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .chip-set {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .chip {
        cursor: pointer;
        transition:
          background-color 120ms cubic-bezier(0.4, 0, 0.2, 1),
          color 120ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .chip.selected {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
        font-weight: var(--font-weight-semibold);
      }
      .dot {
        margin-inline-end: 6px;
      }
      .count {
        margin-inline-start: 4px;
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-tertiary);
      }
      .chip.selected .count {
        color: inherit;
      }
      @media (prefers-reduced-motion: reduce) {
        .chip {
          transition: none;
        }
      }
    `,
  ],
})
export class TierFilterChipsComponent {
  readonly selected = input<TierFilter>(null);
  readonly counts = input<TierFilterCounts | null>(null);
  protected readonly ariaLabel = $localize`:@@applications.filter.tier.aria:Filter applications by approval probability`;

  @Output() readonly filterChange = new EventEmitter<TierFilter>();

  protected toggle(next: 'high' | 'medium' | 'needs_coaching'): void {
    this.filterChange.emit(this.selected() === next ? null : next);
  }
}
