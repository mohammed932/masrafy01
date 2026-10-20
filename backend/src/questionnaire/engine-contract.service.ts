import { Injectable } from '@nestjs/common';
import type { LoanCategory, Question } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ALL_LOAN_CATEGORIES } from '@/common/loan-category.util';
import { CAR_DOWN_PAYMENT_FACT_KEY, CAR_PRICE_FACT_KEY } from '@/matching/pipeline/car-details';
import { isReservedFactKey } from '@/matching/pipeline/fact-question-eligibility';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { planAssignment } from './assignment-plan';
import { QuestionnaireRepository } from './questionnaire.repository';
import {
  baseCategoryRemoved,
  engineContractViolations,
  engineLocks,
  introducedViolations,
  isRefusedForLock,
  lockedChangesBetween,
  programReaders,
  sameGate,
  wordingNumberBreaks,
  type ContractQuestion,
  type ContractWording,
  type EngineContractContext,
  type EngineContractViolation,
  type EngineLock,
  type EngineLockedChange,
  type ProposedWording,
  type WordingNumberBreak,
} from './validation/engine-contract';
import { clipForMessage, quantitiesForMessage } from './validation/wording-numbers';

/** A change to one question's own columns. `undefined` = left as it is. */
export interface QuestionPatch {
  type?: string;
  isRequired?: boolean;
  isActive?: boolean;
  /** `null` clears the rule. */
  enabledWhen?: unknown;
  /** The numeric unit (ar or en) would change. */
  unitChanged?: boolean;
  /** A numeric bound or the step would change (value compare — a resend is no change). */
  boundsChanged?: boolean;
  /** A text question's length cap would change. */
  maxLengthChanged?: boolean;
  /** The wording it would have — judged for its quantities only (`wordingNumberBreaks`). */
  questionAr?: string;
  questionEn?: string;
  /** `null` (or empty) clears the helper text. */
  helperTextAr?: string | null;
  helperTextEn?: string | null;
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
  /** An answer relabelled; `undefined` = that language left as it is. */
  | {
      kind: 'option_label';
      questionId: string;
      optionCode: string;
      labelAr?: string;
      labelEn?: string;
    }
  /** A rollback: the questionnaire becomes what this frozen snapshot holds. */
  | { kind: 'snapshot'; snapshot: unknown };

/** What the editor shows on a locked question. */
export interface QuestionEngineLockView {
  reason: EngineLock['reason'];
  optionsFixed: boolean;
  /** In the fixed question set: only its wording and its place in the order may change. */
  shapeFixed: boolean;
  /** The loan types a `shapeFixed` question may never leave. */
  baseCategories: LoanCategory[];
  programNames: { key: string; labelAr: string; labelEn: string }[];
}

/** A name or list as the admin shows it: its key and both labels. */
export interface LabelledKey {
  key: string;
  labelAr: string;
  labelEn: string;
}

/** Who reads what, beyond the lock itself — what the engine-rules view is built from. */
export interface EngineReaderViews {
  /** Exactly `lockViews()`. */
  locks: ReadonlyMap<string, QuestionEngineLockView>;
  /** Every program name whose programmes read a question, by code, with the loan types. */
  programReaders: ReadonlyMap<string, (LabelledKey & { categories: LoanCategory[] })[]>;
  /** The platform-owned facts bound to a question (I-Score, the car figures), by code. */
  platformFacts: ReadonlyMap<string, LabelledKey[]>;
  /** The Manage-values list whose values ARE a question's answers, by question id. */
  mirroredLists: ReadonlyMap<string, LabelledKey>;
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

    // The quantities in a locked question's wording (v30.12.0): "Less than 6 months" may be
    // reworded, never renumbered — the engine reads the code, the applicant picks by the words.
    if (write.kind === 'question' || write.kind === 'option_label') {
      const row = rows.find((r) => r.id === write.questionId);
      const lock = row === undefined ? undefined : locks.get(row.code);
      const wording = live.find((q) => q.id === write.questionId)?.wording;
      if (row !== undefined && lock !== undefined && wording !== undefined) {
        const breaks = wordingNumberBreaks(wording, await this.proposedWording(write));
        const first = breaks[0];
        if (first !== undefined) refuseNumbers(row, lock, first, breaks);
      }
      // A label is wording and nothing else: nothing the ratchet reads can move.
      if (write.kind === 'option_label') return;
    }

    const after = await this.playForward(live, write);

