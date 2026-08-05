/**
 * Applicant age is DERIVED from `birthday`, never stored on the customer and
 * never accepted from a client (Principle XXXVII / A31).
 *
 * The three customer surfaces that price money off age — apply, matching
 * preview, calculator — all read it through this one method, so these two cases
 * are the whole contract: a complete profile yields the age, an incomplete one
 * yields PROFILE_INCOMPLETE rather than a placeholder that would quote a term
 * apply then shortens.
 */

import { describe, expect, it } from 'vitest';
import { CustomerProfileCompletenessService } from '../../src/customer-auth/customer-profile-completeness.service';
import type {
  CustomerAccountRepository,
  CustomerProfileState,
} from '../../src/customer-auth/customer-account.repository';
import type { CustomerProfileDocumentRepository } from '../../src/customer-auth/customer-profile-document.repository';

function makeService(state: CustomerProfileState | null) {
  return new CustomerProfileCompletenessService(
    { findProfileState: async () => state } as unknown as CustomerAccountRepository,
    {} as unknown as CustomerProfileDocumentRepository,
  );
}

const completeState = (birthday: Date | null): CustomerProfileState =>
  ({
    registrationPath: 'PHONE',
    mobileVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    firstName: 'Nour',
    lastName: 'Ibrahim',
    birthday,
    passwordHash: 'hashed',
  }) as unknown as CustomerProfileState;

describe('getApplicantAge', () => {
  it('derives full years from the birthday', async () => {
    const born = new Date();
    born.setFullYear(born.getFullYear() - 34);
    born.setDate(born.getDate() - 1); // yesterday's date last year → the birthday has passed

    await expect(makeService(completeState(born)).getApplicantAge('cus_1')).resolves.toBe(34);
  });

  it('does not count a birthday that has not arrived yet this year', async () => {
    const born = new Date();
    born.setFullYear(born.getFullYear() - 34);
    born.setDate(born.getDate() + 1); // tomorrow → still 33

    await expect(makeService(completeState(born)).getApplicantAge('cus_1')).resolves.toBe(33);
  });

  it('throws PROFILE_INCOMPLETE when the birthday is missing', async () => {
    await expect(makeService(completeState(null)).getApplicantAge('cus_1')).rejects.toMatchObject({
      code: 'PROFILE_INCOMPLETE',
    });
  });

  it('throws PROFILE_INCOMPLETE for an unknown customer', async () => {
    await expect(makeService(null).getApplicantAge('cus_missing')).rejects.toMatchObject({
      code: 'PROFILE_INCOMPLETE',
    });
  });
});
