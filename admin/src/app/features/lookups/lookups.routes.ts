import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';

export const LOOKUPS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./lookups.page').then((m) => m.LookupsPage),
  },
  {
    /**
     * The class board moved onto the surrogate product whose calculation reads it.
     *
     * KEPT AS A REDIRECT rather than deleted: this is a live, bookmarkable URL that is in
     * browser histories and runbooks right now, and a 404 would read as "the feature was
     * removed" rather than "it is over there".
     *
     * A `canMatch` guard rather than a declarative `redirectTo`, because the destination
     * needs a query param (`?step=2`, the step that hosts the board) and `redirectTo`
     * cannot carry one.
     */
    path: 'compound-classes',
    canMatch: [
      () => {
        const router = inject(Router);
        return router.createUrlTree(['/program-catalog/products', 'compound_owner'], {
          queryParams: { step: 2 },
        });
      },
    ],
    children: [],
  },
];
