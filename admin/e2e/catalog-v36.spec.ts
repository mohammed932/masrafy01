import { expect, test, type Page } from '@playwright/test';
import { API, apiToken, overflowX, signIn, watchErrors } from './support';

/**
 * The v36 admin changes, driven in the browser: the deposit-step edge, the fixed questions on a
 * no-payslip product, Copy (program name, bank program, product) and the simulator's hidden list.
 */

const PRODUCT = 'down_payment_income';

async function openDepositSteps(page: Page): Promise<void> {
  await page.goto(`/program-catalog/products/${PRODUCT}?step=4`);
  await page.getByRole('tab', { name: /Deposit steps/ }).click();
  await expect(page.locator('#plan-band-1')).toBeVisible();
}

const bands = (page: Page) =>
  page
    .locator('.prt__band')
    .evaluateAll((els) =>
      els.map((e) => `${(e.querySelector('input') as HTMLInputElement).value} ${e.textContent}`),
    );

test.describe('deposit steps', () => {
  test('a two-digit edge lands whole, and one past its neighbour is put back', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await openDepositSteps(page);
    const before = await bands(page);
    const edge = page.locator('#plan-band-1');

    // Typed key by key: "2" alone sits below the band before it, which used to re-sort the
    // rows under the caret and send the "5" to another row.
    await edge.click();
    await edge.press('Control+a');
    await page.keyboard.type('25', { delay: 80 });
    await expect(edge).toBeFocused();
    await expect(edge).toHaveValue('25');
    await page.keyboard.press('Tab');
    await expect(page.locator('#plan-band-1')).toHaveValue('25');
    const after = await bands(page);
    expect(after).toHaveLength(before.length);
    // The row kept its own figures — only its start moved.
    expect(after[1]?.replace(/^\S+/, '')).toContain(
      before[1]?.split('·')[0]?.split('%').pop()?.trim() ?? '',
    );

    // 45 is past the next band's start (40): refused, said, put back.
    await edge.click();
    await edge.press('Control+a');
    await page.keyboard.type('45');
    await page.keyboard.press('Enter');
    await expect(page.locator('.prt__note[role=alert]')).toContainText('It was put back');
    await expect(page.locator('#plan-band-1')).toHaveValue('25');
    expect(errors).toEqual([]);
    // Nothing is saved: the product page saves only on "Save changes".
  });
});

