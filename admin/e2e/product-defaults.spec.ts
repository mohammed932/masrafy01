import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API, apiToken, overflowX, signIn, watchErrors } from './support';

/**
 * A car product's "Bank defaults" step: the loan size, the term, the rate and the plans by
 * down payment typed once on the product, then a NEW bank program under it starts from a copy.
 *
 * Runs on the TESTING car product only, and puts its defaults back afterwards.
 */

const PRODUCT = 'testing_car_buyers_down_payment';
// A bank with no program under the TESTING name yet (the picker leaves out names a bank uses).
const BANK = 'cmvw9leao00036py96qmy92te';

type Detail = Record<string, unknown> & { labelEn: string };

async function headers(request: APIRequestContext): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await apiToken(request)}` };
}

async function product(request: APIRequestContext): Promise<Detail> {
  const res = await request.get(`${API}/bank-programs/surrogate-products/${PRODUCT}`, {
    headers: await headers(request),
  });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { data: Detail }).data;
}

async function putDefaults(
  request: APIRequestContext,
  auth: Record<string, string>,
  path: string,
  data: unknown,
): Promise<void> {
  const res = await request.put(`${API}/bank-programs/surrogate-products/${PRODUCT}/${path}`, {
    headers: auth,
    data,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

async function pick(page: Page, select: ReturnType<Page['locator']>, text: string): Promise<void> {
  await select.click();
  const search = select.locator('input.ant-select-selection-search-input:not([readonly])');
  if (await search.count()) await page.keyboard.type(text.slice(0, 18));
  await page
    .locator('.ant-select-dropdown:visible nz-option-item', { hasText: text })
    .first()
    .click();
}

const NAME_KEY = 'testing_car_buyers_program';
const EXISTING = 'HOUSING-CAR-7832';

async function program(request: APIRequestContext, auth: Record<string, string>, code: string) {
  const res = await request.get(`${API}/bank-programs/${code}`, { headers: auth });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { data: Record<string, unknown> }).data;
}

test('bank defaults: product → new bank program (copy, edited) → quote; nothing else moves', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  const before = await product(request);
  const auth = await headers(request);
  const existingBefore = await program(request, auth, EXISTING);
  let created: string | null = null;
  try {
    await signIn(page);
    await page.goto(`/program-catalog/products/${PRODUCT}`);
    await page.locator('app-wizard-steps').getByText('Bank defaults').click();
    await expect(page.getByRole('heading', { name: 'Bank defaults' })).toBeVisible();

    const type = async (id: string, value: string) => {
      const box = page.locator(`#${id}`);
      await box.fill(value);
      await box.press('Tab');
    };
    await type('psDefMinAmount', '150000');
    await type('psDefMaxAmount', '3000000');
    await type('psDefMinMonths', '12');
    await type('psDefMaxMonths', '72');
    await type('psDefRate', '16');
    // A product with no plans yet starts its table at the base rate; one that has plans shows them.
    const start = page.getByRole('button', { name: 'Start the table' });
    if (await start.isVisible()) await start.click();
    await expect(page.locator('app-plan-rows-editor')).toBeVisible();
    expect(await overflowX(page)).toBe(0);
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    const confirm = page.locator('.ant-modal-confirm');
    const saved = page.getByText('Changes saved.');
    await expect(confirm.or(saved).first()).toBeVisible();
    if (await confirm.isVisible())
      await confirm.getByRole('button', { name: 'Save changes' }).click();
    await expect(saved).toBeVisible();

    const after = await product(request);
    expect(after['loanAmountDefaults']).toMatchObject({
      minAmountEGP: '150000',
      maxAmountEGP: '3000000',
    });
    expect(after['tenorDefaults']).toEqual({ minMonths: 12, maxMonths: 72 });
    expect(after['rateDefaults']).toMatchObject({ baseRatePercent: '16' });
    expect(after['planDefaults']).toBeTruthy();
    // A new bank program under it: the Money step opens on a copy of those figures.
    await page.goto(`/banks/programs/new?bankId=${BANK}&category=car`);
    await page.getByText('Surrogate', { exact: true }).first().click();
    await pick(page, page.locator('nz-select').last(), before.labelEn.slice(0, 18));
    await page.getByRole('button', { name: /Continue/ }).click();
    await page.getByRole('button', { name: /Continue/ }).click();
    const value = async (control: string) => {
      let field = page.locator(`[formcontrolname=${control}]`).first();
      if ((await field.evaluate((e) => e.tagName)) !== 'INPUT')
        field = field.locator('input').first();
      return (await field.inputValue()).replace(/,/g, '');
    };
    expect(await value('minAmountEGP')).toMatch(/^150000(\.00)?$/);
    expect(await value('maxAmountEGP')).toMatch(/^3000000(\.00)?$/);
    expect(await value('minMonths')).toBe('12');
    expect(await value('maxMonths')).toBe('72');
    // The copied plans table prices every deposit, so the rate is read in the table, not a box.
    const plans = after['planDefaults'] as { rateByFact: { cells: { value: string }[] } };
    const firstRate = page.locator('app-plan-rows-editor input[id^="plan-rateByFact-"]').first();
    expect(Number((await firstRate.inputValue()).replace(/,/g, ''))).toBe(
      Number(plans.rateByFact.cells[0]!.value),
    );
    expect(await overflowX(page)).toBe(0);

    // The bank edits its copy, then creates the program.
    const minBox = page.locator('[formcontrolname=minAmountEGP]').first();
    const minInput =
      (await minBox.evaluate((e) => e.tagName)) === 'INPUT'
        ? minBox
        : minBox.locator('input').first();
    await minInput.fill('200000');
    await minInput.press('Tab');
    await page.getByRole('button', { name: /Continue/ }).click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await page.getByRole('button', { name: 'Create bank program' }).click();
    await page.waitForURL(/\/banks\/programs\/[A-Z0-9-]+$/);
    created = new URL(page.url()).pathname.split('/').pop() ?? null;
    expect(created).toBeTruthy();

    // Stored: the bank's edit, the product's other figures, and the plans as its own copy.
    const mine = await program(request, auth, created!);
    const limits = mine['loanLimits'] as Record<string, unknown>;
    const tenor = mine['tenor'] as Record<string, unknown>;
    const pricing = mine['pricing'] as Record<string, unknown>;
    expect(Number(limits['minAmountEGP'])).toBe(200000);
    expect(Number(limits['maxAmountEGP'])).toBe(3000000);
    expect([tenor['minMonths'], tenor['maxMonths']]).toEqual([12, 72]);
    expect(mine['plansSource']).toBe('own');
    expect(pricing['rateByFact']).toEqual(plans.rateByFact);

    // The product did not move with the bank's edit.
    const productNow = await product(request);
    expect(productNow['loanAmountDefaults']).toMatchObject({ minAmountEGP: '150000' });

    // The simulator quotes it, at a rate from its table.
    const sim = await request.post(`${API}/matching/simulate`, {
      headers: auth,
      data: {
        category: 'car',
        programNameKey: NAME_KEY,
        age: 35,
        answers: [
          { questionCode: 'car_price', numericValue: '1000000' },
          { questionCode: 'car_down_payment', numericValue: '400000' },
          { questionCode: 'repayment_period_months', numericValue: '60' },
          { questionCode: 'current_loans', optionCodes: ['none'] },
          { questionCode: 'car_model_year', numericValue: String(new Date().getFullYear() - 1) },
          { questionCode: 'months_in_current_job', numericValue: '36' },
        ],
      },
    });
    expect(sim.ok()).toBeTruthy();
    const data = (
      (await sim.json()) as {
        data: { matches: Record<string, unknown>[]; hidden: Record<string, unknown>[] };
      }
    ).data;
    const offer = data.matches.find((m) => m['programCode'] === created);
    expect(
      offer,
      JSON.stringify(data.hidden.find((h) => h['programCode'] === created) ?? null),
    ).toBeTruthy();
    const tableRates = plans.rateByFact.cells.map((c) => Number(c.value));
    expect(tableRates).toContain(Number(offer!['effectiveRatePercent']));

    // An existing program under the same product is untouched.
    const existingAfter = await program(request, auth, EXISTING);
    expect(existingAfter['version']).toBe(existingBefore['version']);
    expect(existingAfter['loanLimits']).toEqual(existingBefore['loanLimits']);
    expect(existingAfter['pricing']).toEqual(existingBefore['pricing']);

    // A product that is not a car loan has no Bank defaults step.
    const list = await request.get(`${API}/bank-programs/surrogate-products`, { headers: auth });
    const products = ((await list.json()) as { data: { key: string }[] }).data;
    const other = products.find((x) => /doctor|military|armed|club|teacher/i.test(x.key));
    expect(other, 'a non-car product').toBeTruthy();
    await page.goto(`/program-catalog/products/${other!.key}`);
    await expect(page.locator('app-wizard-steps').getByText('Amount')).toBeVisible();
    await expect(page.locator('app-wizard-steps').getByText('Bank defaults')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (created) {
      await request.delete(`${API}/bank-programs/${created}`, {
        headers: { ...auth, 'x-confirm-program-code': created },
      });
    }
    await putDefaults(request, auth, 'loan-amount-defaults', {
      loanAmounts: before['loanAmountDefaults'] ?? null,
    });
    await putDefaults(request, auth, 'tenor-defaults', { tenor: before['tenorDefaults'] ?? null });
    await putDefaults(request, auth, 'rate-defaults', { rate: before['rateDefaults'] ?? null });
    await putDefaults(request, auth, 'plan-defaults', { plans: before['planDefaults'] ?? null });
  }
});

