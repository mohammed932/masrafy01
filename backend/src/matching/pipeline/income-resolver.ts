/**
 * Income assumption resolver — pure function.
 *
 * Maps `incomeAssumption.strategy` to an assumed monthly income, and reports
 * WHERE the figure came from. Feature 011 replaced the bare `Decimal` this
 * returned with `IncomeResolution`, because three requirements need the
 * provenance and none of them can derive it from a number (research R5): the
 * offer must record which side won (frozen, Principle I), the admin check panel
 * must say "no row matched" instead of showing a zero (FR-031), and the per-rule
 * DBR override applies only when the income is surrogate-derived (FR-012).
 *
 * The per-strategy ARITHMETIC below is copied unchanged (FR-004 protects the
 * maths from income to installment; this feature changes only which income enters
 * it). What is new is the shape around it: table methods read through
 * `normalizeIncomeAssumption` + `bandFor`, and every miss carries a reason.
 */

import { Decimal } from '@prisma/client/runtime/library';
import {
  factKeyOf,
  isProductRuleStrategy,
  type ApplicantProfile,
  type IncomeAssumptionStrategy,
  type EligibilityConfig,
  type IncomeAssumptionConfig,
  type IncomeResolution,
  type IncomeUnresolvedReason,
  type SurrogateFactValue,
} from '../types';
import { BANK_RELATIONSHIP_FACT_KEY, factsForProgram } from './bank-relationship';
import { normalizeIncomeAssumption } from './income-rule-normalize';
import {
  evaluateProductRule,
  factsReadBy,
  type ProductRule,
  type ProductRuleContext,
} from './product-rule';
import { bandFor } from './income-rule-bands';
import { resolveDbrCap } from './dbr';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;
const ZERO = new Decimal(0);

/** A surrogate figure, or the reason there is none. Never both, never neither. */
type SurrogateOutcome =
  | {
      resolved: true;
      incomeEGP: Decimal;
      matchedRow?: IncomeResolution['matchedRow'];
    }
  | { resolved: false; reason: IncomeUnresolvedReason };

export interface ResolveIncomeArgs {
  profile: ApplicantProfile;
  income: IncomeAssumptionConfig;
  eligibility: EligibilityConfig;
  /**
   * Lookup value → its registry `parentKey`, for a product rule's `factParentTable` step.
   *
   * Optional, and absent for every single-fact rule: only a rule that asks for a parent
   * reads it. A rule that DOES ask and is handed nothing reports `no_matching_row` — a
   * stated reason — rather than pricing off a parent it guessed.
   */
  parentKeyByValue?: Readonly<Record<string, string>>;
  /**
   * The bank whose program is being quoted, for the DERIVED `bank_relationship` fact.
   *
   * Per call rather than on the profile, because the answer differs per program: the same
   * applicant is new to one bank and an existing customer at another. Absent reads as "new
   * to the bank" — the standard column, never a refusal.
   */
  programBankName?: string;
}

/**
 * Resolve the income a quote should run on for an `income_surrogate` program.
 *
 * **The declared baseline is the RAW declared salary.** `applyCompanyTypeAdjustment`
 * — the `eligibility.commercialBankIncomePercent` haircut, a real configured value
 * (`80.0000` / `90.0000` on live programs) — is deliberately NOT applied here.
 * `quote.ts` step 3 states the invariant it protects: "two screens quoting the same
 * person must show the same number", and the customer-facing answer is "what your
 * salary supports", not "what this bank would concede".
 *
 * This is not a stylistic choice. `income_surrogate` is not a niche type in the
 * seeded data — every business-category program plus the doctor / professional /
 * pharmacy archetypes carry it with `strategy: 'declared'`. Applying the haircut
 * on delegation would move their live figures for a reason unrelated to this
 * feature and break SC-009 (research R4). `applyCompanyTypeAdjustment` is applied
 * by the caller that genuinely wants a bank's internal recognition percentage —
 * the ELIGIBILITY check — and by no one on the quote path.
 */
