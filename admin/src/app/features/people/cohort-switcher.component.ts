import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { TeamOutline, IdcardOutline } from '@ant-design/icons-angular/icons';
import type { Cohort } from './people.cohort';

/**
 * Segmented cohort switcher for the People directory. Each segment is a real
 * route link (`/people/staff`, `/people/customers`) so the cohort is
 * deep-linkable and the browser Back button works — no fake tab semantics.
 *
 * The badge carries the row count for the CURRENT search, which is what makes
 * one search box cover both cohorts: typing re-labels both segments, so hits
 * hiding in the cohort you are not looking at stay visible.
 */
@Component({
  selector: 'app-cohort-switcher',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NzIconModule],
  providers: [provideNzIconsPatch([TeamOutline, IdcardOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="switch" [attr.aria-label]="ariaLabel">
      @for (c of cohorts(); track c) {
        <a
          class="seg"
          [routerLink]="['/people', c]"
          routerLinkActive="is-active"
          #rla="routerLinkActive"
          [attr.aria-current]="rla.isActive ? 'page' : null"
        >
          <span
            nz-icon
            [nzType]="icon(c)"
            nzTheme="outline"
            class="seg-icon"
            aria-hidden="true"
          ></span>
          <span class="seg-label">{{ label(c) }}</span>
          <span class="seg-count" [class.is-pending]="counts()[c] === null">{{
            countLabel(c)
          }}</span>
        </a>
      }
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .switch {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
      }
      .seg {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: 40px;
        padding-block: var(--space-2);
        padding-inline: var(--space-4);
        border-radius: var(--radius-pill);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        line-height: 1;
        text-decoration: none;
        white-space: nowrap;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .seg:hover:not(.is-active) {
        color: var(--color-text-primary);
        text-decoration: none;
      }
      .seg:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
      }
      .seg.is-active {
        background: var(--color-surface-default);
        color: var(--color-brand-primary);
        font-weight: var(--font-weight-semibold);
        box-shadow: var(--shadow-sm);
      }
      .seg-icon {
        font-size: 16px;
        opacity: 0.9;
      }
      .seg-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-inline-size: 22px;
        padding-inline: var(--space-2);
        padding-block: 2px;
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--color-text-tertiary) 14%, transparent);
        color: var(--color-text-secondary);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        font-variant-numeric: tabular-nums;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .seg.is-active .seg-count {
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
      }
      .seg-count.is-pending {
        color: var(--color-text-tertiary);
      }
      @media (max-width: 720px) {
        .switch {
          inline-size: 100%;
        }
        .seg {
          flex: 1;
          justify-content: center;
          min-block-size: 44px;
          padding-inline: var(--space-3);
        }
      }
    `,
  ],
})
export class CohortSwitcherComponent {
  readonly cohorts = input.required<readonly Cohort[]>();
  readonly counts = input.required<Readonly<Record<Cohort, number | null>>>();

  protected readonly ariaLabel = $localize`:@@people.cohort.aria:People cohort`;
  private readonly staffLabel = $localize`:@@people.cohort.staff:Staff`;
  private readonly customersLabel = $localize`:@@people.cohort.customers:Customers`;

  protected label(cohort: Cohort): string {
    return cohort === 'staff' ? this.staffLabel : this.customersLabel;
  }

  protected icon(cohort: Cohort): string {
    return cohort === 'staff' ? 'team' : 'idcard';
  }

  /** Em dash while the count for the current query is still in flight. */
  protected countLabel(cohort: Cohort): string {
    const n = this.counts()[cohort];
    return n === null ? '—' : String(n);
  }
}
