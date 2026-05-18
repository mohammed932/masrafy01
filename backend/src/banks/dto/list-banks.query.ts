import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListBanksQuery {
  @ApiProperty({ required: false, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number = 50;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Boolean) @IsBoolean() active?: boolean;
}
