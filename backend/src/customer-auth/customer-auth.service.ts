import { Injectable, Logger } from '@nestjs/common';
import { AuditEventType, Prisma } from '@prisma/client';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  CustomerAccountInactiveException,
  CustomerEmailAlreadyRegisteredException,
  CustomerGuestLinkWindowExpiredException,
  CustomerInvalidCredentialsException,
  CustomerPhoneAlreadyRegisteredException,
} from '@/common/errors/domain.exceptions';
import { PasswordService } from '@/auth/password.service';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { CustomerAccountRepository } from './customer-account.repository';
import { CustomerJwtTokenService } from './customer-jwt-token.service';
import {
  CustomerIssueResult,
  CustomerRefreshTokenService,
} from './customer-refresh-token.service';
import type { CustomerProfileResponseDto } from './dto/customer-auth.dto';

export interface CustomerRequestContext {
  sourceIp: string;
  userAgent: string | null;
  correlationId: string;
  mobileClientId: string | null;
}

export interface CustomerAuthResult {
  accessToken: string;
  accessTokenExpiresIn: number;
  refresh: CustomerIssueResult;
  customer: CustomerProfileResponseDto;
}

const GUEST_LINK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Canonicalise an Egyptian-format phone number into E.164. Accepts:
 *   +201001234567   → +201001234567
 *   201001234567    → +201001234567
 *   01001234567     → +201001234567 (local 0 → +20)
 *   +20 100 123 4567 → strip whitespace + dashes
 */
