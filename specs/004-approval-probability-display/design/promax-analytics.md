# promax — Scoring analytics page (US4)

**Surface**: `admin/src/app/features/scoring-analytics/scoring-analytics.page.ts` + two visual components: `score-distribution-histogram` (inline SVG) and `tier-accuracy-table` (Material table).
**Goal**: in one screen, answer "how confident is the engine, and is it right?"

## Page layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Scoring analytics                                                  │
│  Distribution of approval scores over a chosen window + per-tier    │
│  accuracy against recorded bank decisions.                          │
│                                                                     │
│  [ 7d ]  [ 30d ]  [ 90d ]  [ 180d ]                                 │
│                                                                     │
│  Distribution                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  ░░░░░░░░ ▒▒▒▒▒▒▒▒▒ ████ ▓▓▓▓ ▒▒▒▒▒▒ ░░░ … 10 buckets       │    │
│  │   0-9      10-19     20-29  …  90-100                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Per-tier accuracy                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ TIER         OFFERS   DECISIONS   APPROVAL RATE             │    │
│  │ Excellent       42         12         91.7%                 │    │
│  │ Good            38          8         62.5%                 │    │
│  │ Moderate        21          0           —                   │    │
│  │ Low              7          0           —                   │    │
│  │ Very low         3          0           —                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Window picker

- Four preset chips: 7 / 30 / 90 / 180 days.
- Selected chip uses `var(--color-tonal-accent-bg)` + `var(--color-tonal-accent)` to match the existing filter-chip pattern from the applications list page.
- Window persists via `?windowDays=` query param so analysts can share a saved view.

## Distribution histogram

- Single inline SVG, no chart library (zero new dependencies — plan constraint).
- 10 bars, one per 10-point bucket. Bar height scales linearly to the max bucket count in the window.
- Hover (or tap on touch) shows a small label: `score 70–79: 21 offers`.
- Empty bucket renders a 1 px hairline so the operator can see "we have 0 offers in this range" rather than "this range doesn't exist".
- Color: `var(--color-tonal-accent)` with each bucket tinted 10% darker as the score rises — visual cue that higher buckets are healthier.

## Per-tier accuracy table

- Renders 5 rows in fixed order: excellent → good → moderate → low → very_low.
- 4 columns: TIER (eyebrow style, uppercase 11 px), OFFERS (count, tabular num), DECISIONS (count), APPROVAL RATE (percentage with 1 decimal place, or `—` if `decisionCount === 0`).
- `—` rows carry a tooltip: "Insufficient data for this tier in the selected window".
- Tier label uses the same i18n keys as the list-page pill (`approval.tier.<tier>`).

## Too-large-window notice

When the API rejects with `ANALYTICS_WINDOW_TOO_LARGE`, the page replaces the histogram + table with a single block:

```
┌──────────────────────────────────────────────────────────────────┐
│  Out of OLTP range                                               │
│  The chosen window exceeds the 180-day cap. Use the data         │
│  warehouse for longer ranges.                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Anti-pattern audit

- ✗ No charting library — single inline SVG keeps bundle slim and removes Angular-version-coupled risk.
- ✗ No emoji, no gradients, no purple. All colors from existing `_tokens.scss`.
- ✗ Color-only state: histogram bars carry text labels on hover; tier-accuracy rows use the same text + percentage pattern across all 5 rows.
- ✗ Inter as display: title at 22 px in brand body face (Cairo), not Inter.

## Pre-delivery checklist

- [x] No new packages
- [x] WCAG 2.2 AA contrast on bars + table rows (verified at smallest preset 7d, default 30d, and dense 180d windows)
- [x] Visible focus ring on window chips
- [x] `prefers-reduced-motion` honored (histogram bars do not animate in)
- [x] AR + EN labels for every i18n key (T074)
- [x] Empty-state copy ("Insufficient data for this tier in the selected window")
