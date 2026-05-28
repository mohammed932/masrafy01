import { Injectable, Logger } from '@nestjs/common';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { OtpPurpose, SocialProvider } from './dto/enums';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  CustomerAccountInactiveException,
  CustomerInvalidCredentialsException,
  CustomerPhoneAlreadyRegisteredException,
} from '@/common/errors/domain.exceptions';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { PasswordService } from '@/auth/password.service';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  CustomerAccountRepository,
  CustomerAccountUniqueConflictError,
} from './customer-account.repository';
import { CustomerJwtTokenService } from './customer-jwt-token.service';
import { CustomerRefreshTokenService } from './customer-refresh-token.service';
import { CustomerRefreshTokenRepository } from './customer-refresh-token.repository';
import { CustomerOtpService } from './customer-otp.service';
import { VerifiedMobileTokenService } from './verified-mobile-token.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { SocialSessionRepository } from './social-session.repository';
import { CustomerProviderRepository } from './customer-provider.repository';
import { GoogleVerifyService, type VerifiedSocialIdentity } from './social/google-verify.service';
import { AppleVerifyService } from './social/apple-verify.service';
import { CustomerLoginLockoutService } from './customer-login-lockout.service';
import {
  canonicalisePhone,
  type CustomerAuthResult,
  type CustomerRequestContext,
} from './customer-auth.service';
import type { CustomerProfileResponseDto } from './dto/customer-auth.dto';

/**
 * Feature 008 — Two-Path Registration service.
 *
 * New methods layered alongside the legacy `CustomerAuthService.signup`
 * (kept intact for now so existing mobile callers don't break). The legacy
 * `signup` endpoint will be deprecated in favor of the two-step phone-
 * signup flow exposed here.
 */
@Injectable()
export class CustomerAuthMobileService {
  private readonly logger = new Logger(CustomerAuthMobileService.name);
  private static readonly SOCIAL_SESSION_TTL_MS = 15 * 60 * 1000;

  constructor(
    private readonly accounts: CustomerAccountRepository,
    private readonly refreshTokens: CustomerRefreshTokenService,
    private readonly refreshTokenRepo: CustomerRefreshTokenRepository,
    private readonly jwt: CustomerJwtTokenService,
    private readonly password: PasswordService,
    private readonly otp: CustomerOtpService,
    private readonly verifiedMobile: VerifiedMobileTokenService,
    private readonly passwordResetTokens: PasswordResetTokenService,
    private readonly socialSessions: SocialSessionRepository,
    private readonly providers: CustomerProviderRepository,
    private readonly google: GoogleVerifyService,
    private readonly apple: AppleVerifyService,
    private readonly lockout: CustomerLoginLockoutService,
    private readonly audit: AuditEventWriter,
    private readonly prisma: PrismaService,
  ) {}

  // -------------------------------------------------------------------------
  // PHONE signup (two-step)
  // -------------------------------------------------------------------------

