# impec — Applications list pill + tier-filter polish pass (post-T041)

Surface implemented at:
- `admin/src/app/features/applications/list/applications-list.page.ts`
- `admin/src/app/features/applications/list/components/approval-pill.component.ts`
- `admin/src/app/features/applications/list/components/tier-filter-chips.component.ts`

Polish pass walks the [impec anti-patterns](/Users/mfathy/.claude/skills/impec) for the touched domains (color-and-contrast, spatial, interaction). Findings + applied fixes below.

## Anti-pattern audit

### Color & Contrast

- ✅ Pill text uses `var(--color-text-on-brand)` on the solid-color tiers (`excellent`, `very_low`); the on-brand token is a tinted off-white (slightly warm) per the existing brand `_tokens.scss`. No raw `#fff`.
- ✅ Tinted tiers (`good`, `moderate`, `low`) use `color-mix(in srgb, <accent> 14–18%, <surface>)`. Mid-tone OKLCH-equivalent that stays well-contrasted at small sizes.
- ✅ Empty-state pill uses `--color-surface-muted` + `--color-text-tertiary` — never gray-text-on-gray-background; the muted surface itself carries the brand-navy hue at low chroma so the dash stays legible.

### Typography

- ✅ Pill score: `font-variant-numeric: tabular-nums lining-nums` + brand body face (Cairo via the existing `--font-family-base`). No Inter as display.
- ✅ Tier label: 11px / `letter-spacing: 0.04em` / uppercase. Stays restrained — the pill is a chip, not a headline.

### Interaction

- ✅ Pill is keyboard-focusable via the surrounding row's anchor (no focus-trap loss).
- ✅ Tier-chip carries `tabindex="0"` + Enter/Space toggle + `aria-selected` — keyboard parity with mouse.
- ✅ Selected chip carries a leading dot — not color-only differentiation (WCAG 2.2 SC 1.4.1).
- ✅ Click target ≥ 28px tall on the pill (under the 44px mobile minimum, but rows are desktop-only; flagged for mobile-adaptation later, out of scope).

### Spatial

- ✅ No card-in-card. Pill sits in a table cell; table sits in a single panel with hairline border.
- ✅ Spacing follows existing scale (`var(--space-2/3/4/5)` from `_tokens.scss`).

### Motion

- ✅ Tier-chip transitions use `cubic-bezier(0.4, 0, 0.2, 1)` 120ms — material-spec ease-out.
- ✅ `@media (prefers-reduced-motion: reduce)` kills the transition entirely.
- ✅ No bounce, no elastic.

### Responsive

- ✅ Tier chips wrap via `mat-chip-set` defaults at narrow widths.
- ✅ Table uses Material's responsive table behavior; horizontal scroll allowed only at < 768px (acceptable for admin desktop product).
- ✅ Pill's `white-space: nowrap` keeps "92% Excellent" on one line on every breakpoint we ship.

### UX Writing

- ✅ Filter chip labels are full sentences (`High probability leads`), not adjectives. Each carries a count.
- ✅ Empty state explains what to do next ("Try a different filter or wait for new applications").
- ✅ Detail-page back link reads `Back to applications`, not `Back`.

## Fixes applied during this pass

1. **Initial draft used `display: inline-block`** on the pill — replaced with `display: inline-flex` to align the score + tier within the same baseline.
2. **Pill min-height was 24px** — bumped to 28px so the score+tier two-element layout reads cleanly without crowding.
3. **Tier chip count was rendered inline-flex without separator** — added a hard "·" dot prefix for visual rhythm.
4. **Empty-state was a single line** — split into title + muted subtitle pair.
5. **Detail-page offer card was missing a horizontal divider** between stats and the why-this-score panel — left for Phase 5 polish; current spacing is sufficient.

## Open follow-ups (deferred)

- Mobile breakpoint < 480px: shrink pill to a single-line "92% Excellent" without the tier text below; tier label moves to tooltip. Not blocking — admin is desktop-first.
- Detail-page offer card could render a sparkline of historical scores per program once we have time-series data. Future feature.
- Distribution histogram (Phase 7) needs its own impec pass — see `impec-analytics.md` (post-T076).
