# promax pre-design — Bank Program Create/Edit Drawer

**Skill**: ui-ux-pro-max (Constitution Principle XXIII)
**Status**: pre-design (Phase 3 task T028)
**Linked tasks**: T033–T046 (drawer + sections + submit wiring)

## Target

**Project**: Masrafy admin — Bank Program management drawer
**User**: Internal admin / super_admin staff configuring loan programs after banks submit pricing
**Frequency**: Operator opens once per program creation (20 ABK + ~10 competitor + ~30 net-new per year) — 1–3× per day during onboarding sprints
**Volume**: Form holds ~150 fields across 8 sub-configurations; Decimal precision mandatory

## Recommended design system

```
TARGET: Bank Program Create/Edit Drawer

PATTERN: Right-edge side-drawer (Material MatDialog with panelClass: 'side-drawer')
  Width 720px (90vw max). Stays open while operator references sidebar + list behind.
  Sections always-expanded with anchor links in a sticky right rail; submit + cancel
  in a sticky footer. Re-entering edit mode preloads the same drawer.

STYLE: Egyptian Banking Sober (custom — extends the 67-style catalog with a fintech-restraint variant)
  Keywords: precise, sober, deep-navy, tabular numerals, RTL-first
  Best For: regulated fintech config UIs handling Decimal monetary inputs
  Performance: Excellent (no images, no heavy motion)
  Accessibility: WCAG 2.2 AA — keyboard-only, screen-reader friendly

COLORS:
  Primary:    #06152D (Masrafy deep navy — primary CTA, header band)
  Secondary:  #1C4290 (tonal accent — section accents, focus, selected chips)
  CTA:        #06152D on primary; ghost outline on secondary
  Background: #F8FAFC (drawer body); #FFFFFF (input surfaces)
  Text:       #06152D (primary); #475569 (secondary); #94A3B8 (tertiary)
  Validation error: #B42318 on tinted #FEF2F2
  Notes: tokens already shipped in feature 001 — reuse, no new hex.

TYPOGRAPHY: Cairo + IBM Plex Sans Arabic
  Display: Cairo 600 (Section titles 18px)
  Body: Cairo 400 (Labels 14px / Inputs 14px / Hints 12px)
  Mood: precise, neutral, RTL-friendly, Egyptian-Arabic-correct
  Numerals: tabular-nums lining-nums on every monetary + percentage field
            (font-feature-settings: 'tnum')

KEY EFFECTS:
  • 220ms drawer slide-in from inline-end (RTL flips to inline-start)
  • Backdrop blur 2px + rgba(6,21,45,0.32) — keeps sidebar barely visible
  • Hairline tonal-accent left border on the currently-anchored section
  • Inline FormControl error chrome: 1px border tint + 12px error message
  • Focus ring: 2px solid var(--color-brand-primary) outline (Principle IV)
  • prefers-reduced-motion: disables slide-in and focus animations
  • Submit button enters a busy state with spinner — disables for the full request

AVOID (anti-patterns for this surface):
  • Purple / pink gradients (banking restraint)
  • Glassmorphism on input surfaces (precision UI, not marketing)
  • Inter as display (Cairo only)
  • Multi-step wizard (operator wants the full form, not 8 step screens)
  • Auto-collapse of all sections (operator scrolls + anchor-rail; collapse-by-default
    fights muscle memory for an admin user who repeats the flow)
  • cursor-pointer on non-interactive labels (false-affordance)
  • Form-level errors at the bottom (each error attaches to the FormControl)

PRE-DELIVERY CHECKLIST:
  [ ] No emojis as icons (Material Symbols only)
  [ ] cursor-pointer on every interactive element + button
  [ ] Hover state on rows, buttons, and the section anchor links
  [ ] Light mode contrast ≥ 4.5:1 for body text (verify against AAA target)
  [ ] Visible focus ring (2px brand-primary) on every focusable element
  [ ] prefers-reduced-motion disables slide-in + focus animations
  [ ] RTL-flip drawer anchors to inline-start; logical CSS only (no margin-left/right)
  [ ] Tabular numerals on every monetary + percentage input + display
  [ ] Submit disabled until form.valid; busy state on submission
  [ ] Tier-key pickers DISABLED with "enumerations unavailable" copy when the registry is down
  [ ] Per-FormControl validation chrome (border tint + 12px error message)
  [ ] Sticky footer (cancel + submit) above keyboard on narrow viewports
  [ ] 360 / 768 / 1280 / 1440 layout verified — drawer collapses to 95vw on narrow
```

