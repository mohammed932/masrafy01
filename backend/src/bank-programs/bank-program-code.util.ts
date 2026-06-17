import { randomBytes } from 'node:crypto';

/** First alnum word of a label, uppercased and capped. */
function token(label: string, max: number): string {
  const first =
    label
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)[0] ?? '';
  return first.toUpperCase().slice(0, max);
}

/**
 * Readable base for an auto-generated program code, e.g. `ABK-PERSONAL`.
 * Leaves headroom for the `-XXXX` random suffix within the 32-char limit.
 * Generic — derived from data, never hardcoded per bank (Principle II).
 */
export function buildProgramCodeBase(bankName: string, productCategory: string): string {
  const bank = token(bankName, 8) || 'BANK';
  const category = token(productCategory, 10) || 'PROGRAM';
  return `${bank}-${category}`.slice(0, 26);
}

/** 4 uppercase hex chars, e.g. `A3F9`. */
export function randomCodeSuffix(): string {
  return randomBytes(2).toString('hex').toUpperCase();
}

/** Compose a candidate matching `^[A-Z0-9_-]{3,32}$`. */
export function composeProgramCode(base: string, suffix: string): string {
  return `${base}-${suffix}`.slice(0, 32);
}
