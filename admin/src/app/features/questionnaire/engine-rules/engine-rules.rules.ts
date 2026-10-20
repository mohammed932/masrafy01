import type { EngineRuleQuestion } from './engine-rules.types';

/**
 * What the "Loan engine rules" toolbar narrows by — pure, so the page class holds signals and
 * nothing it would have to re-derive.
 *
 * The WHO facet is not a partition: one question can be read by every quote AND sit in the
 * fixed set AND be read by bank programmes (I-Score is all three). Each facet therefore counts
 * the questions it would show, and "All" is the only one that adds up.
 */
export type WhoFilter = 'all' | 'engine' | 'base' | 'program';

export const WHO_FILTERS: readonly WhoFilter[] = ['all', 'engine', 'base', 'program'];

export interface RulesFilter {
  who: WhoFilter;
  /** Free text, matched against the code, both wordings and every answer. */
  search: string;
  /** Only questions with an answer whose wording states a quantity (`keep` non-empty). */
  numbersOnly: boolean;
}

export function isWhoFilter(value: string | null | undefined): value is WhoFilter {
  return value != null && (WHO_FILTERS as readonly string[]).includes(value);
}

export function matchesWho(q: EngineRuleQuestion, who: WhoFilter): boolean {
  switch (who) {
    case 'all':
      return true;
    case 'engine':
      return q.lock.reason === 'engine';
    case 'base':
      return q.lock.shapeFixed;
    case 'program':
      return q.readers.some((r) => r.kind === 'programs');
  }
}

/** An answer of this question states a number, or a word that scales or measures one. */
export function hasNumberedWording(q: EngineRuleQuestion): boolean {
  return q.options.some((o) => o.keep.en.length > 0 || o.keep.ar.length > 0);
}

export function matchesSearch(q: EngineRuleQuestion, search: string): boolean {
  const term = normalise(search);
  if (term === '') return true;
  return haystackOf(q).includes(term);
}

export function filterRules(
  questions: readonly EngineRuleQuestion[],
  filter: RulesFilter,
): EngineRuleQuestion[] {
  return questions.filter(
    (q) =>
      matchesWho(q, filter.who) &&
      matchesSearch(q, filter.search) &&
      (!filter.numbersOnly || hasNumberedWording(q)),
  );
}

/** How many questions each WHO facet would show under the other two filters. */
export function whoCounts(
  questions: readonly EngineRuleQuestion[],
  filter: Omit<RulesFilter, 'who'>,
): Record<WhoFilter, number> {
  const out: Record<WhoFilter, number> = { all: 0, engine: 0, base: 0, program: 0 };
  for (const who of WHO_FILTERS) {
    out[who] = filterRules(questions, { ...filter, who }).length;
  }
  return out;
}

const HAYSTACKS = new WeakMap<EngineRuleQuestion, string>();

function haystackOf(q: EngineRuleQuestion): string {
  const cached = HAYSTACKS.get(q);
  if (cached !== undefined) return cached;
  const parts = [q.code, q.questionEn, q.questionAr];
  for (const o of q.options) parts.push(o.code, o.labelEn, o.labelAr);
  const text = normalise(parts.join('\n'));
  HAYSTACKS.set(q, text);
  return text;
}

/** Case-folded, Arabic alef / ta-marbuta forms folded, so a search finds both spellings. */
function normalise(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}
