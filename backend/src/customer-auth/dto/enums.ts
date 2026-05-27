/**
 * Local mirrors of Prisma's `SocialProvider` + `OtpPurpose` enums.
 *
 * Constitution Principle X / Clean Code Structure: only repositories import
 * from `@prisma/client`. Controllers, services, and DTOs use these local
 * enums. Members match Prisma's schema exactly (same string values) so no
 * runtime mapping is required — the repository casts at the Prisma boundary.
 */

export enum SocialProvider {
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
}

export enum OtpPurpose {
  SIGNUP = 'SIGNUP',
  PROFILE_MOBILE = 'PROFILE_MOBILE',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  MOBILE_CHANGE = 'MOBILE_CHANGE',
}
