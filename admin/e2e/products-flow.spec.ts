import { expect, test, type Page } from '@playwright/test';
import { API, apiToken, overflowX, signIn, watchErrors } from './support';

/**
 * The no-payslip product flow and the screens built around it, driven in the browser: the
 * five-step product wizard (v36.1.0), creating a product, the catalog cards' dates, the
 * questions library and the matching simulator's filters. Every write is a TESTING row,
 * deleted again.
 */

const STEPS = ['Name', 'Questions', 'Calculation', 'Figures', 'Check and go live'];

async function railNames(page: Page): Promise<string[]> {
  return page
    .locator('app-wizard-steps .step-label')
    .evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => e.textContent?.trim() ?? ''),
    );
}

test.describe('no-payslip product wizard', () => {
  test('names all five steps, and the calculation step has no wizard of its own', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await page.goto('/program-catalog/products/down_payment_income?step=3');
    await expect(
      page.getByRole('heading', { name: 'Which question decides the income?' }),
    ).toBeVisible();
    expect(await railNames(page)).toEqual(STEPS);
    // One rail on the page: the calculation's own two-part rail is gone, its parts stacked.
    await expect(page.locator('app-wizard-steps')).toHaveCount(1);
    await expect(page.getByText('More options', { exact: true })).toBeVisible();
    // DBR always: no "income or most they may borrow" choice, no list of seven ways.
    await expect(page.getByText('The most the customer may borrow')).toHaveCount(0);
    await expect(page.locator('.cards .card')).toHaveCount(0);
    await expect(page.locator('.eyebrow')).toHaveCount(0);
    expect(await overflowX(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('the last step tries sample answers and holds the switch; an old step-6 link lands there', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/program-catalog/products/down_payment_income?step=6');
    await expect(page.getByRole('heading', { name: 'Try it with sample answers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Who uses it' })).toBeVisible();
    await expect(page.locator('app-wizard-steps .step.active .step-label')).toHaveText(
      'Check and go live',
    );
  });

  test('a new product asks only its name, and opens on Questions', async ({ page, request }) => {
    const errors = watchErrors(page);
    const headers = { authorization: `Bearer ${await apiToken(request)}` };
    await signIn(page);
    await page.goto('/program-catalog/products/new');
    await expect(page.locator('#np-name-en')).toBeVisible();
    await expect.poll(() => railNames(page)).toEqual(STEPS);
    // Just the name: no start options to choose between.
    await expect(page.locator('.choices')).toHaveCount(0);
    await page.fill('#np-name-en', 'TESTING e2e product');
    await page.fill('#np-name-ar', 'TESTING e2e منتج');
    await page.getByRole('button', { name: 'Create and continue' }).click();
    await page.waitForURL(/program-catalog\/products\/(?!new)[a-z0-9_]+\?step=2/);
    const key = new URL(page.url()).pathname.split('/').pop()!;
    try {
      await expect(page.locator('app-wizard-steps .step.active .step-label')).toHaveText(
        'Questions',
      );
      // The fixed questions are listed, locked, on a brand-new product too.
      await expect(
        page.locator('app-served-pages').getByText('Fixed', { exact: true }).first(),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await request.delete(`${API}/bank-programs/surrogate-products/${key}`, { headers });
    }
  });
});

test.describe('program catalog', () => {
  test('every card says when it was created', async ({ page }) => {
    await signIn(page);
    await page.goto('/program-catalog');
    const dates = page.locator('.card-dates');
    await expect(dates.first()).toBeVisible();
    await expect(dates.first()).toContainText(/Created/);
    expect(await overflowX(page)).toBe(0);
  });

  test('a product card carries Edit, power and Delete like a name card', async ({
    page,
    request,
  }) => {
    const errors = watchErrors(page);
    const headers = { authorization: `Bearer ${await apiToken(request)}` };
    await signIn(page);
    await page.goto('/program-catalog/products/new');
    await page.fill('#np-name-en', 'TESTING e2e card actions');
    await page.fill('#np-name-ar', 'TESTING e2e بطاقة');
    await page.getByRole('button', { name: 'Create and continue' }).click();
    await page.waitForURL(/program-catalog\/products\/(?!new)[a-z0-9_]+\?step=2/);
    const key = new URL(page.url()).pathname.split('/').pop()!;
    try {
      await page.goto('/program-catalog?basis=no_payslip');
      const card = page.locator('li.card.is-product', { hasText: 'TESTING e2e card actions' });
      await card.hover();
      const labels = await card
        .locator('.row-actions button')
        .evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')));
      expect(labels[0]).toBe('Edit');
      expect(labels[2]).toBe('Delete');
      // Edit opens the name step of the product page.
      await card.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.waitForURL(new RegExp(`products/${key}\\?step=1`));
      await page.goBack();
      // Delete asks for the name, then the card is gone.
      await card.hover();
      await card.getByRole('button', { name: 'Delete', exact: true }).click();
      const modal = page.locator('.ant-modal-content');
      await modal.locator('input').fill('TESTING e2e card actions');
      await modal
        .getByRole('button', { name: /Delete/ })
        .last()
        .click();
      await expect(card).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await request.delete(`${API}/bank-programs/surrogate-products/${key}`, { headers });
    }
  });
});

test.describe('figures step', () => {
  test('a table not stated yet folds like the others, and opening it changes nothing', async ({
    page,
    request,
  }) => {
    const errors = watchErrors(page);
    const headers = { authorization: `Bearer ${await apiToken(request)}` };
    const products = `${API}/bank-programs/surrogate-products`;
    const name = `TESTING e2e plan rows ${test.info().project.name}`;
    const made = await request.post(products, {
      headers,
      data: { labelEn: name, labelAr: name, startFrom: 'copy', sourceKey: 'doctors_in_practice' },
    });
    const key = ((await made.json()) as { data: { key: string } }).data.key;
    try {
      await signIn(page);
      await page.goto(`/program-catalog/products/${key}?step=4`);
      const rows = page.locator('.plan-slot > .plan-row');
      await expect(rows).toHaveCount(5);
      await expect(page.getByText(/^State a /)).toHaveCount(0);
      const second = rows.nth(1);
      await expect(second).toHaveAttribute('aria-expanded', 'false');
      await second.click();
      await expect(second).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.plan-slot').nth(1).locator('app-fact-grid-editor')).toBeVisible();
      await expect(page.locator('.save-bar')).toHaveCount(0);
      await second.click();
      await expect(second).toHaveAttribute('aria-expanded', 'false');
      // Typed into and not finished: it still closes, and the closed row says so.
      await second.click();
      const box = page.locator('.plan-slot').nth(1).locator('.plan-body input').last();
      await box.click();
      await page.keyboard.type('60', { delay: 50 });
      // Typed key by key: the box keeps the focus and the whole number.
      await expect(box).toHaveValue('60');
      await expect(page.locator('.save-bar')).toContainText(
        'Finish or clear the Longest term table',
      );
      await second.click();
      await expect(second).toHaveAttribute('aria-expanded', 'false');
      await expect(second.locator('.plan-row-state')).toHaveText('Not finished');
      // Cleared again: back to not set, and nothing left to save.
      await second.click();
      await box.fill('');
      await box.blur();
      await expect(page.locator('.save-bar')).toHaveCount(0);
      await expect(second.locator('.plan-row-state')).toHaveText('Not set');
      expect(errors).toEqual([]);
    } finally {
      await request.delete(`${products}/${key}`, { headers });
    }
  });
});

test.describe('questions library', () => {
  test('searches the pool and opens a question', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await page.goto('/questionnaire/questions');
    const search = page.getByPlaceholder('Search questions, answers, or codes');
    await expect(search).toBeVisible();
    await search.fill('governorate');
    const row = page.getByText('Which governorate do you live in?').first();
    await expect(row).toBeVisible();
    await page.goto('/questionnaire/questions?q=residence_governorate');
    await expect(page.getByRole('textbox', { name: 'English' }).first()).toHaveValue(
      'Which governorate do you live in?',
    );
    expect(errors).toEqual([]);
  });
});

test.describe('matching simulator filters', () => {
  test('loan type, program and age are set before the questions', async ({ page }) => {
    await signIn(page);
    await page.goto('/matching-simulator');
    await expect(page.getByRole('radiogroup', { name: 'Loan type' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Auto Loan' })).toBeVisible();
    const age = page.getByRole('textbox', { name: 'Age' });
    await expect(age).toHaveValue('35');
    await age.fill('12');
    await expect(page.getByRole('alert').filter({ hasText: 'Between 18 and 80' })).toBeVisible();
    await age.fill('40');
    await expect(page.getByRole('alert').filter({ hasText: 'Between 18 and 80' })).toHaveCount(0);
    // A program picks its own questions (a question has no loan type): the count moves.
    const count = async () => (await page.locator('.progress-text').innerText()).trim();
    const before = await count();
    await page.locator('.filter-select').click();
    await page.locator('.ant-select-item-option').nth(1).click();
    await expect.poll(count).not.toBe(before);
    expect(await overflowX(page)).toBe(0);
  });
});
