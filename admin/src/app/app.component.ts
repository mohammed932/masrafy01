import { ChangeDetectionStrategy, Component, inject, LOCALE_ID } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { TopBarComponent } from './features/shell/top-bar.component';
import { SidebarComponent } from './features/shell/sidebar.component';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, CdkScrollable, TopBarComponent, SidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.isAuthenticated() && !auth.mustChangePassword()) {
      <app-top-bar />
      <div class="layout">
        <app-sidebar />
        <main class="content" cdkScrollable>
          <router-outlet />
        </main>
      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
        background: var(--color-surface-elevated);
      }
      .layout {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
      .content {
        flex: 1;
        overflow-y: auto;
        padding-block: var(--space-6);
        padding-inline: var(--space-6);
        background:
          radial-gradient(circle at 0% 0%, rgba(6, 21, 45, 0.03) 0%, transparent 40%),
          var(--color-surface-elevated);
      }
      .content::-webkit-scrollbar {
        width: 10px;
      }
      .content::-webkit-scrollbar-thumb {
        background: var(--color-border-default);
        border-radius: var(--radius-pill);
        border: 2px solid var(--color-surface-elevated);
      }
      .content::-webkit-scrollbar-thumb:hover {
        background: var(--color-border-strong);
      }
    `,
  ],
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly locale = inject(LOCALE_ID);
  private readonly doc = inject(DOCUMENT);

  constructor() {
    const isArabic = this.locale.startsWith('ar');
    this.doc.documentElement.lang = this.locale;
    this.doc.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  }
}
