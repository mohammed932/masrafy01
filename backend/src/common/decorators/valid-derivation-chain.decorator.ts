import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { Prisma } from '@prisma/client';

/**
 * Cross-field guard on a tier-band value object shaped:
 *   { value: string, derivation?: { sourceRatePercent: string, deltaPercent: string, reason: string } }
 *
 * When `derivation` is present, asserts:
 *   | (sourceRatePercent + deltaPercent) − value | ≤ 0.0001 percentage points
 *
 * Spec anchor: FR-008s (d) — guards against drift between persisted chain and persisted value.
 * Mirrors the DERIVATION_ARITHMETIC_MISMATCH error code.
 *
 * Apply at the OBJECT level (validator runs against the band value).
 */
const TOLERANCE = new Prisma.Decimal('0.0001');

interface DerivationCarrier {
  value?: unknown;
  derivation?:
    | {
        sourceRatePercent?: unknown;
        deltaPercent?: unknown;
        reason?: unknown;
      }
    | null
    | undefined;
}

export function ValidDerivationChain(validationOptions?: ValidationOptions): PropertyDecorator {
  return function validDerivationChain(target: object, propertyKey: string | symbol): void {
    registerDecorator({
      name: 'validDerivationChain',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          const carrier = value as DerivationCarrier | null | undefined;
          if (!carrier || !carrier.derivation) {
            return true;
          }
          const v = carrier.value;
          const s = carrier.derivation.sourceRatePercent;
          const d = carrier.derivation.deltaPercent;
          if (
            typeof v !== 'string' && typeof v !== 'number'
          ) {
            return false;
          }
          if (
            (typeof s !== 'string' && typeof s !== 'number') ||
            (typeof d !== 'string' && typeof d !== 'number')
          ) {
            return false;
          }
          try {
            const decV = new Prisma.Decimal(v);
            const decS = new Prisma.Decimal(s);
            const decD = new Prisma.Decimal(d);
            const diff = decS.add(decD).minus(decV).abs();
            return diff.lessThanOrEqualTo(TOLERANCE);
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property}.derivation arithmetic must satisfy sourceRatePercent + deltaPercent ≈ value (±0.0001 %)`;
        },
      },
    });
  };
}
