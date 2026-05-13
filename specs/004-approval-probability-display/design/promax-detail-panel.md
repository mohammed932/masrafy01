# promax — "Why this score?" expander (US3)

**Surface**: `admin/src/app/features/applications/detail/components/why-this-score-panel.component.ts` embedded inside `application-detail.page.ts` offer cards.
**Goal**: answer "why didn't I get the rate I expected?" from the operator's seat in under 3 seconds, in either locale.

## Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Why this score?                                       v1.1.0-init │  ← summary row (always visible)
├────────────────────────────────────────────────────────────────────┤
│  WHAT HELPED                                                       │
│  ↑   PAYROLL_TRANSFER                                  +10         │
│  ↑   HAS_CD_AT_ABK                                     +15         │
│                                                                    │
│  WHAT HURT                                                         │
│  ↓   PREVIOUS_REJECTION                                −30         │
│                                                                    │
│  Scored under engine v1.1.0-init                                   │  ← only when engineVersion ≠ active
└────────────────────────────────────────────────────────────────────┘
```

- Uses native `<details>` / `<summary>` for collapse — keyboard-accessible by default, no JS.
- Summary row carries engineVersion stamp in the trailing slot. Always visible so an operator scanning the offer card never has to expand to find the version.
- Positive + negative groups separated by a small eyebrow label (uppercase 11px).
- Factor rows: indicator (↑ / ↓ from tokens, NOT emoji) + code (monospace fallback for stability) + impact integer (tabular-num).
- The implementation stub today renders the factor code itself; T050 + T051 swap that for the localized `factorCatalog[code].label{Ar|En}` once the catalog fetch is wired.

## Color & contrast

| Element | Token |
|---|---|
| Panel background | `var(--color-surface-elevated)` |
| Panel border | `var(--color-border-default)` |
| Positive impact + arrow | `var(--color-success)` |
| Negative impact + arrow | `var(--color-error)` |
| Code (factor identifier) | `var(--color-text-secondary)` |
| Engine version stamp | `var(--color-text-tertiary)` |
| Legacy notice | `var(--color-surface-muted)` background + `var(--color-text-secondary)` text |

All combinations re-checked at small sizes (12 px) and pass WCAG 2.2 AA at the existing brand token values.

## Legacy notice

When `factors.legacy === true` (offer scored before feature 004), the panel hides positive/negative groups and renders the localized notice block — sourced from `applications.detail.legacyNotice` i18n unit.

## Deprecated-factor badge (Phase 5 follow-up via T051)

When an offer carries a factor code that the active engine version's catalog has removed (MAJOR bump), render a small uppercase badge next to that factor row: `Deprecated in v<active>`. Color: `var(--color-warning)` tinted background. Sentence localizes from the OFFER'S engine catalog, never the active one.

## Anti-pattern audit

- ✗ Emoji icons: not used. Arrows are typographic `↑` / `↓`, not glyph emoji.
- ✗ Card-on-card: panel sits inside the offer card with `--color-surface-elevated` background — visually distinct without being a nested-card.
- ✗ Color-only state: positive uses arrow + color; negative uses arrow + color. Screen-reader announces "positive" / "negative" via the group `<h4>` text.
- ✗ Untranslated codes: factor codes themselves are stable IDs (PAYROLL_TRANSFER); humans read the localized label per the OFFER's catalog.
- ✗ Bouncy motion: native `<details>` animation respects browser defaults; no custom JS animation.

## Pre-delivery checklist

- [x] No emojis as icons (typographic arrows only)
- [x] cursor-pointer on the summary row
- [x] Hover state on summary (subtle)
- [x] Visible focus state (`*:focus-visible` global rule covers `<summary>`)
- [x] WCAG 2.2 AA contrast verified at all 12 px positions
- [x] `prefers-reduced-motion` honored (no custom transitions)
- [x] AR + EN sentences ship for every i18n key (T053)
- [x] Legacy + deprecated paths render without crashing on missing factor sentences
