/**
 * Preview ↔ apply parity — capture, then re-verify, what every active programme quotes
 * through the REAL endpoints for a fixed set of applicants (feature 012, part B).
 *
 * A33 says preview and apply derive the same engine input through ONE shared function.
 * Before 012 they did not: apply read amount / tenor / salary / employment type from the
 * request body the app built, preview read the answers and assumed `salaried`. Part B moves
 * money, so the only proof it moved exactly what it claims is a snapshot taken BEFORE the
 * change and compared after — which is why this runs over HTTP (the guards, the questionnaire
 * validation and the persisted offers are all part of what a customer sees) and not on
 * `quoteProgram` directly.
 *
 *   PARITY_API=http://localhost:3100/api npx tsx scripts/quote-preview-apply-parity.ts --write
 *   PARITY_API=http://localhost:3100/api npx tsx scripts/quote-preview-apply-parity.ts
 *
 * Preview goes through `POST admin/matching/simulate` — the same `MatchingPreviewService.preview`
 * the customer route calls, with the sample customer's derived age passed explicitly, so the
 * 60-an-hour customer throttle does not cap the matrix. Apply goes through `POST v1/apply` as a
 * seeded PHONE customer with a body built the way the mobile mappers build it today. The
 * applications it creates are deleted at the end (pass `--keep` to leave them).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const API = process.env.PARITY_API ?? 'http://localhost:3100/api';
// `PARITY_OUT` keeps a later feature's baseline beside its own spec (013) instead of over 012's.
const OUT = process.env.PARITY_OUT
  ? resolve(process.cwd(), process.env.PARITY_OUT)
  : resolve(__dirname, '../../specs/012-question-calculation-link/parity-baseline.json');
const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'ops@masrafy.local',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe_OnFirstLogin_!2026',
};
/** A seeded PHONE customer (`prisma/seed-customers.ts`). Override both when its hourly apply budget is spent. */
const CUSTOMER = {
  email: process.env.PARITY_CUSTOMER_EMAIL ?? 'kareem.mansour@masrafy.local',
  password: 'dev-customer-12!',
};
const CUSTOMER_AGE = ageFrom(process.env.PARITY_CUSTOMER_BIRTHDAY ?? '1988-11-02');

type Category = 'personal' | 'car' | 'mortgage' | 'business';
type Answer =
  | { questionCode: string; numericValue: string }
  | { questionCode: string; optionCode: string }
  | { questionCode: string; optionCodes: string[] }
  | { questionCode: string; textValue: string };

interface ServedQuestion {
  code: string;
  type: 'NUMERIC' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'TEXT';
  isRequired: boolean;
  enabledWhen: { operator: 'equals' | 'not_equals'; questionCode: string; optionCode: string } | null;
  numeric: { minValue: string | null; maxValue: string | null } | null;
  options: { code: string }[];
}

interface Sample {
  readonly name: string;
  readonly category: Category;
  readonly programNameKey?: string;
  /** Answers this sample is ABOUT; every other required, visible question is defaulted. */
  readonly answers: Record<string, string | string[]>;
  /**
   * Overrides on the app-built body — a build whose mapper disagrees with the answers. Apply
   * must price off the ANSWERS (feature 012), so this sample's apply must equal its preview.
   */
  readonly bodyEmployment?: Record<string, unknown>;
}

const BASE: Record<string, string | string[]> = {
  monthly_income: '30000',
  amount_requested: '300000',
  repayment_period_months: '60',
  current_loans: ['none'],
  current_installments: '0',
  i_score: '700',
  priority_factor: 'lowest_monthly_installment',
};

const CAR: Record<string, string | string[]> = {
  amount_requested: '600000',
  car_price: '800000',
  car_down_payment: '200000',
  home_ownership: 'owned_by_me',
  car_origin: 'japan',
  car_fuel_type: 'petrol_diesel',
  car_dealer: 'other_authorized',
  car_model_year: '2024',
  green_buyer_type: 'instalment_buyer',
  total_savings: '100000',
};

/** Enough of a compound owner for the four compound programmes to price — DBR then binds. */
const COMPOUND: Record<string, string | string[]> = {
  ...BASE,
  amount_requested: '2000000',
  owns_compound_unit: 'yes',
  which_compound_is_your_unit_in: 'mivida',
  what_kind_of_unit_do_you_own: 'apartment',
  what_percentage_of_the_unit_do_you_own: '100',
  how_much_have_you_paid_for_the_unit_so_far: '3000000',
  how_many_months_ago_did_you_sign_the_contract: '36',
  what_is_the_contract_price_of_the_unit: '6000000',
  how_much_was_the_down_payment_on_the_unit: '1000000',
  business_months: '24m_or_more',
  self_employed_licence: 'yes',
};

