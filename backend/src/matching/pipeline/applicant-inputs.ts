/**
 * Feature 012 — the ONE derivation of the applicant's money and employment inputs, shared by
 * preview and apply (A33: "preview and apply deriving the same engine input differently" is a
 * review block).
 *
 * Before 012 the two paths read these from different places:
 *   - apply took amount, term, salary and the employment block from the REQUEST BODY the
 *     mobile mapper built;
 *   - preview read amount, term and salary from the ANSWERS, and stated every applicant
 *     `salaried` with 0 months in the job.
 * So a self-employed applicant was quoted the salaried DBR cap and term on the shortlist and
 * the self-employed one after applying, and a car name that asks the price and the down
 * payment instead of the amount quoted nothing in preview and a figure at apply.
 *
 * Each field resolves ANSWER → DERIVATION → BODY → DEFAULT. Answers come first because they
 * were validated against the published snapshot; the body is client-built and stays only as
 * the fallback for a submit with no answers for that field, so every installed app build
 * keeps applying. Pure: no IO, no clock.
 */
import { Decimal } from '@prisma/client/runtime/library';
import {
  BUSINESS_AGE_QUESTION_CODE,
  DEFAULT_MONTHS_IN_JOB,
  EMPLOYMENT_TYPE_BY_ANSWER,
  EMPLOYMENT_TYPE_QUESTION_CODE,
  JOB_TENURE_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  MONTHS_IN_BUSINESS_BY_AGE_ANSWER,
  MONTHS_IN_JOB_BY_TENURE_ANSWER,
  SALARY_TRANSFER_QUESTION_CODE,
  SALARY_TRANSFER_TYPE_BY_ANSWER,
} from './money-field-bindings';
import type { CarDetails } from '../types';

/** The validated answers, by question code — the maps both callers already build. */
export interface ApplicantInputAnswers {
  readonly numericByCode: ReadonlyMap<string, string>;
  readonly optionByCode: ReadonlyMap<string, string>;
}

/** Apply's request body, as the last resort. Preview has no body and passes nothing. */
export interface ApplicantInputFallback {
  readonly requestedAmountEGP?: Decimal;
  readonly preferredTenorMonths?: number;
  readonly monthlyNetSalaryEGP?: Decimal;
  readonly employmentType?: string;
  readonly monthsInJob?: number;
  readonly salaryTransferType?: string;
}

export interface ApplicantInputs {
  /** Absent only when nothing states it: preview then has no figures to quote. */
  readonly requestedAmountEGP: Decimal | undefined;
  /** Absent = the programme's own longest term (`resolveTenor`), exactly as the app means it. */
  readonly preferredTenorMonths: number | undefined;
  /** Absent = nothing declared. */
  readonly monthlyNetSalaryEGP: Decimal | undefined;
  readonly employmentType: string;
  readonly monthsInJob: number;
  readonly salaryTransferType: string;
}

export type ApplicantInputSource = 'answer' | 'derived' | 'body' | 'default' | 'none';

export interface ApplicantInputsResolution {
  readonly inputs: ApplicantInputs;
  /** Where each field came from — what apply logs when an answer overrode the body. */
  readonly source: Readonly<Record<keyof ApplicantInputs, ApplicantInputSource>>;
}

/** The term bounds the app clamps to before it sends one. */
const MIN_TENOR_MONTHS = 6;
const MAX_TENOR_MONTHS = 360;

