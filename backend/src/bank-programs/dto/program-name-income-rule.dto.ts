/**
 * The catalog program name's income rule — what the name reads the income from, and
 * the figures every bank selling it starts from.
 *
 * Lives in `bank-programs/` rather than `platform-enumerations/` because the ROW is
 * the only part of this that belongs to the registry. Everything that decides whether
 * the body is acceptable — `IncomeAssumptionConfigDto`, `validateIncomeRule`, the
 * registry context it needs, the typed 422s — is already here, and importing it the
 * other way round would make the two modules circular (bank-programs already depends
 * on platform-enumerations, never the reverse).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { IncomeAssumptionConfig } from '@/matching/types';
import { IncomeAssumptionConfigDto } from './sub-configs/income-assumption-config.dto';

export class SetProgramNameIncomeRuleDto {
  /**
   * The rule, or `null` to say the name states nothing again.
   *
   * `null` is a real operation, not an omission: a name whose rule is cleared goes
   * back to "nobody has decided", which is what blocks the next surrogate program
   * from being filed under it until someone does. The clear is refused while any
   * program still inherits the figures (`INCOME_PROOF_IN_USE`).
   *
   * The rule NEVER carries `amounts` — that field says whose figures a BANK PROGRAM
   * uses, and a catalog name's figures are by definition its own. Sent anyway, it is
   * dropped rather than rejected: it is meaningless here, not wrong.
   */
  @ApiProperty({ type: IncomeAssumptionConfigDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => IncomeAssumptionConfigDto)
  incomeRule!: IncomeAssumptionConfigDto | null;

  /**
   * Estimate markers addressing the rule's own figures, rooted at `incomeRule.` —
   * `incomeRule.keyTable.professor.incomeEGP`, `incomeRule.bands.2.incomeEGP`.
   *
   * Sent WITH the rule, in one call, because they describe the same numbers: a save
   * that replaced the table and left the markers behind would point them at rows that
   * no longer exist.
   */
  @ApiPropertyOptional({
    type: Object,
    example: { 'incomeRule.keyTable.professor.incomeEGP': 'team_estimated' },
  })
  @IsOptional()
  @IsObject()
  valueSources?: Record<string, 'team_estimated'>;
}

/** What the catalog screen reads back after a write. */
export interface ProgramNameIncomeRuleResponseDto {
  programNameKey: string;
  labelAr: string;
  labelEn: string;
  incomeRule: IncomeAssumptionConfig | null;
  valueSources: Record<string, 'team_estimated'>;
  /**
   * The surrogate programs filed under this name, and whether each types its own
   * figures. The screen states "6 programs · 4 take these amounts · 2 set their own"
   * from this, and it is also what the operator needs in front of them before
   * changing the proof — the refusal names the same programs.
   */
  programs: Array<{ programCode: string; ownAmounts: boolean }>;
  /**
   * The surrogate product this name takes its calculation from, with the calculation
   * itself, or `null` when the name states its own rule.
   *
   * The RULE is carried, not just the key, and that is what the screen needs: `incomeRule`
   * above is NULL for a linked name, so without this the catalog page could render nothing
   * at all for the product it is selling. The screen shows this one read-only and links to
   * the product to edit it.
   */
  surrogateProduct: {
    key: string;
    labelAr: string;
    labelEn: string;
    active: boolean;
    incomeRule: IncomeAssumptionConfig | null;
  } | null;
}

/** One surrogate product in the picker / the product list. */
export interface SurrogateProductSummaryDto {
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  /** The proof it reads — `IncomeAssumptionConfig['strategy']`, or null when it states none. */
  strategy: string | null;
  /** Catalog names taking their calculation from it. Empty means nothing sells it yet. */
  usedBy: string[];
}

/** A surrogate product's own page: the calculation, and who uses it. */
export interface SurrogateProductDetailDto extends SurrogateProductSummaryDto {
  incomeRule: IncomeAssumptionConfig | null;
  valueSources: Record<string, 'team_estimated'>;
  /**
   * Every bank program reachable through this product — the names that link to it, and
   * the programs filed under each. What makes "who is affected if I change this" a
   * question the screen can answer before the operator changes it.
   */
  names: Array<{
    key: string;
    programs: Array<{ programCode: string; ownAmounts: boolean }>;
  }>;
}
