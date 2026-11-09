/**
 * check:engine — does the matching engine return the RIGHT figures, on every program?
 *
 * Two parts, both through the running API (the admin simulator endpoint, which runs the same
 * quote and order as the customer preview):
 *
 *   A. TESTING fixtures. A "TESTING Bank" with four "TESTING" programs under a "TESTING Loans"
 *      name, each with simple numbers chosen so every expected figure can be worked out by hand.
 *      Cases state their expected result up front (rate, term, instalment, binding constraint,
 *      refusal reason, order) and are compared against what the engine returns. The fixtures are
 *      created through the same endpoints the dashboard uses (so their validation runs too),
 *      created for the run and DELETED at the end, so nothing of them stays in the dashboard.
 *
 *   B. Every live program. Each loan type × each program name offered under it, answered
 *      exactly as that name's own questions ask (served questions, gates honoured), and every
 *      offer's money re-derived independently: instalment from the annuity (or flat) formula,
 *      cash + fees = loan, fee lines sum, total payable, cost of credit, the debt-ratio cap, the
 *      term and amount within the program's own limits.
 *
 * Usage (backend running on :3000):  npx tsx scripts/check-engine.ts [--keep]
 *   --keep   leave the TESTING fixtures in place after the run.
 * Exit code 1 when any check fails.
 */

import {
  TESTING_CUSTOMER_EMAIL,
  TESTING_CUSTOMER_INCOMPLETE_EMAIL,
  TESTING_CUSTOMER_PASSWORD,
  ensureTestingCustomers,
  removeTestingCustomers,
} from './engine-check/testing-customer';

const API = process.env.ENGINE_CHECK_API ?? 'http://localhost:3000/api/admin';
const EMAIL = process.env.ENGINE_CHECK_EMAIL ?? 'ops@masrafy.local';
const PASSWORD = process.env.ENGINE_CHECK_PASSWORD ?? 'ChangeMe_OnFirstLogin_!2026';
const KEEP = process.argv.includes('--keep');

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let token = '';
async function signIn(): Promise<void> {
  const res = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const login = (await res.json()) as Json;
  token = login['data']?.['accessToken'] ?? '';
  if (!token) throw new Error('login failed: ' + JSON.stringify(login));
}
async function call(method: string, path: string, body?: unknown, retried = false): Promise<Json> {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  // The admin token lives 15 minutes; a long run signs in again once.
  if (res.status === 401 && !retried && path !== '/auth/login') {
    await signIn();
    return call(method, path, body, true);
  }
  if (res.status === 204) return { success: true };
  return (await res.json()) as Json;
}
async function ok(method: string, path: string, body?: unknown): Promise<Json> {
  const r = await call(method, path, body);
  if (r['success'] !== true) throw new Error(`${method} ${path} → ${JSON.stringify(r)}`);
  return r['data'];
}

// ── Independent money formulas (NOT the engine's code) ──────────────────────────────────────
const annuity = (P: number, ratePct: number, n: number): number => {
  const r = ratePct / 100 / 12;
  return r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
};
const flatInstalment = (P: number, ratePct: number, n: number): number =>
  (P * (1 + (ratePct / 100) * (n / 12))) / n;
const pvAnnuity = (A: number, ratePct: number, n: number): number => {
  const r = ratePct / 100 / 12;
  return r === 0 ? A * n : (A * (1 - Math.pow(1 + r, -n))) / r;
};
const pvFlat = (A: number, ratePct: number, n: number): number => (A * n) / (1 + (ratePct / 100) * (n / 12));
const instalmentFor = (P: number, ratePct: number, n: number, basis: string): number =>
  basis === 'flat' ? flatInstalment(P, ratePct, n) : annuity(P, ratePct, n);

// ── Answers ──────────────────────────────────────────────────────────────────────────────────
type Answer = { questionCode: string; optionCode?: string; optionCodes?: string[]; numericValue?: string; textValue?: string };
const A = (code: string, v: string | number | string[]): Answer =>
  Array.isArray(v)
    ? { questionCode: code, optionCodes: v }
    : typeof v === 'number'
      ? { questionCode: code, numericValue: String(v) }
      : { questionCode: code, optionCode: v };

const BASE_PROFILE: Record<string, string | number | string[]> = {
  monthly_income: 10000,
  repayment_period_months: 60,
  amount_requested: 100000,
  months_in_current_job: 36,
  can_transfer_salary: 'yes',
  residence_governorate: 'cairo',
  additional_income: 'no',
  has_bank_statement: 'yes',
  current_loans: ['none'],
  i_score_band: 'above_625',
};
const answers = (over: Record<string, string | number | string[] | undefined> = {}): Answer[] =>
  Object.entries({ ...BASE_PROFILE, ...over })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => A(k, v as string | number | string[]));

async function simulate(body: Json): Promise<Json> {
  return call('POST', '/matching/simulate', body);
}

/**
 * A program in a run's result. Shown programs carry an offer; since v36.0.0 the customer sees
 * only what they match, and the simulator lists the rest under `hidden` with the reason —
 * returned here in the same shape (`figures: null`, `figuresUnavailableReason`).
 */
function lookup(r: Json, code: string): Json | undefined {
  const shown = (r['data']?.['matches'] as Json[] | undefined)?.find((m) => m['programCode'] === code);
  if (shown) return shown;
  const h = (r['data']?.['hidden'] as Json[] | undefined)?.find((m) => m['programCode'] === code);
  return h ? { ...h, figures: null, figuresUnavailableReason: h['reason'] } : undefined;
}

// ── Reporting ────────────────────────────────────────────────────────────────────────────────
let passed = 0;
const failures: string[] = [];
function expect(label: string, cond: boolean, detail: string): void {
  if (cond) passed++;
  else failures.push(`${label} — ${detail}`);
}
const near = (a: number, b: number, tol = 0.05): boolean => Math.abs(a - b) <= tol;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PART A — TESTING fixtures with exact expectations
// ═════════════════════════════════════════════════════════════════════════════════════════════
const NAME_KEY = 'testing_loans';
/** One TESTING bank per fixture: a bank sells one program per name and loan type. */
const bankNameOf = (i: number): string => `TESTING Bank ${i + 1}`;
/** The fixture whose bank is a partner bank — what "fastest answer" puts first. */
const FEATURED_FIXTURE = 'TESTING-ISCORE';

interface Fixture {
  code: string;
  friendly: string;
  rate: number;
  basis: 'reducing' | 'flat';
  minMonths: number;
  maxMonths: number;
  minAmount: number;
  maxAmount: number;
  dbrCap: number;
  dbrBands?: { capPercent: string; upToIncomeEGP: string | null }[];
  iScoreTiers?: { bands: { fromInclusive: string; toExclusive: string | null; incomeEGP: string }[] };
  adminFeePct: number;
  docs: string[];
  /** Part D: another loan type, another name, a no-payslip rule, a financed-share cap. */
  category?: 'personal' | 'car' | 'mortgage' | 'business';
  nameKey?: string;
  programType?: 'income_proof' | 'income_surrogate';
  incomeAssumption?: Json;
  ltvPercent?: number;
}
const DOCS = ['national_id', 'salary_certificate', 'hr_letter', 'bank_statement'];
const FIXTURES: Fixture[] = [
  // The plain case: one DBR cap, one rate, a 1% admin fee.
  { code: 'TESTING-SIMPLE', friendly: 'TESTING Simple', rate: 24, basis: 'reducing', minMonths: 12, maxMonths: 60, minAmount: 10000, maxAmount: 1000000, dbrCap: 50, adminFeePct: 1, docs: DOCS },
  // DBR by income band: ≤5,000 → 30% · ≤15,000 → 40% · above → 50%.
  { code: 'TESTING-BANDS', friendly: 'TESTING Bands', rate: 20, basis: 'reducing', minMonths: 12, maxMonths: 60, minAmount: 10000, maxAmount: 1000000, dbrCap: 50,
    dbrBands: [ { capPercent: '30', upToIncomeEGP: '5000' }, { capPercent: '40', upToIncomeEGP: '15000' }, { capPercent: '50', upToIncomeEGP: null } ],
    adminFeePct: 1, docs: DOCS.slice(0, 3) },
  // I-Score: below 521 → 60% of income counted · 521–625 → 80% · above → 100%.
  { code: 'TESTING-ISCORE', friendly: 'TESTING I-Score', rate: 22, basis: 'reducing', minMonths: 12, maxMonths: 60, minAmount: 10000, maxAmount: 1000000, dbrCap: 50,
    iScoreTiers: { bands: [ { fromInclusive: '0', toExclusive: '521', incomeEGP: '60' }, { fromInclusive: '521', toExclusive: '626', incomeEGP: '80' }, { fromInclusive: '626', toExclusive: null, incomeEGP: '100' } ] },
    adminFeePct: 1, docs: DOCS.slice(0, 2) },
  // A flat rate and a 48-month ceiling.
  { code: 'TESTING-FLAT', friendly: 'TESTING Flat', rate: 12, basis: 'flat', minMonths: 12, maxMonths: 48, minAmount: 10000, maxAmount: 1000000, dbrCap: 50, adminFeePct: 1, docs: DOCS.slice(0, 1) },
];

