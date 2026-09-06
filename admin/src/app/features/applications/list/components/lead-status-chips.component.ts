import { ChangeDetectionStrategy, Component, EventEmitter, Output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LEAD_STATUS_VALUES, leadStatusMeta, type LeadStatus } from '../../shared/lead-status';

/** The chip that is on, or `null` for "no filter". */
export type LeadStatusFilter = LeadStatus | null;

/** How many loaded rows sit at each stage. Absent keys read as 0. */
export type LeadStatusCounts = Partial<Record<LeadStatus, number>>;

/**
 * Filter chips over the sales-pipeline stage of a lead. Single-select, and
 * clicking the live chip clears the filter.
 *
 * The chips are a `@for` over `LEAD_STATUS_VALUES` rather than one block per
 * stage: the stage list and its labels already have exactly one authority in
 * `lead-status.ts`, and a hand-written chip per value is a second place for a
 * new stage to be forgotten.
 */
@Component({
  selector: 'app-lead-status-chips',
  standalone: true,
  imports: [CommonModule, NzTagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chip-set" role="listbox" [attr.aria-label]="ariaLabel">
      @for (status of statuses; track status) {
        <nz-tag
          class="chip"
          [class.selected]="selected() === status"
          nzMode="checkable"
          [nzChecked]="selected() === status"
          (nzCheckedChange)="toggle(status)"
          role="option"
          [attr.aria-selected]="selected() === status"
          tabindex="0"
        >
          @if (selected() === status) {
            <span class="dot" aria-hidden="true">●</span>
          }
          <span>{{ label(status) }}</span>
          <span class="count">· {{ counts()?.[status] ?? 0 }}</span>
        </nz-tag>
      }
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
export class LeadStatusChipsComponent {
  readonly selected = input<LeadStatusFilter>(null);
  readonly counts = input<LeadStatusCounts | null>(null);

  protected readonly statuses = LEAD_STATUS_VALUES;
  protected readonly ariaLabel = $localize`:@@apps.lead.filter.aria:Filter leads by workflow stage`;

  @Output() readonly filterChange = new EventEmitter<LeadStatusFilter>();

  protected label(status: LeadStatus): string {
    return leadStatusMeta(status).label;
  }

  protected toggle(next: LeadStatus): void {
    this.filterChange.emit(this.selected() === next ? null : next);
  }
}
