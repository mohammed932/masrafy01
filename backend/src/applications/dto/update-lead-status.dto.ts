import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LeadStatus } from './enums';

/**
 * Admin sets the sales pipeline status of an application (lead).
 * `ValidationPipe({ whitelist, forbidNonWhitelisted })` rejects unknown
 * values, so no bespoke error code is needed (Principle III).
 */
export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LeadStatus, example: LeadStatus.in_progress })
  @IsEnum(LeadStatus)
  leadStatus!: LeadStatus;
}
