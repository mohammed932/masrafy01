/**
 * Who owns which half of an income rule. Pure functions, no Nest, no Prisma, no
 * clock (Constitution Principle V).
 *
 * TWO links, and they are not the same shape:
 *
 *   surrogate product → catalog program name   `effectiveProgramNameRule`
 *       STRICT REPLACE. A linked name states no rule of its own, so there is no
 *       second place a figure can live and nothing to drift.
 *
 *   catalog program name → bank program        `effectiveIncomeRule`
 *       MERGE. The structure is always the name's; the FIGURES are the name's only
 *       when the bank says `amounts: 'catalog'`.
 *
 * The rest of this file is the second link, which came first and is documented
 * below on its own terms.
 *
 * A catalog program name states exactly ONE income proof and one set of starting
 * figures. A bank program filed under that name either takes those figures
 * (`amounts: 'catalog'`) or states its own (`amounts: 'own'`, the default and what
 * every pre-existing row means). This module is the ONE place the first case is
 * turned back into a complete rule.
 *
 * It runs in `toBankProgramSnapshot`, which is already the single Prisma-row →
 * engine-snapshot mapping every quote path goes through. Doing it there rather than
 * inside the resolver keeps the engine a pure module that is handed one finished
 * rule, exactly as before — the resolver cannot tell an inherited table from an
 * authored one, and nothing downstream needs to learn a second shape.
 *
 * What is inherited and what is not:
 *
 *   inherited   keyTable / bands / scalar, and the legacy scalar keys a catalog
 *               rule may still carry, because they ARE the figures
 *   never       strategy — copied onto the program at save and enforced equal
 *               (`PROGRAM_NAME_INCOME_PROOF_MISMATCH`), so a reader that switches
 *               on it keeps working against the program object alone
 *   never       requiredDocuments / combinationRule — bank policy, which is why a
 *               bank on catalog amounts still has its own
 *   when blank  dbrCapPercentOverride, and the I-Score tier table. Both are stated by
 *               the PRODUCT and overridden per bank, so a bank that states neither
 *               reads the product's — see `withInheritedDbrCap` / `withInheritedSlots`
 */

import { isProductRuleStrategy } from '../types';
import type { IncomeAssumptionConfig } from '../types';
import type { GateParams, ProductRule, StepParams } from './product-rule';
import { allWaySlots, wayOwnedSlots, waysOfRule } from './product-rule-ways';
import { SLOT } from './product-template';

/**
 * The figure-bearing keys. The legacy five are included because a catalog rule
 * seeded from a legacy program can carry them (`normalizeIncomeAssumption` turns
 * them into `scalar` on read, but the stored blob is whatever was written), and
 * inheriting `scalar` while leaving the legacy key behind would hand the resolver
 * a rule whose two halves disagree.
 */
const AMOUNT_KEYS = [
  'keyTable',
  'bands',
  'scalar',
  // A product rule's figures. Same rule, one level deeper: the bank's numbers live in
  // one map keyed by step id, so inheriting them is inheriting this key.
  'stepParams',
  'incomeTable',
  'rankIncomeMap',
  'gradeIncomeMap',
  'cdIncomePercent',
  'cdIncomePercentOfDeposits',
  'cdIncomeMinEGP',
  'bankStatementPercent',
  'carInstallmentMultiplier',
  'carLoanAmountPercent',
  'creditCardLimitMultiplier',
] as const satisfies ReadonlyArray<keyof IncomeAssumptionConfig>;

/**
 * The rule's non-figure policy fields — carried across a figures-only write to the
 * row that STATES them (see `carryStoredPolicy`).
 *
 * `dbrCapPercentOverride` is on this list because it is part of the rule blob and no
 * pipeline screen used to edit it; that it is now also INHERITED when a program leaves
 * it blank is a separate matter, decided by `withInheritedDbrCap`.
 */
const POLICY_KEYS = [
  'dbrCapPercentOverride',
  'requiredDocuments',
  'combinationRule',
] as const satisfies ReadonlyArray<keyof IncomeAssumptionConfig>;