const SAMPLES: readonly Sample[] = [
  { name: 'personal-gov', category: 'personal', answers: { ...BASE, employment_status: 'government_employee', job_tenure: 'more_than_3_years', salary_transfer: 'payroll' } },
  { name: 'personal-private', category: 'personal', answers: { ...BASE, employment_status: 'private_sector_employee', job_tenure: '1_to_3_years', salary_transfer: 'salary_transfer_letter' } },
  { name: 'personal-freelancer', category: 'personal', answers: { ...BASE, employment_status: 'freelancer', job_tenure: 'more_than_3_years', salary_transfer: 'no_salary_transfer' } },
  { name: 'personal-business-owner', category: 'personal', answers: { ...BASE, employment_status: 'business_owner_company_owner', job_tenure: 'more_than_3_years', salary_transfer: 'no_salary_transfer' } },
  { name: 'personal-card-freelancer', category: 'personal', answers: { ...BASE, repayment_period_months: '96', current_loans: ['credit_cards'], credit_card_total_limit: '100000', employment_status: 'freelancer', job_tenure: 'more_than_3_years', salary_transfer: 'no_salary_transfer' } },
  { name: 'personal-compound-freelancer', category: 'personal', answers: { ...COMPOUND, employment_status: 'freelancer', job_tenure: 'more_than_3_years', salary_transfer: 'no_salary_transfer' } },
  { name: 'personal-compound-private', category: 'personal', answers: { ...COMPOUND, employment_status: 'private_sector_employee', job_tenure: 'more_than_3_years', salary_transfer: 'salary_transfer_letter' } },
  { name: 'personal-compound-freelancer-stale-body', category: 'personal', answers: { ...COMPOUND, employment_status: 'freelancer', job_tenure: 'more_than_3_years', salary_transfer: 'no_salary_transfer' }, bodyEmployment: { employmentType: 'private_employee', monthsInJob: 3 } },
  { name: 'personal-retired', category: 'personal', answers: { ...BASE, employment_status: 'retired', job_tenure: 'more_than_3_years', salary_transfer: 'payroll' } },
  { name: 'car-private', category: 'car', answers: { ...BASE, ...CAR, employment_status: 'private_sector_employee' } },
  { name: 'car-freelancer', category: 'car', answers: { ...BASE, ...CAR, employment_status: 'freelancer' } },
  { name: 'car-freelancer-long', category: 'car', answers: { ...BASE, ...CAR, repayment_period_months: '96', employment_status: 'freelancer' } },
  { name: 'car-product-only', category: 'car', programNameKey: 'car_buyers_program', answers: { ...BASE, ...CAR, car_price: '2000000', car_down_payment: '500000', employment_status: 'private_sector_employee' } },
  { name: 'car-product-only-freelancer', category: 'car', programNameKey: 'car_buyers_program', answers: { ...BASE, ...CAR, car_price: '2000000', car_down_payment: '500000', repayment_period_months: '96', employment_status: 'freelancer' } },
  { name: 'mortgage-gov', category: 'mortgage', answers: { ...BASE, amount_requested: '1500000', repayment_period_months: '120', employment_status: 'government_employee', job_tenure: 'more_than_3_years', salary_transfer: 'payroll' } },
  { name: 'business-owner', category: 'business', answers: { ...BASE, business_age: 'more_than_2_years' } },
];

// ---- HTTP ----------------------------------------------------------------------------------

