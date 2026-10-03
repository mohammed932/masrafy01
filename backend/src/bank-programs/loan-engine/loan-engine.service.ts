/**
 * Feature 013 — the Loan Engine: one question's effects, per bank program.
 *
 * WHAT THIS IS NOT. It is not a second copy of the program form. A read shows the column the
 * engine reads (`fact-readers.ts` names them, research R5); a write rebuilds that one field
 * and saves the WHOLE program through `BankProgramsService.update()`, so the version
 * compare-and-swap, every table validator (`validateFactGrid`, `validateMaxLoanByFact`, the
 * additional-income check) and the `BANK_PROGRAM_UPDATED` audit are the ones the form uses.
 *
 * Rules are PER PROGRAM (operator decision, 2026-10-04; Principle II): nothing here states a
 * figure for more than one bank, and a table owned somewhere else — inherited from a
 * product's plans, keyed on another fact, or on more than one — is shown read-only rather
 * than overwritten from a question's point of view.
 */
import { Injectable } from '@nestjs/common';
import { ALL_LOAN_CATEGORIES } from '@/common/loan-category.util';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  BankProgramNotFoundException,
  DomainException,
  LoanEngineRuleInvalidException,
  type LoanEngineRuleProblem,
} from '@/common/errors/domain.exceptions';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventRepository } from '@/audit/audit-event.repository';
import { isReservedFactKey } from '@/matching/pipeline/fact-question-eligibility';
import { asProgramConditions, type ProgramCondition } from '@/matching/pipeline/program-conditions';
import { questionLockReason } from '@/questionnaire/validation/question-scope';
import {
  criterionToKey,
  CriterionError,
  keyToCriterion,
  type Criterion,
} from '@/matching/pipeline/criterion';
import type { FactGridBand, FactGridConfig, FactGridKey } from '@/matching/pipeline/fact-grid';
import { inheritsProductPlans } from '@/matching/pipeline/plan-inherit';
import type { MaxLoanByFactConfig, MaxLoanByFactRow } from '@/matching/pipeline/max-loan-by-fact';
import type { AdditionalIncomeConfig } from '@/matching/pipeline/additional-income';
import {
  PostgresPlatformEnumerationsRepository,
  type QuestionUsageInputs,
} from '@/platform-enumerations/postgres-platform-enumerations.repository';
import { BankProgramsService } from '../bank-programs.service';
import type { UpdateBankProgramDto } from '../dto/update-bank-program.dto';
import type { BankProgramResponseDto } from '../dto/bank-program.response.dto';
import {
  LOAN_ENGINE_EFFECTS,
  type EffectRow,
  type EffectRowDto,
  type EffectState,
  type LoanEngineEffect,
  type LoanEngineProgramSlice,
  type LoanEngineQuestionDetail,
  type LoanEngineQuestionSummary,
  type LoanEngineWriteResult,
  type LoanEngineConditionsResult,
  type PutEffectRowsDto,
  type PutProgramConditionsDto,
  type ProgramConditionDto,
} from './dto/loan-engine.dto';
import { LoanEngineRepository, type LoanEngineProgramRow } from './loan-engine.repository';

type Column = 'pricing' | 'loanLimits' | 'tenor' | 'incomeAssumption';

/** Where each effect lives on `bank_program` — the columns `factSurfacesOfProgram` reads. */
const EFFECT_SLOTS: Record<
  LoanEngineEffect,
  { column: Column; field: string; kind: 'grid' | 'cap' | 'sources'; planSlot: boolean }
> = {
  rate: { column: 'pricing', field: 'rateByFact', kind: 'grid', planSlot: true },
  cap: { column: 'loanLimits', field: 'maxLoanByFact', kind: 'cap', planSlot: false },
  financed_share: { column: 'loanLimits', field: 'ltvCeilingByFact', kind: 'grid', planSlot: true },
  min_amount: { column: 'loanLimits', field: 'minAmountByFact', kind: 'grid', planSlot: true },
  min_term: { column: 'tenor', field: 'minMonthsByFact', kind: 'grid', planSlot: true },
  max_term: { column: 'tenor', field: 'maxMonthsByFact', kind: 'grid', planSlot: true },
  extra_income: {
    column: 'incomeAssumption',
    field: 'additionalIncome',
    kind: 'sources',
    planSlot: false,
  },
};

