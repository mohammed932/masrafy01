import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import type { TransactionClient } from '@/common/transaction/transaction-client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { VerifiedMobileTokenRepository } from './verified-mobile-token.repository';

/**
 * Short-lived (15-min, single-use) bearer issued by `/auth/otp/verify` for
 * `purpose=SIGNUP`. Consumed by `/auth/signup/phone/complete` to create the
 * customer record.
 *
 * Token format: opaque 32-byte random hex (~64 chars) prefixed with `vmt_`.
 * Storage: SHA-256 of the raw token (matches the customer-refresh-token
 * pattern). 15-minute TTL.
 */
@Injectable()
export class VerifiedMobileTokenService {
  private static readonly TTL_MS = 15 * 60 * 1000;

  constructor(private readonly repo: VerifiedMobileTokenRepository) {}

  async issue(phone: string): Promise<{ rawToken: string; expiresAt: Date }> {
    const raw = `vmt_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hash(raw);
    const expiresAt = new Date(Date.now() + VerifiedMobileTokenService.TTL_MS);
    await this.repo.create({ tokenHash, phone, expiresAt });
    return { rawToken: raw, expiresAt };
  }

  /**
   * Validate + consume in a single atomic step. Throws domain exceptions on
   * invalid / expired / already-consumed.
   */
  async consume(rawToken: string, tx?: TransactionClient): Promise<{ phone: string }> {
    const tokenHash = this.hash(rawToken);
    const row = await this.repo.findByHash(tokenHash);
    if (!row) throw new DomainException(ERROR_CODES.VERIFIED_MOBILE_TOKEN_INVALID);
    if (row.consumedAt) throw new DomainException(ERROR_CODES.VERIFIED_MOBILE_TOKEN_CONSUMED);
    if (row.expiresAt.getTime() < Date.now()) {
      throw new DomainException(ERROR_CODES.VERIFIED_MOBILE_TOKEN_EXPIRED);
    }
    await this.repo.consume(row.id, tx);
    return { phone: row.phone };
  }

  private hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
