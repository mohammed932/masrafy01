import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const PRODUCT_START_FROM = ['blank', 'starter', 'copy', 'cap'] as const;
export type ProductStartFrom = (typeof PRODUCT_START_FROM)[number];

/** `POST surrogate-products` — a new product, OFF until it is ready (v33.0.0). */
export class CreateSurrogateProductDto {
  @ApiProperty({ example: 'Pension holders' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelEn!: string;

  @ApiProperty({ example: 'أصحاب المعاشات' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelAr!: string;

  @ApiProperty({ enum: PRODUCT_START_FROM })
  @IsIn(PRODUCT_START_FROM)
  startFrom!: ProductStartFrom;

  @ApiPropertyOptional({ description: 'Required when `startFrom` is `starter`.' })
  @ValidateIf((o: CreateSurrogateProductDto) => o.startFrom === 'starter')
  @IsString()
  @IsNotEmpty()
  blueprintKey?: string;

  @ApiPropertyOptional({ description: 'Required when `startFrom` is `copy`: the product to copy.' })
  @ValidateIf((o: CreateSurrogateProductDto) => o.startFrom === 'copy')
  @IsString()
  @IsNotEmpty()
  sourceKey?: string;
}

/** `PUT surrogate-products/:key/labels` — the names; the key never changes. */
export class RenameSurrogateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelEn!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelAr!: string;
}

/** One sample answer: a choice, several choices, or a number (a Decimal string). */
export class CheckAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  factKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optionCode?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionCodes?: string[];

  @ApiPropertyOptional({ description: 'A Decimal string, never a float (Principle I).' })
  @IsOptional()
  @IsString()
  value?: string;
}

/** `POST surrogate-products/:key/check` — sample answers; nothing is persisted. */
export class CheckSurrogateProductDto {
  @ApiPropertyOptional({ description: 'Which way to price, when the product offers several.' })
  @IsOptional()
  @IsString()
  wayId?: string;

  @ApiProperty({ type: [CheckAnswerDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckAnswerDto)
  answers!: CheckAnswerDto[];
}

export interface SurrogateProductCreatedDto {
  key: string;
  startFrom: ProductStartFrom;
}

export interface SurrogateProductDeletedDto {
  key: string;
  /** Facts filed under it that nothing else read, deleted with it. */
  deletedFacts: string[];
  /** Facts it asked that are still read elsewhere — kept. */
  keptFacts: string[];
}

export interface SurrogateProductCheckInputDto {
  factKey: string;
  questionCode: string | null;
  labelEn: string;
  labelAr: string;
  type: 'choice' | 'number';
  options: Array<{ code: string; labelEn: string; labelAr: string }>;
}

export interface SurrogateProductCheckInputsDto {
  key: string;
  outputKind: 'monthlyIncome' | 'maxAmount' | null;
  /** Way ids, in order. Two or more = the bank picks one, so the panel asks which. */
  ways: string[];
  inputs: SurrogateProductCheckInputDto[];
}

export type SurrogateProductCheckResultDto =
  | { ok: true; kind: 'monthlyIncome' | 'maxAmount'; valueEGP: string }
  | {
      ok: false;
      reason: string;
      factKey?: string;
      gateId?: string;
      gateReasonCode?: string;
    };

/** One value filed in a class for one product; `parentKey: null` = back to the shared class. */
export class ProductGroupAssignmentDto {
  @ApiProperty({
    description: 'platform_enumeration.id of the value (a governorate, a compound…).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  valueId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The class key for this product, or null to use the shared class again.',
  })
  @ValidateIf((o: ProductGroupAssignmentDto) => o.parentKey !== null)
  @IsString()
  @MaxLength(64)
  parentKey!: string | null;
}

/** Move values between classes FOR ONE PRODUCT (v36.1.0, groups per product). */
export class SetProductGroupsDto {
  @ApiProperty({ type: [ProductGroupAssignmentDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ProductGroupAssignmentDto)
  assignments!: ProductGroupAssignmentDto[];
}
