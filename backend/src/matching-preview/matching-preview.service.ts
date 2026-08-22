import { Injectable } from '@nestjs/common';
import { BankProgramType, LoanCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import { WeightedApprovalScoringService } from '@/scoring/weighted-approval.service';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import { toBankProgramSnapshot } from '@/bank-programs/bank-program-snapshot.mapper';
import { matchesRequestedScope } from '@/bank-programs/program-scope';
import { ProgramNameScopeService } from '@/platform-enumerations/program-name-scope.service';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { quoteProgram } from '@/matching/pipeline/quote';
import {
  DEBT_TYPES_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  resolveObligations,
  type ObligationsResolution,
} from '@/matching/pipeline/money-field-bindings';
import {
  surrogateFactsFromAnswers,
  surrogateOptionPick,
  type SurrogateFacts,
} from '@/matching/pipeline/surrogate-facts-from-answers';
import type { ApplicantProfile, ApprovalFactors, Quote } from '@/matching/types';
import type { SelectedAnswer } from '@/matching/scoring/approval-probability.scorer';
import { toSelectedAnswer } from '@/matching/scoring/answer-to-selected';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';
import { validateAnswer } from '@/questionnaire/validation/answer-validation';
import { isQuestionVisible } from '@/questionnaire/validation/question-visibility';

interface SnapshotOption {
  code: string;
}
interface SnapshotQuestion {
  code: string;
  /** Absent on a pre-010 snapshot — read as SINGLE_SELECT (FR-045). */
  type?: string | null;
  /**
   * Frozen at publish (v12.0.0). Absent on a pre-v12 snapshot, which predates
   * per-category assignment and therefore reads as "asked for all categories".
   */
  categories?: string[] | null;
  /** Frozen branching rule; absent means always shown. */
  enabledWhen?: unknown;
  options: SnapshotOption[];
  numeric?: { minValue?: string | null; maxValue?: string | null; step?: string | null } | null;
  text?: { maxLength?: number | null } | null;
}
interface Snapshot {
  category: string;
  groups: { questions: SnapshotQuestion[] }[];
}

/** The money block a quoted program carries. Decimal strings (Principle I). */
export interface PreviewFigures {
  offeredAmountEGP: string;
  cashToCustomerEGP: string;
  totalFeesEGP: string;
  monthlyInstallmentEGP: string;
  effectiveTenorMonths: number;
  effectiveRatePercent: string;
  totalPayableEGP: string;
  totalCostOfCreditEGP: string;
  dbrPercent: string;
  dbrCapPercent: string;
  dbrBandIndex: number | null;
  maxAffordableAmountEGP: string;
  bindingConstraint: string;
  /**
   * What this applicant's COLLATERAL supports at this program — the ceiling the product
   * rule derived, before obligations.
   *
   * Beside `maxAffordableAmountEGP`, not instead of it: the two answer different questions
   * ("what does the unit carry" vs "what do your existing payments leave"), and a card that
   * shows only the second cannot explain a ceiling the applicant did not state.
   * `null` for every program that does not price off collateral.
   */
  collateralCeilingEGP: string | null;
  fees: { adminFeeEGP: string; stampDutyEGP: string; lifeInsuranceEGP: string };
}

export interface PreviewMatch {
  bankProgramId: string | null;
  programCode: string;
  bankName: string;
  bankIsFeatured: boolean;
  isShariaCompliant: boolean;
  programFriendlyName: string;
  eligible: boolean;
  monthlyInstallmentEGP: string | null;
  effectiveRatePercent: string | null;
  /** The applicant's ceiling at this program; null until the money answers are in. */
  maxAffordableAmountEGP: string | null;
  figures: PreviewFigures | null;
  /** Why `figures` is null. `MONEY_FIGURE_MISSING` = the answers aren't in yet. */
  figuresUnavailableReason: string | null;
  /**
   * When the reason is `PRODUCT_RULE_GATE_FAILED`: which condition refused, as one of the closed
   * `GATE_REASON_CODES`. Same field the apply response carries, so preview and apply explain the
   * same refusal in the same words.
   */
  gateReasonCode: string | null;
  /** When a product rule read answers the applicant has not given: which ones. */
  missingFactKeys: string[] | null;
  approvalProbability: number;
  approvalTier: string;
  /**
   * Per-answer contribution breakdown behind `approvalProbability`, biggest
   * first — the SAME numbers the scorer used, not a second derivation
   * (`buildFactorBreakdown`). Already computed by `scoreProgram`; surfaced so a
   * surface can explain a score instead of asserting one. Empty when the program
   * has no ACTIVE weight set (`usedDefaultWeights`) or nothing asked scored.
   */
  approvalFactors: ApprovalFactors;
  rejectionReasons: string[];
  requiredDocuments: string[];
  usedDefaultWeights: boolean;
}

/** The four bound money figures, once resolved. */
interface MoneyInputs {
  requestedAmountEGP: Decimal;
  tenorMonths: number;
  monthlyIncomeEGP: Decimal;
  /** Summed from the per-debt answers when the snapshot serves them. */
  existingObligationsEGP: Decimal;
  hasCurrentLoan: boolean;
}

/**
 * Fallback for the ADMIN simulator only, where no customer exists and the admin
 * left the sample applicant's age blank: the youngest adult, so the
 * age-at-maturity rule never shortens a term. The customer preview always passes
 * the age derived from its caller's `birthday` (Principle XXXVII / A31).
 */
export const SIMULATOR_DEFAULT_AGE = 18;

/**
 * Mobile matching preview (MVP). Validates the submitted answers against the
 * active questionnaire snapshot, then ranks EVERY active program in the category
 * by the per-bank per-answer weighted score (Principle V). Eligibility gating is
 * dropped — there are no hard filters; all programs are returned. JWT-gated.
 */
@Injectable()
export class MatchingPreviewService {
  constructor(
    private readonly questionnaire: QuestionnaireRepository,
    private readonly weightedScoring: WeightedApprovalScoringService,
    private readonly programs: BankProgramRepository,
    private readonly programNames: ProgramNameScopeService,
    private readonly enumerations: PlatformEnumerationsRepository,
  ) {}

  /**
   * `age` prices the tenor through the age-at-maturity rule, so it must be the
   * SAME number apply would use: the customer controller derives it from the
   * caller's `birthday`, the admin simulator passes the sample applicant's.
   *
   * `programNameKey` narrows the matched set to one catalog archetype. Validated
   * BEFORE any work: a stale key must come back as a typed rejection the app can
   * act on ("pick again"), not as an empty shortlist indistinguishable from
   * "no bank offers this".
   *
   * `programType` narrows it to one income basis. NOT validated up front, unlike
   * the key: both values are always legal (the enum partitions every active
   * program), so the only failure mode is "nothing offered on that basis right
   * now", which is a shortlist outcome rather than a bad request.
   */
  async preview(args: {
    category: LoanCategory;
    answers: SubmittedAnswerDto[];
    age: number;
    programNameKey?: string;
    programType?: BankProgramType;
  }) {
    if (args.programNameKey) {
      await this.programNames.assertOfferedUnder(args.programNameKey, args.category);
    }
    const { selected, money, askedQuestionCodes, surrogateFacts } =
      await this.resolveSelectedOptions(args.answers, args.category);
    return this.runAndAssemble(
      args.category,
      selected,
      money,
      args.age,
      askedQuestionCodes,
      args.programNameKey ?? null,
      surrogateFacts,
      args.programType ?? null,
    );
  }

  /**
   * Validate answers against the active GLOBAL snapshot and return the pairs the
   * scorer consumes.
   *
   * Feature 010: the pool holds all four question types, so every answer is
   * validated through the shared `validateAnswer` (same rules as apply — type,
   * bounds, option membership). Only SINGLE_SELECT carries an answer score (R9),
   * so multi-pick / text / number answers are validated and then dropped from
   * the scoring input rather than rejected — they exist to feed the figures.
   *
   * `isRequired` is forced off: preview and the admin simulator accept a PARTIAL
   * answer set by design; required-question enforcement belongs to apply.
   *
   * Scoped to `category`, matching apply (`resolveAnswers`). Previously this
   * read the whole pool, so preview and apply could disagree about which
   * questions existed for an applicant. That gap now also moves the score: the
   * asked set returned here is the scoring denominator (Constitution V,
   * v13.0.0), so the two paths must derive it identically or the same answers
   * yield different numbers before and after apply.
   */
  private async resolveSelectedOptions(
    answers: SubmittedAnswerDto[],
    category: LoanCategory,
  ): Promise<{
    selected: SelectedAnswer[];
    money: MoneyInputs | null;
    askedQuestionCodes: string[];
    /** Feature 011 — the facts an income rule looks its table up by (FR-018). */
    surrogateFacts: SurrogateFacts;
  }> {
    const version = await this.questionnaire.activeVersion();
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    const snapshot = version.snapshot as unknown as Snapshot;
    const questions: SnapshotQuestion[] = [];
    for (const g of snapshot.groups ?? []) {
      for (const q of g.questions ?? []) {
        // ABSENT vs EMPTY are different snapshots, not the same one:
        //   absent (pre-v12, the key was never frozen) → asked for every
        //     category, or every legacy snapshot would suddenly ask nothing;
        //   [] (v12+, explicitly frozen by `publish()` as
        //     `sortCategories(assignments.get(q.id) ?? [])`) → PARKED, asked by
        //     nobody. Assignment is authoritative (Principle V, v12.0.0).
        // Testing `.length > 0` conflates the two and lets a parked question
        // into the asked set here while apply's `resolveAnswers` and the
        // customer read both exclude it — the same answers would then score
        // differently before and after apply.
        const frozen = q.categories;
        if (frozen != null && !frozen.includes(category)) continue;
        questions.push(q);
      }
    }
    const byCode = new Map(questions.map((q) => [q.code, q]));
    const selected: SelectedAnswer[] = [];
    const numeric = new Map<string, string>();
    /**
     * Feature 011 — the SINGLE_SELECT picks, for the surrogate facts. Collected here
     * rather than re-derived later because `validateAnswer` has already normalised
     * them against the snapshot, and re-reading the raw answers would be a second
     * derivation of the same input (A33).
     */
    const optionByCode = new Map<string, string>();
    /** Multi-picks by question code — the bank-relationship answer is a set, not a key. */
    const multiByCode = new Map<string, readonly string[]>();
    /** The debt-type picks, once validated — the basis for the obligations sum. */
    let pickedDebtTypes: readonly string[] | undefined;
    for (const ans of answers) {
      const q = byCode.get(ans.questionCode);
      if (!q)
        throw new DomainException(ERROR_CODES.UNKNOWN_QUESTION_CODE, { code: ans.questionCode });
      const normalised = validateAnswer(
        {
          code: q.code,
          type: q.type,
          isRequired: false,
          optionCodes: (q.options ?? []).map((o) => o.code),
          numeric: q.numeric ?? null,
          text: q.text ?? null,
        },
        ans,
      );
      // Every type scores since v14.0.0, through the SAME mapper apply uses —
      // preview and apply must agree on both the asked set and the answer scores.
      const scorable = normalised ? toSelectedAnswer(normalised) : null;
      if (scorable) selected.push(scorable);
      // A numeric answer feeds BOTH sides: it prices the loan here and, if the
      // program banded it, also scores. Two different jobs, not double counting.
      if (normalised?.numericValue != null) numeric.set(q.code, normalised.numericValue);
      // A single pick — the option code, which IS the registry key an income rule's
      // table is keyed by (FR-017). Through the SAME predicate apply uses, so the two
      // paths cannot bind a fact differently for one set of answers (A33).
      const picked = normalised
        ? surrogateOptionPick({ type: q.type, selectedOptionCodes: normalised.selectedOptionCodes })
        : undefined;
      if (picked !== undefined) optionByCode.set(q.code, picked);
      if (q.type === 'MULTI_SELECT' && normalised && normalised.selectedOptionCodes.length > 0) {
        multiByCode.set(q.code, normalised.selectedOptionCodes);
      }
      if (q.code === DEBT_TYPES_QUESTION_CODE && normalised) {
        pickedDebtTypes = normalised.selectedOptionCodes;
      }
    }

    // Branch visibility evaluated against what the applicant has answered so
    // far, using the shared rule apply uses. Mid-questionnaire this set grows
    // as they answer, which is correct: a branch only becomes asked once its
    // trigger is picked.
    const submitted = new Map(answers.map((a) => [a.questionCode, a]));
    const askedQuestionCodes = questions
      .filter((q) => isQuestionVisible({ enabledWhen: q.enabledWhen ?? null }, submitted, byCode))
      .map((q) => q.code);

    // Itemised obligations. Three distinct states, and collapsing any two of them
    // would produce a wrong figure rather than no figure:
    //   not served  → this snapshot predates the feature; fall back to the stated
    //                 lump sum, exactly as before.
    //   served, unanswered → mid-questionnaire. NOT zero: quoting "no debts" here
    //                 would show full affordability right up until he declares
    //                 his debts, then shrink it.
    //   served, answered   → sum the visible per-debt amounts (picking "none"
    //                 sums to a real, stated 0).
    const obligations = byCode.has(DEBT_TYPES_QUESTION_CODE)
      ? pickedDebtTypes === undefined
        ? null
        : resolveObligations({ numericByCode: numeric, pickedDebtTypes })
      : resolveObligations({ numericByCode: numeric });

    return {
      selected,
      money: this.resolveMoneyInputs(numeric, obligations),
      askedQuestionCodes,
      // Feature 011 — the SAME mapper apply reads (FR-019). Preview and apply
      // deriving the same engine input differently is a review block (A33), and this
      // is the input an income rule looks its table up by.
      surrogateFacts: surrogateFactsFromAnswers(
        { optionByCode, numericByCode: numeric, multiByCode },
        // Read here, not at construction: a fact an operator adds or repoints must
        // move the next preview, and this service is a singleton that would otherwise
        // hold the registry it booted with until the process restarted.
        await this.enumerations.surrogateFactRegistry(),
      ),
    };
  }

  /**
   * The four bound numeric answers → the economic inputs (FR-042). All or
   * nothing: a partial set yields no figures rather than a figure computed on a
   * guessed income. A preview is explicitly answer-by-answer, so an incomplete
   * set is the normal mid-questionnaire state, not an error (contrast apply,
   * which raises `MONEY_FIGURE_MISSING`).
   */
  private resolveMoneyInputs(
    numeric: Map<string, string>,
    obligations: ObligationsResolution | null,
  ): MoneyInputs | null {
    const amount = numeric.get(MONEY_FIELD_BINDINGS.requested_amount);
    const tenor = numeric.get(MONEY_FIELD_BINDINGS.tenor_months);
    const income = numeric.get(MONEY_FIELD_BINDINGS.monthly_income);
    if (!amount || !tenor || !income || obligations === null) return null;
    return {
      requestedAmountEGP: new Decimal(amount),
      tenorMonths: Math.floor(Number(tenor)),
      monthlyIncomeEGP: new Decimal(income),
      // The SUM is authoritative. A stated `current_installments` that disagrees
      // is ignored here rather than rejected: preview is an advisory read and the
      // admin simulator shares it, so exploring must never 422. Apply, the
      // committing action, raises `OBLIGATIONS_TOTAL_MISMATCH` instead — both use
      // the same number, they differ only in tolerance for a lying client.
      existingObligationsEGP: obligations.totalEGP,
      hasCurrentLoan: obligations.hasCurrentLoan,
    };
  }

  /**
   * Score every active program in the requested scope and rank by approval
   * probability. Scope is the (category, programNameKey, programType) triple the
   * applicant asked for — a null on either optional axis means "not narrowed by
   * it", so `programNameKey` null means the whole category, which is what a
   * client that predates the catalog picker sends.
   */
  private async runAndAssemble(
    category: LoanCategory,
    answers: SelectedAnswer[],
    money: MoneyInputs | null,
    age: number,
    askedQuestionCodes: readonly string[],
    programNameKey: string | null,
    surrogateFacts: SurrogateFacts,
    programType: BankProgramType | null,
  ) {
    const rows = (await this.programs.findAllActive()).filter((p) =>
      matchesRequestedScope(p, category, programNameKey, programType),
    );
    const profile = money ? this.buildProfile(money, age, surrogateFacts) : null;
    // Read once, outside the loop. Preview and apply must derive the same figure from
    // the same rule — a preview that priced off the program's stripped table while
    // apply priced off the catalog's would disagree on the amount it just advertised.
    const catalogRules = await this.enumerations.programNameIncomeRules();
    // Same contract, same reason: one read for the whole book, and preview must resolve a
    // product rule's parents from the same map apply does or the two would price a
    // recategorised compound differently.
    const parentKeyByValue = await this.enumerations.enumerationParentKeys();

    const matches: PreviewMatch[] = [];
    for (const p of rows) {
      const { probability, tier, usedDefault, factors } = await this.weightedScoring.scoreProgram({
        programId: p.id,
        category,
        answers,
        askedQuestionCodes,
      });
      const priced = profile
        ? quoteProgram({
            profile,
            program: toBankProgramSnapshot(p, catalogRules),
            parentKeyByValue,
          })
        : null;
      const quote = priced?.ok ? priced.quote : null;
      matches.push({
        bankProgramId: p.id,
        programCode: p.programCode,
        bankName: p.bankName,
        bankIsFeatured: p.bank?.isFeatured ?? false,
        isShariaCompliant: p.isShariaCompliant,
        programFriendlyName: p.friendlyName,
        // Always true: figures shape the AMOUNT, never the listing (A33).
        eligible: true,
        monthlyInstallmentEGP: quote?.monthlyInstallmentEGP.toFixed(2) ?? null,
        effectiveRatePercent: quote?.effectiveRatePercent.toFixed(4) ?? null,
        maxAffordableAmountEGP:
          quote?.maxAffordableAmountEGP.toFixed(2) ??
          (priced && !priced.ok
            ? (priced.unavailable.maxAffordableAmountEGP?.toFixed(2) ?? null)
            : null),
        figures: quote ? toPreviewFigures(quote) : null,
        figuresUnavailableReason: quote
          ? null
          : priced && !priced.ok
            ? priced.unavailable.reason
            : 'MONEY_FIGURE_MISSING',
        gateReasonCode: !quote && priced && !priced.ok ? (priced.unavailable.gateReasonCode ?? null) : null,
        missingFactKeys:
          !quote && priced && !priced.ok ? (priced.unavailable.missingFactKeys ?? null) : null,
        approvalProbability: probability,
        approvalTier: tier,
        approvalFactors: factors,
        rejectionReasons: [],
        requiredDocuments: (p.requiredDocuments as string[]) ?? [],
        usedDefaultWeights: usedDefault,
      });
    }

    matches.sort((a, b) => {
      if (b.approvalProbability !== a.approvalProbability) {
        return b.approvalProbability - a.approvalProbability;
      }
      return Number(b.bankIsFeatured) - Number(a.bankIsFeatured);
    });

    return { category, matches, suggestions: [] };
  }

  /**
   * A profile carrying only what the questionnaire actually asked about. The
   * cascade levels keyed on employment or transfer type therefore fall through
   * to the program's base rate — preview is an estimate, and apply, which has
   * the full employment block, is the one that prices exactly.
   */
  private buildProfile(
    money: MoneyInputs,
    age: number,
    surrogateFacts: SurrogateFacts,
  ): ApplicantProfile {
    return {
      age,
      loanPurpose: 'personal',
      requestedAmountEGP: money.requestedAmountEGP,
      preferredTenorMonths: money.tenorMonths,
      priority: 'lowest_installment',
      employment: {
        employmentType: 'salaried',
        monthlyNetSalaryEGP: money.monthlyIncomeEGP,
        monthsInJob: 0,
        salaryTransferType: 'none',
        companyName: '',
        companyType: '',
        // Feature 011 — spread from the shared mapper, so preview looks a bank's
        // table up by exactly the value apply will (FR-019). Each field stays
        // `undefined` when the fact was not answered, which the resolver reports as
        // `SURROGATE_FACT_MISSING` rather than pricing a guess (FR-020).
        ...surrogateFacts.employment,
      },
      obligations: {
        existingMonthlyObligationsEGP: money.existingObligationsEGP,
        // From the debt-type picks when itemised, not from `total > 0`: a card
        // carried at a zero minimum payment is still a loan on book, and the
        // lump-sum derivation could never express that.
        hasCurrentLoan: money.hasCurrentLoan,
        hasPreviousRejection: false,
      },
      // Was `{}` — which is exactly why `byCreditCardLimit` resolved to nothing on
      // preview even for an applicant who had answered the card-limit question.
      assets: { ...surrogateFacts.assets },
      // The operator-defined facts, keyed — the same map apply builds, from the same
      // mapper, so a `fact:` rule prices identically before and after apply (A33).
      surrogateFacts: surrogateFacts.byKey,
      ...(surrogateFacts.bankRelationshipSlugs !== undefined
        ? { bankRelationshipSlugs: surrogateFacts.bankRelationshipSlugs }
        : {}),
    };
  }
}

function toPreviewFigures(q: Quote): PreviewFigures {
  return {
    offeredAmountEGP: q.offeredAmountEGP.toFixed(2),
    cashToCustomerEGP: q.cashToCustomerEGP.toFixed(2),
    totalFeesEGP: q.totalFeesEGP.toFixed(2),
    monthlyInstallmentEGP: q.monthlyInstallmentEGP.toFixed(2),
    effectiveTenorMonths: q.effectiveTenorMonths,
    effectiveRatePercent: q.effectiveRatePercent.toFixed(4),
    totalPayableEGP: q.totalPayableEGP.toFixed(2),
    totalCostOfCreditEGP: q.totalCostOfCreditEGP.toFixed(2),
    dbrPercent: q.dbrPercent.toFixed(2),
    dbrCapPercent: q.dbrCapPercent.toFixed(4),
    dbrBandIndex: q.dbrBandIndex,
    maxAffordableAmountEGP: q.maxAffordableAmountEGP.toFixed(2),
    bindingConstraint: q.bindingConstraint,
    collateralCeilingEGP: q.collateralCeilingEGP?.toFixed(2) ?? null,
    fees: {
      adminFeeEGP: new Decimal(q.feesBreakdown.adminFeeEGP).toFixed(2),
      stampDutyEGP: new Decimal(q.feesBreakdown.stampDutyEGP).toFixed(2),
      lifeInsuranceEGP: new Decimal(q.feesBreakdown.lifeInsuranceEGP).toFixed(2),
    },
  };
}
