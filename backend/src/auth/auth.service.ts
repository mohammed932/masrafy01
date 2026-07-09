import { Injectable } from '@nestjs/common';
import { AttemptOutcome } from './dto/enums';
import type { StaffRole } from '@/common/enums/staff-role.enum';
import { AuditEventType } from '@/common/audit/audit-event-types';
import {
  AuthAccountInactiveException,
  AuthInvalidCredentialsException,
  InvalidCurrentPasswordException,
  PasswordReusesResetValueException,
  RateLimitedException,
} from '@/common/errors/domain.exceptions';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { PasswordService } from './password.service';
import {
  canonicaliseEmail,
  type StaffAccountForLogin,
  StaffAccountRepository,
} from '@/users/staff-account.repository';
import { LockoutService } from './lockout.service';
import { JwtTokenService } from './jwt-token.service';
import { RefreshTokenService, type IssueResult } from './refresh-token.service';
import { SignInAttemptRepository } from './sign-in-attempt.repository';
import type { AuthenticatedUserDto } from './dto/login.response.dto';
import type { JwtPayload } from '@/common/decorators/current-user.decorator';

export interface RequestContext {
  sourceIp: string;
  userAgent: string | null;
}

export interface LoginOk {
  accessToken: string;
  accessTokenExpiresIn: number;
  refresh: IssueResult;
  user: AuthenticatedUserDto;
}

export interface RefreshOk {
  accessToken: string;
  accessTokenExpiresIn: number;
  refresh: IssueResult;
}

