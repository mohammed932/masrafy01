import type { Params as PinoParams } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

/**
 * PII redact paths per Constitution Principle VI.
 * Any new sensitive field added anywhere in the codebase MUST be appended here.
 */
export const REDACT_PATHS: readonly string[] = [
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.initialPassword',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.tokenHash',
  '*.accessToken',
  '*.refreshToken',
  // Feature 005 — agent activity logging
  'req.body.note',
  'req.body.attachedDocumentIds',
  'req.body.originalFilename',
  'res.body.data.activity.note',
  'res.body.data.activity.attachedDocuments',
  'res.body.data.applicantProfile.firstName',
  'res.body.data.applicantProfile.lastName',
  'res.body.data.applicantProfile.email',
  'res.body.data.applicantProfile.phone',
  'res.body.data.applicantProfile.nationalId',
  '*.note',
  '*.originalFilename',
];

export function pinoOptions(
  level: string,
  isProd: boolean,
): PinoParams {
  return {
    pinoHttp: {
      level,
      // Bind correlation ID to every log line on the request.
      genReqId: (req, res) => {
        const incoming = req.headers['x-correlation-id'];
        const cid = Array.isArray(incoming) ? incoming[0] : incoming;
        const value = typeof cid === 'string' && cid.length > 0 ? cid : randomUUID();
        res.setHeader('X-Correlation-Id', value);
        return value;
      },
      customProps: (req) => ({
        correlationId: (req as unknown as { correlationId?: string }).correlationId,
      }),
      redact: { paths: [...REDACT_PATHS], censor: '[Redacted]' },
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:standard' },
          },
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            // Headers excluding sensitive ones (already redacted, but list-cap noise).
            headers: undefined,
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    },
  };
}
