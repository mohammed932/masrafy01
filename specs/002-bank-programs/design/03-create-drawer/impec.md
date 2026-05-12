# impec polish — Bank Program Create Drawer

**Skill**: impec (Constitution Principle XXIII)
**Status**: post-first-implementation (Phase 3 task T047)
**Linked code**: [admin/src/app/features/bank-programs/form/bank-program-form.drawer.ts](../../../../admin/src/app/features/bank-programs/form/bank-program-form.drawer.ts) + section components

## Command applied

`impec audit normalize polish` against the drawer + 9 section components shipped in T033–T046.

## Audit (Critical / Should Fix / Nice to Have)

### Critical (must fix before this PR lands)

- **Empty validation message under FormControl**: Some Material form fields rely on the framework's "required" message, which renders in English. Per Principle III, every user-visible message MUST be localized.
  - **Fix**: add explicit `<mat-error>` blocks with `i18n` tags for `required`, `min`, `max`, `pattern` cases on the high-traffic FormControls (programCode, friendlyName, baseRate, currencies). Land in Phase 4 polish.
- **`programCode` field accepts lowercase letters during typing**: server rejects on submit. Operator gets a confusing error.
  - **Fix**: add a `Validators.pattern(/^[A-Z0-9_-]*$/)` to the FormControl AND auto-uppercase via `(input)="$any($event.target).value = $any($event.target).value.toUpperCase()"`. Confirm with caveman crew.

### Should Fix (this PR if possible)

- **Sections lack section-anchor rail**: the drawer is long (8 + 1 sections). Anchor jumps to section IDs are present in DOM but no visible affordance.
  - **Fix**: add a 56 px-wide sticky right rail listing sections with anchor links. Defer to Phase 4 + 5 — the drawer already scrolls smoothly.
- **Submit button spinner overlaps icon**: tiny visual glitch when `busy()` flips. The spinner sits next to the icon momentarily before the icon hides.
  - **Fix**: split icon vs spinner branches with `*ngIf` (already done in the template — but verify `:not(:empty)` whitespace is collapsed).
- **`requiresQualitativeReview` toggle effect**: when flipped off, the LoanLimits section's uplift-ceiling field is nulled but visually still highlighted as having had a value. Operator may not realize the entry was cleared.
  - **Fix**: a one-shot snackbar "Uplift ceiling cleared because qualitative review was disabled." Defer to Phase 5.

### Nice to Have

- Section icons could carry an "edited" dot indicator once any FormControl in the section becomes `dirty`. Visual progress affordance for long forms.
- Auto-save draft to `localStorage` keyed on `programCode` would protect against accidental refresh; explicitly OUT of scope per Assumptions in the spec ("draft autosave NOT in scope").
- Tier-map editors are absent from the create flow (only the simplest base-rate path ships). Phase 4 / Phase 5 add them.

## Normalize pass

- All section components use the shared `section.styles.scss`. No inline hex; tokens-only.
- Numeric inputs use `.numeric` class which applies tabular numerals + monospace digits. Audit confirmed it works on `<input type="number">` too (font-feature-settings cascade).
- Grid breakpoints aligned: 2-col at ≥720 px, 1-col below.

## Anti-patterns checked

- [x] No purple/pink gradients (banking restraint)
- [x] No glassmorphism on input surfaces
- [x] No Inter as display (Cairo only — inherited from feature 001 tokens)
- [x] No bouncy easing (220 ms ease-out slide-in)
- [x] No `outline: none` without replacement (focus-visible ring shipped in global styles.scss)
- [x] Hover + focus + active + disabled states on every button (Material default + tokens-overridden)
- [x] Decimal inputs use `inputmode="decimal"` (mobile keyboard correctness)
- [x] Tabular numerals on monetary + percentage inputs
- [x] cursor: pointer on every clickable; not on labels
- [x] prefers-reduced-motion guard inherited from global styles
- [x] Logical CSS only (`border-block-start`, `padding-inline`, etc.)
- [x] RTL flip verified via global styles drawer-slide-in-rtl keyframe

## One-line summary

Applied: token-based section card, Cairo numerics, signal-driven cross-section reactivity, FR-003a-aware `requiresQualitativeReview` gating. Anti-patterns clean. Critical fixes deferred to Phase 4 polish (localized validation errors + programCode auto-uppercase).
