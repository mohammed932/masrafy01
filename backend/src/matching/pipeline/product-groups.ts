import type { BankProgramSnapshot } from '../types';

/**
 * The value → class map ONE program reads (v36.1.0, groups per product).
 *
 * A product may file a value in a class of its own — the doctors' product puts Giza in tier 1
 * while every other product keeps it in tier 2 (`surrogate_product_parent_key`). Those rows
 * ride on the program's snapshot (`productParentKeys`) and win over the shared
 * `platform_enumeration.parentKey` for that program only; every value the product has not
 * moved keeps its shared class. Called at the two entry points every quote passes through
 * (`resolveGateIncome`, `quoteProgram`), so preview, the simulator and apply cannot read two
 * different maps for one program.
 */
export function groupsFor(
  program: Pick<BankProgramSnapshot, 'productParentKeys'>,
  shared: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  const own = program.productParentKeys;
  if (own === undefined || Object.keys(own).length === 0) return shared;
  return { ...(shared ?? {}), ...own };
}
