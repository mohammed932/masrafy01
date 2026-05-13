import { ChangeDetectionStrategy, Component, EventEmitter, Output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';

export type LeadFilter =
  | 'needs_first_contact'
  | 'stale'
  | 'recent'
  | 'followup_today'
  | 'docs_in_progress'
  | 'ready_for_submission'
  | 'submitted_to_bank'
  | null;

export interface LeadFilterCounts {
  needs_first_contact: number;
  stale: number;
  recent: number;
  followup_today: number;
  docs_in_progress: number;
  ready_for_submission: number;
  submitted_to_bank: number;
}

@Component({
  selector: 'app-lead-filter-chips',
  standalone: true,
  imports: [CommonModule, MatChipsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-chip-set role="listbox" [attr.aria-label]="ariaLabel">
      <mat-chip
        [class.selected]="selected() === 'needs_first_contact'"
        (click)="toggle('needs_first_contact')"
        (keyup.enter)="toggle('needs_first_contact')"
        role="option"
        [attr.aria-selected]="selected() === 'needs_first_contact'"
        tabindex="0"
      >
        <span i18n="@@apps.lead.filter.needsFirstContact">Needs first contact</span>
        <span class="count">· {{ counts()?.needs_first_contact ?? 0 }}</span>
      </mat-chip>
      <mat-chip
        [class.selected]="selected() === 'stale'"
        (click)="toggle('stale')"
        (keyup.enter)="toggle('stale')"
        role="option"
        [attr.aria-selected]="selected() === 'stale'"
        tabindex="0"
      >
        <span i18n="@@apps.lead.filter.stale">Stale</span>
        <span class="count">· {{ counts()?.stale ?? 0 }}</span>
      </mat-chip>
      <mat-chip
        [class.selected]="selected() === 'recent'"
        (click)="toggle('recent')"
        (keyup.enter)="toggle('recent')"
        role="option"
        [attr.aria-selected]="selected() === 'recent'"
        tabindex="0"
      >
        <span i18n="@@apps.lead.filter.recent">Recently contacted</span>
        <span class="count">· {{ counts()?.recent ?? 0 }}</span>
      </mat-chip>
      <mat-chip
        [class.selected]="selected() === 'followup_today'"
        (click)="toggle('followup_today')"
        (keyup.enter)="toggle('followup_today')"
        role="option"
        [attr.aria-selected]="selected() === 'followup_today'"
        tabindex="0"
      >
        <span i18n="@@apps.lead.filter.followupToday">Follow-up today</span>
        <span class="count">· {{ counts()?.followup_today ?? 0 }}</span>
      </mat-chip>
      <mat-chip
        [class.selected]="selected() === 'docs_in_progress'"
        (click)="toggle('docs_in_progress')"
        (keyup.enter)="toggle('docs_in_progress')"
        role="option"
        [attr.aria-selected]="selected() === 'docs_in_progress'"
        tabindex="0"
      >
        <span i18n="@@apps.lead.filter.docsInProgress">Document collection</span>
        <span class="count">· {{ counts()?.docs_in_progress ?? 0 }}</span>
      </mat-chip>
      <mat-chip
        [class.selected]="selected() === 'ready_for_submission'"
        (click)="toggle('ready_for_submission')"
        (keyup.enter)="toggle('ready_for_submission')"
        role="option"
        [attr.aria-selected]="selected() === 'ready_for_submission'"
        tabindex="0"
      >
        <span i18n="@@apps.lead.filter.readyForBank">Ready for bank</span>
        <span class="count">· {{ counts()?.ready_for_submission ?? 0 }}</span>
      </mat-chip>
      <mat-chip
        [class.selected]="selected() === 'submitted_to_bank'"
        (click)="toggle('submitted_to_bank')"
        (keyup.enter)="toggle('submitted_to_bank')"
        role="option"
        [attr.aria-selected]="selected() === 'submitted_to_bank'"
        tabindex="0"
      >
        <span i18n="@@apps.lead.filter.submittedToBank">Submitted to bank</span>
        <span class="count">· {{ counts()?.submitted_to_bank ?? 0 }}</span>
      </mat-chip>
    </mat-chip-set>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      mat-chip {
        cursor: pointer;
        transition:
          background-color 120ms cubic-bezier(0.4, 0, 0.2, 1),
          color 120ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      mat-chip.selected {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
        font-weight: var(--font-weight-semibold);
      }
      .count {
        margin-inline-start: 4px;
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-tertiary);
      }
      mat-chip.selected .count {
        color: inherit;
      }
      @media (prefers-reduced-motion: reduce) {
        mat-chip {
          transition: none;
        }
      }
    `,
  ],
})
export class LeadFilterChipsComponent {
  readonly selected = input<LeadFilter>(null);
  readonly counts = input<LeadFilterCounts | null>(null);
  protected readonly ariaLabel = $localize`:@@apps.lead.filter.aria:Filter leads by workflow stage`;

  @Output() readonly filterChange = new EventEmitter<LeadFilter>();

  protected toggle(
    next:
      | 'needs_first_contact'
      | 'stale'
      | 'recent'
      | 'followup_today'
      | 'docs_in_progress'
      | 'ready_for_submission'
      | 'submitted_to_bank',
  ): void {
    this.filterChange.emit(this.selected() === next ? null : next);
  }
}
