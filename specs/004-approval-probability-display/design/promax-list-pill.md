# promax — Applications list pill + tier-filter chips (US2)

**Surface**: `admin/src/app/features/applications/list/applications-list.page.ts` + two new components: `approval-pill` and `tier-filter-chips`.
**Goal**: triage 40 leads at a glance. Pill answers "how likely?"; filter answers "what should I work next?".

## Design tokens (extend `_tokens.scss` only if missing)

All token references already shipped via feature 002 + 003. No new tokens added.

| Tier | Background | Text |
|---|---|---|
| `excellent` | `var(--color-success)` | `var(--color-text-on-brand)` (white) |
| `good` | `color-mix(in srgb, var(--color-success) 18%, var(--color-surface-default))` | `var(--color-success)` (darker green via OKLCH mix) |
| `moderate` | `color-mix(in srgb, var(--color-warning) 18%, var(--color-surface-default))` | `var(--color-warning)` |
| `low` | `color-mix(in srgb, var(--color-error) 14%, var(--color-surface-default))` | `var(--color-error)` |
| `very_low` | `var(--color-error)` | white |
| (no match) | `var(--color-surface-muted)` | `var(--color-text-tertiary)` |

**Why this ramp**: only `excellent` and `very_low` use solid brand colors — they're the two ends the operator scans first. `good` / `moderate` / `low` use 14–18% tints so the row stays readable; the tier name + score number do the heavy lifting.

## Pill anatomy

```
┌──────────────────────┐
│  92%   Excellent     │  ← 11px / 600 weight uppercase tier; 13px / 700 weight tabular number
└──────────────────────┘
   ↑                  ↑
   2-digit padding    14px inline padding
```

- Rounded `var(--radius-pill)`. No icon — the number IS the icon.
- Inline-block; sits inside the row's `<td>` with `text-align: end` in RTL (logical CSS).
- Click target ≥ 44×44 — operator can tap to drill into the application detail.
- Tooltip on hover: localized `approval.tier.<tier>` long-form ("Score is in the excellent band").

## Filter chips anatomy

Three chips, single-select. Visual rhythm matches existing `mat-chip-set` from feat 002's bank-programs list:

```
[ ●  High probability leads · 12 ] [   Medium probability · 18 ] [   Needs coaching · 27 ]
```

- Selected chip: filled brand-tonal background (`var(--color-tonal-accent-bg)` + `var(--color-tonal-accent)` text). Tiny dot prefix indicates selection state for low-vision users (not color-only).
- Unselected chips: outline-only.
- Counts update on filter change; counts are the visible-rows result of the active filter.
- Keyboard: `Tab` cycles chips; `Enter`/`Space` toggles.
- URL serialization: `?tier=high|medium|needs_coaching`; reading the URL on page load pre-selects the chip and pre-filters the query.

## Empty-state copy (no rows after filter)

```
No leads in this bucket yet
Try a different filter or wait for new applications.
```

Localized AR/EN. Reuses existing `EmptyStateComponent` from feature 001.

## Anti-patterns checked

- ✗ Inter as display: not used. Pill number uses `font-variant-numeric: tabular-nums lining-nums` via existing `.numeric` utility.
- ✗ Pure black `#000` / pure white `#FFF`: tier-pill text uses `var(--color-text-on-brand)` (off-white tinted with brand navy) per existing theme.
- ✗ Card on card: pill sits in a table cell, NOT another card.
- ✗ Bounce easing: filter-chip transitions use the existing `var(--motion-easing-standard)` cubic-bezier.
- ✗ Color-only state: filter chip carries a dot prefix in addition to background.

## Promax delivery checklist

- [x] No emojis as icons (no icons at all on the pill; chips use SVG dot)
- [x] cursor-pointer on chip + on pill (drills to detail)
- [x] Hover state (120ms ease-out) on both
- [x] WCAG 2.2 AA contrast verified against tier-pill mappings (`excellent`+white ≥ 4.5:1; `very_low`+white ≥ 4.5:1; tinted tiers verified separately)
- [x] Visible focus ring (`*:focus-visible` from existing global styles)
- [x] `prefers-reduced-motion` honored
- [x] Responsive 375 / 768 / 1024 / 1440 (chips wrap on narrow; pill stays inline)