/** One unsaved draft for the admin simulator — the body its write would take. */
export interface LoanEngineOverride {
  programCode: string;
  target: LoanEngineEffect | 'conditions';
  questionCode?: string;
  rows?: PutEffectRowsDto['rows'];
  onNoMatch?: PutEffectRowsDto['onNoMatch'];
  conditions?: ProgramConditionDto[];
}

/** The columns an override may patch on a program row, as the preview reads it. */
export interface LoanEngineRowLike {
  programCode: string;
}

export interface LoanEngineActor {
  id: string;
  sourceIp: string | null;
}

type UsageQuestion = QuestionUsageInputs['questions'][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

@Injectable()
export class LoanEngineService {
  constructor(
    private readonly repo: LoanEngineRepository,
    private readonly enums: PostgresPlatformEnumerationsRepository,
    private readonly programs: BankProgramsService,
    private readonly audit: AuditEventRepository,
  ) {}

  // ---- reads ----------------------------------------------------------------------------

  async listQuestions(category?: string, search?: string): Promise<LoanEngineQuestionSummary[]> {
    if (category !== undefined && !(ALL_LOAN_CATEGORIES as readonly string[]).includes(category)) {
      // Never a silent fallback to every category (A33's loud-failure rule).
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, { field: 'category' });
    }
    const inputs = await this.enums.questionUsageInputs();
    const needle = search?.trim().toLowerCase() ?? '';
    return inputs.questions
      .filter((q) => category === undefined || q.categories.includes(category as never))
      .filter(
        (q) =>
          needle === '' ||
          q.code.includes(needle) ||
          q.labelEn.toLowerCase().includes(needle) ||
          q.labelAr.includes(needle),
      )
      .map((q) => {
        const factKey = this.factKeyOf(q.code, inputs);
        return {
          questionCode: q.code,
          type: q.type,
          labelAr: q.labelAr,
          labelEn: q.labelEn,
          categories: [...q.categories],
          factKey,
          readingProgramCount:
            factKey === null
              ? 0
              : inputs.programs.filter(
                  (p) => p.surfaces.has(factKey) && q.categories.includes(p.category as never),
                ).length,
        };
      });
  }

  async questionDetail(questionCode: string): Promise<LoanEngineQuestionDetail> {
    const inputs = await this.enums.questionUsageInputs();
    const question = this.questionOf(questionCode, inputs);
    const factKey = this.factKeyOf(question.code, inputs);
    const [options, rows] = await Promise.all([
      this.repo.questionOptions(question.code),
      this.repo.activePrograms(question.categories),
    ]);
    return {
      questionCode: question.code,
      type: question.type,
      labelAr: question.labelAr,
      labelEn: question.labelEn,
      categories: [...question.categories],
      factKey,
      options,
      programs: rows.map((row) => this.sliceOf(row, question, factKey, inputs)),
    };
  }

  // ---- write ----------------------------------------------------------------------------

  async putEffect(
    questionCode: string,
    programCode: string,
    effect: LoanEngineEffect,
    dto: PutEffectRowsDto,
    actor: LoanEngineActor,
  ): Promise<LoanEngineWriteResult> {
    const inputs = await this.enums.questionUsageInputs();
    const built = await this.buildEffect(inputs, questionCode, programCode, effect, dto);
    if (built.program.version !== dto.expectedVersion) {
      // `update()` would refuse it too; saying so before any work names the version read.
      throw new DomainException(ERROR_CODES.CONFLICT_STALE_DATA, {
        submittedVersion: dto.expectedVersion,
        currentVersion: built.program.version,
      });
    }
    if (built.changed) {
      await this.programs.update(programCode, updateDtoOf(built.program, built.patch), actor);
    }
    const fresh = await this.repo.programByCode(programCode);
    if (fresh === null) throw new BankProgramNotFoundException({ programCode });
    return {
      changed: built.changed,
      program: this.sliceOf(fresh, built.question, built.factKey, inputs),
    };
  }

  /**
   * Replace a program's eligibility conditions (feature 013, FR-006/7/8).
   *
   * Each criterion names a QUESTION; the service resolves its bound fact, so the client never
   * sends a fact key. A criterion on an engine input — money, debts, employment, I-Score, the
   * platform's car figures — is refused (A33): those shape the amount, and a salary / age /
   * DBR / amount gate is exactly what Principle V keeps out.
   */
  async putConditions(
    programCode: string,
    dto: PutProgramConditionsDto,
    actor: LoanEngineActor,
  ): Promise<LoanEngineConditionsResult> {
    const inputs = await this.enums.questionUsageInputs();
    const before = await this.repo.programByCode(programCode);
    if (before === null) throw new BankProgramNotFoundException({ programCode });
    if (before.version !== dto.expectedVersion) {
      throw new DomainException(ERROR_CODES.CONFLICT_STALE_DATA, {
        submittedVersion: dto.expectedVersion,
        currentVersion: before.version,
      });
    }
    const { conditions, required } = this.buildConditions(before, dto.conditions, inputs);
    const changed =
      JSON.stringify(asProgramConditions(before.conditions)) !== JSON.stringify(conditions);
    if (changed) {
      const written = await this.repo.writeConditions({
        programCode,
        expectedVersion: dto.expectedVersion,
        conditions,
        updatedBy: actor.id,
      });
      if (written === null) {
        const fresh = await this.repo.programByCode(programCode);
        throw new DomainException(ERROR_CODES.CONFLICT_STALE_DATA, {
          submittedVersion: dto.expectedVersion,
          currentVersion: fresh?.version ?? -1,
        });
      }
      await this.audit.create({
        actorId: actor.id,
        targetId: null,
        bankProgramId: written.id,
        eventType: AuditEventType.BANK_PROGRAM_UPDATED,
        sourceIp: actor.sourceIp,
        payload: {
          programCode,
          diff: { conditions: { before: before.conditions ?? null, after: conditions } },
        },
      });
    }
    const fresh = await this.repo.programByCode(programCode);
    if (fresh === null) throw new BankProgramNotFoundException({ programCode });
    return {
      changed,
      // No question in view: the effects come back empty, the conditions whole.
      program: this.sliceOf(fresh, null, null, inputs),
      requiredQuestionCodes: [...required].sort(),
      requiredUnderProgramName: fresh.programNameKey,
    };
  }

  // ---- try an answer (US3) --------------------------------------------------------------

  /**
   * The admin simulator's UNSAVED drafts, as a per-program row patch (feature 013, R7).
   *
   * Each draft is built and checked EXACTLY as its write would be — the same `buildEffect` /
   * `buildConditions`, and for an effect the program save's own validators
   * (`BankProgramsService.validateDraft`) — so the simulator can never price a table the
   * save would refuse. Nothing is written: the patch is applied to the in-memory rows of one
   * preview and dropped.
   */
  async overridesTransform(
    overrides: readonly LoanEngineOverride[],
  ): Promise<<T extends LoanEngineRowLike>(row: T) => T> {
    if (overrides.length === 0) return (row) => row;
    const inputs = await this.enums.questionUsageInputs();
    const patches = new Map<string, Record<string, unknown>>();
    for (const override of overrides) {
      const patch = patches.get(override.programCode) ?? {};
      if (override.target === 'conditions') {
        const raw = await this.repo.programByCode(override.programCode);
        if (raw === null)
          throw new BankProgramNotFoundException({ programCode: override.programCode });
        patch.conditions = this.buildConditions(raw, override.conditions ?? [], inputs).conditions;
      } else {
        const built = await this.buildEffect(
          inputs,
          override.questionCode ?? '',
          override.programCode,
          override.target,
          {
            rows: override.rows ?? [],
            ...(override.onNoMatch ? { onNoMatch: override.onNoMatch } : {}),
          },
          patch,
        );
        await this.programs.validateDraft(
          override.programCode,
          updateDtoOf(built.program, built.patch),
        );
        Object.assign(patch, built.patch);
      }
      patches.set(override.programCode, patch);
    }
    return (row) => {
      const patch = patches.get(row.programCode);
      return patch === undefined ? row : { ...row, ...patch };
    };
  }

  // ---- builders: the one place a write and a draft are both made ------------------------

  /**
   * One effect's new column for one program, checked — shared by the write and the draft.
   * `pending` carries an earlier draft's columns for the same program, so two drafts on one
   * program compose instead of the second silently reading the stored column.
   */
  private async buildEffect(
    inputs: QuestionUsageInputs,
    questionCode: string,
    programCode: string,
    effect: LoanEngineEffect,
    dto: Pick<PutEffectRowsDto, 'rows' | 'onNoMatch'>,
    pending: Record<string, unknown> = {},
  ): Promise<{
    program: BankProgramResponseDto;
    patch: Partial<Record<Column, Record<string, unknown>>>;
    changed: boolean;
    question: UsageQuestion;
    factKey: string;
  }> {
    const question = this.questionOf(questionCode, inputs);
    const factKey = this.factKeyOf(question.code, inputs);
    const refuse = (problem: LoanEngineRuleProblem, row?: number): never => {
      throw new LoanEngineRuleInvalidException({
        programCode,
        effect,
        problem,
        questionCode,
        ...(row !== undefined ? { row } : {}),
      });
    };
    if (factKey === null) return refuse('not_linked');

    // The form's own read: the shape `update()` round-trips (incomeAssumption normalised).
    const program = await this.programs.findOne(programCode);
    const stored = await this.repo.programByCode(programCode);
    if (stored === null) throw new BankProgramNotFoundException({ programCode });
    const raw: LoanEngineProgramRow = { ...stored, ...(pending as Partial<LoanEngineProgramRow>) };
    if (!question.categories.includes(raw.category as never)) return refuse('read_only_surface');
    const state = this.effectState(raw, effect, question, factKey);
    if (!state.editable) return refuse('read_only_surface');

    const slot = EFFECT_SLOTS[effect];
    const column = {
      ...(isRecord(raw[slot.column]) ? (raw[slot.column] as object) : {}),
    } as Record<string, unknown>;
    const before = JSON.stringify(column[slot.field] ?? null);

    if (slot.kind === 'sources') {
      if (dto.rows.length > 1) return refuse('shape', 1);
      const current = isRecord(column.additionalIncome)
        ? (column.additionalIncome as unknown as AdditionalIncomeConfig)
        : undefined;
      const others = (current?.sources ?? []).filter((s) => s.factKey !== factKey);
      const first = dto.rows[0];
      const sources = first === undefined ? others : [...others, { factKey, percent: first.value }];
      if (sources.length === 0 && current?.capPercentOfBasic === undefined) {
        delete column.additionalIncome;
      } else {
        column.additionalIncome = {
          ...(current ?? {}),
          sources,
        } satisfies AdditionalIncomeConfig;
      }
    } else {
      const keys = dto.rows.map((row, index) => this.keyOf(row, question, refuse, index));
      if (dto.rows.length === 0) {
        delete column[slot.field];
      } else if (slot.kind === 'grid') {
        const onNoMatch = dto.onNoMatch ?? 'useFallback';
        if (onNoMatch === 'useProgramMax') return refuse('shape');
        column[slot.field] = {
          axes: [{ factKey }],
          cells: dto.rows.map((row, i) => ({ keys: [keys[i] ?? null], value: row.value })),
          onNoMatch,
        } satisfies FactGridConfig;
      } else {
        const onNoMatch = dto.onNoMatch ?? 'useProgramMax';
        if (onNoMatch === 'useFallback') return refuse('shape');
        column[slot.field] = {
          factKey,
          rows: dto.rows.map((row, i) => capRowOf(keys[i], row.value)),
          onNoMatch,
        } satisfies MaxLoanByFactConfig;
      }
    }
    return {
      program,
      patch: { [slot.column]: column },
      changed: JSON.stringify(column[slot.field] ?? null) !== before,
      question,
      factKey,
    };
  }

  /** A program's new condition list, checked — shared by the write and the draft. */
  private buildConditions(
    program: LoanEngineProgramRow,
    dtoConditions: readonly ProgramConditionDto[],
    inputs: QuestionUsageInputs,
  ): { conditions: ProgramCondition[]; required: Set<string> } {
    const programCode = program.programCode;
    const platformQuestionCodes = inputs.facts
      .filter((f) => isReservedFactKey(f.key) && f.boundQuestionCode !== null)
      .map((f) => f.boundQuestionCode as string);
    const ids = new Set<string>();
    const required = new Set<string>();
    const conditions: ProgramCondition[] = dtoConditions.map((condition, conditionIndex) => {
      if (ids.has(condition.id)) {
        throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
          field: 'conditions.id',
          duplicate: condition.id,
        });
      }
      ids.add(condition.id);
      const anyOf = condition.anyOf.map((ref) => {
        const refuse = (problem: LoanEngineRuleProblem): never => {
          throw new LoanEngineRuleInvalidException({
            programCode,
            effect: 'conditions',
            problem,
            row: conditionIndex,
            questionCode: ref.questionCode,
          });
        };
        const question = this.questionOf(ref.questionCode, inputs);
        // The engine-input refusal FIRST: the money questions bind no fact, and "link it
        // first" would send the operator to do exactly what A33 forbids.
        if (questionLockReason(question.code, { platformQuestionCodes }) === 'engine') {
          return refuse('engine_input');
        }
        const factKey = this.factKeyOf(question.code, inputs);
        if (factKey === null) return refuse('not_linked');
        if (isReservedFactKey(factKey)) return refuse('engine_input');
        if (!question.categories.includes(program.category as never)) {
          return refuse('read_only_surface');
        }
        required.add(question.code);
        return {
          factKey,
          key: this.keyOf(
            { criterion: ref.criterion, value: '1' },
            question,
            refuse,
            conditionIndex,
          ),
        };
      });
      return { id: condition.id, reasonCode: condition.reasonCode, anyOf };
    });
    return { conditions, required };
  }

  // ---- shared ---------------------------------------------------------------------------

  private sliceOf(
    row: LoanEngineProgramRow,
    question: UsageQuestion | null,
    factKey: string | null,
    inputs: QuestionUsageInputs,
  ): LoanEngineProgramSlice {
    const effects = {} as Record<LoanEngineEffect, EffectState>;
    for (const effect of LOAN_ENGINE_EFFECTS) {
      effects[effect] =
        factKey === null || question === null
          ? { editable: false, rows: [], onNoMatch: null }
          : this.effectState(row, effect, question, factKey);
    }
    return {
      programCode: row.programCode,
      bankName: row.bankName,
      friendlyName: row.friendlyName,
      category: row.category,
      version: row.version,
      programNameKey: row.programNameKey,
      effects,
      conditions: asProgramConditions(row.conditions).map((c) => ({
        id: c.id,
        reasonCode: c.reasonCode,
        anyOf: c.anyOf.map((cr) => ({
          questionCode: inputs.facts.find((f) => f.key === cr.factKey)?.boundQuestionCode ?? null,
          factKey: cr.factKey,
          criterion: keyToCriterion(cr.key),
        })),
      })),
    };
  }

  /** One effect of one program, as this question sees it. */
  private effectState(
    row: LoanEngineProgramRow,
    effect: LoanEngineEffect,
    question: UsageQuestion,
    factKey: string,
  ): EffectState {
    const slot = EFFECT_SLOTS[effect];
    const column = isRecord(row[slot.column]) ? (row[slot.column] as Record<string, unknown>) : {};
    const stored = column[slot.field];

    if (slot.kind === 'sources') {
      if (question.type !== 'NUMERIC') {
        return { editable: false, readOnlyReason: 'not_numeric', rows: [], onNoMatch: null };
      }
      const sources = isRecord(stored) && Array.isArray(stored.sources) ? stored.sources : [];
      const mine = sources.find(
        (s): s is { factKey: string; percent: string } =>
          isRecord(s) && s.factKey === factKey && typeof s.percent === 'string',
      );
      return {
        editable: true,
        rows: mine === undefined ? [] : [{ criterion: null, value: mine.percent }],
        onNoMatch: null,
      };
    }

    const readOnly = (
      readOnlyReason: NonNullable<EffectState['readOnlyReason']>,
      otherFactKey?: string,
    ): EffectState => ({
      editable: false,
      readOnlyReason,
      ...(otherFactKey !== undefined ? { otherFactKey } : {}),
      rows: [],
      onNoMatch: null,
    });

    if (slot.kind === 'cap') {
      if (!isRecord(stored)) return { editable: true, rows: [], onNoMatch: 'useProgramMax' };
      const table = stored as unknown as MaxLoanByFactConfig;
      if (table.factKey !== factKey) return readOnly('other_fact', table.factKey);
      if (table.columnFactKey !== undefined) return readOnly('two_axis_cap');
      if (table.rowVia === 'parentClass') return readOnly('class_axis');
      return {
        editable: true,
        rows: (Array.isArray(table.rows) ? table.rows : []).map((r) => ({
          criterion: keyToCriterion(capKeyOf(r)),
          value: r.maxAmountEGP,
        })),
        onNoMatch: table.onNoMatch,
      };
    }

    if (slot.planSlot && inheritsProductPlans(row.plansSource)) return readOnly('inherited_plan');
    if (!isRecord(stored)) return { editable: true, rows: [], onNoMatch: 'useFallback' };
    const grid = stored as unknown as FactGridConfig;
    const axes = Array.isArray(grid.axes) ? grid.axes : [];
    if (axes.length !== 1) {
      return axes.some((a) => a.factKey === factKey)
        ? readOnly('multi_axis')
        : readOnly('other_fact', axes[0]?.factKey);
    }
    const axis = axes[0];
    if (axis === undefined || axis.factKey !== factKey)
      return readOnly('other_fact', axis?.factKey);
    if (axis.via === 'parentClass') return readOnly('class_axis');
    const rows: EffectRow[] = [];
    for (const cell of Array.isArray(grid.cells) ? grid.cells : []) {
      rows.push({ criterion: keyToCriterion(cell.keys[0] ?? null), value: cell.value });
    }
    return { editable: true, rows, onNoMatch: grid.onNoMatch };
  }

  /** A row's criterion → the stored key, checked against the question's type and options. */
  private keyOf(
    row: EffectRowDto,
    question: UsageQuestion,
    refuse: (problem: LoanEngineRuleProblem, row?: number) => never,
    index: number,
  ): Exclude<FactGridKey, null> {
    const criterion = parseCriterion(row.criterion);
    if (criterion === null) return refuse('shape', index);
    const isNumberOp = 'op' in criterion;
    if (question.type === 'NUMERIC' && !isNumberOp) return refuse('shape', index);
    if (question.type === 'TEXT' && !('answered' in criterion)) return refuse('shape', index);
    if (
      (question.type === 'SINGLE_SELECT' || question.type === 'MULTI_SELECT') &&
      !('option' in criterion)
    ) {
      return refuse('shape', index);
    }
    if ('option' in criterion && !question.optionCodes.includes(criterion.option)) {
      return refuse('unknown_option', index);
    }
    try {
      return criterionToKey(criterion);
    } catch (err) {
      if (err instanceof CriterionError) return refuse(err.problem, index);
      throw err;
    }
  }

  private questionOf(code: string, inputs: QuestionUsageInputs): UsageQuestion {
    const q = inputs.questions.find((x) => x.code === code);
    if (q === undefined) {
      throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND, { questionCode: code });
    }
    return q;
  }

  private factKeyOf(code: string, inputs: QuestionUsageInputs): string | null {
    return inputs.facts.find((f) => f.boundQuestionCode === code && f.active)?.key ?? null;
  }
}

