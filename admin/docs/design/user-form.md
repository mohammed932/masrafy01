# User Create/Edit Dialog — Design Notes

**Skill source**: `ui-ux-pro-max` (Principle XXIII). Confirm at PR review.

## Intent
Compact modal for both create and edit. Same component, mode driven by `MAT_DIALOG_DATA.mode`.

## Layout
- `mat-dialog-content` with vertical stack, `gap: var(--space-3)`.
- Title row: `<h2 mat-dialog-title>` localised "Create user" / "Edit user".
- Fields (create mode):
  1. Name (required, 2–120 chars).
  2. Email (required, email format, max 320; disabled in edit mode).
  3. Role — `mat-select` with options Admin / Viewer (super_admin omitted on create per FR-016).
  4. Initial password — full policy hints below the field (same widget as forced-change).
- Fields (edit mode):
  1. Name (editable).
  2. Email (read-only, with copy-to-clipboard button).
  3. Role — `mat-select` with all three roles. Disabled if the row is the actor themselves (FR-022) AND the role field is the only field changing.
  4. Status — `mat-slide-toggle` "Active". Disabled if the row is the actor themselves.
- `mat-dialog-actions` with secondary "Cancel" + primary "Save", right-aligned in LTR, flipped in RTL.

## Tokens
- Standard Material dialog surface; primary button reads `var(--color-brand-primary)` via theme bridge.
- Validation errors use `--color-error` + `--color-error-bg`.

## Behavior
- Save disabled until form `valid && dirty && !submitting`.
- On create success: dialog closes returning the created summary; list page prepends row + toasts confirmation.
- On `DUPLICATE_ENTRY` with `meta.field === 'email'`: surface as inline error on email field.
- On `PASSWORD_*` codes in create mode: surface under the password field.
- On `CANNOT_SELF_MODIFY`: disable the offending control with an inline note.
- On `SUPER_ADMIN_FLOOR_VIOLATED`: surface as form-level error.

## Accessibility
- Title is the dialog's accessible name (`aria-labelledby`).
- Focus lands on the first interactive field on open.
- Escape closes (Material default).
- Save announces submission via `aria-busy`.
