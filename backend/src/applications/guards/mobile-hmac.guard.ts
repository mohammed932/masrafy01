/**
 * Mobile HMAC-SHA256 request signing guard (Constitution Principle XIII).
 *
 * Required headers:
 *   X-Client-Id     — mobile-client identifier (looked up in env for dev, registry post-feature-005)
 *   X-Timestamp     — unix seconds; must be within MOBILE_HMAC_TIMESTAMP_TOLERANCE_SECONDS
 *   X-Nonce         — unique per request; stored in Redis until tolerance window closes
 *   X-Signature     — hex(HMAC_SHA256(secret, "{METHOD}\n{path}\n{ts}\n{nonce}\n{bodySha256}"))
 *   X-Body-SHA256   — hex sha256 of the raw request body (server re-computes and verifies)
 *
 * On success the guard attaches `req.mobileClientId` and `req.rawBodyHashHex` for downstream
 * use (idempotency key body-hash comparison).
 */
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { RedisService } from '@/infra/redis/redis.service';
import {
  HmacBodyHashMismatchException,
  HmacClientUnknownException,
  HmacHeaderMissingException,
  HmacNonceReplayException,
  HmacSignatureInvalidException,
  HmacTimestampSkewException,
} from '@/common/errors/domain.exceptions';

interface HmacRequest extends Request {
  rawBody?: Buffer;
  mobileClientId?: string;
  rawBodyHashHex?: string;
}

@Injectable()
export class MobileHmacGuard implements CanActivate {
  private readonly logger = new Logger(MobileHmacGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<HmacRequest>();

    const clientId = this.headerOrThrow(req, 'x-client-id');
    const timestampHeader = this.headerOrThrow(req, 'x-timestamp');
    const nonce = this.headerOrThrow(req, 'x-nonce');
    const signatureHex = this.headerOrThrow(req, 'x-signature');
    const bodyHashHeader = this.headerOrThrow(req, 'x-body-sha256');

    const secret = this.resolveSecret(clientId);
    const tolerance = this.config.getOrThrow<number>('MOBILE_HMAC_TIMESTAMP_TOLERANCE_SECONDS');

    const timestampSec = Number.parseInt(timestampHeader, 10);
    if (!Number.isFinite(timestampSec)) {
      throw new HmacTimestampSkewException({ toleranceSeconds: tolerance });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestampSec) > tolerance) {
      throw new HmacTimestampSkewException({ toleranceSeconds: tolerance });
    }

    const rawBody = req.rawBody ?? Buffer.alloc(0);
    const computedBodyHash = createHash('sha256').update(rawBody).digest('hex');
    if (!safeHexEqual(computedBodyHash, bodyHashHeader.toLowerCase())) {
      throw new HmacBodyHashMismatchException();
    }

    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    const canonical = `${method}\n${path}\n${timestampSec}\n${nonce}\n${computedBodyHash}`;
    const expectedSig = createHmac('sha256', secret).update(canonical).digest('hex');
    if (!safeHexEqual(expectedSig, signatureHex.toLowerCase())) {
      throw new HmacSignatureInvalidException();
    }

    const nonceKey = `mobile:nonce:${clientId}:${nonce}`;
    const setResult = await this.redis.raw.set(nonceKey, '1', 'EX', tolerance * 2, 'NX');
    if (setResult !== 'OK') {
      throw new HmacNonceReplayException();
    }

    req.mobileClientId = clientId;
    req.rawBodyHashHex = computedBodyHash;
    return true;
  }

  private headerOrThrow(req: HmacRequest, name: string): string {
    const value = req.headers[name];
    const v = Array.isArray(value) ? value[0] : value;
    if (!v || typeof v !== 'string') {
      throw new HmacHeaderMissingException(name);
    }
    return v;
  }

  private resolveSecret(clientId: string): string {
    const expectedId = this.config.getOrThrow<string>('MOBILE_CLIENT_ID');
    if (clientId !== expectedId) {
      throw new HmacClientUnknownException(clientId);
    }
    return this.config.getOrThrow<string>('MOBILE_CLIENT_SECRET');
  }
}

function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