async function call(method: string, path: string, token: string | null, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function login(path: string, creds: { email: string; password: string }): Promise<string> {
  const { status, json } = await call('POST', path, null, creds);
  if (status >= 300 || !json?.data?.accessToken) throw new Error(`login ${path} failed: ${status} ${JSON.stringify(json).slice(0, 200)}`);
  return json.data.accessToken as string;
}

// ---- Answers -------------------------------------------------------------------------------

function visible(q: ServedQuestion, given: Map<string, string | string[]>): boolean {
  const w = q.enabledWhen;
  if (!w) return true;
  const v = given.get(w.questionCode);
  const has = Array.isArray(v) ? v.includes(w.optionCode) : v === w.optionCode;
  return w.operator === 'equals' ? has : !has;
}

/** A neutral answer for a required question the sample is not about: the "no / none" option, else 0 / min. */
function neutral(q: ServedQuestion): string | string[] | null {
  const codes = q.options.map((o) => o.code);
  const pick = codes.find((c) => c === 'no' || c === 'none') ?? codes.find((c) => /^no_|_no$|^none/.test(c)) ?? codes[0];
  switch (q.type) {
    case 'SINGLE_SELECT':
      return pick ?? null;
    case 'MULTI_SELECT':
      return pick ? [pick] : null;
    case 'NUMERIC': {
      return String(Math.max(Number(q.numeric?.minValue ?? 0) || 0, 0));
    }
    case 'TEXT':
      return 'n/a';
  }
}

function fillAnswers(served: ServedQuestion[], wanted: Record<string, string | string[]>): Map<string, string | string[]> {
  const byCode = new Map(served.map((q) => [q.code, q]));
  const given = new Map<string, string | string[]>();
  for (const [code, v] of Object.entries(wanted)) if (byCode.has(code)) given.set(code, v);
  // Fixpoint: answering a gate can reveal a required question.
  for (let pass = 0; pass < 5; pass++) {
    let added = false;
    for (const q of served) {
      if (given.has(q.code) || !q.isRequired || !visible(q, given)) continue;
      const v = neutral(q);
      if (v !== null) {
        given.set(q.code, v);
        added = true;
      }
    }
    if (!added) break;
  }
  for (const q of served) if (given.has(q.code) && !visible(q, given)) given.delete(q.code);
  return given;
}

function toSubmitted(served: ServedQuestion[], given: Map<string, string | string[]>): Answer[] {
  const types = new Map(served.map((q) => [q.code, q.type]));
  return [...given].map(([code, v]): Answer => {
    switch (types.get(code)) {
      case 'NUMERIC':
        return { questionCode: code, numericValue: String(v) };
      case 'MULTI_SELECT':
        return { questionCode: code, optionCodes: Array.isArray(v) ? v : [v] };
      case 'TEXT':
        return { questionCode: code, textValue: String(v) };
      default:
        return { questionCode: code, optionCode: String(v) };
    }
  });
}

// ---- The body the mobile mappers build today (apply_mapping.dart / *_apply_mapper.dart) ----

const EMPLOYMENT_TYPE: Record<string, string> = {
  government_employee: 'government_employee',
  private_sector_employee: 'private_employee',
  business_owner_company_owner: 'business_owner',
  freelancer: 'freelancer',
  retired: 'retired',
};
const MONTHS_FROM_TENURE: Record<string, number> = { less_than_6_months: 3, '6_months_to_1_year': 9, '1_to_3_years': 24, more_than_3_years: 48 };
const MONTHS_FROM_BUSINESS_AGE: Record<string, number> = { less_than_1_year: 6, '1_to_2_years': 18, more_than_2_years: 48 };
const TRANSFER: Record<string, string> = { payroll: 'payroll', salary_transfer_letter: 'salary_transfer_letter', income_transfer_letter: 'income_transfer_letter', no_salary_transfer: 'none' };

function appBody(sample: Sample, given: Map<string, string | string[]>, served: ServedQuestion[]): Record<string, unknown> {
  const s = (c: string): string | undefined => {
    const v = given.get(c);
    return Array.isArray(v) ? v[0] : v;
  };
  const amount = s('amount_requested') ?? (s('car_price') && s('car_down_payment') ? String(Number(s('car_price')) - Number(s('car_down_payment'))) : undefined);
  const employmentType = sample.category === 'business' ? 'business_owner' : (EMPLOYMENT_TYPE[s('employment_status') ?? ''] ?? s('employment_status') ?? 'salaried');
  const monthsInJob = sample.category === 'business' ? (MONTHS_FROM_BUSINESS_AGE[s('business_age') ?? ''] ?? 24) : (MONTHS_FROM_TENURE[s('job_tenure') ?? ''] ?? 24);
  const tenor = s('repayment_period_months');
  return {
    loanPurpose: sample.category,
    requestedAmountEGP: amount,
    ...(tenor ? { preferredTenorMonths: Number(tenor) } : {}),
    priority: 'lowest_installment',
    category: sample.category,
    ...(sample.programNameKey ? { programNameKey: sample.programNameKey } : {}),
    questionnaireAnswers: toSubmitted(served, given),
    employment: {
      employmentType,
      monthlyNetSalaryEGP: s('monthly_income') ?? '0',
      monthsInJob,
      salaryTransferType: TRANSFER[s('salary_transfer') ?? ''] ?? 'none',
      companyName: 'N/A',
      companyType: employmentType === 'government_employee' ? 'public_bank' : 'commercial_bank',
    },
    obligations: { existingMonthlyObligationsEGP: obligationsTotal(given), hasCurrentLoan: false, hasPreviousRejection: false },
    assets: {},
    ...(sample.category === 'car' && s('car_price') && s('car_down_payment')
      ? { carDetails: { carValueEGP: s('car_price'), downPaymentEGP: s('car_down_payment') } }
      : {}),
  };
}

/** The app's `obligationsTotalOf`: itemised instalments + 5% of the card limit, else the stated total. */
function obligationsTotal(given: Map<string, string | string[]>): string {
  const n = (c: string): number | null => {
    const v = given.get(c);
    return v === undefined || Array.isArray(v) ? null : Number(v);
  };
  const items = ['obligation_car_loan', 'obligation_personal_loan', 'obligation_mortgage', 'obligation_other'].map(n);
  const card = n('credit_card_total_limit');
  if (items.every((x) => x === null) && card === null) return String(n('current_installments') ?? 0);
  return (items.reduce<number>((a, x) => a + (x ?? 0), 0) + (card ?? 0) * 0.05).toFixed(2);
}

// ---- Normalising what came back -------------------------------------------------------------

/**
 * One shape for both sides. Preview returns the engine's `figures` block; apply returns the
 * persisted `BankOffer` read model, which names the same numbers differently
 * (`effectiveLoanAmountEGP` is the financed amount, `maxLoanAvailableEGP` the ceiling).
 */
type Quote = Record<string, string | number | boolean | null>;

function quote(q: {
  eligible: boolean;
  amount?: unknown;
  installment?: unknown;
  tenor?: unknown;
  rate?: unknown;
  dbrCap?: unknown;
  reason?: unknown;
}): Quote {
  const out: Quote = { eligible: q.eligible };
  if (q.eligible) {
    out.amount = (q.amount as string) ?? null;
    out.installment = (q.installment as string) ?? null;
    out.tenor = (q.tenor as number) ?? null;
    out.rate = (q.rate as string) ?? null;
    out.dbrCap = (q.dbrCap as string) ?? null;
  } else {
    out.reason = (q.reason as string) ?? null;
  }
  return out;
}

function previewQuotes(json: any): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const m of json?.data?.matches ?? []) {
    const f = m.figures;
    out[m.programCode] = f
      ? quote({ eligible: true, amount: f.offeredAmountEGP, installment: f.monthlyInstallmentEGP, tenor: f.effectiveTenorMonths, rate: f.effectiveRatePercent, dbrCap: f.dbrCapPercent })
      : quote({ eligible: false, reason: m.figuresUnavailableReason ?? m.reason ?? m.unavailableReason ?? 'NO_FIGURES' });
  }
  return out;
}

