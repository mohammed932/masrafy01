import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { ALL_LOAN_CATEGORIES } from '@/common/loan-category.util';
import { ALL_INCOME_BASES, type IncomeBasis } from '@/common/income-basis.util';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  ArrayUnique,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export class CreateEnumerationDto {
  @ApiProperty({ minLength: 1, maxLength: 48 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 48)
  type!: string;

  @ApiProperty({ minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9][A-Za-z0-9_-]*$' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN, { message: 'key must be alphanumeric / underscore / hyphen' })
  key!: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelAr!: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelEn!: string;

  /**
   * `@Length(1, …)` and `KEY_PATTERN`, not `@Length(0, …)`: an empty string used to be
   * accepted and STORED, and it then passed the `parentKey IS NOT NULL` filter the engine's
   * parent walk uses — so the value looked filed, resolved to `no_matching_row`, and quoted
   * nothing. Omitting the field is the only way to say "no parent", and for a type that is
   * filed under a list even that is refused — a new value of a filed-under type is born filed.
   *
   * `@ValidateIf(!== undefined)` rather than `@IsOptional()`, which skips validation for `null`
   * as well: an explicit `parentKey: null` then reached the service as a value equal to neither
   * `undefined` nor `''`, fell through to `findByTypeAndKey(parentType, null)` and came back as
   * an untyped 500. `null` is a REQUEST to unfile, and it is accepted on exactly one endpoint
   * (`POST parent-keys`) — everywhere else it is refused in words.
   */
  @ApiPropertyOptional({ maxLength: 64, pattern: KEY_PATTERN.source })
  @ValidateIf((o: CreateEnumerationDto) => o.parentKey !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  parentKey?: string;

  /**
   * `program_name` only — the surrogate product this name works its income out from.
   *
   * REQUIRED when `incomeBases` includes `no_payslip`, refused for any other type. Asked
   * here rather than left to a follow-up write because `incomeBases` is applied inside
   * this same atomic insert: a name created as no-payslip with no link would exist, be
   * offerable, and quote nothing, for as long as it took someone to notice.
   *
   * `@ValidateIf(!== undefined)` for the reason `parentKey` states two fields up —
   * `@IsOptional()` skips `null` as well, and `null` is a real request here (unlink),
   * which must reach the service as a stated refusal rather than a Prisma 500.
   */
  @ApiPropertyOptional({ maxLength: 64, pattern: KEY_PATTERN.source })
  @ValidateIf((o: CreateEnumerationDto) => o.surrogateProductKey !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  surrogateProductKey?: string;

  /**
   * Loan categories the new entry may be offered under. Ignored for types that
   * are not categorisable. Omitted on a categorisable type defaults to EVERY
   * category — an entry created with none would be invisible in every picker.
   */
  @ApiPropertyOptional({ enum: LoanCategory, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ALL_LOAN_CATEGORIES.length)
  @IsEnum(LoanCategory, { each: true })
  categories?: LoanCategory[];

  /**
   * How the new name is MEANT to be sold — against a payslip, without one, or both
   * — applied to EVERY category above. Ignored for types that are not categorisable.
   *
   * `@ArrayMinSize(1)`, unlike the category array: an empty basis set is not a
   * "parked" state with a meaning, it is a name the catalog says nothing about.
   * Omitted defaults to `['payslip']`, which is what every name meant before the
   * basis was recorded.
   */
  @ApiPropertyOptional({ enum: ALL_INCOME_BASES, isArray: true, default: ['payslip'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALL_INCOME_BASES.length)
  @IsIn([...ALL_INCOME_BASES], { each: true })
  incomeBases?: IncomeBasis[];

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * Replace ONE (name, category) pair's income basis — the "How do banks prove the
 * income" rows on the catalog detail screen and in the Add / Edit dialog, one tab
 * at a time.
 *
 * `category` is REQUIRED and scopes the whole write: a name is legitimately meant for
 * no-payslip lending as a personal loan and payslip-only as a car loan, so a body
 * without a category would have to guess which of those the operator meant.
 *
 * `@ArrayMinSize(1)` here and NOT on `SetEnumerationCategoriesDto`, deliberately.
 * Empty means "parked" there — a real state with a real screen affordance. Here it
 * would mean a pair the catalog describes in no way at all, which no control can
 * produce and no screen could render.
 */
export class SetEnumerationIncomeBasisDto {
  @ApiProperty({ enum: LoanCategory })
  @IsEnum(LoanCategory)
  category!: LoanCategory;

  @ApiProperty({ enum: ALL_INCOME_BASES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALL_INCOME_BASES.length)
  @IsIn([...ALL_INCOME_BASES], { each: true })
  bases!: IncomeBasis[];
}

/**
 * Replace one catalog entry's loan-category assignment. The submitted array IS
 * the new set, not a delta, and MAY be empty — an empty set PARKS the entry:
 * kept and editable, offerable under no category.
 *
 * No `@ArrayMinSize`, deliberately: that omission is the entire mechanism for
 * parking, exactly as in `SetQuestionCategoriesDto`. Do not "fix" it.
 */
export class SetEnumerationCategoriesDto {
  @ApiProperty({ enum: LoanCategory, isArray: true })
  @IsArray()
  @ArrayMaxSize(ALL_LOAN_CATEGORIES.length)
  @IsEnum(LoanCategory, { each: true })
  categories!: LoanCategory[];
}

export class EnumerationCategoryAssignmentDto {
  @ApiProperty({ minLength: 1, maxLength: 30 })
  @IsString()
  @Length(1, 30)
  id!: string;

  @ApiProperty({ enum: LoanCategory, isArray: true })
  @IsArray()
  @ArrayMaxSize(ALL_LOAN_CATEGORIES.length)
  @IsEnum(LoanCategory, { each: true })
  categories!: LoanCategory[];
}

/** Reassign many entries in ONE transaction — the board's per-category actions. */
export class SetEnumerationCategoriesBulkDto {
  @ApiProperty({ type: [EnumerationCategoryAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => EnumerationCategoryAssignmentDto)
  assignments!: EnumerationCategoryAssignmentDto[];
}

/** One value and the list entry it should be filed under. */
export class EnumerationParentAssignmentDto {
  @ApiProperty({ maxLength: 30 })
  @IsString()
  @Length(1, 30)
  id!: string;

  /**
   * The parent's key, or `null` to file the value under NOTHING.
   *
   * Three values, and the difference between them is the whole contract of this endpoint:
   *
   *   · a key   → file it there (must be a live member of the parent list);
   *   · `null`  → UNFILE it, explicitly. This is the board's uncheck. The operator is
   *               choosing to leave the value unpriceable: it stays a pickable answer for the
   *               customer, and `factParentTable` then answers `no_matching_row`, which stops
   *               the rule for every bank that keys its table by this axis;
   *   · absent or `''` → refused. `''` is the reading v18.2.0 closed — it passes the engine's
   *               `parentKey IS NOT NULL` filter, so the value LOOKS filed and quotes nothing,
   *               which is the same outcome as `null` with none of the intent. Saying "no
   *               parent" has exactly one spelling.
   *
   * `@ValidateIf(!== null)` keeps the string rules for every other value while letting `null`
   * through; an ABSENT field still fails `@IsString()`, so a client cannot unfile by omission.
   */
  @ApiProperty({ maxLength: 64, nullable: true, pattern: KEY_PATTERN.source })
  @ValidateIf((o: EnumerationParentAssignmentDto) => o.parentKey !== null)
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  parentKey!: string | null;
}

/** Re-file many entries onto a parent in ONE transaction — what the class board saves. */
export class SetEnumerationParentKeysBulkDto {
  @ApiProperty({ type: [EnumerationParentAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique((a: EnumerationParentAssignmentDto) => a.id)
  @ValidateNested({ each: true })
  @Type(() => EnumerationParentAssignmentDto)
  assignments!: EnumerationParentAssignmentDto[];
}

/**
 * ONE pasted row.
 *
 * No `key` field, deliberately: the key is slugged from `labelEn` server-side, which is what
 * makes re-pasting the same sheet a no-op instead of a second set of `_2` rows. A client that
 * could name the key would be a second authority on codes — the trap
 * `createQuestionWithOptions` refuses when it rejects `options` alongside
 * `optionsFromEnumerationType`.
 *
 * No `sortOrder` either: the server appends after the type's current maximum, in array order.
 * That is also why a second paste never renumbers the first — new rows sort last, so the
 * mirrored question's dense `displayOrder` plan comes back with an empty update set.
 */
export class CreateEnumerationValueRowDto {
  /**
   * The key to store, or omitted to slug it from the English label.
   *
   * A pasted sheet omits it, and must: slugging is what makes re-pasting the same sheet
   * write nothing, and a hand-typed key per row in a four-hundred-row paste is four hundred
   * chances to file a figure under something no rule reads.
   *
   * A PROGRAMMATIC caller states it, and must: a predefined product's row keys are what a
   * bank's table is filed under and what a stored answer holds, so they are declared with
   * the mechanism rather than derived from wording somebody may reword. Same field the
   * single-row create has always taken — this is the batched spelling of it, not a new
   * liberty.
   */
  @ApiPropertyOptional({ maxLength: 64, pattern: KEY_PATTERN.source })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  key?: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelAr!: string;

  /**
   * `@Matches(/[A-Za-z0-9]/)` because the KEY is slugged from this field. A label with no
   * Latin character normalises to `''` and `slugify` falls back to the literal `'item'` — so
   * four hundred rows pasted with the columns the wrong way round would every one of them
   * mint the same key. Refused here, per row, with an index the pipe already supplies, rather
   * than discovered as 399 duplicates.
   */
  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  @Matches(/[A-Za-z0-9]/, { message: 'labelEn must contain a latin letter or digit' })
  labelEn!: string;

  /**
   * The class this value is filed under. REQUIRED for a type with a parent axis, refused for
   * one without — the same allow-list `resolveParentKey` enforces, reported per row.
   *
   * `null` is NOT accepted. A value of a filed-under kind is born filed, and the kind's
   * declared `fallbackParentKey` answers an operator's UNFILE, never a blank column: a blank
   * column is a typo, and the platform answering a typo with a price tier is exactly what
   * `ENUMERATION_PARENT_REQUIRED` exists to refuse.
   */
  @ApiPropertyOptional({ maxLength: 64, pattern: KEY_PATTERN.source })
  @ValidateIf((o: CreateEnumerationValueRowDto) => o.parentKey !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  parentKey?: string;
}

/**
 * Load many values of ONE kind in one transaction — what a pasted list saves.
 *
 * ALL-OR-NOTHING, and every bad row is reported at once (`meta.problems[].index`, ZERO-BASED
 * into `rows`; the screen adds one to name a line). A half-applied paste leaves the operator
 * reconstructing which half landed by diffing a textarea against a list they cannot see —
 * the same reasoning `setCategoriesBulk` and `setParentKeysBulk` already state for their own
 * refusal of partial writes.
 *
 * A DUPLICATE is not a problem: it is what a re-paste looks like, and it comes back in the
 * SUCCESS body as `skipped`.
 *
 * The mirrored question is re-synced and the questionnaire republished ONCE, after the
 * transaction commits — not once per row. That is the whole reason this endpoint exists
 * rather than a client loop.
 */
export class CreateEnumerationValuesBulkDto {
  @ApiProperty({ minLength: 1, maxLength: 48, pattern: KEY_PATTERN.source })
  @IsString()
  @IsNotEmpty()
  @Length(1, 48)
  @Matches(KEY_PATTERN)
  type!: string;

  /** 500, matching the two sibling bulk DTOs. A longer list is pasted in two goes. */
  @ApiProperty({ type: [CreateEnumerationValueRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateEnumerationValueRowDto)
  rows!: CreateEnumerationValueRowDto[];

  /**
   * `skip` (default) — a key the list already holds is reported and left alone. `fail` — it
   * becomes a problem and refuses the batch.
   *
   * Two spellings because a re-paste and a paste-into-the-wrong-list are different
   * intentions, and only the operator knows which one they are having.
   */
  @ApiPropertyOptional({ enum: ['skip', 'fail'], default: 'skip' })
  @IsOptional()
  @IsIn(['skip', 'fail'])
  onDuplicate?: 'skip' | 'fail';

  /** Validate and report, write nothing and publish nothing. What a "check my list" posts. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  /**
   * Write the rows and DO NOT re-sync the mirrored question — the caller will.
   *
   * For the one caller that writes to several lists in a row: building a predefined product
   * may add to three, and a sync each cuts a questionnaire version each, which is the
   * per-write publish this endpoint exists to avoid. That caller syncs every list it touched
   * and publishes once at the end.
   *
   * NOT on the HTTP surface — a screen posting this would leave the questionnaire behind the
   * registry with nothing scheduled to catch it up. `deferMirrorSync` is stripped from the
   * wire by `forbidNonWhitelisted` precisely because it is not declared here as an API field
   * but passed in-process, which is the distinction that keeps it safe.
   */
  deferMirrorSync?: boolean;
}

/** What a successful bulk create reports back. */
export interface EnumerationBulkCreateResult {
  type: string;
  created: number;
  skipped: number;
  /** The keys the server minted, in row order — what identifies the rows on the class board. */
  createdKeys: string[];
  /** Rows left alone because the list already held that key. `index` is ZERO-BASED. */
  skippedRows: Array<{ index: number; key: string }>;
  /** Whether the mirrored question moved and a new questionnaire version was published. */
  republished: boolean;
}

/**
 * NOTE: `categories` is deliberately absent here. Assignment has its own
 * endpoint so that "empty array = parked" cannot collide with PATCH's
 * "omitted = unchanged" — the two semantics are irreconcilable on one field.
 */
export class UpdateEnumerationDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  labelAr?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  labelEn?: string;

  /**
   * `@Length(1, …)` and `KEY_PATTERN`, not `@Length(0, …)`: an empty string used to be
   * accepted and STORED, and it then passed the `parentKey IS NOT NULL` filter the engine's
   * parent walk uses — so the value looked filed, resolved to `no_matching_row`, and quoted
   * nothing. Omitting the field is how a patch says "do not touch the parent", and for a type
   * that is filed under a list there is no spelling of "unfile it" here at all — that is
   * `POST parent-keys` with `null`, so a label-only edit can never re-file anything.
   *
   * `@ValidateIf(!== undefined)` rather than `@IsOptional()`, for the reason
   * `CreateEnumerationDto` states: `@IsOptional()` skips `null` too, and `null` then reached
   * Prisma as an invalid argument (a 500 rather than a stated refusal).
   */
  @ApiPropertyOptional({ maxLength: 64, pattern: KEY_PATTERN.source })
  @ValidateIf((o: UpdateEnumerationDto) => o.parentKey !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  parentKey?: string;

  /**
   * `program_name` only — re-point, or unlink, the surrogate product.
   *
   * THREE values, and unlike `parentKey` all three are reachable here:
   *   absent — do not touch the link (what a label-only edit sends)
   *   `null` — UNLINK. A real operator action: moving a name back to the payslip basis,
   *            or off an archetype that turned out to be the wrong one. There is no bulk
   *            endpoint for it to live on instead, which is why `parentKey` can refuse
   *            `null` here and this cannot.
   *   a key  — link to that product; it must be a live `surrogate_product`.
   *
   * `''` is refused, same as `parentKey` and for the same reason: "not linked" has one
   * spelling. A stored empty string would be a link that resolves to nothing while
   * looking set.
   *
   * Unlinking a name that is still on the no-payslip basis is refused with
   * `SURROGATE_PRODUCT_REQUIRED` — the basis and the link are one decision, and the
   * order the two are written in must not decide whether the row ends up valid.
   */
  @ApiPropertyOptional({ maxLength: 64, pattern: KEY_PATTERN.source, nullable: true })
  @ValidateIf(
    (o: UpdateEnumerationDto) =>
      o.surrogateProductKey !== undefined && o.surrogateProductKey !== null,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  surrogateProductKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deprecate?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class EnumerationRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() key!: string;
  @ApiProperty() labelAr!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ nullable: true }) deprecatedAt!: string | null;
  @ApiProperty() systemOnly!: boolean;
  @ApiProperty({ nullable: true }) parentKey!: string | null;
  /**
   * `program_name` only — the surrogate product this name takes its calculation from,
   * or `null` when it states its own rule. Always projected, never conditional: the
   * admin has to be able to tell "linked" from "states its own" on every row, and an
   * absent field would read as the second when it might be the first.
   */
  @ApiProperty({ nullable: true }) surrogateProductKey!: string | null;
  /**
   * `program_name` only — does this name state a calculation of its OWN?
   *
   * The bit, not the rule. With `surrogateProductKey` above it, a board can tell the three
   * states of a name sold without a payslip apart: it takes a product's calculation, it
   * states its own (legacy, but it quotes), or it has neither and quotes nothing.
   */
  @ApiProperty() hasOwnIncomeRule!: boolean;
  /**
   * How many bank programs instantiate this archetype, across how many banks.
   * Present on `program_name` rows only — other enumeration types are not
   * referenced by a dedicated column.
   */
  @ApiPropertyOptional()
  usage?: {
    programs: number;
    banks: number;
    /** Of those, how many are typed `income_surrogate` — sold with no payslip. */
    noPayslipPrograms: number;
    /**
     * No-payslip programs that assume no income yet — the program says there is no
     * payslip, but the bank's own income table was never entered, so the rule reads
     * the declared salary and the customer gets no figure. What the list badges as
     * "programs with no table".
     */
    noPayslipProgramsWithoutTable: number;
    /**
     * The same payslip / no-payslip split, per loan category the name is sold under —
     * `{ personal: { payslip: 2, noPayslip: 1 } }`.
     *
     * What the catalog name's per-loan-type tabs render, and the ONLY answer the
     * platform has to "how is this name sold here" since v16.4.0: the catalog used to
     * store the answer as a per-pair tick the API enforced, which let a stale tick
     * refuse a save the bank was entitled to make. A count reports; it cannot refuse.
     *
     * A category with no program is ABSENT, not zeroed — "no bank offers this yet" and
     * "0 of them read a payslip" are different sentences on that tab.
     */
    byCategory: Partial<Record<LoanCategory, { payslip: number; noPayslip: number }>>;
  };
  /**
   * Loan categories this entry may be offered under. Present on `program_name`
   * rows only — other types have no such axis, and an empty array on one of
   * them would read as "parked" rather than "not applicable". On a
   * `program_name` row `[]` DOES mean parked: offerable nowhere.
   */
  @ApiPropertyOptional({ enum: LoanCategory, isArray: true }) categories?: LoanCategory[];
  /**
   * How this name is MEANT to be sold under each category it is assigned to —
   * `{ personal: ['payslip','no_payslip'], car: ['payslip'] }`. Present on
   * `program_name` rows only.
   *
   * Keyed by the ASSIGNMENT, so a category absent here is one the name is not
   * offered under at all; an assigned category always carries at least one basis.
   *
   * This is the catalog's INTENT. It constrains no bank program — `usage.byCategory`
   * above reports what banks actually picked, and the two are allowed to disagree.
   * Do not reintroduce a save-time rejection on it (v16.4.0): the bank states the
   * basis on its own program, and a stale tick here refused saves it should not have.
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string', enum: [...ALL_INCOME_BASES] } },
    example: { personal: ['payslip', 'no_payslip'], car: ['payslip'] },
  })
  incomeBasesByCategory?: Partial<Record<LoanCategory, IncomeBasis[]>>;
  /**
   * The question whose ANSWER is this fact. `surrogate_fact` rows only.
   *
   * Three states, all meaningful: absent (this type binds no question), `null` (a fact
   * nobody has pointed at a question yet, or whose question was deleted — no bank can
   * price it), and present. A present-but-`active: false` question is a fourth: the
   * binding stands, but the question has left the questionnaire, so no new applicant
   * answers it. The screen renders all four differently because each has its own fix.
   */
  @ApiPropertyOptional({
    type: 'object',
    nullable: true,
    example: { code: 'military_grade', type: 'SINGLE_SELECT', active: true },
  })
  boundQuestion?: {
    code: string;
    type: string;
    labelAr: string;
    labelEn: string;
    active: boolean;
  } | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/**
 * Point one FACT at the question that answers it — the picker on Manage values.
 *
 * `questionCode: null` UNBINDS, and is why the field is nullable rather than optional:
 * an absent key and an explicit `null` must not mean the same thing when the write is a
 * full replacement of the binding.
 */
export class SetEnumerationBoundQuestionDto {
  @ApiProperty({
    nullable: true,
    example: 'military_grade',
    description: 'Question code, or null to unbind.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  questionCode!: string | null;
}

/**
 * Create a KIND of list — the registry's own taxonomy row.
 *
 * `key` carries the same pattern and budget as a VALUE's key because it lands in the same
 * column shape (`platform_enumeration.type`, VARCHAR(48)) and is compared against it by
 * string. It is immutable after create: every value carries the string, so a rename would
 * strand all of them.
 *
 * `systemOnly` is deliberately absent. It means "a code path reads this type by name",
 * which is a fact about the codebase — not a property an operator may claim, and claiming
 * it would only buy them a delete refusal.
 */
export class CreateEnumerationTypeDto {
  @ApiProperty({ minLength: 1, maxLength: 48, pattern: KEY_PATTERN.source })
  @IsString()
  @IsNotEmpty()
  @Length(1, 48)
  @Matches(KEY_PATTERN, { message: 'key must be alphanumeric / underscore / hyphen' })
  key!: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelAr!: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelEn!: string;

  @ApiPropertyOptional({ maxLength: 400 })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  descriptionAr?: string;

  @ApiPropertyOptional({ maxLength: 400 })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  descriptionEn?: string;

  @ApiPropertyOptional({ maxLength: 48, description: 'ng-zorro icon name.' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  icon?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  exampleAr?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  exampleEn?: string;

  /**
   * The kind whose values these are filed under.
   *
   * `@ValidateIf(!== undefined)` rather than `@IsOptional()`, which skips validation for
   * `null` as well — the same trap `parentKey` documents two DTOs up. Here `null` and
   * `undefined` legitimately mean the same thing ("no parent axis"), but an explicit `null`
   * must still be shape-checked rather than reaching Prisma unvalidated.
   */
  @ApiPropertyOptional({ maxLength: 48, pattern: KEY_PATTERN.source })
  @ValidateIf(
    (o: CreateEnumerationTypeDto) => o.parentTypeKey !== undefined && o.parentTypeKey !== null,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 48)
  @Matches(KEY_PATTERN)
  parentTypeKey?: string | null;

  /**
   * Where a value of this kind goes when an operator UNFILES it, by key of the
   * `parentTypeKey` list. `null` (or absent) = no fallback, and an unfile then stores `null`
   * exactly as it does today.
   *
   * Validated at set time against the axis this write RESULTS in: a fallback on a kind with
   * no axis, or naming a class that is not a live member, is refused with
   * `ENUMERATION_TYPE_FALLBACK_INVALID`. Never read on a value CREATE — a blank class on a
   * pasted row is a typo, and the platform answering a typo with a price tier is what
   * `ENUMERATION_PARENT_REQUIRED` exists to refuse.
   */
  @ApiPropertyOptional({ maxLength: 64, pattern: KEY_PATTERN.source, nullable: true })
  @ValidateIf(
    (o: CreateEnumerationTypeDto) =>
      o.fallbackParentKey !== undefined && o.fallbackParentKey !== null,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  fallbackParentKey?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  deletable?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  onValuesRail?: boolean;

  /**
   * The `surrogate_product` that is authoring this list.
   *
   * Sent by the product screen and by nothing else. Provenance, not a constraint: it records
   * which lists a product made so its own screen can show them before there is a rule to
   * derive that from, and it gates nothing — any rule may read any list.
   *
   * NOT validated against a live product here, deliberately. Every other key-shaped field on
   * this surface is, but those decide whether a WRITE is legal; this one decides only what a
   * screen groups a row under, and refusing a list because its product row was retired an
   * hour ago would block the operator from making the list that replaces it.
   */
  @ApiPropertyOptional({ maxLength: 48, pattern: KEY_PATTERN.source })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 48)
  @Matches(KEY_PATTERN)
  surrogateProductKey?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

/**
 * Patch a KIND. `key` is absent on purpose — see `CreateEnumerationTypeDto`.
 *
 * Every field optional and every absence meaning "leave it", so a screen that edits one
 * label cannot flatten a parent axis it never rendered.
 */
export class UpdateEnumerationTypeDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelAr?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelEn?: string;

  @ApiPropertyOptional({ maxLength: 400, nullable: true })
  @ValidateIf(
    (o: UpdateEnumerationTypeDto) => o.descriptionAr !== undefined && o.descriptionAr !== null,
  )
  @IsString()
  @MaxLength(400)
  descriptionAr?: string | null;

  @ApiPropertyOptional({ maxLength: 400, nullable: true })
  @ValidateIf(
    (o: UpdateEnumerationTypeDto) => o.descriptionEn !== undefined && o.descriptionEn !== null,
  )
  @IsString()
  @MaxLength(400)
  descriptionEn?: string | null;

  @ApiPropertyOptional({ maxLength: 48, nullable: true })
  @ValidateIf((o: UpdateEnumerationTypeDto) => o.icon !== undefined && o.icon !== null)
  @IsString()
  @MaxLength(48)
  icon?: string | null;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @ValidateIf((o: UpdateEnumerationTypeDto) => o.exampleAr !== undefined && o.exampleAr !== null)
  @IsString()
  @MaxLength(160)
  exampleAr?: string | null;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @ValidateIf((o: UpdateEnumerationTypeDto) => o.exampleEn !== undefined && o.exampleEn !== null)
  @IsString()
  @MaxLength(160)
  exampleEn?: string | null;

  /** `null` REMOVES the parent axis; absent leaves it. */
  @ApiPropertyOptional({ maxLength: 48, pattern: KEY_PATTERN.source, nullable: true })
  @ValidateIf(
    (o: UpdateEnumerationTypeDto) => o.parentTypeKey !== undefined && o.parentTypeKey !== null,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 48)
  @Matches(KEY_PATTERN)
  parentTypeKey?: string | null;

  /**
   * Where a value of this kind goes when an operator UNFILES it, by key of the
   * `parentTypeKey` list. `null` (or absent) = no fallback, and an unfile then stores `null`
   * exactly as it does today.
   *
   * Validated at set time against the axis this write RESULTS in: a fallback on a kind with
   * no axis, or naming a class that is not a live member, is refused with
   * `ENUMERATION_TYPE_FALLBACK_INVALID`. Never read on a value CREATE — a blank class on a
   * pasted row is a typo, and the platform answering a typo with a price tier is what
   * `ENUMERATION_PARENT_REQUIRED` exists to refuse.
   */
  @ApiPropertyOptional({ maxLength: 64, pattern: KEY_PATTERN.source, nullable: true })
  @ValidateIf(
    (o: UpdateEnumerationTypeDto) =>
      o.fallbackParentKey !== undefined && o.fallbackParentKey !== null,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN)
  fallbackParentKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deletable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onValuesRail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