async function ensureFixtures(): Promise<void> {
  // Banks
  const banks = (await ok('GET', '/banks')) as Json[];
  const bankOf: Json[] = [];
  for (const [i, f] of FIXTURES.entries()) {
    let bank = banks.find((b) => b['nameEnglish'] === bankNameOf(i));
    if (!bank) {
      bank = await ok('POST', '/banks', {
        nameEnglish: bankNameOf(i),
        nameArabic: `بنك TESTING ${i + 1}`,
        isActive: true,
        isFeatured: f.code === FEATURED_FIXTURE,
        notes: 'TESTING fixture for check:engine — not a real bank.',
      });
    } else if (!bank['isActive']) {
      bank = await ok('PATCH', `/banks/${bank['id']}/toggle`, { isActive: true, version: bank['version'] });
    }
    bankOf.push(bank);
  }

  // Program name
  const names = (await ok('GET', '/enumerations?type=program_name')) as Json[];
  let name = names.find((n) => n['key'] === NAME_KEY);
  if (!name) {
    name = await ok('POST', '/enumerations', { type: 'program_name', key: NAME_KEY, labelEn: 'TESTING Loans', labelAr: 'قروض TESTING', incomeBases: ['payslip'], categories: ['personal'] });
  } else if (!name['active']) {
    await ok('PATCH', `/enumerations/${name['id']}`, { active: true });
  }

  // Programs — copy a live payslip program's full shape, then put the simple numbers in.
  for (const [i, f] of FIXTURES.entries()) {
    await upsertFixture(f, bankNameOf(i), bankOf[i]!['id']);
  }
}

let templateCache: Json | null = null;
/** Create or update one TESTING program from its fixture, and switch it on. */
async function upsertFixture(f: Fixture, bankName: string, bankId: string): Promise<void> {
  const template = (templateCache ??= await ok('GET', '/bank-programs/ABK-PER-PRIVATE_SECTOR'));
  const existing = await call('GET', `/bank-programs/${f.code}`);
  const body = {
    bankName,
    bankId,
    friendlyName: f.friendly,
    friendlyNameAr: f.friendly,
    programNameKey: f.nameKey ?? NAME_KEY,
    programType: f.programType ?? 'income_proof',
    productCategory: f.category ?? 'personal',
    isShariaCompliant: false,
    operatorNotes: 'TESTING fixture for check:engine.',
    requiredDocuments: f.docs,
    tenor: { minMonths: f.minMonths, maxMonths: f.maxMonths },
    loanLimits: {
      minAmountEGP: String(f.minAmount),
      maxAmountEGP: String(f.maxAmount),
      ...(f.ltvPercent !== undefined ? { ltvCeilingPercent: String(f.ltvPercent) } : {}),
    },
    pricing: { isVariableRate: false, baseRatePercent: String(f.rate), rateBasis: f.basis },
    eligibility: (() => {
      // The template's own band table goes; a fixture states one or none.
      const { dbrBands: _drop, ...rest } = template['eligibility'] as Json;
      void _drop;
      return {
        ...rest,
        ageMin: 21,
        ageMax: 60,
        // The rules a customer must meet to be SHOWN the program (v36.0.0).
        minMonthlyIncomeEGP: '3000',
        minMonthsInJob: 6,
        acceptedTransferTypes: ['payroll', 'salary_transfer_letter'],
        dbrCapPercent: String(f.dbrCap),
        ...(f.dbrBands ? { dbrBands: f.dbrBands } : {}),
      };
    })(),
    incomeAssumption: f.incomeAssumption ?? { strategy: 'declared', ...(f.iScoreTiers ? { iScoreTiers: f.iScoreTiers } : {}) },
    fees: {
      ...template['fees'],
      adminFeePercent: String(f.adminFeePct),
      stampDutyPercent: '0',
      lifeInsurancePercent: '0',
      lifeInsuranceMandatory: false,
    },
  };
  if (existing['success'] === true) {
    await ok('POST', `/bank-programs/${f.code}`, { ...body, version: existing['data']['version'] });
  } else {
    await ok('POST', '/bank-programs', { ...body, programCode: f.code });
  }
  const now = await ok('GET', `/bank-programs/${f.code}`);
  if (!now['active']) await ok('POST', `/bank-programs/${f.code}/toggle`, { active: true, version: now['version'] });
}

/**
 * Remove every TESTING row this run made — programs, then names, then banks — so nothing of it
 * is left in the dashboard (an inactive name still shows on the catalog, and a name on a product
 * shows on that product's card). The next run creates them again.
 */
