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
import { IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { IncomeAssumptionConfig } from '@/matching/types';
import type { ProductTemplate } from '@/matching/pipeline/product-template';
import type { TemplateStarter } from '@/matching/pipeline/product-template-starters';
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
  /**
   * What the calculation ARRIVES at: an assumed monthly income, or a borrowing ceiling.
   *
   * Read off the compiled rule, so it is answerable for a hand-built calculation too.
   */
  outputKind: 'monthlyIncome' | 'maxAmount' | null;
  /**
   * How many ways of reaching that figure the product offers — the thing that makes one
   * pipeline product different from another on a list.
   *
   * `null` for a hand-built calculation: it has no form, and counting the members of a
   * `coalesce` in a graph somebody wrote by hand would be a guess wearing a number.
   */
  wayCount: number | null;
  /** Catalog names taking their calculation from it. Empty means nothing sells it yet. */
  usedBy: string[];
}

/** A surrogate product's own page: the calculation, and who uses it. */
export interface SurrogateProductDetailDto extends SurrogateProductSummaryDto {
  incomeRule: IncomeAssumptionConfig | null;
  /**
   * The friendly form the calculation was compiled from, or `null` when it was authored
   * through the raw step editor.
   *
   * The screen branches on exactly this: a form to reopen, or an honest line saying there
   * isn't one. Sent alongside `incomeRule` rather than instead of it, because the compiled
   * steps are still what the figures editor and the check panel read.
   */
  template: ProductTemplate | null;
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

/**
 * A write of the friendly form.
 *
 * `template` is typed loosely on the wire and validated by `validateTemplate`, the same
 * posture `IncomeAssumptionConfigDto` already takes with a product rule's `output`. The
 * shape is a discriminated union several levels deep; `class-validator` can only express
 * it as a pile of conditional decorators that would then be a SECOND statement of the
 * rules, free to disagree with the compiler about what is buildable. One authority.
 */
export class SetSurrogateProductTemplateDto {
  @ApiProperty({ type: Object, description: 'The friendly form. Compiled server-side.' })
  @IsObject()
  template!: Record<string, unknown>;

  /**
   * The catalog's default figures, keyed by step and gate id.
   *
   * Sent WITH the form, in one call, and that is not a convenience: recompiling replaces the
   * step list, so a figures write landing a moment later would be writing against a shape
   * that no longer exists. One statement, one shape, one set of numbers.
   *
   * ABSENT means "keep what is stored" — pruned to the keys the new shape still has. The
   * form screen sends this only once the operator has touched a figure, so simply changing
   * the shape never blanks the defaults.
   */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  stepParams?: Record<string, unknown>;

  /**
   * Estimate markers for the compiled figures, rooted at `incomeRule.` exactly as the raw
   * path does — the compile changes who WROTE the steps, never where a figure lives.
   */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  valueSources?: Record<string, 'team_estimated'>;
}

/** The starter library — shapes only. The admin supplies the words, in both locales. */
export type TemplateStarterDto = TemplateStarter;

/** What the form screen reads on open. */
export interface SurrogateProductTemplateResponseDto {
  key: string;
  labelAr: string;
  labelEn: string;
  template: ProductTemplate | null;
  /**
   * What the form compiles to right now, so the screen can render the calculation without
   * a second round trip — and so the operator sees the steps their answers produced rather
   * than being asked to trust that they produced any.
   */
  compiled: IncomeAssumptionConfig | null;
  /**
   * True when this calculation was authored by hand. The form cannot describe it, and
   * saying so is the honest state — see `PRODUCT_TEMPLATE_NOT_EDITABLE`.
   */
  advanced: boolean;
}

/**
 * Switch a surrogate product on or off — the whole body, because it is the whole decision.
 *
 * REQUIRED, not optional: absent would have to mean either "leave it" (a no-op request) or
 * "off" (a destructive default), and neither is a thing a caller should be able to say by
 * omission.
 *
 * No `deprecate` here, deliberately. `updateById` sets `deprecatedAt` on a deprecate and
 * clears it on nothing, so a product deprecated through this door could never be switched
 * back on. Deprecation stays on the generic enumerations endpoint, where an operator asking
 * for it is asking for something else.
 */
export class SetSurrogateProductActiveDto {
  @ApiProperty({ description: 'True to make the product quotable again; false to stop it.' })
  @IsBoolean()
  active!: boolean;
}
