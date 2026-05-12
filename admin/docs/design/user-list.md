# Users List Page — Design Notes

**Skill source**: `ui-ux-pro-max` (Principle XXIII). Confirm at PR review.

## Intent
Operational table for super_admins to manage internal staff. Density: comfortable, not cramped. No marketing flourish.

## Layout
- Page header row: `<h1>` "Users" (`--text-2xl`) on inline-start; "Create user" `mat-flat-button color="primary"` on inline-end. Both inside a flex row with `gap: var(--space-4)`.
- Material `MatTable` below. Columns:
  1. **Name** (`--font-weight-medium`)
  2. **Email** (`--color-text-secondary`)
  3. **Role** — chip via `MatChipSet`, colour by role: super_admin = brand-primary outline, admin = neutral, viewer = muted.
  4. **Status** — `Active` / `Inactive` chip, success/warning bg.
  5. **Last sign-in** — relative time (`Intl.RelativeTimeFormat`), or em-dash if never.
  6. **Actions** — kebab menu (`MatMenu`): Edit · Reset password · Deactivate/Activate.
- Bottom: `MatPaginator` with page-size options `[20, 50, 100]`, default 20.
- Empty state (when total = 0): centered card with localised "No users yet" + "Create user" CTA.

## Tokens
- Table background `--color-surface-default`; row hover `--color-surface-muted`; border `--color-border-default`.
- Action menu uses Material defaults overridden by `_material-theme.scss`.
- Status chips:
  - Active: `background: var(--color-success-bg)`, `color: var(--color-success)`.
  - Inactive: `background: var(--color-surface-muted)`, `color: var(--color-text-secondary)`.

## Accessibility
- Table has `aria-label="Staff accounts"`.
- Sortable columns (Name, Email, Role, Last sign-in) carry `aria-sort`. Sort lives client-side over the current page (small team).
- Each row's actions kebab has accessible name "Actions for ${name}".
- Paginator carries default Material aria-labels (localised).

## Behaviour
- Page load: signal-backed datasource fetches `GET /users?page=…&pageSize=…`. Loading state shown via top-of-table progress bar.
- Row action `Edit` opens `UserFormDialog` in edit mode. Save dispatches `PATCH /users/:id`. On success, refresh list.
- Row action `Reset password` opens `ResetPasswordDialog`. Save dispatches `PATCH /users/:id/password`. On success, toast localised "Password reset; user will be required to change on next sign-in."
- Row action `Deactivate/Activate` dispatches `PATCH /users/:id` with `isActive` flip. Toast result. If `SUPER_ADMIN_FLOOR_VIOLATED` returned, surface localised message.

## RTL / LTR
- All directional layout via flexbox + logical properties. Table column order is the same in both; Material handles cell alignment.
