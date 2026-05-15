# impec — Design context (captured via `/impec teach`)

**Captured**: 2026-05-13
**Project**: Masrafy — Egyptian fintech loan comparison marketplace (admin + mobile + backend).
**Re-run**: `/impec teach` to update.

This file is the single source of truth future `impec` commands consult before touching UI. Every choice below was either confirmed by the user or derived from `admin/src/styles/_tokens.scss` + the constitution (`.specify/memory/constitution.md` v1.3.0).

---

## Brand

| Slot | Value | Source |
|---|---|---|
| Primary brand color | `#06152D` Deep Navy | constitution Principle VIII, locked |
| Primary hover | `#0B2247` | tokens |
| Primary active | `#050F22` | tokens |
| Tonal accent (links, secondary chips) | `#1C4290` | tokens — never used on top-bar |
| Surface page | `#F7F8FA` | tokens |
| Surface card | `#FFFFFF` | tokens — pure white acceptable here (operator dashboard, high-readability surface) |
| Surface row-hover | `#F2F4F8` | tokens |
| Border default | `#D5D9E1` | tokens |
| Border strong | `#A8B0BD` | tokens |
| Semantic — success | `#1B7F47` + bg `#E5F3EC` |
| Semantic — warning | `#B97300` + bg `#FFF4E0` |
| Semantic — error | `#C0292E` + bg `#FBE7E8` |
| Semantic — info | `#1A5FAE` + bg `#E6F0FA` |
| Text primary / secondary / tertiary / disabled | `#06152D / #4A5468 / #7A8194 / #B3B9C5` |

**Brand voice**: refined banking · Swiss restraint · calm density · bilingual-balanced (AR + EN equally weighted) · accountable.

**Anti-patterns specific to this brand**: never use the AI purple/pink hero gradient (kills bank trust); no neon; no glassmorphism on regulated surfaces; no pure black `#000000` (use the navy primary as text instead).

---

## Typography

**Decision**: Cairo single-family.

| Slot | Family | Why |
|---|---|---|
| Display + body | `Cairo, "IBM Plex Sans Arabic", "Inter", system-ui, sans-serif` | One face does AR + EN equally. Variable weights cover 400 / 500 / 600 / 700. |
| Numeric | Same family + `font-variant-numeric: tabular-nums lining-nums` | Banking — money + counts must align in vertical stacks. Lock as rule. |
| Monospace (system keys only) | `ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace` | Used for enumeration keys in the Lookups page + correlation IDs in audit views. Never for body text. |

**Scale** — fixed in tokens, do not invent new sizes:

```
--text-xs:   12px
--text-sm:   14px
--text-md:   16px   ← body minimum
--text-lg:   18px
--text-xl:   22px
--text-2xl:  28px
--text-3xl:  36px
```

**Line heights**: `1.2` headings · `1.5` body · `1.7` long-form. No others.

**Weight policy**: 400 body · 500 medium · 600 semibold · 700 bold. Reserve 700 for hero titles only.

**Hard rules**:
- AR + EN labels paired in every operator UI (already enforced via `@@i18n` keys + `messages.ar-EG.xlf`).
- No body text below 16px web.
- Headlines never centered when they wrap > 2 lines.
- Numerals: every count / amount / date in tabular figures via `.numeric` class.

---

## Spacing scale

4px base — every layout decision lands on:

```
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128
```

Tokens: `--space-1` through `--space-10`. Never invent new values mid-component. If a 20px gap feels right, the answer is 16px or 24px — pick one.

---

## Radius scale

```
--radius-sm:   4px   (inputs, code chips)
--radius-md:   8px   (cards, buttons)
--radius-lg:  12px   (dialogs, hero panels)
--radius-pill: 999px (status chips, count badges)
```

`16px` is **deliberately dropped** — banking restraint. Most cards land on `radius-md`; the hero/dialog tier uses `radius-lg`.

---

## Motion ceiling

**Decision**: Calm — banking restraint, every motion serves state change.

| Token | Value | Use |
|---|---|---|
| `--motion-duration-fast` | 120ms | hover · focus · row-tint |
| `--motion-duration-base` | 180ms | dialog / panel entrance |
| `--motion-duration-slow` | 280ms | choreographed sequences (rare) |
| Easing | `cubic-bezier(0.2, 0, 0, 1)` | one curve for everything |

**Forbidden**: bounce · elastic · auto-playing decoration · animated success states (no confetti, no checkmark draw-ins). Hard rule.

**Required**: every `transition` / `animation` wrapped in `@media (prefers-reduced-motion: reduce)` global guard.

---

## Dark mode

**User wants it on the roadmap.**

Status: **v2 scaffold** — `_tokens.scss` carries the dark palette inside a `[data-theme="dark"]` selector so any future theme switcher just flips the attribute. No dark-mode toggle UI yet. Future `impec` work on dark mode should:

1. Verify every component reads from CSS custom properties (currently true — Principle XXIV).
2. Test contrast ratios against the dark palette using WCAG 2.2 AA + AAA on body.
3. Re-tune shadows (dark mode needs raised surfaces, not inverted shadows).
4. Drop saturation on semantic colors by ~10% (success/warning/error/info backgrounds get muddier in dark contexts).

---

## Numeric / monospace policy

Locked rule for every future impec pass:

- Money — tabular figures, always.
- Counts (activity count, lead count, totals) — tabular figures, always.
- Dates / timestamps — tabular figures.
- Enumeration keys / IDs / correlation IDs — monospace font.
- Mobile / desktop phone numbers — tabular figures.

Class hooks already exist: `.numeric`, `code.key`, `<code>`.

---

## Anti-patterns (project-specific overrides on top of the global impec set)

1. **No raw hex / rgba outside `_tokens.scss`** — Constitution Principle XXIV. Every color reference goes through a CSS custom property.
2. **No `margin-left` / `margin-right`** — logical CSS only (`margin-inline-start`, `inset-inline-end`). Arabic-first means LTR/RTL parity is a release blocker.
3. **No card-in-card nesting** — bank operator surfaces already feel weighty; nested cards make them feel bureaucratic.
4. **No emojis as functional icons** — Material Symbols only (already vendored via Material 18).
5. **No template-driven forms** — typed Reactive Forms only (Principle XXII).
6. **No constructor DI in Angular** — `inject()` only (Principle XX).
7. **No `*ngIf` / `*ngFor`** — `@if` / `@for ... track` / `@switch` only (Principle XIX).
8. **No `any`** — `unknown` + narrowing (Principle XXI).
9. **No fixed pixel font sizes outside tokens** — must use `var(--text-*)`.
10. **No motion on transient operator actions** (save → toast → done) — motion only on navigation / dialog open / state transitions.

---

## How future `impec` commands use this file

When `impec audit`, `impec polish`, `impec normalize`, etc. run, they read this file first and:

- Cross-check edits against the brand color matrix.
- Reject suggestions that introduce sizes / radii / motion timings outside the scales above.
- Default to Cairo whenever a typography decision lands.
- Surface a "dark mode regression risk" warning when a component hardcodes a foreground that would be unreadable on dark surfaces.
- Auto-pair AR + EN labels — every new operator-facing string lands in the i18n bundle, never as inline English.

---

## Next steps the user can take

- `/impec audit lookups` — run the audit punch list against the new feature 006 page.
- `/impec polish add-activity` — final pass on the Add Activity dialog (already polished but a re-run will catch drift).
- `/impec adapt mobile` — re-evaluate the admin breakpoint set for tablet operators.
- Re-run `/impec teach` whenever the brand voice or typography decisions change.
