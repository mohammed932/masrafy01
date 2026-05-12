# promax pre-design — Clone Program Modal

**Skill**: ui-ux-pro-max
**Linked tasks**: T072–T077

## System

```
PATTERN: Centered MatDialog 440px width
STYLE: Egyptian Banking Sober
COLORS: tokens-only; tonal-accent on source-program chip
TYPOGRAPHY: Cairo; mono on program codes
KEY EFFECTS: Submit busy state; duplicate-code field error
AVOID: cascade modals; nested dialogs; confirmation dialog before clone

PRE-DELIVERY CHECKLIST:
  [ ] Source program shown with code + friendly name
  [ ] New code field validates A-Z 0-9 _ - 3-32 chars
  [ ] Duplicate code → inline error
  [ ] Double-submit guard (busy state disables button)
  [ ] On success → navigate to new program detail
  [ ] Cancel preserves nothing
```

## Layout

```
┌────────────────────────────────────┐
│ Clone bank program                 │
├────────────────────────────────────┤
│ Cloning from ABK-AUTO-V1 · …       │
│                                    │
│ New program code  [ABK-AUTO-V2 ]   │
│ A-Z, 0-9, _, - (3-32 chars)        │
│                                    │
├────────────────────────────────────┤
│              [Cancel] [Clone]      │
└────────────────────────────────────┘
```