function applyQuotes(json: any): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  const d = json?.data ?? json?.meta ?? {};
  for (const o of d.matchedOffers ?? [])
    out[o.programCode] = quote({ eligible: true, amount: o.effectiveLoanAmountEGP, installment: o.monthlyInstallmentEGP, tenor: o.effectiveTenorMonths, rate: o.effectiveRatePercent, dbrCap: o.dbrCapPercent });
  for (const u of d.unavailablePrograms ?? []) out[u.programCode] = quote({ eligible: false, reason: u.reason });
  for (const x of d.details ?? []) if (!out[x.programCode]) out[x.programCode] = quote({ eligible: false, reason: (x.failedChecks ?? []).join('|') });
  return out;
}

// ---- Main ----------------------------------------------------------------------------------

interface Captured {
  readonly sample: string;
  readonly preview: Record<string, Quote> | { error: unknown };
  readonly apply: Record<string, Quote> | { error: unknown };
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const keep = process.argv.includes('--keep');
  const admin = await login('/admin/auth/login', ADMIN);
  const customer = await login('/v1/auth/login', CUSTOMER);
  const createdApplicationIds: string[] = [];
  const captured: Captured[] = [];

  for (const sample of SAMPLES) {
    const qs = sample.programNameKey ? `&programNameKey=${sample.programNameKey}` : '';
    const q = await call('GET', `/v1/questionnaire?category=${sample.category}${qs}`, customer);
    if (q.status >= 300) throw new Error(`questionnaire ${sample.name}: ${q.status} ${JSON.stringify(q.json).slice(0, 300)}`);
    const served: ServedQuestion[] = q.json.data.groups.flatMap((g: { questions: ServedQuestion[] }) => g.questions);
    const given = fillAnswers(served, sample.answers);
    // The app fills the read-only total from the same sum (`obligationsTotalOf`).
    if (given.has('current_installments')) given.set('current_installments', obligationsTotal(given));
    const answers = toSubmitted(served, given);

    const p = await call('POST', '/admin/matching/simulate', admin, {
      category: sample.category,
      age: CUSTOMER_AGE,
      answers,
      ...(sample.programNameKey ? { programNameKey: sample.programNameKey } : {}),
    });
    const body = appBody(sample, given, served);
    if (sample.bodyEmployment) body.employment = { ...(body.employment as object), ...sample.bodyEmployment };
    const a = await call('POST', '/v1/apply', customer, body);
    const appId = a.json?.data?.applicationId ?? a.json?.meta?.applicationId;
    if (appId) createdApplicationIds.push(appId);

    captured.push({
      sample: sample.name,
      preview: p.status < 300 ? previewQuotes(p.json) : { error: { status: p.status, body: p.json } },
      apply: a.status < 300 || a.json?.code === 'NO_MATCHING_PROGRAMS' ? applyQuotes(a.json) : { error: { status: a.status, body: a.json } },
    });
  }