test('a new product says its loan type; an Auto one shows Bank defaults from the start', async ({
  page,
  request,
}) => {
  const errors = watchErrors(page);
  const auth = await headers(request);
  const run = test.info().project.name;
  const name = `TESTING e2e loan type ${run}`;
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  await request.delete(`${API}/bank-programs/surrogate-products/${key}`, { headers: auth });
  try {
    await signIn(page);
    await page.goto('/program-catalog/products/new');
    await page.locator('#np-name-en').fill(name);
    await page.locator('#np-name-ar').fill('تجربة');
    // Without a loan type, Create says so.
    await page.getByRole('button', { name: 'Create and continue' }).click();
    await expect(page.getByText('Choose the loan type.')).toBeVisible();
    await page.getByRole('radio', { name: 'Auto Loan' }).check({ force: true });
    expect(await overflowX(page)).toBe(0);
    await page.getByRole('button', { name: 'Create and continue' }).click();
    await page.waitForURL(new RegExp(`/program-catalog/products/${key}`));
    // No question and no method yet — the step is there because the product is Auto.
    await expect(page.locator('app-wizard-steps').getByText('Bank defaults')).toBeVisible();
    const detail = await request.get(`${API}/bank-programs/surrogate-products/${key}`, {
      headers: auth,
    });
    expect(((await detail.json()) as { data: { loanCategory: string } }).data.loanCategory).toBe(
      'car',
    );
    // Changing it to Personal on the Name step hides the step after Save.
    await page.locator('app-wizard-steps').getByText('Name').click();
    await page.getByRole('radio', { name: 'Personal Loan' }).check({ force: true });
    await expect(page.locator('app-wizard-steps').getByText('Bank defaults')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`${API}/bank-programs/surrogate-products/${key}`, { headers: auth });
  }
});