export function canonicalisePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-]/g, '');
  if (stripped.startsWith('+')) return stripped;
  if (stripped.startsWith('00')) return `+${stripped.slice(2)}`;
  if (stripped.startsWith('20')) return `+${stripped}`;
  if (stripped.startsWith('0')) return `+20${stripped.slice(1)}`;
  return `+${stripped}`;
}

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly accounts: CustomerAccountRepository,
    private readonly refreshTokens: CustomerRefreshTokenService,
    private readonly jwt: CustomerJwtTokenService,
    private readonly password: PasswordService,
    private readonly audit: AuditEventWriter,
    private readonly prisma: PrismaService,
  ) {}

  // ---- Signup --------------------------------------------------------------

  async signup(args: {
    phone: string;
    name: string;
    password: string;
    email?: string;
    locale?: string;
    ctx: CustomerRequestContext;
  }): Promise<CustomerAuthResult> {
    const phone = canonicalisePhone(args.phone);
    const email = args.email?.toLowerCase().trim() ?? null;

    await this.password.validatePolicy(args.password);
    const passwordHash = await this.password.hash(args.password);

    let created;
    try {
      created = await this.accounts.create({
        phone,
        name: args.name.trim(),
        passwordHash,
        email,
        locale: args.locale ?? 'ar-EG',
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target as string[] | string | undefined) ?? '';
        if (Array.isArray(target) ? target.includes('email') : String(target).includes('email')) {
          throw new CustomerEmailAlreadyRegisteredException();
        }
        throw new CustomerPhoneAlreadyRegisteredException();
      }
      throw err;
    }

    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.CUSTOMER_SIGNED_UP,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: created.id, mobileClientId: args.ctx.mobileClientId },
    });

    return this.issueSession({
      customerId: created.id,
      ctx: args.ctx,
    });
  }

  // ---- Login ---------------------------------------------------------------

  async login(args: {
    phone: string;
    password: string;
    ctx: CustomerRequestContext;
  }): Promise<CustomerAuthResult> {
    const phone = canonicalisePhone(args.phone);
    const row = await this.accounts.findByPhone(phone);
    if (!row) throw new CustomerInvalidCredentialsException();

    // Feature 008 / FR-023: SOCIAL customers have no password — surface the
    // same generic CUSTOMER_INVALID_CREDENTIALS to prevent enumeration.
    if (row.passwordHash === null) throw new CustomerInvalidCredentialsException();

    const ok = await this.password.verify(args.password, row.passwordHash);
    if (!ok) throw new CustomerInvalidCredentialsException();
    if (!row.isActive) throw new CustomerAccountInactiveException();

    await this.accounts.updateLastLogin(row.id);
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.CUSTOMER_LOGGED_IN,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: row.id, mobileClientId: args.ctx.mobileClientId },
    });

    return this.issueSession({ customerId: row.id, ctx: args.ctx });
  }

  // ---- Refresh -------------------------------------------------------------

  async refresh(args: {
    refreshToken: string;
    ctx: CustomerRequestContext;
  }): Promise<CustomerAuthResult> {
    const next = await this.refreshTokens.verifyAndRotate({
      rawToken: args.refreshToken,
      userAgent: args.ctx.userAgent,
      sourceIp: args.ctx.sourceIp,
      mobileClientId: args.ctx.mobileClientId,
    });
    const account = await this.accounts.findById(next.customerId);
    if (!account || !account.isActive) {
      throw new CustomerAccountInactiveException();
    }
    const { token: accessToken, expiresIn } = this.jwt.signAccessToken({ sub: account.id });
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.CUSTOMER_TOKEN_REFRESHED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: account.id },
    });
    return {
      accessToken,
      accessTokenExpiresIn: expiresIn,
      refresh: next,
      customer: this.toProfile(account),
    };
  }

  // ---- Logout --------------------------------------------------------------

  async logout(args: {
    refreshToken?: string;
    customerId: string;
    ctx: CustomerRequestContext;
  }): Promise<void> {
    if (args.refreshToken) {
      await this.refreshTokens.revoke(args.refreshToken);
    }
    await this.audit.write({
      actorId: null,
      targetId: null,
      eventType: AuditEventType.CUSTOMER_LOGGED_OUT,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { customerId: args.customerId },
    });
  }

  // ---- Me ------------------------------------------------------------------

  async me(customerId: string): Promise<CustomerProfileResponseDto> {
    const row = await this.accounts.findById(customerId);
    if (!row || !row.isActive) throw new CustomerAccountInactiveException();
    return this.toProfile(row);
  }

  // ---- Guest-claim ---------------------------------------------------------

  /**
   * Link the most-recent guest application created within the last 24h by the
   * caller's `mobileClientId` to the now-authenticated customer. Used when
   * the customer signs up AFTER seeing offers in the wizard.
   */
  async claimRecentGuestApplications(args: {
    customerId: string;
    mobileClientId: string;
    ctx: CustomerRequestContext;
  }): Promise<{ linkedApplicationIds: string[] }> {
    const since = new Date(Date.now() - GUEST_LINK_WINDOW_MS);
    const rows = await this.prisma.application.findMany({
      where: {
        mobileClientId: args.mobileClientId,
        applicantUserId: null,
        isGuest: true,
        createdAt: { gte: since },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    if (rows.length === 0) {
      throw new CustomerGuestLinkWindowExpiredException({
        mobileClientId: args.mobileClientId,
        windowHours: 24,
      });
    }
    const ids = rows.map((r) => r.id);
    await this.prisma.application.updateMany({
      where: { id: { in: ids } },
      data: { applicantUserId: args.customerId, isGuest: false },
    });
    for (const id of ids) {
      await this.audit.write({
        actorId: null,
        targetId: id,
        eventType: AuditEventType.CUSTOMER_GUEST_APP_LINKED,
        sourceIp: args.ctx.sourceIp,
        correlationId: args.ctx.correlationId,
        payload: { customerId: args.customerId, mobileClientId: args.mobileClientId },
      });
    }
    return { linkedApplicationIds: ids };
  }

  // ---- Internals -----------------------------------------------------------

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
    /**
     * Feature 008: nullable for SOCIAL customers pending the Complete-Profile
     * mobile-binding step. DTO surface keeps the field optional via `??`.
     */
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
