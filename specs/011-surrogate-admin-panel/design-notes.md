# Design notes — Income-Surrogate Rule Builder (Admin)

**Gate**: Constitution Principle XXIII / A17. `promax` was run BEFORE any component in this
feature was written (T001); `impec` runs over the same four surfaces after first implementation
(T064). This file is the record the gate requires — it is what the components are held to in
review, not a summary written afterwards.

Four new surfaces:

1. `app-income-key-table` — registry key → assumed income rows
2. `app-income-bands-editor` — edges-only income bands
3. `app-income-rule-check` — in-place sample-applicant panel
4. `app-value-source-marker` + `pending-bank-confirmation.page` — the two-state marker and the
   waiting list

---

## Design system (promax output)

```text
PATTERN: Dense operator forms (app pattern), not marketing
  Rule builder: section-in-existing-form → method select → type-driven editor →
                policy row (DBR override · documents · combination) → check panel
  Waiting list: page header + count → filter row → data table → empty state

STYLE: Structured Data Density
  Keywords: tabular, edges-only, calm, legible-at-a-glance, no-decoration
  Performance: Excellent (no new dependency — ng-zorro + existing tokens only)
  Accessibility: WCAG AA; AAA on numeric cells

COLORS (tokens only — raw hex outside _tokens.scss is A18)
  Primary:    var(--primary)                 #0869C3  Azure 600
  Secondary:  var(--accent)                  #A17C5B  Bronze 500 — section icon, best-row accent
  CTA:        var(--primary)                          the Check button
  Background: var(--color-surface-default)   #FDFCFB  on --color-surface-page #F8F6F4
  Text:       --color-text-{primary,secondary,tertiary} — three levels, no more

TYPOGRAPHY: Plus Jakarta Sans / JetBrains Mono (numeric cells only)
  Already loaded in index.html — no new font import.

KEY EFFECTS
  Row hover      --color-surface-row-hover, --motion-duration-fast (120ms)
  Focus          --focus-halo ring; never outline: none
  Panel result   opacity + 2px inline-start slide, --motion-duration-base (180ms)
  Marker flip    background/border only, 120ms — no scale, no bounce
```

### The one new semantic pair

`stated` = `--color-success` / `--color-success-bg` · `estimated` = `--color-warning` /
`--color-warning-bg`.

Estimated is **warning, never error**. FR-034 makes saving an estimate explicitly legal — only
going live is blocked. Painting it red would tell the admin they did something wrong at the moment
they did the honest thing, and the one behaviour this feature needs is for people to mark their
guesses.

### Anti-patterns rejected for these surfaces

| Rejected | Why |
|---|---|
| Any hero / gradient treatment | Operator table, not a landing page |
| Modal or drawer for the check panel | FR-029 requires in place, no navigation; and a `position: fixed` scrim inside `section.page`'s `app-page-rise` transform is A34 verbatim |
| Native `<select>` / dropdown for a registry key | Must be `app-tier-key-picker`, which fails closed when the registry is unreachable (FR-006, AS-1.9) |
| Full-screen blocking spinner while checking | Inline pending state on the Check button only (FR-047) |
| `margin-left` / `margin-right` | A19 — logical properties only, Arabic is primary |
| Placeholder as a field's only label | FR-041 |
| Red for "we estimated this" | See above |
| A second band idiom | v14.0.0 already shipped edges-only bands; a second one leaves the platform with two (research R6) |

---

## Decisions that shape the markup

**Bands are edges-only, and the first edge is REAL.** `app-score-bands-editor` is the model
(v14.0.0) and the linkage logic is copied: a band's `to` IS the next band's `from`, so gaps and
overlaps are unrepresentable rather than merely validated. One difference, and it is deliberate —
scoring bands must cover −∞…+∞, so their first row renders "No minimum". Income bands need not:
a bank's value table may legitimately start above zero, and a value below the floor is
`no_matching_band`, which FR-020 requires to be a stated reason rather than a zero. So the income
editor's **first row shows an editable `fromInclusive` box**; only the last row reads "No maximum".

**The key table is not a band table.** Rows are (registry key, EGP income). Order follows registry
display order. The key is chosen through `app-tier-key-picker` — never free text — and the income
cell carries `appMoneyInput` (A27).

**The check panel sits directly below the table, inside the same section, in the same tab order.**
Result renders in place. "No row matched" is a stated sentence where the income figure would be,
not a `0`.

**The marker is visible without opening anything** (FR-032) — a two-state segmented control beside
the number, not a menu, not a tooltip, not a right-click. All five states (resting, hover, focus,
active, disabled) are distinct (FR-042).

**Motion is suppressed under `prefers-reduced-motion` on all four surfaces**, not only the check
panel — FR-048, and T068 re-checks it.

---

## Pre-delivery checklist (verified at T068)

- [ ] No emoji icons — `nz-icon` SVG only
- [ ] `cursor: pointer` on every clickable element
- [ ] Hover states 120–280ms, via motion tokens
- [ ] Contrast ≥ 4.5:1 body text, ≥ 3:1 non-text
- [ ] Every row action reachable by keyboard alone; add / remove / reorder included
- [ ] `prefers-reduced-motion` respected on editors, panel, marker and waiting list
- [ ] Five distinct states on every new control
- [ ] RTL verified — logical CSS only, no physical direction
- [ ] Responsive at 375 / 768 / 1024 / 1440
- [ ] No raw hex or raw pixel value outside `_tokens.scss`
- [ ] Every user-visible string carries an `i18n=@@bank_programs.income.*` id with an ar-EG translation
