/**
 * The decisions `seed:sheet-figures` makes before it writes anything.
 *
 * The one that matters is `skip`: an operator's own figures must survive a re-run, and the
 * only way to be sure of that without a database is to test the decision on its own.
 */
import { describe, expect, it } from 'vitest';
import {
  blankSlots,
  countFigureLeaves,
  planCatalogFigures,
  planProgram,
  planProgramName,
  programFingerprint,
} from '@/bank-programs/demo-figures/sheet-figures.plan';
import { CATALOG_FIGURES, PROGRAM_NAMES } from '@/bank-programs/demo-figures/sheet-figures';
import { SHEET_PROGRAMS } from '@/bank-programs/demo-figures/sheet-programs';
import { productBlueprint } from '@/bank-programs/blueprints/product-blueprints';
import { compileTemplate } from '@/matching/pipeline/product-template';
import { paramKeysOf } from '@/matching/pipeline/product-rule';

describe('countFigureLeaves', () => {
  it('counts a decimal STRING, because that is how money crosses every hop', () => {
    expect(countFigureLeaves({ primary: { keyTable: [{ key: 'a', incomeEGP: '30000' }] } })).toBe(1);
  });

  it('does not count a label, a key or an empty string as a figure', () => {
    expect(countFigureLeaves({ key: 'grade_major', unit: 'percent', value: '' })).toBe(0);
  });

  it('walks bands, scalars and nested slots alike', () => {
    expect(
      countFigureLeaves({
        primary: { bands: [{ fromInclusive: '3', toExclusive: '5', incomeEGP: '30000' }] },
        alt: { scalar: { value: '10', unit: 'percent' } },
      }),
    ).toBe(4);
  });
});

describe('planCatalogFigures', () => {
  it('writes when the product holds nothing', () => {
    expect(
      planCatalogFigures({ productKey: 'p', stored: { stepParams: {} }, force: false }),
    ).toEqual({ kind: 'write', productKey: 'p' });
  });

  it('LEAVES ALONE a product somebody has already typed figures into', () => {
    expect(
      planCatalogFigures({
        productKey: 'p',
        stored: { stepParams: { primary: { scalar: { value: '15', unit: 'percent' } } } },
        force: false,
      }),
    ).toEqual({ kind: 'skip', productKey: 'p', figures: 1 });
  });

  it('overwrites the same product only when told to', () => {
    expect(
      planCatalogFigures({
        productKey: 'p',
        stored: { stepParams: { primary: { scalar: { value: '15', unit: 'percent' } } } },
        force: true,
      }),
    ).toEqual({ kind: 'write', productKey: 'p' });
  });

  it('reports a missing product instead of creating one — products are seeded, not minted here', () => {
    expect(planCatalogFigures({ productKey: 'p', stored: null, force: false })).toEqual({
      kind: 'absent',
      productKey: 'p',
    });
  });
});

describe('planProgramName / planProgram', () => {
  it('reuses a name that exists rather than duplicating it', () => {
    expect(planProgramName({ key: 'compound_owner_4', exists: true })).toEqual({
      kind: 'reuse',
      key: 'compound_owner_4',
    });
  });

  it('updates a program matched by its code, carrying the optimistic-lock version', () => {
    expect(
      planProgram({
        programCode: 'ABK-PER-ARMED_FORCES',
        stored: { version: 3, fingerprint: 'stored' },
        fingerprint: 'incoming',
        force: false,
      }),
    ).toEqual({ kind: 'update', programCode: 'ABK-PER-ARMED_FORCES', version: 3 });
  });

  it('leaves a program alone when the body is identical — a re-run writes nothing', () => {
    // `update` is a full-replacement PUT: it bumps the version and writes an audit event, so
    // re-posting the same body on every deploy would fill the log with diffs nobody made.
    expect(
      planProgram({
        programCode: 'ABK-PER-ARMED_FORCES',
        stored: { version: 3, fingerprint: 'same' },
        fingerprint: 'same',
        force: false,
      }),
    ).toEqual({ kind: 'unchanged', programCode: 'ABK-PER-ARMED_FORCES' });
  });

  it('overwrites an identical program only when told to', () => {
    expect(
      planProgram({
        programCode: 'ABK-PER-ARMED_FORCES',
        stored: { version: 3, fingerprint: 'same' },
        fingerprint: 'same',
        force: true,
      }),
    ).toEqual({ kind: 'update', programCode: 'ABK-PER-ARMED_FORCES', version: 3 });
  });

  it('fingerprints only the fields this seed owns, so an edited note is not a difference', () => {
    const a = programFingerprint({ tenor: { minMonths: 6 }, fees: { adminFeePercent: '2' } });
    const b = programFingerprint({ fees: { adminFeePercent: '2' }, tenor: { minMonths: 6 } });
    expect(a).toBe(b);
  });
});