export function resolveAssumedIncome(args: ResolveIncomeArgs): IncomeResolution {
  const { profile, eligibility } = args;
  const config = normalizeIncomeAssumption(args.income);
  const strategy = config.strategy;

  const declared = profile.employment?.monthlyNetSalaryEGP ?? ZERO;
  const hasDeclared = declared.greaterThan(0);

  // A PRODUCT RULE whose answer is a CEILING never meets the declared salary. It is not
  // an opinion about what the applicant earns — it is what their collateral supports —
  // so `greater_of` against a payslip would quote a ceiling the unit never carried, and
  // falling back to the salary on a miss would price a collateral product for somebody
  // whose collateral the bank has not priced. Returned here, before `decide()`, so no
  // combination rule can reach it.
  if (isProductRuleStrategy(strategy)) {
    return resolveProductRule({
      profile,
      config,
      eligibility,
      strategy,
      ...(args.parentKeyByValue !== undefined ? { parentKeyByValue: args.parentKeyByValue } : {}),
      ...(args.programBankName !== undefined ? { programBankName: args.programBankName } : {}),
    });
  }

  const surrogate = resolveSurrogateIncome(profile, config);

  const decided = decide({
    declared,
    hasDeclared,
    surrogate,
    combinationRule: config.combinationRule,
  });

  // The override is read only when the income the quote will run on actually came
  // from the rule (FR-012). A `declared` outcome on a surrogate program is a
  // payslip figure and gets the program's own cap.
  const cap = resolveRuleDbrCap({
    eligibility,
    override: config.dbrCapPercentOverride,
    ...(profile.employment?.employmentType !== undefined
      ? { employmentType: profile.employment.employmentType }
      : {}),
    origin: decided.origin,
    incomeEGP: decided.incomeEGP,
  });

  return {
    incomeEGP: decided.incomeEGP,
    origin: decided.origin,
    strategy,
    ...(decided.unresolvedReason ? { unresolvedReason: decided.unresolvedReason } : {}),
    ...(decided.matchedRow ? { matchedRow: decided.matchedRow } : {}),
    dbrCapPercent: cap.capPercent,
    dbrCapSource: cap.source,
    dbrBandIndex: cap.bandIndex,
  };
}

/**
 * Which figure wins, and what that makes the origin.
 *
 * `combinationRule` finally executes here. Until this feature it never did on the
 * apply path: `quote.ts` took any declared salary > 0 outright, and `monthly_income`
 * is a bound REQUIRED numeric question, so a submitted application always carries
 * one (research R4). A perfectly configured grade table was ignored for every real
 * applicant.
 */
function decide(args: {
  declared: Decimal;
  hasDeclared: boolean;
  surrogate: SurrogateOutcome;
  combinationRule: IncomeAssumptionConfig['combinationRule'];
}): {
  incomeEGP: Decimal;
  origin: IncomeResolution['origin'];
  unresolvedReason?: IncomeUnresolvedReason;
  matchedRow?: IncomeResolution['matchedRow'];
} {
  const { declared, hasDeclared, surrogate, combinationRule } = args;

  if (!surrogate.resolved) {
    // No surrogate figure. A declared salary still carries the quote — an
    // unconfigured rule must not blank out a program whose applicant stated an
    // income. Only when BOTH are absent is the outcome `none`, and then the reason
    // says which fact or row was missing so the admin knows what to fix.
    if (hasDeclared) return { incomeEGP: declared, origin: 'declared' };
    return { incomeEGP: ZERO, origin: 'none', unresolvedReason: surrogate.reason };
  }

  if (!hasDeclared) {
    // No salary to combine with, so the surrogate figure stands whatever the rule
    // says. This is a deliberate divergence from the pre-011 code, which ran the
    // combination against a baseline of ZERO and therefore turned `lesser_of` into
    // `min(surrogate, 0)` — no income at all, for an applicant the rule had just
    // priced. Reachable by no seeded or stored program (nothing carries
    // `combinationRule`; research R4 explains why), so no figure moves.
    return {
      incomeEGP: surrogate.incomeEGP,
      origin: 'surrogate',
      ...(surrogate.matchedRow ? { matchedRow: surrogate.matchedRow } : {}),
    };
  }

  switch (combinationRule) {
    case 'greater_of': {
      const surrogateWins = surrogate.incomeEGP.greaterThan(declared);
      return {
        incomeEGP: surrogateWins ? surrogate.incomeEGP : declared,
        origin: surrogateWins ? 'surrogate_over_declared' : 'declared_over_surrogate',
        ...(surrogateWins && surrogate.matchedRow ? { matchedRow: surrogate.matchedRow } : {}),
      };
    }
    case 'lesser_of': {
      const surrogateWins = surrogate.incomeEGP.lessThan(declared);
      return {
        incomeEGP: surrogateWins ? surrogate.incomeEGP : declared,
        origin: surrogateWins ? 'surrogate_over_declared' : 'declared_over_surrogate',
        ...(surrogateWins && surrogate.matchedRow ? { matchedRow: surrogate.matchedRow } : {}),
      };
    }
    default:
      // Absent rule = the surrogate REPLACES the declared figure. That is the
      // point of an income-surrogate program: the declared number is not the
      // operative one.
      return {
        incomeEGP: surrogate.incomeEGP,
        origin: 'surrogate',
        ...(surrogate.matchedRow ? { matchedRow: surrogate.matchedRow } : {}),
      };
  }
}

