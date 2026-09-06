import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { INCOME_ASSUMPTION_STRATEGIES } from '@/matching/types';

/**
 * Spec anchor: FR-005 … FR-014. The CANONICAL income rule, as it crosses the wire.
 *
 * Boundary validation here is shape only — a strategy from the known set, rows
 * that are objects with decimal-string money. The DEEP cross-field rules (table
 * non-empty for the selected method, keys unique and live in the registry, bands
 * ordered / gapless / open-ended last, income > 0, DBR override in range) live in
 * `validation/income-rule.validator.ts` beside `dbr-bands.validator.ts`, because
 * they need the platform-enumeration registry and because `class-validator` cannot
 * express "this field is required depending on the value of that one" without a
 * custom decorator per pair.
 *
 * Money is a decimal STRING at every hop (Principle I / A3). `@Matches` rather
 * than `@IsNumberString` so a value like `1e5` or `Infinity` — both of which
 * `Number()` accepts and `Decimal` would mangle — is refused at the boundary.
 */

/** Decimal string: optional sign, digits, optional fraction. No exponents. */
const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

export type IncomeAssumptionStrategy = (typeof INCOME_ASSUMPTION_STRATEGIES)[number];

const STRATEGIES: readonly IncomeAssumptionStrategy[] = INCOME_ASSUMPTION_STRATEGIES;

/** One row of a key table: a registry member and the income the bank assigns it. */
export class IncomeKeyTableRowDto {
  @ApiProperty({ example: 'senior_officer', description: 'An ACTIVE registry key.' })
  /**
   * A registry key, e.g. `senior_officer`. Membership is checked in the service
   * layer against the ACTIVE members of the method's enumeration
   * (`INCOME_RULE_UNKNOWN_KEY`) — not here, because this DTO has no registry.
   */
  @IsString()
  @Matches(/^[a-z0-9_]+$/, { message: 'key must match ^[a-z0-9_]+$' })
  key!: string;

  @ApiProperty({
    example: '25000',
    type: String,
    description: 'Assumed monthly income, decimal STRING and > 0 (Principle I).',
  })
  @IsString()
  @Matches(DECIMAL_STRING, { message: 'incomeEGP must be a decimal string' })
  incomeEGP!: string;
}

/**
 * One income band, half-open `[fromInclusive, toExclusive)`.
 *
 * `toExclusive: null` marks the open-ended last band, so the field is nullable
 * rather than optional: an ABSENT key and an explicit `null` must not mean the
 * same thing on a full-replacement PUT.
 */
export class IncomeBandDto {
  @ApiProperty({ example: '0', type: String, description: 'Inclusive lower edge.' })
  @IsString()
  @Matches(DECIMAL_STRING, { message: 'fromInclusive must be a decimal string' })
  fromInclusive!: string;

  @ApiProperty({
    example: '5',
    type: String,
    nullable: true,
    description: 'EXCLUSIVE upper edge; null marks the open-ended last band.',
  })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: 'toExclusive must be a decimal string or null' })
  toExclusive!: string | null;

  @ApiProperty({ example: '12000', type: String })
  @IsString()
  @Matches(DECIMAL_STRING, { message: 'incomeEGP must be a decimal string' })
  incomeEGP!: string;
}

/** The single number a scalar method applies, plus the unit it is applied in. */
export class IncomeScalarDto {
  @ApiProperty({ example: '0.1', type: String })
  @IsString()
  @Matches(DECIMAL_STRING, { message: 'value must be a decimal string' })
  value!: string;

  /**
   * Documents the arithmetic the resolver performs, so a reader of the stored blob
   * can tell `0.1 × limit` from `0.1% of limit` without opening the resolver.
   */
  @ApiProperty({ enum: ['percent', 'multiplier'] })
  @IsIn(['percent', 'multiplier'])
  unit!: 'percent' | 'multiplier';
}

/** One source of additional income, and the share of it a bank counts. */
export class AdditionalIncomeSourceDto {
  @ApiProperty({ example: 'rental_income_monthly' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_]{0,63}$/, { message: 'factKey must be a registry fact key' })
  factKey!: string;

  /**
   * `(0, 100]`, checked in the validator rather than here.
   *
   * Zero is refused there rather than read as "do not count it": a source the bank does not
   * count is a source it does not list, and a zero row reads on the screen as configured
   * while contributing nothing.
   */
  @ApiProperty({ example: '50' })
  @IsString()
  @Matches(DECIMAL_STRING, { message: 'percent must be a decimal string' })
  percent!: string;
}

