import { ApiProperty } from '@nestjs/swagger';
import type { StaffAccountSummary } from '../staff-account.repository';

export class StaffAccountSummaryDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ description: 'Display form (original casing).' })
  email!: string;
  @ApiProperty({ enum: ['super_admin', 'sales_manager', 'sales_agent', 'analyst'] })
  role!: string;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty()
  mustChangePassword!: boolean;
  @ApiProperty()
  createdAt!: string;
  @ApiProperty({ nullable: true, type: String })
  lastLoginAt!: string | null;
}

export function toStaffSummaryDto(row: StaffAccountSummary): StaffAccountSummaryDto {
  return {
    id: row.id,
    name: row.name,
    email: row.emailDisplay,
    role: row.role,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  };
}