test.describe('no-payslip product page', () => {
  test('asks its questions in the income-proof page layout, and adds one from the side sheet', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await page.goto(`/program-catalog/products/${PRODUCT}?step=2`);
    // One list, as on an income-proof program: fixed questions locked, this product's own
    // read by its calculation.
    const list = page.locator('app-served-pages');
    await expect(list).toBeVisible();
    expect(await list.getByText('Fixed', { exact: true }).count()).toBeGreaterThan(5);
    await expect(list.getByText('The calculation reads it').first()).toBeVisible();
    // Each question says its type, in the Questions library's words.
    await expect(list.locator('.tag.is-type', { hasText: 'Number' }).first()).toBeVisible();
    expect(await list.locator('.tag.is-type').count()).toBeGreaterThan(10);
    await expect(page.locator('.ask-edit')).toHaveCount(0);
    // Add a question: the side sheet, held until Save, then discarded.
    const rows = await list.locator('li').count();
    await page.getByRole('button', { name: 'Add a question' }).click();
    const sheet = page.locator('.ant-drawer-content');
    await sheet.getByRole('button', { name: /Add/ }).first().click();
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(list.locator('li')).toHaveCount(rows + 1);
    await expect(page.locator('.save-bar')).toContainText('1 change not saved yet');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(list.locator('li')).toHaveCount(rows);
    expect(await overflowX(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Copy opens the new-product wizard from this product', async ({ page }) => {
    await signIn(page);
    await page.goto(`/program-catalog/products/${PRODUCT}`);
    await page.getByRole('link', { name: 'Copy' }).click();
    await expect(page).toHaveURL(new RegExp(`products/new\\?copy=${PRODUCT}`));
  });
});

test.describe('copy a program name', () => {
  test('fills every step from the source and saves a new name with its questions', async ({
    page,
    request,
  }) => {
    const errors = watchErrors(page);
    const token = await apiToken(request);
    const auth = { authorization: `Bearer ${token}` };
    const scopeOf = async (key: string) =>
      (
        (await (
          await request.get(`${API}/enumerations/program-names/question-scope`, {
            params: { key },
            headers: auth,
          })
        ).json()) as { data: { addedByCategory: Record<string, string[]> } }
      ).data.addedByCategory;

    await signIn(page);
    await page.goto('/program-catalog/used_car');
    await page.getByRole('link', { name: 'Copy' }).click();
    await expect(page).toHaveURL(/program-catalog\/new\?copy=used_car/);
    await expect(page.getByText(/A copy of/)).toBeVisible();
    const english = page.locator('input').first();
    await expect(english).toHaveValue('Used Car (copy)');
    await english.fill('TESTING e2e copy');

    let createdKey: string | null = null;
    try {
      // Walk to the last step and save.
      for (let i = 0; i < 3; i++) {
        const next = page.getByRole('button', { name: /^(Next|Add program)$/ }).last();
        await next.click();
        await page.waitForTimeout(800);
        if (!page.url().includes('/program-catalog/new')) break;
      }
      await page.waitForURL((u) => !u.pathname.endsWith('/new'));
      createdKey = new URL(page.url()).pathname.split('/').pop() ?? null;
      expect(createdKey).toBeTruthy();
      const source = await scopeOf('used_car');
      const copy = await scopeOf(createdKey!);
      for (const [category, ids] of Object.entries(source)) {
        expect([...(copy[category] ?? [])].sort()).toEqual([...ids].sort());
      }
      expect(errors).toEqual([]);
    } finally {
      if (createdKey !== null) {
        const list = (await (
          await request.get(`${API}/enumerations`, {
            params: { type: 'program_name' },
            headers: auth,
          })
        ).json()) as { data: { id: string; key: string }[] };
        const row = list.data.find((r) => r.key === createdKey);
        if (row) await request.delete(`${API}/enumerations/${row.id}`, { headers: auth });
      }
    }
  });
});

test.describe('copy a bank program', () => {
  test('opens Add bank program with every step filled from the source', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await page.goto('/banks/programs/NATIONAL-CAR-C483');
    await page.getByRole('link', { name: 'Copy' }).click();
    await expect(page).toHaveURL(/banks\/programs\/new\?copy=NATIONAL-CAR-C483/);
    await expect(page.getByText(/A copy of NBE AUTO LOAN/)).toBeVisible();
    // The basis is answered, the bank and the names are filled, the later steps are done.
    await expect(page.locator('.context-row')).toContainText('Surrogate');
    await expect(page.locator('#bankId')).toContainText('National Bank of Egypt');
    await expect(page.locator('input[formcontrolname=friendlyName]')).toHaveValue('NBE AUTO LOAN');
    // Step 3 holds the source's plan table figures.
    await page
      .getByRole('button', { name: /Continue/ })
      .last()
      .click();
    await page
      .getByRole('button', { name: /Continue/ })
      .last()
      .click();
    await expect(page.getByLabel('10% to under 20%, Rate', { exact: true })).toHaveValue('11');
    expect(await overflowX(page)).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('matching simulator', () => {
  test('lists the programs the applicant is not shown, with the reason', async ({ page }) => {
    // The run itself is the backend's (checked by `check:engine`); here the list is drawn.
    await page.route('**/matching/simulate', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            category: 'personal',
            matches: [],
            suggestions: [],
            hidden: [
              {
                programCode: 'TESTING-E2E-1',
                bankName: 'TESTING Bank',
                programFriendlyName: 'TESTING age rule',
                reason: 'NOT_ELIGIBLE',
                failedRules: ['age', 'monthly_income'],
              },
            ],
          },
        },
      });
    });
    await signIn(page);
    await page.goto('/matching-simulator');
    await expect(page.locator('.q-block').first()).toBeVisible();
    // Walk the wizard: the first answer of every choice, a figure in every box, then Run.
    for (let i = 0; i < 80; i++) {
      const run = page.getByRole('button', { name: /Run simulation/ });
      if (await run.isVisible().catch(() => false)) {
        await run.click();
        break;
      }
      for (const block of await page.locator('.q-block').all()) {
        const option = block.locator('.opt').first();
        if (await option.isVisible().catch(() => false)) {
          if ((await block.locator('.opt.sel').count()) === 0) await option.click();
          continue;
        }
        const select = block.locator('nz-select');
        if ((await select.count()) > 0) {
          if ((await select.locator('.ant-select-selection-item').count()) === 0) {
            await select.click();
            await page.locator('.ant-select-item-option').first().click();
          }
          continue;
        }
        // An optional question stays unanswered — fewer figures to get right.
        if ((await block.locator('.opt-tag').count()) > 0) continue;
        const box = block.locator('input:visible').first();
        if ((await box.count()) > 0 && (await box.inputValue()) === '') {
          // The lowest figure the question's own range allows ("Between 1,980 and 2,100").
          const min = /Between ([\d,]+) and/.exec(await block.innerText())?.[1]?.replace(/,/g, '');
          await box.fill(min !== undefined && Number(min) > 0 ? min : '1');
        }
      }
      const next = page.getByRole('button', { name: 'Next', exact: true });
      if (!(await next.isEnabled().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(150);
    }
    const hidden = page.locator('.hidden-progs');
    await expect(hidden).toBeVisible();
    await hidden.locator('summary').click();
    await expect(hidden).toContainText('TESTING age rule');
    await expect(hidden).toContainText('Outside the age range · Below the minimum income');
  });
});

test.describe('groups per product', () => {
  test('a product files a value in its own class; the shared list and other products keep theirs', async ({
    page,
    request,
  }) => {
    const token = await apiToken(request);
    const headers = { authorization: `Bearer ${token}` };
    const products = `${API}/bank-programs/surrogate-products`;
    const made = await request.post(products, {
      headers,
      data: {
        labelEn: 'TESTING e2e groups',
        labelAr: 'TESTING e2e groups',
        startFrom: 'copy',
        sourceKey: 'doctors_clinic_owner',
      },
    });
    expect(made.ok()).toBeTruthy();
    const key = ((await made.json()) as { data: { key: string } }).data.key;
    try {
      const governorates = (
        (await (
          await request.get(`${API}/enumerations`, { params: { type: 'governorate' }, headers })
        ).json()) as { data: { id: string; key: string; parentKey: string | null }[] }
      ).data;
      const major = governorates.find((g) => g.parentKey === 'city_tier_major')!;
      const quote = async (product: string) =>
        (
          (await (
            await request.post(`${products}/${product}/check`, {
              headers,
              data: {
                answers: [
                  { factKey: 'years_in_practice', value: '3' },
                  { factKey: 'practice_governorate', optionCode: major.key },
                ],
              },
            })
          ).json()) as { data: { valueEGP: string } }
        ).data.valueEGP;
      const before = await quote(key);

      // The product page's class board says its classes are its own.
      await signIn(page);
      await page.goto(`/program-catalog/products/${key}?step=2`);
      // The fold opens by itself when values sit in the catch-all; open it only if it did not.
      const fold = page.locator('details', { hasText: 'Move values between classes' });
      await expect(fold.locator('app-parent-class-board .counts')).toBeAttached();
      await fold.evaluate((d) => ((d as HTMLDetailsElement).open = true));
      await expect(page.getByText(/These classes are this product's own/)).toBeVisible();

      const moved = await request.put(`${products}/${key}/groups`, {
        headers,
        data: { assignments: [{ valueId: major.id, parentKey: 'city_tier_other' }] },
      });
      expect(moved.ok()).toBeTruthy();
      expect(await quote(key)).not.toBe(before);
      expect(await quote('doctors_clinic_owner')).toBe(before);
      const shared = (
        (await (
          await request.get(`${API}/enumerations`, { params: { type: 'governorate' }, headers })
        ).json()) as { data: { id: string; parentKey: string | null }[] }
      ).data.find((g) => g.id === major.id);
      expect(shared?.parentKey).toBe('city_tier_major');
    } finally {
      await request.delete(`${products}/${key}`, { headers });
    }
  });
});

test.describe('own groups on a product', () => {
  test('names its groups, places the answers, and each group prices its own column', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    const headers = { authorization: `Bearer ${await apiToken(request)}` };
    const products = `${API}/bank-programs/surrogate-products`;
    await signIn(page);
    await page.goto('/program-catalog/products/new');
    await page.fill('#np-name-en', `TESTING e2e own groups ${test.info().project.name}`);
    await page.fill('#np-name-ar', `TESTING e2e مجموعات ${test.info().project.name}`);
    await page.getByRole('button', { name: 'Create and continue' }).click();
    await page.waitForURL(/\?step=2/);
    const key = new URL(page.url()).pathname.split('/').pop()!;
    try {
      // Questions: years in practice and the governorate of practice.
      await expect(page.locator('app-served-pages')).toBeVisible();
      await page.getByRole('button', { name: 'Add a question' }).last().click();
      await expect(page.locator('.ant-drawer-content')).toBeVisible();
      const sheet = page.locator('.ant-drawer-content');
      for (const q of ['Years in practice', 'Which governorate do you work in?']) {
        await sheet.locator('input').first().fill(q);
        await sheet.locator('li.row', { hasText: q }).first().getByRole('button').click();
      }
      await sheet.getByRole('button', { name: 'Done' }).click();

      // Calculation: years decide the income, split by the product's own two groups.
      await page.locator('app-wizard-steps').getByText('Calculation').click();
      await page.locator('select').first().selectOption({ label: 'Years in practice' });
      await page.locator('summary', { hasText: 'More options' }).click();
      await page
        .locator('label.addon-head', { hasText: 'A second column' })
        .locator('input')
        .check();
      await page
        .locator('select[formcontrolname=columnFact]')
        .selectOption({ label: 'Governorate of practice' });
      await page.getByText('Put the answers in groups').click();
      await page.getByRole('button', { name: 'Add a group' }).click();
      await page.getByRole('button', { name: 'Add a group' }).click();
      const rows = page.locator('.group-row');
      await rows.nth(0).locator('input').nth(0).fill('Big cities');
      await rows.nth(0).locator('input').nth(1).fill('مدن كبرى');
      await rows.nth(1).locator('input').nth(0).fill('Other cities');
      await rows.nth(1).locator('input').nth(1).fill('مدن أخرى');
      const placement = (name: string) =>
        page.locator('.placement', { hasText: name }).locator('select');
      await placement('Cairo').selectOption({ label: 'Big cities' });
      await placement('Aswan').selectOption({ label: 'Other cities' });
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.locator('.save-bar')).toHaveCount(0);

      // Reopened: the groups and where each answer sits come back.
      await page.reload();
      await page.locator('summary', { hasText: 'More options' }).click();
      await expect(rows.nth(1).locator('input').first()).toHaveValue('Other cities');
      await expect(placement('Cairo')).toHaveValue('g1');
      await expect(placement('Aswan')).toHaveValue('g2');
      expect(await overflowX(page)).toBe(0);

      // The engine: one figure per group, an answer in no group on the first column.
      const tpl = await (await request.get(`${products}/${key}/template`, { headers })).json();
      const band = (income: string) => ({
        bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: income }],
      });
      const put = await request.put(`${products}/${key}/template`, {
        headers,
        data: {
          template: tpl.data.template,
          stepParams: { primary: band('30000'), primary__g2: band('18000') },
        },
      });
      expect(put.ok()).toBeTruthy();
      const price = async (city: string) => {
        const res = await request.post(`${products}/${key}/check`, {
          headers,
          data: {
            answers: [
              { factKey: 'years_in_practice', value: '10' },
              { factKey: 'practice_governorate', optionCode: city },
            ],
          },
        });
        return ((await res.json()) as { data: { valueEGP: string } }).data.valueEGP;
      };
      expect(await price('cairo')).toBe('30000.00');
      expect(await price('aswan')).toBe('18000.00');
      expect(await price('luxor')).toBe('30000.00');
      expect(errors).toEqual([]);
    } finally {
      await request.delete(`${products}/${key}`, { headers });
    }
  });
});
