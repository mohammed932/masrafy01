/**
 * The ONE place a seeder writes `ScoringWeightSet` rows (Constitution V, v14.0.0).
 *
 * WHICH questions a program scores on is the CATALOG's answer, not a seeder's:
 * `platform_enumeration_question` holds the (program name, loan category) set, and
 * `ScoringService.assertWithinCatalogSet` rejects any save outside it. Two seeders
 * used to pick the set themselves — `seed-questionnaire` assigned every question
 * the program's CATEGORY asks (20–24 of them), `seed-scoring-weights` a
 * hand-authored list keyed by question codes that have since left the pool — so a
 * freshly seeded program opened in the scoring editor showed weights on questions
 * the catalog does not list and could not be re-saved at all. Both now call
 * `writeProgramWeightSets`, which reads the catalog.
 *
 * HOW MUCH each question is worth stays per program: the archetype says WHICH,
 * each bank says HOW MUCH. Weights are tilted deterministically off the program
 * code so two banks offering the same catalog name do not score every applicant
 * identically (which renders as duplicate result cards), and the same program
 * always reseeds to the same numbers.
 *
 * Everything here is DEV/DEMO scaffolding — the product path is the admin
 * dashboard's weights editor (`ScoringService.saveWeights`). What this module
 * writes is shaped to pass that endpoint's validation exactly: catalog-scoped
 * keys, weights summing to 100, every weighted question carrying the rule its
 * own type is scored by (option scores / aggregation / `[from, to)` bands /
 * presence score).
 */
import { Prisma, PrismaClient, ScoringWeightSetStatus, type QuestionType } from '@prisma/client';

import { OBLIGATION_ITEM_QUESTION_CODES } from '../src/matching/pipeline/money-field-bindings';

export type SeedCategory = 'personal' | 'mortgage' | 'car' | 'business';

/** The `createdBy` a seeder stamps when it has no staff session to attribute to. */
export const SEED_ACTOR = 'seed-system';

/**
 * The fixed system staff account created by the `lead_management_activity`
 * migration, which `seed-demo` passes in as the editor id.
 */
export const SYSTEM_STAFF_ID = 'clsysactor00000000000000000000';

/**
 * Every author that means "written by a seeder, safe to rewrite". Anything else in
 * `ScoringWeightSet.createdBy` is a real staff id from an admin's dashboard save.
 */
export const SEED_AUTHORS: ReadonlySet<string> = new Set([SEED_ACTOR, SYSTEM_STAFF_ID]);

/**
 * Neutral score (0–100) for an answer to a non-financial / content question
 * (loan purpose, governorate, vehicle condition…). Flat → the question
 * contributes a constant, never unfairly ranking one applicant over another, but
 * it is never 0 so no answer reads as "worthless".
 */
export const NEUTRAL_SCORE = 50;

/** Per-program multipliers applied to the seed `points` so programs rank differently. */
const PROGRAM_POINT_MULTIPLIERS = [1.0, 0.85, 1.15, 0.95] as const;

/**
 * How far a program's question weights may drift from an even split, as a
 * fraction. 0.45 keeps every weight positive and meaningful (an even split over
 * 13 questions is ~7.7, so the band is ~4–11) while making two banks under the
 * same catalog name rank the same applicant differently.
 */
const WEIGHT_TILT = 0.45;

/** NUMERIC content bounds, as authored by the questionnaire seed. */
export interface SeedNumericRules {
  minValue: string;
  maxValue: string;
  step?: string;
  unitEn: string;
  unitAr: string;
}

/**
 * Which direction a seeded NUMERIC question's bands run. Demo judgement only —
 * a bank sets its own bands in the scoring editor, and nothing in the engine
 * reads this map (Principle II: no per-bank branch in code). Keyed by question
 * code; anything absent defaults to "more is better".
 */
const SEED_BAND_DIRECTIONS: Record<string, 'higher_better' | 'lower_better'> = {
  monthly_income: 'higher_better',
  current_installments: 'lower_better',
  amount_requested: 'lower_better',
  repayment_period_months: 'lower_better',
};

/** The three band scores, worst → best, before the per-program multiplier. */
const SEED_BAND_SCORES = [25, 60, 100] as const;

export interface SeedNumericBand {
  from: string | null;
  to: string | null;
  score: number;
}

