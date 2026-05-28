/**
 * Tiered rate limit (FR-066, research R9):
 *   - 30/h per authenticated customer (customer JWT subject)
 *   - 5/h per applicant fingerprint = sha256(nationalId) when present
 *       else sha256(`${customerId}:${sourceIp}`)
 *
 * Uses Redis INCR with a 1 h TTL window. On breach throws RateLimitedBucketException
 * with `meta.bucket` so the admin no-match insight knows which limit fired.
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { RedisService } from '@/infra/redis/redis.service';
import { RateLimitedBucketException } from '@/common/errors/domain.exceptions';

interface RateLimitRequest extends Request {
  applicantFingerprint?: string;
}

const WINDOW_SECONDS = 3600;

@Injectable()
export class MobileRateLimitGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RateLimitRequest>();
    const user = (req as Request & { user?: { sub?: string } }).user;
    const customerId = user?.sub ?? 'unknown';
    const sourceIp = req.ip ?? '0.0.0.0';

    const clientLimit = this.config.getOrThrow<number>('MOBILE_RATE_LIMIT_PER_CLIENT_PER_HOUR');
    const applicantLimit = this.config.getOrThrow<number>(
      'MOBILE_RATE_LIMIT_PER_APPLICANT_PER_HOUR',
    );

    await this.tick('customer', `rl:customer:${customerId}`, clientLimit);

    const body = (req.body ?? {}) as { nationalId?: string };
    const fingerprintSource = body.nationalId?.trim()
      ? body.nationalId.trim()
      : `${customerId}:${sourceIp}`;
    const fingerprint = createHash('sha256').update(fingerprintSource).digest('hex');
    req.applicantFingerprint = fingerprint;

    await this.tick('applicant_fingerprint', `rl:applicant:${fingerprint}`, applicantLimit);

    return true;
  }

  private async tick(
    bucket: 'customer' | 'applicant_fingerprint',
    key: string,
    limit: number,
  ): Promise<void> {
    const count = await this.redis.raw.incr(key);
    if (count === 1) {
      await this.redis.raw.expire(key, WINDOW_SECONDS);
    }
    if (count > limit) {
      const ttl = await this.redis.raw.ttl(key);
      throw new RateLimitedBucketException(bucket, ttl > 0 ? ttl : WINDOW_SECONDS);
    }
  }
}
