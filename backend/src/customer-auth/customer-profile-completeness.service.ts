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
  type CustomerIdDocRow,
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

  /** Pure predicate — true when every completeness field is present. */
  static evaluate(state: CustomerProfileState | null, docs: CustomerIdDocRow[]): boolean {
    if (!state) return false;
    const fieldsOk =
      state.mobileVerifiedAt !== null &&
      state.firstName.trim().length > 0 &&
      state.lastName.trim().length > 0 &&
      state.birthday !== null &&
      state.profilePhotoKey !== null &&
      (state.registrationPath !== RegistrationPath.PHONE || state.passwordHash !== null);
    if (!fieldsOk) return false;
    return (
      hasUsableIdDoc(docs, NATIONAL_ID_FRONT) && hasUsableIdDoc(docs, NATIONAL_ID_BACK)
    );
  }

  async isComplete(customerId: string): Promise<boolean> {
    const [state, docs] = await Promise.all([
      this.accounts.findProfileState(customerId),
      this.idDocs.findIdDocuments(customerId),
    ]);
    return CustomerProfileCompletenessService.evaluate(state, docs);
  }

  /** Hard gate (Principle XXXVII Rule 2): throws PROFILE_INCOMPLETE when not complete. */
  async assertComplete(customerId: string): Promise<void> {
    const complete = await this.isComplete(customerId);
    if (!complete) throw new DomainException(ERROR_CODES.PROFILE_INCOMPLETE);
  }
}