async function removeFixtures(): Promise<void> {
  for (const fx of [...FIXTURES, ...EXTRA_FIXTURES]) {
    const now = await call('GET', `/bank-programs/${fx.code}`);
    if (now['success'] !== true) continue;
    const res = await fetch(`${API}/bank-programs/${fx.code}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'x-confirm-program-code': fx.code },
    });
    if (res.status >= 300) throw new Error(`delete ${fx.code} → ${res.status} ${await res.text()}`);
  }
  const names = (await ok('GET', '/enumerations?type=program_name')) as Json[];
  for (const n of names.filter((x) => x['key'] === NAME_KEY || x['key'] === NOPAY_NAME_KEY)) {
    await ok('DELETE', `/enumerations/${n['id']}`);
  }
  for (const b of (await ok('GET', '/banks')) as Json[]) {
    if (String(b['nameEnglish']).startsWith('TESTING Bank')) await ok('DELETE', `/banks/${b['id']}`);
  }
}

/** What a fixture should quote, worked out by hand from its numbers. */
function expectedQuote(
  f: Fixture,
  a: { income: number; debts: number; request: number; tenor: number; incomeFactorPct?: number; age?: number; carPrice?: number; monthsInJob?: number; transfer?: 'yes' | 'no' },
): { tenor: number; offered: number; cash: number; instalment: number; binding: string; dbrCap: number } | { refused: string; rule?: string } {
  // The rules a TESTING program states: age 21–60, income ≥ 3,000, 6+ months in the job, and
  // (payslip programs) a salary that can be transferred. Failing one HIDES the program.
  if (a.age !== undefined && (a.age < 21 || a.age > 60)) return { refused: 'NOT_ELIGIBLE', rule: 'age' };
  if (a.income < 3000) return { refused: 'NOT_ELIGIBLE', rule: 'monthly_income' };
  if ((a.monthsInJob ?? 36) < 6) return { refused: 'NOT_ELIGIBLE', rule: 'months_in_job' };
  if (a.transfer === 'no' && f.programType !== 'income_surrogate') return { refused: 'NOT_ELIGIBLE', rule: 'salary_transfer' };
  const ageCapMonths = a.age !== undefined ? (60 - a.age) * 12 : Infinity;
  const tenor = Math.min(Math.max(a.tenor, f.minMonths), f.maxMonths, ageCapMonths);
  if (tenor < f.minMonths) return { refused: 'AGE_AT_MATURITY' };
  const income = a.income * ((a.incomeFactorPct ?? 100) / 100);
  const cap = f.dbrBands
    ? Number((f.dbrBands.find((b) => b.upToIncomeEGP === null || income <= Number(b.upToIncomeEGP)) ?? f.dbrBands[f.dbrBands.length - 1]!).capPercent)
    : f.dbrCap;
  const room = (income * cap) / 100 - a.debts;
  if (room <= 0) return { refused: 'OBLIGATIONS_EXCEED_ALLOWANCE' };
  if (a.request < f.minAmount) return { refused: 'REQUESTED_BELOW_PROGRAM_MIN_AMOUNT' };
  const fee = 1 + f.adminFeePct / 100;
  const maxOffered = f.basis === 'flat' ? pvFlat(room, f.rate, tenor) : pvAnnuity(room, f.rate, tenor);
  // A financed-share cap: the cash is at most that share of the car's price.
  const ltvCash = f.ltvPercent !== undefined && a.carPrice !== undefined ? (a.carPrice * f.ltvPercent) / 100 : Infinity;
  const wantCash = Math.min(a.request, ltvCash);
  const wantOffered = wantCash * fee;
  if (wantOffered <= maxOffered) {
    const offered = Math.round(wantOffered * 100) / 100;
    // The term was cut to the program's ceiling: the engine reports that as the binding limit.
    const binding =
      wantCash < a.request ? 'ltv_ceiling' : a.tenor > f.maxMonths && tenor === f.maxMonths ? 'tenor_max' : 'requested_amount';
    return { tenor, offered, cash: wantCash, instalment: instalmentFor(offered, f.rate, tenor, f.basis), binding, dbrCap: cap };
  }
  const cash = maxOffered / fee;
  return { tenor, offered: maxOffered, cash, instalment: room, binding: 'dbr_affordability', dbrCap: cap };
}

async function partA(): Promise<void> {
  console.log('\n══ Part A — TESTING fixtures (exact expectations) ══');
  await ensureFixtures();

  // A program without its own I-Score table reads the platform default (the program page shows
  // it as platformIScoreTiers). A band is priced at the WEAKEST tier it overlaps.
  const platform = ((await ok('GET', '/bank-programs/TESTING-SIMPLE'))['platformIScoreTiers'] ?? null) as Fixture['iScoreTiers'] | null;
  const factorFor = (f: Fixture, [from, to]: [number, number]): number => {
    const tiers = f.iScoreTiers ?? platform;
    if (!tiers) return 100;
    const hit = tiers.bands
      .filter((t) => Number(t.fromInclusive) < to && (t.toExclusive === null || Number(t.toExclusive) > from))
      .map((t) => Number(t.incomeEGP));
    return hit.length ? Math.min(...hit) : 100;
  };

  const cases: { name: string; over: Record<string, string | number | string[] | undefined>; age: number; income: number; debts: number; request: number; tenor: number; months?: number; transfer?: 'yes' | 'no'; factor?: (f: Fixture) => number }[] = [
    // Shown only what they match (v36.0.0): each rule the TESTING programs state, failed once.
    { name: 'income 2,500 — below the 3,000 minimum', over: { monthly_income: 2500 }, age: 35, income: 2500, debts: 0, request: 100000, tenor: 60 },
    { name: '3 months in the job — below the 6 required', over: { months_in_current_job: 3 }, age: 35, income: 10000, debts: 0, request: 100000, tenor: 60, months: 3 },
    { name: 'cannot transfer the salary', over: { can_transfer_salary: 'no' }, age: 35, income: 10000, debts: 0, request: 100000, tenor: 60, transfer: 'no' },
    { name: 'age 65 — above the 60 maximum', over: {}, age: 65, income: 10000, debts: 0, request: 100000, tenor: 60 },
    { name: 'asks what income allows', over: {}, age: 35, income: 10000, debts: 0, request: 100000, tenor: 60 },
    { name: 'asks far more than income allows', over: { amount_requested: 2000000 }, age: 35, income: 10000, debts: 0, request: 2000000, tenor: 60 },
    { name: 'existing loan 2,000/month', over: { amount_requested: 2000000, current_loans: ['personal_loan'], obligation_personal_loan: 2000 }, age: 35, income: 10000, debts: 2000, request: 2000000, tenor: 60 },
    { name: 'card limit 100,000 (5% = 5,000/month)', over: { amount_requested: 2000000, current_loans: ['credit_cards'], credit_card_total_limit: 100000 }, age: 35, income: 10000, debts: 5000, request: 2000000, tenor: 60 },
    { name: 'term longer than any program allows', over: { repayment_period_months: 120 }, age: 35, income: 10000, debts: 0, request: 100000, tenor: 120 },
    { name: 'term shorter than the minimum', over: { repayment_period_months: 6 }, age: 35, income: 10000, debts: 0, request: 100000, tenor: 6 },
    { name: 'age 58 (ageMax 60 → 24 months)', over: {}, age: 58, income: 10000, debts: 0, request: 100000, tenor: 60 },
    { name: 'income 4,000 (bands: 30%)', over: { monthly_income: 4000, amount_requested: 2000000 }, age: 35, income: 4000, debts: 0, request: 2000000, tenor: 60 },
    { name: 'income 20,000 (bands: 50%)', over: { monthly_income: 20000, amount_requested: 2000000 }, age: 35, income: 20000, debts: 0, request: 2000000, tenor: 60 },
    { name: 'I-Score below 521', over: { amount_requested: 2000000, i_score_band: 'below_521' }, age: 35, income: 10000, debts: 0, request: 2000000, tenor: 60, factor: (f) => factorFor(f, [0, 521]) },
    { name: 'I-Score 521–625', over: { amount_requested: 2000000, i_score_band: 'from_521_to_625' }, age: 35, income: 10000, debts: 0, request: 2000000, tenor: 60, factor: (f) => factorFor(f, [521, 626]) },
  ];

  for (const c of cases) {
    const r = await simulate({ category: 'personal', age: c.age, programNameKey: NAME_KEY, answers: answers(c.over) });
    if (r['success'] !== true) {
      failures.push(`A · ${c.name} — request failed: ${JSON.stringify(r).slice(0, 200)}`);
      continue;
    }
    const listed = [...((r['data']['matches'] ?? []) as Json[]), ...((r['data']['hidden'] ?? []) as Json[])];
    expect(`A · ${c.name}`, listed.length === FIXTURES.length, `expected ${FIXTURES.length} TESTING programs, got ${listed.length}`);
    for (const f of FIXTURES) {
      const m = lookup(r, f.code);
      const label = `A · ${c.name} · ${f.code}`;
      if (!m) { failures.push(`${label} — missing`); continue; }
      const exp = expectedQuote(f, { income: c.income, debts: c.debts, request: c.request, tenor: c.tenor, age: c.age, ...(c.months !== undefined ? { monthsInJob: c.months } : {}), ...(c.transfer ? { transfer: c.transfer } : {}), ...(c.factor ? { incomeFactorPct: c.factor(f) } : {}) });
      const fig = m['figures'] as Json | null;
      if ('refused' in exp) {
        expect(label, fig === null && m['figuresUnavailableReason'] === exp.refused, `expected refusal ${exp.refused}, got ${fig ? 'figures' : m['figuresUnavailableReason']}`);
        if (exp.rule) expect(label + ' rule', ((m['failedRules'] ?? []) as string[]).includes(exp.rule), `expected rule ${exp.rule}, got ${JSON.stringify(m['failedRules'])}`);
        continue;
      }
      if (!fig) { failures.push(`${label} — expected figures, got ${m['figuresUnavailableReason']}`); continue; }
      expect(label + ' term', fig['effectiveTenorMonths'] === exp.tenor, `term ${fig['effectiveTenorMonths']} ≠ ${exp.tenor}`);
      expect(label + ' rate', near(+fig['effectiveRatePercent'], f.rate, 0.0001), `rate ${fig['effectiveRatePercent']} ≠ ${f.rate}`);
      expect(label + ' basis', fig['rateBasis'] === f.basis, `basis ${fig['rateBasis']} ≠ ${f.basis}`);
      expect(label + ' binding', fig['bindingConstraint'] === exp.binding, `binding ${fig['bindingConstraint']} ≠ ${exp.binding}`);
      expect(label + ' DBR cap', near(+fig['dbrCapPercent'], exp.dbrCap, 0.0001), `cap ${fig['dbrCapPercent']} ≠ ${exp.dbrCap}`);
      expect(label + ' instalment', near(+fig['monthlyInstallmentEGP'], exp.instalment, 1), `instalment ${fig['monthlyInstallmentEGP']} ≠ ${exp.instalment.toFixed(2)}`);
      expect(label + ' cash', near(+fig['cashToCustomerEGP'], exp.cash, 1), `cash ${fig['cashToCustomerEGP']} ≠ ${exp.cash.toFixed(2)}`);
      expect(label + ' loan', near(+fig['offeredAmountEGP'], exp.offered, 1), `loan ${fig['offeredAmountEGP']} ≠ ${exp.offered.toFixed(2)}`);
    }
  }

  // Order: each priority sorts the four TESTING programs by its own key.
  // lowest instalment → BANDS(20%) < ISCORE(22%) < SIMPLE(24%) on 60 months; FLAT is 48 months so higher.
  const orderCases: [string | undefined, string[]][] = [
    ['lowest_interest_rate', ['TESTING-FLAT', 'TESTING-BANDS', 'TESTING-ISCORE', 'TESTING-SIMPLE']],
    ['least_documentation_required', ['TESTING-FLAT', 'TESTING-ISCORE', 'TESTING-BANDS', 'TESTING-SIMPLE']],
    // Partner bank first (ISCORE's bank is featured), then fewest documents.
    ['fastest_approval', ['TESTING-ISCORE', 'TESTING-FLAT', 'TESTING-BANDS', 'TESTING-SIMPLE']],
    [undefined, ['TESTING-ISCORE', 'TESTING-FLAT', 'TESTING-BANDS', 'TESTING-SIMPLE']],
  ];
  for (const [prio, want] of orderCases) {
    const r = await simulate({ category: 'personal', age: 35, programNameKey: NAME_KEY, answers: answers(prio ? { priority_factor: prio } : {}) });
    const got = (r['data']?.['matches'] as Json[] | undefined)?.map((m) => m['programCode']) ?? [];
    expect(`A · order · ${prio ?? 'unanswered'}`, JSON.stringify(got) === JSON.stringify(want), `got ${got.join(' > ')}, want ${want.join(' > ')}`);
  }
  {
    const r = await simulate({ category: 'personal', age: 35, programNameKey: NAME_KEY, answers: answers({ priority_factor: 'lowest_monthly_installment' }) });
    const inst = (r['data']['matches'] as Json[]).map((m) => +m['monthlyInstallmentEGP']);
    expect('A · order · lowest_monthly_installment', inst.every((x, i) => i === 0 || inst[i - 1]! <= x), `instalments not ascending: ${inst.join(', ')}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PART B — every live program, answered as its own name asks
// ═════════════════════════════════════════════════════════════════════════════════════════════
interface QBounds { min: number | null; max: number | null; step: number | null }

function pickNumber(code: string, b: QBounds | undefined, profile: Record<string, number>): number {
  if (profile[code] !== undefined) return profile[code]!;
  const min = b?.min ?? 0;
  const max = b?.max ?? min + 100;
  let v = min + (max - min) * 0.1;
  if (/year/.test(code) && max >= 2000) v = Math.min(max, 2024);
  if (b?.step) v = min + Math.round((v - min) / b.step) * b.step;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function gateOpen(gate: Json | null, chosen: Map<string, string[]>): boolean {
  if (!gate) return true;
  const picked = chosen.get(gate['questionCode']);
  if (!picked) return false;
  if (gate['operator'] === 'equals') return picked.includes(gate['optionCode']);
  if (gate['operator'] === 'not_equals') return !picked.includes(gate['optionCode']);
  if (gate['operator'] === 'in') return (gate['optionCodes'] as string[]).some((c) => picked.includes(c));
  return false;
}

/** Each question's numeric bounds, loaded once from the pool. */
const BOUNDS = new Map<string, QBounds>();
async function loadBounds(): Promise<void> {
  if (BOUNDS.size > 0) return;
  const tree = (await ok('GET', '/questionnaire/tree')) as Json;
  for (const g of (tree['groups'] ?? tree) as Json[]) {
    for (const q of g['questions'] as Json[]) {
      BOUNDS.set(q['code'], {
        min: q['numericMinValue'] != null ? +q['numericMinValue'] : null,
        max: q['numericMaxValue'] != null ? +q['numericMaxValue'] : null,
        step: q['numericStep'] != null ? +q['numericStep'] : null,
      });
    }
  }
}

/** The questions a program name serves in a loan type, in order. */
async function servedQuestions(key: string, cat: string): Promise<Json[]> {
  const served = (await ok('GET', `/questionnaire/served?programNameKey=${key}`)) as Json[];
  const pages = (served.find((x) => x['category'] === cat)?.['pages'] ?? []) as Json[];
  return pages.flatMap((p) => p['questions'] as Json[]);
}

/** A sample applicant's answers, before any variant. */
const PROFILE: Record<string, number> = {
  monthly_income: 20000,
  amount_requested: 300000,
  repayment_period_months: 60,
  months_in_current_job: 36,
  car_price: 800000,
  car_down_payment: 200000,
  car_model_year: 2025,
  // Debts a real applicant might carry — not the middle of a 0–5,000,000 question.
  obligation_car_loan: 3000,
  obligation_personal_loan: 2000,
  obligation_mortgage: 4000,
  obligation_other: 1000,
  credit_card_total_limit: 50000,
  car_loan_original_tenor: 60,
  // Past half its term and booked with 50% down — what a cross-sell product asks of it.
  car_loan_instalments_paid: 36,
  car_loan_down_payment: 200000,
  how_much_was_the_car_loan_when_it_started: 400000,
};
const CHOICE: Record<string, string | string[]> = {
  current_loans: ['none'],
  i_score_band: 'above_625',
  can_transfer_salary: 'yes',
  additional_income: 'no',
  has_bank_statement: 'yes',
  residence_governorate: 'cairo',
  priority_factor: 'lowest_monthly_installment',
  car_fuel_type: 'petrol_diesel',
  car_origin: 'japan',
  car_dealer: 'other_authorized',
};


/** The served questions of a name, answered: the base profile, then the variant's overrides. */
function buildAnswers(
  qs: Json[],
  numOver: Record<string, number>,
  choiceOver: Record<string, string | string[]>,
): Answer[] {
  const prof = { ...PROFILE, ...numOver };
  const pick: Record<string, string | string[]> = { ...CHOICE, ...choiceOver };
  const chosen = new Map<string, string[]>();
  const ans: Answer[] = [];
  for (let pass = 0; pass < 3; pass++) {
    for (const q of qs) {
      if (ans.some((a) => a.questionCode === q['code'])) continue;
      if (!gateOpen(q['enabledWhen'], chosen)) continue;
      const opts = (q['options'] as Json[]).map((o) => o['code'] as string);
      if (q['type'] === 'NUMERIC') ans.push(A(q['code'], pickNumber(q['code'], BOUNDS.get(q['code']), prof)));
      else if (q['type'] === 'TEXT') ans.push({ questionCode: q['code'], textValue: 'TESTING' });
      else if (q['type'] === 'MULTI_SELECT') {
        const want = ([] as string[]).concat(pick[q['code']] ?? []).filter((c) => opts.includes(c));
        const v = want.length ? want : opts.slice(0, 1);
        if (!v.length) continue;
        ans.push(A(q['code'], v));
        chosen.set(q['code'], v);
      } else {
        const want = pick[q['code']] as string | undefined;
        const v = want && opts.includes(want) ? want : opts[0];
        if (!v) continue;
        ans.push(A(q['code'], v));
        chosen.set(q['code'], [v]);
      }
    }
  }
  return ans;
}

async function partB(): Promise<void> {
  console.log('\n══ Part B — every live program, answered as its own name asks ══');
  await loadBounds();
  const programList: Json[] = [];
  for (let page = 1; page < 50; page++) {
    const r = await call('GET', `/bank-programs?pageSize=100&page=${page}`);
    if (r['success'] !== true) throw new Error('program list: ' + JSON.stringify(r).slice(0, 200));
    const rows = (Array.isArray(r['data']) ? r['data'] : (r['data']?.['items'] ?? [])) as Json[];
    programList.push(...rows);
    if (rows.length < 100) break;
  }
  const byCode = new Map<string, Json>();
  for (const p of programList) byCode.set(p['programCode'], p);
  const live = programList.filter((p) => p['active'] && !String(p['programCode']).startsWith('TESTING-'));

  const names = ((await ok('GET', '/enumerations?type=program_name')) as Json[]).filter((n) => n['active'] && n['key'] !== NAME_KEY);
  const quotedOnce = new Set<string>();
  const reasons = new Map<string, Set<string>>();
  let offers = 0;
  /** Run one applicant through a name; verify every offer; return the codes left unpriced. */
  const runAndCheck = async (cat: string, key: string, age: number, ans: Answer[], label: string): Promise<Set<string>> => {
    const unpriced = new Set<string>();
    const r = await simulate({ category: cat, age, programNameKey: key, answers: ans });
    const tag = `B · ${cat} · ${key}${label}`;
    if (r['success'] !== true) {
      failures.push(`${tag} — request failed: ${JSON.stringify(r).slice(0, 240)}`);
      return unpriced;
    }
    const requested = Number(ans.find((a) => a.questionCode === 'amount_requested')?.numericValue ?? Infinity);
    for (const h of (r['data']['hidden'] ?? []) as Json[]) {
      unpriced.add(h['programCode']);
      const set = reasons.get(h['programCode']) ?? new Set<string>();
      set.add(`${h['reason']}${h['failedRules'] ? ' ' + JSON.stringify(h['failedRules']) : ''}`);
      reasons.set(h['programCode'], set);
    }
    for (const m of r['data']['matches'] as Json[]) {
      const code = m['programCode'] as string;
      const f = m['figures'] as Json | null;
      if (!f) {
        unpriced.add(code);
        const set = reasons.get(code) ?? new Set<string>();
        set.add(`${m['figuresUnavailableReason']}${m['missingFactKeys'] ? ' ' + JSON.stringify(m['missingFactKeys']) : ''}`);
        reasons.set(code, set);
        continue;
      }
      quotedOnce.add(code);
      offers++;
      const L = `${tag} · ${code}`;
      const P = +f['offeredAmountEGP'];
      const inst = +f['monthlyInstallmentEGP'];
      const nM = f['effectiveTenorMonths'] as number;
      const rate = +f['effectiveRatePercent'];
      const want = instalmentFor(P, rate, nM, f['rateBasis']);
      expect(L + ' instalment', near(want, inst, 0.05), `${inst} ≠ ${want.toFixed(2)} (${f['rateBasis']} ${rate}% ${nM}m on ${P})`);
      expect(L + ' cash+fees', near(+f['cashToCustomerEGP'] + +f['totalFeesEGP'], P), `${f['cashToCustomerEGP']} + ${f['totalFeesEGP']} ≠ ${P}`);
      // The FINANCED lines only; the car-insurance lines beside them are a disclosure, paid apart.
      const fees = (f['fees'] ?? {}) as Json;
      const feeLines = ['adminFeeEGP', 'stampDutyEGP', 'lifeInsuranceEGP', 'collateralFeeEGP'].reduce((sum, k) => sum + (+fees[k] || 0), 0);
      expect(L + ' fee lines', near(feeLines, +f['totalFeesEGP']), `lines ${feeLines.toFixed(2)} ≠ ${f['totalFeesEGP']}`);
      expect(L + ' total payable', near(inst * nM, +f['totalPayableEGP'], 0.5), `${f['totalPayableEGP']} ≠ ${(inst * nM).toFixed(2)}`);
      expect(L + ' cost of credit', near(+f['totalPayableEGP'] - +f['cashToCustomerEGP'], +f['totalCostOfCreditEGP'], 0.5), 'payable − cash ≠ cost of credit');
      if (f['dbrPercent'] != null && f['dbrCapPercent'] != null) {
        expect(L + ' DBR', +f['dbrPercent'] <= +f['dbrCapPercent'] + 0.01, `${f['dbrPercent']}% over cap ${f['dbrCapPercent']}%`);
      }
      expect(L + ' not over request', +f['cashToCustomerEGP'] <= requested + 0.5, `cash ${f['cashToCustomerEGP']} > requested ${requested}`);
      // What the customer RECEIVES never passes the stated maximum. (The figure is the loan when
      // the debt ratio binds and the cash when a ceiling does — reported, not asserted.)
      expect(L + ' within max affordable', +f['cashToCustomerEGP'] <= +f['maxAffordableAmountEGP'] + 0.5, `cash ${f['cashToCustomerEGP']} > max affordable ${f['maxAffordableAmountEGP']}`);
      const p = byCode.get(code);
      if (p) {
        const t = p['tenor'] ?? {};
        if (t['maxMonths'] != null) expect(L + ' term ≤ program max', nM <= +t['maxMonths'], `${nM} > ${t['maxMonths']}`);
        const lim = p['loanLimits'] ?? {};
        if (lim['maxAmountEGP'] != null) expect(L + ' loan ≤ program max', P <= +lim['maxAmountEGP'] + 0.5, `${P} > ${lim['maxAmountEGP']}`);
        const base = p['pricing']?.['baseRatePercent'];
        const hasTables = Object.keys(p['pricing'] ?? {}).some((k) => /^rateBy|Bands|Tiers/.test(k)) || p['plansSource'] != null;
        if (base != null && !hasTables) expect(L + ' rate = program rate', near(rate, +base, 0.0001), `rate ${rate} ≠ program ${base}`);
      }
    }
    return unpriced;
  };

  for (const n of names) {
    for (const cat of (n['categories'] ?? []) as string[]) {
      const served = (await ok('GET', `/questionnaire/served?programNameKey=${n['key']}`)) as Json[];
      const pages = (served.find((x) => x['category'] === cat)?.['pages'] ?? []) as Json[];
      const qs = pages.flatMap((p) => p['questions'] as Json[]);
      let left = await runAndCheck(cat, n['key'], 35, buildAnswers(qs, {}, {}), '');
      if (left.size === 0) continue;

      // Anything still unpriced: other applicants a real customer could be — younger, a dearer,
      // older or electric car, each kind of existing debt, and each answer of this name's own
      // choice questions. Every offer they produce is verified the same way.
      const variants: { label: string; age: number; num: Record<string, number>; pick: Record<string, string | string[]> }[] = [
        { label: ' [age 25]', age: 25, num: {}, pick: {} },
        { label: ' [income 60,000]', age: 35, num: { monthly_income: 60000 }, pick: {} },
        { label: ' [age 55]', age: 55, num: {}, pick: {} },
        { label: ' [car 3M, 1M down]', age: 35, num: { car_price: 3000000, car_down_payment: 1000000 }, pick: {} },
        { label: ' [2018 car]', age: 35, num: { car_model_year: 2018 }, pick: {} },
        { label: ' [electric car]', age: 35, num: {}, pick: { car_fuel_type: 'electric' } },
        // A used-car table may want 40%+ down: half down on a 2020 car, and on an electric one.
        { label: ' [2020 car, 50% down]', age: 35, num: { car_model_year: 2020, car_down_payment: 400000, amount_requested: 400000 }, pick: {} },
        { label: ' [electric, 50% down]', age: 35, num: { car_down_payment: 400000, amount_requested: 400000 }, pick: { car_fuel_type: 'electric' } },
      ];
      const debtQ = qs.find((q) => q['code'] === 'current_loans');
      for (const o of (debtQ?.['options'] ?? []) as Json[]) {
        if (o['code'] !== 'none') variants.push({ label: ` [debt: ${o['code']}]`, age: 35, num: {}, pick: { current_loans: [o['code']] } });
      }
      for (const q of qs) {
        if (q['type'] !== 'SINGLE_SELECT' || CHOICE[q['code']] !== undefined) continue;
        for (const o of (q['options'] as Json[]).slice(1)) {
          variants.push({ label: ` [${q['code']}=${o['code']}]`, age: 35, num: {}, pick: { [q['code']]: o['code'] } });
        }
      }
      for (const v of variants.slice(0, 60)) {
        if (left.size === 0) break;
        await runAndCheck(cat, n['key'], v.age, buildAnswers(qs, v.num, v.pick), v.label);
        left = new Set([...left].filter((c) => !quotedOnce.has(c)));
      }
    }
  }
  const neverQuoted = live.filter((p) => !quotedOnce.has(p['programCode']));
  console.log(`  ${names.length} program names · ${offers} offers checked · ${quotedOnce.size}/${live.length} live programs quoted at least once`);
  if (neverQuoted.length) {
    console.log('  live programs that never produced figures (with the reason the engine gave):');
    for (const p of neverQuoted) console.log(`    - ${p['programCode']} (${p['productCategory']}, ${p['programType']}): ${[...(reasons.get(p['programCode']) ?? new Set(['not listed under any name']))].join(' | ')}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PART D — TESTING programs in every loan type + a no-payslip one; settings changed → result follows
// ═════════════════════════════════════════════════════════════════════════════════════════════
const NOPAY_NAME_KEY = 'testing_no_payslip';
const EXTRA_FIXTURES: Fixture[] = [
  // Car: at most 80% of the car's price is financed.
  { code: 'TESTING-CAR', friendly: 'TESTING Car', category: 'car', rate: 18, basis: 'reducing', minMonths: 12, maxMonths: 60, minAmount: 10000, maxAmount: 5000000, dbrCap: 50, ltvPercent: 80, adminFeePct: 1, docs: DOCS },
  // Mortgage: a 20-year term and a 40% cap — the debt ratio binds.
  { code: 'TESTING-MORTGAGE', friendly: 'TESTING Mortgage', category: 'mortgage', rate: 15, basis: 'reducing', minMonths: 60, maxMonths: 240, minAmount: 100000, maxAmount: 10000000, dbrCap: 40, adminFeePct: 1, docs: DOCS },
  // Business: a 36-month ceiling — the term binds.
  { code: 'TESTING-BUSINESS', friendly: 'TESTING Business', category: 'business', rate: 21, basis: 'reducing', minMonths: 12, maxMonths: 36, minAmount: 50000, maxAmount: 3000000, dbrCap: 50, adminFeePct: 1, docs: DOCS },
  // No payslip: the card-limit product, this bank counting 40% of the limit as income.
  { code: 'TESTING-NOPAY', friendly: 'TESTING No Payslip', category: 'personal', nameKey: NOPAY_NAME_KEY, programType: 'income_surrogate',
    incomeAssumption: { wayId: 'primary', amounts: 'own', strategy: 'steps', stepParams: { primary: { scalar: { unit: 'percent', value: '40' } } } },
    rate: 20, basis: 'reducing', minMonths: 12, maxMonths: 60, minAmount: 10000, maxAmount: 1000000, dbrCap: 50, adminFeePct: 1, docs: DOCS.slice(0, 1) },
];

/** Compare one returned offer against what was worked out by hand. */
function compare(label: string, m: Json | undefined, f: Fixture, exp: ReturnType<typeof expectedQuote>): void {
  if (!m) { failures.push(`${label} — missing`); return; }
  const fig = m['figures'] as Json | null;
  if ('refused' in exp) {
    expect(label, fig === null && m['figuresUnavailableReason'] === exp.refused, `expected refusal ${exp.refused}, got ${fig ? 'figures' : m['figuresUnavailableReason']}`);
    return;
  }
  if (!fig) { failures.push(`${label} — expected figures, got ${m['figuresUnavailableReason']} ${JSON.stringify(m['missingFactKeys'] ?? '')}`); return; }
  expect(label + ' term', fig['effectiveTenorMonths'] === exp.tenor, `term ${fig['effectiveTenorMonths']} ≠ ${exp.tenor}`);
  expect(label + ' rate', near(+fig['effectiveRatePercent'], f.rate, 0.0001), `rate ${fig['effectiveRatePercent']} ≠ ${f.rate}`);
  expect(label + ' binding', fig['bindingConstraint'] === exp.binding, `binding ${fig['bindingConstraint']} ≠ ${exp.binding}`);
  expect(label + ' DBR cap', near(+fig['dbrCapPercent'], exp.dbrCap, 0.0001), `cap ${fig['dbrCapPercent']} ≠ ${exp.dbrCap}`);
  expect(label + ' instalment', near(+fig['monthlyInstallmentEGP'], exp.instalment, 1), `instalment ${fig['monthlyInstallmentEGP']} ≠ ${exp.instalment.toFixed(2)}`);
  expect(label + ' cash', near(+fig['cashToCustomerEGP'], exp.cash, 1), `cash ${fig['cashToCustomerEGP']} ≠ ${exp.cash.toFixed(2)}`);
  expect(label + ' loan', near(+fig['offeredAmountEGP'], exp.offered, 1), `loan ${fig['offeredAmountEGP']} ≠ ${exp.offered.toFixed(2)}`);
}

async function partD(): Promise<void> {
  console.log('\n══ Part D — TESTING car / mortgage / business / no-payslip, and settings changed → result follows ══');
  // The TESTING name offered under all four loan types; a TESTING no-payslip name on the card-limit product.
  const names = (await ok('GET', '/enumerations?type=program_name')) as Json[];
  const loans = names.find((n) => n['key'] === NAME_KEY)!;
  if (((loans['categories'] ?? []) as string[]).length < 4) {
    await ok('PUT', `/enumerations/${loans['id']}/categories`, { categories: ['personal', 'car', 'mortgage', 'business'] });
  }
  let nopay = names.find((n) => n['key'] === NOPAY_NAME_KEY);
  if (!nopay) {
    nopay = await ok('POST', '/enumerations', { type: 'program_name', key: NOPAY_NAME_KEY, labelEn: 'TESTING No Payslip', labelAr: 'TESTING بدون مفردات مرتب', incomeBases: ['no_payslip'], categories: ['personal'], surrogateProductKey: 'card_limit_share' });
  } else if (!nopay['active']) {
    await ok('PATCH', `/enumerations/${nopay['id']}`, { active: true });
  }
  const bank1 = ((await ok('GET', '/banks')) as Json[]).find((b) => b['nameEnglish'] === bankNameOf(0))!;
  for (const f of EXTRA_FIXTURES) await upsertFixture(f, bankNameOf(0), bank1['id']);

  const fx = (code: string): Fixture => EXTRA_FIXTURES.find((f) => f.code === code)!;
  const one = async (cat: string, key: string, over: Record<string, string | number | string[] | undefined>, code: string) =>
    lookup(await simulate({ category: cat, age: 35, programNameKey: key, answers: answers(over) }), code);

  // Car: 1,000,000 car, 100,000 down → asks 900,000; 80% of the price is 800,000.
  const car = { amount_requested: 900000, monthly_income: 50000, car_price: 1000000, car_down_payment: 100000, car_model_year: 2025, car_origin: 'japan', car_fuel_type: 'petrol_diesel', car_dealer: 'other_authorized' };
  compare('D · car · 80% of the price', await one('car', NAME_KEY, car, 'TESTING-CAR'), fx('TESTING-CAR'),
    expectedQuote(fx('TESTING-CAR'), { income: 50000, debts: 0, request: 900000, tenor: 60, age: 35, carPrice: 1000000 }));
  // Mortgage: 1,000,000 over 240 months on 30,000 income — 40% leaves 12,000 a month.
  compare('D · mortgage · debt ratio binds', await one('mortgage', NAME_KEY, { amount_requested: 1000000, monthly_income: 30000, repayment_period_months: 240 }, 'TESTING-MORTGAGE'), fx('TESTING-MORTGAGE'),
    expectedQuote(fx('TESTING-MORTGAGE'), { income: 30000, debts: 0, request: 1000000, tenor: 240, age: 35 }));
  // Business: asks 60 months; the program stops at 36.
  compare('D · business · term ceiling', await one('business', NAME_KEY, { amount_requested: 500000, monthly_income: 40000, repayment_period_months: 60 }, 'TESTING-BUSINESS'), fx('TESTING-BUSINESS'),
    expectedQuote(fx('TESTING-BUSINESS'), { income: 40000, debts: 0, request: 500000, tenor: 60, age: 35 }));
  // No payslip: no salary asked; a 100,000 card limit → 40% = 40,000 income, and the card is a
  // 5% (5,000) monthly debt.
  const np = { monthly_income: undefined, current_loans: ['credit_cards'], credit_card_total_limit: 100000 };
  compare('D · no payslip · fits', await one('personal', NOPAY_NAME_KEY, { ...np, amount_requested: 300000 }, 'TESTING-NOPAY'), fx('TESTING-NOPAY'),
    expectedQuote(fx('TESTING-NOPAY'), { income: 40000, debts: 5000, request: 300000, tenor: 60, age: 35 }));
  compare('D · no payslip · debt ratio binds', await one('personal', NOPAY_NAME_KEY, { ...np, amount_requested: 2000000 }, 'TESTING-NOPAY'), fx('TESTING-NOPAY'),
    expectedQuote(fx('TESTING-NOPAY'), { income: 40000, debts: 5000, request: 2000000, tenor: 60, age: 35 }));

  // Settings changed on a TESTING program → the very next quote follows; then put back.
  const base = FIXTURES[0]!;
  const bankA = ((await ok('GET', '/banks')) as Json[]).find((b) => b['nameEnglish'] === bankNameOf(0))!;
  const changes: [string, Partial<Fixture>, Record<string, string | number | string[] | undefined>, { request: number; tenor: number }][] = [
    ['rate 24% → 30%', { rate: 30 }, {}, { request: 100000, tenor: 60 }],
    ['longest term 60 → 36', { maxMonths: 36 }, {}, { request: 100000, tenor: 60 }],
    ['debt-ratio cap 50% → 40%', { dbrCap: 40 }, { amount_requested: 2000000 }, { request: 2000000, tenor: 60 }],
    ['admin fee 1% → 2%', { adminFeePct: 2 }, {}, { request: 100000, tenor: 60 }],
    ['largest loan → 50,000', { maxAmount: 50000 }, {}, { request: 100000, tenor: 60 }],
  ];
  try {
    for (const [what, patch, over, a] of changes) {
      const changed = { ...base, ...patch };
      await upsertFixture(changed, bankNameOf(0), bankA['id']);
      const m = await one('personal', NAME_KEY, over, base.code);
      let exp = expectedQuote(changed, { income: 10000, debts: 0, request: Math.min(a.request, changed.maxAmount), tenor: a.tenor, age: 35 });
      // A request above the program's largest loan is cut to it — the program_max limit.
      if (patch.maxAmount !== undefined && !('refused' in exp)) exp = { ...exp, binding: 'program_max' };
      compare(`D · change · ${what}`, m, changed, exp);
    }
  } finally {
    await upsertFixture(base, bankNameOf(0), bankA['id']);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PART C — live programs priced simply from their own settings: exact expectations
// ═════════════════════════════════════════════════════════════════════════════════════════════
const ONLY = (o: Json | null | undefined, keys: string[]): boolean => Object.keys(o ?? {}).every((k) => keys.includes(k));

async function partC(): Promise<void> {
  console.log('\n══ Part C — live programs priced from their own settings, expected figures worked out by hand ══');
  const list: Json[] = [];
  for (let page = 1; page < 50; page++) {
    const r = await call('GET', `/bank-programs?pageSize=100&page=${page}`);
    const rows = (Array.isArray(r['data']) ? r['data'] : (r['data']?.['items'] ?? [])) as Json[];
    list.push(...rows);
    if (rows.length < 100) break;
  }
  const simple: Json[] = [];
  const skipped: string[] = [];
  for (const row of list.filter((p) => p['active'] && !String(p['programCode']).startsWith('TESTING-'))) {
    const p = await ok('GET', `/bank-programs/${row['programCode']}`);
    const why: string[] = [];
    if (p['programType'] !== 'income_proof') why.push('no payslip');
    if (!ONLY(p['incomeAssumption'], ['strategy']) || p['incomeAssumption']?.['strategy'] !== 'declared') why.push('income rule');
    if (!ONLY(p['pricing'], ['isVariableRate', 'baseRatePercent', 'rateBasis']) || p['pricing']?.['isVariableRate']) why.push('rate table');
    if (!ONLY(p['tenor'], ['minMonths', 'maxMonths'])) why.push('term table');
    if (!ONLY(p['loanLimits'], ['minAmountEGP', 'maxAmountEGP'])) why.push('loan table');
    if (!ONLY(p['fees'], ['adminFeePercent', 'adminFeeMinEGP', 'adminFeeMaxEGP', 'stampDutyPercent', 'stampDutyEGP', 'lifeInsurancePercent', 'lifeInsuranceMinLoanEGP', 'lifeInsuranceMandatory', 'payoffCashPercent', 'payoffBuyoutPercent', 'latePaymentFeePercent', 'collateralFeeEGP'])) why.push('fee waiver / car cover');
    if (p['eligibility']?.['dbrCapPercentByEmploymentType'] || p['eligibility']?.['skipDbrCheck']) why.push('cap by job');
    if (p['plansSource'] && p['plansSource'] !== 'own') why.push('plans');
    if (p['productIScoreTiers'] || p['incomeAssumption']?.['iScoreTiers']) why.push('own I-Score');
    if (why.length) skipped.push(`${p['programCode']} (${why.join(', ')})`);
    else simple.push(p);
  }

  const money = (v: number) => Math.round(v * 100) / 100;
  for (const p of simple) {
    const fees = (p['fees'] ?? {}) as Json;
    const el = (p['eligibility'] ?? {}) as Json;
    const rate = +p['pricing']['baseRatePercent'];
    const basis = (p['pricing']['rateBasis'] as string | undefined) ?? 'reducing';
    const minM = +p['tenor']['minMonths'], maxM = +p['tenor']['maxMonths'];
    const minA = +(p['loanLimits']['minAmountEGP'] ?? 0), maxA = p['loanLimits']['maxAmountEGP'] != null ? +p['loanLimits']['maxAmountEGP'] : Infinity;
    const feeOf = (c: number): number => {
      let admin = (c * +(fees['adminFeePercent'] ?? 0)) / 100;
      if (fees['adminFeeMinEGP'] != null) admin = Math.max(admin, +fees['adminFeeMinEGP']);
      if (fees['adminFeeMaxEGP'] != null) admin = Math.min(admin, +fees['adminFeeMaxEGP']);
      const stamp = +(fees['stampDutyEGP'] ?? 0) + (c * +(fees['stampDutyPercent'] ?? 0)) / 100;
      const lifeBase = fees['lifeInsuranceMinLoanEGP'] != null ? Math.max(c, +fees['lifeInsuranceMinLoanEGP']) : c;
      const life = fees['lifeInsurancePercent'] != null ? (lifeBase * +fees['lifeInsurancePercent']) / 100 : 0;
      const coll = el['requiresCollateral'] && fees['collateralFeeEGP'] != null ? +fees['collateralFeeEGP'] : 0;
      return money(admin) + money(stamp) + money(life) + money(coll);
    };
    const applicants: { label: string; income: number; request: number; tenor: number }[] = [
      { label: '20k income, 300k, 60m', income: 20000, request: 300000, tenor: 60 },
      { label: '8k income, 1M, 60m', income: 8000, request: 1000000, tenor: 60 },
      { label: '20k income, 300k, 120m', income: 20000, request: 300000, tenor: 120 },
    ];
    // A program for young applicants is tried with a young one.
    const age = el['ageMax'] != null && +el['ageMax'] < 45 ? Math.max(+(el['ageMin'] ?? 21), 25) : 35;
    for (const a of applicants) {
      const L = `C · ${p['programCode']} · ${a.label}${age !== 35 ? ` · age ${age}` : ''}`;
      const extra = p['productCategory'] === 'car' ? { car_price: 3000000, car_down_payment: 1500000, car_model_year: 2025, car_origin: 'japan', car_fuel_type: 'petrol_diesel', car_dealer: 'other_authorized' } : {};
      const r = await simulate({ category: p['productCategory'], age, programNameKey: p['programNameKey'], answers: answers({ monthly_income: a.income, amount_requested: a.request, repayment_period_months: a.tenor, ...extra }) });
      const m = lookup(r, p['programCode']);
      if (!m) { failures.push(`${L} — not listed (${JSON.stringify(r).slice(0, 160)})`); continue; }
      // Term
      const ageCap = el['ageMax'] != null ? (+el['ageMax'] - age) * 12 : Infinity;
      const tenor = Math.min(Math.max(a.tenor, minM), maxM, ageCap);
      // Debt-ratio cap (bands by income when stated)
      const bands = (el['dbrBands'] ?? []) as Json[];
      const cap = bands.length
        ? +((bands.find((b) => b['upToIncomeEGP'] == null || a.income <= +b['upToIncomeEGP']) ?? bands[bands.length - 1])!['capPercent'])
        : +el['dbrCapPercent'];
      const room = (a.income * cap) / 100;
      const inst = (c: number) => instalmentFor(c + feeOf(c), rate, tenor, basis);
      let cash = Math.min(a.request, maxA);
      // The rules the program states (v36.0.0): the applicant is 35 (or 25), 36 months in the
      // job, and can transfer the salary — so only age and the minimum income can fail.
      const ageMin = el['ageMin'] ?? el['minAge'], ageMax = el['ageMax'] ?? el['maxAge'];
      const accepted = (el['acceptedTransferTypes'] ?? el['acceptedSalaryTransferTypes'] ?? []) as string[];
      const ruleFails =
        (ageMin != null && age < +ageMin) || (ageMax != null && age > +ageMax) ||
        a.income < +(el['minMonthlyIncomeEGP'] ?? 0) ||
        36 < +(el['minMonthsInJob'] ?? 0) ||
        (accepted.length > 0 && !accepted.some((t) => ['payroll', 'salary_transfer_letter', 'income_transfer_letter'].includes(t)));
      let refusal: string | null = ruleFails
        ? 'NOT_ELIGIBLE'
        : tenor < minM ? 'AGE_AT_MATURITY' : a.request < minA ? 'REQUESTED_BELOW_PROGRAM_MIN_AMOUNT' : null;
      if (!refusal && inst(cash) > room + 0.005) {
        let lo = 0, hi = cash;
        for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (inst(mid) <= room) lo = mid; else hi = mid; }
        cash = lo;
        if (cash < minA) refusal = 'BELOW_PROGRAM_MIN_AMOUNT';
      }
      const fig = m['figures'] as Json | null;
      if (refusal) { expect(L, !fig && m['figuresUnavailableReason'] === refusal, `expected ${refusal}, got ${fig ? 'figures' : m['figuresUnavailableReason']}`); continue; }
      if (!fig) { failures.push(`${L} — expected figures, got ${m['figuresUnavailableReason']}`); continue; }
      expect(L + ' term', fig['effectiveTenorMonths'] === tenor, `${fig['effectiveTenorMonths']} ≠ ${tenor}`);
      expect(L + ' rate', near(+fig['effectiveRatePercent'], rate, 0.0001), `${fig['effectiveRatePercent']} ≠ ${rate}`);
      expect(L + ' DBR cap', near(+fig['dbrCapPercent'], cap, 0.0001), `${fig['dbrCapPercent']} ≠ ${cap}`);
      expect(L + ' cash', near(+fig['cashToCustomerEGP'], cash, 1), `${fig['cashToCustomerEGP']} ≠ ${cash.toFixed(2)}`);
      expect(L + ' fees', near(+fig['totalFeesEGP'], feeOf(+fig['cashToCustomerEGP']), 0.05), `${fig['totalFeesEGP']} ≠ ${feeOf(+fig['cashToCustomerEGP']).toFixed(2)}`);
      expect(L + ' instalment', near(+fig['monthlyInstallmentEGP'], inst(cash), 1), `${fig['monthlyInstallmentEGP']} ≠ ${inst(cash).toFixed(2)}`);
    }
  }
  console.log(`  ${simple.length} live programs checked to the exact figure · ${skipped.length} priced from tables (left to Part B's checks)`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PART E — APPLY: a TESTING customer applies; what is frozen must equal what preview showed
// ═════════════════════════════════════════════════════════════════════════════════════════════
const V1 = process.env.ENGINE_CHECK_V1 ?? 'http://localhost:3000/api/v1';
let customerToken = '';
const PRIORITY_OF: Record<string, string> = {
  lowest_monthly_installment: 'lowest_installment',
  lowest_interest_rate: 'lowest_interest',
  fastest_approval: 'fastest_approval',
  least_documentation_required: 'least_paperwork',
};

async function customerSignIn(email: string): Promise<string> {
  const r = (await (
    await fetch(`${V1}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TESTING_CUSTOMER_PASSWORD }),
    })
  ).json()) as Json;
  const t = r['data']?.['accessToken'] as string | undefined;
  if (!t) throw new Error('customer login failed: ' + JSON.stringify(r).slice(0, 200));
  return t;
}

/** The apply body the app builds from the same answers (`apply_mapping.dart`, condensed). */
function applyBody(cat: string, key: string, ans: Answer[]): Json {
  const num = (c: string) => ans.find((a) => a.questionCode === c)?.numericValue;
  const opt = (c: string) => ans.find((a) => a.questionCode === c)?.optionCode;
  const price = Number(num('car_price') ?? 0), down = Number(num('car_down_payment') ?? 0);
  const amount = num('amount_requested') ?? (price > down ? String(price - down) : '0');
  return {
    loanPurpose: cat,
    requestedAmountEGP: amount,
    ...(num('repayment_period_months') ? { preferredTenorMonths: Number(num('repayment_period_months')) } : {}),
    priority: PRIORITY_OF[opt('priority_factor') ?? ''] ?? 'fastest_approval',
    category: cat,
    programNameKey: key,
    questionnaireAnswers: ans,
    employment: {
      employmentType: 'salaried',
      monthlyNetSalaryEGP: num('monthly_income') ?? '0',
      monthsInJob: Number(num('months_in_current_job') ?? 0),
      salaryTransferType: opt('can_transfer_salary') === 'yes' ? 'salary_transfer_letter' : 'none',
      companyName: 'TESTING',
      companyType: '',
    },
    obligations: { existingMonthlyObligationsEGP: '0', hasCurrentLoan: false, hasPreviousRejection: false },
    assets: {},
  };
}

let applySeq = 0;
async function apply(body: Json, token = customerToken): Promise<Json> {
  const res = await fetch(`${V1}/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'idempotency-key': `testing-engine-${Date.now()}-${applySeq++}`,
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Json;
}

/** The offers of an apply response, in the order they were frozen. */
function appliedOffers(r: Json): Json[] {
  const d = r['data'] ?? {};
  return ((d['matchedOffers'] ?? d['offers'] ?? []) as Json[]).slice();
}

/** Preview (simulator) and apply on the same answers: same programs, same order, same money. */
function comparePreviewApply(label: string, sim: Json, app: Json): void {
  const shown = ((sim['data']?.['matches'] ?? []) as Json[]).filter((m) => m['figures']);
  const offers = appliedOffers(app);
  const codes = (xs: Json[]) => xs.map((x) => x['programCode']).join(' > ');
  expect(`${label} · same programs, same order`, codes(shown) === codes(offers), `preview ${codes(shown)} · apply ${codes(offers)}`);
  for (const [i, o] of offers.entries()) {
    const m = shown.find((x) => x['programCode'] === o['programCode']);
    if (!m) continue;
    const f = m['figures'] as Json;
    const L = `${label} · ${o['programCode']}`;
    // Apply names the loan `effectiveLoanAmountEGP` and lists the fees as a breakdown.
    const fees = (o['feesBreakdown'] ?? {}) as Json;
    const feeTotal = ['adminFeeEGP', 'stampDutyEGP', 'lifeInsuranceEGP', 'collateralFeeEGP'].reduce((t, k) => t + (+fees[k] || 0), 0);
    const pick = (k: string) =>
      k === 'offeredAmountEGP' ? o['effectiveLoanAmountEGP'] : k === 'totalFeesEGP' ? feeTotal : (o[k] ?? o['figures']?.[k]);
    expect(L + ' rank', (o['rankIndex'] ?? i) === i, `rankIndex ${o['rankIndex']} at position ${i}`);
    for (const k of ['monthlyInstallmentEGP', 'effectiveRatePercent', 'offeredAmountEGP', 'totalFeesEGP']) {
      const a = pick(k);
      if (a === undefined || f[k] === undefined) continue;
      expect(`${L} ${k}`, near(+a, +f[k], 0.011), `apply ${a} ≠ preview ${f[k]}`);
    }
    const t = pick('effectiveTenorMonths') ?? pick('tenorMonths');
    if (t !== undefined) expect(L + ' term', +t === +f['effectiveTenorMonths'], `apply ${t} ≠ preview ${f['effectiveTenorMonths']}`);
  }
}

async function partE(): Promise<void> {
  console.log('\n══ Part E — apply: a TESTING customer applies; frozen offers = what preview showed ══');
  await ensureTestingCustomers();
  customerToken = await customerSignIn(TESTING_CUSTOMER_EMAIL);
  await loadBounds();

  // E1 — the TESTING name, then every live name × loan type: apply = preview.
  const names = ((await ok('GET', '/enumerations?type=program_name')) as Json[]).filter((n) => n['active']);
  let compared = 0;
  let firstShown = false;
  for (const n of names) {
    for (const cat of (n['categories'] ?? []) as string[]) {
      const qs = await servedQuestions(n['key'], cat);
      const ans = buildAnswers(qs, {}, {});
      const sim = await simulate({ category: cat, age: 35, programNameKey: n['key'], answers: ans });
      const app = await apply(applyBody(cat, n['key'], ans));
      const label = `E · ${cat} · ${n['key']}`;
      if (app['success'] !== true) {
        // No offer at all is a legitimate outcome only when preview showed none either.
        const shown = ((sim['data']?.['matches'] ?? []) as Json[]).filter((m) => m['figures']);
        expect(label, shown.length === 0, `apply failed (${JSON.stringify(app).slice(0, 160)}) while preview showed ${shown.length}`);
        continue;
      }
      if (!firstShown && process.env.ENGINE_CHECK_DEBUG) {
        firstShown = true;
        console.log(JSON.stringify(app, null, 1).slice(0, 2500));
      }
      comparePreviewApply(label, sim, app);
      compared++;
    }
  }
  console.log(`  ${compared} program names applied for and compared with preview`);

  // E2 — frozen: change a TESTING program's rate AFTER applying; the stored offer must not move.
  const base = FIXTURES[0]!;
  const qs = await servedQuestions(NAME_KEY, 'personal');
  const ans = buildAnswers(qs, { monthly_income: 10000, amount_requested: 100000 }, {});
  const applied = await apply(applyBody('personal', NAME_KEY, ans));
  const appId = applied['data']?.['applicationId'] ?? applied['data']?.['id'];
  const before = appliedOffers(applied).find((o) => o['programCode'] === base.code);
  expect('E · frozen · applied', applied['success'] === true && !!before, `apply ${JSON.stringify(applied).slice(0, 160)}`);
  const bankA = ((await ok('GET', '/banks')) as Json[]).find((b) => b['nameEnglish'] === bankNameOf(0))!;
  try {
    await upsertFixture({ ...base, rate: 30 }, bankNameOf(0), bankA['id']);
    const stored = await call('GET', `/applications/${appId}`);
    const offers = ((stored['data']?.['offers'] ?? stored['data']?.['bankOffers'] ?? []) as Json[]);
    const after = offers.find((o) => o['programCode'] === base.code);
    const rateOf = (o: Json | undefined) => +(o?.['effectiveRatePercent'] ?? o?.['figures']?.['effectiveRatePercent'] ?? NaN);
    expect('E · frozen · rate unchanged after the program changed', near(rateOf(after), rateOf(before), 0.0001), `stored ${rateOf(after)} vs applied ${rateOf(before)}`);
    const ranks = offers.map((o) => o['rankIndex']).filter((x) => x !== undefined) as number[];
    expect('E · rankIndex dense 0..n-1', ranks.length === 0 || ranks.every((r, i) => r === i), `ranks ${ranks.join(',')}`);
  } finally {
    await upsertFixture(base, bankNameOf(0), bankA['id']);
  }

  // E3 — hidden: a customer who fails the TESTING rules is offered none of them.
  {
    const low = buildAnswers(qs, { monthly_income: 2500, amount_requested: 100000 }, {});
    const r = await apply(applyBody('personal', NAME_KEY, low));
    const testing = appliedOffers(r).filter((o) => String(o['programCode']).startsWith('TESTING-'));
    expect('E · hidden · income below every minimum → no TESTING offer', testing.length === 0, `got ${testing.map((o) => o['programCode']).join(', ')}`);
    const unavailable = (r['data']?.['unavailablePrograms'] ?? []) as Json[];
    expect('E · hidden · not listed as "unavailable" either', unavailable.every((u) => !String(u['programCode']).startsWith('TESTING-')), JSON.stringify(unavailable).slice(0, 160));
  }

  // E4 — refusals the customer must get, with their code.
  const refuse = async (label: string, body: Json, code: string, token = customerToken) => {
    const r = await apply(body, token);
    expect(`E · refuses · ${label}`, r['success'] === false && r['code'] === code, `expected ${code}, got ${JSON.stringify(r).slice(0, 160)}`);
  };
  const ok1 = applyBody('personal', NAME_KEY, ans);
  await refuse('an incomplete profile', ok1, 'PROFILE_INCOMPLETE', await customerSignIn(TESTING_CUSTOMER_INCOMPLETE_EMAIL));
  await refuse('a required answer missing', { ...ok1, questionnaireAnswers: ans.filter((a) => a.questionCode !== 'amount_requested') }, 'ANSWER_REQUIRED');
  await refuse('an answer that is not one of the options', { ...ok1, questionnaireAnswers: ans.map((a) => (a.questionCode === 'i_score_band' ? { ...a, optionCode: 'not_an_answer' } : a)) }, 'UNKNOWN_OPTION_CODE');
  await refuse('a program name not offered for the loan type', applyBody('mortgage', NOPAY_NAME_KEY, ans), 'PROGRAM_NAME_KEY_NOT_IN_CATEGORY');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  await signIn();
  try {
    await partA();
    await partD();
    await partE();
  } finally {
    if (!KEEP) {
      await removeTestingCustomers().catch((e) => console.error('could not remove the TESTING customers:', e));
      await removeFixtures().catch((e) => console.error('could not remove the TESTING fixtures:', e));
    }
  }
  await partB();
  await partC();
  console.log(`\n${passed} checks passed · ${failures.length} failed`);
  for (const f of failures.slice(0, 80)) console.log('  ✗ ' + f);
  if (failures.length > 80) console.log(`  … +${failures.length - 80} more`);
  process.exitCode = failures.length ? 1 : 0;
}

void main();
