import { Injectable } from '@nestjs/common';
import { OtpChallengeRepository } from './otp-challenge.repository';

/**
 * Resolves the "number entered, OTP never completed" state that survives the
 * app being closed. `Customer.phone` stays NULL until `bindMobileVerified`
 * runs, so the only record of the attempt is the unconsumed PROFILE_MOBILE
 * challenge — this service reads it back for the profile payload.
 *
 * Only SOCIAL accounts can be in this state: the PHONE signup path creates the
 * customer AFTER the OTP succeeds, so abandoning that OTP leaves no account at
 * all and nothing to resume.
 */
@Injectable()
export class CustomerPendingMobileService {
  constructor(private readonly otpChallenges: OtpChallengeRepository) {}

  /**
   * The pending number, or undefined when there is nothing to resume.
   * Short-circuits without a query once the mobile is verified — by then the
   * real number lives on the customer row and the pending value is meaningless.
   */
  async resolve(args: {
    customerId: string;
    mobileVerifiedAt: Date | null;
  }): Promise<string | undefined> {
    if (args.mobileVerifiedAt !== null) return undefined;
    const phone = await this.otpChallenges.findPendingMobileForCustomer(args.customerId);
    return phone ?? undefined;
  }
}
