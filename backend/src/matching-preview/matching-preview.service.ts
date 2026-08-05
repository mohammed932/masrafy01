import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import { WeightedApprovalScoringService } from '@/scoring/weighted-approval.service';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import { toBankProgramSnapshot } from '@/bank-programs/bank-program-snapshot.mapper';
import { quoteProgram } from '@/matching/pipeline/quote';
import { MONEY_FIELD_BINDINGS } from '@/matching/pipeline/money-field-bindings';
import type { ApplicantProfile, Quote } from '@/matching/types';
import type { SelectedAnswer } from '@/matching/scoring/approval-probability.scorer';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';
import { validateAnswer } from '@/questionnaire/validation/answer-validation';

interface SnapshotOption {
  code: string;
}
interface SnapshotQuestion {
  code: string;
  /** Absent on a pre-010 snapshot — read as SINGLE_SELECT (FR-045). */
  type?: string | null;
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
  approvalProbability: number;
  approvalTier: string;
  rejectionReasons: string[];
  requiredDocuments: string[];
  usedDefaultWeights: boolean;
}

/** The four bound numeric answers, once resolved. */
interface MoneyInputs {
  requestedAmountEGP: Decimal;
  tenorMonths: number;
  monthlyIncomeEGP: Decimal;
  existingObligationsEGP: Decimal;
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
  ) {}

  /**
   * `age` prices the tenor through the age-at-maturity rule, so it must be the
   * SAME number apply would use: the customer controller derives it from the
   * caller's `birthday`, the admin simulator passes the sample applicant's.
   */
  async preview(args: { category: LoanCategory; answers: SubmittedAnswerDto[]; age: number }) {
    const { selected, money } = await this.resolveSelectedOptions(args.answers);
    return this.runAndAssemble(args.category, selected, money, args.age);
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
   */
  private async resolveSelectedOptions(
    answers: SubmittedAnswerDto[],
  ): Promise<{ selected: SelectedAnswer[]; money: MoneyInputs | null }> {
    const version = await this.questionnaire.activeVersion();
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    const snapshot = version.snapshot as unknown as Snapshot;
    const questions: SnapshotQuestion[] = [];
    for (const g of snapshot.groups ?? []) for (const q of g.questions ?? []) questions.push(q);
    const byCode = new Map(questions.map((q) => [q.code, q]));
    const selected: SelectedAnswer[] = [];
    const numeric = new Map<string, string>();
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
      if (normalised?.selectedOptionCode) {
        selected.push({ questionCode: q.code, optionCode: normalised.selectedOptionCode });
      }
      if (normalised?.numericValue != null) numeric.set(q.code, normalised.numericValue);
    }
    return { selected, money: this.resolveMoneyInputs(numeric) };
  }

  /**
   * The four bound numeric answers → the economic inputs (FR-042). All or
   * nothing: a partial set yields no figures rather than a figure computed on a
   * guessed income. A preview is explicitly answer-by-answer, so an incomplete
   * set is the normal mid-questionnaire state, not an error (contrast apply,
   * which raises `MONEY_FIGURE_MISSING`).
   */
  private resolveMoneyInputs(numeric: Map<string, string>): MoneyInputs | null {
    const amount = numeric.get(MONEY_FIELD_BINDINGS.requested_amount);
    const tenor = numeric.get(MONEY_FIELD_BINDINGS.tenor_months);
    const income = numeric.get(MONEY_FIELD_BINDINGS.monthly_income);
    const obligations = numeric.get(MONEY_FIELD_BINDINGS.existing_obligations);
    if (!amount || !tenor || !income || !obligations) return null;
    return {
      requestedAmountEGP: new Decimal(amount),
      tenorMonths: Math.floor(Number(tenor)),
      monthlyIncomeEGP: new Decimal(income),
      existingObligationsEGP: new Decimal(obligations),
    };
  }

  /** Score every active program in the category and rank by approval probability. */
  private async runAndAssemble(
    category: LoanCategory,
    answers: SelectedAnswer[],
    money: MoneyInputs | null,
    age: number,
  ) {
    const rows = (await this.programs.findAllActive()).filter(
      (p) => p.productCategory.toLowerCase() === category,
    );
    const profile = money ? this.buildProfile(money, age) : null;

    const matches: PreviewMatch[] = [];
    for (const p of rows) {
      const { probability, tier, usedDefault } = await this.weightedScoring.scoreProgram({
        programId: p.id,
        category,
        answers,
      });
      const priced = profile
        ? quoteProgram({ profile, program: toBankProgramSnapshot(p) })
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
        approvalProbability: probability,
        approvalTier: tier,
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
  private buildProfile(money: MoneyInputs, age: number): ApplicantProfile {
    return {
      age,
      loanPurpose: 'personal',
      requestedAmountEGP: money.requestedAmountEGP,
      requestedCurrency: 'EGP',
      preferredTenorMonths: money.tenorMonths,
      priority: 'lowest_installment',
      employment: {
        employmentType: 'salaried',
        monthlyNetSalaryEGP: money.monthlyIncomeEGP,
        monthsInJob: 0,
        salaryTransferType: 'none',
        companyName: '',
        companyType: '',
      },
      obligations: {
        existingMonthlyObligationsEGP: money.existingObligationsEGP,
        hasCurrentLoan: money.existingObligationsEGP.greaterThan(0),
        hasPreviousRejection: false,
      },
      assets: {},
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
    fees: {
      adminFeeEGP: new Decimal(q.feesBreakdown.adminFeeEGP).toFixed(2),
      stampDutyEGP: new Decimal(q.feesBreakdown.stampDutyEGP).toFixed(2),
      lifeInsuranceEGP: new Decimal(q.feesBreakdown.lifeInsuranceEGP).toFixed(2),
    },
  };
}