  async signupPhoneStart(args: {
    phone: string;
    locale: 'ar' | 'en';
    ctx: CustomerRequestContext;
  }): Promise<{
    otpId: string;
    maskedPhone: string;
    expiresInSeconds: number;
    resendAvailableInSeconds: number;
  }> {
    const phone = canonicalisePhone(args.phone);

    // Pre-check collision so the user is told to log in instead of burning OTP.
    const existing = await this.accounts.findByPhone(phone);
    if (existing) throw new CustomerPhoneAlreadyRegisteredException();

    const challenge = await this.otp.issue({
      phone,
      purpose: OtpPurpose.SIGNUP,
      locale: args.locale,
      correlationId: args.ctx.correlationId,
    });
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.CUSTOMER_OTP_REQUESTED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { purpose: 'SIGNUP', otpId: challenge.otpId },
    });
    return challenge;
  }

  async signupPhoneComplete(args: {
    verifiedMobileToken: string;
    name: string;
    email?: string;
    password: string;
    age: number;
    locale?: string;
    ctx: CustomerRequestContext;
  }): Promise<CustomerAuthResult> {
    await this.password.validatePolicy(args.password);
    const passwordHash = await this.password.hash(args.password);
    const email = args.email?.toLowerCase().trim() ?? null;

    const created = await this.prisma.$transaction(async (tx) => {
      const { phone } = await this.verifiedMobile.consume(args.verifiedMobileToken, tx);
      try {
        return await this.accounts.createPhoneVerified(
          {
            phone,
            name: args.name.trim(),
            email,
            locale: args.locale ?? 'ar-EG',
            passwordHash,
            age: args.age,
          },
          tx,
        );
      } catch (err) {
        if (err instanceof CustomerAccountUniqueConflictError) {
          throw new CustomerPhoneAlreadyRegisteredException();
        }
        throw err;
      }
    });

    await this.audit.write({
      actorId: null,
      targetId: created.id,
      eventType: AuditEventType.CUSTOMER_SIGNUP_PHONE_COMPLETED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: created.id },
    });

    return this.issueSession({ customerId: created.id, ctx: args.ctx });
  }

  // -------------------------------------------------------------------------
  // OTP generic endpoints
  // -------------------------------------------------------------------------

  async requestOtp(args: {
    phone: string;
    purpose: OtpPurpose;
    locale: 'ar' | 'en';
    ctx: CustomerRequestContext;
  }) {
    if ((args.purpose as string) === 'LOGIN') {
      throw new DomainException(ERROR_CODES.OTP_PURPOSE_LOGIN_FORBIDDEN);
    }
    const phone = canonicalisePhone(args.phone);
    const challenge = await this.otp.issue({
      phone,
      purpose: args.purpose,
      locale: args.locale,
      correlationId: args.ctx.correlationId,
    });
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.CUSTOMER_OTP_REQUESTED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { purpose: args.purpose, otpId: challenge.otpId },
    });
    return challenge;
  }

  async verifyOtp(args: {
    otpId: string;
    code: string;
    purpose: OtpPurpose;
    ctx: CustomerRequestContext;
  }) {
    const result = await this.otp.verify({
      otpId: args.otpId,
      code: args.code,
      purpose: args.purpose,
    });
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.CUSTOMER_OTP_VERIFIED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { purpose: args.purpose, otpId: args.otpId },
    });

    if (args.purpose === OtpPurpose.SIGNUP || args.purpose === OtpPurpose.MOBILE_CHANGE) {
      const { rawToken, expiresAt } = await this.verifiedMobile.issue(result.phone);
      return {
        verifiedMobileToken: rawToken,
        phone: result.phone,
        expiresInSeconds: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      };
    }
    if (args.purpose === OtpPurpose.FORGOT_PASSWORD) {
      // Only PHONE customers — FR-024. SOCIAL / unknown returns the same shape
      // with no token (no enumeration).
      const existing = await this.accounts.findByPhone(result.phone);
      if (!existing || existing.passwordHash === null) {
        return { passwordResetToken: undefined };
      }
      const { rawToken, expiresAt } = await this.passwordResetTokens.issue(existing.id);
      return {
        passwordResetToken: rawToken,
        expiresInSeconds: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      };
    }
    // PROFILE_MOBILE uses dedicated profile endpoints — verify-otp on this
    // generic endpoint is rejected (purpose-specific paths).
    throw new DomainException(ERROR_CODES.OTP_INVALID);
  }

  // -------------------------------------------------------------------------
  // SOCIAL sign-in (Google / Apple)
  // -------------------------------------------------------------------------

  async socialSignIn(args: {
    provider: SocialProvider;
    idToken: string;
    userInfo?: { email?: string; fullName?: string };
    ctx: CustomerRequestContext;
  }): Promise<{
    socialSessionId: string;
    provider: SocialProvider;
    profile: { email: string | null; fullName: string | null; emailVerified: boolean };
    existingCustomer: { id: string; maskedPhone: string | null } | null;
    newCustomer: { tokens: CustomerAuthResult } | null;
  }> {
    const identity = await this.verifyProviderToken(args.provider, args.idToken, args.userInfo);

    const link = await this.providers.findByProviderSubject(args.provider, identity.providerUserId);
    const expiresAt = new Date(Date.now() + CustomerAuthMobileService.SOCIAL_SESSION_TTL_MS);

    if (link) {
      // Returning social user — create a session, no SMS, no new customer.
      const session = await this.socialSessions.create({
        provider: args.provider,
        providerUserId: identity.providerUserId,
        email: identity.email,
        fullName: identity.fullName,
        resolvedCustomerId: link.customerId,
        expiresAt,
      });
      const existing = await this.accounts.findById(link.customerId);
      return {
        socialSessionId: session.id,
        provider: args.provider,
        profile: {
          email: identity.email,
          fullName: identity.fullName,
          emailVerified: identity.emailVerified,
        },
        existingCustomer: existing
          ? { id: existing.id, maskedPhone: maskPhone(existing.phone) }
          : null,
        newCustomer: null,
      };
    }

    // First-time social — create a lite SOCIAL customer + provider link + tokens.
    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await this.accounts.createSocialLite(
        {
          fullName: identity.fullName,
          email: identity.email,
        },
        tx,
      );
      await this.providers.link(
        {
          customerId: customer.id,
          provider: args.provider,
          providerUserId: identity.providerUserId,
          email: identity.email ?? null,
        },
        tx,
      );
      return customer;
    });

    await this.audit.write({
      actorId: null,
      targetId: created.id,
      eventType: AuditEventType.CUSTOMER_SIGNUP_SOCIAL_COMPLETED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: created.id, provider: args.provider },
    });

    const tokens = await this.issueSession({ customerId: created.id, ctx: args.ctx });
    return {
      socialSessionId: '', // unused on new-customer branch
      provider: args.provider,
      profile: {
        email: identity.email,
        fullName: identity.fullName,
        emailVerified: identity.emailVerified,
      },
      existingCustomer: null,
      newCustomer: { tokens },
    };
  }

  async socialLogin(args: {
    socialSessionId: string;
    ctx: CustomerRequestContext;
  }): Promise<CustomerAuthResult> {
    const session = await this.socialSessions.findById(args.socialSessionId);
    if (!session) throw new DomainException(ERROR_CODES.SOCIAL_SESSION_INVALID);
    if (session.consumedAt) throw new DomainException(ERROR_CODES.SOCIAL_SESSION_CONSUMED);
    if (session.expiresAt.getTime() < Date.now()) {
      throw new DomainException(ERROR_CODES.SOCIAL_SESSION_EXPIRED);
    }
    if (!session.resolvedCustomerId) {
      throw new DomainException(ERROR_CODES.SOCIAL_SESSION_INVALID);
    }
    await this.socialSessions.consume(session.id);
    return this.issueSession({ customerId: session.resolvedCustomerId, ctx: args.ctx });
  }

  // -------------------------------------------------------------------------
  // SOCIAL Complete-Profile mobile binding
  // -------------------------------------------------------------------------

  async profileMobileRequestOtp(args: {
    customerId: string;
    phone: string;
    locale: 'ar' | 'en';
    ctx: CustomerRequestContext;
  }) {
    const customer = await this.accounts.findById(args.customerId);
    if (!customer) throw new CustomerAccountInactiveException();
    if (customer.phone !== null) {
      throw new DomainException(ERROR_CODES.PHONE_MUTATION_ON_PHONE_CUSTOMER_FORBIDDEN);
    }
    const phone = canonicalisePhone(args.phone);

    // Pre-check collision before sending OTP — saves an SMS if mobile taken.
    const collision = await this.accounts.findByPhone(phone);
    if (collision && collision.id !== args.customerId) {
      throw new CustomerPhoneAlreadyRegisteredException();
    }

    const challenge = await this.otp.issue({
      phone,
      purpose: OtpPurpose.PROFILE_MOBILE,
      locale: args.locale,
      customerId: args.customerId,
      correlationId: args.ctx.correlationId,
    });
    await this.audit.write({
      actorId: args.customerId,
      targetId: args.customerId,
      eventType: AuditEventType.CUSTOMER_OTP_REQUESTED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { purpose: 'PROFILE_MOBILE', otpId: challenge.otpId },
    });
    return challenge;
  }

  async profileMobileVerifyOtp(args: {
    customerId: string;
    otpId: string;
    code: string;
    ctx: CustomerRequestContext;
  }): Promise<void> {
    const customer = await this.accounts.findById(args.customerId);
    if (!customer) throw new CustomerAccountInactiveException();
    if (customer.phone !== null) {
      throw new DomainException(ERROR_CODES.PHONE_MUTATION_ON_PHONE_CUSTOMER_FORBIDDEN);
    }

    const verified = await this.otp.verify({
      otpId: args.otpId,
      code: args.code,
      purpose: OtpPurpose.PROFILE_MOBILE,
    });
    if (verified.customerId !== args.customerId) {
      throw new DomainException(ERROR_CODES.OTP_INVALID);
    }

    try {
      await this.accounts.bindMobileVerified({
        customerId: args.customerId,
        phone: verified.phone,
      });
    } catch (err) {
      if (err instanceof CustomerAccountUniqueConflictError) {
        throw new CustomerPhoneAlreadyRegisteredException();
      }
      throw err;
    }

    await this.audit.write({
      actorId: args.customerId,
      targetId: args.customerId,
      eventType: AuditEventType.CUSTOMER_PROFILE_MOBILE_BOUND,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: args.customerId },
    });
  }

  // -------------------------------------------------------------------------
  // Password reset (PHONE only) + change (PHONE only)
  // -------------------------------------------------------------------------

  async resetPassword(args: {
    passwordResetToken: string;
    newPassword: string;
    ctx: CustomerRequestContext;
  }): Promise<CustomerAuthResult> {
    await this.password.validatePolicy(args.newPassword);
    const passwordHash = await this.password.hash(args.newPassword);

    const customerId = await this.prisma.$transaction(async (tx) => {
      const { customerId } = await this.passwordResetTokens.consume(args.passwordResetToken, tx);
      await this.accounts.updatePasswordHash({ customerId, passwordHash }, tx);
      return customerId;
    });

    // Revoke all other sessions, then issue fresh tokens to the requester.
    await this.refreshTokenRepo.revokeAllForCustomer(customerId);
    await this.audit.write({
      actorId: customerId,
      targetId: customerId,
      eventType: AuditEventType.CUSTOMER_PASSWORD_RESET,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId },
    });
    await this.audit.write({
      actorId: customerId,
      targetId: customerId,
      eventType: AuditEventType.CUSTOMER_TOKENS_REVOKED_OTHERS,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId, reason: 'password_reset' },
    });
    return this.issueSession({ customerId, ctx: args.ctx });
  }

  async changePassword(args: {
    customerId: string;
    currentPassword: string;
    newPassword: string;
    ctx: CustomerRequestContext;
  }): Promise<void> {
    const row = await this.accounts.findById(args.customerId);
    if (!row) throw new CustomerAccountInactiveException();
    if (row.passwordHash === null) {
      throw new DomainException(ERROR_CODES.PASSWORD_CHANGE_FORBIDDEN_FOR_SOCIAL);
    }

    const ok = await this.password.verify(args.currentPassword, row.passwordHash);
    if (!ok) throw new CustomerInvalidCredentialsException();

    if (args.currentPassword === args.newPassword) {
      throw new DomainException(ERROR_CODES.PASSWORD_SAME_AS_OLD);
    }

    await this.password.validatePolicy(args.newPassword);
    const newHash = await this.password.hash(args.newPassword);

    await this.accounts.updatePasswordHash({
      customerId: args.customerId,
      passwordHash: newHash,
    });
    await this.refreshTokenRepo.revokeAllForCustomer(args.customerId);
    await this.audit.write({
      actorId: args.customerId,
      targetId: args.customerId,
      eventType: AuditEventType.CUSTOMER_PASSWORD_CHANGED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: args.customerId },
    });
    await this.audit.write({
      actorId: args.customerId,
      targetId: args.customerId,
      eventType: AuditEventType.CUSTOMER_TOKENS_REVOKED_OTHERS,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: args.customerId, reason: 'password_change' },
    });
  }

  // -------------------------------------------------------------------------
  // Login wrapper that uses lockout
  // -------------------------------------------------------------------------

  async loginWithLockout(args: {
    phone: string;
    password: string;
    ctx: CustomerRequestContext;
  }): Promise<CustomerAuthResult> {
    const phone = canonicalisePhone(args.phone);
    await this.lockout.assertNotLocked(phone);

    const row = await this.accounts.findByPhone(phone);
    if (!row || row.passwordHash === null) {
      await this.lockout.recordFailure(phone);
      await this.audit.write({
        actorId: null,
        targetId: null,
        eventType: AuditEventType.CUSTOMER_LOGIN_FAILED,
        sourceIp: args.ctx.sourceIp,
        correlationId: args.ctx.correlationId,
        payload: { reason: 'unknown_or_social' },
      });
      throw new CustomerInvalidCredentialsException();
    }

    const ok = await this.password.verify(args.password, row.passwordHash);
    if (!ok) {
      await this.lockout.recordFailure(phone);
      await this.audit.write({
        actorId: null,
        targetId: row.id,
        eventType: AuditEventType.CUSTOMER_LOGIN_FAILED,
        sourceIp: args.ctx.sourceIp,
        correlationId: args.ctx.correlationId,
        payload: { customerId: row.id, reason: 'bad_password' },
      });
      throw new CustomerInvalidCredentialsException();
    }
    if (!row.isActive) throw new CustomerAccountInactiveException();

    await this.lockout.clearOnSuccess(phone);
    await this.accounts.updateLastLogin(row.id);
    await this.audit.write({
      actorId: row.id,
      targetId: row.id,
      eventType: AuditEventType.CUSTOMER_LOGGED_IN,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: row.id },
    });
    return this.issueSession({ customerId: row.id, ctx: args.ctx });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async verifyProviderToken(
    provider: SocialProvider,
    idToken: string,
    userInfo?: { email?: string; fullName?: string },
  ): Promise<VerifiedSocialIdentity> {
    if (provider === SocialProvider.GOOGLE) return this.google.verify(idToken);
    const appleResult = await this.apple.verify(idToken);
    return {
      providerUserId: appleResult.providerUserId,
      email: appleResult.email ?? userInfo?.email ?? null,
      fullName: appleResult.fullName ?? userInfo?.fullName ?? null,
      emailVerified: appleResult.emailVerified,
    };
  }

  private async issueSession(args: {
    customerId: string;
    ctx: CustomerRequestContext;
  }): Promise<CustomerAuthResult> {
    const refresh = await this.refreshTokens.issueForCustomer({
      customerId: args.customerId,
      userAgent: args.ctx.userAgent,
      sourceIp: args.ctx.sourceIp,
      mobileClientId: args.ctx.mobileClientId,
    });
    const { token: accessToken, expiresIn } = this.jwt.signAccessToken({ sub: args.customerId });
    const account = await this.accounts.findById(args.customerId);
    if (!account) throw new CustomerAccountInactiveException();
    return {
      accessToken,
      accessTokenExpiresIn: expiresIn,
      refresh,
      customer: this.toProfile(account),
    };
  }

  private toProfile(row: {
    id: string;
    phone: string | null;
    email: string | null;
    name: string;
    locale: string;
    isVerified: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
  }): CustomerProfileResponseDto {
    return {
      id: row.id,
      phone: row.phone ?? '',
      email: row.email ?? undefined,
      name: row.name,
      locale: row.locale,
      isVerified: row.isVerified,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : undefined,
    };
  }
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 4) return '••••';
  return `${phone.slice(0, 3)}••••••${phone.slice(-4)}`;
}
