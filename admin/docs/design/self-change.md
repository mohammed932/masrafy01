# Self Password Change Page — Design Notes

**Skill source**: `ui-ux-pro-max` (Principle XXIII). Confirm at PR review.

## Intent
Quiet, in-app password-change form reached from the top-bar user menu. Differs from forced-change in two ways: (1) requires `currentPassword`, (2) does not block navigation.

## Layout
- Same centered card pattern (max-width 480 px to fit two stacked password fields cleanly).
- Title: localised "تغيير كلمة المرور" / "Change password".
- Fields, top-down: `currentPassword`, `newPassword`. Both with show/hide toggles.
- Policy hints under `newPassword` (same widget as forced-change).
- Buttons row at bottom: secondary "Cancel" (back to dashboard) + primary "Save". Right-aligned in LTR, left-aligned in RTL via `justify-content: flex-end` + `flex-direction: row` (Material direction-aware).

## Tokens
Same as login + forced-change.

## Behavior
- Submit disabled until both fields non-empty + new ≠ current (client check) + policy hints satisfied locally.
- On `INVALID_CURRENT_PASSWORD`: inline alert on `currentPassword` field.
- On success: AuthService re-issues access token + refresh cookie (server revokes all other refresh tokens — silent "signed out everywhere else" effect, surface a localized toast confirming).
- Audit event `AUTH_PASSWORD_CHANGED` emitted server-side.

## Accessibility
Same WCAG 2.2 AA bar as forced-change page.
