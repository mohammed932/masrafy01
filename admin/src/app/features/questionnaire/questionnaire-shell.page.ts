import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Tab shell over the GLOBAL question pool. Two jobs, one pool:
 *
 * - **Questions** — author the pool: wording, answer type, options, order.
 * - **Loan categories** — decide which categories ask each question. A question
 *   may serve several, so this is a matrix, not a per-category questionnaire:
 *   there is still ONE pool and ONE published version (Principle V / A33).
 *
 * The tabs are `<a routerLink>`, not buttons over a `@switch`: they ARE routes
 * (see QUESTIONNAIRE_ROUTES), which keeps deep links and the back button honest
 * and means opening the assignment tab does not re-instantiate the pool editor.
 * A hand-rolled nav rather than `nz-tabset` for the same reason — nz tabs own
 * their panels, and here the router owns them.
 */
@Component({
  standalone: true,
  selector: 'mf-questionnaire-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Questionnaire sections" i18n-aria-label="@@qtabs.aria">
      <a
        class="tab"
        routerLink="questions"
        routerLinkActive="on"
        #pool="routerLinkActive"
        [attr.aria-current]="pool.isActive ? 'page' : null"
        i18n="@@qtabs.pool"
        >Questions</a
      >
      <a
        class="tab"
        routerLink="categories"
        routerLinkActive="on"
        #cats="routerLinkActive"
        [attr.aria-current]="cats.isActive ? 'page' : null"
        i18n="@@qtabs.categories"
        >Loan categories</a
      >
    </nav>
    <router-outlet />
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--color-surface-page, #f8f6f4);
        min-block-size: 100%;
        --qs-accent: var(--primary, var(--ant-primary-color, #0869c3));
      }
      /* Deliberately NOT sticky: the assignment view's own column header is
         sticky at 0, and two things pinned to the same edge overlap. The tabs
         scroll away; the header that has to stay is the one naming the columns. */
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
        outline: 2px solid var(--qs-accent);
        outline-offset: 2px;
        border-radius: var(--radius-sm, 4px);
      }
      .tab.on {
        color: var(--qs-accent);
        border-block-end-color: var(--qs-accent);
      }
      @media (prefers-reduced-motion: reduce) {
        .tab {
          transition: none;
        }
      }
    `,
  ],
})
export class QuestionnaireShellPage {}
