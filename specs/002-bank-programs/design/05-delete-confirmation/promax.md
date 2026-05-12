# promax pre-design — Delete Confirmation Dialog

**Skill**: ui-ux-pro-max
**Linked tasks**: T078–T082

## System

```
PATTERN: Centered MatDialog 480px; double-confirmation by typing program code
STYLE: Egyptian Banking Sober + destructive accents (#b45309 warn, #991b1b error tint)
TYPOGRAPHY: Cairo; mono on program code

KEY EFFECTS:
  • Warn icon (amber) on title
  • Type-the-code confirmation; delete button disabled until exact match
  • Has-offers tint banner replaces confirm field when offers > 0
  • Busy state on submit

AVOID:
  • Single-button "Are you sure?" dialogs (too easy)
  • Red glow / shake animations (cheap)
  • Pre-confirmation toast (operator paths through this dialog deliberately)

PRE-DELIVERY CHECKLIST:
  [ ] Type-program-code required to enable delete
  [ ] BANK_PROGRAM_HAS_OFFERS path replaces UI with offer-count banner + cancel-only
  [ ] Super_admin-only at the route layer + button-level
  [ ] Busy state guards double-click
  [ ] Localized copy throughout
```

## Layout

```
┌─────────────────────────────────────────┐
│ ⚠  Permanently delete this program?     │
├─────────────────────────────────────────┤
│ This action cannot be undone. Existing  │
│ offers will block deletion.             │
│ ABK-AUTO-V1 · Auto loan v1              │
│                                         │
│ Type the program code to confirm        │
│ [_______________________________]       │
│ Must match exactly.                     │
├─────────────────────────────────────────┤
│              [Cancel] [Delete program]  │
└─────────────────────────────────────────┘
```
