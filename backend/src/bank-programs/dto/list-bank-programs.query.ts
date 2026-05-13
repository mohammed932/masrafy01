import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListBankProgramsQuery {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;

  @IsOptional() @IsString() @MaxLength(80) search?: string;
  @IsOptional() @IsString() @MaxLength(80) bankName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  active?: boolean;

  @IsOptional() @IsString() productCategory?: string;
  @IsOptional() @IsString() employmentType?: string;
}
