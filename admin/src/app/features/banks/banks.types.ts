export interface Bank {
  id: string;
  nameArabic: string;
  nameEnglish: string;
  logoS3Key?: string | null;
  websiteUrl?: string | null;
  isActive: boolean;
  /** Phase-1 partner-bank flag. Mobile ranking uses it as a final tiebreaker. */
  isFeatured: boolean;
  displayOrder: number;
  notes?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BankWithProgramCount extends Bank {
  programCount: number;
}

export interface BankProgramSummary {
  id: string;
  programCode: string;
  friendlyName: string;
  friendlyNameAr?: string | null;
  /** Predefined catalog archetype this program instantiates. */
  programNameKey?: string | null;
  productCategory: string;
  active: boolean;
  isShariaCompliant: boolean;
  version: number;
  /** Headline rate — fixed base rate, or current effective rate when variable. */
  ratePercent?: string | null;
  isVariableRate: boolean;
  minAmountEGP?: string | null;
  maxAmountEGP?: string | null;
  minMonths?: number | null;
  maxMonths?: number | null;
  updatedAt: string;
}

export interface BankCreatePayload {
  nameArabic: string;
  nameEnglish: string;
  websiteUrl?: string;
  notes?: string;
  displayOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface BankUpdatePayload {
  version: number;
  nameArabic?: string;
  nameEnglish?: string;
  websiteUrl?: string | null;
  notes?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface BankToggle {
  version: number;
  isActive: boolean;
}

export interface BankPresignedLogo {
  key: string;
  uploadUrl: string;
  expiresAt: string;
}