/**
 * Three gapless, half-open `[from, to)` bands for a NUMERIC question, split at
 * the thirds of its own published range. The first opens at −∞ and the last
 * closes at +∞, as `assertNumericBands` requires, so a value outside the
 * question's bounds still scores instead of falling through a hole.
 *
 * Without bounds to split there is nothing to band on, so the question gets one
 * flat band — it then contributes a constant rather than silently earning 0.
 */
export function seedNumericBands(
  questionCode: string,
  numeric: SeedNumericRules | undefined,
  multiplier: number,
): SeedNumericBand[] {
  const scale = (score: number): number =>
    Math.min(100, Math.max(1, Math.round(score * multiplier)));
  const min = numeric?.minValue != null ? Number(numeric.minValue) : null;
  const max = numeric?.maxValue != null ? Number(numeric.maxValue) : null;
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [{ from: null, to: null, score: scale(NEUTRAL_SCORE) }];
  }
  const third = (max - min) / 3;
  const lowerEdge = Math.round(min + third);
  const upperEdge = Math.round(min + third * 2);
  const [worst, mid, best] =
    SEED_BAND_DIRECTIONS[questionCode] === 'lower_better'
      ? [...SEED_BAND_SCORES].reverse()
      : SEED_BAND_SCORES;
  return [
    { from: null, to: String(lowerEdge), score: scale(worst!) },
    { from: String(lowerEdge), to: String(upperEdge), score: scale(mid!) },
    { from: String(upperEdge), to: null, score: scale(best!) },
  ];
}

/** What the questionnaire seed knows about the pool, as the weight writer needs it. */
export interface SeedPoolFacts {
  /** Pool display order — the order the editor lists a program's questions in. */
  questionOrder: readonly string[];
  questionByCode: ReadonlyMap<string, { type: QuestionType; numeric?: SeedNumericRules }>;
  /** questionCode → optionCode → 0..100 desirability, before the program multiplier. */
  pointsByAnswer: Readonly<Record<string, Record<string, number>>>;
  /** questionCode → the categories that ASK it. */
  categoriesByQuestion: Readonly<Record<string, ReadonlySet<SeedCategory>>>;
}

export interface ProgramWeights {
  questionWeights: Record<string, number>;
  answerScores: Record<string, Record<string, number>>;
  multiSelectRules: Record<string, { aggregation: 'AVERAGE' }>;
  numericBands: Record<string, SeedNumericBand[]>;
  textRules: Record<string, { answeredScore: number }>;
}

export interface WriteWeightSetsOptions {
  /** Stamped on rows this run writes. Defaults to `SEED_ACTOR`. */
  editorId?: string;
  /**
   * Rewrite ACTIVE sets an ADMIN saved too, archiving each into history first.
   * Off by default: re-running a seed must not silently discard a banking
   * expert's tuning (A33). On, for a deliberate "reseed every program" pass.
   */
  force?: boolean;
}

export interface WriteWeightSetsResult {
  written: number;
  /** Programs skipped because the catalog has no set to score on. */
  noCatalogSet: string[];
  /** Admin-tuned ACTIVE sets left alone (only when `force` is off). */
  keptTuned: string[];
  /** Catalog picks dropped as unscoreable, as `PROGRAM: code (reason)`. */
  droppedPicks: string[];
}

/**
 * The catalog's question set per (`program_name` key, loan category), as question
 * codes. Only ACTIVE questions — a pick whose question left the pool is a row the
 * admin board flags, not something a weight set may carry.
 */
export async function loadCatalogQuestionSets(
  prisma: PrismaClient,
): Promise<Map<string, string[]>> {
  const rows = await prisma.platformEnumerationQuestion.findMany({
    where: { enumeration: { type: 'program_name' }, question: { isActive: true } },
    select: {
      category: true,
      enumeration: { select: { key: true } },
      question: { select: { code: true } },
    },
  });
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const key = catalogKey(row.enumeration.key, row.category);
    out.set(key, [...(out.get(key) ?? []), row.question.code]);
  }
  return out;
}

export function catalogKey(programNameKey: string, category: string): string {
  return `${programNameKey}/${category.toLowerCase()}`;
}

/**
 * Write one ACTIVE weight set per bank program, scoped to the catalog set of the
 * program's (`programNameKey`, `productCategory`) pair.
 *
 * A program with no catalog set scores NOTHING — no `programNameKey`, an unknown
 * one, or a category the name has no template for. That is not a gap to paper
 * over with a default: `assertWithinCatalogSet` rejects every weighted question
 * in exactly that state, so inventing a set here would seed rows the admin screen
 * cannot re-save. The program is reported and left with no ACTIVE set, which the
 * engine renders as "Not rated" rather than as a bad fit (v13.0.0).
 */
