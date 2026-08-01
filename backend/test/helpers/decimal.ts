import { Decimal } from '@prisma/client/runtime/library';
import { expect } from 'vitest';

export type DecimalLike = Decimal | string | number;

/**
 * Principle I — money is Decimal. Never compare money as a float:
 * always normalise to a fixed 2-dp string and compare that.
 */
export function toMoneyString(value: DecimalLike, dp = 2): string {
  return new Decimal(value.toString()).toFixed(dp);
}

export function expectDecimalEqual(
  actual: DecimalLike,
  expected: DecimalLike,
  dp = 2,
): void {
  expect(toMoneyString(actual, dp)).toBe(toMoneyString(expected, dp));
}

/** Tolerant comparison for identity round-trips (e.g. PV(PMT(P)) ≈ P). */
export function expectDecimalClose(
  actual: DecimalLike,
  expected: DecimalLike,
  toleranceEgp: DecimalLike = '0.02',
): void {
  const diff = new Decimal(actual.toString())
    .minus(new Decimal(expected.toString()))
    .abs();
  expect(
    diff.lessThanOrEqualTo(new Decimal(toleranceEgp.toString())),
    `expected |${actual} - ${expected}| <= ${toleranceEgp}, got ${diff.toString()}`,
  ).toBe(true);
}