/**
 * A step pipeline. Two shapes of answer, and they take different routes:
 *
 *   `monthlyIncome` — the figure IS an assumed income, so it lands exactly where a
 *   single-fact rule's figure lands, `origin: 'surrogate'` and all. A product rule that
 *   happens to compute an income is not a different kind of income.
 *
 *   `maxAmount` — the figure is a borrowing CEILING. `incomeEGP` stays 0 and the ceiling
 *   travels in its own field, because the income it implies depends on the rate and the
 *   FINAL tenor, and this function knows neither. `quoteProgram` does the conversion,
 *   once, after the tenor clamps (see `product-rule-ceiling.ts`).
 *
 * A miss carries the same four reasons a single-fact rule reports, plus `gate_failed`,
 * plus the fact keys still unanswered — which is what lets a surface say "answer these
 * six questions" instead of "something is missing".
 */
function resolveProductRule(args: {
  profile: ApplicantProfile;
  config: IncomeAssumptionConfig;
  eligibility: EligibilityConfig;
  strategy: IncomeAssumptionStrategy;
  parentKeyByValue?: Readonly<Record<string, string>>;
  programBankName?: string;
}): IncomeResolution {
  const { profile, config, eligibility, strategy } = args;
  const facts: Readonly<Record<string, SurrogateFactValue>> = factsForProgram({
    profile,
    ...(args.programBankName !== undefined ? { programBankName: args.programBankName } : {}),
  });
  const ctx: ProductRuleContext = {
    facts,
    ...(args.parentKeyByValue !== undefined ? { parentKeyByValue: args.parentKeyByValue } : {}),
  };
  const rule = config as ProductRule;
  const outcome = evaluateProductRule(rule, ctx);

  if (!outcome.ok) {
    // Against the SAME map the rule ran on, so a derived fact — always answered — never
    // shows up as a question the applicant should go back and answer.
    const missing = factsReadBy(rule).filter((key) => facts[key] === undefined);
    const cap = resolveRuleDbrCap({
      eligibility,
      override: config.dbrCapPercentOverride,
      ...(profile.employment?.employmentType !== undefined
        ? { employmentType: profile.employment.employmentType }
        : {}),
      // A miss is not surrogate-DERIVED, so the rule's own DBR override does not apply —
      // the same rule `decide()` follows for every other unresolved outcome.
      origin: 'none',
      incomeEGP: ZERO,
    });
    return {
      incomeEGP: ZERO,
      origin: 'none',
      strategy,
      unresolvedReason: outcome.reason,
      ...(outcome.gateId !== undefined ? { gateId: outcome.gateId } : {}),
      ...(outcome.gateReasonCode !== undefined ? { gateReasonCode: outcome.gateReasonCode } : {}),
      ...(missing.length > 0 ? { missingFactKeys: missing } : {}),
      productRuleSteps: outcome.steps,
      dbrCapPercent: cap.capPercent,
      dbrCapSource: cap.source,
      dbrBandIndex: cap.bandIndex,
    };
  }

  if (outcome.kind === 'monthlyIncome') {
    const cap = resolveRuleDbrCap({
      eligibility,
      override: config.dbrCapPercentOverride,
      ...(profile.employment?.employmentType !== undefined
        ? { employmentType: profile.employment.employmentType }
        : {}),
      origin: 'surrogate',
      incomeEGP: outcome.valueEGP,
    });
    return {
      incomeEGP: outcome.valueEGP,
      origin: 'surrogate',
      strategy,
      ...(outcome.matchedRow ? { matchedRow: outcome.matchedRow } : {}),
      productRuleSteps: outcome.steps,
      dbrCapPercent: cap.capPercent,
      dbrCapSource: cap.source,
      dbrBandIndex: cap.bandIndex,
    };
  }

  // A ceiling. The cap is resolved against ZERO income rather than the ceiling: the cap
  // BANDS are keyed by monthly income, and feeding an AMOUNT into them would pick a band
  // by comparing a two-million-pound ceiling against a ten-thousand-pound income edge.
  // `quoteProgram` re-resolves the cap once it has the implied income, which is the only
  // figure the bands were ever meant to be searched with.
  const cap = resolveRuleDbrCap({
    eligibility,
    override: config.dbrCapPercentOverride,
    ...(profile.employment?.employmentType !== undefined
      ? { employmentType: profile.employment.employmentType }
      : {}),
    origin: 'surrogate',
    incomeEGP: ZERO,
  });
  const baselineRaw = rule.output?.baselineDbrPercent;
  const baseline = baselineRaw !== undefined ? toDecimalOrNull(baselineRaw) : null;
  return {
    incomeEGP: ZERO,
    origin: 'ceiling',
    strategy,
    ceilingAmountEGP: outcome.valueEGP,
    // A rule that states no baseline was calibrated against the bank's normal cap, which
    // makes the haircut ratio exactly 1 and changes nothing.
    ceilingBaselineDbrPercent: baseline ?? cap.capPercent,
    ...(outcome.matchedRow ? { matchedRow: outcome.matchedRow } : {}),
    productRuleSteps: outcome.steps,
    dbrCapPercent: cap.capPercent,
    dbrCapSource: cap.source,
    dbrBandIndex: cap.bandIndex,
  };
}

