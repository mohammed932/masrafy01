// Hand-written contract types matching specs/001-admin-auth-users/contracts/admin-api.openapi.yaml.
// DO NOT run `npm run gen:api` against this file — it would overwrite the named exports the
// rest of the codebase imports with raw `components['schemas'][...]` lookups. If you want
// codegen, regenerate to a separate file (e.g. `auth.openapi.types.ts`) and re-export from here.

export type StaffRole = 'super_admin' | 'sales_manager' | 'sales_agent' | 'analyst';

/** Roles creatable/updatable via the admin API (super_admin is bootstrap-only). */
export type CreatableRole = Exclude<StaffRole, 'super_admin'>;

export type ErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_ACCOUNT_INACTIVE'
  | 'AUTH_TOKEN_MISSING'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_REFRESH_INVALID'
  | 'FORBIDDEN'
  | 'MUST_CHANGE_PASSWORD'
  | 'INVALID_CURRENT_PASSWORD'
  | 'PASSWORD_TOO_SHORT'
  | 'PASSWORD_TOO_LONG'
  | 'PASSWORD_BREACHED'
  | 'PASSWORD_ON_COMMON_LIST'
  | 'PASSWORD_BREACH_CHECK_UNAVAILABLE'
  | 'PASSWORD_REUSES_RESET_VALUE'
  | 'DUPLICATE_ENTRY'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CANNOT_SELF_MODIFY'
  | 'SUPER_ADMIN_FLOOR_VIOLATED'
  | 'SCORING_VERSION_CONCURRENT_PROMOTION'
  | 'SCORING_VERSION_NOT_FOUND'
  | 'SCORING_VERSION_NO_ACTIVE'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_NOT_ALLOWED'
  | 'ENUMERATION_KEY_DUPLICATE'
  | 'ENUMERATION_SYSTEM_ONLY'
  | 'ENUMERATION_IN_USE'
  | 'ENUMERATION_DELETE_NOT_SUPPORTED'
  | 'BANK_NOT_FOUND'
  | 'BANK_NAME_DUPLICATE'
  | 'BANK_HAS_PROGRAMS'
  | 'BANK_CONFLICT_STALE_DATA'
  | 'RATE_LIMITED'
  // Figures-unavailable reasons (feature 010). Not thrown as errors — carried on
  // a quote as `figuresUnavailableReason` — but rendered through the SAME
  // localized catalog, so they belong in the same union (Principle III / A22).
  | 'MONEY_FIGURE_MISSING'
  | 'NO_RECOGNISED_INCOME'
  | 'OBLIGATIONS_EXCEED_ALLOWANCE'
  | 'BELOW_PROGRAM_MIN_AMOUNT'
  | 'AGE_AT_MATURITY'
  | 'PROGRAM_MISCONFIGURED'
  | 'INTERNAL_ERROR';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponseData {
  accessToken: string;
  accessTokenExpiresIn: number;
  user: AuthenticatedUser;
}

export interface RefreshResponseData {
  accessToken: string;
  accessTokenExpiresIn: number;
}

export interface PasswordChangeRequest {
  currentPassword?: string;
  newPassword: string;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface PaginatedEnvelope<T> {
  success: true;
  data: readonly T[];
  pagination: { page: number; pageSize: number; total: number };
}

export interface ErrorEnvelope {
  success: false;
  code: ErrorCode;
  meta?: Record<string, unknown>;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

// ---- User management (US3) -----------------------------------------------

export interface StaffAccountSummary {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateStaffRequest {
  name: string;
  email: string;
  role: CreatableRole;
  initialPassword: string;
}

export interface UpdateStaffRequest {
  name?: string;
  role?: StaffRole;
  isActive?: boolean;
}

export interface ResetPasswordRequest {
  newPassword: string;
}
