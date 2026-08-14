import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query for `GET /admin/bank-programs/pending-bank-confirmation` (FR-036).
 *
 * A CLASS, not an inline object literal on the handler: the global
 * `ValidationPipe` only validates a type it can construct, so an inline literal
 * passed straight through — `?page=abc` became `NaN`, survived the service's `?? 1`
 * (NaN is not nullish), reached Prisma as `skip: NaN` and surfaced as a 500 instead
 * of `VALIDATION_FAILED`. `pageSize` was likewise unbounded, so one request could
 * ask for every row in the table. Shaped after `ListBankProgramsQuery` for exactly
 * that reason.
 */
export class PendingBankConfirmationQuery {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
