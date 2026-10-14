# Admin patterns (load only if needed)

- Catalog board derivations live in pure modules with specs (`features/program-catalog/catalog-board.ts`); put filter/count logic there, not in the page class.
- Query-param facets (`?basis=`, `?cat=`, `?step=`): signal is truth, `router.navigate([], {queryParamsHandling:'merge', replaceUrl:true})` mirrors it; `null` drops the param.
- Shared rail: `app-rail-tabs` (`appearance="pill"|"segmented"`), wizard rail: `app-wizard-steps`.
- Shell components: `app-form-page` (screen), `app-form-drawer`/`openFormDrawer()` (sheet).
- Basis of a catalog name: `basesOf(row)` in `catalog-board.ts`; per-category map on `ProgramNameRow.bases`.
