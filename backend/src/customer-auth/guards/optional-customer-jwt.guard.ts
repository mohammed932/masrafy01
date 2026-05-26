import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerJwtTokenService } from '../customer-jwt-token.service';

/**
 * Soft customer-JWT extraction. Attaches `req.customerId` if a valid Bearer
 * token is present and skips silently otherwise — the upstream HMAC guard
 * already enforced authentication for anonymous catalog use. Wire this on
 * `/api/v1/apply` etc. so a guest application keeps working while a
 * logged-in customer's `applicantUserId` gets populated automatically.
 */
@Injectable()
export class OptionalCustomerJwtGuard implements CanActivate {
  constructor(private readonly customerJwt: CustomerJwtTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { customerId?: string }>();
    const header = req.headers.authorization;
    if (!header || typeof header !== 'string') return true;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return true;
    const token = match[1]?.trim();
    if (!token) return true;
    try {
      const payload = this.customerJwt.verifyAccessToken(token);
      if (payload.typ === 'customer' && typeof payload.sub === 'string') {
        req.customerId = payload.sub;
      }
    } catch {
      // Invalid token = treat as guest. Anonymous flows MUST still work.
    }
    return true;
  }
}
