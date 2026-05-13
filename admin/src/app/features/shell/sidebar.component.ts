import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@core/auth/auth.service';
import { CanDirective } from '../../shared/can.directive';

/**
 * Inline-start nav. Fills the full layout height (flex container in
 * AppComponent). Active state uses a subtle tonal-accent fill + brand-navy
 * inset bar (less aggressive than full primary pill).
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, CanDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar" aria-label="Primary">
      <p class="section-label" i18n="@@sidebar.section.main">Workspace</p>

      <nav class="nav">
        <a routerLink="/dashboard" routerLinkActive="active" class="item">
          <mat-icon class="item-icon" aria-hidden="true">dashboard</mat-icon>
          <span class="item-label" i18n="@@sidebar.dashboard">Dashboard</span>
        </a>

        <a *can="['super_admin']" routerLink="/users" routerLinkActive="active" class="item">
          <mat-icon class="item-icon" aria-hidden="true">group</mat-icon>
          <span class="item-label" i18n="@@sidebar.users">Users</span>
        </a>
      </nav>

      <div class="footer">
        <a class="meta-link" href="https://github.com/anthropics/masrafy01" target="_blank" rel="noopener">
          <mat-icon class="meta-icon" aria-hidden="true">menu_book</mat-icon>
          <span i18n="@@sidebar.runbook">Runbook</span>
        </a>
        <span class="version" aria-label="Version">v0.1.0</span>
      </div>
    </aside>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        flex-shrink: 0;
      }
      .sidebar {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: var(--space-1);
        padding-block: var(--space-4) var(--space-3);
        padding-inline: var(--space-3);
        background: var(--color-surface-default);
        border-inline-end: 1px solid var(--color-border-default);
        min-width: var(--sidebar-width);
        transition: min-width var(--motion-duration-base) var(--motion-easing-standard);
      }
      .section-label {
        margin: 0 0 var(--space-2);
        padding-inline: var(--space-2);
        font-size: 11px;
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.10em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }
      .item {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
        padding-block: 10px;
        padding-inline: var(--space-3);
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        line-height: 1;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .item-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: currentColor;
        opacity: 0.85;
        flex-shrink: 0;
      }
      .item:hover {
        background: var(--color-surface-row-hover);
        color: var(--color-text-primary);
      }
      .item.active {
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        font-weight: var(--font-weight-semibold);
      }
      .item.active::before {
        content: '';
        position: absolute;
        inset-block: 6px;
        inset-inline-start: 0;
        width: 3px;
        border-radius: var(--radius-pill);
        background: var(--color-brand-primary);
      }
      .item.active .item-icon {
        opacity: 1;
      }
      // Footer
      .footer {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--color-border-default);
      }
      .meta-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding-block: var(--space-2);
        padding-inline: var(--space-3);
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        text-decoration: none;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .meta-link:hover {
        background: var(--color-surface-row-hover);
        color: var(--color-text-primary);
        text-decoration: none;
      }
      .meta-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        opacity: 0.8;
      }
      .version {
        padding-inline: var(--space-3);
        font-size: 11px;
        color: var(--color-text-tertiary);
        letter-spacing: 0.04em;
      }
      // Collapsed rail at 1024px
      @media (max-width: 1024px) {
        .sidebar {
          min-width: var(--sidebar-width-collapsed);
          padding-inline: var(--space-2);
        }
        .section-label,
        .item-label,
        .meta-link span,
        .version {
          display: none;
        }
        .item,
        .meta-link {
          justify-content: center;
          padding-inline: var(--space-2);
        }
      }
      @media (max-width: 768px) {
        :host {
          display: none;
        }
      }
    `,
  ],
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);
}
