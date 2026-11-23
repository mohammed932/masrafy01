import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API, apiToken, overflowX, signIn, watchErrors } from './support';

/**
 * Auto loans, end to end through the screens — the steps in "Adding a surrogate car loan".
 *
 *  1. A no-payslip car loan built from nothing: a surrogate method, a product that uses it,
 *     the program name it is sold as, and a bank program under it with a plans-by-deposit
 *     table — then the simulator quotes each deposit row at the rate typed.
 *  2. The Loan Engine on a car program: a rule on one answer and a condition, written in the
 *     two side sheets, read back by the simulator.
 *  3. A wide card (ADIB used car: deposit x term x insurance x car class) draws as one table
 *     with short column names, and the simulator quotes every deposit row.
 *  4. A question's row menu opens its Loan Engine view.
 *
 * Every row a test makes is named TESTING and deleted again, also when the test fails.
 */

const HDB = 'cmvw9lebt000j6py9fc9zaxmo';
const KM = 'how_many_kilometres_does_the_car_drive_a_year';

async function auth(request: APIRequestContext): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await apiToken(request)}` };
}

/** One simulator run, as the admin screen sends it. */
async function simulate(
  request: APIRequestContext,
  programNameKey: string,
  answers: Record<string, string | number | string[]>,
): Promise<{ matches: Record<string, unknown>[]; hidden: Record<string, unknown>[] }> {
  const body = {
    category: 'car',
    programNameKey,
    age: 35,
    answers: Object.entries(answers).map(([questionCode, v]) =>
      Array.isArray(v)
        ? { questionCode, optionCodes: v }
        : typeof v === 'number'
          ? { questionCode, numericValue: String(v) }
          : { questionCode, optionCode: v },
    ),
  };
  const res = await request.post(`${API}/matching/simulate`, { headers: await auth(request), data: body });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { data: { matches: []; hidden: [] } }).data;
}

const carAnswers = (price: number, down: number, more: Record<string, string | number | string[]> = {}) => ({
  car_price: price,
  car_down_payment: down,
  repayment_period_months: 60,
  current_loans: ['none'],
  car_model_year: new Date().getFullYear() - 2,
  car_origin: 'germany',
  car_dealer: 'other_authorized',
  car_fuel_type: 'petrol_diesel',
  months_in_current_job: 36,
  ...more,
});

/** An nz-select: open it, type to filter (long lists are virtual), pick the option. */
async function pick(page: Page, select: ReturnType<Page['locator']>, text: string): Promise<void> {
  await select.click();
  const search = select.locator('input.ant-select-selection-search-input:not([readonly])');
  if (await search.count()) await page.keyboard.type(text.slice(0, 18));
  await page.locator('.ant-select-dropdown:visible nz-option-item', { hasText: text }).first().click();
}

test('a no-payslip car loan, built from nothing through the screens', async ({ page, request }) => {
  const errors = watchErrors(page);
  const run = test.info().project.name;
  const methodName = `TESTING e2e car method ${run}`;
  const productName = `TESTING e2e car product ${run}`;
  const programName = `TESTING e2e car program ${run}`;
  const headers = await auth(request);
  const made: { method?: string; product?: string; nameId?: string; program?: string } = {};
  try {
    await signIn(page);

    // 1 — the method: income = the car's down payment divided by 3.6.
    await page.goto('/surrogate-methods/new');
    await page.locator('input[formcontrolname=labelEn]').fill(methodName);
    await page.locator('input[formcontrolname=labelAr]').fill(methodName);
    await page.getByRole('button', { name: /^Next/ }).last().click();
    await page.locator('app-search-select').first().click();
    await page.keyboard.type('down payment');
    await page.getByText('How much is your down payment?', { exact: true }).first().click();
    await page.getByRole('radio', { name: 'Divided by' }).click();
    await page.getByRole('button', { name: /^Next/ }).last().click();
    await page.getByRole('button', { name: /^Next/ }).last().click();
    const divisor = page.locator('section.card input').first();
    await divisor.fill('3.6');
    await divisor.press('Tab');
    expect(await overflowX(page)).toBe(0);
    await page.getByRole('button', { name: 'Save method' }).click();
    await page.waitForURL((u) => u.pathname === '/surrogate-methods');
    const methods = (await (await request.get(`${API}/bank-programs/method-templates`, { headers })).json()) as {
      data: { key: string; labelEn: string }[];
    };
    made.method = methods.data.find((m) => m.labelEn === methodName)?.key;
    expect(made.method).toBeTruthy();

    // 2 — the product: blank, asks the price and the deposit, works out a monthly income
    //     with the method, 50% debt burden, live, sold under Auto Loan.
    await page.goto('/program-catalog/products/new');
    await page.locator('#np-name-en').fill(productName);
    await page.locator('#np-name-ar').fill(productName);
    await page.getByText('Blank', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Create and continue' }).click();
    await page.waitForURL(/\/program-catalog\/products\/[a-z0-9_]+\?step=2/);
    made.product = new URL(page.url()).pathname.split('/').pop();
    await page.getByRole('button', { name: /Add questions/ }).click();
    const sheet = page.locator('.ant-drawer-content').last();
    for (const [search, question] of [
      ['price', "What is the car's price?"],
      ['down payment', 'How much is your down payment?'],
    ]) {
      await sheet.locator('input').first().fill(search);
      const row = sheet
        .locator('div, li')
        .filter({ hasText: question })
        .filter({ has: page.getByRole('button', { name: /Add/ }) })
        .last();
      await row.getByRole('button', { name: /Add/ }).click();
    }
    await sheet.getByRole('button', { name: /^Done/ }).click();
    await page.locator('app-wizard-steps').getByText('Amount', { exact: true }).click();
    await page.getByRole('radio', { name: 'Monthly income' }).click();
    await page.locator('app-search-select').first().click();
    await page.keyboard.type('TESTING e2e car');
    await page.getByText(methodName).first().click();
    const dbr = page.locator('xpath=//*[normalize-space()="DBR cap"]/following::input[1]');
    await dbr.fill('50');
    await dbr.press('Tab');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const confirm = page.locator('.ant-modal').getByRole('button', { name: /Save changes/ });
    if (await confirm.count()) await confirm.click();
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByText('The product is live.')).toBeVisible();
    await page.locator('.menu > button').click();
    await page.getByRole('menuitem', { name: 'Sell it as a program' }).click();
    const sell = page.locator('.ant-drawer-content').last();
    await sell.locator('input').first().fill(programName);
    const switches = sell.locator('button[role=switch], nz-switch');
    await switches.nth(1).click(); // Auto Loan on
    await switches.nth(0).click(); // Personal Loan off
    await sell.getByRole('button', { name: 'Create program' }).click();
    await expect(sell).toBeHidden();
    const names = (await (await request.get(`${API}/enumerations?type=program_name`, { headers })).json()) as {
      data: { id: string; key: string; labelEn: string }[];
    };
    const name = names.data.find((n) => n.labelEn === programName);
    expect(name).toBeTruthy();
    made.nameId = name!.id;

    // 3 — the bank: from the bank's own Auto Loan section, no payslip, the product's
    //     calculation, a plans table with a 20% and a 40% row.
    await page.goto(`/banks/programs/new?bankId=${HDB}&category=car`);
    await page.getByText('Surrogate', { exact: true }).first().click();
    await pick(page, page.locator('nz-select').last(), productName.slice(0, 18));
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText(/A division of/).first()).toBeVisible();
    await page.getByRole('button', { name: /Continue/ }).click();
    const fill = async (control: string, value: string) => {
      let field = page.locator(`[formcontrolname=${control}]`).first();
      if ((await field.evaluate((e) => e.tagName)) !== 'INPUT') field = field.locator('input').first();
      await field.fill(value);
      await field.press('Tab');
    };
    await fill('minAmountEGP', '100000');
    await fill('maxAmountEGP', '5000000');
    await fill('minMonths', '12');
    await fill('maxMonths', '84');
    await fill('baseRatePercent', '15');
    await page.getByRole('button', { name: 'Start the table' }).click();
    const table = page.locator('app-plan-rows-editor');
    await table.getByRole('tab', { name: /Deposit steps/ }).click();
    await page.locator('#plan-band-0').fill('20');
    await page.locator('#plan-band-0').press('Tab');
    await page.locator('#prt-new-band').fill('40');
    await table.getByRole('button', { name: /^\+?\s*Add$/ }).click();
    await table.getByRole('tab', { name: /Figures/ }).click();
    const rates = table.locator('input[id^="plan-rateByFact-"]');
    await expect(rates).toHaveCount(2);
    await rates.nth(1).fill('13');
    await rates.nth(1).press('Tab');
    expect(await overflowX(page)).toBe(0);
    await page.getByRole('button', { name: /Continue/ }).click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await page.getByRole('button', { name: 'Create bank program' }).click();
    await page.waitForURL(/\/banks\/programs\/[A-Z0-9-]+$/);
    made.program = new URL(page.url()).pathname.split('/').pop();

    // 4 — the simulator: 30% down → the 20% row's 15%; 45% down → the 40% row's 13%.
    const thirty = await simulate(request, name!.key, carAnswers(1000000, 300000));
    const offer30 = thirty.matches.find((m) => m['programCode'] === made.program);
    expect(Number(offer30?.['effectiveRatePercent'])).toBe(15);
    const fortyFive = await simulate(request, name!.key, carAnswers(1000000, 450000));
    const offer45 = fortyFive.matches.find((m) => m['programCode'] === made.program);
    expect(Number(offer45?.['effectiveRatePercent'])).toBe(13);
    const rows = (offer45?.['depositRows'] as { fromPercent: string; current: boolean }[]) ?? [];
    expect(rows.map((r) => `${r.fromPercent}${r.current ? '*' : ''}`)).toEqual(['20', '40*']);
    expect(errors).toEqual([]);
  } finally {
    if (made.program) {
      await request.delete(`${API}/bank-programs/${made.program}`, {
        headers: { ...headers, 'x-confirm-program-code': made.program },
      });
    }
    if (made.nameId) await request.delete(`${API}/enumerations/${made.nameId}`, { headers });
    if (made.product) await request.delete(`${API}/bank-programs/surrogate-products/${made.product}`, { headers });
    if (made.method) await request.delete(`${API}/bank-programs/method-templates/${made.method}`, { headers });
  }
});

test('the Loan Engine: a rule and a condition on a car program, read by the simulator', async ({ page, request }) => {
  const errors = watchErrors(page);
  const headers = await auth(request);
  const run = test.info().project.name;
  // A TESTING copy of a car program the operator can change freely.
  const src = ((await (await request.get(`${API}/bank-programs/NXT-CAR-USED_CAR`, { headers })).json()) as {
    data: Record<string, unknown>;
  }).data;
  const body: Record<string, unknown> = {};
  for (const k of ['friendlyNameAr', 'programType', 'productCategory', 'isShariaCompliant', 'requiredDocuments', 'tenor',
    'loanLimits', 'pricing', 'eligibility', 'incomeAssumption', 'fees']) {
    if (src[k] !== null && src[k] !== undefined) body[k] = src[k];
  }
  Object.assign(body, {
    friendlyName: `TESTING e2e loan engine ${run}`,
    programNameKey: 'used_car',
    bankId: HDB,
    bankName: 'Housing & Development Bank',
    tenor: { minMonths: 12, maxMonths: 84 },
  });
  // A run that died half-way leaves its copy behind; clear it so this one can be made.
  const listed = (await (await request.get(`${API}/bank-programs?pageSize=100`, { headers })).json()) as {
    data: { programCode: string; friendlyName: string }[];
  };
  for (const old of listed.data.filter((p) => p.friendlyName === body['friendlyName'])) {
    await request.delete(`${API}/bank-programs/${old.programCode}`, {
      headers: { ...headers, 'x-confirm-program-code': old.programCode },
    });
  }
  const created = await request.post(`${API}/bank-programs`, { headers, data: body });
  expect(created.ok(), await created.text()).toBeTruthy();
  const code = ((await created.json()) as { data: { programCode: string } }).data.programCode;
  try {
    await signIn(page);
    await page.goto(`/loan-engine?question=${KM}`);
    const row = page.locator('tr', { has: page.locator('.le__code', { hasText: code }) });
    await expect(row).toHaveCount(1);

    // A rule: from 60,000 km a year, the longest term is 36 months.
    await row.locator('td').nth(5).getByRole('button').click();
    const rules = page.locator('.ant-drawer-content').last();
    // The row starts as "at least"; its first box is the answer, the second the figure.
    const inputs = rules.locator('ol li input:not([readonly])');
    await inputs.nth(0).fill('60000');
    await inputs.nth(1).fill('36');
    expect(await overflowX(page)).toBe(0);
    await rules.getByRole('button', { name: 'Save rows' }).click();
    await expect(rules).toBeHidden();

    // A condition: only cars driven at most 100,000 km a year.
    await row.locator('td').last().getByRole('button').first().click();
    const conds = page.locator('.ant-drawer-content').last();
    await conds.getByRole('button', { name: 'Add a condition' }).click();
    await pick(page, conds.locator('nz-select.cs__q').first(), 'How many kilometres');
    const criterion = conds.locator('app-criterion-field').first();
    await pick(page, criterion.locator('nz-select').first(), 'at most');
    await criterion.locator('input:not([readonly])').first().fill('100000');
    await conds.getByRole('button', { name: 'Save conditions' }).click();
    await expect(conds).toBeHidden();
    expect(errors).toEqual([]);

    const ask = (km: number) =>
      simulate(request, 'used_car', carAnswers(1000000, 450000, { monthly_income: 80000, repayment_period_months: 84, [KM]: km,
        do_you_want_insurance_on_the_car: 'with_insurance', what_kind_of_car_is_it: 'economy' }));
    const low = (await ask(30000)).matches.find((m) => m['programCode'] === code);
    expect((low?.['figures'] as Record<string, unknown>)['effectiveTenorMonths']).toBe(84);
    const high = (await ask(70000)).matches.find((m) => m['programCode'] === code);
    expect((high?.['figures'] as Record<string, unknown>)['effectiveTenorMonths']).toBe(36);
    const refused = await ask(150000);
    expect(refused.matches.find((m) => m['programCode'] === code)).toBeUndefined();
    expect(refused.hidden.find((h) => h['programCode'] === code)?.['reason']).toBe('PRODUCT_RULE_GATE_FAILED');
  } finally {
    await request.delete(`${API}/bank-programs/${code}`, { headers: { ...headers, 'x-confirm-program-code': code } });
  }
});

test('a wide car card draws as one table, and the simulator quotes every deposit row', async ({ page, request }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.goto('/banks/programs/ADIB-CAR-6681/edit');
  await page.locator('app-wizard-steps').getByText('Money', { exact: true }).click();
  const table = page.locator('app-plan-rows-editor');
  await expect(table.getByRole('tab', { name: /Figures/ })).toBeVisible();
  const heads = (await table.locator('thead th').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
  expect(heads).toContain('1–2 years · With insurance · Economy');
  expect(heads).toContain('8–10 years · Without insurance · Luxury');
  expect(heads.some((h) => h.includes('Do you want insurance'))).toBe(false);
  expect(await overflowX(page)).toBe(0);
  expect(errors).toEqual([]);

  const run = await simulate(request, 'used_car', carAnswers(1000000, 450000, { monthly_income: 80000, [KM]: 20000,
    do_you_want_insurance_on_the_car: 'with_insurance', what_kind_of_car_is_it: 'economy' }));
  const adib = run.matches.find((m) => m['programCode'] === 'ADIB-CAR-6681');
  const rows = (adib?.['depositRows'] as { fromPercent: string; current: boolean; effectiveRatePercent: string | null }[]) ?? [];
  expect(rows.map((r) => `${r.fromPercent}${r.current ? '*' : ''}:${r.effectiveRatePercent === null ? '-' : Number(r.effectiveRatePercent)}`))
    .toEqual(['30:14.29', '40*:12.81', '50:12.32', '60:-']);
});

test("a question's row menu opens its Loan Engine view", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.goto('/questionnaire');
  await page.locator('input[type=search], input[placeholder*="earch"]').first().fill('drive a year');
  await page.getByRole('button', { name: 'Question actions' }).first().click();
  await page.locator('.ant-dropdown:visible').getByText('Open in Loan Engine').click();
  await page.waitForURL(/\/loan-engine\?question=how_many_kilometres/);
  await expect(page.getByRole('heading', { name: 'How many kilometres does the car drive a year?' })).toBeVisible();
  expect(await overflowX(page)).toBe(0);
  expect(errors).toEqual([]);
});

test('an operator adds a new question, and a bank prices on its answer', async ({ page, request }) => {
  const errors = watchErrors(page);
  const headers = await auth(request);
  const run = test.info().project.name;
  const wording = `TESTING e2e is the car red ${run}`;
  // A TESTING car program to price on it.
  const src = ((await (await request.get(`${API}/bank-programs/NXT-CAR-USED_CAR`, { headers })).json()) as {
    data: Record<string, unknown>;
  }).data;
  const body: Record<string, unknown> = {};
  for (const k of ['friendlyNameAr', 'programType', 'productCategory', 'isShariaCompliant', 'requiredDocuments',
    'loanLimits', 'pricing', 'eligibility', 'incomeAssumption', 'fees']) {
    if (src[k] !== null && src[k] !== undefined) body[k] = src[k];
  }
  Object.assign(body, { friendlyName: `TESTING e2e new question ${run}`, programNameKey: 'used_car', bankId: HDB,
    bankName: 'Housing & Development Bank', tenor: { minMonths: 12, maxMonths: 84 } });
  const listed = (await (await request.get(`${API}/bank-programs?pageSize=100`, { headers })).json()) as {
    data: { programCode: string; friendlyName: string }[];
  };
  for (const old of listed.data.filter((p) => p.friendlyName === body['friendlyName'])) {
    await request.delete(`${API}/bank-programs/${old.programCode}`, { headers: { ...headers, 'x-confirm-program-code': old.programCode } });
  }
  const created = await request.post(`${API}/bank-programs`, { headers, data: body });
  expect(created.ok(), await created.text()).toBeTruthy();
  const code = ((await created.json()) as { data: { programCode: string } }).data.programCode;
  let questionCode: string | undefined;
  try {
    await signIn(page);
    // 1 — the question, on the Questions screen: one choice, two answers.
    await page.goto('/questionnaire');
    await page.getByRole('button', { name: /^\+?\s*Question$/ }).first().click();
    const sheet = page.locator('.ant-drawer-content').last();
    await sheet.locator('input[formcontrolname=questionEn]').fill(wording);
    await sheet.locator('input[formcontrolname=questionAr]').fill(wording);
    await sheet.getByRole('button', { name: 'Next' }).click();
    const en = sheet.locator('input[formcontrolname=labelEn]');
    const ar = sheet.locator('input[formcontrolname=labelAr]');
    await en.nth(0).fill('Red');
    await ar.nth(0).fill('أحمر');
    await en.nth(1).fill('Another colour');
    await ar.nth(1).fill('لون آخر');
    await sheet.getByRole('button', { name: 'Next' }).click();
    await sheet.getByRole('button', { name: /Add question/ }).click();
    await expect(sheet).toBeHidden();
    const found = (await (await request.get(`${API}/loan-engine/questions?search=${encodeURIComponent(wording)}`, { headers })).json()) as {
      data: { questionCode: string }[];
    };
    questionCode = found.data[0]?.questionCode;
    expect(questionCode).toBeTruthy();

    // 2 — the Loan Engine: link it, then this bank's rate for a red car.
    await page.goto(`/loan-engine?question=${questionCode}`);
    await page.getByRole('button', { name: 'Link it to a figure' }).click();
    const row = page.locator('tr', { has: page.locator('.le__code', { hasText: code }) });
    await expect(row).toHaveCount(1);
    await row.locator('td').nth(0).getByRole('button').click(); // Interest rate
    const rules = page.locator('.ant-drawer-content').last();
    await rules.locator('ol li input:not([readonly])').first().fill('11');
    expect(await overflowX(page)).toBe(0);
    await rules.getByRole('button', { name: 'Save rows' }).click();
    await expect(rules).toBeHidden();
    expect(errors).toEqual([]);

    // 3 — the simulator: a red car at 11%, any other colour at the program's own rate.
    const ask = (answer: string) =>
      simulate(request, 'used_car', carAnswers(1000000, 450000, { monthly_income: 80000, [questionCode!]: answer,
        [KM]: 20000, do_you_want_insurance_on_the_car: 'with_insurance', what_kind_of_car_is_it: 'economy' }));
    const red = (await ask('red')).matches.find((m) => m['programCode'] === code);
    expect(Number(red?.['effectiveRatePercent'])).toBe(11);
    const other = (await ask('another_colour')).matches.find((m) => m['programCode'] === code);
    expect(Number(other?.['effectiveRatePercent'])).not.toBe(11);
  } finally {
    await request.delete(`${API}/bank-programs/${code}`, { headers: { ...headers, 'x-confirm-program-code': code } });
    if (questionCode) {
      await request.delete(`${API}/bank-programs/question-facts/${questionCode}`, { headers });
      const tree = JSON.stringify(await (await request.get(`${API}/questionnaire/tree`, { headers })).json());
      const id = new RegExp(`"id":"([^"]+)"[^{}]*"code":"${questionCode}"`).exec(tree)?.[1]
        ?? new RegExp(`"code":"${questionCode}"[^{}]*"id":"([^"]+)"`).exec(tree)?.[1];
      if (id) await request.delete(`${API}/questionnaire/questions/${id}`, { headers });
    }
  }
});
