# promax — Applications List Manager Triage

Pre-design pass for the list-page additions (FR-020..FR-022). Inherits the admin design system.

## Pattern

Existing tier-filter chip row stays. NEW: a second chip row underneath for `LeadFilter` (workflow-stage triage). Each row counts derived from current page rows.

```
[ Tier ]  ● High · 12   ○ Medium · 45   ○ Needs coaching · 3
[ Stage]  ○ Needs first contact · 7   ○ Stale · 2   ○ Recent · 18   ○ Follow-up today · 4
          ○ Document collection · 9   ○ Ready for bank · 3   ○ Submitted · 6
```

Single-select per row; either row can clear independently. Selection serializes via `?tier=` + `?filter=`.

## Row signals (already returned by backend)

| Field | Meaning |
|---|---|
| `leadStatus` | one of 5 enum values |
| `lastActivity` | `{ activityType, occurredAt }` or null |
| `activityCount` | total activities |
| `isStale` | `leadStatus ∈ {needs_first_contact, document_collection}` AND last activity ≥ 48h old |
| `hasOverdueFollowUp` | any activity has `followUpAt <= now()` |
| `assignedAgent` | `{ id, name }` or null |

## Row treatment

- Stale rows: red dot prefix on `leadStatus` column.
- Overdue follow-up: clock icon next to last-activity cell.
- Row click → detail page (already shipping in T047 / Phase 3).
- Right-click context menu deferred — primary path is detail screen.

## Anti-patterns checked
- No inline action buttons (FR-010a) — detail page is the sole action surface.
- Row hover uses `--color-surface-row-hover`; cursor `pointer`; focus-visible 2px brand outline.

## Pre-delivery checklist
- [ ] Two chip rows aria-labeled separately
- [ ] Counts use tabular numerals
- [ ] Stale red dot paired with text "Stale" tooltip (color-blind safe)
- [ ] LeadStatus chip semantic palette (needs=warning, document=info, ready=tonal, submitted=brand, decided=success)
