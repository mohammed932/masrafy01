/**
 * The two ABK doctor sheets are two PRODUCTS, and the applicant's own pick is what separates
 * them.
 *
 * App. A §7 and §8 band years in practice identically, which is why they were one product for
 * several versions — the difference read as figures only, and figures belong to a bank. Read
 * side by side the terms differ too: 26.5% against 30%, an age floor of 32 against 21, a
 * maximum of 2,000,000 against 1,000,000, opposite accepted employment types, and a cap keyed
 * by where the doctor practises on one sheet against no cap at all on the other. The merged
 * product could not carry that, so it grew an `owns_practice` question and two gate conditions
 * whose only job was to stop both programmes quoting every doctor.
 *
 * Splitting the product gives each half its own catalog name, and the name a doctor picks is
 * what narrows the programmes their application is matched against — so the gate is gone.
 *
 * What this file pins is the shape difference (asserted as an ABSENCE on the in-practice side,
 * so a copy-paste of the clinic-owner template fails), the fact that neither product gates on
 * ownership any more, and the two figure sets a real applicant gets from each.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { compileTemplate } from '@/matching/pipeline/product-template';
import { evaluateProductRule } from '@/matching/pipeline/product-rule';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import {
  productBlueprint,
  productBlueprints,
  sharedBlueprintFactKeys,
} from '@/bank-programs/blueprints/product-blueprints';
import type { SurrogateFactValue } from '@/matching/types';

const CLINIC_KEY = 'doctors_clinic_owner';
const PRACTICE_KEY = 'doctors_in_practice';

const choice = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });
const number = (value: string): SurrogateFactValue => ({
  kind: 'numeric',
  value: new Decimal(value),
});

const blueprintOf = (key: string) => {
  const found = productBlueprint(key);
  if (!found) throw new Error(`no blueprint keyed ${key}`);
  return found;
};

const ruleOf = (key: string) => compileTemplate(blueprintOf(key).template!);

/** ABK's own band edges, with §7's figures on one programme and §8's — exactly half — on the other. */
const BANDS = (figures: readonly string[]) => ({
  bands: [
    { fromInclusive: '3', toExclusive: '5', incomeEGP: figures[0] },
    { fromInclusive: '5', toExclusive: '8', incomeEGP: figures[1] },
    { fromInclusive: '8', toExclusive: '11', incomeEGP: figures[2] },
    { fromInclusive: '11', toExclusive: '14', incomeEGP: figures[3] },
    { fromInclusive: '14', toExclusive: '20', incomeEGP: figures[4] },
    { fromInclusive: '20', toExclusive: null, incomeEGP: figures[5] },
  ],
});

const CLINIC_FIGURES = ['30000', '60000', '80000', '120000', '180000', '300000'] as const;
const PRACTICE_FIGURES = ['15000', '30000', '40000', '60000', '90000', '150000'] as const;

/** As `sheet-programs.ts` seeds them: three identical income columns on one, one slot on the other. */
const CLINIC_PARAMS: ProductRule['stepParams'] = {
  primary: BANDS(CLINIC_FIGURES),
  primary__city_tier_secondary: BANDS(CLINIC_FIGURES),
  primary__city_tier_other: BANDS(CLINIC_FIGURES),
};
const PRACTICE_PARAMS: ProductRule['stepParams'] = { primary: BANDS(PRACTICE_FIGURES) };

const FILED = { cairo: 'city_tier_major', tanta: 'city_tier_secondary' };

function run(
  key: string,
  stepParams: ProductRule['stepParams'],
  facts: Record<string, SurrogateFactValue>,
) {
  return evaluateProductRule({ ...ruleOf(key), stepParams }, { facts, parentKeyByValue: FILED });
}

