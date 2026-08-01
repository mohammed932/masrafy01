# Backend tests

- `unit/` — pure functions (money math, validators, resolvers)
- `integration/` — service-level flows with fakes/in-memory repositories
- `helpers/` — shared assertions (`decimal.ts`: never float-compare money)
