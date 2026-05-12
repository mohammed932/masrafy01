import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { StaffRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: StaffRole;
  mcp: boolean;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) {
      throw new Error('CurrentUser decorator used on a route without JwtAuthGuard');
    }
    return req.user;
  },
);
