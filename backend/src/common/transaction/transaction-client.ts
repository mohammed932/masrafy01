/**
 * Local type alias for Prisma's `TransactionClient`.
 *
 * Constitution Principle X (Repository Pattern Mandatory) carve-out: only
 * repositories import from `@prisma/client`. Services orchestrating
 * `prisma.$transaction(async (tx) => …)` need a parameter type for `tx`
 * but should not pull the `Prisma` namespace into the service file. This
 * re-export keeps services free of direct `@prisma/client` imports.
 *
 * The type is structurally identical to Prisma's — same method surface,
 * same callable shape. Repositories continue to accept this type via
 * their optional `tx?: TransactionClient` parameter.
 */
import type { Prisma } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;