export function applicantInputsFrom(args: {
  readonly answers: ApplicantInputAnswers;
  /** The loan category slug (`personal` / `car` / `mortgage` / `business`), or null. */
  readonly category: string | null;
  /**
   * The price and deposit from the ANSWERS (`carDetailsFrom(byKey)` with no body), so the
   * derived amount rests on what was asked and not on a client-supplied copy.
   */
  readonly answeredCar?: CarDetails;
  readonly fallback?: ApplicantInputFallback;
}): ApplicantInputsResolution {
  const { answers, category } = args;
  const fallback = args.fallback ?? {};
  const num = (code: string): Decimal | undefined => {
    const raw = answers.numericByCode.get(code);
    return raw === undefined ? undefined : new Decimal(raw);
  };
  const pick = (code: string): string | undefined => answers.optionByCode.get(code);

  // Amount: typed → price less deposit (a car flow may ask those instead) → body.
  let amount: Decimal | undefined = num(MONEY_FIELD_BINDINGS.requested_amount);
  let amountSource: ApplicantInputSource = amount ? 'answer' : 'none';
  if (!amount) {
    const car = args.answeredCar;
    if (car && car.carValueEGP.greaterThan(car.downPaymentEGP)) {
      amount = car.carValueEGP.minus(car.downPaymentEGP);
      amountSource = 'derived';
    }
  }
  if (!amount && fallback.requestedAmountEGP) {
    amount = fallback.requestedAmountEGP;
    amountSource = 'body';
  }

  const tenorAnswer = num(MONEY_FIELD_BINDINGS.tenor_months);
  const tenor =
    tenorAnswer !== undefined
      ? Math.min(MAX_TENOR_MONTHS, Math.max(MIN_TENOR_MONTHS, Math.floor(tenorAnswer.toNumber())))
      : fallback.preferredTenorMonths;

  const incomeAnswer = num(MONEY_FIELD_BINDINGS.monthly_income);
  const income = incomeAnswer ?? fallback.monthlyNetSalaryEGP;

  // Employment: the picked option (folded later by `coarseEmploymentType`, which reads
  // either spelling) → body → per-CATEGORY default. Never per bank (Principle II): a business
  // loan's applicant is a business owner unless he said otherwise.
  const employmentAnswer = pick(EMPLOYMENT_TYPE_QUESTION_CODE);
  const categoryDefault = category === 'business' ? 'business_owner' : 'salaried';
  const employmentType =
    employmentAnswer !== undefined
      ? (EMPLOYMENT_TYPE_BY_ANSWER[employmentAnswer] ?? employmentAnswer)
      : (fallback.employmentType ?? categoryDefault);

  const tenureAnswer = pick(JOB_TENURE_QUESTION_CODE);
  const businessAgeAnswer = pick(BUSINESS_AGE_QUESTION_CODE);
  const monthsFromAnswer =
    (tenureAnswer !== undefined ? MONTHS_IN_JOB_BY_TENURE_ANSWER[tenureAnswer] : undefined) ??
    (businessAgeAnswer !== undefined
      ? MONTHS_IN_BUSINESS_BY_AGE_ANSWER[businessAgeAnswer]
      : undefined);
  const monthsInJob = monthsFromAnswer ?? fallback.monthsInJob ?? DEFAULT_MONTHS_IN_JOB;

  const transferAnswer = pick(SALARY_TRANSFER_QUESTION_CODE);
  const transferFromAnswer =
    transferAnswer !== undefined ? SALARY_TRANSFER_TYPE_BY_ANSWER[transferAnswer] : undefined;
  const salaryTransferType = transferFromAnswer ?? fallback.salaryTransferType ?? 'none';

  const from = (answered: boolean, body: unknown): ApplicantInputSource =>
    answered ? 'answer' : body !== undefined ? 'body' : 'default';

  return {
    inputs: {
      requestedAmountEGP: amount,
      preferredTenorMonths: tenor,
      monthlyNetSalaryEGP: income,
      employmentType,
      monthsInJob,
      salaryTransferType,
    },
    source: {
      requestedAmountEGP: amountSource,
      preferredTenorMonths:
        tenorAnswer !== undefined ? 'answer' : tenor !== undefined ? 'body' : 'none',
      monthlyNetSalaryEGP:
        incomeAnswer !== undefined ? 'answer' : income !== undefined ? 'body' : 'none',
      employmentType: from(employmentAnswer !== undefined, fallback.employmentType),
      monthsInJob: from(monthsFromAnswer !== undefined, fallback.monthsInJob),
      salaryTransferType: from(transferFromAnswer !== undefined, fallback.salaryTransferType),
    },
  };
}

/**
 * The fields where an answer stated something different from the body the app sent — what
 * apply logs (names only, never amounts: Principle VI). A difference means an app build whose
 * mapper disagrees with this module, which is exactly the drift worth seeing.
 */
export function inputsOverridingBody(
  resolution: ApplicantInputsResolution,
  body: ApplicantInputFallback,
): (keyof ApplicantInputs)[] {
  const out: (keyof ApplicantInputs)[] = [];
  const { inputs, source } = resolution;
  const differs = (a: unknown, b: unknown): boolean =>
    a instanceof Decimal && b instanceof Decimal ? !a.equals(b) : a !== b;
  for (const key of Object.keys(inputs) as (keyof ApplicantInputs)[]) {
    if (source[key] !== 'answer' && source[key] !== 'derived') continue;
    const b = body[key];
    if (b !== undefined && differs(inputs[key], b)) out.push(key);
  }
  return out;
}