describe('blankSlots', () => {
  const rule = compileTemplate(productBlueprint('pledged_collateral_share')!.template!);

  it('names the box with no figure in it, and not the steps that take none', () => {
    // `src__pledged_free_amount` reads an answer and `primary` takes the percentage. Only one
    // of the two is a box anybody types into.
    expect(blankSlots({ rule, stepParams: {}, gatesExpectedBlank: true })).toEqual(['primary']);
  });

  it('reports a program gate the bank left blank', () => {
    expect(
      blankSlots({
        rule,
        stepParams: { primary: { scalar: { value: '30', unit: 'percent' } } },
        gatesExpectedBlank: false,
      }),
    ).toEqual(['cond__heldlongenough']);
  });

  it('does not report a catalog gate as blank — a gate default is a live refusal rule', () => {
    expect(
      blankSlots({
        rule,
        stepParams: { primary: { scalar: { value: '30', unit: 'percent' } } },
        gatesExpectedBlank: true,
      }),
    ).toEqual([]);
  });

  it('reads a fully configured program as empty-handed', () => {
    expect(
      blankSlots({
        rule,
        stepParams: {
          primary: { scalar: { value: '30', unit: 'percent' } },
          cond__heldlongenough: { minValue: '3' },
        },
        gatesExpectedBlank: false,
      }),
    ).toEqual([]);
  });
});

