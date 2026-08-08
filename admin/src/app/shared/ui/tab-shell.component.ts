import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

export interface TabShellTab {
  /** Router link relative to the shell's own route, e.g. `'programs'`. */
  readonly link: string;
  /** Already-localized label — each feature owns its own i18n ids. */
  readonly label: string;
}

/**
 * Routed tab strip over a feature's sub-views, with the outlet underneath.
 *
 * The tabs are `<a routerLink>`, not buttons over a `@switch`: they ARE routes,
 * which keeps deep links and the back button honest and means opening the
 * second tab does not re-instantiate the first one's editor. A hand-rolled nav
 * rather than `nz-tabset` for the same reason — nz tabs own their panels, and
 * here the router owns them.
 *
 * Extracted from the questionnaire shell on its second use (the program
 * catalog). The styles below are not boilerplate: they carry three decided
 * arguments (non-sticky, underline not pills, 44px target) and one fixed
 * dark-mode bug, all of which a copy would re-litigate or re-break.
 */
@Component({
  standalone: true,
  selector: 'app-tab-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" [attr.aria-label]="ariaLabel()">
      @for (t of tabs(); track t.link) {
        <a
          class="tab"
          [routerLink]="t.link"
          routerLinkActive="on"
          #rla="routerLinkActive"
          [attr.aria-current]="rla.isActive ? 'page' : null"
          >{{ t.label }}</a
        >
      }
    </nav>
    <router-outlet />
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--color-surface-page, #f8f6f4);
        min-block-size: 100%;
        --tab-shell-accent: var(--primary, var(--ant-primary-color, #0869c3));
      }
      /* Deliberately NOT sticky. A child view may pin its own header at 0, and
         two things pinned to the same edge overlap; the tabs are the ones that
         can afford to scroll away. */
      .tabs {
        display: flex;
        gap: var(--space-2, 8px);
        padding: var(--space-5, 24px) var(--space-6, 32px) 0;
        background: var(--color-surface-page, #f8f6f4);
        /* --color-border-subtle is not a token — it resolved to the hardcoded
           light fallback, which drew a pale rule across the dark theme. */
        border-block-end: 1px solid var(--border-subtle, #efeae5);
      }
      /* Underline tabs, not pills: a pill row here would compete with the filter
         chips inside each view, which are also pills and mean something else. */
      .tab {
        position: relative;
        display: inline-flex;
        align-items: center;
        /* 44px target (WCAG 2.5.5) — 8px of padding around a 14px line is ~34. */
        min-block-size: 44px;
        padding-inline: var(--space-1, 4px);
        margin-block-end: -1px;
        border-block-end: 2px solid transparent;
        color: var(--color-text-secondary, #6b5d54);
        font-size: var(--text-sm, 14px);
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition:
          color var(--motion-duration-fast, 120ms) ease,
          border-color var(--motion-duration-fast, 120ms) ease;
      }
      .tab:hover {
        color: var(--color-text-primary, #2b2320);
      }
      .tab:focus-visible {
        outline: 2px solid var(--tab-shell-accent);
        outline-offset: 2px;
        border-radius: var(--radius-sm, 4px);
      }
      .tab.on {
        color: var(--tab-shell-accent);
        border-block-end-color: var(--tab-shell-accent);
      }
      @media (prefers-reduced-motion: reduce) {
        .tab {
          transition: none;
        }
      }
    `,
  ],
})
export class TabShellComponent {
  readonly tabs = input.required<readonly TabShellTab[]>();
  readonly ariaLabel = input.required<string>();
}
