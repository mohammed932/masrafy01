/**
 * Local mirror of Prisma's `ApplicationStatus` enum.
 *
 * Constitution Principle X / Clean Code Structure: only repositories import
 * from `@prisma/client`. Controllers, services, and DTOs use this local
 * enum. Members match Prisma's schema exactly (same string values).
 */

export enum ApplicationStatus {
  draft = 'draft',
  matched = 'matched',
  no_match = 'no_match',
  archived = 'archived',
  erased = 'erased',
}
