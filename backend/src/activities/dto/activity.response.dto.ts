import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachedDocumentDto {
  @ApiProperty() id!: string;
  @ApiProperty() documentType!: string;
  @ApiProperty() status!: string;
  @ApiProperty() uploadedBySource!: string;
  @ApiProperty() originalFilename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
}

export class ActivityResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() actorStaffId!: string;
  @ApiProperty() actorRole!: string;
  @ApiProperty() activityType!: string;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional({ nullable: true }) note?: string | null;
  @ApiPropertyOptional({ nullable: true }) durationMinutes?: number | null;
  @ApiProperty({ type: [String] }) outcomeFlags!: string[];
  @ApiPropertyOptional({ nullable: true }) followUpAt?: string | null;
  @ApiProperty({ type: [AttachedDocumentDto] }) attachedDocuments!: AttachedDocumentDto[];
  @ApiPropertyOptional({ nullable: true }) meta?: Record<string, unknown> | null;
  @ApiProperty() correlationId!: string;
  @ApiProperty() occurredAt!: string;
  @ApiPropertyOptional({ nullable: true }) leadStatusTransition?: {
    from: string | null;
    to: string;
  } | null;
}

export class ActivityListResponseDto {
  @ApiProperty({ type: [ActivityResponseDto] }) activities!: ActivityResponseDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
}
