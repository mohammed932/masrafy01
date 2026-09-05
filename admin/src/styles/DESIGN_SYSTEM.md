# Masrafy Admin — Design System

> Source of truth for typography, color, spacing, motion. All component CSS MUST
> reference these tokens. Never hard-code hex / px / ms. Both light + dark modes
> flip automatically because every token has a `[data-theme='dark']` counterpart
> in `_palette.scss`.

## Tokens

- **Palette** — [`_palette.scss`](./_palette.scss): primitive colors (azure, bronze, neutrals, semantic, gradients, shadows, dark-mode counterparts).
- **Typography** — [`_typography.scss`](./_typography.scss): fonts, sizes, weights, line-heights, letter-spacing.
- **Tokens** — [`_tokens.scss`](./_tokens.scss): spacing, radius, motion, focus, layout primitives, legacy aliases (`--color-*` etc.), NG-ZORRO `--ant-*` overrides.
- **Global styles** — [`styles.scss`](./styles.scss): NG-ZORRO component overrides (input, select, tag, modal, table, etc.) — applies the design system to every Ant widget.

## Color

| Role | Token | Light | Dark |
|---|---|---|---|
| Page bg | `--bg-base` | `#F8F6F4` | `#0A0710` |
| Surface | `--bg-surface` | `#FDFCFB` | `#15101C` |
| Subtle | `--bg-subtle` | `#F5F3F0` | `#1A1422` |
| Muted | `--bg-muted` | `#EFEAE5` | `#25202E` |
| Primary | `--primary` | `#0869C3` azure | `#5BA5E8` light azure |
| Primary visible | `--primary-visible` | `#0869C3` | `#7DB8EE` |
| Accent | `--accent` | `#A17C5B` bronze | `#E8D4B8` champagne |
| Text primary | `--text-primary` | `#2B2320` | `#F5F3F8` |
| Text secondary | `--text-secondary` | `#6B5D54` | `#B8B0C0` |
| Text tertiary | `--text-tertiary` | `#8C7E75` | `#8B8595` |
| Border default | `--border-default` | `#DDD8D3` | `#3D3540` |
| Success | `--success` | `#2D5F3F` | `#4FBE7C` |
| Warning | `--warning` | `#C8893D` | `#E7A340` |
| Error | `--error` | `#C1666B` | `#E66E76` |
| Info | `--info` | `#3D5A80` | `#6CABE0` |

### Rules

- Body text always `--text-primary`.
- Secondary copy always `--text-secondary`.
- Muted / metadata: `--text-tertiary` **only where 4.5:1 is not required** — a decorative
  glyph, a redundant restatement of something already in the ink beside it. It does **not**
  clear AA for body-sized or small text in LIGHT mode: measured against the real palette it is
  **3.83:1** on `--bg-surface`, **3.64:1** on `--bg-base` and **3.28:1** on `--bg-muted`. (Dark
  is fine at 5.24:1 on a card, which is why a light-only failure survives a dark-mode review.)
  **A run somebody has to read takes `--text-secondary`** — 6.18:1 on a card, 5.29:1 on muted.
  A chip darkens the ground under its own text, so a chip's label takes secondary or primary,
  never tertiary.
- Backgrounds: page = `--bg-base`; cards = `--bg-surface`; hover rows = `--bg-subtle`; chip / pill bg = `--bg-muted`.
- Borders default to `--border-default`. Strong dividers use `--border-strong`.
- Primary CTA = solid `--primary` bg + `--text-on-primary`.
- Selected-state chips use `--primary` solid bg.

## Typography

Loaded from Google Fonts in [`index.html`](../index.html): `Plus Jakarta Sans`, `Playfair Display`, `JetBrains Mono`.

| Token | Use |
|---|---|
| `--font-sans` | body, buttons, inputs, table cells |
| `--font-display` | hero titles, page-header `h1` |
| `--font-mono` | code chips, programCode |

| Size token | Value | Use |
|---|---|---|
| `--text-xs` | 12px | metadata, captions |
| `--text-sm` | 14px | inputs, table cells |
| `--text-base` | 16px | body |
| `--text-lg` | 18px | card titles |
| `--text-xl` | 22px | section titles |
| `--text-2xl` | 28px | page titles |
| `--text-3xl` | 36px | hero |

| Weight | Value |
|---|---|
| `--font-normal` | 400 |
| `--font-medium` | 500 |
| `--font-semibold` | 600 |
| `--font-bold` | 700 |

### Rules

