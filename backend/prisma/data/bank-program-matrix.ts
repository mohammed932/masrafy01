/**
 * Which predefined program the platform's demo banks each offer — the single
 * source of truth behind `seed-bank-programs.ts`.
 *
 * A bank program is never a bespoke marketing name: it is one bank's take on a
 * predefined program archetype (`platform_enumeration` where
 * `type = 'program_name'`, which carries the NAME and nothing else). The seed's
 * in-code fixture (`program-baselines.ts`) supplies plausible starting figures;
 * the bank supplies the SPREAD — its own rate, ceiling, income floor and fees.
 * That is exactly what a real comparison marketplace shows: the same product,
 * priced differently per bank.
 *
 * So this file holds only two things: which archetypes each bank sells, and how
 * that bank's terms deviate from the archetype baseline. No absolute figures,
 * no duplicated eligibility blobs.
 *
 * DEV DATA: postures are plausible Egyptian-market placeholders, not contracted
 * terms. Verify before any shared use.
 */

/** Short code used to build `programCode`; MUST be unique across banks. */
export const BANK_ALIASES: Readonly<Record<string, string>> = {
  'ABK Egypt': 'ABK',
  'Bank NXT': 'NXT',
  'National Bank of Egypt': 'NBE',
  'Banque Misr': 'BM',
  CIB: 'CIB',
  'QNB Al Ahli': 'QNB',
  'Banque du Caire': 'BDC',
  'ADIB Egypt': 'ADIB',
  'HSBC Egypt': 'HSBC',
  'Housing & Development Bank': 'HDB',
};

/** Category segment of `programCode`. */
export const CATEGORY_CODES: Readonly<Record<string, string>> = {
  personal: 'PER',
  car: 'CAR',
  mortgage: 'MTG',
  business: 'BIZ',
};

/**
 * How one bank's terms deviate from the archetype baseline. Every field is a
 * DELTA or a FACTOR — absolutes belong in `program-baselines.ts`, not here.
 */
export interface BankDelta {
  /** Added to the archetype's rate (fixed or variable, whichever it uses). */
  rateDeltaPercent?: string;
  /** Multiplies the archetype's EGP min / max loan amount. */
  minAmountFactor?: number;
  maxAmountFactor?: number;
  /** Added to the archetype's max tenor, clamped to ≥ minMonths. */
  tenorMaxMonthsDelta?: number;
  /** Multiplies the archetype's minimum monthly income. */
  minIncomeFactor?: number;
  /** Added to the archetype's DBR cap, clamped to 1..100. */
  dbrCapDeltaPercent?: string;
  /** Replaces the archetype's admin fee outright (banks quote this directly). */
  adminFeePercent?: string;
  isShariaCompliant?: boolean;
  /** Extra required documents on top of the archetype's list. */
  extraDocuments?: readonly string[];
  operatorTips?: readonly string[];
}

export interface BankOffering {
  /** `program_name` catalog key — MUST exist and be active. */
  catalogKey: string;
  category: 'personal' | 'car' | 'mortgage' | 'business';
  /** Program-specific deviation, layered on top of the bank posture below. */
  delta?: BankDelta;
}

/**
 * Bank-wide posture, applied to every offering that bank sells before the
 * per-offering delta. This is the bank's personality in one place: a public
 * bank prices low and lends conservatively, a premier bank prices low but only
 * to high earners, a digital challenger prices high and lends small and fast.
 */
export const BANK_POSTURE: Readonly<Record<string, BankDelta>> = {
  'ABK Egypt': { rateDeltaPercent: '-0.5000', maxAmountFactor: 1.1, adminFeePercent: '1.0000' },
  'Bank NXT': {
    rateDeltaPercent: '1.5000',
    maxAmountFactor: 0.7,
    tenorMaxMonthsDelta: -12,
    adminFeePercent: '2.5000',
    operatorTips: ['Fully digital onboarding — no branch visit required.'],
  },
  'National Bank of Egypt': {
    rateDeltaPercent: '-1.5000',
    maxAmountFactor: 0.9,
    adminFeePercent: '0.7500',
  },
  'Banque Misr': { rateDeltaPercent: '-1.2500', maxAmountFactor: 0.9, adminFeePercent: '0.7500' },
  CIB: { rateDeltaPercent: '-0.2500', maxAmountFactor: 1.3, adminFeePercent: '1.2500' },
  'QNB Al Ahli': { rateDeltaPercent: '0.2500', maxAmountFactor: 1.1, adminFeePercent: '1.0000' },
  'Banque du Caire': {
    rateDeltaPercent: '0.7500',
    maxAmountFactor: 0.8,
    minIncomeFactor: 0.85,
    adminFeePercent: '1.5000',
  },
  'ADIB Egypt': {
    rateDeltaPercent: '-0.7500',
    maxAmountFactor: 1.0,
    isShariaCompliant: true,
    adminFeePercent: '1.0000',
    operatorTips: ['Murabaha structure — quote the profit rate, never "interest".'],
  },
  'HSBC Egypt': {
    rateDeltaPercent: '-1.7500',
    maxAmountFactor: 1.5,
    minIncomeFactor: 2.5,
    adminFeePercent: '1.0000',
    operatorTips: ['Premier segment — check relationship tier before quoting.'],
  },
  'Housing & Development Bank': {
    rateDeltaPercent: '-2.0000',
    maxAmountFactor: 1.0,
    adminFeePercent: '1.0000',
  },
};

