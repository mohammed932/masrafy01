import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API, apiToken, signIn, watchErrors } from './support';

/**
 * REBUILD the existing no-payslip products from the screens alone (2026-11-09).
 *
 * For each product the income is worked out from (DBR always), the test builds a TESTING
 * product through the admin exactly as an operator would — name, questions, calculation — and
 * proves the screens are still enough to say what the product says:
 *
 *   · STRUCTURE: the rebuilt calculation states the same way(s) as an exact copy of the original
 *     (main question and way, other ways and how a bank uses them, the second column);
 *   · MONEY: given the same figures and the same answers, the engine quotes both the same.
 *
 * What a screen deliberately does not author is left out of both sides and named in the case:
 * conditions (a bank turns them on with its own figures) and a column carried by ONE way (the
 * down-payment product's cash buyers — library-authored only). The three products that set a
 * maximum loan instead of an income are not here: DBR always.
 */

const PRODUCTS = `${API}/bank-programs/surrogate-products`;

type Answer = { factKey: string; value?: string; optionCode?: string };
type Template = Record<string, unknown> & {
  primary: { kind: string; fact?: string };
  alternatives?: { kind: string; fact?: string; column?: unknown }[];
  secondColumn?: { fact: string; branches: string[]; branchOn?: string; groups?: unknown[] };
  combine?: string;
  waysAre?: string;
  conditions?: unknown[];
};

interface Case {
  source: string;
  /** Questions the product asks of its own (fixed ones are already there). */
  questions: string[];
  main: { fact: string; way?: string };
  column?: { fact: string; branches: number };
  groups?: { names: string[]; place: Record<string, number> };
  otherWay?: { kind: string; fact: string; waysAre: 'exclusive' | 'combined'; combine: string };
  /** What the screens do not author, taken off the reference copy too. */
  strip?: ('conditions' | 'wayColumns')[];
  /** Figures to state when the original states none for a slot. */
  figures?: Record<string, unknown>;
  /** Slot ids on the original → on the rebuild, where they are named differently. */
  rename?: Record<string, string>;
  answers: Answer[][];
}

const band = (a: string, b: string, c: string) => ({
  bands: [
    { fromInclusive: '0', toExclusive: '8', incomeEGP: a },
    { fromInclusive: '8', toExclusive: '12', incomeEGP: b },
    { fromInclusive: '12', toExclusive: null, incomeEGP: c },
  ],
});

const CASES: Case[] = [
  {
    source: 'armed_forces_grades',
    questions: ['Military grade'],
    main: { fact: 'Military grade' },
    answers: [
      [{ factKey: 'military_grade', optionCode: 'grade_colonel' }],
      [{ factKey: 'military_grade', optionCode: 'grade_major_general' }],
    ],
  },
  {
    source: 'academic_rank_table',
    questions: ['Academic rank', 'Is the university government or private?'],
    main: { fact: 'Academic rank' },
    column: { fact: 'Is the university government or private?', branches: 2 },
    answers: [
      [
        { factKey: 'academic_rank', optionCode: 'lecturer' },
        { factKey: 'university_type', optionCode: 'uni_government' },
      ],
      [
        { factKey: 'academic_rank', optionCode: 'lecturer' },
        { factKey: 'university_type', optionCode: 'uni_private' },
      ],
    ],
  },
  {
    source: 'doctors_in_practice',
    questions: ['Years in practice'],
    main: { fact: 'Years in practice', way: 'A figure for each range' },
    strip: ['conditions'],
    figures: { primary: band('20000', '30000', '42500') },
    answers: [
      [{ factKey: 'years_in_practice', value: '10' }],
      [{ factKey: 'years_in_practice', value: '15' }],
    ],
  },
  {
    source: 'doctors_clinic_owner',
    questions: ['Years in practice', 'Which governorate do you work in?'],
    main: { fact: 'Years in practice', way: 'A figure for each range' },
    // The shared city tiers, rebuilt as the product's own three groups.
    groups: {
      names: ['Major', 'Secondary', 'Other'],
      place: { Cairo: 0, Alexandria: 0, Giza: 1, Aswan: 2 },
    },
    rename: {
      primary__city_tier_secondary: 'primary__g2',
      primary__city_tier_other: 'primary__g3',
    },
    answers: [
      [
        { factKey: 'years_in_practice', value: '10' },
        { factKey: 'practice_governorate', optionCode: 'cairo' },
      ],
      [
        { factKey: 'years_in_practice', value: '10' },
        { factKey: 'practice_governorate', optionCode: 'giza' },
      ],
      [
        { factKey: 'years_in_practice', value: '10' },
        { factKey: 'practice_governorate', optionCode: 'aswan' },
      ],
    ],
  },
  {
    source: 'card_limit_share',
    // Read off a FIXED question — the Calculation lists those too.
    questions: [],
    main: { fact: 'Credit card limit', way: 'A percentage of the answer' },
    answers: [[{ factKey: 'credit_card_limit', value: '100000' }]],
  },
  {
    source: 'pledged_collateral_share',
    questions: ['How much is the certificate or deposit you would pledge?'],
    main: {
      fact: 'How much is the certificate or deposit you would pledge?',
      way: 'A percentage of the answer',
    },
    strip: ['conditions'],
    answers: [[{ factKey: 'pledged_free_amount', value: '200000' }]],
  },
  {
    source: 'auto_loan_crosssell',
    questions: ['How much was the car loan when it started?'],
    main: { fact: 'Monthly car loan instalment', way: 'A multiple of the answer' },
    otherWay: {
      kind: 'shareOf',
      fact: 'How much was the car loan when it started?',
      waysAre: 'combined',
      combine: 'lower',
    },
    strip: ['conditions'],
    answers: [
      [
        { factKey: 'car_loan_installment', value: '5000' },
        { factKey: 'auto_loan_amount', value: '300000' },
      ],
      [
        { factKey: 'car_loan_installment', value: '20000' },
        { factKey: 'auto_loan_amount', value: '100000' },
      ],
    ],
  },
  {
    source: 'down_payment_income',
    questions: ['How much is your down payment?', 'How much have you saved in total?'],
    main: { fact: 'Car Down payment', way: 'The answer divided by a figure' },
    otherWay: { kind: 'dividedBy', fact: 'Total savings', waysAre: 'exclusive', combine: '' },
    strip: ['wayColumns'],
    answers: [
      [
        { factKey: 'car_down_payment', value: '360000' },
        { factKey: 'total_savings', value: '500000' },
      ],
      [
        { factKey: 'car_down_payment', value: '120000' },
        { factKey: 'total_savings', value: '900000' },
      ],
    ],
  },
];

