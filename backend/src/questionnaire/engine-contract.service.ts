import { Injectable } from '@nestjs/common';
import type { LoanCategory, Question } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ALL_LOAN_CATEGORIES } from '@/common/loan-category.util';
import { CAR_DOWN_PAYMENT_FACT_KEY, CAR_PRICE_FACT_KEY } from '@/matching/pipeline/car-details';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { planAssignment } from './assignment-plan';
import { QuestionnaireRepository } from './questionnaire.repository';
import {
  engineContractViolations,
  engineLocks,
  introducedViolations,
  isRefusedForLock,
  lockedChangesBetween,
  sameGate,
  type ContractQuestion,
  type EngineContractContext,
  type EngineContractViolation,
  type EngineLock,
  type EngineLockedChange,
} from './validation/engine-contract';

/** A change to one question's own columns. `undefined` = left as it is. */
export interface QuestionPatch {
  type?: string;
  isRequired?: boolean;
  isActive?: boolean;
  /** `null` clears the rule. */
  enabledWhen?: unknown;
  /** The numeric unit (ar or en) would change. */
  unitChanged?: boolean;
}

/** Every write the contract judges, by what it changes. */
export type QuestionnaireWrite =
  | { kind: 'question'; questionId: string; patch: QuestionPatch }
  | {
      kind: 'categories';
      assignments: ReadonlyArray<{
        questionId: string;
        categories: readonly LoanCategory[];
        optInCategories?: readonly LoanCategory[];
      }>;
    }
  /** An answer turned on (created, or a retired one brought back) or off. */
  | { kind: 'option'; questionId: string; optionCode: string; active: boolean }
  /** A rollback: the questionnaire becomes what this frozen snapshot holds. */
  | { kind: 'snapshot'; snapshot: unknown };

/** What the editor shows on a locked question. */
export interface QuestionEngineLockView {
  reason: EngineLock['reason'];
  optionsFixed: boolean;
  programNames: { key: string; labelAr: string; labelEn: string }[];
}

/**
 * The engine-input contract, enforced (`validation/engine-contract.ts` holds the rules).
 *
 * Every write to the questionnaire publishes on the spot, so there is no later moment to refuse
 * it at: the refusal has to come BEFORE the write lands. `assertWrite` reads the world once,
 * plays the write forward in memory — category replaces through the same `planAssignment` the
 * repository writes with — and refuses it if it changes a locked question, or leaves the engine
 * without an answer it gets today.
 */
@Injectable()
export class EngineContractService {
  constructor(
    private readonly repo: QuestionnaireRepository,
    private readonly enums: PlatformEnumerationsRepository,
  ) {}

  /** Refuse `write` if it breaks the contract. Resolves when the write may go ahead. */
  async assertWrite(write: QuestionnaireWrite): Promise<void> {
    const [ctx, rows] = await Promise.all([this.context(), this.repo.questions()]);
    const live = await this.contractQuestions(rows);
    const locks = engineLocks(ctx);

    const refuse = (row: Question, lock: EngineLock, change: EngineLockedChange): never => {
      throw new DomainException(ERROR_CODES.QUESTION_ENGINE_LOCKED, {
        questionId: row.id,
        code: row.code,
        questionAr: row.questionAr,
        questionEn: row.questionEn,
        reason: lock.reason,
        change,
        programNameKeys: [...lock.programNameKeys],
      });
    };

    if (write.kind === 'question' || write.kind === 'option') {
      const row = rows.find((r) => r.id === write.questionId);
      const lock = row === undefined ? undefined : locks.get(row.code);
      if (row !== undefined && lock !== undefined) {
        const change = lockedChangeOf(row, write);
        if (change !== null && isRefusedForLock(lock, change)) refuse(row, lock, change);
      }
    }

    const after = await this.playForward(live, write);

    // A rollback changes many questions at once; each locked one is judged as if its changes
    // had been made one by one. Without this a version that froze I-Score as optional, or an
    // answer a programme's table no longer keys on, would be served as the live questionnaire
    // while apply goes on enforcing the live rows.
    if (write.kind === 'snapshot') {
      const frozen = new Map(after.map((q) => [q.code, q]));
      for (const before of live) {
        const lock = locks.get(before.code);
        const row = rows.find((r) => r.id === before.id);
        if (lock === undefined || row === undefined) continue;
        const change = lockedChangesBetween(before, frozen.get(before.code)).find((c) =>
          isRefusedForLock(lock, c),
        );
        if (change !== undefined) refuse(row, lock, change);
      }
    }

    const introduced = introducedViolations(
      engineContractViolations(live, ctx),
      engineContractViolations(after, ctx),
    );
    if (introduced.length > 0) {
      throw new DomainException(ERROR_CODES.ENGINE_INPUT_WOULD_BREAK, {
        ...questionList(introduced, rows),
        violations: introduced.map((v) => ({ ...v })),
      });
    }
  }

