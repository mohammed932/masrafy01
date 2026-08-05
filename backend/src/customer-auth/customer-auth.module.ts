import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';
import { InfraModule } from '@/infra/infra.module';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { AdminCustomerAccountsController } from './admin-customer-accounts.controller';
import { AdminCustomerAccountsService } from './admin-customer-accounts.service';
import { CustomerAccountRepository } from './customer-account.repository';
import { CustomerProfileDocumentRepository } from './customer-profile-document.repository';
import { CustomerProfileCompletenessService } from './customer-profile-completeness.service';
import { CustomerProfileCompleteGuard } from './guards/customer-profile-complete.guard';
import { CustomerRefreshTokenRepository } from './customer-refresh-token.repository';
import { CustomerRefreshTokenService } from './customer-refresh-token.service';
import { CustomerJwtTokenService } from './customer-jwt-token.service';
import { CustomerJwtStrategy } from './customer-jwt.strategy';
import { CustomerJwtGuard } from './guards/customer-jwt.guard';
// Feature 008 — Two-Path Registration providers.
import { CustomerAuthMobileService } from './customer-auth-mobile.service';
import { OtpChallengeRepository } from './otp-challenge.repository';
import { VerifiedMobileTokenRepository } from './verified-mobile-token.repository';
import { SocialSessionRepository } from './social-session.repository';
import { PasswordResetTokenRepository } from './password-reset-token.repository';
import { CustomerProviderRepository } from './customer-provider.repository';
import { CustomerOtpService } from './customer-otp.service';
import { VerifiedMobileTokenService } from './verified-mobile-token.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { CustomerLoginLockoutService } from './customer-login-lockout.service';
import { GoogleVerifyService } from './social/google-verify.service';
import { SMS_GATEWAY } from './sms/sms-gateway.interface';
import { MockSmsGateway } from './sms/mock-sms-gateway.service';
// S3 presign for the profile photo on GET /me. Registered directly (not via
// DocumentsModule) to avoid a circular import — DocumentsModule imports this
// module. S3StorageClient only depends on the global ConfigService.
import { S3StorageClient } from '@/documents/s3-storage.client';
import { PlatformEnumerationsModule } from '@/platform-enumerations/platform-enumerations.module';

/**
 * Customer-facing mobile auth (Constitution v3.0.0 / Principle XIII).
 *
 * Reuses `AuthModule`'s `PasswordService` (bcrypt + HIBP + common-list
 * policy) so customer accounts get the same password protection floor as
 * staff accounts. JWT secrets are separate from admin so a stolen admin
 * token can never authenticate a mobile flow. Mobile API authentication
 * is JWT-only — HMAC signing was removed in v3.0.0.
 */
@Module({
  imports: [
    AuditModule,
    AuthModule,
    InfraModule,
    PassportModule,
    // Governorate keys on a profile update are validated against the registry.
    // forwardRef: platform-enumerations imports this module for CustomerJwtGuard.
    forwardRef(() => PlatformEnumerationsModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('CUSTOMER_JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [CustomerAuthController, AdminCustomerAccountsController],
  providers: [
    CustomerAccountRepository,
    AdminCustomerAccountsService,
    CustomerProfileDocumentRepository,
    CustomerProfileCompletenessService,
    CustomerProfileCompleteGuard,
    CustomerRefreshTokenRepository,
    CustomerRefreshTokenService,
    CustomerJwtTokenService,
    CustomerJwtStrategy,
    CustomerJwtGuard,
    CustomerAuthService,
    // Feature 008 providers.
    OtpChallengeRepository,
    VerifiedMobileTokenRepository,
    SocialSessionRepository,
    PasswordResetTokenRepository,
    CustomerProviderRepository,
    CustomerOtpService,
    VerifiedMobileTokenService,
    PasswordResetTokenService,
    CustomerLoginLockoutService,
    GoogleVerifyService,
    { provide: SMS_GATEWAY, useClass: MockSmsGateway },
    CustomerAuthMobileService,
    S3StorageClient,
  ],
  exports: [
    CustomerAuthService,
    CustomerAccountRepository,
    CustomerProfileDocumentRepository,
    CustomerProfileCompletenessService,
    CustomerProfileCompleteGuard,
    CustomerJwtTokenService,
    CustomerJwtGuard,
    CustomerAuthMobileService,
  ],
})
export class CustomerAuthModule {}
