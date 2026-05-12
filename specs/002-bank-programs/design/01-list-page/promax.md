# promax pre-design — Bank Programs List Page

**Skill**: ui-ux-pro-max (Constitution Principle XXIII)
**Linked tasks**: T054–T062

## Recommended design system

```
TARGET: Bank Programs List

PATTERN: Dense Material data-table with sticky page header (filters + search) + paginator footer
  Row affordance: clickable surface navigates to detail; action menu trigger is a separate icon button.
  Sticky thead. Role-gated action menu.

STYLE: Egyptian Banking Sober (continuation of 03-create-drawer)
  Keywords: dense, tabular, RTL-first

COLORS: tokens-only (#06152D primary, #1C4290 accent, deprecated-key badge tinted amber)

TYPOGRAPHY: Cairo (Inter-equivalent it isn't; reused)
  Tabular numerals on Rate column

KEY EFFECTS:
  • Row hover background fade 120ms
  • Active-toggle pill 2px outline + tonal-accent fill when on
  • Deprecated-key badge yellow tinted chip ("1 deprecated tier key — review")
  • Empty-state with illustration tile + clear-filters affordance

AVOID:
  • Centered table cells (left-aligned text, right-aligned numbers — Egyptian Arabic mode flips)
  • Heavy zebra striping (single 1px hairline between rows)
  • Pagination "1 2 3 … 99" buttons (Material paginator with page-size selector instead)

PRE-DELIVERY CHECKLIST:
  [ ] cursor:pointer on rows + action triggers
  [ ] Visible focus ring on every interactive element
  [ ] Empty state with "Clear filters" affordance
  [ ] Tabular numerals on Rate + Updated columns
  [ ] Localized date formatting in Updated column
  [ ] Role-gated action menu hides unauthorized actions
  [ ] Search debounced 250ms
  [ ] Pagination at 25 / 50 / 100 page sizes
  [ ] RTL flip verified — table data-direction aligns
```

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Bank programs                                       [+ Add]      │
│ Configure all loan programs the matching engine consumes         │
├──────────────────────────────────────────────────────────────────┤
│ [Search…]   [Bank ▾]  [Status ▾]  [Category ▾]  [Employment ▾]  │
├──────────────────────────────────────────────────────────────────┤
│ Program code │ Friendly name │ Bank │ Category │ Rate │ Status │ ⋮│
│ ABK-AUTO-V1  │ Auto loan v1  │ ABK  │ car      │ 24.0%│ ●Active│ ⋮│
│ SF-BLUE-PLUS │ Blue / Plus   │ Sales│ personal │ 27.0%│ ●Active│ ⋮│
│ ...                                                              │
├──────────────────────────────────────────────────────────────────┤
│                                            < 1 / 4 >  [25 ▾]    │
└──────────────────────────────────────────────────────────────────┘
```