    // A fixed-set question may never leave a loan type the set asks it in — the category
    // replace is judged on what it would leave behind, exactly as the repository writes it.
    if (write.kind === 'categories') {
      const next = new Map(after.map((q) => [q.id, q]));
      for (const { questionId } of write.assignments) {
        const row = rows.find((r) => r.id === questionId);
        const lock = row === undefined ? undefined : locks.get(row.code);
        const before = live.find((q) => q.id === questionId);
        const changed = next.get(questionId);
        if (row === undefined || lock === undefined || before === undefined || !changed) continue;
        if (
          baseCategoryRemoved(row.code, before, changed) &&
          isRefusedForLock(lock, 'category_removed')
        ) {
          refuse(row, lock, 'category_removed');
        }
      }
    }

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
      // Then the wording each locked question would be served with, judged as a relabel would
      // be — after the structure, so the more basic refusal is the one reported. A mirrored
      // question's answer labels are its list's, not the version's to restore.
      const mirrored = await this.mirroredQuestionIds();
      for (const before of live) {
        const lock = locks.get(before.code);
        const row = rows.find((r) => r.id === before.id);
        const now = frozen.get(before.code)?.wording;
        if (lock === undefined || row === undefined || !before.isActive) continue;
        if (before.wording === undefined || now === undefined) continue;
        const proposed: ProposedWording = mirrored.has(before.id)
          ? {
              questionAr: now.questionAr,
              questionEn: now.questionEn,
              helperTextAr: now.helperTextAr,
              helperTextEn: now.helperTextEn,
            }
          : now;
        const breaks = wordingNumberBreaks(before.wording, proposed);
        const first = breaks[0];
        if (first !== undefined) refuseNumbers(row, lock, first, breaks);
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
    return buildLockViews(ctx, labelledByKey(names));
  }

  /**
   * Everything the engine-rules view says about who reads a question: the lock, every program
   * name reading it (whatever else locks it), the platform facts it answers, and the list its
   * answers come from. One read of the world, as `lockViews` does.
   */
  async readerViews(): Promise<EngineReaderViews> {
    const [ctx, names, facts, defs] = await Promise.all([
      this.context(),
      this.enums.getActiveMembers('program_name'),
      this.enums.getActiveMembers('surrogate_fact'),
      this.enums.typeDefinitions(),
    ]);
    const label = labelledByKey(names);
    const readers = new Map<string, (LabelledKey & { categories: LoanCategory[] })[]>();
    for (const [code, list] of programReaders(ctx)) {
      readers.set(
        code,
        list.map((r) => ({ ...labelOf(label, r.programNameKey), categories: [...r.categories] })),
      );
    }
    const platformFacts = new Map<string, LabelledKey[]>();
    for (const fact of facts) {
      const code = fact.boundQuestion?.code;
      if (code === undefined || !isReservedFactKey(fact.key)) continue;
      const list = platformFacts.get(code) ?? [];
      list.push({ key: fact.key, labelAr: fact.labelAr, labelEn: fact.labelEn });
      platformFacts.set(code, list);
    }
    const mirroredLists = new Map<string, LabelledKey>();
    for (const def of defs.values()) {
      if (def.mirrorQuestionId === null) continue;
      mirroredLists.set(def.mirrorQuestionId, {
        key: def.key,
        labelAr: def.labelAr,
        labelEn: def.labelEn,
      });
    }
    return {
      locks: buildLockViews(ctx, label),
      programReaders: readers,
      platformFacts,
      mirroredLists,
    };
  }

  /** The wording `write` would leave. A mirrored question's answers are its list's to label. */
  private async proposedWording(
    write: Extract<QuestionnaireWrite, { kind: 'question' | 'option_label' }>,
  ): Promise<ProposedWording> {
    if (write.kind === 'question') {
      const p = write.patch;
      return {
        questionAr: p.questionAr,
        questionEn: p.questionEn,
        helperTextAr: p.helperTextAr,
        helperTextEn: p.helperTextEn,
      };
    }
    if ((await this.mirroredQuestionIds()).has(write.questionId)) return {};
    return {
      optionLabels: { [write.optionCode]: { labelAr: write.labelAr, labelEn: write.labelEn } },
    };
  }

  /** The questions whose answers ARE a Manage-values list (`EnumerationTypeDef.mirrorQuestionId`). */
  private async mirroredQuestionIds(): Promise<ReadonlySet<string>> {
    const defs = await this.enums.typeDefinitions();
    return new Set(
      [...defs.values()].flatMap((d) => (d.mirrorQuestionId === null ? [] : [d.mirrorQuestionId])),
    );
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
    return rows.map((r) => {
      const active = (options.get(r.id) ?? []).filter((o) => o.isActive);
      return {
        id: r.id,
        code: r.code,
        type: r.type,
        isActive: r.isActive,
        isRequired: r.isRequired,
        enabledWhen: r.enabledWhen ?? null,
        categories: assignments.get(r.id) ?? [],
        optInCategories: optIns.get(r.id) ?? [],
        optionCodes: active.map((o) => o.code),
        unitAr: r.numericUnitAr,
        unitEn: r.numericUnitEn,
        numericMin: r.numericMinValue?.toFixed(2) ?? null,
        numericMax: r.numericMaxValue?.toFixed(2) ?? null,
        numericStep: r.numericStep?.toFixed(2) ?? null,
        textMaxLength: r.textMaxLength,
        wording: {
          questionAr: r.questionAr,
          questionEn: r.questionEn,
          helperTextAr: r.helperTextAr,
          helperTextEn: r.helperTextEn,
          optionLabels: Object.fromEntries(
            active.map((o) => [o.code, { labelAr: o.labelAr, labelEn: o.labelEn }]),
          ),
        },
      };
    });
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
      case 'option_label':
        return [...live];
      case 'snapshot':
        return snapshotQuestions(write.snapshot, live);
    }
  }
}

