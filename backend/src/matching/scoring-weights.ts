/**
 * Approval probability scoring weights (FR-033, FR-034).
 * Constitution Principle V: pure configuration, no side effects.
 * Weight changes require PR review + historical impact analysis (Anti-pattern A24).
 */
export const SCORING_WEIGHTS = {
  BASE: 70,
  PREVIOUS_REJECTION: -30,
  AGE_NEAR_MIN: -10,
  HIGH_DBR: -20,
  INCOME_NEAR_MIN: -10,
  NOT_CAT_A: -15,
  HAS_CD_AT_ABK: 15,
  LONG_TENURE: 10,
  PAYROLL_TRANSFER: 10,
  BANKERS_PROGRAM: 20,
  PENSIONS_PROGRAM: 15,
  CLAMP_MIN: 10,
  CLAMP_MAX: 95,
} as const;