## Section composition (the 8 always-expanded sections)

| Section | Anchor | Owns FormGroup |
|---|---|---|
| Identity | `#identity` | programCode (locked in edit), bankName, friendlyName, friendlyNameAr, programType, productCategory, currencies, active |
| Tenor | `#tenor` | minMonths, maxMonths, override maps |
| Loan limits | `#loan-limits` | perCurrency editor, tier overrides, qualitativeReviewMaxEGP (gated) |
| Pricing | `#pricing` | isVariableRate, base/effective rate, all rate-tier maps, buyout, fee-waiver, insurance-waiver |
| Eligibility | `#eligibility` | flags + age + income gates + wealth gates + requiresNoDocuments + requiresQualitativeReview |
| Performance criteria | `#performance` | MOB gates (collapsible by default; only buyout + cross-sell need this) |
| Income assumption | `#income-assumption` | strategy switcher — only the active strategy's table renders |
| Fees | `#fees` | admin fee + display + range, stamp duty, life insurance + mandatory, late-payment, payoff |
| Documents | `#documents` | requiredDocuments multi-select + operatorNotes + operatorTips |

## Critical interaction details

- **Variable-rate toggle** (Pricing section): flipping `isVariableRate` shows / hides `currentEffectiveRate` vs `baseRate` inline; the inactive field clears on toggle to prevent FR-011a violations.
- **Income-assumption strategy switch**: switching `strategy` clears the previous strategy's table fields (per US1 acceptance scenario 8) and renders the new strategy's table — guarded by `@switch`.
- **Derivation editor** (Pricing tier-map rows): each rate-band row exposes a "derivation" disclosure that lets the operator enter sourceRatePercent + deltaPercent + reason. Live-preview shows `value = sourceRatePercent + deltaPercent`; mismatch flags client-side BEFORE server submission.
- **qualitativeReviewMaxEGP** (Loan-limits): the field is `disabled` until `eligibility.requiresQualitativeReview` is `true`. When disabled, hint text reads "Enable qualitative review on the Eligibility section to unlock the uplift ceiling."
- **Tier-key picker** (every tier-map editor): bound to the `PlatformEnumerationsService` signal cache. If `unavailable()` is `true`, the picker renders disabled with localized fallback copy.
- **Submit guard**: button disabled until `form.valid && !form.disabled && !busy`. Server errors map to typed codes via the error-code helper and attach to the specific FormControl.

## RTL + i18n

- All copy via `@angular/localize` `@@id`-tagged messages — strings reserved in messages.{ar-EG,en-US}.xlf during T011 + concrete strings land per-section.
- Drawer slides in from inline-end (LTR → right; RTL → left). CSS uses `border-inline-start` / `inset-inline-end`. Logical units throughout.
- Monetary + percentage inputs respect locale-formatted entry: operator may paste `26.55%` or `٢٦٫٥٥%` and the form normalizes to canonical decimal string before submit.

## Acceptance from spec.md US1

This drawer must satisfy acceptance scenarios 1–10. Specifically:

1. (1) Valid full submission → 201 + list refresh.
2. (2) Duplicate programCode → field-level error.
3. (3) min > max → blocked on blur + submit.
4. (4) Strategy switch hides other tables.
5. (5) Browser refresh discards unsaved draft (no autosave per Assumptions).
6. (6) Unknown enum key → server-rejected with field-level error.
7. (7) Successful save → toast + audit event.
8. (8) Strategy switch clears prior strategy's table.
9. (9) Variable-rate without `currentEffectiveRate` → `INVALID_VARIABLE_RATE_CONFIGURATION`.
10. (10) Fee-waiver-at-rate + penalty → what-if preview pane (this lands in Phase 4 detail-view; create drawer references the cascade but does not preview).

## impec follow-up

After first implementation, run `impec polish` and save to `./impec.md`. Expect findings around:

- Section anchor-rail spacing on narrow viewports
- Empty-derivation hint clarity
- Currency selector affordance (chip vs multi-select)
- Submit-button busy state animation timing
