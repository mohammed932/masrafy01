import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt } from 'class-validator';

export class ToggleBankDto {
  @ApiProperty() @IsInt() version!: number;
  @ApiProperty() @IsBoolean() isActive!: boolean;
}