/** Tolerant parse — a malformed baseline reads as "not stated", never as zero. */
function toDecimalOrNull(value: string): Decimal | null {
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/** FR-012 — the rule's own cap, but only over a surrogate-derived income. */
function resolveRuleDbrCap(args: {
  eligibility: EligibilityConfig;
  override: string | undefined;
  origin: IncomeResolution['origin'];
  incomeEGP: Decimal;
  /** The applicant's employment answer, for a program that caps by bucket. */
  employmentType?: string;
}): {
  capPercent: Decimal;
  source: IncomeResolution['dbrCapSource'];
  bandIndex: number | null;
} {
  const surrogateDerived = args.origin === 'surrogate' || args.origin === 'surrogate_over_declared';
  const resolution = resolveDbrCap(
    {
      // `?? '0'` only reshapes an absent value for the type: `toDecimalOrNull`
      // inside already treats undefined as "no scalar cap" and yields 0.
      dbrCapPercent: args.eligibility?.dbrCapPercent ?? '0',
      dbrBands: args.eligibility?.dbrBands,
      ...(args.eligibility?.dbrCapPercentByEmploymentType !== undefined
        ? { dbrCapPercentByEmploymentType: args.eligibility.dbrCapPercentByEmploymentType }
        : {}),
    },
    args.incomeEGP,
    surrogateDerived ? args.override : undefined,
    args.employmentType,
  );
  return {
    capPercent: resolution.capPercent,
    source: resolution.source,
    bandIndex: resolution.bandIndex ?? null,
  };
}

/**
 * A bank's internal recognition percentage for a declared salary.
 *
 * NOT applied to the customer-facing figures — see the note on
 * `resolveAssumedIncome`. It IS applied to the income the ELIGIBILITY check reads
 * (`engine.service.ts#evaluateProgram`), which is the question it answers: whether
 * this bank would lend at all is decided on what the bank recognises, not on what
 * the payslip says. Leaving it with no caller silently dropped a configured
 * `commercialBankIncomePercent: '80.0000'` from the minimum-income comparison,
 * masked only by `skipEligibility` being set for MVP.
 */
export function applyCompanyTypeAdjustment(
  declared: Decimal,
  profile: ApplicantProfile,
  eligibility: EligibilityConfig,
): Decimal {
  if (profile.employment.bankCategory === 'commercial' && eligibility.commercialBankIncomePercent) {
    return declared
      .mul(eligibility.commercialBankIncomePercent)
      .div(100)
      .toDecimalPlaces(2, ROUND_BANKERS);
  }
  if (profile.employment.bankCategory === 'public' && eligibility.publicBankIncomePercent) {
    return declared
      .mul(eligibility.publicBankIncomePercent)
      .div(100)
      .toDecimalPlaces(2, ROUND_BANKERS);
  }
  return declared;
}

/**
 * The surrogate figure for one strategy, or the reason there is none.
 *
 * Every arithmetic expression below is the pre-011 code verbatim. The change is
 * that a miss now says WHY: `fact_not_answered` when the applicant carries no
 * value for the fact the method reads, `no_matching_row` / `no_matching_band`
 * when they do but the bank's table does not cover it, `rule_unconfigured` when
 * the program never configured the method. Those four drive different admin
 * actions and were previously all `null`.
 */
function resolveSurrogateIncome(
  profile: ApplicantProfile,
  config: IncomeAssumptionConfig,
): SurrogateOutcome {
  // A REGISTRY fact, resolved before the built-in switch. Checked first rather than
  // in the `default` branch so that a fact key which happens to collide with a
  // built-in token can never be shadowed by it: `fact:` names the registry, always.
  const factKey = factKeyOf(config.strategy);
  if (factKey !== null) return resolveRegistryFact(profile, config, factKey);

  switch (config.strategy) {
    case 'declared':
      // Not a miss: this method has nothing to resolve. `rule_unconfigured` is
      // reported so a `declared`-strategy program with no salary reads as "this
      // program has no income rule to fall back on" rather than as a broken table.
      return { resolved: false, reason: 'rule_unconfigured' };

    case 'byYearsInJob':
      return lookupBands(
        new Decimal(Math.floor((profile.employment?.monthsInJob ?? 0) / 12)),
        config,
        // `monthsInJob` is part of every employment payload, so there is no
        // "unanswered" state to distinguish here — but "the bank has no table at
        // all" still is. Reporting `no_matching_band` for an unconfigured method
        // told the customer "this bank's table doesn't cover your answer" when the
        // truth was that nobody had configured one, and sent the admin to add a row
        // instead of to configure the rule (research R9).
        true,
      );

    case 'byYearsInPractice': {
      const years = profile.employment?.yearsInPractice;
      if (years === undefined || years === null) {
        return { resolved: false, reason: 'fact_not_answered' };
      }
      return lookupBands(new Decimal(years), config, true);
    }

    case 'byProfessorRank':
      return lookupKey(profile.employment?.professorRank, config);

    case 'byMilitaryGrade':
      return lookupKey(profile.employment?.militaryGrade, config);

    case 'byCDValue': {
      const cd = profile.assets?.cdAtABKValueEGP;
      if (!cd) return { resolved: false, reason: 'fact_not_answered' };
      if (cd.lessThanOrEqualTo(0)) return { resolved: false, reason: 'fact_not_answered' };
      // Bands where an admin configured them; otherwise the legacy percent, whose
      // output must not move (FR-015).
      if (config.bands?.length) return lookupBands(cd, config, true);
      const percent = new Decimal(config.scalar?.value ?? config.cdIncomePercent ?? '3');
      const monthly = cd.mul(percent).div(100).div(12);
      const floor = config.cdIncomeMinEGP ? new Decimal(config.cdIncomeMinEGP) : null;
      const result = floor && monthly.lessThan(floor) ? floor : monthly;
      return { resolved: true, incomeEGP: result.toDecimalPlaces(2, ROUND_BANKERS) };
    }

    case 'byTotalDeposits': {
      const dep = profile.assets?.totalDepositsAtABKValueEGP;
      if (!dep) return { resolved: false, reason: 'fact_not_answered' };
      if (dep.lessThanOrEqualTo(0)) return { resolved: false, reason: 'fact_not_answered' };
      if (config.bands?.length) return lookupBands(dep, config, true);
      const percent = new Decimal(
        config.scalar?.value ?? config.cdIncomePercentOfDeposits ?? config.cdIncomePercent ?? '2',
      );
      return {
        resolved: true,
        incomeEGP: dep.mul(percent).div(100).div(12).toDecimalPlaces(2, ROUND_BANKERS),
      };
    }

    case 'byCarInstallment': {
      const inst = profile.assets?.carInstallmentEGP;
      if (!inst || inst.lessThanOrEqualTo(0))
        return { resolved: false, reason: 'fact_not_answered' };
      const mult = new Decimal(config.scalar?.value ?? config.carInstallmentMultiplier ?? '4');
      return { resolved: true, incomeEGP: inst.mul(mult).toDecimalPlaces(2, ROUND_BANKERS) };
    }

    case 'byCarLoanAmount': {
      const loan = profile.assets?.autoLoanAtOtherBankEGP ?? profile.assets?.autoLoanAtABKEGP;
      if (!loan || loan.lessThanOrEqualTo(0))
        return { resolved: false, reason: 'fact_not_answered' };
      const percent = new Decimal(config.scalar?.value ?? config.carLoanAmountPercent ?? '5');
      return {
        resolved: true,
        incomeEGP: loan.mul(percent).div(100).div(12).toDecimalPlaces(2, ROUND_BANKERS),
      };
    }

    case 'byCreditCardLimit': {
      const lim = profile.assets?.creditCardLimitEGP;
      if (!lim || lim.lessThanOrEqualTo(0)) return { resolved: false, reason: 'fact_not_answered' };
      const mult = new Decimal(config.scalar?.value ?? config.creditCardLimitMultiplier ?? '0.1');
      return { resolved: true, incomeEGP: lim.mul(mult).toDecimalPlaces(2, ROUND_BANKERS) };
    }

    case 'byBankStatementPercent': {
      const bal = profile.assets?.bankStatementBalanceEGP;
      if (!bal || bal.lessThanOrEqualTo(0)) return { resolved: false, reason: 'fact_not_answered' };
      const percent = new Decimal(config.scalar?.value ?? config.bankStatementPercent ?? '10');
      return {
        resolved: true,
        incomeEGP: bal.mul(percent).div(100).toDecimalPlaces(2, ROUND_BANKERS),
      };
    }

    default:
      return { resolved: false, reason: 'rule_unconfigured' };
  }
}

/**
 * A fact from the REGISTRY — the generic form of the four hand-written fact methods
 * above, and the reason a fifth one is an operator action rather than a release.
 *
 * The shape of the bank's table follows the ANSWER, not a stored declaration: a picked
 * option is a key-table lookup, a number is a band lookup. Nothing here has to know
 * which question the fact is bound to; that binding was applied when the profile was
 * built, and re-deciding it here would be the two-places-one-truth drift A33 names.
 *
 * A fact the applicant did not answer is `fact_not_answered` — never a zero, and never
 * a fall-through to the declared salary without saying so (FR-020).
 */
function resolveRegistryFact(
  profile: ApplicantProfile,
  config: IncomeAssumptionConfig,
  factKey: string,
): SurrogateOutcome {
  const answered = profile.surrogateFacts?.[factKey];
  // Covers all three ways this reads as unanswered — the applicant skipped the
  // question, the fact is bound to no question, or the fact was retired from the
  // registry — because the customer-facing consequence is identical and the admin's
  // fix is found from the program's own rule either way.
  if (!answered) return { resolved: false, reason: 'fact_not_answered' };

  if (answered.kind === 'choice') return lookupKey(answered.optionCode, config);
  // `reportUnconfigured: true` — an empty band table means the BANK never entered one,
  // which is a different fix from "your number is outside our table". Reporting
  // `no_matching_band` there would send the admin to add a row to a table that does
  // not exist yet.
  return lookupBands(answered.value, config, true);
}

/** Key-table lookup: fail CLOSED on a key the table does not carry (AS-1.9). */
function lookupKey(key: string | undefined, config: IncomeAssumptionConfig): SurrogateOutcome {
  if (!key) return { resolved: false, reason: 'fact_not_answered' };
  const table = config.keyTable;
  if (!table?.length) return { resolved: false, reason: 'rule_unconfigured' };
  const row = table.find((r) => r.key === key);
  // The applicant answered and the bank's table has no row for that answer — a
  // different problem from an unanswered question, and a different admin fix.
  if (!row) return { resolved: false, reason: 'no_matching_row' };
  let income: Decimal;
  try {
    income = new Decimal(row.incomeEGP);
  } catch {
    return { resolved: false, reason: 'no_matching_row' };
  }
  if (!income.isFinite() || income.lessThanOrEqualTo(0)) {
    return { resolved: false, reason: 'no_matching_row' };
  }
  return { resolved: true, incomeEGP: income, matchedRow: { key: row.key } };
}

function lookupBands(
  value: Decimal,
  config: IncomeAssumptionConfig,
  reportUnconfigured: boolean,
): SurrogateOutcome {
  const result = bandFor(value, config.bands);
  if (result.matched) {
    return {
      resolved: true,
      incomeEGP: result.incomeEGP,
      matchedRow: {
        fromInclusive: result.band.fromInclusive,
        toExclusive: result.band.toExclusive,
      },
    };
  }
  if (result.reason === 'no_bands') {
    return {
      resolved: false,
      reason: reportUnconfigured ? 'rule_unconfigured' : 'no_matching_band',
    };
  }
  return { resolved: false, reason: 'no_matching_band' };
}
