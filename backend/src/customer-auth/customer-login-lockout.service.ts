import { Injectable } from '@nestjs/common';
import { RedisService } from '@/infra/redis/redis.service';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';

/**
 * Customer login lockout — feature 008 / FR-022.
 *
 * Rules: 10 failed email+password attempts in any 15-minute sliding window
 * locks the account for 30 minutes. Once locked, every login attempt for that
 * email returns `ACCOUNT_LOCKED` with `meta.unlockAt`, regardless of whether
 * the supplied password would have been correct (deliberate — the lock is a
 * load-shedding signal, not a credentials signal).
 *
 * Storage: two Redis keys per identifier — a sliding-window sorted set of
 * failure timestamps and a fixed-TTL lockout marker.
 */
@Injectable()
export class CustomerLoginLockoutService {
  private static readonly WINDOW_MS = 15 * 60 * 1000;
  private static readonly MAX_FAILURES = 10;
  private static readonly LOCK_TTL_S = 30 * 60;

  constructor(private readonly redis: RedisService) {}

  async assertNotLocked(identifier: string): Promise<void> {
    const lockKey = this.lockKey(identifier);
    const unlockAtRaw = await this.redis.raw.get(lockKey);
    if (!unlockAtRaw) return;
    throw new DomainException(ERROR_CODES.ACCOUNT_LOCKED, {
      unlockAt: unlockAtRaw,
    });
  }

  async recordFailure(identifier: string): Promise<void> {
    const now = Date.now();
    const failKey = this.failKey(identifier);
    await this.redis.zaddNow(failKey, `${now}-${Math.random()}`, now);
    await this.redis.trimWindow(failKey, now - CustomerLoginLockoutService.WINDOW_MS);
    await this.redis.expire(failKey, CustomerLoginLockoutService.LOCK_TTL_S);

    const count = await this.redis.zcard(failKey);
    if (count >= CustomerLoginLockoutService.MAX_FAILURES) {
      const unlockAt = new Date(now + CustomerLoginLockoutService.LOCK_TTL_S * 1000).toISOString();
      await this.redis.raw.set(
        this.lockKey(identifier),
        unlockAt,
        'EX',
        CustomerLoginLockoutService.LOCK_TTL_S,
      );
    }
  }

  async clearOnSuccess(identifier: string): Promise<void> {
    await this.redis.raw.del(this.failKey(identifier), this.lockKey(identifier));
  }

  private failKey(identifier: string): string {
    return `customer:login:fail:${identifier}`;
  }

  private lockKey(identifier: string): string {
    return `customer:login:lock:${identifier}`;
  }
}
