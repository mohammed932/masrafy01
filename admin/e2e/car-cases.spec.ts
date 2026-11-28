import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API, apiToken, overflowX, signIn, watchErrors } from './support';

/**
 * The car list and a bank's cases (v36.4.0), through the screens:
 *  1. Car list: Category → Brand (European → Mercedes-Benz); add a brand and remove it again.
 *  2. Cases on a TESTING copy of a car program: "Brand Mercedes-Benz → rate 11%" and
 *     "Brand Chery → refuse", saved with the program; the simulator prices a Mercedes by
 *     case 1, hides a Chery, prices a Toyota by the program; the brand question is now asked
 *     and its answers follow the country.
 * Every row a test makes is TESTING and deleted again, also when the test fails.
 */

const SOURCE = 'HOUSING-CAR-7832';
const NAME_KEY = 'testing_car_buyers_program';
const BANK = 'cmvw9leao00036py96qmy92te';
const BRAND = 'what_brand_is_the_car';

async function auth(request: APIRequestContext): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await apiToken(request)}` };
}

async function pick(page: Page, select: ReturnType<Page['locator']>, text: string): Promise<void> {
  await select.click();
  await page.keyboard.type(text.slice(0, 12));
  await page
    .locator('.ant-select-dropdown:visible nz-option-item', { hasText: text })
    .first()
    .click();
}

test('car list: browse, add a brand, remove it', async ({ page, request }) => {
  const errors = watchErrors(page);
  const run = test.info().project.name;
  const brand = `TESTING Brand ${run}`;
  // A run that died half-way leaves its brand behind; clear it first.
  const headers = await auth(request);
  const rows = (await (
    await request.get(`${API}/enumerations?type=car_brand`, { headers })
  ).json()) as { data: { id: string; labelEn: string }[] };
  for (const r of rows.data.filter((x) => x.labelEn === brand)) {
    await request.delete(`${API}/enumerations/${r.id}`, { headers });
  }
  await signIn(page);
  await page.goto('/car-list');
  // Category → Brand: no countries, no models.
  await expect(
    page.locator('.cl__col').first().getByRole('heading', { name: 'Category' }),
  ).toBeVisible();
  await page.locator('.cl__pick', { hasText: 'European' }).click();
  const brands = page.locator('.cl__col').nth(1);
  await expect(brands.getByRole('heading', { name: 'Brand' })).toBeVisible();
  await expect(brands.getByText('Under European')).toBeVisible();
  await brands.getByRole('searchbox').fill('Mercedes');
  await expect(brands.getByText('Mercedes-Benz')).toBeVisible();
  await brands.getByRole('searchbox').fill('');

  await brands.getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('#clNameEn').fill(brand);
  await page.locator('app-form-drawer').getByRole('button', { name: 'Add', exact: true }).click();
  await brands.getByRole('searchbox').fill('TESTING Brand');
  await expect(brands.getByText(brand)).toBeVisible();
  expect(await overflowX(page)).toBe(0);

  await brands.getByRole('button', { name: `Remove ${brand}` }).click();
  await page.locator('.ant-modal-confirm').getByRole('button', { name: 'Remove' }).click();
  await expect(brands.getByText(brand)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('car list: a level is added under the last, with its question', async ({ page, request }) => {
  const errors = watchErrors(page);
  const run = test.info().project.name;
  const level = `TESTING Trim ${run}`;
  const typeKey = `car_testing_trim_${run}`;
  const headers = await auth(request);
  const cleanUp = async () => {
    const qs = (await (
      await request.get(`${API}/bank-programs/method-templates/questions`, { headers })
    ).json()) as { data: { code: string; listType: string | null; factKey: string | null }[] };
    const tree = (await (await request.get(`${API}/questionnaire/tree`, { headers })).json()) as {
      data: { questions?: { id: string; code: string }[] }[];
    };
    const all = tree.data.flatMap((g) => g.questions ?? []);
    const facts = (await (
      await request.get(`${API}/enumerations?type=surrogate_fact`, { headers })
    ).json()) as { data: { id: string; key: string }[] };
    for (const q of qs.data.filter((x) => x.listType === typeKey)) {
      // The fact first: a question a fact still reads cannot be switched off.
      const f = facts.data.find((x) => x.key === q.factKey);
      if (f) await request.delete(`${API}/enumerations/${f.id}`, { headers });
      const row = all.find((x) => x.code === q.code);
      if (row) await request.delete(`${API}/questionnaire/questions/${row.id}`, { headers });
    }
    const values = (await (
      await request.get(`${API}/enumerations?type=${typeKey}`, { headers })
    ).json()) as { data?: { id: string }[] };
    for (const v of values.data ?? []) {
      await request.delete(`${API}/enumerations/${v.id}`, { headers });
    }
    await request.delete(`${API}/enumerations/types/${typeKey}`, { headers });
  };
  await cleanUp();
  try {
    await signIn(page);
    await page.goto('/car-list');
    // However many levels there are, adding one adds exactly one column, at the end.
    await expect(page.locator('.cl__col').first()).toBeVisible();
    const before = await page.locator('.cl__col').count();
    await page.getByRole('button', { name: 'Add a level' }).click();
    await page.locator('#clNameEn').fill(level);
    await page.locator('app-form-drawer').getByRole('button', { name: 'Add', exact: true }).click();
    // A fourth column, filed under the model picked.
    await expect(page.locator('.cl__col')).toHaveCount(before + 1);
    const trims = page.locator('.cl__col').nth(before);
    await expect(trims.getByRole('heading', { name: level })).toBeVisible();
    await expect(
      trims.getByText('Customers are asked this once it holds two values.'),
    ).toBeVisible();
    expect(await overflowX(page)).toBe(0);
    // The level above may hold nothing yet (an operator's empty level): then there is nothing
    // to file under, and the column says so. Otherwise two values make it a question.
    if (await trims.getByText('Pick one on the left to see what is filed under it.').isVisible()) {
      await expect(trims.getByRole('button', { name: 'Paste a list' })).toHaveCount(0);
    } else {
      await expect(trims.getByText(/^Under /)).toBeVisible();
      await trims.getByRole('button', { name: 'Paste a list' }).click();
      await page
        .locator('#clPaste')
        .fill('TESTING Base' + String.fromCharCode(10) + 'TESTING Sport');
      await page
        .locator('app-form-drawer')
        .getByRole('button', { name: 'Add', exact: true })
        .click();
      await expect(trims.getByText('TESTING Sport')).toBeVisible();
      await expect(
        trims.getByText('Customers are asked this once it holds two values.'),
      ).toHaveCount(0);
      const qs = (await (
        await request.get(`${API}/bank-programs/method-templates/questions`, { headers })
      ).json()) as { data: { listType: string | null; factKey: string | null }[] };
      expect(qs.data.find((x) => x.listType === typeKey)?.factKey).toBeTruthy();
    }
    expect(errors).toEqual([]);
  } finally {
    await cleanUp();
  }
});

test('cases: a combination of answers prices, refuses or leaves the program', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  const headers = await auth(request);
  const run = test.info().project.name;
  let code: string | null = null;
  try {
    // A TESTING copy of a car program under the TESTING name, at a bank without one.
    const src = (
      (await (await request.get(`${API}/bank-programs/${SOURCE}`, { headers })).json()) as {
        data: Record<string, unknown>;
      }
    ).data;
    const body: Record<string, unknown> = {};
    for (const k of [
      'friendlyNameAr',
      'programType',
      'productCategory',
      'isShariaCompliant',
      'requiredDocuments',
      'tenor',
      'loanLimits',
      'pricing',
      'eligibility',
      'incomeAssumption',
      'fees',
      'plansSource',
    ]) {
      if (src[k] !== null && src[k] !== undefined) body[k] = src[k];
    }
    Object.assign(body, {
      friendlyName: `TESTING e2e cases ${run}`,
      programNameKey: NAME_KEY,
      bankId: BANK,
      bankName: 'TESTING bank',
    });
    // A run that died half-way leaves its copy behind; clear it so this one can be made.
    const listed = (await (
      await request.get(`${API}/bank-programs?pageSize=100`, { headers })
    ).json()) as { data: { programCode: string; friendlyName: string }[] };
    for (const old of listed.data.filter((p) => p.friendlyName.startsWith('TESTING e2e cases'))) {
      await request.delete(`${API}/bank-programs/${old.programCode}`, {
        headers: { ...headers, 'x-confirm-program-code': old.programCode },
      });
    }
    const made = await request.post(`${API}/bank-programs`, { headers, data: body });
    expect(made.ok(), await made.text()).toBeTruthy();
    code = ((await made.json()) as { data: { programCode: string } }).data.programCode;

    // The two cases, written on the Money step.
    await signIn(page);
    await page.goto(`/banks/programs/${code}/edit`);
    await page.getByRole('button', { name: /Money/ }).first().click();
    const card = page.locator('#card-cases');
    await card.getByRole('button', { name: '+ Add a case' }).click();
    await pick(page, card.locator('nz-select').first(), 'What brand is the car?');
    await pick(page, card.locator('nz-select').nth(1), 'Mercedes-Benz');
    await card.getByRole('button', { name: 'Add', exact: true }).click();
    await card.locator('[id="cs-case_1-ratePercent"]').fill('11');
    await card.locator('[id="cs-case_1-ratePercent"]').press('Tab');

    await card.getByRole('button', { name: '+ Add a case' }).click();
    await pick(page, card.locator('.cs-picker nz-select').first(), 'What brand is the car?');
    await pick(page, card.locator('.cs-picker nz-select').nth(1), 'Chery');
    await card.getByRole('button', { name: 'Add', exact: true }).click();
    await card.locator('.cs-case').nth(1).getByRole('radio', { name: 'Refuse' }).click();
    await expect(card.locator('.cs-sum').first()).toHaveText(/Mercedes-Benz → Rate 11%/);
    await expect(card.locator('.cs-sum').nth(1)).toHaveText(/Chery → refused/);
    expect(await overflowX(page)).toBe(0);
    await page.getByRole('button', { name: 'Review' }).first().click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL(new RegExp(`/banks/programs/${code}$`));

    const stored = (
      (await (await request.get(`${API}/bank-programs/${code}`, { headers })).json()) as {
        data: {
          cases: Array<{ allOf: unknown[]; effects: Record<string, unknown>; refuse?: boolean }>;
        };
      }
    ).data.cases;
    expect(stored).toHaveLength(2);
    expect(stored[0]!.effects).toEqual({ ratePercent: '11' });
    expect(stored[1]!.refuse).toBe(true);

    // The simulator: Mercedes → case 1 at 11%; Chery → hidden; Toyota → the program's own.
    const simulate = async (brand: string) => {
      const res = await request.post(`${API}/matching/simulate`, {
        headers,
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
            { questionCode: 'car_origin', optionCode: 'germany' },
            { questionCode: BRAND, optionCode: brand },
          ],
        },
      });
      expect(res.ok()).toBeTruthy();
      return (
        (await res.json()) as {
          data: { matches: Record<string, unknown>[]; hidden: Record<string, unknown>[] };
        }
      ).data;
    };
    const mercedes = await simulate('mercedes_benz');
    const m = mercedes.matches.find((x) => x['programCode'] === code);
    expect(
      m,
      JSON.stringify(mercedes.hidden.find((x) => x['programCode'] === code) ?? null),
    ).toBeTruthy();
    const mf = m!['figures'] as Record<string, unknown>;
    expect(Number(mf['effectiveRatePercent'])).toBe(11);
    expect(mf['appliedCaseNumber']).toBe(1);

    const chery = await simulate('chery');
    expect(chery.matches.find((x) => x['programCode'] === code)).toBeUndefined();
    expect(chery.hidden.find((x) => x['programCode'] === code)).toBeTruthy();

    const toyota = await simulate('toyota');
    const t = toyota.matches.find((x) => x['programCode'] === code);
    expect(t).toBeTruthy();
    const tf = t!['figures'] as Record<string, unknown>;
    expect(tf['appliedCaseNumber']).toBeNull();
    expect(Number(tf['effectiveRatePercent'])).not.toBe(11);

    // The brand question is now asked on the name, and its answers follow the country.
    const served = (
      (await (
        await request.get(`${API}/questionnaire/served?programNameKey=${NAME_KEY}`, { headers })
      ).json()) as {
        data: Array<{
          pages: Array<{
            questions: Array<{
              code: string;
              optionsDependOn?: string;
              options: Array<{ code: string; parentCode?: string }>;
            }>;
          }>;
        }>;
      }
    ).data;
    const brandQ = served
      .flatMap((c) => c.pages)
      .flatMap((p) => p.questions)
      .find((q) => q.code === BRAND);
    expect(brandQ?.optionsDependOn).toBe('car_origin');
    expect(brandQ?.options.find((o) => o.code === 'mercedes_benz')?.parentCode).toBe('germany');
    expect(errors).toEqual([]);
  } finally {
    if (code) {
      await request.delete(`${API}/bank-programs/${code}`, {
        headers: { ...headers, 'x-confirm-program-code': code },
      });
    }
  }
});
