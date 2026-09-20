---
name: verify-change
description: Run this repo's regression and verification battery after a backend/admin change (tsc, tests, lint parity, check scripts, locale builds). Use when finishing any change, before reporting done, or when asked to "verify", "run checks", or "test".
---

# verify-change

Policy: **do NOT write new unit tests** (operator decision). Existing suites must pass; update a test only if the change made it wrong. Report counts.

## Procedure (run only what the diff touches)
Backend (`cd backend`):
1. `npx tsc --noEmit` → must be clean
2. `npm test` → report pass count
3. `npm run lint` → compare error count to HEAD (see Gotchas)
4. Touched error codes → `npm run check:codes`
5. Touched income rules/catalog/parents → `npm run check:income-proof`, `npm run check:parent-keys`
6. Touched conditions/question scope → `npm run check:conditions`, `npm run check:question-scope`
7. Touched quoting/rates/programmes → `npm run quote:surrogate` (and `quote:rates`, `quote:car-plans`): capture output BEFORE and AFTER; a change claiming to move no money must diff byte-identical.

Admin (`cd admin`):
1. `npx tsc --noEmit -p tsconfig.app.json`
2. `npm test`
3. `npm run lint`
4. i18n touched → follow `admin-ui-change` skill (locale builds).

DB/seed changes: see `backend-data-change` skill.

## Gotchas
- Lint/untranslated counts have known pre-existing baselines. Never trust a stated number; measure HEAD: `git stash -q && <cmd> ; git stash pop -q` (or `git worktree add /tmp/head HEAD`). Parity with HEAD = pass.
- `scripts/` is outside the `tsc` include: a broken script won't fail tsc. Run the script itself.
- `seed:blueprints`, `seed:sheet-figures`, `blueprint:retemplate` run from `dist/` → `npm run build` first or you run stale code.
- Browser check (UI changes): drive the running app (admin :5173, backend :3000) in light, dark, RTL; page overflow 0; console clean. If no browser is available, SAY it was not done.
- Pre-existing dev-console error `Cannot read properties of undefined (reading 'length')` appears on every admin page load; not evidence against your change.
- Never claim verified without having run it; state skipped steps.
