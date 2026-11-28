import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API, apiToken, overflowX, signIn, watchErrors } from './support';

/**
 * The car pricing card (v37.0.0), end to end: an operator prices a TESTING used-car program by
 * down payment with a brand and a category exception, deletes a band the exceptions point at,
 * saves, and the simulator quotes what the card says; a TESTING new-car program's electric
 * exception caps the term; the Used Car questionnaire asks category → brand → model year.
 *
 * TESTING data only — its own bank and two programs, deleted in `finally`.
 */

type Json = Record<string, unknown>;

async function call(request: APIRequestContext, auth: Record<string, string>, method: 'GET' | 'POST' | 'DELETE', path: string, data?: unknown) {
  const res = await request.fetch(`${API}${path}`, { method, headers: auth, ...(data !== undefined ? { data } : {}) });
  return (await res.json()) as { success: boolean; data: Json & Json[] };
}

function programBody(template: Json, bankName: string, bankId: string, nameKey: string, friendly: string): Json {
  const { dbrBands: _bands, ...eligibility } = template['eligibility'] as Json;
  void _bands;
  return {
    bankName,
    bankId,
    friendlyName: friendly,
    friendlyNameAr: friendly,
    programNameKey: nameKey,
    programType: 'income_proof',
    productCategory: 'car',
    isShariaCompliant: false,
    operatorNotes: 'TESTING fixture for car-pricing.spec.',
    requiredDocuments: ['national_id', 'salary_certificate'],
    plansSource: 'own',
    tenor: { minMonths: 12, maxMonths: 96 },
    loanLimits: { minAmountEGP: '50000', maxAmountEGP: '5000000' },
    pricing: { isVariableRate: false, baseRatePercent: '25', rateBasis: 'reducing' },
    eligibility: {
      ...eligibility,
      ageMin: 21,
      ageMax: 60,
      minMonthlyIncomeEGP: '3000',
      minMonthsInJob: 6,
      acceptedTransferTypes: ['payroll', 'salary_transfer_letter'],
      dbrCapPercent: '60',
    },
    incomeAssumption: { strategy: 'declared' },
    fees: {
      ...(template['fees'] as Json),
      adminFeePercent: '0',
      stampDutyPercent: '0',
      lifeInsurancePercent: '0',
      lifeInsuranceMandatory: false,
      latePaymentFeePercent: '0',
      payoffCashPercent: '0',
      payoffBuyoutPercent: '0',
    },
  };
}

const year = new Date().getFullYear();
function answers(over: Record<string, string>): Json[] {
  const base: Record<string, string> = {
    monthly_income: '200000',
    car_price: '1000000',
    car_down_payment: '250000',
    amount_requested: '750000',
    repayment_period_months: '60',
    months_in_current_job: '36',
    car_model_year: String(year - 1),
    ...over,
  };
  const choice = new Set(['car_category', 'what_brand_is_the_car', 'car_fuel_type', 'can_transfer_salary']);
  const out: Json[] = Object.entries(base).map(([questionCode, v]) =>
    choice.has(questionCode) ? { questionCode, optionCode: v } : { questionCode, numericValue: v },
  );
  out.push({ questionCode: 'current_loans', optionCodes: ['none'] });
  if (!('can_transfer_salary' in over)) out.push({ questionCode: 'can_transfer_salary', optionCode: 'yes' });
  return out;
}

async function quote(request: APIRequestContext, auth: Record<string, string>, nameKey: string, code: string, over: Record<string, string>) {
  const r = await call(request, auth, 'POST', '/matching/simulate', { category: 'car', age: 35, programNameKey: nameKey, answers: answers(over) });
  expect(r.success, JSON.stringify(r)).toBeTruthy();
  const data = r.data as unknown as { matches: Json[]; hidden: Json[] };
  const shown = data.matches.find((m) => m['programCode'] === code);
  const hidden = data.hidden.find((m) => m['programCode'] === code);
  return { shown, hidden };
}

async function pick(page: Page, select: ReturnType<Page['locator']>, text: string): Promise<void> {
  await select.click();
  await page.keyboard.type(text);
  await page.locator('.ant-select-dropdown:visible nz-option-item', { hasText: text }).first().click();
}

