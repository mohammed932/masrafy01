/**
 * Local mirror of the Prisma `StaffRole` enum.
 *
 * Constitution Principle X / Clean Code Structure: only repositories import
 * from `@prisma/client`. Services, controllers, DTOs, and cross-feature code
 * use this local enum instead. Member values MUST match the corresponding
 * value in `prisma/schema.prisma` exactly (same string), so no runtime
 * mapping is needed — repositories cast at the Prisma boundary.
 *
 * Exposed as a string-literal union (NOT a TypeScript enum object) to match
 * Prisma's generated type shape: callers can use raw string literals
 * (`@Roles('super_admin')`) without an explicit `StaffRole.super_admin` import,
 * matching the pre-refactor ergonomics.
 *
 * Anti-Pattern reference: A8 (controllers leaking `@prisma/client`).
 */
export const STAFF_ROLE_VALUES = [
  'super_admin',
  'sales_manager',
  'sales_agent',
  'analyst',
] as const;

export type StaffRole = (typeof STAFF_ROLE_VALUES)[number];
