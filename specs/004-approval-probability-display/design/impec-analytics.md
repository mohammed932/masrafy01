# impec — Scoring analytics page polish pass (post-T073)

Surface: `admin/src/app/features/scoring-analytics/`.

## Anti-pattern audit

### Color & contrast

- ✅ Histogram bars use `var(--color-tonal-accent)` at 78% opacity; hovers go to full opacity. Hover stroke ensures the cursor cue is visible even for tiny bars at the dense 180-d window.
- ✅ `—` cells in the tier-accuracy table use `var(--color-text-tertiary)` with the muted-tone token — never gray-on-gray washed out.
- ✅ Notice block (window-too-large) uses `var(--color-surface-muted)` background + dashed border so it reads as "informational, not destructive".

### Typography

- ✅ Histogram tick labels use 10 px tabular-num for column alignment.
- ✅ Tier-table eyebrows match the existing eyebrow pattern from the list page.
- ✅ Page subtitle capped at `max-width: 64ch` so the explanation sentence doesn't run wider than the content rhythm.

### Interaction

- ✅ Window-picker chips: keyboard-accessible (Tab + Enter), `aria-selected` set, leading dot indicator on the selected state for non-color cue.
- ✅ Histogram bars carry SVG `<title>` for tooltip-on-hover; native browser behavior, accessible by default.
- ✅ Too-large error renders as a `role="alert"` block so screen readers announce the rejected request immediately.

### Spatial

- ✅ Distribution + accuracy blocks use the same `var(--space-4) var(--space-5)` padding + 12 px radius so the page rhythm matches the applications list page.
- ✅ No card-in-card. Each block is one container.

### Motion

- ✅ Histogram bars do NOT animate in. Static render. Avoids "growing bars" trope that can mislead operators about magnitudes.
- ✅ Chip selection transitions use 120 ms cubic-bezier; `prefers-reduced-motion` honored.

### Responsive

- ✅ SVG `preserveAspectRatio="none"` lets the histogram stretch full-width at any breakpoint.
- ✅ Tier table scrolls horizontally at < 480 px (Material default) — acceptable on the admin product.

## Fixes applied during this pass

1. **Histogram bar opacity was 100% by default** — tweaked to 78% so the hover-state opacity bump (to 100%) registers as a visible cue.
2. **Window-picker chips initially missed `font-variant-numeric: tabular-nums`** — added so `7d` / `30d` / `90d` / `180d` align cleanly.
3. **Subtitle text wrapped past 64ch** — capped via `max-width: 64ch` for paragraph rhythm.
4. **Notice block originally used `border` not `border: 1px dashed`** — dashed border distinguishes "informational" from the data blocks.
5. **Empty bars rendered as 0 px height** — bumped to `Math.max(2, ...)` so the operator can see "this bucket has 0 offers" rather than "this bucket doesn't exist".

## Open follow-ups (deferred)

- Histogram should expose an "Export CSV" link for offline analysis. Future feature.
- Per-tier accuracy table doesn't show confidence intervals on `approvalRate`. With small `decisionCount` (e.g., 3 out of 5 approved = 60%) the operator might over-interpret. Annotate with a confidence-interval band when decisions exceed 20 per tier. Future feature.
- Analytics page does NOT respect Egyptian-Arabic numerals when the locale is `ar-EG`. Currently uses Western Arabic digits. Out of scope; addressable via a number-formatter pipe in a future i18n polish feature.