/** The parts of a calculation a rebuild must say the same, in one comparable shape. */
function shape(t: Template) {
  return {
    primary: { kind: t.primary.kind, fact: t.primary.fact },
    alternatives: (t.alternatives ?? []).map((w) => ({ kind: w.kind, fact: w.fact })),
    waysAre: (t.alternatives ?? []).length > 0 ? (t.waysAre ?? 'exclusive') : undefined,
    combine: t.combine ?? undefined,
    column: t.secondColumn
      ? { fact: t.secondColumn.fact, count: t.secondColumn.branches.length }
      : undefined,
  };
}

async function api(request: APIRequestContext) {
  const headers = { authorization: `Bearer ${await apiToken(request)}` };
  const get = async (key: string) =>
    (await (await request.get(`${PRODUCTS}/${key}/template`, { headers })).json()).data as {
      template: Template;
      compiled: { steps: { id: string }[]; stepParams?: Record<string, unknown> };
    };
  const put = (key: string, template: Template, stepParams: Record<string, unknown>) =>
    request.put(`${PRODUCTS}/${key}/template`, { headers, data: { template, stepParams } });
  const check = async (key: string, answers: Answer[]) =>
    (await (await request.post(`${PRODUCTS}/${key}/check`, { headers, data: { answers } })).json())
      .data as { ok: boolean; valueEGP?: string };
  const clear = async (name: string) => {
    const listed = (await (await request.get(PRODUCTS, { headers })).json()).data as {
      key: string;
      labelEn: string;
    }[];
    for (const row of listed) {
      if (row.labelEn === name) await request.delete(`${PRODUCTS}/${row.key}`, { headers });
    }
  };
  const copy = async (source: string, name: string) => {
    await clear(name);
    const made = await request.post(PRODUCTS, {
      headers,
      data: { labelEn: name, labelAr: name, startFrom: 'copy', sourceKey: source },
    });
    expect(made.ok()).toBeTruthy();
    return ((await made.json()) as { data: { key: string } }).data.key;
  };
  const remove = (key: string) => request.delete(`${PRODUCTS}/${key}`, { headers });
  return { get, put, check, clear, copy, remove };
}

