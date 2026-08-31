/**
 * Where the program catalog's screens live.
 *
 * One place, because these paths moved once already: surrogate products were a top-level
 * `/surrogate-products` mount and are now a section of the catalog. That move touched
 * fourteen hardcoded strings across five files, which is exactly the sort of edit that
 * leaves one behind — and a stale absolute path in Angular does not fail to compile, it
 * fails at the click.
 *
 * Absolute, not relative: every caller here is navigating ACROSS the section (a product
 * screen linking to a name, a lookups screen returning to the product it was opened from),
 * so a relative link would resolve against whichever route happened to host it.
 */
import type { Params } from '@angular/router';

/** The board. Catalog names and surrogate products both list here, split by `?basis=`. */
export const CATALOG_BASE = '/program-catalog';

/** A surrogate product's own screens — the calculation, its asks, its shape picker. */
export const PRODUCT_BASE = `${CATALOG_BASE}/products`;

/**
 * Back to the board with the Surrogate side already showing.
 *
 * Split into commands + queryParams rather than a bare string because `routerLink` and
 * `Router.navigate` both take them apart anyway, and a URL string with a `?` in it silently
 * becomes one path segment when passed as a command array.
 */
export function surrogateBoardLink(): { commands: string[]; queryParams: Params } {
  return { commands: [CATALOG_BASE], queryParams: { basis: 'no_payslip' } };
}
