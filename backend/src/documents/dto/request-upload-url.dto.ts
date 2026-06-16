import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString, Length, Max } from 'class-validator';
import { MAX_DOCUMENT_SIZE_BYTES } from '../document.constants';

export class RequestUploadUrlDto {
  @ApiProperty({ minLength: 1, maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  applicationId!: string;

  @ApiProperty({ minLength: 1, maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  documentType!: string;

  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'] })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ minimum: 1, maximum: MAX_DOCUMENT_SIZE_BYTES })
  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  sizeBytes!: number;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  originalFilename!: string;

  @ApiProperty({ enum: ['whatsapp', 'email', 'in_person', 'mobile_app', 'courier', 'other'] })
  @IsString()
  @IsNotEmpty()
  uploadedBySource!: 'whatsapp' | 'email' | 'in_person' | 'mobile_app' | 'courier' | 'other';
}
