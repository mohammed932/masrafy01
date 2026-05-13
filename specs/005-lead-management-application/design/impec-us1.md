# impec — US1 polish pass

Post-implementation audit of the new screens / components built in Phase 3.

## What was audited
- `add-activity.dialog.ts` (modal)
- `activity-timeline.component.ts` (list)
- `activity-attachments-uploader.component.ts` (file picker + S3 PUT)
- `application-detail.page.ts` (action header + lead-status chip)
- `applications-list.page.ts` (row click → detail; no inline action buttons)

## Anti-patterns checked + verdict

| # | Pattern | Verdict |
|---|---|---|
| A18 raw hex / rgba outside tokens | ✅ all `color-mix(in srgb, var(--color-tonal-accent) 8%, transparent)` etc. |
| A19 `margin-left`/`-right` | ✅ logical CSS used throughout (`margin-inline-start`, `inset-inline-start`) |
| A10 NgModule | ✅ all components standalone |
| A12 `*ngIf`/`*ngFor` | ✅ `@if`/`@for ... track`/`@switch` everywhere |
| A14 constructor DI | ✅ `inject()` only |
| A15 `any` | ✅ no `any` introduced |
| A16 template-driven forms | ✅ typed reactive forms via `FormGroup`/`FormControl` |
| A18 raw hex in shadow | ✅ — `--shadow-lg` family |
| `@media (prefers-reduced-motion: reduce)` | ✅ inherited from `styles.scss` global |
| Body text ≥ 14px | ✅ Cairo body inherited from tokens (`--text-md` 16px) |
| 24×24 touch target | ✅ `mat-icon-button` defaults 40×40; verified all custom buttons |
| `aria-label` on icon-only buttons | ✅ added on uploader remove, action menu trigger, attachment toggle |

## Specific patches applied during polish
1. Timeline rail uses `inset-inline-start` not `left` so RTL flows correctly.
2. Dot color paired with mat-icon — never color alone (color-blind safe).
3. Filter chip listbox uses `aria-label` from i18n, not a hard-coded string.
4. List row tab-order ensured by `tabindex="0"` + `role="link"` + keyboard handlers.
5. Lead-status chip uses semantic palette tokens (warning / info / tonal-accent / success).
6. Action bar sticky stacks under top-bar via `inset-block-start: var(--topbar-height)`.

## Known follow-ups (Phase 8 polish)
- Reminders widget adds a sixth surface — covered by `promax-impec-reminders-widget.md`.
- Empty/loading skeleton row for timeline first paint (FOUC mitigation) — backlog.
- Lead-assign dialog ships in Phase 4 / US2 with its own impec entry.

## Pre-delivery checklist — all green
- [X] No raw hex / rgba()
- [X] No `margin-left`/`-right`
- [X] `@if`/`@for ... track` only
- [X] `inject()` only
- [X] Typed reactive forms
- [X] `aria-label` on every icon-only button
- [X] Hover + Focus + Active + Disabled states on every clickable
- [X] Cairo display + body, tokens for sizes
- [X] LTR + RTL render parity (action bar, timeline rail, filter chips)
