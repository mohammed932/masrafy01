# Forced-Change Password Page — Design Notes

**Skill source**: `ui-ux-pro-max` (Principle XXIII). Confirm at PR review.

## Intent
Block all other navigation until the user replaces the bootstrap / reset password (FR-026a–d). Reads as a one-task wizard step, not a setting buried in a menu.

## Layout
- Same centered card as login (max-width 420 px, `--shadow-md`, `--radius-lg`).
- Title: localised "تغيير كلمة المرور المطلوب" / "Change your password".
- Body copy: localised "For your security, set a new password before continuing." (single sentence, no jargon).
- Single field: `newPassword`. Show/hide eye-toggle that announces state to SR.
- Inline policy hints below the field — listed, each marked `✓` as it passes:
  - `Length 12–128`
  - `Not a common password`
  - `Not in any known breach`
  These tick live as the user types (client-side length only; breach + common-list checked on submit).
- Submit button: localised "حفظ ومتابعة" / "Save and continue". Full width, brand primary.

## Tokens
Same surface, card, button, focus-ring tokens as login. Policy-hint list uses `--text-sm`, `--color-text-secondary` default and `--color-success` when satisfied.

## Behavior
- Top bar is hidden on this route (no logout button — must complete change before any other action; logout would land them right back here on next sign-in).
- Browser back / route navigation away is blocked by `canDeactivateFn` returning `false`.
- On success: AuthService updates signals (mcp now false, new access token + refresh cookie issued), the mcpGuardFn no longer redirects, navigate to `/dashboard`.
- On `PASSWORD_REUSES_RESET_VALUE`: inline alert "Your new password must differ from the password you were given." Field stays focused.
- On `PASSWORD_BREACH_CHECK_UNAVAILABLE`: inline alert with retry CTA.

## Accessibility (WCAG 2.2 AA)
- `<form>` has accessible name via `aria-labelledby={titleId}`.
- Policy hints region is `aria-live="polite"` so each tick announces.
- Show/hide toggle is a button with `aria-pressed`, `aria-label="إظهار كلمة المرور" / "Show password"`.
- Focus lands on the password field on mount.
