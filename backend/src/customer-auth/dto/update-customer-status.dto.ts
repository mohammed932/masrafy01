import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Admin (super_admin) account enable/disable for a customer. `false` locks the
 * customer out of login (gated by `CustomerAccount.isActive`) and revokes their
 * active sessions; `true` restores access.
 */
export class UpdateCustomerStatusDto {
  @ApiProperty({ description: 'true = active/restored, false = deactivated/blocked' })
  @IsBoolean()
  isActive!: boolean;
}
