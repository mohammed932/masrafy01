import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';

const CREATABLE_ROLES = ['ADMIN', 'VIEWER'] as const;
export type CreatableRole = (typeof CREATABLE_ROLES)[number];

export class CreateStaffRequestDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ format: 'email', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ enum: CREATABLE_ROLES, description: 'SUPER_ADMIN not creatable via API.' })
  @IsIn(CREATABLE_ROLES as unknown as string[])
  role!: CreatableRole;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  initialPassword!: string;
}