  /** The lock on every locked question, by code, with the names a `program` lock is read by. */
  async lockViews(): Promise<ReadonlyMap<string, QuestionEngineLockView>> {
    const [ctx, names] = await Promise.all([
      this.context(),
      this.enums.getActiveMembers('program_name'),
    ]);
    const label = new Map(names.map((n) => [n.key, n]));
    const out = new Map<string, QuestionEngineLockView>();
    for (const [code, lock] of engineLocks(ctx)) {
      out.set(code, {
        reason: lock.reason,
        optionsFixed: lock.optionsFixed,
        programNames: lock.programNameKeys.map((key) => ({
          key,
          labelAr: label.get(key)?.labelAr ?? key,
          labelEn: label.get(key)?.labelEn ?? key,
        })),
      });
    }
    return out;
  }

  /** Everything the contract reads that no questionnaire write can change. */
  private async context(): Promise<EngineContractContext> {
    const [offered, facts, lockScope] = await Promise.all([
      this.enums.offeredProgramFlows(),
      this.enums.getActiveMembers('surrogate_fact'),
      this.enums.questionLockScopeFor(null),
    ]);
    const flows = await Promise.all(
      offered.map(async (flow) => ({
        ...flow,
        scope:
          flow.programNameKey === null
            ? null
            : await this.enums.narrowingScopeFor(flow.programNameKey, flow.category),
      })),
    );
    const codeOf = (key: string): string | undefined =>
      facts.find((f) => f.key === key)?.boundQuestion?.code;
    const price = codeOf(CAR_PRICE_FACT_KEY);
    const down = codeOf(CAR_DOWN_PAYMENT_FACT_KEY);
    return {
      flows,
      facts: facts.map((f) => ({ key: f.key, questionCode: f.boundQuestion?.code ?? null })),
      platformQuestionCodes: lockScope.platformQuestionCodes,
      amountDerivableFrom: price !== undefined && down !== undefined ? [price, down] : [],
    };
  }

  /** The live pool, inactive questions included (a write may switch one back on). */
  private async contractQuestions(rows: readonly Question[]): Promise<ContractQuestion[]> {
    const [assignments, optIns, options] = await Promise.all([
      this.repo.categoryAssignments(),
      this.repo.optInAssignments(),
      this.repo.optionsByQuestions(rows.map((r) => r.id)),
    ]);
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      isActive: r.isActive,
      isRequired: r.isRequired,
      enabledWhen: r.enabledWhen ?? null,
      categories: assignments.get(r.id) ?? [],
      optInCategories: optIns.get(r.id) ?? [],
      optionCodes: (options.get(r.id) ?? []).filter((o) => o.isActive).map((o) => o.code),
      unitAr: r.numericUnitAr,
      unitEn: r.numericUnitEn,
    }));
  }

  /** The questionnaire `write` would leave behind. */
  private async playForward(
    live: readonly ContractQuestion[],
    write: QuestionnaireWrite,
  ): Promise<ContractQuestion[]> {
    switch (write.kind) {
      case 'question': {
        const p = write.patch;
        return live.map((q) =>
          q.id !== write.questionId
            ? q
            : {
                ...q,
                type: p.type ?? q.type,
                isRequired: p.isRequired ?? q.isRequired,
                isActive: p.isActive ?? q.isActive,
                enabledWhen: p.enabledWhen === undefined ? q.enabledWhen : p.enabledWhen,
              },
        );
      }
      case 'option':
        return live.map((q) => {
          if (q.id !== write.questionId) return q;
          const others = q.optionCodes.filter((code) => code !== write.optionCode);
          return { ...q, optionCodes: write.active ? [...others, write.optionCode] : others };
        });
      case 'categories': {
        const addedIn = await this.enums.questionAdditionCounts();
        const byId = new Map(write.assignments.map((a) => [a.questionId, a]));
        return live.map((q) => {
          const a = byId.get(q.id);
          if (a === undefined) return q;
          const counts = addedIn.get(q.id) ?? {};
          const plan = planAssignment(
            q.categories.map((category) => ({
              category,
              optIn: q.optInCategories.includes(category),
            })),
            a.categories,
            a.optInCategories,
            new Set((Object.keys(counts) as LoanCategory[]).filter((c) => (counts[c] ?? 0) > 0)),
          );
          return {
            ...q,
            categories: [...plan.ordinary, ...plan.optIn],
            optInCategories: plan.optIn,
          };
        });
      }
      case 'snapshot':
        return snapshotQuestions(write.snapshot, live);
    }
  }
}

