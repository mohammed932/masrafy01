import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory, QuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export class CreateEnumerationDto {
  @ApiProperty({ minLength: 1, maxLength: 48 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 48)
  type!: string;

  @ApiProperty({ minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9][A-Za-z0-9_-]*$' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN, { message: 'key must be alphanumeric / underscore / hyphen' })
  key!: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelAr!: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelEn!: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  parentKey?: string;

  /**
   * Loan categories the new entry may be offered under. Ignored for types that
   * are not categorisable. Omitted on a categorisable type defaults to ALL
   * four — an entry created with none would be invisible in every picker.
   */
  @ApiPropertyOptional({ enum: LoanCategory, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(LoanCategory, { each: true })
  categories?: LoanCategory[];

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * Replace one catalog entry's loan-category assignment. The submitted array IS
 * the new set, not a delta, and MAY be empty — an empty set PARKS the entry:
 * kept and editable, offerable under no category.
 *
 * No `@ArrayMinSize`, deliberately: that omission is the entire mechanism for
 * parking, exactly as in `SetQuestionCategoriesDto`. Do not "fix" it.
 */
export class SetEnumerationCategoriesDto {
  @ApiProperty({ enum: LoanCategory, isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(LoanCategory, { each: true })
  categories!: LoanCategory[];
}

export class EnumerationCategoryAssignmentDto {
  @ApiProperty({ minLength: 1, maxLength: 30 })
  @IsString()
  @Length(1, 30)
  id!: string;

  @ApiProperty({ enum: LoanCategory, isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(LoanCategory, { each: true })
  categories!: LoanCategory[];
}

/**
 * Replace one catalog name's SUGGESTED question set FOR ONE LOAN CATEGORY. The
 * array IS the new set, not a delta, and MAY be empty — empty means "not
 * configured", which makes the scoring wizard seed nothing (today's behaviour).
 *
 * `category` is REQUIRED, and scopes the whole write: the other three
 * categories' sets are untouched. A body without it would have to mean either
 * "all four" or "some default", and both readings silently destroy sets the
 * admin never opened.
 *
 * No `@ArrayMinSize`, deliberately, same as `SetEnumerationCategoriesDto`: that
 * omission is how a template is cleared. Do not "fix" it.
 *
 * No bulk sibling, also deliberately — see the controller. Every action on the
 * detail screen (one tap, tick-all, clear-all) is a new set for ONE name under
 * ONE category, so it is one PUT carrying the whole array.
 */
export class SetEnumerationQuestionsDto {
  @ApiProperty({ enum: LoanCategory })
  @IsEnum(LoanCategory)
  category!: LoanCategory;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  questionCodes!: string[];
}

/** One active question as the catalog template board renders it. */
export class CatalogQuestionDto {
  @ApiProperty() code!: string;
  @ApiProperty() labelAr!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty({ enum: QuestionType }) type!: QuestionType;
  /** The loan categories that ASK this question. Empty = parked. */
  @ApiProperty({ enum: LoanCategory, isArray: true }) categories!: LoanCategory[];
}

/** Reassign many entries in ONE transaction — the board's per-category actions. */
export class SetEnumerationCategoriesBulkDto {
  @ApiProperty({ type: [EnumerationCategoryAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => EnumerationCategoryAssignmentDto)
  assignments!: EnumerationCategoryAssignmentDto[];
}

/**
 * NOTE: `categories` is deliberately absent here. Assignment has its own
 * endpoint so that "empty array = parked" cannot collide with PATCH's
 * "omitted = unchanged" — the two semantics are irreconcilable on one field.
 */
export class UpdateEnumerationDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  labelAr?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  labelEn?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  parentKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deprecate?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class EnumerationRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() key!: string;
  @ApiProperty() labelAr!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ nullable: true }) deprecatedAt!: string | null;
  @ApiProperty() systemOnly!: boolean;
  @ApiProperty({ nullable: true }) parentKey!: string | null;
  /**
   * How many bank programs instantiate this archetype, across how many banks.
   * Present on `program_name` rows only — other enumeration types are not
   * referenced by a dedicated column.
   */
  @ApiPropertyOptional() usage?: { programs: number; banks: number };
  /**
   * Loan categories this entry may be offered under. Present on `program_name`
   * rows only — other types have no such axis, and an empty array on one of
   * them would read as "parked" rather than "not applicable". On a
   * `program_name` row `[]` DOES mean parked: offerable nowhere.
   */
  @ApiPropertyOptional({ enum: LoanCategory, isArray: true }) categories?: LoanCategory[];
  /**
   * Question codes this catalog name SUGGESTS scoring on, PER LOAN CATEGORY —
   * `{ personal: ['monthly_income'], business: [] }`. Present on `program_name`
   * rows only. Advisory: it pre-ticks the per-program scoring wizard and
   * constrains nothing.
   *
   * A missing category key and an empty array both mean "not configured for that
   * category", which is the day-one state and not a problem. That is why this one
   * is NOT keyed for all four the way `categories` is exhaustive — there is no
   * third state to distinguish, unlike the assignment axis where `[]` means
   * parked.
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { personal: ['monthly_income', 'employer_name'], business: ['business_age'] },
  })
  questionsByCategory?: Partial<Record<LoanCategory, string[]>>;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