export class AdditionalIncomeConfigDto {
  @ApiProperty({ type: [AdditionalIncomeSourceDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AdditionalIncomeSourceDto)
  sources!: AdditionalIncomeSourceDto[];

  /**
   * The ceiling on the TOTAL, as a percentage of the basic figure. Absent = no ceiling.
   *
   * One live sheet states 100%, i.e. the extra may equal but not exceed the basic. Absent is
   * NOT 100: a bank that stated no ceiling has not stated that one.
   */
  @ApiPropertyOptional({ example: '100' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: 'capPercentOfBasic must be a decimal string' })
  capPercentOfBasic?: string;
}

export class IncomeAssumptionConfigDto {
  /**
   * A built-in method token, or `fact:<key>` naming a row of the operator-managed fact
   * registry.
   *
   * `@Matches` rather than `@IsIn`, because the legal set is no longer knowable at
   * compile time — that is the whole point of the registry. The pattern is the SHAPE
   * check this layer owns; whether the fact exists and can be served is decided in
   * `validateIncomeRule`, which has the registry and answers with
   * `INCOME_RULE_FACT_UNAVAILABLE` naming the alternatives. A `@IsIn` here would have
   * refused every operator-defined method with a shape error listing eleven tokens.
   */
  @ApiProperty({
    example: 'fact:military_grade',
    description: `One of ${STRATEGIES.join(', ')} — or \`fact:<key>\` for a registry fact.`,
  })
  @IsString()
  @Matches(/^(?:[a-zA-Z]+|fact:[a-z0-9_]+)$/, {
    message: 'strategy must be a built-in method or `fact:<key>`',
  })
  strategy!: IncomeAssumptionStrategy;

  /**
   * Whose figures the tables below are. Program rules only — a catalog program name
   * states its own, so its rule never sends this.
   *
   * OPTIONAL, and absent means `'own'`. Every stored row predates the field and
   * carries its own numbers, so the absent case has to be the one that changes
   * nothing; defaulting to `'catalog'` would re-point the whole book at tables it has
   * never quoted from.
   *
   * On `'catalog'` the tables are STRIPPED before persistence and merged back from
   * the program name at read (`income-rule-inherit.ts`). Sending them anyway is not
   * an error — the wizard pre-fills the editor from the catalog so the operator can
   * see what they are accepting, and that copy simply is not kept.
   */
  @ApiPropertyOptional({
    enum: ['catalog', 'own'],
    description: "Whose figures these are. Absent = `own`. `catalog` inherits the program name's.",
  })
  @IsOptional()
  @IsIn(['catalog', 'own'])
  amounts?: 'catalog' | 'own';

  // --- canonical shapes ------------------------------------------------------
  //
  // All three are optional at the boundary and mutually exclusive in practice:
  // configuration belonging to a method other than `strategy` is stripped before
  // persistence (FR-011), and the selected method's own shape being absent or
  // empty is `INCOME_RULE_EMPTY` (FR-009). Making them conditionally required here
  // would need a custom decorator per method and would still not cover emptiness.

  /**
   * `ArrayMaxSize` is a denial-of-service bound, not a policy: a real rank or grade
   * table runs 10–15 rows, and the whole blob is loaded per program inside the
   * per-quote loop.
   */
  @ApiPropertyOptional({ type: [IncomeKeyTableRowDto], description: 'Key methods only.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => IncomeKeyTableRowDto)
  keyTable?: IncomeKeyTableRowDto[];

  @ApiPropertyOptional({
    type: [IncomeBandDto],
    description: 'Range methods only. Ordered, gapless, last band open-ended.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => IncomeBandDto)
  bands?: IncomeBandDto[];

  @ApiPropertyOptional({ type: IncomeScalarDto, description: 'Scalar methods only.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => IncomeScalarDto)
  scalar?: IncomeScalarDto;

  // --- the step pipeline (`strategy: 'steps'`) ---------------------------------
  //
  // Shape only, and loosely: a step's legal fields depend on its `op`, a gate's on its
  // `kind`, and a reference may name a step, a fact or a literal. `class-validator`
  // cannot express any of that without a decorator per combination, and every one of
  // those rules IS expressed — once, in `validateProductRule`, which is also the
  // authority the catalog write and the draft CHECK endpoint run through, so a pipeline
  // can never be accepted by one door and refused by another.
  //
  // The caps are the real boundary work here: an unbounded `steps` array is a request
  // that can pin a worker evaluating a rule nobody meant to author.

  /**
   * The catalog name's ordered steps. Never persisted on a bank program —
   * `stripCatalogStructure` removes them, because the structure belongs to the name.
   */
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  steps?: unknown[];

  /** The catalog name's gates. A failed gate is a stated reason, never a filter. */
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  gates?: unknown[];

  /** `{ kind: 'monthlyIncome' | 'maxAmount', from, baselineDbrPercent? }`. */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  output?: Record<string, unknown>;

  /**
   * The catalog's statement of how this product's ways relate — rivals a bank picks one of,
   * or the terms of one method it fills whole. Declared here so a client echoing back a rule
   * it just read is not rejected by the global `forbidNonWhitelisted` pipe; a bank program
   * never stores it (`stripCatalogStructure`).
   */
  @ApiPropertyOptional({ enum: ['exclusive', 'combined'] })
  @IsOptional()
  @IsIn(['exclusive', 'combined'])
  waysAre?: 'exclusive' | 'combined';

  /**
   * Which way this program sells, as the way's slot id.
   *
   * Shape only here. That the id names a way of THIS product, that the product holds its ways
   * as alternatives at all, and that no other way carries figures are all decided once in
   * `validateProductRule`, which holds the rule — the same authority the catalog write and
   * the draft CHECK endpoint run through.
   */
  @ApiPropertyOptional({ example: 'alt__unit_paid_to_date' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]{1,80}$/, { message: 'wayId must be a step slot id' })
  wayId?: string;

  /**
   * The BANK's figures, keyed by step id and gate id. The only half of a product rule a
   * bank program stores, and the whole of "a fifth bank is one config row".
   */
  @ApiPropertyOptional({
    type: Object,
    example: { capBasis: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] } },
  })
  @IsOptional()
  @IsObject()
  stepParams?: Record<string, unknown>;

  // --- policy on top of the method -------------------------------------------

  /** FR-012 — bounds checked in the service layer (`INCOME_RULE_DBR_OVERRIDE_INVALID`). */
  @ApiPropertyOptional({
    example: '45',
    type: String,
    description: 'FR-012 — (0, 100]. Applied only when the income came FROM this rule.',
  })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING, { message: 'dbrCapPercentOverride must be a decimal string' })
  dbrCapPercentOverride?: string;

  /**
   * Money the applicant earns beside the basic figure, counted at this bank's weight per
   * source and optionally capped as a share of the basic figure (spec §10.11).
   *
   * Shape only here. That every named fact exists, is numeric and is actually ASKED is
   * decided in `validation/income-rule.validator.ts`, which holds the registry.
   */
  @ApiPropertyOptional({ type: () => AdditionalIncomeConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdditionalIncomeConfigDto)
  additionalIncome?: AdditionalIncomeConfigDto;

  /** FR-013 — `required_document` registry keys. Mismatch is a warning, never a rejection. */
  @ApiPropertyOptional({ type: [String], example: ['military_id'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  requiredDocuments?: string[];

  @ApiPropertyOptional({
    enum: ['lesser_of', 'greater_of'],
    description: 'Absent = the rule REPLACES a declared salary.',
  })
  @IsOptional()
  @IsIn(['lesser_of', 'greater_of'])
  combinationRule?: 'lesser_of' | 'greater_of';

  // --- LEGACY shapes ---------------------------------------------------------
  //
  // Accepted so a client echoing back a program it just READ cannot be rejected by
  // the global `forbidNonWhitelisted` pipe. Nothing writes them: the save path
  // persists the canonical shape, and `normalizeIncomeAssumption` is the only
  // reader. Removing them would break the read-modify-write cycle for any legacy
  // program until it had been saved once through the new form.

  @IsOptional()
  @IsArray()
  incomeTable?: Array<{
    minYears?: number;
    maxYears?: number;
    minCDValueEGP?: string;
    assumedIncomeEGP?: string;
    incomeEGP?: string;
  }>;

  @IsOptional() @IsObject() rankIncomeMap?: Record<string, string>;
  @IsOptional() @IsObject() gradeIncomeMap?: Record<string, string>;

  @IsOptional() @IsString() cdIncomePercent?: string;
  @IsOptional() @IsString() cdIncomeMinEGP?: string;
  @IsOptional() @IsString() cdIncomePercentOfDeposits?: string;
  @IsOptional() @IsString() carInstallmentMultiplier?: string;
  @IsOptional() @IsString() carLoanAmountPercent?: string;
  @IsOptional() @IsString() creditCardLimitMultiplier?: string;
  @IsOptional() @IsString() bankStatementPercent?: string;
}