/**
 * The figure slots a program inherits from the product WHEN IT STATES NONE OF ITS OWN,
 * whatever `amounts` says. Exactly one member, and the narrowness is the point.
 *
 * A blank slot normally means "this bank does not sell this way" / "does not apply this
 * condition" — a stated decision the product must not override, which is why the rest of
 * `stepParams` is inherited whole-key and only on `amounts: 'catalog'`.
 *
 * The I-Score table is not like that. The score is a PLATFORM fact about the applicant,
 * every rule-bearing product carries the four steps, and the compiled shape answers a
 * blank table with `{const:'100'}` — so a blank here has never meant "declined", it has
 * meant "nobody has stated the tiers". Reading the product's tiers in that state is what
 * lets a product state them once for every bank selling it, and a bank that disagrees
 * types its own (including a flat 100%, which is how it opts out).
 */
const SLOTS_INHERITED_WHEN_BLANK: ReadonlySet<string> = new Set([SLOT.iScoreBand]);

/** A percentage nobody stated: absent, null, or whitespace. */
function isBlankOverride(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/** A band slot nobody stated: the key is absent, or its table has no rows. */
function slotStatesNoBands(figures: StepParams | undefined): boolean {
  return figures === undefined || (figures.bands?.length ?? 0) === 0;
}

/**
 * Does this program rule take its figures from the catalog?
 *
 * ABSENT reads as `'own'`. Every row written before the field existed carries its
 * own numbers, so the absent case must be the one that changes nothing — a default
 * of `'catalog'` would silently re-point the entire stored book at tables it has
 * never quoted from.
 */
export function inheritsCatalogAmounts(config: IncomeAssumptionConfig): boolean {
  return config.amounts === 'catalog';
}

/**
 * The catalog program name's rule, resolved through the surrogate product it links to.
 *
 * Runs one level ABOVE `effectiveIncomeRule`: it produces the catalog rule that the
 * bank-level merge then reads. Both run inside the repository, so the engine still
 * receives one finished rule and cannot tell a linked product from an authored name.
 *
 * STRICT REPLACE when a product is present, not a merge — and this is the load-bearing
 * choice, not a shortcut. Merging would give structure-from-product plus
 * figures-from-name, a THIRD level of inheritance on a system whose two-level story is
 * the whole of this file; the default figures ARE part of what an archetype offers, so
 * two names needing different ones are two products. The state never arises anyway: the
 * migration NULLs a linked name's rule and the save path refuses to create it. If it
 * somehow does, the product wins, because the product is the thing the operator was
 * looking at when they edited it.
 *
 *   both absent    → undefined   the map omits the key, and
 *                                `PROGRAM_NAME_INCOME_PROOF_MISSING` still fires
 *   product absent → own         every payslip name, and every no-payslip name that
 *                                predates the archetypes. Unchanged behaviour.
 *   own null       → product     the linked case
 *   both present   → product     see above; should be unreachable
 *   product OFF    → withheld    the product is switched off, so the platform states
 *                                that there is no calculation — see below
 *
 * `undefined` and not `null` on the empty case: the caller is building a Map that the
 * bank-level merge reads with `.get()`, and `effectiveIncomeRule` already spells "no
 * catalog rule" as `undefined`. Two spellings of one absence is how a rule gets quoted
 * that nobody wrote.
 *
 * A SWITCHED-OFF product is `withheld`, never an omission, and never a merge with the
 * name's own rule. Two reasons, both load-bearing:
 *
 *   · omitting it would let a single-fact product fall through to the resolver's
 *     "a declared salary still carries the quote" branch, re-pricing the program off a
 *     payslip the bank never agreed to lend against. The withholding has to be a fact
 *     the quote can refuse on, not a gap it can fill;
 *   · it wins over the name's own rule for the same reason STRICT REPLACE wins above —
 *     the product is the thing the operator was looking at when they switched it off,
 *     and reviving a name's grandfathered rule underneath would quote a table nobody
 *     chose in that moment.
 *
 * A DANGLING link (a `surrogateProductKey` naming no row) stays `own` and is NOT
 * withheld: the causes differ — one is an operator's decision, the other is a broken
 * reference — and the dangling case is pinned as an omission by its own test.
 *
 * The withheld variant still CARRIES the rule it is withholding, and that is deliberate.
 * Switching a product off is a decision about what QUOTES, not about what is configured:
 * the row keeps its calculation, the product screen still renders it, and the admin save
 * path still merges the catalog's figures so a bank program under a linked name validates
 * exactly as it did before. Only the quote reads the marker, and it refuses on it before
 * any figure is priced. Dropping the rule here would make switching a product off silently
 * change what an operator is allowed to SAVE, which nobody asked for.
 */
export type CatalogRuleResolution =
  | {
      readonly rule: IncomeAssumptionConfig;
      /**
       * The surrogate product the rule is read FROM; absent when the name holds its own
       * (grandfathered) rule. Read by the save path to decide whether "exactly one way" is
       * asked of a program at all — see `IncomeRuleValidationOptions.surrogateProductKey`.
       */
      readonly productKey?: string;
    }
  | {
      readonly withheld: 'surrogate_product_retired';
      readonly productKey: string;
      /** Absent when the switched-off product holds no calculation at all. */
      readonly rule?: IncomeAssumptionConfig;
    };

/**
 * The rule a resolution holds, whether or not the platform is withholding it.
 *
 * The ONE way to read a resolution's figures, so no caller has to know that a `withheld`
 * entry still carries them. Every admin path (save validation, the catalog merge, the
 * read-back surfaces) wants this; the quote wants the marker instead.
 */
export function catalogRuleOf(
  resolution: CatalogRuleResolution | undefined,
): IncomeAssumptionConfig | undefined {
  return resolution?.rule;
}

/**
 * Every catalog program name's resolution, keyed by `programNameKey`.
 *
 * Declared here rather than in the snapshot mapper because the repository that BUILDS it
 * may not import from a feature module (Principle IX), and the mapper that consumes it
 * re-exports this name so its callers are unchanged.
 */
export type CatalogIncomeRules = ReadonlyMap<string, CatalogRuleResolution>;

/** The product row as this module needs to read it: its rule, and whether it is live. */
export interface LinkedProduct {
  readonly key: string;
  readonly active: boolean;
  readonly deprecatedAt: Date | null;
  readonly rule: IncomeAssumptionConfig | undefined;
}

export function effectiveProgramNameRule(
  own: IncomeAssumptionConfig | null | undefined,
  product: LinkedProduct | undefined,
): CatalogRuleResolution | undefined {
  if (product !== undefined) {
    if (!product.active || product.deprecatedAt !== null) {
      return {
        withheld: 'surrogate_product_retired',
        productKey: product.key,
        ...(product.rule !== undefined ? { rule: product.rule } : {}),
      };
    }
    if (product.rule !== undefined) return { rule: product.rule, productKey: product.key };
  }
  const rule = own ?? undefined;
  return rule === undefined ? undefined : { rule };
}

/**
 * The surrogate product a resolution reads from, or `undefined` for a name's own rule.
 *
 * Withheld or not: a switched-off product is still the product the name is filed under, and
 * the save path validates a program under it exactly as before (see `CatalogRuleResolution`).
 */
export function productKeyOf(resolution: CatalogRuleResolution | undefined): string | undefined {
  return resolution?.productKey;
}

/**
 * The rule to quote on: the program's own object, with the catalog name's figures
 * merged in when it inherits.
 *
 * Returns the SAME object when nothing is inherited, so the common path allocates
 * nothing and stays referentially stable for callers that memoise on identity.
 *
 * A missing catalog rule is NOT an error here and is NOT substituted: the program is
 * returned as it stands, carrying a strategy and no table, and the resolver reports
 * `rule_unconfigured` — a stated reason. Filling in a zero, or quietly falling back
 * to `declared`, would turn "nobody has set this up" into a number (FR-020).
 */
export function effectiveIncomeRule(
  program: IncomeAssumptionConfig,
  catalogRule: IncomeAssumptionConfig | undefined,
): IncomeAssumptionConfig {
  if (catalogRule === undefined) return program;

  // A PRODUCT RULE's structure is the catalog name's, always — `amounts` decides only
  // who owns the FIGURES. Without this, a bank on its own amounts would carry no steps
  // at all and the resolver would report `rule_unconfigured` for a perfectly configured
  // program; with it in the other direction (the bank storing its own copy of the steps)
  // the two could disagree about what the product IS, which is the whole reason the
  // shape lives on the name.
  const withStructure = mergeProductRuleStructure(program, catalogRule);

  // The product's DEBT-BURDEN cap, on both amounts: it is a statement about the figure the
  // calculation produces, not about who owns the figures, so a bank on its own tables still
  // reads it unless it states one itself.
  const withCap = withInheritedDbrCap(withStructure, catalogRule);

  if (!inheritsCatalogAmounts(program)) return withInheritedSlots(withCap, catalogRule);

  const merged: IncomeAssumptionConfig = { ...withCap };
  for (const key of AMOUNT_KEYS) {
    // Deleted first so an inherited rule never keeps a figure the program left
    // behind: a program that switched from 'own' to 'catalog' before the strip in
    // `persistableIncomeAssumption` ran would otherwise quote its old table.
    delete merged[key];
    const value = catalogRule[key];
    if (value !== undefined) Object.assign(merged, { [key]: value });
  }
  return prunedToChosenWay(merged);
}

/**
 * The product's debt-burden cap, when the program states none.
 *
 * The bank's own wins whenever it states one — this is a DEFAULT, not a ceiling on what a
 * bank may say. Blank on both sides leaves the key absent, so `resolveDbrCap` falls through
 * to the program's by-applicant map, its income bands and its flat cap exactly as before.
 *
 * Runs on BOTH `amounts` values, unlike the figure keys. `amounts` answers "whose numbers
 * are in the tables"; a cap on what the resulting figure may be spent on is a different
 * question, and a bank that types its own tables has not thereby made a statement about it.
 *
 * Returns the SAME object when there is nothing to inherit.
 */
function withInheritedDbrCap(
  program: IncomeAssumptionConfig,
  catalogRule: IncomeAssumptionConfig,
): IncomeAssumptionConfig {
  if (!isBlankOverride(program.dbrCapPercentOverride)) return program;
  if (isBlankOverride(catalogRule.dbrCapPercentOverride)) return program;
  return { ...program, dbrCapPercentOverride: catalogRule.dbrCapPercentOverride };
}

/**
 * The product's I-Score tiers, for a program on its OWN amounts that states none.
 *
 * The one per-slot exception to whole-key `stepParams` inheritance, and the note above
 * `SLOTS_INHERITED_WHEN_BLANK` is the argument for it. Scoped by that set rather than by a
 * predicate over the steps: "which slots does a blank mean nothing at" is a decision about
 * the platform's own facts, not something to re-derive from a rule's shape.
 *
 * Both sides must be product rules — a single-fact rule has no `stepParams` to speak of —
 * and the merge is one slot deep, so a bank's other figures are untouched. `amounts:
 * 'catalog'` never reaches here: that program already takes the product's whole map.
 *
 * Returns the SAME object when there is nothing to inherit.
 */
function withInheritedSlots(
  program: IncomeAssumptionConfig,
  catalogRule: IncomeAssumptionConfig,
): IncomeAssumptionConfig {
  if (!isProductRuleStrategy(program.strategy)) return program;
  if (!isProductRuleStrategy(catalogRule.strategy)) return program;

  let params: Record<string, StepParams & GateParams> | undefined;
  for (const slot of SLOTS_INHERITED_WHEN_BLANK) {
    const fromProduct = catalogRule.stepParams?.[slot];
    if (slotStatesNoBands(fromProduct)) continue;
    if (!slotStatesNoBands(program.stepParams?.[slot])) continue;
    params ??= { ...(program.stepParams ?? {}) };
    // The product's own array, handed on by reference: every consumer of an effective rule
    // reads it (the resolver, the validator, the check panel) and none of them writes to it.
    // The admin screens copy before they edit — `cloneStepFigures` on the way in.
    params[slot] = fromProduct as StepParams & GateParams;
  }
  return params === undefined ? program : { ...program, stepParams: params };
}

/**
 * The inherited figures, narrowed to the ONE way this program sells.
 *
 * Inheritance is whole-key — the loop above assigns the catalog's entire `stepParams` map,
 * with no per-slot merge anywhere — and on an exclusive product that is wrong in a way that
 * quotes: the compound catalog fills FOUR way heads, so a bank on `amounts: 'catalog'` would
 * quote `min(class table, down-payment bands, 15% of everything paid, unit-type table)`, a
 * mechanism no sheet sells. Latent only because all 13 surrogate programs are on their own
 * amounts today — measured, not assumed.
 *
 * So `amounts: 'catalog'` on such a product means "use the catalog's figures FOR MY WAY",
 * which is the only reading a sheet matches. Everything that is not a way is untouched: the
 * catalog's CONDITIONS still arrive, and that is the existing documented bargain — a bank on
 * catalog amounts has said sell this product as the catalog configures it — which this change
 * must not quietly revoke.
 *
 * A rule with no `wayId` is returned as it stands. The save refuses that program
 * (`PROGRAM_INCOME_WAY_REQUIRED`); a READ must not invent a choice nobody made.
 *
 * ONE narrowing, shared with the persist path (`stripUnchosenWays`) — `merged` already
 * carries the catalog's structure, so it is its own effective rule. Two copies of "which
 * slots survive" would be two answers to the question that decides what a bank quotes.
 */
function prunedToChosenWay(merged: IncomeAssumptionConfig): IncomeAssumptionConfig {
  return stripUnchosenWays(merged, merged);
}

/**
 * The rule to STORE for a program that takes catalog amounts: its own object with
 * every figure removed.
 *
 * The save path sends the pre-filled copy the operator was looking at, which is the
 * right thing for the screen to do and the wrong thing to keep. Storing it would make
 * the link a one-time copy — the program would go on quoting those numbers after the
 * catalog moved, which is precisely the drift the catalog exists to end.
 *
 * Policy (`dbrCapPercentOverride`, `requiredDocuments`, `combinationRule`) and the
 * strategy are untouched: they are the bank's, not the catalog's.
 */
export function stripInheritedAmounts(config: IncomeAssumptionConfig): IncomeAssumptionConfig {
  if (!inheritsCatalogAmounts(config)) return config;
  const stripped: IncomeAssumptionConfig = { ...config };
  for (const key of AMOUNT_KEYS) delete stripped[key];
  return stripped;
}

/**
 * The catalog name's step structure, laid over the program's object.
 *
 * `steps` / `gates` / `output` are replaced wholesale, never merged element-wise: a
 * half-catalog, half-bank pipeline is not a rule anybody authored, and a partial overlay
 * is how you get a step list whose `output.from` names a step that is no longer in it.
 *
 * Returns the SAME object when there is nothing to overlay, so the common single-fact
 * path allocates nothing and stays referentially stable for callers that memoise on
 * identity.
 */
export function mergeProductRuleStructure(
  program: IncomeAssumptionConfig,
  catalogRule: IncomeAssumptionConfig,
): IncomeAssumptionConfig {
  if (!isProductRuleStrategy(catalogRule.strategy)) return program;
  if (!isProductRuleStrategy(program.strategy)) return program;

  return {
    ...program,
    ...(catalogRule.steps !== undefined ? { steps: catalogRule.steps } : {}),
    ...(catalogRule.gates !== undefined ? { gates: catalogRule.gates } : {}),
    ...(catalogRule.output !== undefined ? { output: catalogRule.output } : {}),
    // Structure, so it overlays with the rest of it. A bank row never carries its own copy
    // to go stale — `stripCatalogStructure` takes it off on the way in, exactly as it does
    // the steps.
    ...(catalogRule.waysAre !== undefined ? { waysAre: catalogRule.waysAre } : {}),
  };
}

/**
 * A FIGURES-ONLY write to a catalog name's own rule keeps the structure already stored.
 *
 * The catalog screen renders a pipeline read-only — it cannot author a step, and it
 * deliberately does not post `steps`/`gates`/`output` back, because re-posting a copy it
 * merely rendered would let a stale screen replace the product. Validation, though, holds a
 * `steps` rule to having steps, so that screen's Save answered
 * `PRODUCT_RULE_INVALID / no_steps` every time and the catalog's default figures could not
 * be edited at all.
 *
 * `mergeProductRuleStructure` is the overlay; the rule THIS function adds is *when* to
 * apply it — only when the incoming rule states no steps of its own. That guard is
 * load-bearing in the other direction: the seed and the API DO send structure through the
 * same endpoint, and overlaying the stored copy unconditionally would make a product's
 * shape unchangeable.
 */
export function withStoredStructure(
  incoming: IncomeAssumptionConfig,
  stored: IncomeAssumptionConfig | null | undefined,
): IncomeAssumptionConfig {
  if (!isProductRuleStrategy(incoming.strategy)) return incoming;
  // "States no structure" means ALL THREE keys are absent, not just `steps`. The overlay
  // replaces steps, gates AND output together, so guarding on `steps` alone silently threw
  // away a write that revised the gates or the output while leaving the step list to the
  // stored copy — a 200 with the caller's change discarded. `steps: []` is a statement too
  // (an explicit clear), and must not be read as silence either.
  if (
    incoming.steps !== undefined ||
    incoming.gates !== undefined ||
    incoming.output !== undefined
  ) {
    return incoming;
  }
  if (!stored) return incoming;
  return carryStoredPolicy(mergeProductRuleStructure(incoming, stored), stored);
}

/**
 * The row's own POLICY fields, carried onto a figures-only write for the same reason its
 * structure is.
 *
 * `dbrCapPercentOverride`, `requiredDocuments` and `combinationRule` are part of the rule
 * blob and a pipeline screen posts only some of them. Dropped, they are gone for good and
 * nothing says so; the only reason that has not bitten yet is that the save used to fail
 * before it could.
 *
 * PER KEY, not all-or-nothing. It used to carry the whole set only when the write mentioned
 * none of it, which held for exactly as long as no screen edited any of them — and the
 * product screen now posts the debt-burden cap on every save. All-or-nothing, that one field
 * would silently drop a stored `requiredDocuments` and `combinationRule` on a save about
 * something else.
 *
 *   undefined   the write says nothing about this field → keep what is stored
 *   null        the write CLEARS it → keep the null, which `dropClearedPolicy` turns into
 *               an absent key before validation
 *   a value     the write states it → keep the write's
 */
function carryStoredPolicy(
  incoming: IncomeAssumptionConfig,
  stored: IncomeAssumptionConfig,
): IncomeAssumptionConfig {
  const carried: IncomeAssumptionConfig = { ...incoming };
  let touched = false;
  for (const key of POLICY_KEYS) {
    if (incoming[key] !== undefined) continue;
    const value = stored[key];
    if (value === undefined) continue;
    Object.assign(carried, { [key]: value });
    touched = true;
  }
  return touched ? carried : incoming;
}

/**
 * A policy field the write CLEARED, removed rather than stored as `null`.
 *
 * `null` is the only way a client can say "there is no longer a cap here": an absent key
 * means "not touching it" (see `carryStoredPolicy`), so the two spellings cannot be merged.
 * It must not survive this far, though — `validateDbrOverride` refuses a `null` as an
 * out-of-range percentage, so clearing the field answered
 * `INCOME_RULE_DBR_OVERRIDE_INVALID` on a request that stated no percentage at all.
 *
 * The DTO types these as optional strings and `@IsOptional()` skips validation for `null` as
 * well as `undefined`, which is how a `null` gets in here in the first place.
 */
export function dropClearedPolicy(config: IncomeAssumptionConfig): IncomeAssumptionConfig {
  const cleared = POLICY_KEYS.filter((key) => {
    const value = config[key];
    return value === null || (typeof value === 'string' && value.trim() === '');
  });
  if (cleared.length === 0) return config;
  const stripped: IncomeAssumptionConfig = { ...config };
  for (const key of cleared) delete stripped[key];
  return stripped;
}

/**
 * A rule's figures, narrowed to the ONE way the program sells.
 *
 * DROPPED: every other way's head, its columns and its pick. KEPT, deliberately: `cond__*`
 * and `cond__*__bound`, `share` / `share_on`, `uplift` / `uplift_on`, the I-Score slots,
 * `src__*` and `basis*` — none of them belongs to a way, and a bank's conditions do not
 * change because it derives the figure a different way.
 *
 * A product with fewer than two ways — every single-way product, and a `'combined'` product
 * whose terms fold into one — has nothing to strip and returns the SAME object.
 *
 * Two arguments, because a bank row carries no steps of its own: `config` is the figures,
 * `effective` is that object under the catalog's structure — the only place the ways are
 * named. They are the same object on the inheritance path, where the merge has already run.
 *
 * NOT applied on the way IN. A save carrying figures under a way the program does not sell is
 * REFUSED by name (`PROGRAM_INCOME_WAY_CONFLICT`) rather than quietly narrowed: the two cannot
 * both happen, because the persist chain produces the very object the validator is handed, and
 * given the choice a refusal that names the boxes beats a strip that destroys figures a bank
 * typed and says nothing. The screen deletes them on a confirmation that names them; the
 * server refuses whatever is left. Estimate markers follow the figures either way —
 * `pruneValueSources` walks the persisted `stepParams` by key, so a marker on a slot the save
 * does not carry stops being a markable path in the same write.
 */
export function stripUnchosenWays(
  config: IncomeAssumptionConfig,
  effective: IncomeAssumptionConfig,
): IncomeAssumptionConfig {
  const rule = effective as ProductRule;
  if (waysOfRule(rule).length < 2) return config;
  const chosen = config.wayId;
  if (chosen === undefined || chosen === '') return config;

  const params = config.stepParams;
  if (params === undefined) return config;
  const owned = wayOwnedSlots(rule, chosen);
  const anyWay = allWaySlots(rule);
  const kept = Object.entries(params).filter(([slot]) => owned.has(slot) || !anyWay.has(slot));
  if (kept.length === Object.keys(params).length) return config;
  return { ...config, stepParams: Object.fromEntries(kept) };
}

/**
 * The rule to STORE on a bank program: its own object with the catalog's STRUCTURE
 * removed.
 *
 * The wizard sends back the merged object it was rendering — right for the screen, wrong
 * to keep. Storing the steps would make the link a one-time copy: the program would go
 * on running yesterday's pipeline after the catalog changed the product, and the two
 * would drift with nothing to reveal it. Figures are untouched — they ARE the bank's.
 */
export function stripCatalogStructure(config: IncomeAssumptionConfig): IncomeAssumptionConfig {
  if (!isProductRuleStrategy(config.strategy)) return config;
  if (
    config.steps === undefined &&
    config.gates === undefined &&
    config.output === undefined &&
    config.waysAre === undefined
  ) {
    return config;
  }
  const stripped: IncomeAssumptionConfig = { ...config };
  delete stripped.steps;
  delete stripped.gates;
  delete stripped.output;
  // Structure too: whether the ways are alternatives is a statement about the PRODUCT. A
  // stored copy on a bank row would be a second authority, free to go on demanding a choice
  // after the catalog stopped asking for one. `wayId` stays — it is the bank's answer.
  delete stripped.waysAre;
  return stripped;
}
