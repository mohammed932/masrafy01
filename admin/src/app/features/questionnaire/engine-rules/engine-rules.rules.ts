import type { AnswerEffectLevers } from '../answer-effect';
import type { EngineReader, EngineRuleQuestion } from './engine-rules.types';

/**
 * What the "Loan engine rules" screen sorts and shows — pure, so the page class holds signals
 * and nothing it would have to re-derive.
 */

// ---- What a question offers here --------------------------------------------------------------

/**
 * What the admin can DO with a question on this screen, which picks what its pane shows:
 *   - `reword`: it has answers, and they are reworded here;
 *   - `list`:   its answers ARE a Manage-values list, reworded there (read-only here);
 *   - `typed`:  the customer types a number or text, so there is no answer to reword.
 */
export type RuleGroup = 'reword' | 'list' | 'typed';

export function groupOf(q: EngineRuleQuestion): RuleGroup {
  if (q.options.length === 0) return 'typed';
  return q.mirroredList === null ? 'reword' : 'list';
}

/** The questions matching `search`, in the order given — the owner's, as the server sends it. */
export function filterRules(
  questions: readonly EngineRuleQuestion[],
  search: string,
): EngineRuleQuestion[] {
  return questions.filter((q) => matchesSearch(q, search));
}

/** How many of a question's answers state a number the wording has to keep. */
export function numberedAnswerCount(q: EngineRuleQuestion): number {
  return q.options.filter((o) => o.keep.en.length > 0 || o.keep.ar.length > 0).length;
}

// ---- What a question changes ----------------------------------------------------------------

/**
 * The parts of a quote a question can move. Derived from the server's structured readers —
 * each link below is a table or a sum in the engine (`cascade.evaluator.ts`, `dbr.ts`), not a
 * guess — so the admin sees WHERE an answer lands before rewording it. The installment is not
 * an area of its own: it follows from amount, rate and term, so it would light up everywhere.
 */
export type ImpactArea = 'amount' | 'rate' | 'term' | 'debt_limit' | 'questions' | 'application';

export const IMPACT_AREAS: readonly ImpactArea[] = [
  'amount',
  'rate',
  'term',
  'debt_limit',
  'questions',
  'application',
];

/** Why a question moves an area — one per reader, worded in `engine-rules.labels.ts`. */
export type ImpactWhy =
  | { kind: 'requested_amount' }
  | { kind: 'tenor_months' }
  | { kind: 'monthly_income' }
  | { kind: 'obligations' }
  | { kind: 'debt_types' }
  | { kind: 'employment_type' }
  | { kind: 'months_in_job' }
  | { kind: 'salary_transfer' }
  | { kind: 'platform_fact'; reader: Extract<EngineReader, { kind: 'platform_fact' }> }
  | { kind: 'programs'; count: number }
  | { kind: 'app_mapping' }
  | { kind: 'follow_ups'; answers: number }
  /** The admin set an offer effect on this many of its answers (v31.2.0). */
  | { kind: 'answer_effects'; answers: number };

export type QuestionImpact = ReadonlyMap<ImpactArea, readonly ImpactWhy[]>;

function readerImpact(r: EngineReader): [ImpactArea, ImpactWhy][] {
  switch (r.kind) {
    case 'money_input':
      switch (r.binding) {
        case 'requested_amount':
          return [['amount', { kind: 'requested_amount' }]];
        case 'tenor_months':
          return [
            ['term', { kind: 'tenor_months' }],
            ['rate', { kind: 'tenor_months' }],
          ];
        case 'monthly_income':
          return [
            ['amount', { kind: 'monthly_income' }],
            ['debt_limit', { kind: 'monthly_income' }],
          ];
        case 'existing_obligations':
          return [
            ['debt_limit', { kind: 'obligations' }],
            ['amount', { kind: 'obligations' }],
          ];
      }
      return [];
    case 'obligation_amount':
      return [
        ['debt_limit', { kind: 'obligations' }],
        ['amount', { kind: 'obligations' }],
      ];
    case 'debt_types':
      return [
        ['debt_limit', { kind: 'debt_types' }],
        ['questions', { kind: 'debt_types' }],
      ];
    case 'employment_type':
      return [
        ['rate', { kind: 'employment_type' }],
        ['term', { kind: 'employment_type' }],
        ['debt_limit', { kind: 'employment_type' }],
        ['amount', { kind: 'employment_type' }],
      ];
    case 'server_input':
      return r.input === 'months_in_job'
        ? [['rate', { kind: 'months_in_job' }]]
        : [
            ['rate', { kind: 'salary_transfer' }],
            ['amount', { kind: 'salary_transfer' }],
          ];
    case 'platform_fact':
      return [['amount', { kind: 'platform_fact', reader: r }]];
    case 'programs':
      return [['amount', { kind: 'programs', count: r.programNames.length }]];
    case 'app_mapping':
      return [['application', { kind: 'app_mapping' }]];
    case 'fixed_set':
      // Why it is asked, not what it moves.
      return [];
  }
}

