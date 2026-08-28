import type { Routes } from '@angular/router';

/**
 * Surrogate products — the pre-defined no-payslip calculations a catalog program name
 * links to.
 *
 * A TOP-LEVEL route, not a child of `/program-catalog`, and the nesting was tried first.
 * Two things went wrong under it, and neither has a declarative fix:
 *
 *  - `/program-catalog/:key` is a single segment, so `products` had to be declared before
 *    it or every request resolved as a catalog name called "products";
 *  - the sidebar could not highlight correctly. Prefix-matching `/program-catalog` lit BOTH
 *    peer items on the products page; `exact: true` fixed that and then left
 *    `/program-catalog/compound_owner` — the most-used screen in the section — matching
 *    neither.
 *
 * A product is a peer of the catalog, not a child of it: the catalog lists what banks SELL,
 * this lists how an income is WORKED OUT. Separate URLs say that, and both traps disappear.
 */
export const SURROGATE_PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./surrogate-products.page').then((m) => m.SurrogateProductsPage),
  },
  {
    // Declared BEFORE the single-segment `:key` on purpose. Angular matches leaf routes
    // against the WHOLE remaining URL, so a three-segment path would fall through anyway
    // — but the order also states the intent: this is a screen, not a product called
    // "asks".
    path: ':key/asks/new',
    loadComponent: () => import('./product-fact.page').then((m) => m.ProductFactPage),
  },
  {
    path: ':key',
    loadComponent: () =>
      import('./surrogate-product-detail.page').then((m) => m.SurrogateProductDetailPage),
  },
];
