/**
 * Prisma `BankProgram` row → the pure `BankProgramSnapshot` the matching engine
 * consumes. Lives here, in the domain that owns the row shape, because the
 * engine may not import Prisma (Principle V) and three callers need the same
 * mapping: apply, matching preview, and the calculator. Duplicating it is how
 * the eligibility reconciliation below silently drifts out of sync.
 */

import type { BankProgram } from '@prisma/client';
import type { BankProgramSnapshot, IncomeAssumptionConfig } from '@/matching/types';
import { normalizeIncomeAssumption } from '@/matching/pipeline/income-rule-normalize';
import { effectiveIncomeRule } from '@/matching/pipeline/income-rule-inherit';

/** The row plus the optional joined bank, as `findAllActive` returns it. */
export type BankProgramRow = BankProgram & { bank?: { isFeatured: boolean } | null };

/**
 * Every catalog program name's income rule, keyed by `programNameKey`. Read once
 * per request by the caller and handed in, because this function is called in a
 * `.map()` over the whole active book and must not do IO.
 *
 * OPTIONAL, and omitting it is not a silent fallback: a program on `amounts:'catalog'`
 * mapped without the map keeps its (stripped) tables, which is no table, and the
 * resolver reports `rule_unconfigured` rather than quoting a figure. The two callers
 * that legitimately omit it are the ones whose programs cannot inherit — see each.
 */
export type CatalogIncomeRules = ReadonlyMap<string, IncomeAssumptionConfig>;

export function toBankProgramSnapshot(
  p: BankProgramRow,
  catalogRules?: CatalogIncomeRules,
): BankProgramSnapshot {
  return {
    id: p.id,
    programCode: p.programCode,
    bankName: p.bankName,
    bankIsFeatured: p.bank?.isFeatured ?? false,
    friendlyName: p.friendlyName,
    programType: p.programType,
    productCategory: p.productCategory,
    active: p.active,
    isShariaCompliant: p.isShariaCompliant,
    version: p.version,
    requiredDocuments: (p.requiredDocuments as string[]) ?? [],
    createdAt: p.createdAt,
    tenor: p.tenor as unknown as BankProgramSnapshot['tenor'],
    loanLimits: p.loanLimits as unknown as BankProgramSnapshot['loanLimits'],
    pricing: p.pricing as unknown as BankProgramSnapshot['pricing'],
    eligibility: normalizeEligibility(p.eligibility),
    // Canonical BEFORE the snapshot leaves this module (FR-014). The resolver also
    // normalizes — the function is idempotent — but doing it here means every
    // consumer of a snapshot sees one shape: the engine, the admin simulator, the
    // calculator, and the US3 rule-check overlay, which merges a canonical draft
    // onto this object and would otherwise be merging onto a legacy blob.
    //
    // The catalog merge runs BEFORE normalize, not after: a catalog rule may still
    // carry a legacy figure shape, and normalizing the program first would leave
    // those keys to be upgraded by nobody.
    incomeAssumption: normalizeIncomeAssumption(
      effectiveIncomeRule(
        p.incomeAssumption as unknown as IncomeAssumptionConfig,
        p.programNameKey === null ? undefined : catalogRules?.get(p.programNameKey),
      ),
    ) as unknown as BankProgramSnapshot['incomeAssumption'],
    fees: p.fees as unknown as BankProgramSnapshot['fees'],
    performanceCriteria: p.performanceCriteria as unknown as
      | BankProgramSnapshot['performanceCriteria']
      | undefined,
  };
}

/**
 * Reconcile feature-002 bank-program eligibility JSON with the feature-003
 * engine shape: `ageMin`/`ageMax` → `minAge`/`maxAge`, `acceptedTransferTypes`
 * → `acceptedSalaryTransferTypes`. Without this the age + transfer checks read
 * undefined and reject everyone.
 */
export function normalizeEligibility(raw: unknown): BankProgramSnapshot['eligibility'] {
  const e = (raw ?? {}) as Record<string, unknown>;
  return {
    ...e,
    minAge: e['minAge'] ?? e['ageMin'],
    maxAge: e['maxAge'] ?? e['ageMax'],
    acceptedSalaryTransferTypes: e['acceptedSalaryTransferTypes'] ?? e['acceptedTransferTypes'],
  } as unknown as BankProgramSnapshot['eligibility'];
}
