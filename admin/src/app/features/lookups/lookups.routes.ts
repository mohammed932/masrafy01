import { type Routes } from '@angular/router';

export const LOOKUPS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./lookups.page').then((m) => m.LookupsPage),
  },
  {
    // Its own URL, deliberately: a screen holding four hundred pasted lines has to survive an
    // interruption, and a side sheet dismissed by a stray Esc loses all of it. Reached from
    // the values panel and from the product screen; the two are told apart by `?from=`, which
    // is also how Cancel knows where to go back to. See `PasteValuesPage` for why a raw
    // return URL is not accepted.
    path: 'paste',
    loadComponent: () => import('./paste-values.page').then((m) => m.PasteValuesPage),
  },
];
