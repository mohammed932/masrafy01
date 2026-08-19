/**
 * Catalog program name → bank program: the amounts merge. Pure function, no Nest,
 * no Prisma, no clock (Constitution Principle V).
 *
 * A catalog program name states exactly ONE income proof and one set of starting
 * figures. A bank program filed under that name either takes those figures
 * (`amounts: 'catalog'`) or states its own (`amounts: 'own'`, the default and what
 * every pre-existing row means). This module is the ONE place the first case is
 * turned back into a complete rule.
 *
 * It runs in `toBankProgramSnapshot`, which is already the single Prisma-row →
 * engine-snapshot mapping every quote path goes through. Doing it there rather than
 * inside the resolver keeps the engine a pure module that is handed one finished
 * rule, exactly as before — the resolver cannot tell an inherited table from an
 * authored one, and nothing downstream needs to learn a second shape.
 *
 * What is inherited and what is not:
 *
 *   inherited   keyTable / bands / scalar, and the legacy scalar keys a catalog
 *               rule may still carry, because they ARE the figures
 *   never       strategy — copied onto the program at save and enforced equal
 *               (`PROGRAM_NAME_INCOME_PROOF_MISMATCH`), so a reader that switches
 *               on it keeps working against the program object alone
 *   never       dbrCapPercentOverride / requiredDocuments / combinationRule —
 *               bank policy, which is why a bank on catalog amounts still has them
 */

import type { IncomeAssumptionConfig } from '../types';

/**
 * The figure-bearing keys. The legacy five are included because a catalog rule
 * seeded from a legacy program can carry them (`normalizeIncomeAssumption` turns
 * them into `scalar` on read, but the stored blob is whatever was written), and
 * inheriting `scalar` while leaving the legacy key behind would hand the resolver
 * a rule whose two halves disagree.
 */
const AMOUNT_KEYS = [
  'keyTable',
  'bands',
  'scalar',
  'incomeTable',
  'rankIncomeMap',
  'gradeIncomeMap',
  'cdIncomePercent',
  'cdIncomePercentOfDeposits',
  'cdIncomeMinEGP',
  'bankStatementPercent',
  'carInstallmentMultiplier',
  'carLoanAmountPercent',
  'creditCardLimitMultiplier',
] as const satisfies ReadonlyArray<keyof IncomeAssumptionConfig>;

/**
 * Does this program rule take its figures from the catalog?
 *
 * ABSENT reads as `'own'`. Every row written before the field existed carries its
 * own numbers, so the absent case must be the one that changes nothing — a default
 * of `'catalog'` would silently re-point the entire stored book at tables it has
 * never quoted from.
 */
export function inheritsCatalogAmounts(config: IncomeAssumptionConfig): boolean {
  return config.amounts === 'catalog';
}

/**
 * The rule to quote on: the program's own object, with the catalog name's figures
 * merged in when it inherits.
 *
 * Returns the SAME object when nothing is inherited, so the common path allocates
 * nothing and stays referentially stable for callers that memoise on identity.
 *
 * A missing catalog rule is NOT an error here and is NOT substituted: the program is
 * returned as it stands, carrying a strategy and no table, and the resolver reports
 * `rule_unconfigured` — a stated reason. Filling in a zero, or quietly falling back
 * to `declared`, would turn "nobody has set this up" into a number (FR-020).
 */
export function effectiveIncomeRule(
  program: IncomeAssumptionConfig,
  catalogRule: IncomeAssumptionConfig | undefined,
): IncomeAssumptionConfig {
  if (!inheritsCatalogAmounts(program) || catalogRule === undefined) return program;

  const merged: IncomeAssumptionConfig = { ...program };
  for (const key of AMOUNT_KEYS) {
    // Deleted first so an inherited rule never keeps a figure the program left
    // behind: a program that switched from 'own' to 'catalog' before the strip in
    // `persistableIncomeAssumption` ran would otherwise quote its old table.
    delete merged[key];
    const value = catalogRule[key];
    if (value !== undefined) Object.assign(merged, { [key]: value });
  }
  return merged;
}

/**
 * The rule to STORE for a program that takes catalog amounts: its own object with
 * every figure removed.
 *
 * The save path sends the pre-filled copy the operator was looking at, which is the
 * right thing for the screen to do and the wrong thing to keep. Storing it would make
 * the link a one-time copy — the program would go on quoting those numbers after the
 * catalog moved, which is precisely the drift the catalog exists to end.
 *
 * Policy (`dbrCapPercentOverride`, `requiredDocuments`, `combinationRule`) and the
 * strategy are untouched: they are the bank's, not the catalog's.
 */
export function stripInheritedAmounts(config: IncomeAssumptionConfig): IncomeAssumptionConfig {
  if (!inheritsCatalogAmounts(config)) return config;
  const stripped: IncomeAssumptionConfig = { ...config };
  for (const key of AMOUNT_KEYS) delete stripped[key];
  return stripped;
}
