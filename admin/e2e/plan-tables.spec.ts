import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { API, apiToken, overflowX, signIn, watchErrors } from './support';

/**
 * The plan tables on a product's Figures step ("Plans by deposit": rate, longest and shortest
 * term, financed share, smallest loan), driven key by key the way an operator types. Every
 * test works on its own TESTING copy of a no-payslip product, with the copy's own income
 * figures filled so a Save can go through, and deletes it again.
 */

const PRODUCTS = `${API}/bank-programs/surrogate-products`;
const SLOTS = [
  'Interest rate',
  'Longest term',
  'Shortest term',
  'Share of the price financed',
  'Smallest loan',
];

async function testingProduct(request: APIRequestContext, label: string) {
  const headers = { authorization: `Bearer ${await apiToken(request)}` };
  const name = `TESTING e2e ${label} ${test.info().project.name}`;
  // A run that died half-way leaves its copy behind; clear it so this one can be made.
  const listed = await (await request.get(PRODUCTS, { headers })).json();
  for (const row of (listed as { data: { key: string; labelEn: string }[] }).data) {
    if (row.labelEn === name) await request.delete(`${PRODUCTS}/${row.key}`, { headers });
  }
  const made = await request.post(PRODUCTS, {
    headers,
    data: { labelEn: name, labelAr: name, startFrom: 'copy', sourceKey: 'doctors_in_practice' },
  });
  expect(made.ok()).toBeTruthy();
  const key = ((await made.json()) as { data: { key: string } }).data.key;
  // The copy's own income table, so nothing but the plans can block a Save.
  const tpl = await (await request.get(`${PRODUCTS}/${key}/template`, { headers })).json();
  const put = await request.put(`${PRODUCTS}/${key}/template`, {
    headers,
    data: {
      template: tpl.data.template,
      stepParams: {
        primary: { bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '20000' }] },
      },
    },
  });
  expect(put.ok()).toBeTruthy();
  return { key, remove: () => request.delete(`${PRODUCTS}/${key}`, { headers }) };
}

function slot(page: Page, index: number): Locator {
  return page.locator('.plan-slot').nth(index);
}

async function open(page: Page, index: number): Promise<Locator> {
  const s = slot(page, index);
  const row = s.locator('.plan-row');
  if ((await row.getAttribute('aria-expanded')) !== 'true') await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  return s;
}

async function pickQuestion(page: Page, s: Locator, question: string): Promise<void> {
  await s.locator('nz-select').first().click();
  await page.locator('nz-option-item', { hasText: question }).first().click();
}

/** Types into a box KEY BY KEY, as a person does — the case a `fill()` hides. */
async function typeInto(page: Page, box: Locator, text: string): Promise<void> {
  await box.click();
  await page.keyboard.type(text, { delay: 40 });
}

async function goToFigures(page: Page, key: string): Promise<void> {
  await page.goto(`/program-catalog/products/${key}?step=4`);
  await expect(page.locator('.plan-slot')).toHaveCount(5);
}

