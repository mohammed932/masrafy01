import { z } from 'zod';

const truthy = z
  .string()
  .transform((v) => v.toLowerCase())
  .refine((v) => ['true', 'false', '1', '0', 'yes', 'no'].includes(v), {
    message: 'must be a boolean-ish string',
  })
  .transform((v) => ['true', '1', 'yes'].includes(v));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters (256 bits)'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),

  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  HIBP_BASE_URL: z.string().url().default('https://api.pwnedpasswords.com'),
  HIBP_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  HIBP_DISABLED: truthy.default('false'),

  COOKIE_DOMAIN: z.string().min(1),
  COOKIE_SECURE: truthy.default('false'),

  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_NAME: z.string().min(2).max(120),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(128),

  // Mobile HMAC dev identity (feature 003). Production swap: feature-005 mobile-client registry.
  MOBILE_CLIENT_ID: z.string().min(1).default('dev'),
  MOBILE_CLIENT_SECRET: z.string().min(16),
  MOBILE_HMAC_TIMESTAMP_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  MOBILE_RATE_LIMIT_PER_CLIENT_PER_HOUR: z.coerce.number().int().positive().default(30),
  MOBILE_RATE_LIMIT_PER_APPLICANT_PER_HOUR: z.coerce.number().int().positive().default(5),

  // S3-compatible object storage (feature 005). MinIO in dev, AWS S3 in prod.
  S3_ENDPOINT_URL: z.string().url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: truthy.default('true'),
  S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const lines = Object.entries(flat.fieldErrors)
      .flatMap(([k, errs]) => (errs ?? []).map((e) => `  - ${k}: ${e}`))
      .join('\n');
    throw new Error(`Environment validation failed:\n${lines}`);
  }
  return parsed.data;
}
