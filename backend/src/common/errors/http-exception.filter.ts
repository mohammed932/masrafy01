import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
  ForbiddenException as NestForbiddenException,
  NotFoundException as NestNotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { DomainException } from './domain.exceptions';
import { ERROR_CODES, ERROR_HTTP_STATUS, type ErrorCode } from './error-codes';

interface ErrorResponseBody {
  success: false;
  code: ErrorCode;
  meta?: Record<string, unknown>;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const correlationId = (req as Request & { correlationId?: string }).correlationId;

    const body = this.toBody(exception);
    const status = ERROR_HTTP_STATUS[body.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    // Log full error context server-side. PII redaction is handled by Pino config.
    this.logger.warn({
      msg: 'http_error_emitted',
      code: body.code,
      status,
      correlationId,
      path: req.url,
      method: req.method,
      meta: body.meta,
      // raw exception detail (server-only)
      err:
        exception instanceof Error
          ? { name: exception.name, message: exception.message, stack: exception.stack }
          : exception,
    });

    res.status(status).json(body);
  }

  private toBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof DomainException) {
      return {
        success: false,
        code: exception.code,
        ...(exception.meta ? { meta: exception.meta } : {}),
      };
    }

    if (exception instanceof ThrottlerException) {
      return { success: false, code: ERROR_CODES.RATE_LIMITED };
    }

    if (exception instanceof UnauthorizedException) {
      return { success: false, code: ERROR_CODES.AUTH_TOKEN_INVALID };
    }
    if (exception instanceof NestForbiddenException) {
      return { success: false, code: ERROR_CODES.FORBIDDEN };
    }
    if (exception instanceof NestNotFoundException) {
      return { success: false, code: ERROR_CODES.NOT_FOUND };
    }

    if (exception instanceof BadRequestException) {
      const resp = exception.getResponse();
      const fields = this.extractValidationFields(resp);
      return {
        success: false,
        code: ERROR_CODES.VALIDATION_FAILED,
        ...(fields ? { meta: { fields } } : {}),
      };
    }

    if (exception instanceof HttpException) {
      // Nest built-in exception we didn't special-case; fold into internal_error
      // (do NOT leak Nest's English message).
      return { success: false, code: ERROR_CODES.INTERNAL_ERROR };
    }

    return { success: false, code: ERROR_CODES.INTERNAL_ERROR };
  }

  private extractValidationFields(resp: unknown): Record<string, string[]> | undefined {
    if (
      typeof resp === 'object' &&
      resp !== null &&
      'message' in resp &&
      Array.isArray((resp as { message: unknown }).message)
    ) {
      const messages = (resp as { message: string[] }).message;
      // class-validator default emits `propertyName must be ...` strings.
      const fields: Record<string, string[]> = {};
      for (const m of messages) {
        const idx = m.indexOf(' ');
        const field = idx > 0 ? m.slice(0, idx) : '_';
        if (!fields[field]) fields[field] = [];
        fields[field]!.push(m);
      }
      return fields;
    }
    return undefined;
  }
}
