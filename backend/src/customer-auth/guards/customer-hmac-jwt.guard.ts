import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { CustomerJwtGuard } from './customer-jwt.guard';

/**
 * Composite guard: HMAC pinning + customer JWT, in that order.
 *
 * - HMAC runs first so an attacker without the device secret never reaches
 *   token verification.
 * - JWT verifies the customer Bearer token after HMAC succeeds; failure of
 *   either layer rejects the request.
 *
 * For endpoints where the JWT is OPTIONAL (e.g. apply, support requests),
 * use `OptionalCustomerJwtGuard` instead.
 */
@Injectable()
export class CustomerHmacJwtGuard implements CanActivate {
  constructor(
    private readonly hmac: MobileHmacGuard,
    private readonly jwt: CustomerJwtGuard,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const hmacOk = await this.hmac.canActivate(context);
    if (!hmacOk) return false;
    const jwtOk = await Promise.resolve(this.jwt.canActivate(context));
    return jwtOk as boolean;
  }
}
