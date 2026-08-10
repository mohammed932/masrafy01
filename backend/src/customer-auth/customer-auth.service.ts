import { Injectable, Logger } from '@nestjs/common';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  CustomerAccountInactiveException,
  CustomerInvalidCredentialsException,
} from '@/common/errors/domain.exceptions';
import { PasswordService } from '@/auth/password.service';
import { CustomerAccountRepository } from './customer-account.repository';
import { CustomerJwtTokenService } from './customer-jwt-token.service';
import { CustomerIssueResult, CustomerRefreshTokenService } from './customer-refresh-token.service';
import { CustomerProfileCompletenessService } from './customer-profile-completeness.service';
import { CustomerPendingMobileService } from './customer-pending-mobile.service';
import { S3StorageClient } from '@/documents/s3-storage.client';
import {
  mapCustomerProfile,
  type CustomerProfileResponseDto,
  type CustomerProfileRow,
} from './dto/customer-auth.dto';

export interface CustomerRequestContext {
  sourceIp: string;
  userAgent: string | null;
}

export interface CustomerAuthResult {
  accessToken: string;
  accessTokenExpiresIn: number;
  refresh: CustomerIssueResult;
  customer: CustomerProfileResponseDto;
}

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
    private readonly completeness: CustomerProfileCompletenessService,
    private readonly s3: S3StorageClient,
    private readonly pendingMobile: CustomerPendingMobileService,
  ) {}

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
      payload: { customerId: row.id },
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
      payload: { customerId: account.id },
    });
    return {
      accessToken,
      accessTokenExpiresIn: expiresIn,
      refresh: next,
      customer: await this.buildProfile(account),
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
      payload: { customerId: args.customerId },
    });
  }

  // ---- Me ------------------------------------------------------------------

  async me(customerId: string): Promise<CustomerProfileResponseDto> {
    const row = await this.accounts.findById(customerId);
    if (!row || !row.isActive) throw new CustomerAccountInactiveException();
    const photoUrl = await this.presignProfilePhoto(row.profilePhotoKey ?? null);
    return this.buildProfile(row, photoUrl);
  }

  /** Presigns a GET URL for the profile photo, or undefined when none uploaded. */
  private async presignProfilePhoto(key: string | null): Promise<string | undefined> {
    if (!key) return undefined;
    try {
      const { downloadUrl } = await this.s3.getPresignedGetUrl(key);
      return downloadUrl;
    } catch (err) {
      this.logger.warn(`profile photo presign failed: ${(err as Error).message}`);
      return undefined;
    }
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
    });
    const { token: accessToken, expiresIn } = this.jwt.signAccessToken({ sub: args.customerId });
    const account = await this.accounts.findById(args.customerId);
    if (!account) throw new CustomerAccountInactiveException();
    return {
      accessToken,
      accessTokenExpiresIn: expiresIn,
      refresh,
      customer: await this.buildProfile(account),
    };
  }

  private async buildProfile(
    row: CustomerProfileRow & { id: string },
    photoUrl?: string,
  ): Promise<CustomerProfileResponseDto> {
    const [profileComplete, pendingMobile] = await Promise.all([
      this.completeness.isComplete(row.id),
      this.pendingMobile.resolve({
        customerId: row.id,
        mobileVerifiedAt: row.mobileVerifiedAt,
      }),
    ]);
    return mapCustomerProfile(row, profileComplete, photoUrl, pendingMobile);
  }
}