/** The wire criterion, or `null` when it is not one of the shapes `Criterion` names. */
export function parseCriterion(raw: unknown): Criterion | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.option === 'string') return { option: raw.option };
  if (raw.answered === true) return { answered: true };
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const a = str(raw.a);
  const b = str(raw.b);
  switch (raw.op) {
    case 'lt':
    case 'lte':
    case 'gte':
    case 'gt':
    case 'eq':
      return a === undefined ? null : { op: raw.op, a };
    case 'between':
    case 'range':
      return a === undefined || b === undefined ? null : { op: raw.op, a, b };
    case 'custom':
      if (typeof raw.aInclusive !== 'boolean' || typeof raw.bInclusive !== 'boolean') return null;
      return {
        op: 'custom',
        ...(a !== undefined ? { a } : {}),
        aInclusive: raw.aInclusive,
        ...(b !== undefined ? { b } : {}),
        bInclusive: raw.bInclusive,
      };
    default:
      return null;
  }
}

/** A cap row keys by `rowKey` or by band edges; the grid's key shape, read off it. */
function capKeyOf(row: MaxLoanByFactRow): FactGridKey {
  if (row.rowKey !== undefined) return { key: row.rowKey };
  const band: FactGridBand = {};
  if (row.fromInclusive !== undefined) band.fromInclusive = row.fromInclusive;
  if (row.fromExclusive !== undefined) band.fromExclusive = row.fromExclusive;
  if (row.toExclusive !== undefined) band.toExclusive = row.toExclusive;
  if (row.toInclusive !== undefined) band.toInclusive = row.toInclusive;
  return band;
}

