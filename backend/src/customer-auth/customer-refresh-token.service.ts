import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { CustomerRefreshInvalidException } from '@/common/errors/domain.exceptions';
import {
  CustomerRefreshTokenAlreadyRotatedError,
  CustomerRefreshTokenRepository,
} from './customer-refresh-token.repository';

export interface CustomerIssueResult {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
  ttlSeconds: number;
}

export interface CustomerVerifyAndRotateResult extends CustomerIssueResult {
  customerId: string;
}

@Injectable()
export class CustomerRefreshTokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly repo: CustomerRefreshTokenRepository,
  ) {}

  async issueForCustomer(args: {
    customerId: string;
    userAgent: string | null;
    sourceIp: string | null;
  }): Promise<CustomerIssueResult> {
    const issued = this.generate();
    await this.repo.issue({
      customerId: args.customerId,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
      userAgent: args.userAgent,
      sourceIp: args.sourceIp,
    });
    return issued;
  }

  async verifyAndRotate(args: {
    rawToken: string;
    userAgent: string | null;
    sourceIp: string | null;
  }): Promise<CustomerVerifyAndRotateResult> {
    const tokenHash = this.hash(args.rawToken);
    const existing = await this.repo.lookupByHash(tokenHash);
    if (!existing) throw new CustomerRefreshInvalidException();
    if (existing.revokedAt !== null) throw new CustomerRefreshInvalidException();
    if (existing.expiresAt.getTime() <= Date.now()) throw new CustomerRefreshInvalidException();

    const next = this.generate();
    try {
      await this.repo.rotate({
        oldId: existing.id,
        next: {
          customerId: existing.customerId,
          tokenHash: next.tokenHash,
          expiresAt: next.expiresAt,
          userAgent: args.userAgent,
          sourceIp: args.sourceIp,
        },
      });
    } catch (err) {
      if (err instanceof CustomerRefreshTokenAlreadyRotatedError) {
        throw new CustomerRefreshInvalidException();
      }
      throw err;
    }

    return { ...next, customerId: existing.customerId };
  }

  async revoke(rawToken: string): Promise<void> {
    await this.repo.revokeByHash(this.hash(rawToken));
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  private generate(): CustomerIssueResult {
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = this.hash(raw);
    const ttlSeconds = this.config.getOrThrow<number>('CUSTOMER_JWT_REFRESH_TTL_SECONDS');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { rawToken: raw, tokenHash, expiresAt, ttlSeconds };
  }
}
