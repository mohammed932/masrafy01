/**
 * Reading a stored show-when rule (`enabledWhen`) — what it names, and whether it lets its
 * question through.
 *
 * ONE reading for every screen that evaluates a rule, mirroring the backend's
 * `isQuestionVisible` (`questionnaire/validation/question-visibility.ts`). A second copy of the
 * comparison is how the simulator came to show an applicant a question the app hides: the two
 * agreed on `equals` and `not_equals` and would each have read `in` their own way.
 *
 * The rule says three things, and only those:
 *   - `equals`: shown when the source answer includes `optionCode`;
 *   - `not_equals`: shown when it does not;
 *   - `in`: shown when ANY picked answer is one of `optionCodes`.
 *
 * A rule with NO operator reads as `equals`, as it always has on the backend.
 *
 * Anything it cannot evaluate SHOWS its question — no rule, a half rule (a source with no
 * answer code), a source the pool no longer carries, an operator this build does not know.
 * Hiding on a rule nobody can read would drop the question from the questionnaire in silence;
 * the backend makes the same call for the same reason.
 *
 * Pure: no Angular, no `$localize`.
 */

/** The comparisons a rule can carry. */
export type EnabledWhenOperator = 'equals' | 'not_equals' | 'in';

/**
 * A stored rule, structurally — the tree's copy, the registry's copy, a draft. Every field is
 * optional because the column is JSON: what a writer put there is what comes back.
 */
export interface EnabledWhenLike {
  readonly questionCode?: string | null;
  readonly operator?: string | null;
  readonly optionCode?: string | null;
  readonly optionCodes?: readonly string[] | null;
}

/** The rule's operator, an absent one read as `equals` — the backend's own default. */
function operatorOf(rule: EnabledWhenLike): string {
  return rule.operator ?? 'equals';
}

/**
 * The answer codes a rule names: the one code of `equals` / `not_equals`, the list of `in`
 * (blanks and repeats dropped), nothing for an operator this build does not know. Empty means
 * the rule cannot be evaluated — `gateOpen` shows its question.
 */
export function ruleCodes(rule: EnabledWhenLike | null | undefined): readonly string[] {
  if (!rule) return [];
  switch (operatorOf(rule)) {
    case 'equals':
    case 'not_equals':
      return rule.optionCode ? [rule.optionCode] : [];
    case 'in':
      return [...new Set((rule.optionCodes ?? []).filter((code) => code !== ''))];
    default:
      return [];
  }
}

/**
 * Is the question behind `rule` shown, given the codes picked on its source question?
 *
 * `picked` is every code the applicant picked there — one for a single pick, several for a
 * multi pick, none when it is unanswered. `sourceInPool` is false when the source question is
 * not among the questions being asked (deleted, switched off, not asked in this loan type): the
 * rule DANGLES and never hides its question.
 */
export function gateOpen(
  rule: EnabledWhenLike | null | undefined,
  picked: readonly string[],
  sourceInPool = true,
): boolean {
  if (!rule?.questionCode) return true;
  const codes = ruleCodes(rule);
  if (codes.length === 0 || !sourceInPool) return true;
  const matches = picked.some((code) => codes.includes(code));
  switch (operatorOf(rule)) {
    case 'not_equals':
      return !matches;
    case 'equals':
    case 'in':
      return matches;
    default:
      return true;
  }
}
