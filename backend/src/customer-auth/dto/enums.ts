/**
 * Local mirrors of Prisma's `SocialProvider` + `OtpPurpose` enums.
 *
 * Constitution Principle X / Clean Code Structure: only repositories import
 * from `@prisma/client`. Controllers, services, and DTOs use these local
 * enums. Members match Prisma's schema exactly (same string values) so no
 * runtime mapping is required — the repository casts at the Prisma boundary.
 */

/** Google is the only social provider (constitution v11.0.0 — Apple removed). */
export enum SocialProvider {
  GOOGLE = 'GOOGLE',
}

export enum OtpPurpose {
  SIGNUP = 'SIGNUP',
  PROFILE_MOBILE = 'PROFILE_MOBILE',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  MOBILE_CHANGE = 'MOBILE_CHANGE',
}
