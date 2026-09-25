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
import {
  catalogIScoreOf,
  catalogLoanAmountsOf,
  catalogPlansOf,
  catalogRateOf,
  catalogRuleOf,
  catalogTenorOf,
  effectiveIncomeRule,
} from '@/matching/pipeline/income-rule-inherit';
import { asIScoreTiers, effectiveIScoreTiers } from '@/matching/pipeline/iscore';
import type { CatalogIncomeRules } from '@/matching/pipeline/income-rule-inherit';
import { effectiveTenor } from '@/matching/pipeline/tenor-inherit';
import type { StoredTenor } from '@/matching/pipeline/tenor-inherit';
import { effectiveLoanAmounts } from '@/matching/pipeline/loan-amount-inherit';
import type { StoredLoanLimits } from '@/matching/pipeline/loan-amount-inherit';
import { effectiveRate } from '@/matching/pipeline/rate-inherit';
import type { StoredPricing } from '@/matching/pipeline/rate-inherit';
import {
  effectivePlanFees,
  effectivePlanLoanLimits,
  effectivePlanPricing,
  effectivePlanTenor,
} from '@/matching/pipeline/plan-inherit';

/** The row plus the optional joined bank, as `findAllActive` returns it. */
export type BankProgramRow = BankProgram & { bank?: { isFeatured: boolean } | null };

/**
 * Every catalog program name's resolution, keyed by `programNameKey`. Read once
 * per request by the caller and handed in, because this function is called in a
 * `.map()` over the whole active book and must not do IO.
 *
 * It carries TWO things a program can inherit — the income rule, and the surrogate
 * product's default loan duration — on one map rather than two, because both are read off
 * the same product row through the same link and a second map would be a second chance for
 * the two to disagree about which product a name is filed under.
 *
 * OPTIONAL, and omitting it is not a silent fallback: a program on `amounts:'catalog'`
 * mapped without the map keeps its (stripped) tables, which is no table, and the
 * resolver reports `rule_unconfigured` rather than quoting a figure. The two callers
 * that legitimately omit it are the ones whose programs cannot inherit — see each.
 *
 * An entry is a RESOLUTION, not a rule: it is either the finished catalog rule or a
 * statement that the platform is withholding it (the linked product is switched off).
 * Re-exported from the pipeline module that owns both halves of the link.
 */
export type { CatalogIncomeRules };

