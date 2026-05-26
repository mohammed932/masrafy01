import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { PasswordResetTokenRepository } from './password-reset-token.repository';

/**
 * Short-lived single-use token issued after a successful forgot-password
 * OTP verification. PHONE customers only — the controller / OTP-service
 * branch decides whether to issue one (SOCIAL customers get a no-op outcome
 * with no token, per FR-024).
 */
@Injectable()
export class PasswordResetTokenService {
  private static readonly TTL_MS = 15 * 60 * 1000;

  constructor(private readonly repo: PasswordResetTokenRepository) {}

  async issue(customerId: string): Promise<{ rawToken: string; expiresAt: Date }> {
    const raw = `prt_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hash(raw);
    const expiresAt = new Date(Date.now() + PasswordResetTokenService.TTL_MS);
    await this.repo.create({ customerId, tokenHash, expiresAt });
    return { rawToken: raw, expiresAt };
  }

  async consume(rawToken: string, tx?: Prisma.TransactionClient): Promise<{ customerId: string }> {
    const tokenHash = this.hash(rawToken);
    const row = await this.repo.findByHash(tokenHash);
    if (!row) throw new DomainException(ERROR_CODES.VERIFIED_MOBILE_TOKEN_INVALID); // reuse code symbolically
    if (row.consumedAt) throw new DomainException(ERROR_CODES.VERIFIED_MOBILE_TOKEN_CONSUMED);
    if (row.expiresAt.getTime() < Date.now()) {
      throw new DomainException(ERROR_CODES.VERIFIED_MOBILE_TOKEN_EXPIRED);
    }
    await this.repo.consume(row.id, tx);
    return { customerId: row.customerId };
  }

  private hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
