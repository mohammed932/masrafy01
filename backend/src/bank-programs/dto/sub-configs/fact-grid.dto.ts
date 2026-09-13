import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, ValidateIf } from 'class-validator';
import { FACT_GRID_NO_MATCH_ACTIONS } from '../../../matching/pipeline/fact-grid';
import type {
  FactGridAxis,
  FactGridCell,
  FactGridNoMatchAction,
} from '../../../matching/pipeline/fact-grid';

/**
 * An N-axis table a bank states over its applicants' own answers — a rate grid
 * (`pricing.rateByFact`) or a term ceiling (`tenor.maxMonthsByFact`).
 *
 * REACHABILITY IS THE POINT OF THIS FILE. The global pipe runs with
 * `forbidNonWhitelisted: true`, so a field no DTO declares is refused at the wire and the
 * engine never sees it — which is the trap `dbrCapPercentByEmploymentType` fell into, read
 * by the engine for versions while every request carrying it was rejected.
 *
 * The validation here is deliberately SHALLOW — sizes, types, the closed `onNoMatch` set —
 * and the real work is `validateFactGrid` at the service layer. That is this folder's
 * existing convention (`pricing-config.dto.ts`: "deep validation … happens at the service
 * layer"), and it is the only place the checks that matter can run at all: whether an axis
 * names a fact the registry can serve, and whether a cell is the all-wildcard one that would
 * price every applicant off whatever figure sat beside it, are questions about the
 * enumeration registry and about the whole table, not about one field.
 */
export class FactGridDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  axes!: FactGridAxis[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(400)
  cells!: FactGridCell[];

  /**
   * MANDATORY, never defaulted. Both silent readings of "no cell matched" are wrong in a
   * direction that only shows up on a real customer, so the bank says which — the same
   * posture `MaxLoanByFactDto.onNoMatch` takes, and for a rate it matters more, because
   * there is no safe fallback price at all (`fact-grid.ts`).
   */
  @IsString()
  @IsIn(FACT_GRID_NO_MATCH_ACTIONS)
  onNoMatch!: FactGridNoMatchAction;
}
