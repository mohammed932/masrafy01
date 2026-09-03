/**
 * The predefined-product library, on the wire.
 *
 * Structure and EXISTENCE, never words. The product's own name and its worked examples are
 * screen copy in the admin bundle, keyed by the same `key` — exactly where the eight shapes'
 * words already live, and for the same two reasons: an English label here would be English
 * on the wire (Principle III / A2), and a bank's figure here would become a default that
 * quietly turned into somebody's live table.
 *
 * The bilingual product NAME is the one exception, and it is not a label: it is the default
 * value of an input box, which the operator may overwrite before saving, and the DEFAULT has
 * to be the same on every screen in both locales or two operators create the same product
 * under two names.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import type { LoanCategory } from '@prisma/client';
import { BLUEPRINT_GROUPS } from '../blueprints/product-blueprint.types';
import type { BlueprintGroup } from '../blueprints/product-blueprint.types';

/** One thing a product asks, and whether the platform can already ask it. */
export interface ProductBlueprintAskDto {
  factKey: string;
  kind: 'choice' | 'number' | 'bindQuestion' | 'platformFact' | 'derivedFact';
  /** Absent when the blueprint does not name one and no fact is bound yet. */
  questionCode?: string;
  listTypeKey?: string;
  factExists: boolean;
  questionExists: boolean;
  listExists: boolean;
  /**
   * Loan categories the question is NOT asked in yet.
   *
   * The half of "is this set up?" that is invisible on every other screen: a question that
   * exists but is assigned to no category is asked by nobody, so a product reading it quotes
   * the standard column for every applicant and says nothing about why.
   */
  missingCategories: LoanCategory[];
}

/** What creating this product would write. Reported before anything is written. */
export interface ProductBlueprintCreatesDto {
  lists: number;
  values: number;
  questions: number;
  facts: number;
  widens: number;
}

export interface ProductBlueprintDto {
  key: string;
  group: BlueprintGroup;
  labelEn: string;
  labelAr: string;
  /** `null` for a cap-only product: there is no income and no ceiling to work out. */
  outputKind: 'monthlyIncome' | 'maxAmount' | null;
  /** How many ways of reaching the figure the product offers. Each bank fills the ones it sells. */
  wayCount: number;
  hasSecondColumn: boolean;
  conditionCount: number;
  hasCap: boolean;
  /** A question only a bank can answer, which changes every figure the product quotes. */
  openQuestion?: string;
  asks: ProductBlueprintAskDto[];
  creates: ProductBlueprintCreatesDto;
  /**
   * The brackets a published sheet prints, offered to the form.
   *
   * Edges, never amounts: which brackets exist is the shape of the table. They are not
   * persisted on their own either — a band row with no figure beside it is refused by the
   * validator, so these reach the form and are stored only once an operator has typed each
   * figure.
   */
  suggestedBands: Array<{
    wayIndex: number;
    /**
     * The step id those brackets belong to, resolved here.
     *
     * Resolved SERVER-side because `waySlot` is the authority on slot naming and the screen
     * must not re-derive it: a slot the admin worked out for itself would be a second
     * statement of the rule that decides where a bank's figures live, free to disagree the
     * day a way is added. With the id on the wire the form matches a suggestion to the box it
     * belongs in by string equality and nothing else.
     */
    slotId: string;
    edges: Array<{ fromInclusive: string; toExclusive: string | null }>;
  }>;
}

export class CreateFromBlueprintDto {
  @ApiProperty({ description: 'Which predefined product to build.' })
  @IsString()
  @Length(1, 64)
  blueprintKey!: string;

  /**
   * The product's key, or omitted to take it from the English name.
   *
   * Immutable once written — it is what a catalog name points at
   * (`program_name.surrogateProductKey`) — so it is worth being able to state.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message: 'key must be lower-case alphanumeric / underscore / hyphen',
  })
  key?: string;

  /**
   * The product's name, in both locales.
   *
   * Optional on the wire and required by the SERVICE for a product — a cap-only blueprint
   * creates no product, so demanding a name would make the screen invent one for a thing
   * that never gets it. Which of the two applies is a property of the blueprint, so the
   * refusal belongs where the blueprint is known.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  labelEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  labelAr?: string;
}

/** What was written, and what was already there. */
export interface CreateFromBlueprintResultDto {
  blueprintKey: string;
  /** `null` for a cap-only product — it builds the question and the list and no product. */
  productKey: string | null;
  /**
   * The fact a cap-only product's table is keyed by, so the screen can hand the operator
   * straight to the bank program's own maximum-loan table with the axis already chosen.
   */
  capFactKey: string | null;
  created: {
    lists: string[];
    values: number;
    questions: string[];
    facts: string[];
    widened: string[];
    /**
     * Questions that existed, switched off, and were switched back on.
     *
     * Reported rather than silent: a purge leaves soft-deleted questions behind (an answer's
     * foreign key onto a question is RESTRICT), and reviving one puts a question back in
     * front of applicants — which the operator should read on the screen that did it.
     */
    revived: string[];
  };
  reused: { typeKeys: string[]; questionCodes: string[]; factKeys: string[]; valueKeys: string[] };
  publishedQuestionnaire: boolean;
}

/** Kept beside the DTOs so a group that is not one of the three cannot be requested. */
export class BlueprintGroupQuery {
  @ApiPropertyOptional({ enum: BLUEPRINT_GROUPS })
  @IsOptional()
  @IsIn(BLUEPRINT_GROUPS as readonly string[])
  group?: BlueprintGroup;
}
