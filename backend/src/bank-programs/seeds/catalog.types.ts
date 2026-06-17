import type { CreateBankProgramDto } from '../dto/create-bank-program.dto';

export interface SeedCatalog {
  name: string;
  /** Seeds always pin an explicit, stable programCode (optional on the API DTO). */
  programs: (CreateBankProgramDto & { programCode: string })[];
  expectedRates: Record<string, string>;
}

export interface SeedEntryResult {
  programCode: string;
  status: 'created' | 'skipped';
  ratePercent: string;
}

export interface SeedRunResult {
  catalogName: string;
  entries: SeedEntryResult[];
}
