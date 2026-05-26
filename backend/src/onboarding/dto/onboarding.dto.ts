import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingScreenResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() order!: number;
  @ApiProperty() titleAr!: string;
  @ApiProperty() titleEn!: string;
  @ApiProperty() bodyAr!: string;
  @ApiProperty() bodyEn!: string;
  @ApiPropertyOptional() imageS3Key?: string;
  @ApiProperty() active!: boolean;
}

export class CreateOnboardingScreenDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  titleAr!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  titleEn!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  bodyAr!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  bodyEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  imageS3Key?: string;
}

export class UpdateOnboardingScreenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  titleAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  titleEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  bodyAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  bodyEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  imageS3Key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  active?: boolean;
}

export class ReorderItemDto {
  @ApiProperty()
  @IsString()
  @Length(1, 30)
  id!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderOnboardingScreensDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @ArrayMinSize(1)
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
