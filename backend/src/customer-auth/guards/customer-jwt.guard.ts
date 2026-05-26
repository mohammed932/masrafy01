import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Strict customer JWT guard. Use on endpoints that must have a logged-in
 * customer (e.g. document upload, application claim, logout, /me).
 *
 * Pair with `MobileHmacGuard` via the composite `CustomerHmacJwtGuard` —
 * Constitution v1.7.0 / Principle XIII: authenticated mobile writes require
 * BOTH layers.
 */
@Injectable()
export class CustomerJwtGuard extends AuthGuard('customer-jwt') {}
