/**
 * `dbrCapPercentByEmploymentType` on the wire.
 *
 * The engine has read this setting since v18.1.0 and NOTHING could write it: the field was
 * absent from `EligibilityConfigDto`, so the global `forbidNonWhitelisted` pipe rejected the
 * whole request, and no admin editor offered it. Every second bank sheet says "DBR 50%
 * salaried / 40% self-employed" and it could not be entered at all.
 *
 * What is pinned here is the pair of refusals, because both failure modes are silent:
 *
 *   an unknown KEY    a cap the engine never looks up. It reads as configured on the screen
 *                     and is dead at quote time.
 *   a bad VALUE       worse than dead. `resolveDbrCap` re-checks the bounds and falls
 *                     through, so a `0` looks like "capped at nothing" and quietly quotes
 *                     the applicant at the flat rate instead.
 */
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EligibilityConfigDto } from '@/bank-programs/dto/sub-configs/eligibility-config.dto';
import { COARSE_EMPLOYMENT_TYPES } from '@/matching/pipeline/employment-type';

/**
 * Errors for the ONE field under test.
 *
 * Narrowed rather than filled in: `EligibilityConfigDto` has two dozen required fields and
 * a fixture listing them all would fail for a reason unrelated to this change the next time
 * one is added.
 */
const failed = (body: Record<string, unknown>): string[] =>
  validateSync(plainToInstance(EligibilityConfigDto, body) as object)
    .map((e) => e.property)
    .filter((property) => property === 'dbrCapPercentByEmploymentType');

describe('a DBR cap per employment bucket', () => {
  it('accepts the sheet everybody writes', () => {
    expect(failed({ dbrCapPercentByEmploymentType: { salaried: '50', self_employed: '40' } })).toEqual([]);
  });

  it('accepts every bucket the engine can fold an answer into', () => {
    const all = Object.fromEntries(COARSE_EMPLOYMENT_TYPES.map((k) => [k, '45']));
    expect(failed({ dbrCapPercentByEmploymentType: all })).toEqual([]);
  });

  it('stays optional — every program that predates it is untouched', () => {
    expect(failed({})).toEqual([]);
  });

  it.each([
    ['a bucket the engine never looks up', { business_owner: '40' }],
    ["the questionnaire's own vocabulary rather than the bank's", { private_sector_employee: '50' }],
    ['a cap of nothing', { self_employed: '0' }],
    ['a cap over 100', { self_employed: '140' }],
    ['a number instead of a decimal string', { self_employed: 40 }],
    ['a value that is not a number at all', { self_employed: 'forty' }],
  ])('refuses %s', (_label, map) => {
    expect(failed({ dbrCapPercentByEmploymentType: map })).toContain('dbrCapPercentByEmploymentType');
  });
});
