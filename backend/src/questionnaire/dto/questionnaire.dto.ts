import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory, QuestionSystemRole, QuestionType } from '@prisma/client';

export class EnabledWhenDto {
  @ApiProperty() @IsString() @Length(1, 64) questionCode!: string;
  @ApiProperty({ enum: ['equals', 'not_equals'] })
  @IsIn(['equals', 'not_equals'])
  operator!: 'equals' | 'not_equals';
  @ApiProperty() @IsString() @Length(1, 64) optionCode!: string;
}

export class CreateGroupDto {
  @ApiProperty({ enum: LoanCategory }) @IsEnum(LoanCategory) category!: LoanCategory;
  @ApiProperty() @IsString() @Length(1, 160) titleAr!: string;
  @ApiProperty() @IsString() @Length(1, 160) titleEn!: string;
  @ApiProperty() @IsInt() @Min(0) displayOrder!: number;
}

export class UpdateGroupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 160) titleAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 160) titleEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateQuestionDto {
  @ApiProperty() @IsString() @Length(1, 30) groupId!: string;
  @ApiProperty({ enum: LoanCategory }) @IsEnum(LoanCategory) category!: LoanCategory;
  @ApiPropertyOptional({ enum: QuestionType, default: 'SINGLE_SELECT' })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;
  @ApiProperty() @IsString() @Length(1, 500) questionAr!: string;
  @ApiProperty() @IsString() @Length(1, 500) questionEn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) helperTextAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) helperTextEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRequired?: boolean;
  @ApiProperty() @IsInt() @Min(0) displayOrder!: number;
  @ApiPropertyOptional({ type: EnabledWhenDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnabledWhenDto)
  enabledWhen?: EnabledWhenDto;
  @ApiPropertyOptional({ enum: QuestionSystemRole })
  @IsOptional()
  @IsEnum(QuestionSystemRole)
  systemRole?: QuestionSystemRole;
  @ApiPropertyOptional({ description: 'Counts toward approval probability; its options then need scoreValue.' })
  @IsOptional()
  @IsBoolean()
  isScored?: boolean;
  @ApiPropertyOptional({ description: 'Dotted ApplicantProfile path for eligibility, e.g. employment.employmentType' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  profileField?: string;
}

export class UpdateQuestionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500) questionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500) questionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) helperTextAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) helperTextEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ type: EnabledWhenDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnabledWhenDto)
  enabledWhen?: EnabledWhenDto | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isScored?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 80) profileField?: string;
}

export class CreateOptionDto {
  @ApiProperty() @IsString() @Length(1, 200) labelAr!: string;
  @ApiProperty() @IsString() @Length(1, 200) labelEn!: string;
  @ApiProperty() @IsInt() @Min(0) displayOrder!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numericMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numericMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numericPoint?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  scoreValue?: number;
  @ApiPropertyOptional({ description: 'Categorical value for the question profileField' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  profileValue?: string;
}

export class UpdateOptionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) labelAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) labelEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numericMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numericMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numericPoint?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  scoreValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) profileValue?: string;
}

export class SubmittedAnswerDto {
  @ApiProperty() @IsString() @Length(1, 64) questionCode!: string;
  @ApiProperty() @IsString() @Length(1, 64) optionCode!: string;
}

export class PreviewMatchesDto {
  @ApiProperty({ enum: LoanCategory }) @IsEnum(LoanCategory) category!: LoanCategory;
  @ApiPropertyOptional() @IsOptional() @IsString() questionnaireVersionId?: string;
  @ApiProperty({ type: [SubmittedAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmittedAnswerDto)
  answers!: SubmittedAnswerDto[];
}
