/**
 * `wayId` on the wire, and through the persist chain.
 *
 * A new optional field on `IncomeAssumptionConfig` needs FOUR edits, not one, and three of
 * the four fail silently. This is the guard, copied from `dbr-cap-by-employment-dto.spec.ts`
 * — the spec that exists because that field was unreachable for two versions:
 *
 *   1. the DTO           `forbidNonWhitelisted: true` rejects an undeclared field at the pipe,
 *                        so the whole save 400s;
 *   2. `stripForeignMethodConfig`
 *                        REBUILDS the config rather than deleting from it, so an omitted field
 *                        is dropped on every save — the request succeeds, the screen shows the
 *                        way the operator picked, and the stored program carries none. That is
 *                        exactly how `additionalIncome` was lost;
 *   3. `IncomeAssumptionConfig`
 *                        pinned by the fact that this file compiles;
 *   4. `normalizeIncomeAssumption`
 *                        which runs after the strip. A product rule is returned untouched
 *                        there, and this asserts it rather than trusting it.
 */
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IncomeAssumptionConfigDto } from '@/bank-programs/dto/sub-configs/income-assumption-config.dto';
import { stripForeignMethodConfig } from '@/bank-programs/validation/income-rule.validator';
import { normalizeIncomeAssumption } from '@/matching/pipeline/income-rule-normalize';
import { PRODUCT_RULE_STRATEGY, type IncomeAssumptionConfig } from '@/matching/types';

/** Errors for the ONE field under test, so an unrelated required field cannot fail this. */
const failed = (body: Record<string, unknown>, property: string): string[] =>
  validateSync(plainToInstance(IncomeAssumptionConfigDto, body) as object)
    .map((e) => e.property)
    .filter((name) => name === property);

const rule = (over: Partial<IncomeAssumptionConfig> = {}): IncomeAssumptionConfig => ({
  strategy: PRODUCT_RULE_STRATEGY,
  amounts: 'own',
  stepParams: { alt: { scalar: { value: '15', unit: 'percent' } } },
  ...over,
});

describe('wayId reaches the database', () => {
  it('is accepted by the pipe in every spelling a slot id can take', () => {
    for (const wayId of ['primary', 'alt', 'alt__unit_paid_to_date']) {
      expect(failed({ strategy: PRODUCT_RULE_STRATEGY, wayId }, 'wayId')).toEqual([]);
    }
  });

  it('stays optional — every program that predates it is untouched', () => {
    expect(failed({ strategy: PRODUCT_RULE_STRATEGY }, 'wayId')).toEqual([]);
  });

  it.each([
    ['a path rather than a slot id', 'stepParams.alt'],
    ['an id with a capital in it', 'Alt'],
    ['a number', 42],
    ['an empty string', ''],
  ])('refuses %s', (_label, wayId) => {
    expect(failed({ strategy: PRODUCT_RULE_STRATEGY, wayId }, 'wayId')).toContain('wayId');
  });

  it('survives the method strip, which rebuilds the config from scratch', () => {
    expect(stripForeignMethodConfig(rule({ wayId: 'alt' }))?.wayId).toBe('alt');
  });

  it('survives normalisation, which runs after the strip', () => {
    const persisted = normalizeIncomeAssumption(stripForeignMethodConfig(rule({ wayId: 'alt' })));
    expect(persisted.wayId).toBe('alt');
  });

  it('is absent after the chain when the caller never sent one', () => {
    // Absent must stay absent rather than becoming `''` or a default way: the save refuses a
    // missing choice by name, and a manufactured one would be the platform deciding which
    // mechanism a bank publishes.
    const persisted = normalizeIncomeAssumption(stripForeignMethodConfig(rule()));
    expect('wayId' in persisted).toBe(false);
  });
});

describe('waysAre reaches a client that echoes back what it read', () => {
  it('is accepted by the pipe', () => {
    expect(failed({ strategy: PRODUCT_RULE_STRATEGY, waysAre: 'exclusive' }, 'waysAre')).toEqual([]);
  });

  it('accepts the other spelling too — the cross-sell rule echoes it back', () => {
    expect(failed({ strategy: PRODUCT_RULE_STRATEGY, waysAre: 'combined' }, 'waysAre')).toEqual([]);
  });

  it('refuses a value the platform does not know', () => {
    expect(failed({ strategy: PRODUCT_RULE_STRATEGY, waysAre: 'either' }, 'waysAre')).toContain(
      'waysAre',
    );
  });

  it('survives the strip, so a catalog rule keeps stating it', () => {
    // Kept beside the steps it belongs to. `stripCatalogStructure` — the bank-program path
    // only — is what takes it back off a bank row.
    expect(stripForeignMethodConfig(rule({ waysAre: 'exclusive' }))?.waysAre).toBe('exclusive');
  });
});
