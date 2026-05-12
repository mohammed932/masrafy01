import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ERROR_HTTP_STATUS, type ErrorCode } from './error-codes';

/**
 * Carries a typed `code` and optional structured `meta`.
 * The HTTP exception filter serializes both into the response envelope.
 * Never put English message strings here destined for the client.
 */
export class DomainException extends HttpException {
  public readonly code: ErrorCode;
  public readonly meta?: Record<string, unknown>;

  constructor(code: ErrorCode, meta?: Record<string, unknown>) {
    super(
      { success: false, code, ...(meta ? { meta } : {}) },
      ERROR_HTTP_STATUS[code],
    );
    this.code = code;
    this.meta = meta;
  }
}

// --- Convenience subclasses -------------------------------------------------

export class AuthInvalidCredentialsException extends DomainException {
  constructor() {
    super(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }
}

export class AuthAccountInactiveException extends DomainException {
  constructor() {
    super(ERROR_CODES.AUTH_ACCOUNT_INACTIVE);
  }
}

export class AuthRefreshInvalidException extends DomainException {
  constructor() {
    super(ERROR_CODES.AUTH_REFRESH_INVALID);
  }
}

export class MustChangePasswordException extends DomainException {
  constructor() {
    super(ERROR_CODES.MUST_CHANGE_PASSWORD);
  }
}

export class InvalidCurrentPasswordException extends DomainException {
  constructor() {
    super(ERROR_CODES.INVALID_CURRENT_PASSWORD);
  }
}

export class PasswordTooShortException extends DomainException {
  constructor(min = 12) {
    super(ERROR_CODES.PASSWORD_TOO_SHORT, { min });
  }
}

export class PasswordTooLongException extends DomainException {
  constructor(max = 128) {
    super(ERROR_CODES.PASSWORD_TOO_LONG, { max });
  }
}

export class PasswordBreachedException extends DomainException {
  constructor() {
    super(ERROR_CODES.PASSWORD_BREACHED);
  }
}

export class PasswordOnCommonListException extends DomainException {
  constructor() {
    super(ERROR_CODES.PASSWORD_ON_COMMON_LIST);
  }
}

export class PasswordBreachCheckUnavailableException extends DomainException {
  constructor() {
    super(ERROR_CODES.PASSWORD_BREACH_CHECK_UNAVAILABLE);
  }
}

export class PasswordReusesResetValueException extends DomainException {
  constructor() {
    super(ERROR_CODES.PASSWORD_REUSES_RESET_VALUE);
  }
}

export class DuplicateEntryException extends DomainException {
  constructor(field: string) {
    super(ERROR_CODES.DUPLICATE_ENTRY, { field });
  }
}

export class NotFoundException extends DomainException {
  constructor() {
    super(ERROR_CODES.NOT_FOUND);
  }
}

export class CannotSelfModifyException extends DomainException {
  constructor() {
    super(ERROR_CODES.CANNOT_SELF_MODIFY);
  }
}

export class SuperAdminFloorViolatedException extends DomainException {
  constructor() {
    super(ERROR_CODES.SUPER_ADMIN_FLOOR_VIOLATED);
  }
}

export class ForbiddenException extends DomainException {
  constructor() {
    super(ERROR_CODES.FORBIDDEN);
  }
}

export class RateLimitedException extends DomainException {
  constructor() {
    super(ERROR_CODES.RATE_LIMITED);
  }
}
