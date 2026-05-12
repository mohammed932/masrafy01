import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '@/infra/redis/redis.service';

/**
 * Sliding-window account lockout (research R-004, spec FR-031 / 031a / 031b).
 *
 *   key:    signin:fail:<canonical-email>
 *   member: random nonce per attempt
 *   score:  Date.now() (ms)
 *
 * On each failed attempt:
 *   1. ZADD signin:fail:<email> <now> <nonce>
 *   2. ZREMRANGEBYSCORE signin:fail:<email> -inf (now-WINDOW_MS)
 *   3. ZCARD signin:fail:<email>  → if ≥ FAILS_THRESHOLD ⇒ locked
 *   4. EXPIRE signin:fail:<email> EVICTION_SECONDS  (≥ 2× window for safety)
 *
 * On success: DEL the key. FR-031b: attempts DURING active lockout still
 * receive the rate-limited response but DO NOT push the window forward.
 */
@Injectable()
export class LockoutService {
  private static readonly FAILS_THRESHOLD = 5;
  private static readonly WINDOW_MS = 15 * 60 * 1000;
  private static readonly EVICTION_SECONDS = 30 * 60; // 2× window
  private static readonly KEY_PREFIX = 'signin:fail:';

  constructor(private readonly redis: RedisService) {}

  private key(email: string): string {
    return `${LockoutService.KEY_PREFIX}${email}`;
  }

  async isLockedOut(canonicalEmail: string): Promise<boolean> {
    const now = Date.now();
    const k = this.key(canonicalEmail);
    await this.redis.trimWindow(k, now - LockoutService.WINDOW_MS);
    const count = await this.redis.zcard(k);
    return count >= LockoutService.FAILS_THRESHOLD;
  }

  /**
   * Record a failed sign-in. NOOP when account is already in lockout state
   * (FR-031b: do not extend the window mid-lockout).
   */
  async recordFailure(canonicalEmail: string): Promise<void> {
    const now = Date.now();
    const k = this.key(canonicalEmail);
    await this.redis.trimWindow(k, now - LockoutService.WINDOW_MS);
    const count = await this.redis.zcard(k);
    if (count >= LockoutService.FAILS_THRESHOLD) {
      // Lockout already active. Do not append new score.
      return;
    }
    await this.redis.zaddNow(k, uuidv4(), now);
    await this.redis.expire(k, LockoutService.EVICTION_SECONDS);
  }

  async clearOnSuccess(canonicalEmail: string): Promise<void> {
    await this.redis.del(this.key(canonicalEmail));
  }
}
