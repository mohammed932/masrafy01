/**
 * Every fact a no-payslip PRODUCT needs answered — and who reads each one.
 *
 * Pure module: no Nest, no Prisma, no clock (Constitution Principle V).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * The product screen used to report only what the product's own calculation reads
 * (`factsReadByIncomeRule`). The engine reads more than that for the same applicant:
 *
 *   · the product's PLAN tables (`planDefaults`) — the rate, the term, the share financed,
 *     the floor and the insurance rate every programme reading the product's plans prices by;
 *   · the product's CAP (a cap-only product has no calculation at all, only a table);
 *   · each selling programme's OWN tables, when a bank states its own;
 *   · the answers behind an engine-DERIVED key — a table keyed on the down-payment share
 *     needs the car's price and the deposit, and a grid-only key is skipped by every other
 *     reader precisely because no question sits behind it (`DERIVED_FACT_INPUTS`).
 *
 * This collects all of them, names the reader of each, and infers the SHAPE of the answer
 * from how it is read (option keys, or a number), which is what lets a missing question be
 * created without an operator typing its options.
 *
 * Structure only, never figures: a cell's value is irrelevant here, only its keys are read.
 */
import { DERIVED_FACT_INPUTS, TENOR_MONTHS_FACT_KEY } from './car-details';
import { factsReadByIncomeRule } from './fact-readers';

/** The six plan slots, as `plan-inherit.ts` names them. */
export const PLAN_TABLES = [
  'rateByFact',
  'minMonthsByFact',
  'maxMonthsByFact',
  'ltvCeilingByFact',
  'minAmountByFact',
  'carInsuranceRateByFact',
] as const;
export type PlanTable = (typeof PLAN_TABLES)[number];

/** A programme's own tables, keyed by where they live on the row. */
export type ProgramTable = PlanTable | 'maxLoanByFact' | 'maxVehicleAgeYearsByFact';

export type NeededReader =
  | { kind: 'calculation' }
  | { kind: 'plan'; table: PlanTable }
  | { kind: 'cap' }
  | { kind: 'program'; programCode: string; table: ProgramTable };

/**
 * What the answer looks like, as far as its readers say.
 *
 * `choice` carries every option key a reader keys a figure by — the union across readers,
 * in first-seen order. `number` is a banded or arithmetic read. `unknown` is a fact read
 * both ways (a table keyed by option AND a band elsewhere) or read by nothing that reveals
 * a shape — a question cannot be created for it without a person deciding.
 */
export type NeededShape =
  | { kind: 'choice'; optionKeys: string[] }
  | { kind: 'number' }
  | { kind: 'unknown' };

export interface NeededFact {
  factKey: string;
  readBy: NeededReader[];
  shape: NeededShape;
  /** Set when the fact is needed only because a derived key is read (e.g. the deposit share). */
  derivedFrom?: string;
}

export interface NeededFactsInput {
  incomeRule: unknown;
  planDefaults: unknown;
  /** The blueprint's cap shape, when the product sells as a cap. */
  cap?: {
    factKey: string;
    columnFactKey?: string;
    rowKeys?: readonly string[];
    columnKeys?: readonly string[];
    bands?: readonly unknown[];
  };
  /** Active programmes under the names selling the product — their OWN columns. */
  programs: ReadonlyArray<{
    programCode: string;
    loanLimits: unknown;
    pricing: unknown;
    tenor: unknown;
    fees: unknown;
  }>;
}

type Seen = { kind: 'choice'; keys: string[] } | { kind: 'number' };

class Collector {
  private readonly facts = new Map<
    string,
    { readBy: NeededReader[]; seen: Seen[]; derivedFrom?: string }
  >();

