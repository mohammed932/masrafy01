import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { Prisma } from '@prisma/client';

interface DecimalRangeOptions {
  min?: string | number;
  max?: string | number;
  precision: number;
  scale: number;
  /** Allow null / undefined values to bypass validation. */
  nullable?: boolean;
}

/**
 * Validate a Decimal-as-string field against a precision/scale + optional min/max.
 * Money in this codebase MUST be `DECIMAL(13,2)`; percentages `DECIMAL(7,4)` (FR-008).
 * Floats are forbidden — input is always normalized to Prisma.Decimal first.
 *
 * Usage:
 *   @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2 })
 *   minAmount!: string;
 */
export function DecimalRange(
  opts: DecimalRangeOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function decimalRange(target: object, propertyKey: string | symbol): void {
    registerDecorator({
      name: 'decimalRange',
      target: target.constructor,
      propertyName: String(propertyKey),
      constraints: [opts],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (value === null || value === undefined) {
            return opts.nullable === true;
          }
          let dec: Prisma.Decimal;
          try {
            dec = new Prisma.Decimal(value as string | number);
          } catch {
            return false;
          }
          if (!dec.isFinite()) {
            return false;
          }
          // Scale check: count fractional digits.
          const text = dec.toFixed();
          const dot = text.indexOf('.');
          const fractionalDigits = dot === -1 ? 0 : text.length - dot - 1;
          if (fractionalDigits > opts.scale) {
            return false;
          }
          // Precision check: total significant digits ≤ precision.
          const digitsOnly = text.replace(/[-.]/g, '');
          if (digitsOnly.replace(/^0+/, '').length > opts.precision) {
            return false;
          }
          // Bounds.
          if (opts.min !== undefined) {
            const min = new Prisma.Decimal(opts.min);
            if (dec.lessThan(min)) {
              return false;
            }
          }
          if (opts.max !== undefined) {
            const max = new Prisma.Decimal(opts.max);
            if (dec.greaterThan(max)) {
              return false;
            }
          }
          return true;
        },
        defaultMessage(args: ValidationArguments): string {
          const o = args.constraints[0] as DecimalRangeOptions;
          return `${args.property} must be a decimal with precision ${o.precision}, scale ${o.scale}${
            o.min !== undefined ? `, >= ${o.min}` : ''
          }${o.max !== undefined ? `, <= ${o.max}` : ''}`;
        },
      },
    });
  };
}
