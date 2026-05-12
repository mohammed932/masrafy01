import { IsInt, Min } from 'class-validator';
import { CreateBankProgramDto } from './create-bank-program.dto';

/**
 * Update DTO = create DTO + `version` (optimistic concurrency token, FR-021).
 * `programCode` is sent for clarity but the service IGNORES it on update (FR-019 immutability).
 */
export class UpdateBankProgramDto extends CreateBankProgramDto {
  @IsInt()
  @Min(1)
  version!: number;
}
