import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  DbrBandCapOutOfRangeException,
  DbrBandsInvalidException,
  DomainException,
  ProgramRangeInvalidException,
} from '@/common/errors/domain.exceptions';
import { ProgramDefaultsDto } from '../dto/program-defaults.dto';
import { validateDbrBands } from './dbr-bands.validator';

/**
 * Feature 010 — partial-mode program validation, shared by every prefill host
 * (catalog defaults FR-001, bank lending policy FR-005, and the prefill response).
 *
 * Differs from full program validation in one way only: a range is checked only
 * when BOTH ends are present, because a prefill layer may legitimately supply
 * just a ceiling and let the other layer (or the admin) supply the floor.
 *
 * Throws typed domain exceptions (Principle III) — never English strings.
 */
export async function validateProgramDefaults(
  raw: unknown,
  fieldPrefix: string,
): Promise<ProgramDefaultsDto> {
  const instance = plainToInstance(ProgramDefaultsDto, raw ?? {}, {
    enableImplicitConversion: false,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
  if (errors.length > 0) {
    throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
      field: `${fieldPrefix}.${errors[0]?.property ?? ''}`.replace(/\.$/, ''),
    });
  }

  const bandViolation = validateDbrBands(instance.eligibility?.dbrBands);
  if (bandViolation?.kind === 'capOutOfRange') {
    throw new DbrBandCapOutOfRangeException({
      index: bandViolation.index,
      capPercent: bandViolation.capPercent,
    });
  }
  if (bandViolation?.kind === 'invalid') {
    throw new DbrBandsInvalidException({
      reason: bandViolation.reason,
      index: bandViolation.index,
    });
  }

  assertPartialRanges(instance, fieldPrefix);
  return instance;
}

/** FR-014 applied to a partial: only ranges with both ends present are checked. */
function assertPartialRanges(defaults: ProgramDefaultsDto, fieldPrefix: string): void {
  const { minMonths, maxMonths } = defaults.tenor ?? {};
  if (minMonths !== undefined && maxMonths !== undefined && minMonths > maxMonths) {
    throw new ProgramRangeInvalidException({
      field: `${fieldPrefix}.tenor`,
      min: minMonths,
      max: maxMonths,
    });
  }

  const { ageMin, ageMax } = defaults.eligibility ?? {};
  if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
    throw new ProgramRangeInvalidException({
      field: `${fieldPrefix}.eligibility`,
      min: ageMin,
      max: ageMax,
    });
  }

  for (const [currency, range] of Object.entries(defaults.loanLimits?.perCurrency ?? {})) {
    if (range?.minAmount === undefined || range?.maxAmount === undefined) continue;
    const field = `${fieldPrefix}.loanLimits.perCurrency.${currency}`;
    let min: Prisma.Decimal;
    let max: Prisma.Decimal;
    try {
      min = new Prisma.Decimal(range.minAmount);
      max = new Prisma.Decimal(range.maxAmount);
    } catch {
      throw new ProgramRangeInvalidException({
        field,
        min: range.minAmount ?? null,
        max: range.maxAmount ?? null,
      });
    }
    if (max.lessThanOrEqualTo(0) || min.greaterThan(max)) {
      throw new ProgramRangeInvalidException({ field, min: range.minAmount, max: range.maxAmount });
    }
  }
}
