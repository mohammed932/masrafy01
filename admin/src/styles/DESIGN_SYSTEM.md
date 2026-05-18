# Masrafy Admin — Design System

> Source of truth for typography, color, spacing, motion. All component CSS MUST
> reference these tokens. Never hard-code hex / px / ms. Both light + dark modes
> flip automatically because every token has a `[data-theme='dark']` counterpart
> in `_palette.scss`.

## Tokens

- **Palette** — [`_palette.scss`](./_palette.scss): primitive colors (burgundy, bronze, neutrals, semantic, gradients, shadows, dark-mode counterparts).
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
| Primary | `--primary` | `#5C0632` burgundy | `#E0708F` vivid pink |
| Primary visible | `--primary-visible` | `#5C0632` | `#EC8AA6` |
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
- Muted / metadata always `--text-tertiary` (never below 4.5:1 contrast).
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
- Light: `0 0 0 3px rgba(92, 6, 50, 0.15)`
- Dark: `0 0 0 3px rgba(224, 112, 143, 0.40)`

Every interactive element MUST have a visible focus ring.

## Field Token (universal input pattern)

Every text-like field in the app uses:
- height **44px**
- radius **10px**
- bg `--bg-subtle`
- border `--border-default`
- font 14px / 600
- focus: border `--primary` + `--focus-halo`

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
- Hero text without explicit `color: var(--text-on-primary)` (caused the dark-mode burgundy-on-burgundy bug)

## How to add a new component

1. Use only tokens above.
2. Never hard-code light values — every color MUST have a dark counterpart automatically.
3. Refer to nearby components first; do not invent a new pattern.
4. Run `impec polish` after first render.
