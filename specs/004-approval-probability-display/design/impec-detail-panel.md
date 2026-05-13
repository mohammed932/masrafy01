# impec — Detail "Why this score?" panel polish pass (post-T051)

Surface: `admin/src/app/features/applications/detail/components/why-this-score-panel.component.ts`.

## Anti-pattern audit

### Typography

- ✅ Factor labels render in the brand body face (Cairo) at 13 px. AR labels respect the document `dir`.
- ✅ Impact integers use `font-variant-numeric: tabular-nums lining-nums` so a column of `+10`, `+15`, `−30` aligns vertically.
- ✅ Eyebrow labels (`WHAT HELPED` / `WHAT HURT`) at 11 px with 0.06 em letter-spacing — restrained, not shouty.
- ✗ Earlier draft used `<code>` mono for factor codes. Replaced with proper localized sentences via the catalog fetch (T051). Codes are stable IDs and never appear in the UI.

### Color & contrast

- ✅ Positive group: `var(--color-success)` for both indicator + impact. Verified ≥ 4.5:1 against `var(--color-surface-elevated)`.
- ✅ Negative group: `var(--color-error)`. Same verification.
- ✅ Deprecated badge: `color-mix(in srgb, var(--color-warning) 18%, var(--color-surface-default))` background + `var(--color-warning)` text. Subtle but visible.
- ✅ Loading + no-factor + legacy notices share the same `var(--color-surface-muted)` block — consistent shape so the operator's eye doesn't have to relearn the layout.

### Interaction

- ✅ Native `<details>` provides keyboard-accessible toggle with `Tab` + `Enter`/`Space`. Screen reader announces the summary text + state.
- ✅ Catalog fetch fires lazily on first expansion — no wasted bandwidth for offers whose panels never open.
- ✅ Catalog cache keyed by version means re-expanding the same offer is instant; opening another offer scored under the same version is also instant.
- ✅ Deprecated-badge tooltip carries the active engine version via `title=` attribute so hovering reveals the precise reason.
- ✗ The `loading…` state inside the panel was originally a Material spinner. Replaced with a single muted line of text — less visually disruptive for the common case of an instantly-resolving cache hit.

### Spatial

- ✅ Panel sits inside the offer card with `--color-surface-elevated` background — visually nested without being a card-on-card (the card is `--color-surface-default`; the panel is one tone above).
- ✅ Factor rows use `gap: var(--space-3)` for the indicator → label → impact triplet.
- ✅ Positive + negative groups separated by `margin-block-start: var(--space-3)` — half the inter-card gap, since they belong together.

### Motion

- ✅ Browser-native `<details>` toggle. No custom transitions; respects `prefers-reduced-motion` for free.

### UX writing

- ✅ Eyebrows read "WHAT HELPED" / "WHAT HURT" — operator-facing language, not engineer language.
- ✅ Legacy notice: explains "why is this empty" instead of just showing an empty list.
- ✅ Deprecated badge: tooltip clarifies WHICH active version dropped the code.

## Fixes applied during this pass

1. **Deprecated badge originally inline text after the impact** — moved to between the label and the impact so it's adjacent to what it modifies.
2. **Loading state showed a `[Material spinner]` for 1 ms on every cache hit** — replaced with the muted-text variant; spinner appears only when the actual HTTP fetch is in flight (catalog-cache miss).
3. **Engine-mismatch annotation initially shown above the legacy notice** — moved below all factor groups (and legacy notice) so it's the last thing the operator reads. Always tied to the END of the panel.
4. **`document?.documentElement?.dir` check** — left in place but flagged for replacement by `inject(LOCALE_ID)`-driven logic when we add locale-aware label projection in a later feature.

## Open follow-ups (deferred)

- Deprecated detection currently relies on the active version being cached in `ScoringVersionsApiService.cache`. If the operator opens the panel before any list-page renders, the active version isn't yet known — the badge won't render even though it should. Fix: eagerly fetch the active version's catalog at boot via `APP_INITIALIZER`. Out of scope for v1.
- Factor row could expose a per-program-context tooltip ("This adds +10 because your job tenure is > 36 months"). Requires shipping rule explanations alongside the factor catalog. Future enhancement.
