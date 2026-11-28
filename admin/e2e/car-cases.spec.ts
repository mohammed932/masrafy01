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
