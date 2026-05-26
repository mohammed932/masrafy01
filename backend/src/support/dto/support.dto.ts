import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, IsUrl } from 'class-validator';
import { SupportChannel } from '@prisma/client';

const CHANNELS = ['chat', 'call', 'whatsapp', 'email'] as const;

export class CreateSupportRequestDto {
  @ApiProperty({ enum: CHANNELS })
  @IsString()
  @IsIn(CHANNELS as readonly string[])
  channel!: (typeof CHANNELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(24, 32)
  applicationId?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  note?: string;
}

export class SupportRequestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() channel!: SupportChannel;
  @ApiProperty() status!: 'open' | 'in_progress' | 'resolved';
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() resolvedAt?: string;
  @ApiPropertyOptional() applicationId?: string;
  @ApiPropertyOptional() customerId?: string;
  @ApiPropertyOptional() assignedStaffId?: string;
  @ApiPropertyOptional() note?: string;
}

export class SupportContactResponseDto {
  @ApiProperty() phone!: string;
  @ApiProperty() email!: string;
  @ApiProperty() whatsappUrl!: string;
  @ApiProperty() hoursAr!: string;
  @ApiProperty() hoursEn!: string;
}

export class UpdateSupportConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 320)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  whatsappUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  hoursAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  hoursEn?: string;
}

export class AssignSupportRequestDto {
  @ApiProperty()
  @IsString()
  @Length(24, 32)
  staffId!: string;
}
