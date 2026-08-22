/**
 * A debt-burden cap that differs by EMPLOYMENT — one bank allows 50% of a salary and 40% of a
 * self-employed income on the same program.
 *
 * `dbrBands` cannot say it (a band is keyed by income), and expressing it as a haircut on the
 * income would misreport the cap itself on every screen that shows one. What is pinned here is
 * the precedence and the identity the ceiling conversion relies on: `applicable ÷ baseline`.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { resolveDbrCap } from '../../src/matching/pipeline/dbr';
import type { DbrSetting } from '../../src/matching/types';

const SETTING: DbrSetting = {
  dbrCapPercent: '50',
  dbrCapPercentByEmploymentType: { self_employed: '40' },
};

const INCOME = new Decimal('20000');

describe('resolveDbrCap — by employment', () => {
  it('caps a business owner at the bucket figure', () => {
    // The applicant answers `business_owner_company_owner`; the program states
    // `self_employed`. The fold happens inside `resolveDbrCap`, so a bank never has to know
    // the questionnaire's vocabulary.
    const out = resolveDbrCap(SETTING, INCOME, undefined, 'business_owner_company_owner');
    expect(out.capPercent.toString()).toBe('40');
  });

  it('folds a freelancer into the same bucket', () => {
    expect(resolveDbrCap(SETTING, INCOME, undefined, 'freelancer').capPercent.toString()).toBe('40');
  });

  it('leaves a salaried applicant on the program default', () => {
    expect(
      resolveDbrCap(SETTING, INCOME, undefined, 'private_sector_employee').capPercent.toString(),
    ).toBe('50');
  });

  it('leaves every applicant alone when the program states no map', () => {
    const out = resolveDbrCap({ dbrCapPercent: '50' }, INCOME, undefined, 'freelancer');
    expect(out.capPercent.toString()).toBe('50');
  });

  it('does not apply a bucket the program left out', () => {
    // A partial map narrows nothing: `retired` is absent, so the scalar answers.
    expect(resolveDbrCap(SETTING, INCOME, undefined, 'retired').capPercent.toString()).toBe('50');
  });

  it('is beaten by the income rule’s own override, which is more specific', () => {
    const out = resolveDbrCap(SETTING, INCOME, '35', 'freelancer');
    expect(out.capPercent.toString()).toBe('35');
    expect(out.source).toBe('rule_override');
  });

  it('wins over the income bands, because it is a statement about the person', () => {
    const banded: DbrSetting = {
      dbrCapPercent: '50',
      dbrBands: [
        { upToIncomeEGP: '30000', capPercent: '45' },
        { upToIncomeEGP: null, capPercent: '55' },
      ],
      dbrCapPercentByEmploymentType: { self_employed: '40' },
    };
    expect(resolveDbrCap(banded, INCOME, undefined, 'freelancer').capPercent.toString()).toBe('40');
    // …and the bands still answer for everybody else.
    expect(
      resolveDbrCap(banded, INCOME, undefined, 'government_employee').capPercent.toString(),
    ).toBe('45');
  });

  it('ignores an out-of-range figure rather than capping at nothing', () => {
    // Same tolerance the override gets: a hand-edited 0 would price every self-employed
    // applicant at zero affordability, and Principle V forbids failing the match on bad config.
    const broken: DbrSetting = {
      dbrCapPercent: '50',
      dbrCapPercentByEmploymentType: { self_employed: '0' },
    };
    expect(resolveDbrCap(broken, INCOME, undefined, 'freelancer').capPercent.toString()).toBe('50');
  });

  it('the ceiling haircut is exactly applicable ÷ baseline', () => {
    // The identity the collateral products rely on: a 40% cap against the 50% baseline the
    // ceiling was calibrated on is 80% of it, with no third setting to keep in step.
    const applicable = resolveDbrCap(SETTING, INCOME, undefined, 'freelancer').capPercent;
    const baseline = new Decimal('50');
    expect(applicable.div(baseline).toString()).toBe('0.8');
    expect(new Decimal('300000').mul(applicable).div(baseline).toString()).toBe('240000');
  });
});