test('car pricing card: bands, brand and category exceptions, a band deleted, quotes follow', async ({ page, request }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  const auth = { authorization: `Bearer ${await apiToken(request)}` };
  const run = test.info().project.name.toUpperCase();
  const bankName = `TESTING e2e car pricing ${run}`;
  const USED = `TESTING-E2E-USED-${run}`;
  const NEW = `TESTING-E2E-NEW-${run}`;
  // A leftover from an interrupted run goes first.
  for (const code of [USED, NEW]) {
    await request.delete(`${API}/bank-programs/${code}`, { headers: { ...auth, 'x-confirm-program-code': code } });
  }
  const banks = (await call(request, auth, 'GET', '/banks')).data as Json[];
  let bank = banks.find((b) => b['nameEnglish'] === bankName);
  bank ??= (await call(request, auth, 'POST', '/banks', { nameEnglish: bankName, nameArabic: 'بنك TESTING', isActive: true, isFeatured: false, notes: 'TESTING — car-pricing.spec' })).data;
  const bankId = String(bank!['id']);
  const template = (await call(request, auth, 'GET', '/bank-programs/NXT-CAR-USED_CAR')).data;
  try {
    const usedMade = await call(request, auth, 'POST', '/bank-programs', { ...programBody(template, bankName, bankId, 'used_car', 'TESTING Used'), programCode: USED });
    expect(usedMade.success, JSON.stringify(usedMade)).toBeTruthy();
    // The new-car program states its card through the API: one band, and electric → 5 years.
    const axes = [
      { factKey: 'car_down_payment_percent' },
      { factKey: 'what_brand_is_the_car' },
      { factKey: 'car_fuel_type' },
      { factKey: 'what_brand_is_the_car', via: 'parentClass' },
    ];
    const created = await call(request, auth, 'POST', '/bank-programs', {
      ...programBody(template, bankName, bankId, 'new_car', 'TESTING New'),
      programCode: NEW,
      pricing: { isVariableRate: false, baseRatePercent: '25', rateBasis: 'reducing', rateByFact: { axes, cells: [{ keys: [{ fromInclusive: '10' }, null, null, null], value: '17' }, { keys: [{ fromInclusive: '10' }, null, { key: 'petrol_diesel' }, null], value: '16' }], onNoMatch: 'reject' } },
      tenor: { minMonths: 12, maxMonths: 96, maxMonthsByFact: { axes, cells: [{ keys: [{ fromInclusive: '10' }, null, { key: 'electric' }, null], value: '60' }], onNoMatch: 'useFallback' } },
    });
    expect(created.success, JSON.stringify(created)).toBeTruthy();

    // ── The operator prices the used-car program on the card ──
    await signIn(page);
    await page.goto(`/banks/programs/${USED}/edit`);
    await page.locator('app-wizard-steps').getByText('Money').click();
    const card = page.locator('app-car-pricing-card');
    await expect(card).toBeVisible();
    const from = card.getByLabel('Down payment from');
    const to = card.getByLabel('Down payment up to');
    const rate = card.locator('input[aria-label="Rate"]');
    await from.nth(0).fill('10');
    await to.nth(0).fill('20');
    await rate.nth(0).fill('20');
    await card.getByRole('button', { name: 'Add a band' }).click();
    await expect(from.nth(1)).toHaveValue('20');
    await rate.nth(1).fill('16');
    await card.getByRole('button', { name: 'Add an exception' }).click();
    await pick(page, card.locator('app-search-select nz-select'), 'BMW');
    await card.locator('.cpx__fig').nth(0).locator('input').fill('9');
    await card.getByRole('button', { name: 'Done' }).click();
    await card.getByRole('button', { name: 'Add an exception' }).click();
    await card.getByRole('button', { name: 'Category', exact: true }).click();
    await pick(page, card.locator('app-search-select nz-select'), 'Chinese');
    await card.locator('.cpx__fig').nth(4).locator('input').fill('3');
    await card.getByRole('button', { name: 'Done' }).click();
    await expect(card.getByText('Brand BMW · all bands → Rate 9%')).toBeVisible();
    await expect(card.getByText('Category Chinese · all bands → Oldest car 3 years old')).toBeVisible();
    // A half-typed band says what is wrong under its own line.
    await rate.nth(1).fill('');
    await expect(card.getByText('Type a rate for this band.')).toBeVisible();
    await rate.nth(1).fill('16');
    // A 0 is refused (the engine reads 0 as "not stated").
    await rate.nth(1).fill('0');
    await expect(card.getByText(/A figure here is not a number/).first()).toBeVisible();
    await rate.nth(1).fill('16');
    // A second line setting the same figure for the same car and band is refused.
    await card.getByRole('button', { name: 'Add an exception' }).click();
    await pick(page, card.locator('app-search-select nz-select'), 'BMW');
    await card.locator('.cpx__fig').nth(0).locator('input').fill('11');
    await card.getByRole('button', { name: 'Done' }).click();
    await expect(card.getByText('Another line already sets this figure for the same car on the same band.')).toBeVisible();
    await card.getByRole('button', { name: 'Remove this exception' }).last().click();
    await expect(card.getByText('Another line already sets this figure')).toHaveCount(0);
    // Delete the first band: the exceptions stay "all bands" and its cells go with it.
    await card.getByRole('button', { name: 'Remove this band' }).first().click();
    await expect(from).toHaveCount(1);
    expect(await overflowX(page)).toBe(0);
    await page.locator('app-wizard-steps').getByText('Review').click();
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expect.poll(async () => (await call(request, auth, 'GET', `/bank-programs/${USED}`)).data['version']).toBeGreaterThan(1);

    const stored = (await call(request, auth, 'GET', `/bank-programs/${USED}`)).data;
    const cells = ((stored['pricing'] as Json)['rateByFact'] as { cells: Array<{ keys: Array<Json | null>; value: string }> }).cells;
    // No cell still on the deleted 10–20 band.
    expect(cells.every((c) => (c.keys[0] as Json)['fromInclusive'] === '20')).toBeTruthy();
    expect(cells.map((c) => c.value).sort()).toEqual(['16', '9']);

    // ── The simulator quotes what the card says ──
    const toyota = await quote(request, auth, 'used_car', USED, { car_category: 'japanese', what_brand_is_the_car: 'toyota' });
    expect(Number(toyota.shown?.['effectiveRatePercent']), JSON.stringify(toyota.hidden ?? null)).toBe(16);
    const bmw = await quote(request, auth, 'used_car', USED, { car_category: 'european', what_brand_is_the_car: 'bmw' });
    expect(Number(bmw.shown?.['effectiveRatePercent'])).toBe(9);
    const oldByd = await quote(request, auth, 'used_car', USED, { car_category: 'chinese', what_brand_is_the_car: 'byd', car_model_year: String(year - 4) });
    expect(oldByd.shown).toBeUndefined();
    expect(oldByd.hidden?.['reason']).toBe('VEHICLE_NOT_ELIGIBLE');
    const youngByd = await quote(request, auth, 'used_car', USED, { car_category: 'chinese', what_brand_is_the_car: 'byd', car_model_year: String(year - 2) });
    expect(Number(youngByd.shown?.['effectiveRatePercent'])).toBe(16);

    // ── New car: electric is capped at five years ──
    const ev = await quote(request, auth, 'new_car', NEW, { car_category: 'chinese', what_brand_is_the_car: 'byd', car_fuel_type: 'electric', repayment_period_months: '84' });
    const term = (m: Json | undefined) => Number((m?.['figures'] as Json | undefined)?.['effectiveTenorMonths'] ?? m?.['effectiveTenorMonths']);
    expect(term(ev.shown), JSON.stringify(ev.shown ?? ev.hidden ?? null).slice(0, 400)).toBe(60);
    const gas = await quote(request, auth, 'new_car', NEW, { car_category: 'chinese', what_brand_is_the_car: 'byd', car_fuel_type: 'petrol_diesel', repayment_period_months: '84' });
    expect(term(gas.shown)).toBe(84);
    // Gas and electric are equal exceptions; the row (17%) prices what neither covers.
    expect(Number(gas.shown?.['effectiveRatePercent'])).toBe(16);
    expect(Number(ev.shown?.['effectiveRatePercent'])).toBe(17);
    await page.goto(`/banks/programs/${NEW}/edit`);
    await page.locator('app-wizard-steps').getByText('Money').click();
    await expect(page.locator('app-car-pricing-card').getByText('Gas · all bands → Rate 16%')).toBeVisible();

    // ── What each flow asks ──
    const served = async (key: string) => {
      const r = await call(request, auth, 'GET', `/questionnaire/served?category=car&programNameKey=${key}`);
      const car = (r.data as Json[]).find((d) => d['category'] === 'car')!;
      return (car['servedQuestionCodes'] as string[]).filter((c) => c.startsWith('car_') || c === 'what_brand_is_the_car');
    };
    const used = await served('used_car');
    expect(used.slice(0, 3)).toEqual(['car_category', 'what_brand_is_the_car', 'car_model_year']);
    expect(used).not.toContain('car_fuel_type');
    const fresh = await served('new_car');
    expect(fresh.slice(0, 3)).toEqual(['car_category', 'what_brand_is_the_car', 'car_fuel_type']);
    expect(fresh).not.toContain('car_model_year');

    // ── The detail page reads the card back ──
    await page.goto(`/banks/programs/${USED}`);
    await expect(page.getByRole('heading', { name: 'Pricing by down payment' })).toBeVisible();
    await expect(page.getByText('Brand BMW · all bands → Rate 9%')).toBeVisible();
    expect(await overflowX(page)).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    for (const code of [USED, NEW]) {
      await request.delete(`${API}/bank-programs/${code}`, { headers: { ...auth, 'x-confirm-program-code': code } });
    }
    await request.delete(`${API}/banks/${bankId}`, { headers: auth });
  }
});

