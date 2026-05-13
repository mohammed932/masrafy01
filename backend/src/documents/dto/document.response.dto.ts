import { ApiProperty } from '@nestjs/swagger';

export class PresignedUploadResponseDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() s3Key!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty() maxSizeBytes!: number;
}

export class DocumentSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() documentType!: string;
  @ApiProperty() status!: 'uploaded' | 'verified' | 'rejected' | 'erased';
  @ApiProperty() uploadedBySource!: string;
  @ApiProperty() uploadedByContext!: string;
  @ApiProperty() originalFilename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true }) verifiedAt!: string | null;
  @ApiProperty({ nullable: true }) verifiedByStaffId!: string | null;
}

export class PresignedDownloadResponseDto {
  @ApiProperty() downloadUrl!: string;
  @ApiProperty() expiresAt!: string;
}
