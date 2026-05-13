# promax + impec — Dashboard Reminders Widget (US1 follow-ups)

Pre-design + post-implementation audit, combined.

## Pattern

Card on the dashboard home page above the existing Quick Actions grid. Only renders
for write-role staff (super_admin / sales_manager / sales_agent). 24h window.

```
⏰ Reminders due today
─────────────────────────────────────────
[ Personal loan ] 250000 EGP   tomorrow 09:00   [Completed] [Snooze]
[ Car loan      ] 150000 EGP   today 14:00      [Completed] [Snooze]
```

`Completed` / `Snooze` write `INTERNAL_NOTE` activities with reasons
`FOLLOWUP_COMPLETED` / `FOLLOWUP_SNOOZED` (matrix-validated) carrying
`meta.sourceActivityId` so the original reminder is filtered out next reload.

## Style
- Card surface: `--color-surface-default` over page `--color-surface-elevated`.
- Row background: `--color-surface-elevated`.
- Tabular numerals on amount + time.
- Empty state inline copy.

## Accessibility
- Each row link has aria-label "Open application {id}".
- Completed / Snooze buttons have aria-labels (the visible text is short).
- Reload after each write so the list stays current.

## Anti-patterns checked
- ✅ Tokens-only colors (no rgba())
- ✅ Logical CSS (no `left`/`right`)
- ✅ `@if`/`@for ... track`
- ✅ Standalone + `inject()`
- ✅ `aria-label` on every icon-only button (none exist — text buttons used; descriptive aria-labels added anyway)

## Pre-delivery checklist — green
- [X] No raw hex
- [X] No `margin-left`/`-right`
- [X] Min 44px touch target on buttons
- [X] Hover + focus states
- [X] Reduced-motion respected via global guard
- [X] Empty state copy
- [X] Server filters out reminders whose `sourceActivityId` is already in a FOLLOWUP_COMPLETED/SNOOZED/CANCELLED activity by the same staff
