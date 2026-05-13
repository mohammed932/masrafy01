import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

const ASSIGN_REASONS = [
  'INITIAL_ASSIGNMENT',
  'WORKLOAD_REBALANCE',
  'SKILL_MATCH',
  'AGENT_DEACTIVATED',
  'MANAGER_OVERRIDE',
  'OTHER',
] as const;

export type AssignLeadReason = (typeof ASSIGN_REASONS)[number];

export class AssignLeadDto {
  @ApiProperty({ minLength: 1, maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  toAgentStaffId!: string;

  @ApiProperty({ enum: ASSIGN_REASONS })
  @IsIn(ASSIGN_REASONS as unknown as string[])
  reason!: AssignLeadReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
