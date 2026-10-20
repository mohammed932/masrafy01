/**
 * Branching visibility — the single rule deciding whether a question is put in
 * front of an applicant.
 *
 * Shared deliberately. Apply resolves answers against the LIVE question rows
 * while preview reads the FROZEN snapshot, but both must agree on what was
 * asked: the answer is the scoring denominator (Constitution V, v13.0.0), and
 * two implementations would let preview and apply report different scores for
 * identical input. Both shapes carry `enabledWhen` as stored JSON, so this
 * takes it structurally rather than binding to either.
 */

import type { SubmittedAnswerValue } from './answer-validation';

/**
 * A stored `enabledWhen` rule: show this question when the source answer matches.
 *
 * `equals` / `not_equals` name ONE answer (`optionCode`); `in` names SEVERAL (`optionCodes`,
 * v30.11.0) and shows the question when any of them is picked — what lets a follow-up open
 * for a whole job group off the one job question. A rule with no operator reads as `equals`,
 * as it always has.
 */
interface EnabledWhenRule {
  questionCode?: string;
  operator?: string;
  optionCode?: string;
  optionCodes?: unknown;
}

/** A rule as every reader sees it: one source question, the operator, and the answers named. */
export interface EnabledWhenGate {
  questionCode: string;
  operator: 'equals' | 'not_equals' | 'in';
  /** One code for `equals` / `not_equals`, two or more for `in`. Never empty. */
  optionCodes: readonly string[];
}

/**
 * The gate a question is asked behind, or `null` when it is asked unconditionally.
 *
 * Exported from HERE rather than re-declared beside its caller, for the same reason
 * `isQuestionVisible` is shared: `EnabledWhenRule` is the one description of what that
 * stored JSON contains, and a second reading of it is a second thing to keep in step.
 *
 * A HALF rule — a `questionCode` with no answer to compare, or the reverse — reads as no gate,
 * matching `isQuestionVisible`, which shows the question in exactly that case. So does an
 * operator this build does not know: a rule nobody can evaluate must never hide a question,
 * because a hidden required question can never be answered. A caller asking "what is this
 * gated on" must get the same answer as the one asking "is it shown".
 */
export function enabledWhenGate(q: { enabledWhen: unknown }): EnabledWhenGate | null {
  const rule = q.enabledWhen as EnabledWhenRule | null;
  if (rule === null || typeof rule !== 'object' || !rule.questionCode) return null;
  const operator = rule.operator ?? 'equals';
  if (operator === 'in') {
    const codes = Array.isArray(rule.optionCodes)
      ? rule.optionCodes.filter((c): c is string => typeof c === 'string' && c.length > 0)
      : [];
    return codes.length === 0
      ? null
      : { questionCode: rule.questionCode, operator, optionCodes: codes };
  }
  if (operator !== 'equals' && operator !== 'not_equals') return null;
  if (!rule.optionCode) return null;
  return { questionCode: rule.questionCode, operator, optionCodes: [rule.optionCode] };
}

/**
 * A question with no rule is always visible. A rule pointing at a question that
 * is not in `byCode` (deleted, deactivated, or filtered out of this category)
 * is DANGLING and never hides its target — hiding on a rule we cannot evaluate
 * would silently drop the question from both the questionnaire and the
 * denominator. The admin surfaces these separately as dangling-branch warnings.
 */
export function isQuestionVisible(
  q: { enabledWhen: unknown },
  submitted: ReadonlyMap<string, SubmittedAnswerValue>,
  byCode: ReadonlyMap<string, unknown>,
): boolean {
  const gate = enabledWhenGate(q);
  if (gate === null) return true;
  if (!byCode.has(gate.questionCode)) return true;

  const source = submitted.get(gate.questionCode);
  const picked = source
    ? [...(source.optionCodes ?? []), ...(source.optionCode ? [source.optionCode] : [])]
    : [];
  const matches = gate.optionCodes.some((code) => picked.includes(code));
  return gate.operator === 'not_equals' ? !matches : matches;
}
