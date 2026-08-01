/**
 * PII masker for admin-facing application reads (FR-051).
 * Constitution Principle VI: scalar PII fields are masked before crossing the API boundary.
 *
 * Masking conventions:
 *   - nationalId: keep last 4 ("************4527")
 *   - companyName: keep first char ("M***")
 *   - free-text amount strings: pass-through (not PII)
 *   - militaryGrade / professorRank: pass-through (categorical)
 */

export function maskNationalId(nationalId: string | undefined | null): string | null {
  if (!nationalId) return null;
  if (nationalId.length <= 4) return '****';
  return '*'.repeat(nationalId.length - 4) + nationalId.slice(-4);
}

export function maskCompanyName(name: string | undefined | null): string | null {
  if (!name) return null;
  if (name.length <= 1) return '*';
  return name.charAt(0) + '*'.repeat(Math.min(name.length - 1, 6));
}

export type RawApplicantProfileJson = {
  nationalId?: string;
  employment?: { companyName?: string } & Record<string, unknown>;
} & Record<string, unknown>;

export function maskApplicantProfile<T extends RawApplicantProfileJson>(profile: T): T {
  const masked: Record<string, unknown> = { ...profile };
  if (profile.nationalId) masked.nationalId = maskNationalId(profile.nationalId);
  if (profile.employment) {
    masked.employment = {
      ...profile.employment,
      companyName: maskCompanyName(profile.employment.companyName),
    };
  }
  return masked as T;
}

// ---------------------------------------------------------------------------
// Feature 010 — free-text answers
// ---------------------------------------------------------------------------

/**
 * A TEXT question is free-form, so its answer may contain anything the customer
 * typed — an employer, an address, a phone number. Principle VI / A4: it must
 * never reach a log line or a calc trace.
 *
 * Note the asymmetry, and that it is deliberate:
 *   - `stripTextAnswers` is for LOGS and CALC TRACES — the value is dropped.
 *   - An authorised admin reading an application still sees the answer; that is
 *     the point of collecting it. Masking happens on the way OUT to logs, not on
 *     the way in to the admin UI.
 */
export const TEXT_ANSWER_REDACTED = '[redacted]';

export type LoggableAnswer = {
  questionCode: string;
  textValue?: string | null;
} & Record<string, unknown>;

/** Drop `textValue` from every answer before the collection is logged or traced. */
export function stripTextAnswers<T extends LoggableAnswer>(
  answers: ReadonlyArray<T>,
): Array<Omit<T, 'textValue'>> {
  return answers.map((a) => {
    const { textValue: _dropped, ...rest } = a;
    return rest;
  });
}

/**
 * Same guarantee for a single value, when the surrounding object must keep its
 * shape (e.g. a fixed-shape trace row): the presence of an answer is recorded,
 * the content is not.
 */
export function redactTextValue(textValue: string | null | undefined): string | null {
  return textValue == null || textValue === '' ? null : TEXT_ANSWER_REDACTED;
}
