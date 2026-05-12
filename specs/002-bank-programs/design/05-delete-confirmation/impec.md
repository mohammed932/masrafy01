# impec polish — Delete Confirmation Dialog

**Skill**: impec
**Linked code**: [admin/src/app/features/bank-programs/delete/delete-program.dialog.ts](../../../../admin/src/app/features/bank-programs/delete/delete-program.dialog.ts)

## Audit

- [x] Type-the-code confirmation enforced
- [x] BANK_PROGRAM_HAS_OFFERS branch replaces confirm UI with offer-count banner
- [x] Cancel only escape during has-offers state (no delete button)
- [x] Warn-icon (#b45309) on title
- [x] Busy state during submit
- [x] Localized copy + i18n tags on every visible string

## Nice to have

- "Deactivate instead" CTA in the offer-count banner that opens the toggle path. Deferred — current copy directs operator to close and use the row toggle.

## Summary

Destructive operation correctly gated. Clean destructive-design pattern: amber warn icon, explicit confirmation, has-offers safety branch.
