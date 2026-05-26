import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'] as const;

export class MobileRequestUploadUrlDto {
  @ApiProperty({ description: 'Whitelisted enumeration key from required_document registry.' })
  @IsString()
  @Length(1, 64)
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

export class MobilePresignedUploadResponseDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() s3Key!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty() maxSizeBytes!: number;
}

export class MobileConfirmUploadResponseDto {
  @ApiProperty() documentId!: string;
  @ApiProperty({ example: 'uploaded' }) status!: 'uploaded';
}