test("a program following its product keeps the product's other tables after a card edit", async ({ page, request }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  const auth = { authorization: `Bearer ${await apiToken(request)}` };
  const run = test.info().project.name.toUpperCase();
  const PRODUCT = 'testing_car_buyers_down_payment';
  const CODE = `TESTING-E2E-FOLLOW-${run}`;
  const bankName = `TESTING e2e follow ${run}`;
  const axes = [
    { factKey: 'car_down_payment_percent' },
    { factKey: 'what_brand_is_the_car' },
    { factKey: 'car_fuel_type' },
    { factKey: 'what_brand_is_the_car', via: 'parentClass' },
  ];
  const before = (await call(request, auth, 'GET', `/bank-programs/surrogate-products/${PRODUCT}`)).data;
  await request.delete(`${API}/bank-programs/${CODE}`, { headers: { ...auth, 'x-confirm-program-code': CODE } });
  const banks = (await call(request, auth, 'GET', '/banks')).data as Json[];
  const bank = banks.find((b) => b['nameEnglish'] === bankName)
    ?? (await call(request, auth, 'POST', '/banks', { nameEnglish: bankName, nameArabic: 'بنك TESTING', isActive: true, isFeatured: false, notes: 'TESTING' })).data;
  const bankId = String(bank['id']);
  try {
    // The product: a card plus a financed-share table the card does not show.
    const ltv = { axes: [{ factKey: 'car_down_payment_percent' }], cells: [{ keys: [{ fromInclusive: '20' }], value: '70' }], onNoMatch: 'reject' };
    const put = await request.put(`${API}/bank-programs/surrogate-products/${PRODUCT}/plan-defaults`, { headers: auth, data: { plans: {
      rateByFact: { axes, cells: [{ keys: [{ fromInclusive: '20' }, null, null, null], value: '15' }], onNoMatch: 'reject' },
      ltvCeilingByFact: ltv,
    } } });
    expect(put.ok(), await put.text()).toBeTruthy();
    // A program that reads the product's plans.
    const template = (await call(request, auth, 'GET', '/bank-programs/HOUSING-CAR-7832')).data;
    const body: Json = {};
    for (const k of ['programType', 'productCategory', 'isShariaCompliant', 'requiredDocuments', 'tenor', 'loanLimits', 'eligibility', 'incomeAssumption', 'fees', 'pricing']) {
      if (template[k] !== null && template[k] !== undefined) body[k] = template[k];
    }
    const pricing = { ...(template['pricing'] as Json) };
    delete pricing['rateByFact'];
    const limits = { ...(template['loanLimits'] as Json) };
    delete limits['ltvCeilingByFact'];
    delete limits['minAmountByFact'];
    const made = await call(request, auth, 'POST', '/bank-programs', { ...body, pricing, loanLimits: limits, programCode: CODE, bankName, bankId,
      friendlyName: 'TESTING follow', friendlyNameAr: 'TESTING follow', programNameKey: 'testing_car_buyers_program', plansSource: 'product' });
    expect(made.success, JSON.stringify(made).slice(0, 400)).toBeTruthy();

    // The operator edits the rate on the card and saves.
    await signIn(page);
    await page.goto(`/banks/programs/${CODE}/edit`);
    await page.locator('app-wizard-steps').getByText('Money').click();
    const rate = page.locator('app-car-pricing-card input[aria-label="Rate"]');
    await expect(rate.first()).toHaveValue('15');
    await rate.first().fill('14');
    await page.locator('app-wizard-steps').getByText('Review').click();
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expect.poll(async () => (await call(request, auth, 'GET', `/bank-programs/${CODE}`)).data['plansSource']).toBe('own');

    const stored = (await call(request, auth, 'GET', `/bank-programs/${CODE}`)).data;
    // Its own rate, AND the product's financed share taken as its own — not dropped.
    expect(((stored['pricing'] as Json)['rateByFact'] as { cells: { value: string }[] }).cells[0]!.value).toBe('14');
    expect((stored['loanLimits'] as Json)['ltvCeilingByFact']).toEqual(ltv);
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`${API}/bank-programs/${CODE}`, { headers: { ...auth, 'x-confirm-program-code': CODE } });
    await request.delete(`${API}/banks/${bankId}`, { headers: auth });
    await request.put(`${API}/bank-programs/surrogate-products/${PRODUCT}/plan-defaults`, { headers: auth, data: { plans: before['planDefaults'] ?? null } });
  }
});
