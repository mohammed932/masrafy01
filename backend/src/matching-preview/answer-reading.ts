/**
 * Reading a submitted answer set against the PUBLISHED questionnaire — one implementation for
 * the matching preview and the loan calculator, so the two cannot accept, refuse or read one
 * answer two ways (A33). Apply validates against the live pool (`resolveAnswers`) and reads
 * its own maps (`answerMapsOf`); all three then go through the same `answerPicksFromMaps` →
 * `answerEffectsFromAnswers` and the same `quoteProgram`.
 *
 * Pure: the snapshot is the caller's read.
 */

import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { surrogateOptionPick } from '@/matching/pipeline/surrogate-facts-from-answers';
import {
  validateAnswer,
  type NormalisedAnswer,
  type SubmittedAnswerValue,
} from '@/questionnaire/validation/answer-validation';

export interface SnapshotOption {
  code: string;
}

export interface SnapshotQuestion {
  code: string;
  /** Absent on a pre-010 snapshot — read as SINGLE_SELECT (FR-045). */
  type?: string | null;
  /** Frozen branching rule; absent means always shown. */
  enabledWhen?: unknown;
  /** Frozen since v31.0.0 (`question.fixedServedOn`); absent = not fixed. */
  fixedServedOn?: unknown;
  options: SnapshotOption[];
  numeric?: { minValue?: string | null; maxValue?: string | null; step?: string | null } | null;
  text?: { maxLength?: number | null } | null;
}

export interface Snapshot {
  category: string;
  groups: { questions: SnapshotQuestion[] }[];
}

/**
 * The questions an answer may be given to: every question the snapshot holds. A question carries
 * no loan type since v32.0.0, and what may be ANSWERED is never narrowed — apply's
 * `resolveAnswers` accepts any live question the same way. Whether one was ASKED is the program's
 * call (`question-scope.ts`).
 */
export function questionsAnsweredIn(snapshot: Snapshot): SnapshotQuestion[] {
  return (snapshot.groups ?? []).flatMap((g) => g.questions ?? []);
}

/** Every validated answer, read into the maps the engine's answer mappers take. */
export interface ReadAnswers {
  /** Every SINGLE_SELECT pick (`surrogateOptionPick`), by question code. */
  readonly optionByCode: Map<string, string>;
  /** Multi-picks by question code — a set, not a key. */
  readonly multiByCode: Map<string, readonly string[]>;
  /** Numeric answers by question code, as validated decimal strings. */
  readonly numericByCode: Map<string, string>;
  /** Non-empty text answers by question code — read for PRESENCE only. */
  readonly textByCode: Map<string, string>;
  /** The normalised answer itself, by question code, for a caller that needs more. */
  readonly normalisedByCode: Map<string, NormalisedAnswer>;
}

/**
 * Validate every answer against its question — type, bounds, option membership — through the
 * shared `validateAnswer`, and read it into the maps. `isRequired` is forced off: a partial
 * answer set is a normal state for a preview or a calculator; required-question enforcement
 * belongs to apply. An answer to a question not in `byCode` is refused
 * (`UNKNOWN_QUESTION_CODE`), exactly as before this was shared.
 */
export function readSubmittedAnswers(
  byCode: ReadonlyMap<string, SnapshotQuestion>,
  answers: readonly SubmittedAnswerValue[],
): ReadAnswers {
  const optionByCode = new Map<string, string>();
  const multiByCode = new Map<string, readonly string[]>();
  const numericByCode = new Map<string, string>();
  const textByCode = new Map<string, string>();
  const normalisedByCode = new Map<string, NormalisedAnswer>();
  for (const ans of answers) {
    const q = byCode.get(ans.questionCode);
    if (!q) {
      throw new DomainException(ERROR_CODES.UNKNOWN_QUESTION_CODE, { code: ans.questionCode });
    }
    const normalised = validateAnswer(
      {
        code: q.code,
        type: q.type,
        isRequired: false,
        optionCodes: (q.options ?? []).map((o) => o.code),
        numeric: q.numeric ?? null,
        text: q.text ?? null,
      },
      ans,
    );
    if (normalised) normalisedByCode.set(q.code, normalised);
    // A numeric answer prices the loan.
    if (normalised?.numericValue != null) numericByCode.set(q.code, normalised.numericValue);
    // A single pick — the option code, which IS the registry key an income rule's table is
    // keyed by (FR-017). Through the SAME predicate apply uses, so the paths cannot bind a
    // fact differently for one set of answers (A33).
    const picked = normalised
      ? surrogateOptionPick({ type: q.type, selectedOptionCodes: normalised.selectedOptionCodes })
      : undefined;
    if (picked !== undefined) optionByCode.set(q.code, picked);
    if (q.type === 'MULTI_SELECT' && normalised && normalised.selectedOptionCodes.length > 0) {
      multiByCode.set(q.code, normalised.selectedOptionCodes);
    }
    if (normalised?.textValue != null && normalised.textValue.trim().length > 0) {
      textByCode.set(q.code, normalised.textValue);
    }
  }
  return { optionByCode, multiByCode, numericByCode, textByCode, normalisedByCode };
}
