import { ApiProperty } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';

export class AuthenticatedUserDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ description: 'Display form (original casing).' })
  email!: string;
  @ApiProperty({ enum: ['super_admin', 'sales_manager', 'sales_agent', 'analyst'] })
  role!: StaffRole;
  @ApiProperty()
  mustChangePassword!: boolean;
  @ApiProperty({ nullable: true, type: String })
  lastLoginAt!: string | null;
}

export class LoginResponseDataDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Seconds until access-token expiry (900 by default).' })
  accessTokenExpiresIn!: number;

  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;
}

export class LoginResponseEnvelope {
  @ApiProperty()
  success!: true;
  @ApiProperty({ type: LoginResponseDataDto })
  data!: LoginResponseDataDto;
}
