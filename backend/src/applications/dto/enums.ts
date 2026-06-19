/**
 * Local mirrors of Prisma enums used by the applications feature.
 *
 * Constitution Principle X / Clean Code Structure: only repositories import
 * from `@prisma/client`. Controllers, services, and DTOs use these local
 * enums. Members match Prisma's schema exactly (same string values).
 */

export enum ApplicationStatus {
  draft = 'draft',
  matched = 'matched',
  no_match = 'no_match',
  archived = 'archived',
  erased = 'erased',
}

export enum LeadStatus {
  pending = 'pending',
  in_progress = 'in_progress',
  done = 'done',
  cancelled = 'cancelled',
}
