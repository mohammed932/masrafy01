import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from '@/audit/audit.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtTokenService } from './jwt-token.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { McpGuard } from './guards/mcp.guard';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RefreshTokenService } from './refresh-token.service';
import { SignInAttemptRepository } from './sign-in-attempt.repository';
import { LockoutService } from './lockout.service';
import { PasswordService } from './password.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { StaffAccountRepository } from '@/users/staff-account.repository';

@Module({
  imports: [
    AuditModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => {
        // Read once at boot, like every env value. `loadEnv` already refuses it under
        // NODE_ENV=production, so this can only ever be true on a developer's machine.
        const disabled = cfg.get<boolean>('THROTTLE_DISABLED') === true;
        return {
          throttlers: [{ name: 'default', limit: 100, ttl: 15 * 60 * 1000 }],
          // Module-wide, so it reaches every route's own `@Throttle` limit too — they all
          // override this one named throttler.
          skipIf: () => disabled,
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Infra (PrismaService/RedisService/HibpClient/CommonPasswordsService) come from
    // global InfraModule.
    PasswordService,
    AdminBootstrapService,
    StaffAccountRepository,
    SignInAttemptRepository,
    RefreshTokenRepository,
    RefreshTokenService,
    LockoutService,
    JwtTokenService,
    JwtStrategy,
    JwtAuthGuard,
    McpGuard,
    AuthService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    McpGuard,
    StaffAccountRepository,
    RefreshTokenService,
    PasswordService,
  ],
})
export class AuthModule {}
