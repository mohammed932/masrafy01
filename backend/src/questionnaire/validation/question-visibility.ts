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

/** A stored `enabledWhen` rule: show this question when the source answer matches. */
interface EnabledWhenRule {
  questionCode?: string;
  operator?: string;
  optionCode?: string;
}

/**
 * The gate a question is asked behind, or `null` when it is asked unconditionally.
 *
 * Exported from HERE rather than re-declared beside its caller, for the same reason
 * `isQuestionVisible` is shared: `EnabledWhenRule` is the one description of what that
 * stored JSON contains, and a second reading of it is a second thing to keep in step.
 *
 * A HALF rule — a `questionCode` with no `optionCode`, or the reverse — reads as no gate,
 * matching `isQuestionVisible`, which shows the question in exactly that case. A caller
 * asking "what is this gated on" must get the same answer as the one asking "is it shown".
 */
export function enabledWhenGate(q: {
  enabledWhen: unknown;
}): { questionCode: string; optionCode: string } | null {
  const rule = q.enabledWhen as EnabledWhenRule | null;
  if (!rule?.questionCode || !rule.optionCode) return null;
  return { questionCode: rule.questionCode, optionCode: rule.optionCode };
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
  const rule = q.enabledWhen as EnabledWhenRule | null;
  if (!rule?.questionCode || !rule.optionCode) return true;
  if (!byCode.has(rule.questionCode)) return true;

  const source = submitted.get(rule.questionCode);
  const picked = source
    ? [...(source.optionCodes ?? []), ...(source.optionCode ? [source.optionCode] : [])]
    : [];
  const matches = picked.includes(rule.optionCode);
  return rule.operator === 'not_equals' ? !matches : matches;
}