  add(factKey: string, reader: NeededReader, seen: Seen | null, derivedFrom?: string): void {
    // A derived key has no question behind it; what it needs is its inputs.
    const inputs = DERIVED_FACT_INPUTS[factKey];
    if (inputs !== undefined) {
      for (const input of inputs) this.add(input, reader, { kind: 'number' }, factKey);
      return;
    }
    if (factKey === TENOR_MONTHS_FACT_KEY) return;

    const entry = this.facts.get(factKey) ?? { readBy: [], seen: [] };
    if (!entry.readBy.some((r) => sameReader(r, reader))) entry.readBy.push(reader);
    if (seen !== null) entry.seen.push(seen);
    // A fact read directly as well as through a derived key is needed in its own right.
    if (derivedFrom === undefined) delete entry.derivedFrom;
    else if (!this.facts.has(factKey)) entry.derivedFrom = derivedFrom;
    this.facts.set(factKey, entry);
  }

  result(): NeededFact[] {
    return [...this.facts.entries()]
      .map(([factKey, entry]) => ({
        factKey,
        readBy: entry.readBy,
        shape: mergeShape(entry.seen),
        ...(entry.derivedFrom !== undefined ? { derivedFrom: entry.derivedFrom } : {}),
      }))
      .sort((a, b) => a.factKey.localeCompare(b.factKey));
  }
}

