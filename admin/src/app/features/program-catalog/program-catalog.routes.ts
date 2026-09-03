import { inject } from '@angular/core';
import { Router, type CanMatchFn, type Routes } from '@angular/router';
import { CATALOG_BASE } from './program-catalog.paths';

/**
 * Program catalog — everything this platform sells, and how each of them proves an income.
 *
 * A LIST and a DETAIL, not a tab shell. The shell that used to sit here fanned out to two
 * assignment boards (loan categories, questions), each rendering every name against every
 * category — so configuring one name meant visiting two screens and holding a 16×4 matrix in
 * your head to compare them. Both facts belong to a single name, so they live on that name's
 * own page, opened from its card like every other object in this dashboard.
 *
 * SURROGATE PRODUCTS LIVE HERE TOO, under `products/`. They were a top-level
 * `/surrogate-products` mount, and the nesting was tried once before and undone for two
 * reasons — neither of which survives the merge that brought them back:
 *
 *  - `products` had to be declared before the single-segment `:key` or every request
 *    resolved as a catalog name called "products". Still true, still handled below, and now
 *    it is one file rather than a cross-mount ordering nobody could see;
 *  - the sidebar could not highlight correctly. Prefix-matching `/program-catalog` lit BOTH
 *    peer items on the products page; `exact: true` then left `/program-catalog/:key`
 *    matching neither. That was a symptom of there being TWO nav items for one section.
 *    There is one now, so default prefix matching lights it on every screen in the subtree —
 *    including the product pages, which used to light nothing.
 *
 * Super-admin only; the role gate lives on `canMatch` at the parent mount in app.routes.ts
 * and covers this whole subtree. Lazy-loaded.
 */

/**
 * `/program-catalog/products` — a real, bookmarkable URL for the surrogate side of the
 * board, which is a query param on the list rather than a route of its own.
 *
 * A `canMatch` and not a `redirectTo` for two reasons that are each sufficient:
 * `redirectTo` cannot carry a query param, and Angular SKIPS `canMatch` on any route that
 * declares `redirectTo` — so the redirect could not be expressed as a guard on a redirect
 * route either. Same shape as `resolveCohortMatchFn` in people.routes.ts.
 */
const surrogateBoardMatchFn: CanMatchFn = () =>
  inject(Router).createUrlTree([CATALOG_BASE], { queryParams: { basis: 'no_payslip' } });

export const PROGRAM_CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./program-catalog.page').then((m) => m.ProgramCatalogPage),
  },

  {
    // ONE create flow for both income bases — see the screen's own header for why it is a
    // screen and not the side sheet it replaces.
    //
    // `new` MUST come before the single-segment `:key` below, for the same reason
    // `products/new` does: under it, it resolves as a catalog name whose key is "new". The
    // mint is guarded too (`RESERVED_NAME_KEYS`), so a name LABELLED "New" cannot take the
    // key either and become a row no URL can open.
    path: 'new',
    loadComponent: () => import('./new-program-name.page').then((m) => m.NewProgramNamePage),
  },

  // --- Surrogate products -------------------------------------------------
  // Declared BEFORE the single-segment `:key` below: `products` is a literal segment and
  // would otherwise resolve as a catalog name of that key.
  //
  // A no-payslip product is not CREATED here any more. The eleven predefined ones are put in
  // by `npm run seed:blueprints`, and the operator's one lifecycle decision about a product
  // is whether it is switched on — which is made on the board, beside the names that sell
  // it. So the library, the anonymous shape picker and the by-hand "add an ask" screen are
  // gone, and every path that used to reach one redirects.
  {
    path: 'products',
    pathMatch: 'full',
    canMatch: [surrogateBoardMatchFn],
    // Never rendered — the guard always redirects. Angular still requires a target, and a
    // component that cannot be reached is a smaller lie than a `redirectTo` that drops the
    // query param the whole route exists to carry.
    loadComponent: () => import('./program-catalog.page').then((m) => m.ProgramCatalogPage),
  },
  {
    // The library's old URL. A REDIRECT rather than a deletion because it has bookmarks and
    // two legacy `/surrogate-products/*` aliases pointing at it — and without a route here
    // Angular falls through to `**` and lands the operator on the DASHBOARD, which reads as
    // the app losing their place rather than as a screen that moved.
    //
    // Still declared before `products/:key`, or it resolves as a product called "new".
    path: 'products/new',
    pathMatch: 'full',
    canMatch: [surrogateBoardMatchFn],
    loadComponent: () => import('./program-catalog.page').then((m) => m.ProgramCatalogPage),
  },
  {
    // The anonymous shape picker's old URL. It needs a redirect for a reason deleting it did
    // not make obvious: with no route here it does NOT fall through to `**` — it matches
    // `products/:key` below with the key "shapes" and renders a product-detail page for a
    // product nobody has. Measured in a browser, not predicted.
    path: 'products/shapes',
    pathMatch: 'full',
    canMatch: [surrogateBoardMatchFn],
    loadComponent: () => import('./program-catalog.page').then((m) => m.ProgramCatalogPage),
  },
  {
    path: 'products/:key/calculation',
    loadComponent: () => import('./product-template.page').then((m) => m.ProductTemplatePage),
  },
  {
    // The by-hand "add an ask" screen is gone: what a product asks is structure the seed
    // owns, and adding a question to a seeded product by hand produced a row no blueprint
    // described. A plain `redirectTo` works here where `products` needed a guard — `:key`
    // substitutes and there is no query param to carry.
    path: 'products/:key/asks/new',
    redirectTo: 'products/:key',
  },
  {
    path: 'products/:key',
    loadComponent: () =>
      import('./surrogate-product-detail.page').then((m) => m.SurrogateProductDetailPage),
  },

  // --- Catalog names ------------------------------------------------------
  {
    // Authoring a question is its own SCREEN, not a dialog over the name: the form branches
    // on the answer type, grows a list of answers and can hold twenty fields.
    path: ':key/questions/new',
    loadComponent: () => import('./new-question.page').then((m) => m.NewQuestionPage),
  },
  {
    // The catalog KEY, not the id: it is stable, human-readable, and already the value every
    // other surface (`bank_program.programNameKey`) stores.
    path: ':key',
    loadComponent: () => import('./program-name-detail.page').then((m) => m.ProgramNameDetailPage),
  },
];
