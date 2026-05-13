import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import type { JwtPayload } from '@/common/decorators/current-user.decorator';

export const MCP_BYPASS_KEY = 'mcp_bypass';

/**
 * Apply to PATCH /api/admin/auth/password and the `/auth/me` + `/auth/logout`
 * endpoints so a user with `mustChangePassword=true` can still authenticate
 * the change call. Every other endpoint gated by McpGuard rejects mcp=true
 * with MUST_CHANGE_PASSWORD so the client knows to route to the forced-change
 * screen.
 */
export const McpBypass = (): MethodDecorator & ClassDecorator => SetMetadata(MCP_BYPASS_KEY, true);

@Injectable()
export class McpGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const bypass = this.reflector.getAllAndOverride<boolean | undefined>(MCP_BYPASS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (bypass === true) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as JwtPayload | undefined;
    if (user?.mcp === true) {
      throw new DomainException(ERROR_CODES.MUST_CHANGE_PASSWORD);
    }
    return true;
  }
}
