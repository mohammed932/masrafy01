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

/** Per-document upload state — shared by GET /v1/profile/documents/status and the select-offer gate. */
export interface CustomerProfileDocumentsStatus {
  profilePhoto: boolean;
  nationalIdFront: boolean;
  nationalIdBack: boolean;
}

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
   * Profile photo and National ID are intentionally NOT part of account
   * completeness (Principle XXXVII, narrowed v9.0.0): both are optional and
   * uploadable at any time via the profile-document endpoints. Only National
   * ID front+back are separately enforced at the select-offer commitment
   * point via {@link assertSelectOfferDocuments} (NATIONAL_ID_REQUIRED) — an
   * independent, non-XXXVII gate, not part of this completeness contract.
   * Profile photo is no longer gated anywhere (v9.1.0).
   */
  static evaluate(state: CustomerProfileState | null): boolean {
    if (!state) return false;
    return (
      state.mobileVerifiedAt !== null &&
      state.firstName.trim().length > 0 &&
      state.lastName.trim().length > 0 &&
      state.birthday !== null &&
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

  /**
   * Per-document upload state. Single source of truth for BOTH the mobile
   * docs-screen pre-check (GET /v1/profile/documents/status) and
   * {@link assertSelectOfferDocuments} — the two can never drift.
   */
  async getProfileDocumentsStatus(
    customerId: string,
  ): Promise<CustomerProfileDocumentsStatus> {
    const [profilePhotoKey, docs] = await Promise.all([
      this.accounts.findProfilePhotoKey(customerId),
      this.idDocs.findIdDocuments(customerId),
    ]);
    return {
      profilePhoto: profilePhotoKey !== null,
      nationalIdFront: hasUsableIdDoc(docs, NATIONAL_ID_FRONT),
      nationalIdBack: hasUsableIdDoc(docs, NATIONAL_ID_BACK),
    };
  }

  /**
   * Select-offer commitment gate (non-XXXVII business rule, constitution
   * v9.1.0): only National ID front+back are required when the customer
   * proceeds with a bank offer — never at the matching call (`apply()`), so
   * matched offers stay freely browsable. Profile photo is fully optional and
   * no longer gated here (v9.1.0). NATIONAL_ID_REQUIRED routes the app to the
   * documents screen.
   */
  async assertSelectOfferDocuments(customerId: string): Promise<void> {
    const status = await this.getProfileDocumentsStatus(customerId);
    if (!status.nationalIdFront || !status.nationalIdBack) {
      throw new DomainException(ERROR_CODES.NATIONAL_ID_REQUIRED);
    }
  }
}
