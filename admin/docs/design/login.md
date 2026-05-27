# Login Page — Design Notes

**Skill source**: `ui-ux-pro-max` (Principle XXIII). Confirm at PR review by re-invoking the skill on the implemented Angular component.

## Intent
Quiet, trust-conveying credential entry screen. Reads as banking-professional, not consumer-app. Arabic-first; English mirrors layout flipped.

## Layout
- Single centered column, max-width 420 px.
- Vertical rhythm uses `--space-5` between groups, `--space-3` inside groups.
- Brand mark at top (azure blue text on `--color-surface-default` card).
- Below mark: `<h1>` localized "تسجيل الدخول" / "Sign in".
- Form: email field → password field → submit button. All `≥ 56 px` height to comfortably exceed the 24 × 24 WCAG 2.2 AA target size (FR-036a).
- Below submit: helper text "Forgot password? Contact a super-admin." (no self-service reset per Assumptions).

## Tokens
- Background: `--color-surface-elevated` (page) over `--color-surface-default` (card).
- Card: `--radius-lg` corners, `--shadow-md`, padding `--space-7`.
- Primary submit button: `background: var(--color-brand-primary)`, hover `var(--color-brand-primary-hover)`, active `var(--color-brand-primary-active)`, text `var(--color-text-on-brand)`. Min-height 48 px.
- Brand mark text: `color: var(--color-brand-primary)`, `font-weight: var(--font-weight-bold)`, `font-size: var(--text-2xl)`.
- Error region: localised toast OR inline below the relevant field; uses `--color-error-bg` background + `--color-error` text, `--radius-md`.

## Accessibility (WCAG 2.2 AA)
- All inputs have programmatic `<label>` associations (no placeholder-as-label).
- Visible focus ring per global `*:focus-visible` rule (`--focus-ring-color` = brand primary).
- Submit button announces its loading state to screen readers via `aria-busy`.
- Error message uses `role="alert"` + `aria-live="polite"` so the SR reads it immediately on render (FR-036d).
- Tab order: email → password → submit → forgot-password helper text (link if present).
- All copy localised via `i18n` attributes; nothing hard-coded.

## Behavior
- Form invalid until both fields are non-empty + `Validators.email` on email + min length 1 on password (server enforces full policy).
- On submit: disable submit, set `aria-busy`, fire `AuthService.login()`.
- Success: navigate to `queryParams.next` if present, else `/dashboard`. The mcpGuardFn intercepts and routes mcp=true users to `/auth/change-password`.
- Failure: surface message via ErrorCodeService.toLocalizedMessage and inline alert (do NOT toast — error-code routing table marks AUTH_INVALID_CREDENTIALS as form-level).
- After 5 failures within 15 min: `RATE_LIMITED` arrives → disable submit 60 s, show countdown-free copy ("Try again in a few minutes").

## RTL / LTR
- Layout symmetric (single column); no logical flip needed. Helper text alignment uses `text-align: start`.
- Brand mark sits at block-start; icon flips automatically via Angular Material direction-aware components.
