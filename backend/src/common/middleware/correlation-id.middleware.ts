import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const HEADER = 'x-correlation-id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare module 'express' {
  interface Request {
    correlationId?: string;
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const correlationId =
      typeof candidate === 'string' && UUID_RE.test(candidate) ? candidate : uuidv4();

    req.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  }
}
