import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { StaffRole } from '@prisma/client';
import { ForbiddenException } from '@/common/errors/domain.exceptions';
import { ROLES_METADATA_KEY } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/decorators/current-user.decorator';

/**
 * Enforces role membership for routes decorated with `@Roles(...)`. Reads the
 * role from the request's JwtPayload (set by JwtAuthGuard) and matches against
 * the required set. Throws `FORBIDDEN` on mismatch — never reveals the allowed
 * set to the client.
 *
 * Routes WITHOUT the @Roles decorator are unaffected.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as JwtPayload | undefined;
    if (!user || !user.role) {
      throw new ForbiddenException();
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
