import type { GroupTreeRow, QuestionRow } from '@features/questionnaire/questionnaire.api.service';
import type { AskableQuestion } from './asked-questions.rules';

/**
 * A pool row in the shape the board reasons about — ONE adapter for both hosts (the create
 * flow and the name's own page), which each carried a copy that had already begun to drift.
 *
 * The haystack is built ONCE per read rather than per keystroke: search runs on every
 * character over every question, and lower-casing every wording and answer inside the filter
 * is work repeated for nothing.
 */
export function toAskable(q: QuestionRow, group?: GroupTreeRow): AskableQuestion {
  const live = q.options.filter((o) => o.isActive);
  return {
    id: q.id,
    code: q.code,
    labelEn: q.questionEn,
    labelAr: q.questionAr,
    isActive: q.isActive,
    isRequired: q.isRequired,
    categories: q.categories,
    gateSourceCode: q.enabledWhen?.questionCode ?? null,
    haystack: [q.questionEn, q.questionAr, q.code, ...q.options.map((o) => o.labelEn)]
      .join(' ')
      .toLowerCase(),
    type: q.type,
    groupKey: group?.id ?? q.groupId,
    groupEn: group?.titleEn,
    groupAr: group?.titleAr,
    optionsEn: live.map((o) => o.labelEn),
    optionsAr: live.map((o) => o.labelAr || o.labelEn),
  };
}

/** The whole tree, flattened in section order with each question knowing its section. */
export function toAskablePool(tree: readonly GroupTreeRow[]): AskableQuestion[] {
  return tree.flatMap((g) => g.questions.map((q) => toAskable(q, g)));
}
