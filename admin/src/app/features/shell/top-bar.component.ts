import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top-bar" role="banner">
      <a class="brand" routerLink="/dashboard" aria-label="Masrafy — go to dashboard">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" focusable="false">
            <rect x="0" y="0" width="28" height="28" rx="7" fill="currentColor" opacity="0.16" />
            <path
              d="M5.5 22V8h3.4l4.6 8.2L18.1 8h3.4v14h-3V13.4l-3.6 6.4h-2L9.5 13.4V22z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span class="brand-text" i18n="@@topBar.brand">Masrafy</span>
      </a>

      @if (auth.currentUser(); as user) {
        <button
          type="button"
          [matMenuTriggerFor]="userMenu"
          class="user-trigger"
          [attr.aria-label]="userAriaLabel(user.name, user.role)"
        >
          <span class="avatar" aria-hidden="true">
            <span class="avatar-text">{{ initials(user.name) }}</span>
            <span class="online-dot" aria-hidden="true"></span>
          </span>
          <span class="user-name" [attr.title]="user.name">{{ firstName(user.name) }}</span>
          <span class="user-divider" aria-hidden="true"></span>
          <span class="role-chip" [attr.data-role]="user.role">{{ roleLabel(user.role) }}</span>
          <mat-icon class="chevron" aria-hidden="true">expand_more</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu">
          <a mat-menu-item routerLink="/auth/self-password" i18n="@@topBar.changePassword">
            Change password
          </a>
          <button mat-menu-item type="button" (click)="logout()" i18n="@@topBar.signOut">
            Sign out
          </button>
        </mat-menu>
      }
    </header>
  `,
  styles: [
    `
      .top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-block: var(--space-2);
        padding-inline: var(--space-5);
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        box-shadow: var(--shadow-sm);
        min-height: var(--topbar-height);
        position: sticky;
        inset-block-start: 0;
        z-index: 20;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
        color: var(--color-text-on-brand);
        text-decoration: none;
        font-weight: var(--font-weight-bold);
        font-size: var(--text-lg);
        letter-spacing: -0.01em;
        padding-block: var(--space-1);
        padding-inline: var(--space-2);
        border-radius: var(--radius-md);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .brand:hover {
        background: rgba(255, 255, 255, 0.06);
        text-decoration: none;
      }
      .brand-mark {
        display: inline-flex;
        width: 32px;
        height: 32px;
        color: var(--color-text-on-brand);
      }
      .brand-mark svg {
        width: 100%;
        height: 100%;
      }
      .brand-text {
        line-height: 1;
      }
      // Premium glass pill — backdrop blur, gradient stroke, smooth states
      .user-trigger {
        appearance: none;
        border: 0;
        color: var(--color-text-on-brand);
        font-family: inherit;
        cursor: pointer;
        display: inline-flex;
        width: auto;
        flex: 0 0 auto;
        align-items: center;
        gap: 10px;
        height: 44px;
        padding-block: 0;
        padding-inline: 4px 14px;
        border-radius: var(--radius-pill);
        background:
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.10) 0%,
            rgba(255, 255, 255, 0.04) 100%
          );
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.08),
          0 1px 2px rgba(0, 0, 0, 0.20);
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .user-trigger:hover {
        background:
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.16) 0%,
            rgba(255, 255, 255, 0.08) 100%
          );
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.24),
          inset 0 1px 0 rgba(255, 255, 255, 0.14),
          0 2px 8px rgba(0, 0, 0, 0.28);
      }
      .user-trigger:active {
        transform: translateY(0.5px);
      }
      .user-trigger:focus-visible {
        outline: none;
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.30),
          0 0 0 3px rgba(255, 255, 255, 0.24);
      }
      // Hairline divider between name and role chip
      .user-divider {
        width: 1px;
        height: 18px;
        background: rgba(255, 255, 255, 0.14);
        flex-shrink: 0;
      }
      .avatar {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-pill);
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.26) 0%,
          rgba(255, 255, 255, 0.10) 100%
        );
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.20),
          inset 0 0 0 1px rgba(255, 255, 255, 0.14);
        color: var(--color-text-on-brand);
        font-size: 13px;
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        flex-shrink: 0;
      }
      .avatar-text {
        line-height: 1;
      }
      .online-dot {
        position: absolute;
        inset-block-end: -1px;
        inset-inline-end: -1px;
        width: 10px;
        height: 10px;
        border-radius: var(--radius-pill);
        background: var(--color-success);
        box-shadow: 0 0 0 2px var(--color-brand-primary);
      }
      .user-name {
        font-weight: var(--font-weight-semibold);
        font-size: var(--text-sm);
        color: var(--color-text-on-brand);
        line-height: 1;
        white-space: nowrap;
      }
      .role-chip {
        display: inline-flex;
        align-items: center;
        height: 20px;
        padding-inline: 8px;
        border-radius: var(--radius-pill);
        background: rgba(255, 255, 255, 0.14);
        color: var(--color-text-on-brand);
        font-size: 10px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        line-height: 1;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .role-chip[data-role='SUPER_ADMIN'] {
        background: rgba(255, 255, 255, 0.22);
      }
      .chevron {
        font-size: 16px;
        width: 16px;
        height: 16px;
        opacity: 0.55;
        flex-shrink: 0;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .user-trigger:hover .chevron {
        opacity: 0.95;
      }
      @media (max-width: 768px) {
        .top-bar {
          padding-inline: var(--space-3);
        }
        .user-name,
        .user-divider,
        .role-chip,
        .chevron {
          display: none;
        }
        .user-trigger {
          padding-inline: 6px;
        }
      }
    `,
  ],
})
export class TopBarComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected userAriaLabel(name: string, role: string): string {
    return $localize`:@@topBar.userMenu:User menu for ${name}, role ${role}`;
  }

  protected firstName(name: string): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return '';
    const first = trimmed.split(/\s+/)[0] ?? trimmed;
    return first.length > 16 ? first.slice(0, 14) + '…' : first;
  }

  protected roleLabel(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return $localize`:@@role.SUPER_ADMIN:Super-admin`;
      case 'ADMIN':
        return $localize`:@@role.ADMIN:Admin`;
      case 'VIEWER':
        return $localize`:@@role.VIEWER:Viewer`;
      default:
        return role;
    }
  }

  protected initials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const a = parts[0]?.[0] ?? '';
      const b = parts[parts.length - 1]?.[0] ?? '';
      return (a + b).toUpperCase();
    }
    // Single-word name → first two characters (avoids single-letter "0"-looking avatar)
    return trimmed.slice(0, 2).toUpperCase();
  }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }
}