export function toBankProgramSnapshot(
  p: BankProgramRow,
  catalogRules?: CatalogIncomeRules,
): BankProgramSnapshot {
  // The catalog name's resolution, taken apart once. The figures are merged either way —
  // a switched-off product keeps its calculation, and what changes is that the snapshot
  // carries the marker below, which `quoteProgram` refuses on before pricing anything.
  const catalog = p.programNameKey === null ? undefined : catalogRules?.get(p.programNameKey);
  const catalogRule = catalogRuleOf(catalog);
  // The PLAN tables, and the programme's own answer about whose apply. Read once here
  // because the four of them live in three different blobs below, and because an absent
  // `plansSource` means `'own'` — so a programme that has never heard of this reads exactly
  // what it reads today.
  const catalogPlans = catalogPlansOf(catalog);
  const plansSource = p.plansSource;
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
    // The DURATION, the program's own when it states one and the product's when it does
    // not. Merged here, on the one line the engine reads a term from, so a snapshot cannot
    // tell a term the bank typed from one it is reading off the product — the same property
    // the income rule two fields down relies on.
    //
    // `effectiveTenor` returns the SAME object when nothing is inherited, which is every
    // program on this database today, so the common path allocates nothing.
    //
    // The PLAN grids merge on the same four lines the blobs are read on, for the same
    // reason: a snapshot must not be able to tell a table the bank typed from one it is
    // reading off the product. Each helper returns the SAME object when nothing is
    // inherited, which is every program on this database today.
    tenor: effectivePlanTenor(
      effectiveTenor(
        p.tenor as unknown as StoredTenor | undefined,
        catalogTenorOf(catalog),
      ) as unknown as BankProgramSnapshot['tenor'],
      plansSource,
      catalogPlans,
    ),
    // The SIZE, on the same terms as the duration above and merged on the same one line the
    // engine reads a floor and a ceiling from. `effectiveLoanAmounts` returns the SAME
    // object when nothing is inherited, which is every program on this database today.
    loanLimits: effectivePlanLoanLimits(
      effectiveLoanAmounts(
        p.loanLimits as unknown as StoredLoanLimits | undefined,
        catalogLoanAmountsOf(catalog),
      ) as unknown as BankProgramSnapshot['loanLimits'],
      plansSource,
      catalogPlans,
    ),
    // The PRICE, the program's own when it states one and the product's when it does not —
    // merged on the one line the engine reads a rate from, for the reason the duration and
    // the size above are merged here: a snapshot must not be able to tell a rate the bank
    // typed from one it is reading off the product.
    //
    // INSIDE the plan merge, never outside it. `effectivePlanPricing` merges the product's
    // `rateByFact` TABLE, which sits at the top of `PRICING_CASCADE_ORDER`; this is the flat
    // figure at the bottom of it. Resolving the bottom first leaves the table free to
    // override it per applicant, which is the order the cascade itself reads them in.
    //
    // `effectiveRate` returns the SAME object when nothing is inherited, which is every
    // program on this database today, so the common path allocates nothing.
    pricing: effectivePlanPricing(
      effectiveRate(
        p.pricing as unknown as StoredPricing | undefined,
        catalogRateOf(catalog),
      ) as unknown as BankProgramSnapshot['pricing'],
      plansSource,
      catalogPlans,
    ),
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
      effectiveIncomeRule(p.incomeAssumption as unknown as IncomeAssumptionConfig, catalogRule),
    ) as unknown as BankProgramSnapshot['incomeAssumption'],
    ...(catalog !== undefined && 'withheld' in catalog
      ? { incomeRuleWithheld: catalog.withheld }
      : {}),
    // The COVER the bank demands on the car, on the same terms as the three merges above:
    // the programme's own table when it states one, the product's when it does not. Merged
    // on the one line the engine reads a premium from, and `effectivePlanFees` returns the
    // SAME object when nothing is inherited — which is every programme on this database
    // that has not opted in.
    fees: effectivePlanFees(
      p.fees as unknown as BankProgramSnapshot['fees'],
      plansSource,
      catalogPlans,
    ),
    // The I-SCORE TIERS, merged on the one line the engine reads them from, for the reason
    // the duration and the plan grids above are merged here: a snapshot must not be able to
    // tell a table the bank typed from one it is reading off the product.
    //
    // Read off the RAW stored blob, deliberately, and not off the merged
    // `incomeAssumption` a few lines up. `effectiveIncomeRule` inherits `stepParams` whole
    // key on `amounts: 'catalog'`, so reading the merged rule would let a program on
    // catalog amounts pick up tiers through a second route and disagree with this one —
    // which is the per-slot inheritance this field was created to replace.
    //
    // `undefined` when neither side states a table, which `resolveIScoreFactor` answers
    // with a 100% multiplier — the same answer the deleted `coalesce` step gave.
    ...(() => {
      const tiers = effectiveIScoreTiers(
        asIScoreTiers((p.incomeAssumption as { iScoreTiers?: unknown } | null)?.iScoreTiers),
        catalogIScoreOf(catalog),
        catalogRules?.platformIScoreTiers,
      );
      return tiers === undefined ? {} : { iScoreTiers: tiers };
    })(),
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
    // The self-employed band the DTO writes as `ageMinSelfEmployed` / `ageMaxSelfEmployed`.
    // Unmapped until now, so `checkEligibility` read `undefined` and every program that had
    // configured a wider band for the self-employed (21–60 salaried, 25–65 self) silently
    // applied the salaried one — a stored figure with no reader.
    selfEmployedMinAge: e['selfEmployedMinAge'] ?? e['ageMinSelfEmployed'],
    selfEmployedMaxAge: e['selfEmployedMaxAge'] ?? e['ageMaxSelfEmployed'],
    selfEmployedMinMonthlyIncomeEGP:
      e['selfEmployedMinMonthlyIncomeEGP'] ?? e['minMonthlyIncomeSelfEmployedEGP'],
    acceptedSalaryTransferTypes: e['acceptedSalaryTransferTypes'] ?? e['acceptedTransferTypes'],
  } as unknown as BankProgramSnapshot['eligibility'];
}
