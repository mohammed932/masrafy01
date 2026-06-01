import { LoanCategory } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';

const VALID = new Set<string>(Object.values(LoanCategory));

/** Parse + validate a `:category` path param into the LoanCategory enum. */
export function parseCategory(raw: string): LoanCategory {
  const v = raw.toLowerCase();
  if (!VALID.has(v)) {
    throw new DomainException(ERROR_CODES.VALIDATION_FAILED, { field: 'category', value: raw });
  }
  return v as LoanCategory;
}