/** Active program names (or any registry members) by key. */
function labelledByKey(
  members: readonly { key: string; labelAr: string; labelEn: string }[],
): ReadonlyMap<string, LabelledKey> {
  return new Map(
    members.map((m) => [m.key, { key: m.key, labelAr: m.labelAr, labelEn: m.labelEn }]),
  );
}

/** A key with its labels, or the key itself where the registry no longer lists it. */
function labelOf(labels: ReadonlyMap<string, LabelledKey>, key: string): LabelledKey {
  return labels.get(key) ?? { key, labelAr: key, labelEn: key };
}

function buildLockViews(
  ctx: EngineContractContext,
  labels: ReadonlyMap<string, LabelledKey>,
): ReadonlyMap<string, QuestionEngineLockView> {
  const out = new Map<string, QuestionEngineLockView>();
  for (const [code, lock] of engineLocks(ctx)) {
    out.set(code, {
      reason: lock.reason,
      optionsFixed: lock.optionsFixed,
      shapeFixed: lock.shapeFixed,
      baseCategories: [...lock.baseCategories],
      programNames: lock.programNameKeys.map((key) => labelOf(labels, key)),
    });
  }
  return out;
}

/**
 * Refuse a write that would change the quantities in a locked question's wording. The first
 * break leads the message (`{was}`, `{keep}`, `{found}` — the admin's catalog holds the
 * sentence, Principle III); every break rides beside it in `breaks`.
 */
function refuseNumbers(
  row: Question,
  lock: EngineLock,
  first: WordingNumberBreak,
  breaks: readonly WordingNumberBreak[],
): never {
  throw new DomainException(ERROR_CODES.ENGINE_WORDING_NUMBERS_CHANGED, {
    questionId: row.id,
    code: row.code,
    questionAr: row.questionAr,
    questionEn: row.questionEn,
    reason: lock.reason,
    field: first.field,
    optionCode: first.optionCode,
    language: first.language,
    was: clipForMessage(first.was),
    now: clipForMessage(first.now),
    keep: quantitiesForMessage(first.keep),
    found: quantitiesForMessage(first.found),
    breaks: breaks.map((b) => ({
      field: b.field,
      optionCode: b.optionCode,
      language: b.language,
      keep: [...b.keep],
      found: [...b.found],
    })),
  });
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
  if (p.boundsChanged === true) return 'bounds';
  if (p.maxLengthChanged === true) return 'max_length';
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
      options?: { code?: unknown; labelAr?: unknown; labelEn?: unknown }[];
      numeric?: {
        unitAr?: unknown;
        unitEn?: unknown;
        minValue?: unknown;
        maxValue?: unknown;
        step?: unknown;
      } | null;
      text?: { maxLength?: unknown } | null;
      questionAr?: unknown;
      questionEn?: unknown;
      helperTextAr?: unknown;
      helperTextEn?: unknown;
    };
    if (typeof q.code !== 'string' || frozen.has(q.code)) continue;
    const text = (value: unknown): string => (typeof value === 'string' ? value : '');
    const wording: ContractWording = {
      questionAr: text(q.questionAr),
      questionEn: text(q.questionEn),
      helperTextAr: typeof q.helperTextAr === 'string' ? q.helperTextAr : null,
      helperTextEn: typeof q.helperTextEn === 'string' ? q.helperTextEn : null,
      optionLabels: Object.fromEntries(
        (q.options ?? []).flatMap((o) =>
          typeof o.code === 'string'
            ? [[o.code, { labelAr: text(o.labelAr), labelEn: text(o.labelEn) }] as const]
            : [],
        ),
      ),
    };
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
      numericMin: typeof q.numeric?.minValue === 'string' ? q.numeric.minValue : null,
      numericMax: typeof q.numeric?.maxValue === 'string' ? q.numeric.maxValue : null,
      numericStep: typeof q.numeric?.step === 'string' ? q.numeric.step : null,
      textMaxLength: typeof q.text?.maxLength === 'number' ? q.text.maxLength : null,
      wording,
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
