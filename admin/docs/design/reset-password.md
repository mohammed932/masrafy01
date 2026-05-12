# Reset Password Dialog — Design Notes

**Skill source**: `ui-ux-pro-max` (Principle XXIII). Confirm at PR review.

## Intent
Single-purpose modal letting a super_admin set a new password on someone else's account. Triggered from the user-list row menu.

## Layout
- `mat-dialog-title`: localised "Reset password for {name}".
- Body: explanatory copy "The user will be required to change this password on their next sign-in." (localised).
- One field: `newPassword`. Show/hide toggle. Policy hints below (length / not common / not breached).
- Actions: Cancel + Confirm (primary, brand color, label "Reset password").

## Behavior
- On submit: PATCH `/users/:id/password`. Success → toast + close dialog.
- On `PASSWORD_*` codes: surface under field; field stays focused.
- On `PASSWORD_BREACH_CHECK_UNAVAILABLE`: keep the dialog open, show alert with retry CTA.
- On `CANNOT_SELF_MODIFY` (caller targeted self via this endpoint): close + error toast directing to self-change.

## Accessibility
Same WCAG 2.2 AA bar as forced-change page. `aria-live` policy-hint list.