/**
 * bank `nameEnglish` (matching `seed-banks.ts`) → the archetypes it sells.
 * Every one of the four retail categories is covered (Principle II).
 */
export const MATRIX: Readonly<Record<string, readonly BankOffering[]>> = {
  'ABK Egypt': [
    { catalogKey: 'doctor', category: 'personal' },
    { catalogKey: 'bankers', category: 'personal' },
    { catalogKey: 'private_sector', category: 'personal' },
    { catalogKey: 'new_car', category: 'car' },
    { catalogKey: 'home_purchase', category: 'mortgage' },
    { catalogKey: 'working_capital', category: 'business' },
  ],
  'Bank NXT': [
    { catalogKey: 'youth', category: 'personal', delta: { maxAmountFactor: 0.9 } },
    { catalogKey: 'private_sector', category: 'personal' },
    { catalogKey: 'used_car', category: 'car' },
    { catalogKey: 'home_finishing', category: 'mortgage' },
    { catalogKey: 'working_capital', category: 'business', delta: { minIncomeFactor: 0.8 } },
  ],
  'National Bank of Egypt': [
    { catalogKey: 'govt_employee', category: 'personal' },
    { catalogKey: 'armed_forces', category: 'personal', delta: { rateDeltaPercent: '-2.5000' } },
    { catalogKey: 'pensioner', category: 'personal' },
    { catalogKey: 'new_car', category: 'car' },
    { catalogKey: 'home_purchase', category: 'mortgage', delta: { maxAmountFactor: 1.2 } },
  ],
  'Banque Misr': [
    { catalogKey: 'govt_employee', category: 'personal' },
    { catalogKey: 'police', category: 'personal', delta: { rateDeltaPercent: '-2.5000' } },
    { catalogKey: 'new_car', category: 'car' },
    { catalogKey: 'home_purchase', category: 'mortgage' },
    { catalogKey: 'equipment_finance', category: 'business' },
  ],
  CIB: [
    { catalogKey: 'private_sector', category: 'personal' },
    { catalogKey: 'professional', category: 'personal' },
    { catalogKey: 'doctor', category: 'personal', delta: { maxAmountFactor: 1.5 } },
    { catalogKey: 'new_car', category: 'car' },
    { catalogKey: 'home_purchase', category: 'mortgage' },
    { catalogKey: 'working_capital', category: 'business' },
    { catalogKey: 'pharmacy', category: 'business' },
  ],
  'QNB Al Ahli': [
    { catalogKey: 'private_sector', category: 'personal' },
    { catalogKey: 'bankers', category: 'personal' },
    { catalogKey: 'used_car', category: 'car' },
    { catalogKey: 'home_purchase', category: 'mortgage', delta: { maxAmountFactor: 1.5 } },
  ],
  'Banque du Caire': [
    { catalogKey: 'govt_employee', category: 'personal' },
    { catalogKey: 'pensioner', category: 'personal' },
    { catalogKey: 'pharmacy', category: 'personal' },
    { catalogKey: 'used_car', category: 'car' },
    { catalogKey: 'working_capital', category: 'business' },
  ],
  'ADIB Egypt': [
    { catalogKey: 'private_sector', category: 'personal' },
    { catalogKey: 'new_car', category: 'car' },
    { catalogKey: 'home_purchase', category: 'mortgage' },
    { catalogKey: 'equipment_finance', category: 'business' },
  ],
  'HSBC Egypt': [
    { catalogKey: 'professional', category: 'personal' },
    { catalogKey: 'bankers', category: 'personal' },
    { catalogKey: 'home_purchase', category: 'mortgage' },
  ],
  'Housing & Development Bank': [
    { catalogKey: 'home_purchase', category: 'mortgage' },
    { catalogKey: 'home_finishing', category: 'mortgage' },
    { catalogKey: 'private_sector', category: 'personal' },
  ],
};
