import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import type { Request } from 'express';
import type { JwtPayload } from '@/common/decorators/current-user.decorator';
import { PUBLIC_ROUTE_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      PUBLIC_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new DomainException(ERROR_CODES.AUTH_TOKEN_MISSING);
    }
    return super.canActivate(context) as boolean | Promise<boolean> | Observable<boolean>;
  }

  override handleRequest<TUser extends JwtPayload>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    if (err || !user) {
      // passport-jwt sets info.name === 'TokenExpiredError' on exp.
      const name =
        info && typeof info === 'object' && 'name' in info
          ? String((info as { name: unknown }).name)
          : '';
      if (name === 'TokenExpiredError') {
        throw new DomainException(ERROR_CODES.AUTH_TOKEN_EXPIRED);
      }
      throw new DomainException(ERROR_CODES.AUTH_TOKEN_INVALID);
    }
    return user;
  }
}