  // Within this run: does preview quote what apply quotes?
  let parityDiffs = 0;
  for (const c of captured) {
    if ('error' in c.preview || 'error' in c.apply) {
      console.log(`! ${c.sample}: ${'error' in c.preview ? 'preview ' + JSON.stringify(c.preview.error).slice(0, 300) : ''} ${'error' in c.apply ? 'apply ' + JSON.stringify(c.apply.error).slice(0, 300) : ''}`);
      continue;
    }
    for (const code of new Set([...Object.keys(c.preview), ...Object.keys(c.apply)])) {
      const p = (c.preview as Record<string, Quote>)[code];
      const a = (c.apply as Record<string, Quote>)[code];
      const pf = p ? JSON.stringify(p) : 'absent';
      const af = a ? JSON.stringify(a) : 'absent';
      if (pf !== af) {
        parityDiffs++;
        console.log(`≠ ${c.sample} ${code}\n    preview ${pf}\n    apply   ${af}`);
      }
    }
  }
  console.log(`\npreview ≠ apply: ${parityDiffs} programme row(s) across ${captured.length} samples`);

  if (write) {
    writeFileSync(OUT, JSON.stringify({ capturedAt: new Date().toISOString(), samples: captured }, null, 2) + '\n');
    console.log(`baseline written: ${OUT}`);
  } else if (existsSync(OUT)) {
    const base = JSON.parse(readFileSync(OUT, 'utf8')) as { samples: Captured[] };
    let drift = 0;
    for (const c of captured) {
      const b = base.samples.find((x) => x.sample === c.sample);
      if (!b) {
        console.log(`(${c.sample}: added after the baseline — checked for preview = apply only)`);
        continue;
      }
      for (const side of ['preview', 'apply'] as const) {
        const before = (b?.[side] ?? {}) as Record<string, Quote>;
        const after = c[side] as Record<string, Quote>;
        for (const code of new Set([...Object.keys(before), ...Object.keys(after)])) {
          const x = JSON.stringify(before[code] ?? null);
          const y = JSON.stringify(after[code] ?? null);
          if (x !== y) {
            drift++;
            console.log(`Δ ${side} ${c.sample} ${code}\n    before ${x}\n    after  ${y}`);
          }
        }
      }
    }
    console.log(`\ndrift vs baseline: ${drift} row(s)`);
  }

  if (!keep && createdApplicationIds.length > 0) {
    const prisma = new PrismaClient();
    try {
      const n = await prisma.application.deleteMany({ where: { id: { in: createdApplicationIds } } });
      console.log(`cleaned up ${n.count} test application(s)`);
    } finally {
      await prisma.$disconnect();
    }
  }
}


function ageFrom(iso: string): number {
  const b = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

main().catch((e: unknown) => {
  console.error('FAILED:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