export async function writeProgramWeightSets(
  prisma: PrismaClient,
  facts: SeedPoolFacts,
  options: WriteWeightSetsOptions = {},
): Promise<WriteWeightSetsResult> {
  const editorId = options.editorId ?? SEED_ACTOR;
  const catalogSets = await loadCatalogQuestionSets(prisma);
  const programs = await prisma.bankProgram.findMany({
    select: { id: true, programCode: true, productCategory: true, programNameKey: true },
    orderBy: { programCode: 'asc' },
  });

  const result: WriteWeightSetsResult = {
    written: 0,
    noCatalogSet: [],
    keptTuned: [],
    droppedPicks: [],
  };

  for (const program of programs) {
    const category = program.productCategory.toLowerCase() as SeedCategory;
    const catalogCodes = program.programNameKey
      ? catalogSets.get(catalogKey(program.programNameKey, category))
      : undefined;
    if (!catalogCodes || catalogCodes.length === 0) {
      result.noCatalogSet.push(`${program.programCode} (${program.programNameKey ?? 'no name'}/${category})`);
      continue;
    }

    const assigned = assignableCodes(catalogCodes, category, facts, (code, reason) =>
      result.droppedPicks.push(`${program.programCode}: ${code} (${reason})`),
    );
    if (assigned.length === 0) {
      result.noCatalogSet.push(`${program.programCode} (nothing scoreable in the catalog set)`);
      continue;
    }

    const weights = buildWeights(
      program.programCode,
      assigned,
      facts,
    ) as unknown as Prisma.InputJsonObject;

    const existingActive = await prisma.scoringWeightSet.findFirst({
      where: { bankProgramId: program.id, status: ScoringWeightSetStatus.ACTIVE },
      select: { id: true, createdBy: true, versionNumber: true },
    });

    if (existingActive && SEED_AUTHORS.has(existingActive.createdBy)) {
      // Seed-authored fixture: rewritten in place, so re-running a seed does not
      // pile up versions nobody edited.
      await prisma.scoringWeightSet.update({
        where: { id: existingActive.id },
        data: { weights, createdBy: editorId, approvedBy: editorId, approvedAt: new Date() },
      });
      result.written += 1;
      continue;
    }

    if (existingActive && !options.force) {
      result.keptTuned.push(`${program.programCode} (v${existingActive.versionNumber})`);
      continue;
    }

    // New version, and the admin's set archived rather than overwritten — an
    // ACTIVE set is never mutated in place once a human authored it (A33), so
    // their tuning stays readable in the weights history.
    const last = await prisma.scoringWeightSet.findFirst({
      where: { bankProgramId: program.id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.scoringWeightSet.updateMany({
        where: { bankProgramId: program.id, status: ScoringWeightSetStatus.ACTIVE },
        data: { status: ScoringWeightSetStatus.ARCHIVED },
      });
      await tx.scoringWeightSet.create({
        data: {
          bankProgramId: program.id,
          status: ScoringWeightSetStatus.ACTIVE,
          versionNumber: (last?.versionNumber ?? 0) + 1,
          weights,
          createdBy: editorId,
          approvedBy: editorId,
          approvedAt: new Date(),
        },
      });
    });
    result.written += 1;
  }

  return result;
}

/**
 * The catalog picks this seeder can actually score, in pool display order.
 *
 * Three drops, each of which would otherwise cost the program weight it can never
 * earn back (the weight stays in the asked denominator — Constitution V v13.0.0):
 * a question that has left the pool, one the category does not ask, and a choice
 * question the questionnaire seed authored no option points for
 * (`WEIGHTS_MISSING_RULE`). The itemised per-debt amounts are dropped for a
 * different reason: debt burden is only meaningful as the `current_installments`
 * TOTAL, and banding each debt separately scores the same burden twice.
 */
function assignableCodes(
  catalogCodes: readonly string[],
  category: SeedCategory,
  facts: SeedPoolFacts,
  onDrop: (code: string, reason: string) => void,
): string[] {
  const picked = new Set(catalogCodes);
  const out: string[] = [];
  for (const code of facts.questionOrder) {
    if (!picked.has(code)) continue;
    if (OBLIGATION_ITEM_QUESTION_CODES.includes(code as never)) {
      onDrop(code, 'itemised debt amount — scored as the total');
      continue;
    }
    if (!facts.categoriesByQuestion[code]?.has(category)) {
      onDrop(code, `not asked under ${category}`);
      continue;
    }
    const type = facts.questionByCode.get(code)?.type ?? 'SINGLE_SELECT';
    if (
      (type === 'SINGLE_SELECT' || type === 'MULTI_SELECT') &&
      Object.keys(facts.pointsByAnswer[code] ?? {}).length === 0
    ) {
      onDrop(code, 'no seeded option scores');
      continue;
    }
    out.push(code);
  }
  // A catalog pick the pool no longer carries at all.
  for (const code of catalogCodes) {
    if (!facts.questionByCode.has(code)) onDrop(code, 'not in the seeded pool');
  }
  return out;
}

/** Weights (sum exactly 100) + the rule each assigned question's TYPE is scored by. */
function buildWeights(
  programCode: string,
  assigned: readonly string[],
  facts: SeedPoolFacts,
): ProgramWeights {
  const multiplier =
    PROGRAM_POINT_MULTIPLIERS[hash(programCode) % PROGRAM_POINT_MULTIPLIERS.length]!;
  // Floor at 1 so a low base × low multiplier never rounds down to 0.
  const scaled = (points: number): number =>
    Math.min(100, Math.max(1, Math.round(points * multiplier)));

  const weights: ProgramWeights = {
    questionWeights: tiltedWeights(programCode, assigned),
    answerScores: {},
    multiSelectRules: {},
    numericBands: {},
    textRules: {},
  };

  for (const code of assigned) {
    const question = facts.questionByCode.get(code);
    const type = question?.type ?? 'SINGLE_SELECT';
    if (type === 'SINGLE_SELECT' || type === 'MULTI_SELECT') {
      weights.answerScores[code] = {};
      for (const [optionCode, points] of Object.entries(facts.pointsByAnswer[code] ?? {})) {
        weights.answerScores[code][optionCode] = scaled(points);
      }
      // AVERAGE keeps a multi-pick answer inside 0..100 and treats one pick the
      // same way every other mode would; admins retune per question in the editor.
      if (type === 'MULTI_SELECT') weights.multiSelectRules[code] = { aggregation: 'AVERAGE' };
    } else if (type === 'NUMERIC') {
      weights.numericBands[code] = seedNumericBands(code, question?.numeric, multiplier);
    } else {
      weights.textRules[code] = { answeredScore: scaled(NEUTRAL_SCORE) };
    }
  }
  return weights;
}

/**
 * Integer weights summing to exactly 100, tilted per program so two banks under
 * the same catalog name do not produce identical scores for every applicant.
 *
 * Derived from a hash of `programCode:questionCode`, so it is stable across
 * reseeds (the same program always reseeds to the same numbers) without any
 * per-bank branch in code (Principle II) — and largest-remainder rounded, so the
 * total is exactly 100 rather than 99 or 101 (`WEIGHTS_QUESTION_WEIGHT_SUM_INVALID`).
 */
function tiltedWeights(programCode: string, assigned: readonly string[]): Record<string, number> {
  const n = assigned.length;
  const raw = assigned.map((code) => {
    // hash → 0..1 → a factor in [1 - WEIGHT_TILT, 1 + WEIGHT_TILT]
    const unit = (hash(`${programCode}:${code}`) % 1000) / 999;
    return (1 + (unit * 2 - 1) * WEIGHT_TILT) * (100 / n);
  });
  const total = raw.reduce((sum, w) => sum + w, 0);
  const scaled = raw.map((w) => (w / total) * 100);

  // Largest remainder: floor everything (min 1), then hand the leftover points to
  // the questions that lost the most to rounding.
  const floors = scaled.map((w) => Math.max(1, Math.floor(w)));
  let leftover = 100 - floors.reduce((sum, w) => sum + w, 0);
  const order = scaled
    .map((w, index) => ({ index, remainder: w - Math.floor(w) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; leftover > 0 && order.length > 0; i++, leftover--) {
    floors[order[i % order.length]!.index]! += 1;
  }
  // Over-100 only happens when the min-1 floor lifted several tiny weights; take
  // the excess back off the largest, which can always afford it.
  while (leftover < 0) {
    const largest = floors.reduce((best, w, i) => (w > floors[best]! ? i : best), 0);
    floors[largest]! -= 1;
    leftover += 1;
  }

  const out: Record<string, number> = {};
  assigned.forEach((code, index) => {
    out[code] = floors[index]!;
  });
  return out;
}

/** FNV-1a. Deterministic across runs and machines — `Math.random()` is not. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
