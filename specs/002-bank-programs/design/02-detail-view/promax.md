# promax pre-design — Bank Program Detail View

**Skill**: ui-ux-pro-max (Constitution Principle XXIII)
**Linked tasks**: T057–T060

## Recommended design system

```
TARGET: Bank Program Detail (read-only) + What-if Preview Pane

PATTERN: Two-column layout 70/30 — main configuration sections on the left,
  sticky right-rail "Try a sample applicant" what-if pane (FR-033e).
  Each main section is a token-styled card mirroring the create-drawer section pattern.

STYLE: Egyptian Banking Sober

COLORS: tokens-only. Cascade preview uses tonal-accent tint to mark "matched level".
  Derivation chip uses a 1px tonal-accent border + light tint.

TYPOGRAPHY: Cairo. Tabular numerals on every monetary + percentage value.

KEY EFFECTS:
  • Cascade trace renders as a stepper-like list, matched step highlighted
  • Derivation chip hover-card explains the chain (1px tint border, no shadow)
  • Deprecated-key banner sits above the affected section with a yellow tint

AVOID:
  • Cards inside cards (one card per section, not nested)
  • Sticky everything (only the what-if rail and the back-link sticky)
  • Tooltip-only derivation (must be visible on click + persist)

PRE-DELIVERY CHECKLIST:
  [ ] Section ordering matches create-drawer (operator muscle memory)
  [ ] Cascade preview labels matched level in plain language
  [ ] Derivation chip readable without hovering (mobile-friendly tap)
  [ ] What-if pane recomputes within 16ms (pure-client cascade)
  [ ] Role-gated edit/clone/toggle/delete buttons surfaced via *can=
  [ ] Deprecated-key banner ALWAYS visible when deprecatedKeys.length > 0
  [ ] Back-link respects RTL flip
```

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back to list                                                   │
│ ABK-AUTO-V1                              [Edit] [Clone] [⋮ More] │
│ Auto loan v1 · ABK · car · v3                                    │
├────────────────────────────────────────────┬─────────────────────┤
│                                            │ Try a sample        │
│ Identity                                   │ applicant           │
│  Code: ABK-AUTO-V1 (locked)                │                     │
│  ...                                       │ Employment ▾        │
│                                            │ Transfer ▾          │
│ Tenor                                      │ Tenor ▾             │
│  min 12 · max 60 months                    │ Down payment %      │
│                                            │ Asset value EGP     │
│ Loan limits                                │                     │
│  ...                                       │ Effective rate:     │
│                                            │  25.5000 % ✓        │
│ Pricing                                    │  matched: down-     │
│  Base 24.0000% (no overrides)              │  payment 30 band    │
│  ...                                       │                     │
│                                            │ Fee waiver: n/a     │
│ Eligibility · Performance · Income · Fees  │ Insurance: n/a      │
│ · Documents                                │                     │
└────────────────────────────────────────────┴─────────────────────┘
```