- Headings: `--font-bold`, `--text-xl` / `2xl` / `3xl`, `--leading-tight`, `--tracking-tight`.
- Body: `--font-normal`, `--text-base`, `--leading-normal`.
- Form labels: 12px, 600 weight, secondary text color.
- Numeric values (rates, amounts, counts): add `.tabular-nums` or inline `font-variant-numeric: tabular-nums lining-nums`.
- Never set `font-family` directly — inherit or use the token.

## Spacing (4-px scale)

| Token | px |
|---|---|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-2-5` | 10 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 24 |
| `--space-6` | 32 |
| `--space-7` | 48 |
| `--space-8` | 64 |

### Rules

- Never invent a px value — pick the nearest token.
- Section gap (page-level): `--space-6`.
- Field gap inside a card: `--space-3` to `--space-4`.
- Chip / pill internal padding: `4px 12px` (the only exception — pills are too tight for token scale).

## Radius

| Token | px | Use |
|---|---|---|
| `--radius-sm` | 4 | tiny chips |
| `--radius-md` | 8 | buttons, cards |
| `--radius-lg` | 12 | sections, large cards |
| `--radius-pill` | 999 | tags, switches |

**Form-field rule**: every input/select/textarea uses **10px** radius (locked in `styles.scss`).

## Motion

| Token | Use |
|---|---|
| `--motion-duration-fast` | 120ms — hover, focus |
| `--motion-duration-base` | 180ms — entry animations |
| `--motion-duration-slow` | 280ms — accordion / disclosure |
| `--motion-easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` |

### Rules

- All transitions: 150–300ms. Never instant.
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` for entries, default ease-out for hovers.
- Never use bounce / elastic.
- Always respect `prefers-reduced-motion: reduce`.

## Focus

`--focus-halo` flips theme-aware:
- Light: `0 0 0 3px rgba(8, 105, 195, 0.15)`
- Dark: `0 0 0 3px rgba(91, 165, 232, 0.40)`

Every interactive element MUST have a visible focus ring.

## Field Token (universal input pattern)

Every text-like field in the app uses:
- height **44px**
- radius **10px**
- bg `--bg-subtle`
- border `--border-default`
- font 14px / 600
- focus: border `--primary` + `--focus-halo`

**Focus indicators, generally.** `--focus-halo` is a translucent GLOW, not an indicator: on its
own it measures **1.24:1** in light and **2.12:1** in dark, under SC 1.4.11's 3:1. It is only
correct beside something that carries the contrast itself — the primary border above. Anything
whose focus state is a ring and nothing else uses the opaque form:

```css
outline: var(--focus-ring-width) solid var(--focus-ring-color);
outline-offset: var(--focus-ring-offset);
```

Phrased against the PATTERN, not the token: **any** focus state whose only indicator is a
translucent shadow is a review block — `--focus-halo`, `--shadow-focus-ring`, or a hand-rolled
`rgba(...)` layer. A token-scoped rule missed two live sites (`.bulk button` used
`--shadow-focus-ring`; the topbar user menu used two `rgba(255,255,255,…)` layers).

On a coloured ground, use that surface's own ink rather than `--focus-ring-color` — the topbar
is azure in light, so an azure ring is invisible there and `--color-topbar-text` is correct.

Where a `box-shadow` is load-bearing for shape (it follows `border-radius` and can be stacked
above a neighbour's seam with `z-index`), keep it and put the opaque ring in front of the glow
rather than swapping in an `outline`.

Affix groups (`nz-input-group [nzAddOnBefore]="EGP"`) inherit the same height and flat-joint border so addon + input read as one pill.

## Chip / Tag

Use NG-ZORRO `nz-tag` — globally restyled in [`styles.scss`](./styles.scss):
- `--bg-subtle` bg
- `--border-default` border, 600 weight, pill shape
- Hover: `--primary` border + bright text
- Selected (`ant-tag-checkable-checked`): solid `--primary` bg + `--text-on-primary`

## Anti-patterns (rejected on review)

- Raw hex outside `_palette.scss` / `_tokens.scss`
- Raw px outside the spacing scale
- `color: #ccc` / `background: #fff` — use tokens, always
- Inline `style="..."` for colors or sizes
- New ad-hoc transitions without easing token
- Hero text without explicit `color: var(--text-on-primary)` (caused the dark-mode azure-on-azure bug)

## How to add a new component

1. Use only tokens above.
2. Never hard-code light values — every color MUST have a dark counterpart automatically.
3. Refer to nearby components first; do not invent a new pattern.
4. Run `impec polish` after first render.