describe('the data this seed carries', () => {
  it('names a real product for every catalog figure set', () => {
    for (const set of CATALOG_FIGURES) {
      expect(productBlueprint(set.productKey), set.productKey).toBeDefined();
    }
  });

  it('states a baseline debt burden for every CEILING product and no other', () => {
    for (const set of CATALOG_FIGURES) {
      const template = productBlueprint(set.productKey)?.template;
      const isCeiling = template?.outputKind === 'maxAmount';
      expect(set.baselineDbrPercent !== undefined, set.productKey).toBe(isCeiling);
    }
  });

  it('writes no figure into a slot the compiled rule does not own', () => {
    // The failure this catches is silent and total: a slot id that does not exist is refused
    // as `unknown_param_key`, and one that exists under a different name is a figure the
    // engine never reads.
    for (const set of CATALOG_FIGURES) {
      const template = productBlueprint(set.productKey)!.template!;
      const owned = new Set(paramKeysOf(compileTemplate(template)));
      for (const slot of Object.keys(set.stepParams)) {
        expect(owned.has(slot), `${set.productKey}.${slot}`).toBe(true);
      }
    }
  });

  it('states a condition at the floor a sheet publishes, never a figure with no sheet behind it', () => {
    // A catalog condition is LIVE for any bank on `amounts: 'catalog'`, so the ones stated are
    // pinned here: a later edit that tightened one would change what an inheriting bank
    // refuses, silently, on every applicant.
    const compound = CATALOG_FIGURES.find((set) => set.productKey === 'compound_owner');
    expect(compound?.stepParams['cond__ownedlongenough']).toEqual({ minValue: '18' });
    expect(compound?.stepParams['cond__unitworthenough']).toEqual({ minValue: '1000000' });
    expect(compound?.stepParams['cond__paidenough__bound']).toEqual({
      scalar: { value: '30', unit: 'percent' },
    });
  });

  it('leaves every OTHER product stating no condition, because no sheet of theirs prints one', () => {
    for (const set of CATALOG_FIGURES) {
      if (set.productKey === 'compound_owner') continue;
      for (const slot of Object.keys(set.stepParams)) {
        expect(slot.startsWith('cond__'), `${set.productKey}.${slot}`).toBe(false);
      }
    }
  });

  it('fills both columns of a one-column sheet with the same figures, never one of them', () => {
    // A blank second column works — the pick falls back — but it reads as unfinished, and the
    // sheet's own claim is that the kind of university does not change the figure.
    const abk = SHEET_PROGRAMS.find((spec) => spec.programCode === 'ABK-PER-PROFESSORS');
    const params = abk!.dto.incomeAssumption.stepParams as Record<string, { keyTable?: unknown }>;
    expect(params['primary']?.keyTable).toEqual(params['primary__uni_private']?.keyTable);
  });

  it('files every surrogate program under a name this seed creates or already exists', () => {
    const created = new Set([...PROGRAM_NAMES.map((name) => name.key), 'compound_owner_4']);
    for (const spec of SHEET_PROGRAMS) {
      if (spec.dto.programType !== 'income_surrogate') continue;
      expect(created.has(spec.dto.programNameKey), spec.dto.programCode).toBe(true);
    }
  });

  it('gives every program a unique code', () => {
    const codes = SHEET_PROGRAMS.map((spec) => spec.dto.programCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('writes a bank program figure only into a slot its product owns', () => {
    const productByName = new Map<string, string>([
      ['compound_owner_4', 'compound_owner'],
      ...PROGRAM_NAMES.map((name) => [name.key, name.productKey] as const),
    ]);
    for (const spec of SHEET_PROGRAMS) {
      if (spec.dto.programType !== 'income_surrogate') continue;
      const productKey = productByName.get(spec.dto.programNameKey)!;
      const owned = new Set(paramKeysOf(compileTemplate(productBlueprint(productKey)!.template!)));
      for (const slot of Object.keys(spec.dto.incomeAssumption.stepParams ?? {})) {
        expect(owned.has(slot), `${spec.dto.programCode}.${slot}`).toBe(true);
      }
    }
  });
});

describe('the two ABK doctor sheets are two products', () => {
  // Spec §10.7 read them as two programmes of one product, because they band years in
  // practice identically and only the figures differ — and figures belong to a bank. The
  // terms differ too: 26.5% against 30%, an age floor of 32 against 21, a maximum of
  // 2,000,000 against 1,000,000, opposite accepted employment types, and a cap on §7 and
  // none on §8. So each sheet gets its own product and its own catalog name, and the doctor
  // states which is theirs by picking one — the job an ownership question and two gate
  // conditions used to do inside the merged product.
  const DOCTORS = SHEET_PROGRAMS.filter((program) => program.sheet.includes('Doctors'));

  it('finds both sheets', () => {
    expect(DOCTORS.map((program) => program.programCode).sort()).toEqual([
      'ABK-PER-DOCTORS_CLINIC',
      'ABK-PER-DOCTORS_PRACTICE',
    ]);
  });

  it('gives each its own catalog name, and each name its own product', () => {
    // The name is what narrows the programmes an application is matched against, so two
    // names is what lets the applicant's pick separate them. One shared name would put both
    // back in front of every doctor.
    expect(
      Object.fromEntries(DOCTORS.map((program) => [program.programCode, program.dto.programNameKey])),
    ).toEqual({
      'ABK-PER-DOCTORS_CLINIC': 'doctors_clinic_owner',
      'ABK-PER-DOCTORS_PRACTICE': 'doctors_in_practice',
    });
    for (const key of ['doctors_clinic_owner', 'doctors_in_practice']) {
      expect(PROGRAM_NAMES.find((entry) => entry.key === key)?.productKey).toBe(key);
    }
  });

  it('labels the two names so a doctor can tell which is theirs', () => {
    // Nothing else enforces the pick now, so a name reading plain "Doctors" in either locale
    // is the defect — and it is the label this repo shipped while they shared one name.
    for (const key of ['doctors_clinic_owner', 'doctors_in_practice']) {
      const name = PROGRAM_NAMES.find((entry) => entry.key === key);
      expect(name?.labelEn).not.toBe('Doctors');
      expect(name?.labelAr).not.toBe('الأطباء');
    }
  });

  it('gives each programme its own figures', () => {
    const [first, second] = DOCTORS;
    expect(JSON.stringify(first?.dto.incomeAssumption)).not.toBe(
      JSON.stringify(second?.dto.incomeAssumption),
    );
  });

  it('caps only the sheet that publishes a cap', () => {
    // §7 prints a maximum by city tier x NTB/Top-up; §8 prints none, and a bank that does not
    // sell a column leaves it blank rather than inheriting somebody else's ceiling.
    const withCap = DOCTORS.filter(
      (program) => program.dto.loanLimits?.maxLoanByFact !== undefined,
    );
    expect(withCap.map((program) => program.programCode)).toEqual(['ABK-PER-DOCTORS_CLINIC']);
  });

  it('refuses to quote §7 when the city is unstated, rather than capping at the best cell', () => {
    // The question is required, so this is a stale-snapshot path — but `useProgramMax` there
    // would hand a doctor whose city nobody knows the programme maximum, 2,000,000, which is
    // the top-up Cairo cell. A stated refusal is the only honest answer.
    const clinic = DOCTORS.find((p) => p.programCode === 'ABK-PER-DOCTORS_CLINIC');
    expect(clinic?.dto.loanLimits?.maxLoanByFact?.onNoMatch).toBe('reject');
  });

  it('gates on nothing at all — the name pick is what separates them', () => {
    // Two conditions on the merged product used to do this, read off an OPTIONAL question
    // while an unanswered gate fact is fatal: a doctor who skipped it was refused by both
    // programmes. Neither programme may carry one now.
    for (const program of DOCTORS) {
      const params = (
        program.dto.incomeAssumption as { stepParams?: Record<string, unknown> } | undefined
      )?.stepParams;
      expect(Object.keys(params ?? {}).filter((id) => id.startsWith('cond__'))).toEqual([]);
    }
  });

  it('gives the in-practice sheet one income slot, not three', () => {
    // The merged product carried a city-tier column §8 does not use, so this programme held
    // the identical figures in three slots and read as pricing by city.
    const practice = DOCTORS.find((p) => p.programCode === 'ABK-PER-DOCTORS_PRACTICE');
    const params = (
      practice?.dto.incomeAssumption as { stepParams?: Record<string, unknown> } | undefined
    )?.stepParams;
    expect(Object.keys(params ?? {}).sort()).toEqual(['primary']);
  });

  it('leaves every condition blank on the CATALOG defaults', () => {
    // A catalog default rides on every bank that inherits the amounts, so a condition turned
    // on here would be a refusal rule those banks never chose. Blank IS the decision.
    const catalog = CATALOG_FIGURES.find((entry) => entry.productKey === 'doctors_clinic_owner');
    expect(Object.keys(catalog?.stepParams ?? {}).filter((id) => id.startsWith('cond__'))).toEqual(
      [],
    );
  });
});
