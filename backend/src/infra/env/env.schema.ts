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
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters (256 bits)'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),

  // Customer-facing mobile JWT (Constitution v1.7.0 / Principle XIII customer auth).
  // Separate secrets from admin so an admin token can never authenticate a
  // mobile customer flow and vice-versa. Mobile clients store the refresh
  // token in `flutter_secure_storage` and pass it in the request body — NOT a
  // cookie — so the longer TTL is fine.
  CUSTOMER_JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'CUSTOMER_JWT_ACCESS_SECRET must be at least 32 characters (256 bits)'),
  CUSTOMER_JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'CUSTOMER_JWT_REFRESH_SECRET must be at least 32 characters (256 bits)'),
  CUSTOMER_JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  CUSTOMER_JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),

  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  HIBP_BASE_URL: z.string().url().default('https://api.pwnedpasswords.com'),
  HIBP_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  HIBP_DISABLED: truthy.default('false'),

  COOKIE_DOMAIN: z.string().min(1),
  COOKIE_SECURE: truthy.default('false'),

  // Admin dashboard origin allow-list, comma-separated (read in `main.ts` before
  // Nest config is available — declared here so a missing/misspelled value fails
  // at boot instead of silently falling back to the dev origin in production.)
  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),

  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_NAME: z.string().min(2).max(120),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(128),

  // Read by `docker-entrypoint.sh` (shell, not node) — declared for validation
  // + documentation so the deploy contract lives in one place.
  SEED_ON_START: truthy.default('false'),

  // Convenience bootstrap super_admin created on EVERY boot by
  // `AdminBootstrapService`, bypassing the password policy. Anything other than
  // the literal 'false' leaves it ON, with weak built-in defaults — see the
  // service for the exact fallbacks.
  BOOTSTRAP_ADMIN_ENABLED: z.string().default('true'),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().min(2).max(120).optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1).max(128).optional(),

  // Mobile API rate-limit knobs (Constitution v3.0.0 / Principle XV).
  // Per-client = per authenticated customer; per-applicant = per (customer, nationalId).
  MOBILE_RATE_LIMIT_PER_CLIENT_PER_HOUR: z.coerce.number().int().positive().default(30),
  MOBILE_RATE_LIMIT_PER_APPLICANT_PER_HOUR: z.coerce.number().int().positive().default(5),

  // Feature 010 — the rate the calculator quotes when no bank program is chosen
  // (FR-030). Deliberately a platform-wide representative figure, NOT an average
  // of live programs: an average moves every time a bank is edited, so the same
  // inputs would silently return different answers day to day.
  CALCULATOR_REPRESENTATIVE_RATE_PERCENT: z.string().min(1).default('24.0000'),

  // S3-compatible object storage (feature 005). MinIO in dev, AWS S3 in prod.
  S3_ENDPOINT_URL: z.string().url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: truthy.default('true'),
  S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // Feature 008 — Mobile Authentication & Two-Path Registration (Constitution v1.8.0 / Principle XIII).
  // Admin-facing presigned read URL for National-ID images (per spec clarification Q2).
  ADMIN_DOCUMENT_PRESIGNED_READ_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  // SMS gateway for customer OTP. Dev: 'mock' logs the OTP via Pino with the
  // code masked. Production: Egyptian SMS gateway (vendor selection owned by
  // ops, not this feature). Spec FR-016/017 enforce that OTP is sent ONLY for
  // registration / forgot-password / mobile-change — never for login.
  SMS_GATEWAY_PROVIDER: z.enum(['mock']).default('mock'),
  SMS_GATEWAY_FROM: z.string().min(1).default('+201000000000'),

  // Fixed-OTP override. When set to a 6-digit string, every OTP issued
  // resolves to this fixed value (codeHash stored with bcrypt against this
  // fixed code). Empty string = disabled (random codes).
  //
  // Honoured in EVERY environment including production (the NODE_ENV guard was
  // removed on request, so the pre-launch prod deploy can be exercised without
  // a live SMS gateway). While set, phone verification proves nothing — anyone
  // who knows the code owns any phone number. MUST be emptied before public
  // launch; `CustomerOtpService` logs a warning on every issue while active.
  OTP_DEV_FIXED_CODE: z
    .string()
    .regex(/^\d{6}$|^$/u, 'OTP_DEV_FIXED_CODE must be 6 digits or empty')
    .default(''),

  // Google Sign-In OAuth audiences (iOS + Android client IDs, comma-separated).
  // verifyIdToken({ audience }) accepts the list to support both platforms.
  GOOGLE_OAUTH_CLIENT_IDS: z.string().min(1).default('replace_me.apps.googleusercontent.com'),
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
