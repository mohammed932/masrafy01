import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Strict customer JWT guard. Use on every `/api/v1/*` endpoint. Constitution
 * v3.0.0 / Principle XIII: the mobile API is JWT-only — HMAC signing was
 * removed. Returns 401 if the Bearer token is missing or invalid.
 */
@Injectable()
export class CustomerJwtGuard extends AuthGuard('customer-jwt') {}