const IMPACTS = new WeakMap<EngineRuleQuestion, QuestionImpact>();

/** Every area this question moves, each with why, in `IMPACT_AREAS` order. */
export function impactOf(q: EngineRuleQuestion): QuestionImpact {
  const cached = IMPACTS.get(q);
  if (cached !== undefined) return cached;
  const byArea = new Map<ImpactArea, ImpactWhy[]>();
  const add = (area: ImpactArea, why: ImpactWhy): void => {
    const list = byArea.get(area) ?? [];
    if (!list.some((w) => w.kind === why.kind)) list.push(why);
    byArea.set(area, list);
  };
  for (const r of q.readers) for (const [area, why] of readerImpact(r)) add(area, why);
  const branching = q.options.filter((o) =>
    o.meanings.some((m) => m.kind === 'opens' || m.kind === 'hides'),
  ).length;
  if (branching > 0) add('questions', { kind: 'follow_ups', answers: branching });
  // The admin's answer effects (v31.2.0): each lever moves its own area of the offer.
  const effects = q.options.flatMap((o) =>
    o.meanings.flatMap((m) => (m.kind === 'offer_effect' ? [m] : [])),
  );
  const leverArea: readonly [keyof AnswerEffectLevers, ImpactArea][] = [
    ['maxLoanPercent', 'amount'],
    ['ratePoints', 'rate'],
    ['maxTenorMonths', 'term'],
  ];
  for (const [lever, area] of leverArea) {
    const answers = effects.filter((m) => m[lever] !== undefined).length;
    if (answers > 0) add(area, { kind: 'answer_effects', answers });
  }
  const out = new Map<ImpactArea, readonly ImpactWhy[]>();
  for (const area of IMPACT_AREAS) {
    const list = byArea.get(area);
    if (list !== undefined) out.set(area, list);
  }
  IMPACTS.set(q, out);
  return out;
}

/** The areas that are the offer itself; `questions` and `application` are not. */
const OFFER_AREAS: readonly ImpactArea[] = ['amount', 'rate', 'term', 'debt_limit'];

/**
 * Whether the question's answer changes the offer today: it moves an offer area itself, or one
 * of its answers opens a question that does ("Do you get money from anywhere else?" changes the
 * offer exactly when a programme reads the amount it opens). A fixed question nothing reads yet
 * is asked and saved, and changes nothing — the list says so instead of implying otherwise.
 */
export function changesOffer(
  q: EngineRuleQuestion,
  byCode: ReadonlyMap<string, EngineRuleQuestion>,
  seen: Set<string> = new Set(),
): boolean {
  if (seen.has(q.code)) return false;
  seen.add(q.code);
  const impact = impactOf(q);
  if (OFFER_AREAS.some((area) => impact.has(area))) return true;
  return q.options.some((o) =>
    o.meanings.some(
      (m) =>
        m.kind === 'opens' &&
        m.questions.some((ref) => {
          const opened = byCode.get(ref.code);
          return opened !== undefined && changesOffer(opened, byCode, seen);
        }),
    ),
  );
}

// ---- Search ---------------------------------------------------------------------------------

export function matchesSearch(q: EngineRuleQuestion, search: string): boolean {
  const term = normalise(search);
  if (term === '') return true;
  return haystackOf(q).includes(term);
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
