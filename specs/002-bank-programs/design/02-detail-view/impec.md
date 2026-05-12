# impec polish — Bank Program Detail View

**Skill**: impec (Constitution Principle XXIII)
**Linked code**: [admin/src/app/features/bank-programs/detail/bank-program-detail.page.ts](../../../../admin/src/app/features/bank-programs/detail/bank-program-detail.page.ts) + [cascade-preview.component.ts](../../../../admin/src/app/features/bank-programs/detail/cascade-preview.component.ts)

## Critical

- **What-if pane re-evaluates synchronously on every input**: pure-client cascade is sub-millisecond — no debounce needed.
- **Cascade trace shows every level (matched + unmatched)** so operators understand WHY a given rate was selected (FR-008f). Done via the trace[] ordered list.
- **Derivation chip surfaces the FR-008s chain visibly** with a tooltip explaining the chain. SF-AUTO `>4M car` band renders "25.5% + −1% — car price exceeds 4M threshold" as a chip on the cascade card.

## Should fix

- **What-if pane fields are not RTL-flipped** when document.dir = rtl — Material defaults flip but the labels for "%" and "months" suffix should be checked. Pending manual RTL audit (Phase 8 T096).
- **Detail page kv-grid has fixed `max-content 1fr` columns** which can overflow on narrow viewports for long Arabic labels. Already responsive at 980px breakpoint; tighter mobile fix deferred.

## Nice to have

- Section anchor rail on the right (mirroring promax.md design). Defer — would require adding scrollspy + nav.
- Audit timeline drawer (mentioned in quickstart §14) — deferred to a follow-up feature.

## Anti-patterns checked

- [x] No cards inside cards (one card per section)
- [x] Tabular numerals on every monetary + percentage field
- [x] Derivation chip visible without hover (chip itself has the math; tooltip enhances)
- [x] Cascade preview labels matched level in plain text
- [x] Deprecated-key banner ALWAYS visible when `deprecatedKeys.length > 0`
- [x] Back-link respects RTL via `back-link` flex layout
- [x] Role-gated edit/clone/delete buttons via *can=

## Summary

Applied: 70/30 layout, sticky-rail-style what-if pane, pure-client cascade evaluator port (lock-step with backend evaluator), derivation chip with tooltip, deprecated-key banner. Defer: section anchor rail, audit timeline drawer.
