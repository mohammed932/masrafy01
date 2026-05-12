# impec polish — Clone Program Modal

**Skill**: impec
**Linked code**: [admin/src/app/features/bank-programs/clone/clone-program.dialog.ts](../../../../admin/src/app/features/bank-programs/clone/clone-program.dialog.ts)

## Audit

- [x] Submit button disabled until code is valid
- [x] Duplicate-code → inline `<mat-error>` with `i18n`
- [x] Busy spinner replaces label during submit
- [x] Source program code rendered in monospace
- [x] Cancel disabled during busy state
- [x] No emoji icons (Material content_copy)

## Summary

Applied: tonal-accent source-program chip, inline duplicate error, busy state guard. Modal is straightforward — no further polish needed.
