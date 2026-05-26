import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';
import { InfraModule } from '@/infra/infra.module';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { AdminCustomerAccountsController } from './admin-customer-accounts.controller';
import { CustomerAccountRepository } from './customer-account.repository';
import { CustomerRefreshTokenRepository } from './customer-refresh-token.repository';
import { CustomerRefreshTokenService } from './customer-refresh-token.service';
import { CustomerJwtTokenService } from './customer-jwt-token.service';
import { CustomerJwtStrategy } from './customer-jwt.strategy';
import { CustomerJwtGuard } from './guards/customer-jwt.guard';
import { CustomerHmacJwtGuard } from './guards/customer-hmac-jwt.guard';
import { OptionalCustomerJwtGuard } from './guards/optional-customer-jwt.guard';

/**
 * Customer-facing mobile auth (v1.7.0 / Principle XIII).
 *
 * Reuses `AuthModule`'s `PasswordService` (bcrypt + HIBP + common-list
 * policy) so customer accounts get the same password protection floor as
 * staff accounts. JWT secrets are separate from admin so a stolen admin
 * token can never authenticate a mobile flow.
 *
 * Mobile-only routes require HMAC pinning via the dedicated
 * `ApplicationsHmacModule` (provides `MobileHmacGuard` without dragging in
 * the entire applications module's request graph).
 */
@Module({
  imports: [
    AuditModule,
    AuthModule,
    InfraModule,
    PassportModule,
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
    CustomerRefreshTokenRepository,
    CustomerRefreshTokenService,
    CustomerJwtTokenService,
    CustomerJwtStrategy,
    CustomerJwtGuard,
    CustomerHmacJwtGuard,
    OptionalCustomerJwtGuard,
    MobileHmacGuard,
    CustomerAuthService,
  ],
  exports: [
    CustomerAuthService,
    CustomerAccountRepository,
    CustomerJwtTokenService,
    CustomerJwtGuard,
    CustomerHmacJwtGuard,
    OptionalCustomerJwtGuard,
  ],
})
export class CustomerAuthModule {}