export interface ChangePasswordOk {
  accessToken: string;
  accessTokenExpiresIn: number;
  refresh: IssueResult;
  user: AuthenticatedUserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly accounts: StaffAccountRepository,
    private readonly attempts: SignInAttemptRepository,
    private readonly refreshTokens: RefreshTokenService,
    private readonly lockout: LockoutService,
    private readonly jwt: JwtTokenService,
    private readonly password: PasswordService,
    private readonly audit: AuditEventWriter,
  ) {}

  // ---- Login ---------------------------------------------------------------

  async login(rawEmail: string, plain: string, ctx: RequestContext): Promise<LoginOk> {
    const { email } = canonicaliseEmail(rawEmail);

    if (await this.lockout.isLockedOut(email)) {
      await this.attempts.record({
        userId: null,
        emailAttempted: email,
        outcome: AttemptOutcome.LOCKED_OUT,
        sourceIp: ctx.sourceIp,
        userAgent: ctx.userAgent,
      });
      await this.audit.write({
        actorId: null,
        targetId: null,
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        sourceIp: ctx.sourceIp,
        payload: { outcome: 'LOCKED_OUT' },
      });
      throw new RateLimitedException();
    }

    const row = await this.accounts.findForLogin(email);

    if (!row) {
      await this.recordFailure(null, email, AttemptOutcome.WRONG_CREDENTIALS, ctx);
      throw new AuthInvalidCredentialsException();
    }

    const ok = await this.password.verify(plain, row.passwordHash);
    if (!ok) {
      await this.recordFailure(row.id, email, AttemptOutcome.WRONG_CREDENTIALS, ctx);
      throw new AuthInvalidCredentialsException();
    }

    if (!row.isActive) {
      // FR-004: deactivated MUST be distinguishable from invalid credentials
      // ONLY because the credentials matched. To avoid leaking active-account
      // status to attackers we still match SAME-content semantics for the
      // case where the email is unknown vs wrong password (handled above by
      // returning the same exception). Here credentials genuinely matched.
      await this.recordFailure(row.id, email, AttemptOutcome.ACCOUNT_INACTIVE, ctx);
      throw new AuthAccountInactiveException();
    }

    // Success path -----------------------------------------------------------
    await this.lockout.clearOnSuccess(email);
    await this.accounts.updateLastLogin(row.id);
    await this.attempts.record({
      userId: row.id,
      emailAttempted: email,
      outcome: AttemptOutcome.SUCCESS,
      sourceIp: ctx.sourceIp,
      userAgent: ctx.userAgent,
    });
    await this.audit.write({
      actorId: row.id,
      targetId: null,
      eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
      sourceIp: ctx.sourceIp,
    });

    const refresh = await this.refreshTokens.issueForUser({
      userId: row.id,
      userAgent: ctx.userAgent,
      sourceIp: ctx.sourceIp,
    });

    const { token: accessToken, expiresIn } = this.jwt.signAccessToken({
      sub: row.id,
      role: row.role as StaffRole,
      mcp: row.mustChangePassword,
    });

    return {
      accessToken,
      accessTokenExpiresIn: expiresIn,
      refresh,
      user: this.toAuthenticatedUser(row),
    };
  }

  private async recordFailure(
    userId: string | null,
    email: string,
    outcome: AttemptOutcome,
    ctx: RequestContext,
  ): Promise<void> {
    await this.lockout.recordFailure(email);
    await this.attempts.record({
      userId,
      emailAttempted: email,
      outcome,
      sourceIp: ctx.sourceIp,
      userAgent: ctx.userAgent,
    });
    await this.audit.write({
      actorId: userId,
      targetId: null,
      eventType: AuditEventType.AUTH_LOGIN_FAILURE,
      sourceIp: ctx.sourceIp,
      payload: { outcome },
    });
  }

  // ---- Refresh -------------------------------------------------------------

  async refresh(rawCookieToken: string, ctx: RequestContext): Promise<RefreshOk> {
    const next = await this.refreshTokens.verifyAndRotate({
      rawCookieToken,
      userAgent: ctx.userAgent,
      sourceIp: ctx.sourceIp,
    });
    const account = await this.accounts.findById(next.userId);
    if (!account || !account.isActive) {
      // Account was deactivated since the refresh token was issued.
      throw new AuthAccountInactiveException();
    }

    const { token: accessToken, expiresIn } = this.jwt.signAccessToken({
      sub: account.id,
      role: account.role,
      mcp: account.mustChangePassword,
    });

    await this.audit.write({
      actorId: account.id,
      targetId: null,
      eventType: AuditEventType.AUTH_TOKEN_REFRESHED,
      sourceIp: ctx.sourceIp,
    });

    return {
      accessToken,
      accessTokenExpiresIn: expiresIn,
      refresh: {
        rawToken: next.rawToken,
        tokenHash: next.tokenHash,
        expiresAt: next.expiresAt,
      },
    };
  }

  // ---- Logout --------------------------------------------------------------

  async logout(rawCookieToken: string | undefined, ctx: RequestContext): Promise<void> {
    if (!rawCookieToken) return; // idempotent
    const tokenHash = this.refreshTokens.hash(rawCookieToken);
    // Look up actor (if still active) for audit attribution; missing/expired is fine.
    // We avoid surfacing identity through this path.
    await this.refreshTokens.revokeByRawCookie(rawCookieToken);
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.AUTH_LOGOUT,
      sourceIp: ctx.sourceIp,
      payload: { tokenHashPrefix: tokenHash.slice(0, 8) },
    });
  }

  // ---- Me ------------------------------------------------------------------

  async me(jwt: JwtPayload): Promise<AuthenticatedUserDto> {
    const account = await this.accounts.findById(jwt.sub);
    if (!account || !account.isActive) {
      throw new AuthAccountInactiveException();
    }
    return this.toAuthenticatedUser({
      ...account,
      passwordHash: '', // not used downstream
    });
  }

  // ---- Change password -----------------------------------------------------

  async changePassword(args: {
    jwt: JwtPayload;
    currentPassword: string | undefined;
    newPassword: string;
    ctx: RequestContext;
  }): Promise<ChangePasswordOk> {
    const account = await this.accounts.findForLoginById(args.jwt.sub);
    if (!account || !account.isActive) {
      throw new AuthAccountInactiveException();
    }

    if (!args.jwt.mcp) {
      // Standard self-change: require current password verification (FR-026).
      if (!args.currentPassword) {
        throw new InvalidCurrentPasswordException();
      }
      const ok = await this.password.verify(args.currentPassword, account.passwordHash);
      if (!ok) {
        throw new InvalidCurrentPasswordException();
      }
    } else {
      // Forced change: new password MUST differ from the just-set value
      // (FR-026c). Verify the candidate against the current hash.
      const same = await this.password.verify(args.newPassword, account.passwordHash);
      if (same) {
        throw new PasswordReusesResetValueException();
      }
    }

    await this.password.validatePolicy(args.newPassword);
    const hash = await this.password.hash(args.newPassword);

    await this.accounts.updatePasswordAndClearMcpTx({
      userId: account.id,
      newPasswordHash: hash,
    });

    // Always emit AUTH_PASSWORD_CHANGED; on forced change ALSO emit
    // AUTH_PASSWORD_FORCED_CHANGE_COMPLETED (FR-026d).
    await this.audit.write({
      actorId: account.id,
      targetId: null,
      eventType: AuditEventType.AUTH_PASSWORD_CHANGED,
      sourceIp: args.ctx.sourceIp,
      payload: { forcedChange: args.jwt.mcp },
    });
    if (args.jwt.mcp) {
      await this.audit.write({
        actorId: account.id,
        targetId: null,
        eventType: AuditEventType.AUTH_PASSWORD_FORCED_CHANGE_COMPLETED,
        sourceIp: args.ctx.sourceIp,
      });
    }

    // Re-fetch fresh state (mcp cleared, etc.).
    const fresh = await this.accounts.findById(account.id);
    if (!fresh) throw new AuthAccountInactiveException();

    const refresh = await this.refreshTokens.issueForUser({
      userId: fresh.id,
      userAgent: args.ctx.userAgent,
      sourceIp: args.ctx.sourceIp,
    });
    const { token: accessToken, expiresIn } = this.jwt.signAccessToken({
      sub: fresh.id,
      role: fresh.role,
      mcp: fresh.mustChangePassword,
    });

    return {
      accessToken,
      accessTokenExpiresIn: expiresIn,
      refresh,
      user: this.toAuthenticatedUser({
        ...fresh,
        passwordHash: '',
      }),
    };
  }

  // ---- Internals -----------------------------------------------------------

  private toAuthenticatedUser(row: StaffAccountForLogin): AuthenticatedUserDto {
    return {
      id: row.id,
      name: row.name,
      email: row.emailDisplay,
      role: row.role,
      mustChangePassword: row.mustChangePassword,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    };
  }
}
