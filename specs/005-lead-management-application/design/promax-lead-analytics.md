# promax — Lead Analytics page (US3)

Pre-design pass for the analyst aggregate report (FR-014..FR-017).

## Pattern

Header + window-picker chips + table. Same Swiss-banking restraint as the rest of the dashboard.

```
Lead analytics
Per-agent aggregates with session-local anonymization.

[ 7d  30d  90d  180d ]

┌────────────┬───────────────────┬───────┬─────────────────────┐
│ Agent      │ Activity type     │ Count │ Total duration (min)│
├────────────┼───────────────────┼───────┼─────────────────────┤
│ Agent A    │ Called user       │   48  │              612    │
│ Agent A    │ Sent whatsapp     │  124  │                —    │
│ Agent B    │ Called user       │   91  │             1240    │
│ …                                                            │
└──────────────────────────────────────────────────────────────┘
Window: 30d · generated 2026-05-13 10:32
```

## Style
- Window chips re-use the same chip palette + transition as the tier/lead filters.
- Tabular-num count + duration columns; `—` em-dash for non-CALLED_USER duration.
- Empty state inline below header when 0 rows.

## Accessibility
- Window chips use `role="option"` + `aria-selected` like the other chip rows.
- Page heading semantic h1, subtitle paragraph.
- Table has visible column headers + scope=col implicit via `<th>`.
- 400+ days request returns the typed `ANALYTICS_WINDOW_TOO_LARGE` code which renders the standard error chip.

## Constitution alignment
- Principle VI PII protection: aliasing is per-session deterministic, salt + analyst sub, system actor pinned to label "System".
- Principle III typed errors: window-too-large mapped to existing code from feature 004.
- Principle XXIII pipeline: this doc + impec-us3.md cover the design surfaces.
