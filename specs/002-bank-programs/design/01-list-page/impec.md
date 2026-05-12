# impec polish — Bank Programs List Page

**Skill**: impec (Constitution Principle XXIII)
**Linked code**: [admin/src/app/features/bank-programs/list/bank-programs-list.page.ts](../../../../admin/src/app/features/bank-programs/list/bank-programs-list.page.ts)

## Critical

- **Deprecated-key tooltip is English-only on the icon**: handled via `matTooltip` with `i18n-matTooltip` directive — accepts via Angular's localize extraction.
- **Search debounce trailing-edge only**: 250ms timer; rapid typing fires one call after pause. OK.

## Should fix

- **Rate column shows "—%" when no rate**: edge case acceptable but visually noisy. Consider en-dash without trailing `%`. Deferred.
- **Pagination resets to page 1 when filters change**: currently filters reload at current page, which may produce empty pages. Should reset `page.set(1)` on filter change. Deferred to Phase 5 polish iteration.

## Nice to have

- Sticky table header on scroll.
- Column resizing.
- CSV export.

## Anti-patterns checked

- [x] cursor:pointer on row links + toggle
- [x] Tabular numerals on rate + status columns
- [x] Empty state with clear-filters affordance
- [x] Role-gated action menu (viewer sees no menu trigger)
- [x] Localized status chip text
- [x] No raw hex; design tokens throughout
- [x] Material Symbols only (no emoji)
- [x] Logical CSS (margin-inline-* only)

## Summary

Applied: filter chips, debounced search, role-gated row toggle + action menu, deprecated-key badge inline. Defer: pagination-reset-on-filter (small ergonomic), sticky thead (nice-to-have).