function capRowOf(key: Exclude<FactGridKey, null> | undefined, value: string): MaxLoanByFactRow {
  if (key === undefined || 'key' in key) return { rowKey: key?.key, maxAmountEGP: value };
  return {
    ...(key.fromInclusive !== undefined ? { fromInclusive: key.fromInclusive } : {}),
    ...(key.fromExclusive !== undefined ? { fromExclusive: key.fromExclusive } : {}),
    ...(key.toExclusive !== undefined ? { toExclusive: key.toExclusive } : {}),
    ...(key.toInclusive !== undefined ? { toInclusive: key.toInclusive } : {}),
    maxAmountEGP: value,
  };
}

/**
 * The full-replacement PUT body `update()` takes, from the response the form itself reads —
 * the one round trip the form already makes on every save. `valueSources` is OMITTED, which
 * `update()` reads as "leave the stored markers alone".
 */
function updateDtoOf(
  program: BankProgramResponseDto,
  patch: Partial<Record<Column, Record<string, unknown>>>,
): UpdateBankProgramDto {
  return {
    version: program.version,
    programCode: program.programCode,
    bankName: program.bankName,
    friendlyName: program.friendlyName,
    ...(program.friendlyNameAr ? { friendlyNameAr: program.friendlyNameAr } : {}),
    programNameKey: program.programNameKey ?? '',
    programType: program.programType,
    productCategory: program.productCategory,
    isShariaCompliant: program.isShariaCompliant,
    plansSource: program.plansSource,
    ...(program.operatorNotes ? { operatorNotes: program.operatorNotes } : {}),
    operatorTips: program.operatorTips,
    requiredDocuments: program.requiredDocuments,
    tenor: (patch.tenor ?? program.tenor) as never,
    loanLimits: (patch.loanLimits ?? program.loanLimits) as never,
    pricing: (patch.pricing ?? program.pricing) as never,
    eligibility: program.eligibility as never,
    ...(program.performanceCriteria
      ? { performanceCriteria: program.performanceCriteria as never }
      : {}),
    incomeAssumption: (patch.incomeAssumption ?? program.incomeAssumption) as never,
    fees: program.fees as never,
  };
}
