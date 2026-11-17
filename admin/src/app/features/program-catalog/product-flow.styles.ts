/**
 * The no-payslip product wizard's chrome — ONE stylesheet for the two pages that draw it:
 * step 1 on `new-product.page.ts` (the product does not exist yet) and every later step on
 * `product-studio.page.ts`.
 *
 * They were styled apart, and "Create and continue" swapped the whole frame: a narrower page,
 * another header and other buttons, so step 2 read as somewhere else
 * rather than the next step. Kept here so the move changes the content and never the frame.
 *
 * Component styles stay emulated, so each page still scopes these to itself.
 * No backtick may appear in this file's CSS: it is a template literal.
 */
export const PRODUCT_FLOW_STYLES = `
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--text-sm);
    align-self: flex-start;
  }
  .back-i {
    inline-size: 1em;
    block-size: 1em;
  }
  :host-context([dir='rtl']) .back-i {
    transform: scaleX(-1);
  }
  .back:hover {
    color: var(--color-text-link);
  }

  .ph {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .ph-names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  h1 {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
  }
  .ar {
    color: var(--color-text-secondary);
    align-self: flex-start;
  }
  .ph-act {
    display: flex;
    gap: var(--space-2-5);
    align-items: center;
    flex-wrap: wrap;
  }
  .pill {
    font-size: var(--text-xs);
    font-weight: var(--font-weight-semibold);
    padding: var(--space-0-5) var(--space-2-5);
    border-radius: var(--radius-pill);
    background: var(--color-surface-muted);
    color: var(--color-text-secondary);
  }
  .pill.live {
    background: var(--color-success-bg);
    color: var(--color-success);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border: 1px solid var(--color-border-default);
    background: var(--color-surface-default);
    color: var(--color-text-primary);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font: inherit;
    font-weight: var(--font-weight-semibold);
    text-decoration: none;
    cursor: pointer;
    transition:
      border-color var(--motion-duration-fast) var(--motion-easing-standard),
      background-color var(--motion-duration-fast) var(--motion-easing-standard);
  }
  .btn:hover:not(:disabled) {
    border-color: var(--color-border-strong);
  }
  .btn.primary {
    background: var(--color-brand-primary);
    border-color: var(--color-brand-primary);
    color: var(--color-text-on-brand);
  }
  .btn.primary:hover:not(:disabled) {
    background: var(--color-brand-primary-hover);
    border-color: var(--color-brand-primary-hover);
  }
  .btn.primary:active:not(:disabled) {
    background: var(--color-brand-primary-active);
    border-color: var(--color-brand-primary-active);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn.icon {
    padding: var(--space-2) var(--space-3);
  }

  /* The step rail is the shared app-wizard-steps (one rail across the admin, CLAUDE.md),
     so it is not styled here. */

  .blk {
    background: var(--color-surface-default);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    flex-wrap: wrap;
  }
  h2 small {
    font-weight: var(--font-weight-regular);
  }
  .blk-h {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    inline-size: 100%;
    flex-wrap: wrap;
  }

  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }

  .back:focus-visible,
  .btn:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none;
    }
  }
`;