/** What a write would change about a locked question, or `null` when it touches nothing locked. */
function lockedChangeOf(row: Question, write: QuestionnaireWrite): EngineLockedChange | null {
  // Turning an answer ON is adding it, whether it is new or a retired one brought back: the
  // engine and the app read a revived code exactly as they would read a new one. Callers send
  // an option write only when the answer actually flips.
  if (write.kind === 'option') return write.active ? 'option_added' : 'option_removed';
  if (write.kind !== 'question') return null;
  const p = write.patch;
  if (p.type !== undefined && p.type !== row.type) return 'type';
  if (p.isActive === false && row.isActive) return 'switched_off';
  if (p.isRequired === false && row.isRequired) return 'optional';
  if (p.enabledWhen !== undefined && !sameGate(p.enabledWhen, row.enabledWhen ?? null)) {
    return 'gate';
  }
  if (p.unitChanged === true) return 'unit';
  return null;
}

/**
 * The questionnaire a frozen snapshot describes, in the contract's shape. A question absent
 * from it is switched off; one frozen before loan-type assignment existed carries no
 * `categories` and was asked in all four (v12.0.0).
 */
function snapshotQuestions(
  snapshot: unknown,
  live: readonly ContractQuestion[],
): ContractQuestion[] {
  const groups = (snapshot as { groups?: { questions?: unknown[] }[] } | null)?.groups ?? [];
  const frozen = new Map<string, ContractQuestion>();
  for (const raw of groups.flatMap((g) => g.questions ?? [])) {
    const q = raw as {
      code?: unknown;
      type?: unknown;
      isRequired?: unknown;
      enabledWhen?: unknown;
      categories?: unknown;
      optInCategories?: unknown;
      options?: { code?: unknown }[];
      numeric?: { unitAr?: unknown; unitEn?: unknown } | null;
    };
    if (typeof q.code !== 'string' || frozen.has(q.code)) continue;
    const ordinary = Array.isArray(q.categories)
      ? (q.categories as LoanCategory[])
      : [...ALL_LOAN_CATEGORIES];
    const optIn = Array.isArray(q.optInCategories) ? (q.optInCategories as LoanCategory[]) : [];
    frozen.set(q.code, {
      id: live.find((l) => l.code === q.code)?.id ?? q.code,
      code: q.code,
      type: typeof q.type === 'string' ? q.type : 'SINGLE_SELECT',
      isActive: true,
      isRequired: q.isRequired === true,
      enabledWhen: q.enabledWhen ?? null,
      categories: [...ordinary, ...optIn],
      optInCategories: optIn,
      optionCodes: (q.options ?? []).flatMap((o) => (typeof o.code === 'string' ? [o.code] : [])),
      unitAr: typeof q.numeric?.unitAr === 'string' ? q.numeric.unitAr : null,
      unitEn: typeof q.numeric?.unitEn === 'string' ? q.numeric.unitEn : null,
    });
  }
  const off = live
    .filter((l) => !frozen.has(l.code))
    .map((l) => ({ ...l, isActive: false, categories: [], optInCategories: [] }));
  return [...frozen.values(), ...off];
}

/**
 * The questions a refusal names — their own authored wording, in each language — for the
 * one-line message the admin reads (`{questionsEn}` / `{questionsAr}`). Only content crosses
 * here, no sentence: the sentence around it is the admin's catalog (Principle III). The
 * structured `violations` ride beside it.
 */
function questionList(
  violations: readonly EngineContractViolation[],
  rows: readonly Question[],
): { questionsEn: string; questionsAr: string } {
  const codes = [...new Set(violations.map((v) => v.questionCode).filter((c) => c !== ''))];
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return {
    questionsEn: codes.map((c) => `“${byCode.get(c)?.questionEn ?? c}”`).join(', '),
    questionsAr: codes.map((c) => `«${byCode.get(c)?.questionAr ?? c}»`).join('، '),
  };
}
