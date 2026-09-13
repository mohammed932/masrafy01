import {
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FactGridDto } from './fact-grid.dto';

export class TenorConfigDto {
  /**
   * ABSENT means "this bank states no duration of its own — read the surrogate product's"
   * (`effectiveTenor`). A number means this bank's own, and the bank's own always wins.
   *
   * `@ValidateIf` rather than `@IsOptional()` for the same reason `maxMonthsByFact` below
   * gives: `@IsOptional()` skips `null` as well as absent, so `null` would slip the pipe and
   * land in the column as a stored non-number. There is no "clear" spelling to preserve here
   * — the program save is a full replacement, so absent already IS the clear — which makes
   * `null` meaningless and refusing it the honest answer.
   *
   * BOTH MONTHS OR NEITHER. A floor read off the product and a ceiling typed by the bank is
   * a range neither of them stated, so `validateRanges` refuses a half-stated pair — and it
   * refuses both blank when no product stands behind the program's catalog name, because a
   * loan with no term cannot be priced.
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(480)
  minMonths?: number;

  /** Absent means "read the product's" — see `minMonths`. */
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(480)
  maxMonths?: number;

  /** Keys validated against `employment_type` enumeration at service layer. */
  @IsOptional()
  @IsObject()
  maxMonthsByEmploymentType?: Record<string, number>;

  /**
   * A term ceiling the bank states against the applicant's own answers — the car's model
   * year, the country it was built in, the share they are putting down.
   *
   * Read by `quote.ts` as a CLAMP beside the age-at-maturity one, composing by `min`, and
   * deliberately NOT as a `TENOR_CASCADE_ORDER` level: that cascade is first-match-wins, so
   * a level would make a vehicle ceiling REPLACE `maxMonthsByEmploymentType` rather than
   * compose with it, and a bank that caps the self-employed at 84 months means that as well
   * as, not instead of, "this car is too old for ten years".
   */
  // `@ValidateIf`, not `@IsOptional()`: that one skips validation for `null` as well as for
  // absent, so `maxMonthsByFact: null` sailed through the pipe and the service then read `.axes`
  // off it and threw an untyped 500. Absent means "not stating one"; `null` is a client bug
  // and now gets a typed `VALIDATION_FAILED` naming the field. Same defect and same fix as
  // `dropClearedPolicy` (v26.2.0).
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => FactGridDto)
  maxMonthsByFact?: FactGridDto;

  /**
   * A term FLOOR against the same answers, composed by `max` against `minMonths` above, so
   * it only ever RAISES the floor — a bank's own minimum can never be undercut by a table.
   *
   * Its own field rather than a second figure on `maxMonthsByFact`'s cells: the two compose
   * in opposite directions, and one row carrying both would have to mean "no floor" and "no
   * ceiling" with the same blank.
   *
   * `@ValidateIf`, not `@IsOptional()` — see `maxMonthsByFact` above.
   */
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => FactGridDto)
  minMonthsByFact?: FactGridDto;
}