function sameReader(a: NeededReader, b: NeededReader): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeShape(seen: readonly Seen[]): NeededShape {
  if (seen.length === 0) return { kind: 'unknown' };
  const kinds = new Set(seen.map((s) => s.kind));
  if (kinds.size > 1) return { kind: 'unknown' };
  if (kinds.has('number')) return { kind: 'number' };
  const keys: string[] = [];
  for (const s of seen) {
    if (s.kind !== 'choice') continue;
    for (const key of s.keys) if (!keys.includes(key)) keys.push(key);
  }
  // A keyed read with no keys typed yet says "choice" but not which options.
  return keys.length === 0 ? { kind: 'unknown' } : { kind: 'choice', optionKeys: keys };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One fact-keyed grid: every axis, with the shape its cells reveal. */
function readGrid(grid: unknown, reader: NeededReader, out: Collector): void {
  if (!isRecord(grid) || !Array.isArray(grid.axes)) return;
  const cells = Array.isArray(grid.cells) ? grid.cells : [];
  grid.axes.forEach((axis, index) => {
    if (!isRecord(axis) || typeof axis.factKey !== 'string' || axis.factKey === '') return;
    // A class-keyed axis keys on the CLASS an answer is filed under, not the answer's own
    // options, so its cell keys are not the question's options.
    const byClass = axis.via === 'parentClass';
    const keys: string[] = [];
    let banded = false;
    for (const cell of cells) {
      if (!isRecord(cell) || !Array.isArray(cell.keys)) continue;
      const key: unknown = cell.keys[index];
      if (!isRecord(key)) continue;
      if (typeof key.key === 'string') {
        if (!keys.includes(key.key)) keys.push(key.key);
      } else if ('fromInclusive' in key || 'toExclusive' in key) {
        banded = true;
      }
    }
    const seen: Seen | null = banded
      ? { kind: 'number' }
      : keys.length > 0
        ? { kind: 'choice', keys: byClass ? [] : keys }
        : null;
    out.add(axis.factKey, reader, seen);
  });
}

/** `maxLoanByFact`: a row fact and an optional column fact. */
function readMaxLoanTable(table: unknown, reader: NeededReader, out: Collector): void {
  if (!isRecord(table) || typeof table.factKey !== 'string' || table.factKey === '') return;
  const rows = Array.isArray(table.rows) ? table.rows.filter(isRecord) : [];
  const rowKeys = rows.map((r) => r.rowKey).filter((k): k is string => typeof k === 'string');
  const banded = rows.some((r) => 'fromInclusive' in r);
  out.add(
    table.factKey,
    reader,
    banded
      ? { kind: 'number' }
      : rowKeys.length > 0 && table.rowVia !== 'parentClass'
        ? { kind: 'choice', keys: [...new Set(rowKeys)] }
        : null,
  );
  if (typeof table.columnFactKey === 'string' && table.columnFactKey !== '') {
    const columnKeys = rows
      .map((r) => r.columnKey)
      .filter((k): k is string => typeof k === 'string');
    out.add(
      table.columnFactKey,
      reader,
      columnKeys.length > 0 && table.columnVia !== 'parentClass'
        ? { kind: 'choice', keys: [...new Set(columnKeys)] }
        : null,
    );
  }
}

/** The calculation: which facts it reads, and the shape each op implies. */
function readCalculation(rule: unknown, out: Collector): void {
  const reader: NeededReader = { kind: 'calculation' };
  const shapes = new Map<string, Seen>();
  if (isRecord(rule)) {
    for (const step of Array.isArray(rule.steps) ? rule.steps : []) {
      if (!isRecord(step) || typeof step.fact !== 'string') continue;
      const op = step.op;
      if (op === 'factParentTable') {
        // Keyed by the CLASS an answer is filed under — a choice, but not by these keys.
        shapes.set(step.fact, { kind: 'choice', keys: [] });
      } else if (op === 'factChoiceTable' || op === 'pickByFact') {
        const branches = Array.isArray(step.branches)
          ? step.branches.filter((b): b is string => typeof b === 'string')
          : [];
        shapes.set(step.fact, { kind: 'choice', keys: branches });
      } else if (op === 'factNumber' || op === 'bandTable') {
        shapes.set(step.fact, { kind: 'number' });
      }
    }
    for (const gate of Array.isArray(rule.gates) ? rule.gates : []) {
      if (!isRecord(gate)) continue;
      if (gate.kind === 'choice' && typeof gate.fact === 'string') {
        const expect = Array.isArray(gate.expect)
          ? gate.expect.filter((e): e is string => typeof e === 'string')
          : [];
        shapes.set(gate.fact, { kind: 'choice', keys: expect });
      }
    }
  }
  for (const factKey of factsReadByIncomeRule(rule)) {
    out.add(factKey, reader, shapes.get(factKey) ?? { kind: 'number' });
  }
}

export function neededFactsOf(input: NeededFactsInput): NeededFact[] {
  const out = new Collector();

  readCalculation(input.incomeRule, out);

  if (isRecord(input.planDefaults)) {
    for (const table of PLAN_TABLES) {
      readGrid(input.planDefaults[table], { kind: 'plan', table }, out);
    }
  }

  if (input.cap !== undefined) {
    const cap = input.cap;
    out.add(
      cap.factKey,
      { kind: 'cap' },
      cap.bands !== undefined && cap.bands.length > 0
        ? { kind: 'number' }
        : cap.rowKeys !== undefined && cap.rowKeys.length > 0
          ? { kind: 'choice', keys: [...cap.rowKeys] }
          : null,
    );
    if (cap.columnFactKey !== undefined) {
      out.add(
        cap.columnFactKey,
        { kind: 'cap' },
        cap.columnKeys !== undefined && cap.columnKeys.length > 0
          ? { kind: 'choice', keys: [...cap.columnKeys] }
          : null,
      );
    }
  }

  for (const program of input.programs) {
    const at = (table: ProgramTable): NeededReader => ({
      kind: 'program',
      programCode: program.programCode,
      table,
    });
    if (isRecord(program.pricing)) readGrid(program.pricing.rateByFact, at('rateByFact'), out);
    if (isRecord(program.tenor)) {
      readGrid(program.tenor.maxMonthsByFact, at('maxMonthsByFact'), out);
      readGrid(program.tenor.minMonthsByFact, at('minMonthsByFact'), out);
      readGrid(program.tenor.maxVehicleAgeYearsByFact, at('maxVehicleAgeYearsByFact'), out);
    }
    if (isRecord(program.loanLimits)) {
      readMaxLoanTable(program.loanLimits.maxLoanByFact, at('maxLoanByFact'), out);
      readGrid(program.loanLimits.ltvCeilingByFact, at('ltvCeilingByFact'), out);
      readGrid(program.loanLimits.minAmountByFact, at('minAmountByFact'), out);
    }
    if (isRecord(program.fees)) {
      readGrid(program.fees.carInsuranceRateByFact, at('carInsuranceRateByFact'), out);
    }
  }

  return out.result();
}
