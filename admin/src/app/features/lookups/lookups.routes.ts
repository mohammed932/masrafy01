import type { Routes } from '@angular/router';

export const LOOKUPS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./lookups.page').then((m) => m.LookupsPage),
  },
  {
    // A sibling route, not a tab on the values page: the board answers a different question
    // ("where is each compound priced?") about two types at once, and the values page is a
    // list of ONE type. `?class=` inside it selects the class, matching the `?type=` idiom.
    path: 'compound-classes',
    loadComponent: () =>
      import('./compound-class-board.page').then((m) => m.CompoundClassBoardPage),
  },
];
