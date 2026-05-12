import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.correlationId ?? '';
  },
);
