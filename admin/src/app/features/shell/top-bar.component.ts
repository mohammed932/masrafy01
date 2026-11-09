import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import {
  SunOutline,
  MoonOutline,
  DownOutline,
  LockOutline,
  LogoutOutline,
} from '@ant-design/icons-angular/icons';
import { AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/theme/theme.service';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, RouterLink, NzButtonModule, NzIconModule, NzDropDownModule],
  providers: [
    provideNzIconsPatch([SunOutline, MoonOutline, DownOutline, LockOutline, LogoutOutline]),
  ],
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
        <div class="right-cluster">
          <button
            type="button"
            class="theme-toggle"
            (click)="theme.toggle()"
            [attr.aria-label]="themeAriaLabel(theme.current())"
            [attr.aria-pressed]="theme.current() === 'dark'"
          >
            <span
              nz-icon
              [nzType]="theme.current() === 'dark' ? 'sun' : 'moon'"
              nzTheme="outline"
              aria-hidden="true"
            ></span>
          </button>
          <button
            type="button"
            nz-dropdown
            [nzDropdownMenu]="userMenu"
            class="user-trigger"
            [attr.aria-label]="userAriaLabel(user.name, user.role)"
          >
            <span class="avatar" aria-hidden="true">
              <span class="avatar-text">{{ initials(user.name) }}</span>
            </span>
            <span class="user-name" [attr.title]="user.name">{{ firstName(user.name) }}</span>
            <span nz-icon nzType="down" nzTheme="outline" class="chevron" aria-hidden="true"></span>
          </button>
        </div>
        <nz-dropdown-menu #userMenu="nzDropdownMenu">
          <ul nz-menu class="acct-menu">
            <!-- Who is signed in: the whole name, the email and the role, said once here
                 rather than squeezed into the bar. -->
            <li class="acct-head" role="presentation">
              <span class="acct-avatar" aria-hidden="true">{{ initials(user.name) }}</span>
              <span class="acct-who">
                <span class="acct-name">{{ user.name }}</span>
                <span class="acct-email" dir="ltr">{{ user.email }}</span>
                <span class="acct-role">{{ roleLabel(user.role) }}</span>
              </span>
            </li>
            <li nz-menu-divider></li>
            <li
              nz-menu-item
              tabindex="0"
              (click)="changePassword()"
              (keydown.enter)="changePassword()"
            >
              <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@topBar.changePassword">Change password</span>
            </li>
            <li nz-menu-divider></li>
            <li nz-menu-item nzDanger tabindex="0" (click)="logout()" (keydown.enter)="logout()">
              <span nz-icon nzType="logout" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@topBar.signOut">Sign out</span>
            </li>
          </ul>
        </nz-dropdown-menu>
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
        background: var(--color-topbar-bg);
        color: var(--color-topbar-text);
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
        color: var(--color-topbar-text);
        text-decoration: none;
        font-weight: var(--font-weight-bold);
        font-size: var(--text-md);
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
        color: var(--color-topbar-text);
      }
      .brand-mark svg {
        width: 100%;
        height: 100%;
      }
      .brand-text {
        line-height: 1;
      }
      .right-cluster {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .theme-toggle {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.06);
        color: var(--color-topbar-text);
        inline-size: 36px;
        block-size: 36px;
        border-radius: var(--radius-pill);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .theme-toggle:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.28);
      }
      .theme-toggle:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.6);
        outline-offset: 2px;
      }
      .theme-toggle [nz-icon] {
        font-size: 20px;
      }
      // Premium glass pill — backdrop blur, gradient stroke, smooth states
      .user-trigger {
        appearance: none;
        border: 0;
        color: var(--color-topbar-text);
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
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.1) 0%,
          rgba(255, 255, 255, 0.04) 100%
        );
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.08),
          0 1px 2px rgba(0, 0, 0, 0.2);
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .user-trigger:hover {
        background: linear-gradient(
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
      /* An opaque ring in the topbar's OWN ink, not --focus-ring-color: that token is azure
         and this bar is azure in light mode, so the house ring would be invisible here.
         --color-topbar-text is the colour already carrying the text contrast on this ground
         in both themes (near-white on azure in light, near-white on near-black in dark).
         The two translucent layers were the entire indicator and measured 1.56:1. */
      .user-trigger:focus-visible {
        outline: none;
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.3),
          0 0 0 var(--focus-ring-width) var(--color-topbar-text);
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
          rgba(255, 255, 255, 0.1) 100%
        );
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.2),
          inset 0 0 0 1px rgba(255, 255, 255, 0.14);
        color: var(--color-topbar-text);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        flex-shrink: 0;
      }
      .avatar-text {
        line-height: 1;
      }
      .user-name {
        font-weight: var(--font-weight-semibold);
        font-size: var(--text-sm);
        color: var(--color-topbar-text);
        line-height: 1;
        white-space: nowrap;
      }
      /* ---- Account menu ---- */
      .acct-menu {
        min-inline-size: 260px;
        padding: var(--space-1);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
      }
      .acct-head {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3);
        cursor: default;
      }
      .acct-avatar {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: 40px;
        block-size: 40px;
        border-radius: var(--radius-pill);
        background: var(--color-brand-primary);
        color: var(--text-on-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
      }
      .acct-who {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .acct-name {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
      }
      .acct-email {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: start;
      }
      .acct-role {
        align-self: flex-start;
        margin-block-start: var(--space-1);
        padding: 1px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
      }
      .acct-menu li[nz-menu-item] span[nz-icon] {
        margin-inline-end: var(--space-2);
      }
      .acct-menu li[nz-menu-item] {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        border-radius: var(--radius-md);
      }
      .chevron {
        font-size: 16px;
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
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected userAriaLabel(name: string, role: string): string {
    return $localize`:@@topBar.userMenu:User menu for ${name}, role ${role}`;
  }

  protected themeAriaLabel(current: 'light' | 'dark'): string {
    return current === 'dark'
      ? $localize`:@@topBar.theme.switchLight:Switch to light theme`
      : $localize`:@@topBar.theme.switchDark:Switch to dark theme`;
  }

  protected firstName(name: string): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return '';
    const first = trimmed.split(/\s+/)[0] ?? trimmed;
    return first.length > 16 ? first.slice(0, 14) + '…' : first;
  }

  protected roleLabel(role: string): string {
    switch (role) {
      case 'super_admin':
        return $localize`:@@role.super_admin:Super-admin`;
      case 'sales_manager':
        return $localize`:@@role.sales_manager:Sales manager`;
      case 'sales_agent':
        return $localize`:@@role.sales_agent:Sales agent`;
      case 'analyst':
        return $localize`:@@role.analyst:Analyst`;
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

  protected changePassword(): void {
    void this.router.navigateByUrl('/auth/self-password');
  }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }
}
