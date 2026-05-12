import { IsBoolean, IsInt, Min } from 'class-validator';

export class ToggleBankProgramDto {
  @IsBoolean()
  active!: boolean;

  @IsInt()
  @Min(1)
  version!: number;
}