async function build(page: Page, c: Case, name: string): Promise<string> {
  await page.goto('/program-catalog/products/new');
  await page.fill('#np-name-en', name);
  await page.fill('#np-name-ar', name);
  await page.getByRole('button', { name: 'Create and continue' }).click();
  await page.waitForURL(/\?step=2/);
  const key = new URL(page.url()).pathname.split('/').pop()!;

  // ① Questions.
  await expect(page.locator('app-served-pages')).toBeVisible();
  if (c.questions.length > 0) {
    await page.getByRole('button', { name: 'Add a question' }).last().click();
    const sheet = page.locator('.ant-drawer-content');
    await expect(sheet).toBeVisible();
    for (const q of c.questions) {
      await sheet.locator('input').first().fill(q);
      await sheet.locator('li.row', { hasText: q }).first().getByRole('button').click();
    }
    await sheet.getByRole('button', { name: 'Done' }).click();
  }

  // ② Calculation.
  await page.locator('app-wizard-steps').getByText('Calculation').click();
  const main = page.locator('app-product-template-page select').first();
  await main.selectOption({ label: c.main.fact });
  if (c.main.way) await page.getByRole('radio', { name: c.main.way }).check();

  if (c.column || c.groups || c.otherWay) {
    await page.locator('summary', { hasText: 'More options' }).click();
  }
  if (c.otherWay) {
    await page
      .locator('label.addon-head', { hasText: 'Other ways to reach the figure' })
      .locator('input')
      .check();
    const way = page.locator('[formarrayname="alternatives"] [formcontrolname="kind"]').first();
    await way.selectOption(c.otherWay.kind);
    await page
      .locator('[formarrayname="alternatives"] [formcontrolname="fact"]')
      .first()
      .selectOption({ label: c.otherWay.fact });
    await page.locator('select[formcontrolname="waysAre"]').selectOption(c.otherWay.waysAre);
    await page.locator('select[formcontrolname="combine"]').selectOption(c.otherWay.combine);
  }
  if (c.column || c.groups) {
    await page.locator('label.addon-head', { hasText: 'A second column' }).locator('input').check();
  }
  if (c.column) {
    await page.locator('select[formcontrolname=columnFact]').selectOption({ label: c.column.fact });
    const ticks = page
      .locator('.addon', { hasText: 'A second column' })
      .locator('.ticks input[type=checkbox]');
    for (let i = 0; i < c.column.branches; i++) await ticks.nth(i).check();
  }
  if (c.groups) {
    await page
      .locator('select[formcontrolname=columnFact]')
      .selectOption({ label: 'Governorate of practice' });
    await page.getByText('Put the answers in groups').click();
    for (const [i, n] of c.groups.names.entries()) {
      await page.getByRole('button', { name: 'Add a group' }).click();
      const row = page.locator('.group-row').nth(i);
      await row.locator('input').nth(0).fill(n);
      await row.locator('input').nth(1).fill(n);
    }
    for (const [city, g] of Object.entries(c.groups.place)) {
      await page
        .locator('.placement', { hasText: city })
        .locator('select')
        .selectOption({ label: c.groups.names[g]! });
    }
  }
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.save-bar')).toHaveCount(0);
  return key;
}

test.describe('rebuild every income product from the screens', () => {
  test.setTimeout(180_000);

  for (const c of CASES) {
    test(`${c.source}: built from the screens, it states and quotes what the original does`, async ({
      page,
      request,
    }) => {
      const errors = watchErrors(page);
      const a = await api(request);
      const suffix = test.info().project.name;
      const refName = `TESTING e2e ref ${c.source} ${suffix}`;
      const newName = `TESTING e2e rebuild ${c.source} ${suffix}`;
      await a.clear(newName);
      const ref = await a.copy(c.source, refName);
      let built: string | null = null;
      try {
        // The reference: an exact copy, minus only what no screen authors.
        const r = await a.get(ref);
        const refTemplate: Template = { ...r.template };
        if (c.strip?.includes('conditions')) refTemplate.conditions = [];
        if (c.strip?.includes('wayColumns')) {
          refTemplate.alternatives = (refTemplate.alternatives ?? []).map((w) => {
            const rest = { ...w };
            delete rest.column;
            return rest;
          });
        }

        await signIn(page);
        built = await build(page, c, newName);
        const b = await a.get(built);

        // STRUCTURE.
        expect(shape(b.template)).toEqual(shape(refTemplate));

        // MONEY: the same figures on both, then the same answers.
        const figures: Record<string, unknown> = {
          ...(r.compiled.stepParams ?? {}),
          ...(c.figures ?? {}),
        };
        const refIds = new Set((await a.get(ref)).compiled.steps.map((s) => s.id));
        const refRes = await a.put(ref, refTemplate, figures);
        expect(refRes.ok(), await refRes.text()).toBeTruthy();
        const refAfter = await a.get(ref);
        const refFigures = refAfter.compiled.stepParams ?? {};
        const builtIds = new Set(b.compiled.steps.map((s) => s.id));
        const builtFigures: Record<string, unknown> = {};
        for (const [id, value] of Object.entries(refFigures)) {
          const target = c.rename?.[id] ?? id;
          if (builtIds.has(target)) builtFigures[target] = value;
        }
        expect(Object.keys(builtFigures).length).toBeGreaterThan(0);
        expect(refIds.size).toBeGreaterThan(0);
        const builtRes = await a.put(built, b.template, builtFigures);
        expect(builtRes.ok(), await builtRes.text()).toBeTruthy();

        for (const answers of c.answers) {
          const want = await a.check(ref, answers);
          const got = await a.check(built, answers);
          expect(want.ok, JSON.stringify(want)).toBe(true);
          expect(got, JSON.stringify(answers)).toEqual(want);
        }
        expect(errors).toEqual([]);
      } finally {
        if (built) await a.remove(built);
        await a.remove(ref);
      }
    });
  }
});
