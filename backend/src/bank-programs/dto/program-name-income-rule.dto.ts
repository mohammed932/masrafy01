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
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { IncomeAssumptionConfig } from '@/matching/types';
import type { ProductTemplate } from '@/matching/pipeline/product-template';
import type { TemplateStarter } from '@/matching/pipeline/product-template-starters';
import type { MaxLoanByFactRow } from '@/matching/pipeline/max-loan-by-fact';
import type { BlueprintCap } from '../blueprints/product-blueprint.types';
import { IncomeAssumptionConfigDto } from './sub-configs/income-assumption-config.dto';
import { MaxLoanByFactRowDto } from './sub-configs/loan-limits-config.dto';

/**
 * The maximum-loan GRID a surrogate product declares — the axes and the row and column
 * keys, in the order the sheet prints them.
 *
 * An alias of `BlueprintCap` and deliberately not a restatement of it. The blueprint
 * registry is the single authority on what a product's grid is (`capShapeOf` resolves it at
 * read time for exactly that reason), and a hand-copied wire shape beside it would be a
 * second one — free to drift a field at a time, silently, because nothing compares them.
 *
 * FIGURES ARE NOT IN IT. What a bank lends against an answer is the bank's; what an
 * operator wants every new program to start from is the product's `capDefaults`, typed on
 * the product's own screen and carried separately.
 */
export type ProductCapShapeDto = BlueprintCap;

/**
 * One surrogate bank program filed under a catalog name.
 *
 * Declared ONCE and referenced by both carriers below, because they are the same list read
 * from two directions — a name's own programmes, and every programme reachable through a
 * product — and two inline literals are how one of them silently stops carrying a field.
 *
 * The names are here because a CODE is not an identity an operator holds. One product is
 * deliberately sold as several programmes off one mechanism (spec §10.7), so a screen
 * printing `ABK-PER-DOCTORS_CLINIC` and `ABK-PER-DOCTORS_PRACTICE` and nothing else cannot
 * say which is the clinic-owner table and which is half of it. Both locales travel and the
 * client picks, exactly as every other bank-facing payload does — never an English string
 * chosen on the server (Principle III / A2).
 */
export interface ProgramUnderNameDto {
  programCode: string;
  friendlyName: string;
  /** Nullable on the column, so nullable here — the reader falls back to `friendlyName`. */
  friendlyNameAr: string | null;
  /** `null` when the programme is filed under no bank. */
  bankNameEn: string | null;
  bankNameAr: string | null;
  /** `false` when it takes the catalog's figures instead of typing its own. */
  ownAmounts: boolean;
}

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
  programs: ProgramUnderNameDto[];
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
    /**
     * The maximum-loan grid this product implies, or `null` when it declares none.
     *
     * Carried so a bank program's cap editor can stop being a build-your-own grid: the axes
     * and the keys come from here and only the amounts are the bank's. Resolved from the
     * blueprint registry on every read (`capShapeOf`), never stored — so a shape change is
     * a code change with a test behind it rather than a column that has gone stale.
     */
    cap: ProductCapShapeDto | null;
    /**
     * The amounts every new program under this name starts its grid from, or `null` when
     * the product states none — which is the state every product ships in.
     *
     * COPIED, not inherited: a program takes these once, at creation, and stores its own
     * copy. Editing them later moves no program that has already saved, which is correct on
     * a platform whose offers are immutable (Principle I / A6).
     */
    capDefaults: MaxLoanByFactRow[] | null;
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
  /**
   * Programs that cap their maximum by an answer THIS product asks for.
   *
   * A second measure of usage, and the only one that finds a cap-only product: it guesses no
   * income, so it is sold through no catalog name (`SURROGATE_PRODUCT_CAP_ONLY` refuses the
   * link), and `usedBy` is therefore empty for it however many banks quote a cap from it. Read
   * off `loanLimits`, so a program that caps by the answer counts whether or not it also runs
   * a calculation.
   */
  capPrograms: string[];
}

/** A surrogate product's own page: the calculation, and who uses it. */
export interface SurrogateProductDetailDto extends SurrogateProductSummaryDto {
  incomeRule: IncomeAssumptionConfig | null;
  /**
   * The maximum-loan grid this product's blueprint declares, or `null` when it declares
   * none. The same object the catalog name's response carries, from the same resolver — the
   * product's own page renders it and authors the amounts against it.
   */
  cap: ProductCapShapeDto | null;
  /** The default amounts, as `PUT :key/cap-defaults` last stored them. `null` = none. */
  capDefaults: MaxLoanByFactRow[] | null;
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
    /**
     * What the name is CALLED, in both locales. Both travel and the client picks
     * (Principle III / A2); a key that resolves to no row falls back to itself.
     */
    labelEn: string;
    labelAr: string;
    programs: ProgramUnderNameDto[];
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
 * The default maximum-loan AMOUNTS a surrogate product hands every new program under it.
 *
 * AMOUNTS ONLY. The axes and the row and column keys are the blueprint's and are resolved at
 * read time, so there is nothing here to state them with — which is what makes the grid and
 * the figures in it unable to disagree about what a row means.
 *
 * `rows` is REQUIRED and an EMPTY array is a real operation: it clears the defaults. Stored
 * as SQL NULL rather than as `{"rows": []}`, so "this product states no starting amounts"
 * has one spelling and a reader never has to know that two mean the same thing.
 *
 * The row shape is `MaxLoanByFactRowDto`, the one a bank program's own table already uses —
 * so the positive-amount rule, the band edges and the key pattern are stated once. A second
 * row class here would be a second answer to "what is a legal cell".
 */
export class SetSurrogateProductCapDefaultsDto {
  @ApiProperty({ type: [MaxLoanByFactRowDto], description: 'Empty clears the defaults.' })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MaxLoanByFactRowDto)
  rows!: MaxLoanByFactRowDto[];
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
