import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { AuthRefreshInvalidException } from '@/common/errors/domain.exceptions';
import {
  RefreshTokenAlreadyRotatedError,
  RefreshTokenRepository,
} from './refresh-token.repository';

const COOKIE_NAME = 'refreshToken';
const COOKIE_PATH = '/api/admin/auth/';

export interface IssueResult {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface VerifyAndRotateResult {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
  userId: string;
}

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly repo: RefreshTokenRepository,
  ) {}

  // ---- Cookie helpers ------------------------------------------------------

  setCookie(res: Response, rawToken: string): void {
    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'lax',
      domain: this.config.getOrThrow<string>('COOKIE_DOMAIN'),
      path: COOKIE_PATH,
      maxAge: this.config.getOrThrow<number>('REFRESH_TTL_SECONDS') * 1000,
    });
  }

  clearCookie(res: Response): void {
    res.cookie(COOKIE_NAME, '', {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'lax',
      domain: this.config.getOrThrow<string>('COOKIE_DOMAIN'),
      path: COOKIE_PATH,
      maxAge: 0,
    });
  }

  cookieName(): string {
    return COOKIE_NAME;
  }

  // ---- Token lifecycle -----------------------------------------------------

  async issueForUser(args: {
    userId: string;
    userAgent: string | null;
    sourceIp: string | null;
    rotatedFromId?: string | null;
  }): Promise<IssueResult> {
    const issued = this.generate();
    await this.repo.issue({
      userId: args.userId,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
      rotatedFromId: args.rotatedFromId ?? null,
      userAgent: args.userAgent,
      sourceIp: args.sourceIp,
    });
    return issued;
  }

  async verifyAndRotate(args: {
    rawCookieToken: string;
    userAgent: string | null;
    sourceIp: string | null;
  }): Promise<VerifyAndRotateResult> {
    const tokenHash = this.hash(args.rawCookieToken);
    const existing = await this.repo.lookupByHash(tokenHash);
    if (!existing) throw new AuthRefreshInvalidException();
    if (existing.revokedAt !== null) throw new AuthRefreshInvalidException();
    if (existing.expiresAt.getTime() <= Date.now()) throw new AuthRefreshInvalidException();

    const next = this.generate();
    try {
      await this.repo.rotate({
        oldId: existing.id,
        next: {
          userId: existing.userId,
          tokenHash: next.tokenHash,
          expiresAt: next.expiresAt,
          userAgent: args.userAgent,
          sourceIp: args.sourceIp,
        },
      });
    } catch (err) {
      if (err instanceof RefreshTokenAlreadyRotatedError) {
        throw new AuthRefreshInvalidException();
      }
      throw err;
    }

    return {
      rawToken: next.rawToken,
      tokenHash: next.tokenHash,
      expiresAt: next.expiresAt,
      userId: existing.userId,
    };
  }

  async revokeByRawCookie(rawCookieToken: string): Promise<void> {
    const tokenHash = this.hash(rawCookieToken);
    const row = await this.repo.lookupByHash(tokenHash);
    if (row && row.revokedAt === null) {
      await this.repo.revoke(row.id);
    }
  }

  // ---- Internals -----------------------------------------------------------

  private generate(): IssueResult {
    const raw = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(raw);
    const ttlSec = this.config.getOrThrow<number>('REFRESH_TTL_SECONDS');
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    return { rawToken: raw, tokenHash, expiresAt };
  }

  /**
   * SHA-256 hex of the raw token (research R-005). Constant-time comparison is
   * not applicable here because we look up by hash — but `timingSafeEqual` is
   * exposed so callers performing hash-vs-hash equality can keep it constant
   * time if needed.
   */
  hash(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _unusedConstantTime(a: Buffer, b: Buffer): boolean {
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