test.describe('plan tables on the Figures step', () => {
  test.setTimeout(120_000);

  test('the five tables are rows that open and close; opening one changes nothing', async ({
    page,
    request,
  }) => {
    const errors = watchErrors(page);
    const p = await testingProduct(request, 'plans open');
    try {
      await signIn(page);
      await goToFigures(page, p.key);
      await expect(page.locator('.plan-slot .plan-row-title')).toHaveText(SLOTS);
      await expect(page.getByText(/^State a /)).toHaveCount(0);
      // Sections no product states are not drawn (2026-11-08).
      for (const gone of [
        'What each I-Score is worth',
        'The maximum every new program starts from',
        'Variable rate (CBE-linked, quarterly reset)',
      ]) {
        await expect(page.getByText(gone)).toHaveCount(0);
      }
      await expect(page.locator('#product-dbr-cap, #product-rate')).toHaveCount(0);
      for (let i = 0; i < 5; i++) {
        const s = await open(page, i);
        await expect(s.locator('app-fact-grid-editor')).toBeVisible();
        await s.locator('.plan-row').click();
        await expect(s.locator('.plan-row')).toHaveAttribute('aria-expanded', 'false');
        await expect(s.locator('.plan-row-state')).toHaveText('Not set');
      }
      await expect(page.locator('.save-bar')).toHaveCount(0);
      expect(await overflowX(page)).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await p.remove();
    }
  });

  test('a value typed with no question: the row says so, still closes, and clearing it undoes it', async ({
    page,
    request,
  }) => {
    const errors = watchErrors(page);
    const p = await testingProduct(request, 'plans clear');
    try {
      await signIn(page);
      await goToFigures(page, p.key);
      for (let i = 0; i < 5; i++) {
        const s = await open(page, i);
        const value = s.locator('input.fgd__value');
        await typeInto(page, value, '12');
        await expect(value).toHaveValue(/^12/);
        await expect(value).toBeFocused();
        await expect(page.locator('.fb-error')).toContainText('pick the question it goes by');
        await expect(page.locator('.save-bar')).toContainText(
          `Finish or clear the ${SLOTS[i]} table`,
        );
        await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
        // Closes while unfinished, and says so.
        await s.locator('.plan-row').click();
        await expect(s.locator('.plan-row')).toHaveAttribute('aria-expanded', 'false');
        await expect(s.locator('.plan-row-state')).toHaveText('Not finished');
        // Reopened and cleared: back to not set, nothing to save.
        await open(page, i);
        await value.fill('');
        await value.blur();
        await expect(page.locator('.fb-error')).toHaveCount(0);
        await expect(page.locator('.save-bar')).toHaveCount(0);
        await s.locator('.plan-row').click();
        await expect(s.locator('.plan-row-state')).toHaveText('Not set');
      }
      expect(errors).toEqual([]);
    } finally {
      await p.remove();
    }
  });

  test('keyed by down payment: two-digit numbers type whole, the list stays, and it saves', async ({
    page,
    request,
  }) => {
    const errors = watchErrors(page);
    const p = await testingProduct(request, 'plans deposit');
    try {
      await signIn(page);
      await goToFigures(page, p.key);
      const s = await open(page, 0);
      await pickQuestion(page, s, 'Down payment (% of the price)');
      await expect(page.locator('.fb-error')).toContainText('fill in the range of every row');
      const [from, to] = [s.locator('input.fgd__edge').nth(0), s.locator('input.fgd__edge').nth(1)];
      await typeInto(page, from, '10');
      // The first digit must not swap the page under the operator.
      await expect(from).toBeFocused();
      await expect(from).toHaveValue('10');
      await expect(page.locator('.plan-slot')).toHaveCount(5);
      await expect(page.locator('app-plan-rows-editor')).toHaveCount(0);
      await typeInto(page, to, '30');
      await expect(to).toHaveValue('30');
      await expect(from).toHaveValue('10');
      await expect(page.locator('.fb-error')).toContainText('fill in the value of every row');
      const value = s.locator('input.fgd__value');
      await typeInto(page, value, '12.5');
      await expect(value).toHaveValue('12.5');
      await expect(page.locator('.fb-error')).toHaveCount(0);
      await expect(page.locator('.plan-slot')).toHaveCount(5);
      // A second row, typed, then removed again.
      await s.getByRole('button', { name: 'Add a row' }).click();
      await expect(s.locator('input.fgd__value')).toHaveCount(2);
      await typeInto(page, s.locator('input.fgd__edge').nth(2), '30');
      await typeInto(page, s.locator('input.fgd__value').nth(1), '11');
      await expect(page.locator('.fb-error')).toHaveCount(0);
      await s.locator('tbody tr').nth(1).getByRole('button').last().click();
      await expect(s.locator('input.fgd__value')).toHaveCount(1);
      // Saved, then read back.
      const save = page.getByRole('button', { name: 'Save changes' });
      await expect(save).toBeEnabled();
      await save.click();
      await expect(page.locator('.save-bar')).toHaveCount(0);
      await goToFigures(page, p.key).catch(() => undefined);
      await page.reload();
      // Stored and drawable as one card: the combined view leads, the list is one click away.
      await expect(page.locator('app-plan-rows-editor')).toBeVisible();
      await page.getByRole('button', { name: 'Edit one table at a time' }).click();
      await expect(page.locator('.plan-slot')).toHaveCount(5);
      await expect(slot(page, 0).locator('.plan-row-state')).not.toHaveText('Not set');
      await page.getByRole('button', { name: 'Show the plans as one table' }).click();
      await expect(page.locator('app-plan-rows-editor')).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await p.remove();
    }
  });

  test('another question: the rate by loan term is a table of its own, and saves', async ({
    page,
    request,
  }) => {
    const errors = watchErrors(page);
    const p = await testingProduct(request, 'plans term');
    try {
      await signIn(page);
      await goToFigures(page, p.key);
      const s = await open(page, 0);
      await pickQuestion(page, s, 'Loan term (months)');
      await typeInto(page, s.locator('input.fgd__edge').nth(0), '12');
      await typeInto(page, s.locator('input.fgd__edge').nth(1), '60');
      await typeInto(page, s.locator('input.fgd__value'), '9.75');
      await expect(s.locator('input.fgd__value')).toHaveValue('9.75');
      await expect(s.locator('input.fgd__edge').nth(0)).toHaveValue('12');
      await expect(s.locator('input.fgd__edge').nth(1)).toHaveValue('60');
      await expect(page.locator('.fb-error')).toHaveCount(0);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.locator('.save-bar')).toHaveCount(0);
      await page.reload();
      await expect(page.locator('.plan-slot')).toHaveCount(5);
      await expect(slot(page, 0).locator('.plan-row-state')).not.toHaveText('Not set');
      expect(errors).toEqual([]);
    } finally {
      await p.remove();
    }
  });

  test('Discard puts every table back; Remove this table clears a saved one', async ({
    page,
    request,
  }) => {
    const errors = watchErrors(page);
    const p = await testingProduct(request, 'plans discard');
    try {
      await signIn(page);
      await goToFigures(page, p.key);
      // Discard: typed, thrown away.
      let s = await open(page, 4);
      await pickQuestion(page, s, 'Loan term (months)');
      await typeInto(page, s.locator('input.fgd__value'), '50000');
      await page.getByRole('button', { name: 'Discard' }).click();
      await expect(page.locator('.save-bar')).toHaveCount(0);
      await expect(slot(page, 4).locator('.plan-row-state')).toHaveText('Not set');
      // A saved table, then removed and saved again.
      s = await open(page, 4);
      await pickQuestion(page, s, 'Loan term (months)');
      await typeInto(page, s.locator('input.fgd__edge').nth(0), '0');
      await typeInto(page, s.locator('input.fgd__value'), '50000');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.locator('.save-bar')).toHaveCount(0);
      await page.reload();
      s = await open(page, 4);
      await s.getByRole('button', { name: 'Remove the smallest-loan table' }).click();
      await expect(s.locator('.plan-row-state')).toHaveText('Not set');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.locator('.save-bar')).toHaveCount(0);
      await page.reload();
      await expect(slot(page, 4).locator('.plan-row-state')).toHaveText('Not set');
      expect(errors).toEqual([]);
    } finally {
      await p.remove();
    }
  });
});
