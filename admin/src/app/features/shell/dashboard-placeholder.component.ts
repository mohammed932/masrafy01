import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@core/auth/auth.service';
import type { StaffRole } from '@core/auth/auth.types';
import { RemindersWidgetComponent } from './reminders-widget.component';

interface QuickAction {
  icon: string;
  title: string;
  description: string;
  action: () => void;
  roles?: ReadonlyArray<StaffRole>;
}

/**
 * Post-login landing. Welcomes the signed-in user, surfaces role-aware
 * quick actions, sets the tone for the rest of the dashboard. Replaced
 * when domain-specific dashboard widgets ship.
 */
@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RemindersWidgetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dashboard">
      <header class="hero">
        <div class="hero-text">
          <p class="kicker">{{ kicker() }}</p>
          <h1 class="title">{{ greeting() }}</h1>
          <p class="subtitle">{{ subtitle() }}</p>
        </div>
      </header>

      @if (showReminders()) {
        <app-reminders-widget />
      }

      <section class="cards" aria-label="Quick actions">
        @for (a of availableActions(); track a.title) {
          <button type="button" class="card" (click)="a.action()">
            <span class="card-icon" aria-hidden="true">
              <mat-icon>{{ a.icon }}</mat-icon>
            </span>
            <span class="card-body">
              <span class="card-title">{{ a.title }}</span>
              <span class="card-desc">{{ a.description }}</span>
            </span>
            <mat-icon class="card-chevron" aria-hidden="true">chevron_right</mat-icon>
          </button>
        }
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .dashboard {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        max-width: var(--content-max-width);
        margin-inline: auto;
        padding-block: var(--space-3);
        animation: rise var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .dashboard {
          animation: none;
        }
      }
      .hero {
        padding: var(--space-7) var(--space-7);
        background:
          radial-gradient(
            circle at 88% -20%,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0) 55%
          ),
          var(--color-brand-primary);
        color: var(--color-text-on-brand);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
        position: relative;
        overflow: hidden;
      }
      .kicker {
        margin: 0 0 var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.75;
      }
      .title {
        margin: 0 0 var(--space-3);
        font-size: var(--text-3xl);
        font-weight: var(--font-weight-bold);
        line-height: var(--line-height-tight);
        max-width: 720px;
      }
      .subtitle {
        margin: 0;
        font-size: var(--text-md);
        line-height: var(--line-height-base);
        max-width: 640px;
        opacity: 0.86;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-4);
      }
      .card {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-5);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        cursor: pointer;
        text-align: start;
        color: var(--color-text-primary);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover {
        border-color: var(--color-brand-primary);
        box-shadow: var(--shadow-md);
        transform: translateY(-1px);
      }
      .card:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .card-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: var(--radius-md);
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        flex-shrink: 0;
      }
      .card-icon mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
      .card-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }
      .card-title {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .card-desc {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .card-chevron {
        color: var(--color-text-tertiary);
        flex-shrink: 0;
        transition:
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover .card-chevron {
        color: var(--color-brand-primary);
        transform: translateX(2px);
      }
      [dir='rtl'] .card-chevron {
        transform: scaleX(-1);
      }
      [dir='rtl'] .card:hover .card-chevron {
        transform: translateX(-2px) scaleX(-1);
      }
    `,
  ],
})
export class DashboardPlaceholderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly kicker = computed(() => {
    const role = this.auth.role();
    if (role === 'super_admin') return $localize`:@@dash.kicker.super:Super-admin console`;
    if (role === 'sales_manager') return $localize`:@@dash.kicker.manager:Sales manager console`;
    if (role === 'sales_agent') return $localize`:@@dash.kicker.agent:Sales agent console`;
    return $localize`:@@dash.kicker.analyst:Analyst console`;
  });

  protected readonly greeting = computed(() => {
    const name = this.auth.currentUser()?.name ?? '';
    const firstName = name.split(/\s+/)[0] ?? '';
    return firstName
      ? $localize`:@@dash.greeting:Welcome back, ${firstName}.`
      : $localize`:@@dash.greetingAnon:Welcome to Masrafy.`;
  });

  protected readonly subtitle = computed(
    () =>
      $localize`:@@dash.subtitle:Operational overview lands here as features ship. Use the quick actions below to start.`,
  );

  protected readonly showReminders = computed(() => {
    const role = this.auth.role();
    return role === 'sales_agent' || role === 'sales_manager' || role === 'super_admin';
  });

  private readonly allActions: ReadonlyArray<QuickAction> = [
    {
      icon: 'group',
      title: $localize`:@@dash.action.manageUsers:Manage staff`,
      description: $localize`:@@dash.action.manageUsersDesc:Create, edit, or deactivate sales managers, sales agents, and analysts.`,
      action: () => this.router.navigateByUrl('/users'),
      roles: ['super_admin'],
    },
    {
      icon: 'lock_reset',
      title: $localize`:@@dash.action.changePassword:Change my password`,
      description: $localize`:@@dash.action.changePasswordDesc:Rotate your password without leaving the dashboard.`,
      action: () => this.router.navigateByUrl('/auth/self-password'),
    },
    {
      icon: 'help_outline',
      title: $localize`:@@dash.action.docs:Read the runbook`,
      description: $localize`:@@dash.action.docsDesc:Onboarding, role permissions, and operational procedures.`,
      action: () => window.open('https://github.com/anthropics/masrafy01', '_blank'),
    },
  ];

  protected readonly availableActions = computed<ReadonlyArray<QuickAction>>(() => {
    const role = this.auth.role();
    return this.allActions.filter((a) => !a.roles || (role !== null && a.roles.includes(role)));
  });
}
