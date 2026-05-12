import { IsString, Matches } from 'class-validator';

export class CloneBankProgramDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,32}$/, { message: 'newProgramCode must match ^[A-Z0-9_-]{3,32}$' })
  newProgramCode!: string;
}