describe('two doctor products, not one', () => {
  it('registers both, under their own keys, and no merged one', () => {
    expect(productBlueprint('years_in_practice_bands')).toBeUndefined();
    expect(blueprintOf(CLINIC_KEY).group).toBe('income');
    expect(blueprintOf(PRACTICE_KEY).group).toBe('income');
  });

  it('names each after its own sheet, in both locales', () => {
    // The labels are the WHOLE defence now: nothing stops a clinic owner picking the
    // in-practice name and being quoted half. So neither may read as plain "Doctors".
    for (const key of [CLINIC_KEY, PRACTICE_KEY]) {
      const bp = blueprintOf(key);
      expect(bp.labelEn).not.toBe('Doctors');
      expect(bp.labelAr).not.toBe('الأطباء');
    }
    expect(blueprintOf(CLINIC_KEY).labelEn).not.toBe(blueprintOf(PRACTICE_KEY).labelEn);
    expect(blueprintOf(CLINIC_KEY).labelAr).not.toBe(blueprintOf(PRACTICE_KEY).labelAr);
  });

  it('never reads the ownership answer again, and gates only on what a sheet prints', () => {
    // The CLINIC product still states no condition: §7 prints none, and the split is what
    // removed the need for one.
    expect(blueprintOf(CLINIC_KEY).template!.conditions).toEqual([]);
    expect(blueprintOf(CLINIC_KEY).usesReasonCodes ?? []).toEqual([]);

    // The IN-PRACTICE product has exactly one, and it is the sheet's own sentence: "private
    // hospitals only, not governmental". Asserted here rather than left off the list because
    // this file is where somebody comes to check the two products cannot drift back into one
    // — and a condition that told them apart is precisely what was deleted. This one does
    // not: it names the hospital SECTOR, which §7 says nothing about.
    const practice = blueprintOf(PRACTICE_KEY);
    expect(practice.template!.conditions.map((c) => c.id)).toEqual(['privatehospitalonly']);
    expect(practice.template!.conditions[0]!.measure).toEqual({
      of: 'fact',
      fact: 'hospital_sector',
    });
    // The exempting answer is allow-listed beside the passing one. Without it the condition
    // would refuse every applicant who does not work at a hospital, which is nearly all of
    // them — the `owns_practice` failure, rebuilt.
    expect(practice.template!.conditions[0]!.test).toEqual({
      op: 'oneOf',
      expect: ['private_hospital', 'not_at_a_hospital'],
    });

    // The retired ownership question is read by NOBODY, which is the absence that matters.
    const asksOwnership = productBlueprints().filter((bp) =>
      bp.asks.some((ask) => ask.factKey === 'owns_practice'),
    );
    expect(asksOwnership).toEqual([]);
  });

  it('shares the years fact, so neither product owns it', () => {
    // A fact two blueprints ask is the platform's, not one product's — which is what stops
    // switching one product off taking the other's only axis with it.
    const asking = productBlueprints()
      .filter((bp) => bp.asks.some((ask) => ask.factKey === 'years_in_practice'))
      .map((bp) => bp.key)
      .sort();
    expect(asking).toEqual([CLINIC_KEY, PRACTICE_KEY].sort());
    expect(sharedBlueprintFactKeys().has('years_in_practice')).toBe(true);
  });
});

describe('the clinic-owner product reads where the doctor practises', () => {
  it('keys a second income column and a cap by the city tier', () => {
    const bp = blueprintOf(CLINIC_KEY);
    expect(bp.asks.map((ask) => ask.factKey).sort()).toEqual([
      'loan_is_topup',
      'practice_governorate',
      'years_in_practice',
    ]);
    expect(bp.template!.secondColumn?.fact).toBe('practice_governorate');
    expect(bp.template!.secondColumn?.branchOn).toBe('parentClass');
    expect(bp.cap?.factKey).toBe('practice_governorate');
    expect(bp.cap?.columnFactKey).toBe('loan_is_topup');
  });

  it('quotes the sheet — 12 years is 120,000', () => {
    const out = run(CLINIC_KEY, CLINIC_PARAMS, {
      years_in_practice: number('12'),
      practice_governorate: choice('cairo'),
    });
    expect(out.ok && out.valueEGP.toString()).toBe('120000');
  });
});

describe('the in-practice product reads one thing, and states no cap', () => {
  it('asks only the years, and declares neither a second column nor a cap', () => {
    // Asserted as an ABSENCE on purpose: §8 prints one income table and no maximum-loan
    // table, and a template copied from the clinic-owner one would fail right here rather
    // than silently asking every hospital doctor for a governorate nothing reads.
    const bp = blueprintOf(PRACTICE_KEY);
    // The years, and the hospital sector its one condition reads. Still no governorate:
    // that is the clinic-owner product's axis and this sheet prints no city tiers.
    expect(bp.asks.map((ask) => ask.factKey)).toEqual(['years_in_practice', 'hospital_sector']);
    expect(bp.template!.secondColumn).toBeUndefined();
    expect(bp.cap).toBeUndefined();
  });

  it('quotes with the governorate withheld, because it never reads it', () => {
    const out = run(PRACTICE_KEY, PRACTICE_PARAMS, { years_in_practice: number('12') });
    // Exactly half the clinic owner's figure at the same band — the difference that made
    // quoting the wrong programme matter.
    expect(out.ok && out.valueEGP.toString()).toBe('60000');
  });
});

describe('both still band half-open, and refuse below the floor', () => {
  it('puts exactly five years in the 5–8 row on both', () => {
    const clinic = run(CLINIC_KEY, CLINIC_PARAMS, {
      years_in_practice: number('5'),
      practice_governorate: choice('cairo'),
    });
    expect(clinic.ok && clinic.valueEGP.toString()).toBe('60000');

    const practice = run(PRACTICE_KEY, PRACTICE_PARAMS, { years_in_practice: number('5') });
    expect(practice.ok && practice.valueEGP.toString()).toBe('30000');
  });

  it("refuses a doctor under the sheets' own three-year floor, on both", () => {
    // "Minimum 3 years in business" is enforced by the band floor, not by a gate: the lowest
    // edge is 3 and `no_matching_band` is fatal, so a two-year doctor gets a stated reason.
    const clinic = run(CLINIC_KEY, CLINIC_PARAMS, {
      years_in_practice: number('2'),
      practice_governorate: choice('cairo'),
    });
    expect(!clinic.ok && clinic.reason).toBe('no_matching_band');

    const practice = run(PRACTICE_KEY, PRACTICE_PARAMS, { years_in_practice: number('2') });
    expect(!practice.ok && practice.reason).toBe('no_matching_band');
  });

  it('pays different figures at every band, or the split hid no real difference', () => {
    for (let index = 0; index < CLINIC_FIGURES.length; index += 1) {
      expect(CLINIC_FIGURES[index]).not.toBe(PRACTICE_FIGURES[index]);
    }
  });
});
