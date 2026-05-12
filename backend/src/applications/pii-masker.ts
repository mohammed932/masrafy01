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
