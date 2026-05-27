# Top-Bar — Design Notes

**Skill source**: `ui-ux-pro-max` (Principle XXIII). Confirm at PR review.

## Intent
Persistent identity + sign-out affordance across every authenticated screen. Brand-statement-strength but not loud.

## Layout
- Fixed height 64 px, full-width, position: sticky.
- Background `--color-brand-primary` (#0869C3), text `--color-text-on-brand`.
- Block start, with `--shadow-sm` underneath for scroll separation.
- Inline-start cluster: brand mark "Masrafy" (`--font-weight-bold`, `--text-lg`).
- Inline-end cluster: user-menu trigger button.

## User-menu trigger
- Shows: user name + role chip (uppercase pill, `--radius-pill`, semi-transparent white background `rgba(255,255,255,0.12)`).
- Trigger is a button (NOT a span) so keyboard activates the menu (Material `mat-menu`).

## User-menu items (Material `mat-menu`)
1. `Change password` — navigates to `/auth/self-password`.
2. Divider.
3. `Sign out` — calls `AuthService.logout()` then routes to `/login`.

## Behavior
- Hidden entirely on `/login` and `/auth/change-password` (top-bar absent on forced-change per the forced-change design).
- Logout: button `mat-menu-item` with `[mat-button]` styling. After logout: `AuthService.clear()` empties signals, router pushes `/login` (no `?next=`).

## Accessibility (WCAG 2.2 AA)
- Trigger button has accessible name combining user name + role.
- `mat-menu` already provides correct ARIA (`role=menu`, `aria-haspopup`).
- Focus moves into the menu on open and returns to the trigger on close (Material handles).
- Contrast: `--color-text-on-brand` against `--color-brand-primary` → 13:1 (well above the 4.5 floor).
- Role chip is decorative — its text repeats the role displayed in the trigger button label, so SR users get it once.

## RTL / LTR
- Logical properties throughout. Brand mark sits at inline-start; user-menu at inline-end. Both flip automatically.
