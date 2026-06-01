import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'] as const;
const ID_DOC_TYPES = ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK'] as const;

/** National ID front/back upload-url request (customer-scoped, Principle XXXVII). */
export class ProfileDocUploadUrlDto {
  @ApiProperty({ enum: ID_DOC_TYPES })
  @IsString()
  @IsIn(ID_DOC_TYPES as readonly string[])
  documentType!: string;

  @ApiProperty({ enum: ALLOWED_MIMES })
  @IsString()
  @IsIn(ALLOWED_MIMES as readonly string[])
  mimeType!: string;

  @ApiProperty({ minimum: 1, maximum: 10_485_760 })
  @IsInt()
  @Min(1)
  @Max(10_485_760)
  sizeBytes!: number;

  @ApiProperty({ description: 'Original filename — PII-stripped server-side before storage.' })
  @IsString()
  @Length(1, 255)
  originalFilename!: string;
}

export class ProfilePhotoUploadUrlDto {
  @ApiProperty({ enum: ALLOWED_MIMES })
  @IsString()
  @IsIn(ALLOWED_MIMES as readonly string[])
  mimeType!: string;

  @ApiProperty({ minimum: 1, maximum: 10_485_760 })
  @IsInt()
  @Min(1)
  @Max(10_485_760)
  sizeBytes!: number;
}

export class ProfilePhotoConfirmDto {
  @ApiProperty()
  @IsString()
  @Length(10, 256)
  s3Key!: string;
}
