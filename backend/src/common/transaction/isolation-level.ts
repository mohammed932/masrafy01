/**
 * Local mirror of Prisma's `TransactionIsolationLevel` enum.
 *
 * Constitution Principle X (Repository Pattern Mandatory) carve-out:
 * services may orchestrate `prisma.$transaction(...)` callbacks, but they
 * MUST NOT import the `Prisma` namespace at runtime. This file gives
 * services a string-literal mirror they can pass to the `isolationLevel`
 * option without touching `@prisma/client`.
 *
 * The literal values match Prisma's own enum exactly, and Prisma's
 * `TransactionIsolationLevel` is itself a string-literal union, so values
 * from `IsolationLevel` are assignable to the Prisma option type without
 * a cast.
 */
export const IsolationLevel = {
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable',
} as const;

export type IsolationLevel = (typeof IsolationLevel)[keyof typeof IsolationLevel];
