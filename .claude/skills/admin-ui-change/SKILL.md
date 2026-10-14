---
name: admin-ui-change
description: Conventions and pitfalls for editing the Angular 18 admin dashboard (admin/): i18n ids, ar-EG xlf, inline templates, signals, RTL, tokens. Use when editing any admin/src component, adding UI text, or touching messages.ar-EG.xlf.
---

# admin-ui-change

## Checklist
1. Standalone component, `inject()`, signals (no BehaviorSubject), `@if/@for … track/@switch` (no `*ngIf`), typed reactive forms, no `any`.
2. Every user string: `i18n="@@unique.id"` (template) or `$localize\`:@@id:text\`` (TS). Reuse an existing id verbatim if the text is identical.
3. Add an `<trans-unit id="…">` with `<target>` to `admin/src/i18n/messages.ar-EG.xlf` for each NEW id (source text must match the template exactly, whitespace included).
4. Styles: logical properties only (`margin-inline-start`), tokens (`var(--…)`), no raw hex/px outside `_tokens.scss`. Money inputs need `appMoneyInput`.
5. Check: `npx tsc --noEmit -p tsconfig.app.json`, then `npx ng build --configuration development-ar 2>&1 | grep -c "No translation found"` vs HEAD (see verify-change).
6. Reading/measuring in browser: prefer `read_page`/`get_page_text` over screenshots.

## Gotchas
- **A backtick anywhere in an inline `template:`/`styles:` literal (even in an HTML comment) ends the string** → TS error pointing far away. Never use backticks in template comments.
- Placeholder changes in an `i18n` string (`{{ x }}`, `:NAME:`) must be mirrored in the xlf target or the whole ar build FAILS. Literal `{$INTERPOLATION}` in a target silently drops the value; use the `<x/>` element the source declares.
- Rewording a source string orphans its ar target → update the target too.
- Only `--color-*`/tokens defined in the theme work; an undefined `var(--x)` silently paints nothing. Grep `_tokens.scss`/palette before inventing one.
- Modals/drawers: `NzModalService`/`NzDrawerService` (no `mat-*`); confirm dialogs only for destructive/hard-to-reverse acts. Big forms → own routed page (`app-form-page`), small → `openFormDrawer`.
- ng-zorro `nz-switch` inside a `<label>` is unlabelled; use native checkbox for a11y.
- Focus ring: `outline: 2px solid var(--focus-ring-color)`; `--focus-halo` alone fails contrast.
- Route order: literal routes (`products`, `new`) before `:key` param routes.
- `ng serve` build is `development` (no i18n); RTL check = force `dir=rtl` or `npm run start:ar` (its dev server cannot authenticate).
- Deeper reference: `references/patterns.md`.
