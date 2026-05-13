# promax — Add Activity Modal

Pre-design pass for the agent's primary write surface (FR-002..FR-008, FR-019).
Inherits the **Masrafy Admin Dashboard** design system already locked in `_tokens.scss`
(Swiss Banking × Refined Operator).

## Pattern

Single-column modal, 560–720px wide, max-height 80vh, scrolling body. Action footer fixed.

```
┌─ Add Activity ──────────────────────── ✕ ┐
│ {applicationId chip}  {leadStatus chip}   │
├──────────────────────────────────────────┤
│ Activity type  [▾ Called user]            │  ◄ groups: contact / docs / status / system
│ Reason         [▾ Initial contact]        │  ◄ repopulates per type via ACTIVITY_REASONS
│ Note           [_____________________]    │  ◄ 2 000 chars; required when reason=OTHER
│ ─── Conditional fields ───                │
│ Duration       [ 12 ] min                 │  ◄ only when type=CALLED_USER
│ Outcome flags  [☑ User confirmed] (≤3)    │
│ Attach files   [⌶ Drop here / Browse]     │  ◄ only when type ∈ {RECEIVED/REVIEWED/REQUESTED}
│  • passport.jpg · 2.1 MB · Via WhatsApp   │  ◄ per-file: type + source dropdowns
│  • bank-stmt.pdf · 1.4 MB · Via Email     │
│ Follow-up      [ 2026-05-14 10:00 ▾ ]     │  ◄ datetime picker, future-only
├──────────────────────────────────────────┤
│            [ Cancel ] [ Save & Add Another ] [ Save ] │
└──────────────────────────────────────────┘
```

## Style

- Cairo body 16px, semibold 14px field labels.
- Field stack rhythm `var(--space-4)` (16px) between groups, `var(--space-2)` inside a group.
- Conditional fields fade-in 180ms `var(--motion-easing-standard)` on type-change. `prefers-reduced-motion`: skip.
- Each field's hint sits below the input in `var(--text-xs)` `var(--color-text-tertiary)`.
- Reason dropdown shows AR + EN tooltip per option.

## Colors

- Primary CTA filled brand navy (`--color-brand-primary`). Disabled state `--color-text-disabled`.
- Secondary CTA outlined tonal-accent.
- Cancel = ghost button, text only.
- File-row hover `--color-surface-row-hover`.
- Status chips: `leadStatus` chip uses the leadStatus palette agreed in the design system.

## Accessibility

- All inputs use Material Reactive Form with typed controls (Principle XXII).
- `aria-describedby` links every input to its hint paragraph.
- File list rows announce `Attached: passport.jpg, 2.1 MB, via WhatsApp` via `<sr-only>` text.
- Tab order: type → reason → note → duration → outcome → attach → follow-up → cancel/save.
- All MatDialog defaults inherit centering + branded backdrop from `MAT_DIALOG_DEFAULT_OPTIONS`.

## Anti-patterns (avoid)

- A18 raw hex in dialog body shadows — use `--shadow-lg`.
- A12 `*ngIf`/`*ngFor` — use `@if`/`@for ... track`.
- Per-call-site i18n English fallbacks — all strings via `@@activity.*` keys (`@angular/localize`).
- File picker `<input type=file>` with no drop zone — wrap in cdk-drag-drop with visible state.
- Reveal-style password toggles do not apply here, but match the auth-form aria-label pattern when adding similar buttons.

## Pre-delivery checklist (this modal only)

- [ ] No raw hex / rgba() outside `_tokens.scss`
- [ ] Logical CSS only (no `margin-left`/`-right`)
- [ ] Conditional field reveal respects `prefers-reduced-motion`
- [ ] Type → reason cascade resets `reason` control on type change
- [ ] `originalFilename` PII-stripped on the backend (not the client)
- [ ] Save button disabled while submitting + announces busy via `aria-busy`
- [ ] Empty file list shows micro empty-state copy "No documents attached yet"
- [ ] Outcome multi-select capped at 3 with visible counter
- [ ] Duration field only mounted (not just hidden) when type = `CALLED_USER`
- [ ] Follow-up picker future-only; clears on type change to types where it doesn't apply
- [ ] RTL flow: AR locale renders modal with logical-start aligned labels
