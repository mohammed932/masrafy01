/**
 * The guard on a bank programme's own display name.
 *
 * The case that matters is the third one: ABK files "Doctors — Clinic Owners" and
 * "Doctors — In Practice" under the one catalog name "Doctors", and those strings are the
 * ONLY record of a distinction worth half the assumed income at every band. An
 * unconditional assign wiped them, silently, on any touch of the name picker.
 */
import { describe, expect, it } from 'vitest';
import { followsCatalogName } from '../src/app/features/bank-programs/form/friendly-name-seed';

const DOCTORS = { labelEn: 'Doctors', labelAr: 'الأطباء' };

describe('followsCatalogName', () => {
  it('claims a blank field — there is nothing to lose', () => {
    expect(followsCatalogName('', DOCTORS)).toBe(true);
    expect(followsCatalogName(null, DOCTORS)).toBe(true);
    expect(followsCatalogName(undefined, DOCTORS)).toBe(true);
    expect(followsCatalogName('   ', DOCTORS)).toBe(true);
  });

  it('claims a field still equal to the previous pick, in either locale', () => {
    // It was following the catalog, so it moves with the catalog.
    expect(followsCatalogName('Doctors', DOCTORS)).toBe(true);
    expect(followsCatalogName('الأطباء', DOCTORS)).toBe(true);
  });

  it('LEAVES a name the bank worded itself', () => {
    // The whole reason this function exists.
    expect(followsCatalogName('Doctors — Clinic Owners', DOCTORS)).toBe(false);
    expect(followsCatalogName('Doctors — In Practice', DOCTORS)).toBe(false);
    expect(followsCatalogName('الأطباء — أصحاب العيادات', DOCTORS)).toBe(false);
  });

  it('treats a stray space as no decision at all', () => {
    expect(followsCatalogName('  Doctors  ', DOCTORS)).toBe(true);
  });

  it('claims nothing but a blank before anything has been picked', () => {
    // On load there is no previous label to compare against, so a value already in the box
    // came from the server and belongs to the bank until proven otherwise.
    expect(followsCatalogName('Doctors', null)).toBe(false);
    expect(followsCatalogName('Doctors — Clinic Owners', null)).toBe(false);
    expect(followsCatalogName('', null)).toBe(true);
  });

  it('does not confuse a name that merely CONTAINS the catalog label', () => {
    expect(followsCatalogName('Doctors Plus', DOCTORS)).toBe(false);
    expect(followsCatalogName('Senior Doctors', DOCTORS)).toBe(false);
  });
});
