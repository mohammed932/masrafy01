/**
 * Local mirror of Prisma's `AttemptOutcome` enum.
 *
 * Constitution Principle X / Clean Code Structure: only repositories import
 * from `@prisma/client`. Services, controllers, and DTOs use this local enum.
 * Member values match Prisma's schema exactly (same string values).
 *
 * Exposed both as a TypeScript enum (for `AttemptOutcome.SUCCESS` style use in
 * services) AND a string-literal union (`AttemptOutcomeValue`) for assignability
 * from raw string literals.
 */
export enum AttemptOutcome {
  SUCCESS = 'SUCCESS',
  WRONG_CREDENTIALS = 'WRONG_CREDENTIALS',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  LOCKED_OUT = 'LOCKED_OUT',
}
