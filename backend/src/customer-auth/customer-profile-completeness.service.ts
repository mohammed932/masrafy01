import { Injectable } from '@nestjs/common';
import { RegistrationPath } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  CustomerAccountRepository,
  type CustomerProfileState,
} from './customer-account.repository';
import {
  CustomerProfileDocumentRepository,
  NATIONAL_ID_BACK,
  NATIONAL_ID_FRONT,
  hasUsableIdDoc,
} from './customer-profile-document.repository';

/**
 * Principle XXXVII — single source of truth for the profile-completeness
 * contract. Used by the `/me` projection (to surface `profileComplete`) and by
 * the `CustomerProfileCompleteGuard` (to hard-gate questionnaire/matching/apply).
 */
@Injectable()
export class CustomerProfileCompletenessService {
  constructor(
    private readonly accounts: CustomerAccountRepository,
    private readonly idDocs: CustomerProfileDocumentRepository,
  ) {}

  /**
   * Pure predicate — true when every account-completeness field is present.
   * National ID is intentionally NOT part of account completeness: it is
   * optional at signup ("add later") and enforced only at loan-apply time via
   * {@link assertNationalId}.
   */
  static evaluate(state: CustomerProfileState | null): boolean {
    if (!state) return false;
    return (
      state.mobileVerifiedAt !== null &&
      state.firstName.trim().length > 0 &&
      state.lastName.trim().length > 0 &&
      state.birthday !== null &&
      state.profilePhotoKey !== null &&
      (state.registrationPath !== RegistrationPath.PHONE || state.passwordHash !== null)
    );
  }

  async isComplete(customerId: string): Promise<boolean> {
    const state = await this.accounts.findProfileState(customerId);
    return CustomerProfileCompletenessService.evaluate(state);
  }

  /** Hard gate (Principle XXXVII Rule 2): throws PROFILE_INCOMPLETE when not complete. */
  async assertComplete(customerId: string): Promise<void> {
    const complete = await this.isComplete(customerId);
    if (!complete) throw new DomainException(ERROR_CODES.PROFILE_INCOMPLETE);
  }

  /** True when both National ID sides are uploaded/verified (loan-eligibility gate). */
  async hasNationalId(customerId: string): Promise<boolean> {
    const docs = await this.idDocs.findIdDocuments(customerId);
    return (
      hasUsableIdDoc(docs, NATIONAL_ID_FRONT) && hasUsableIdDoc(docs, NATIONAL_ID_BACK)
    );
  }

  /**
   * Apply-time gate: National ID front + back are required before submitting a
   * loan application (optional at signup). Throws NATIONAL_ID_REQUIRED.
   */
  async assertNationalId(customerId: string): Promise<void> {
    if (!(await this.hasNationalId(customerId))) {
      throw new DomainException(ERROR_CODES.NATIONAL_ID_REQUIRED);
    }
  }
}
