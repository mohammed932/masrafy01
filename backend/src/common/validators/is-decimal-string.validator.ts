/**
 * Decimal-string validator. Constitution Principle I: money is Decimal.
 *
 * Accepts a string that parses as a positive decimal with up to {scale} fractional digits,
 * between {min} and {max} inclusive. Rejects scientific notation, JS numbers, and empty
 * strings. Use this in DTOs in place of @IsNumber for any monetary field — preserves
 * precision through HTTP → DTO → Prisma.Decimal without floating-point coercion.
 */
import { Prisma } from '@prisma/client';
import {
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';

export interface IsDecimalStringOptions {
  min?: number | string;
  max?: number | string;
  scale?: number;
  allowZero?: boolean;
}

export function IsDecimalString(
  opts: IsDecimalStringOptions = {},
  validation?: ValidationOptions,
): PropertyDecorator {
  const scale = opts.scale ?? 4;
  const pattern = new RegExp(`^-?(\\d+)(\\.\\d{1,${scale}})?$`);
  const minDec = opts.min !== undefined ? new Prisma.Decimal(opts.min) : null;
  const maxDec = opts.max !== undefined ? new Prisma.Decimal(opts.max) : null;
  const allowZero = opts.allowZero ?? true;

  return function (object, propertyName) {
    registerDecorator({
      name: 'isDecimalString',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validation,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (!pattern.test(value)) return false;
          let d: Prisma.Decimal;
          try {
            d = new Prisma.Decimal(value);
          } catch {
            return false;
          }
          if (!allowZero && d.isZero()) return false;
          if (minDec && d.lessThan(minDec)) return false;
          if (maxDec && d.greaterThan(maxDec)) return false;
          return true;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a decimal string`;
        },
      },
    });
  };
}
