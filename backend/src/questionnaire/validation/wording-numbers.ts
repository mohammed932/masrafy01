/**
 * THE QUANTITIES IN A LOCKED QUESTION'S WORDING — what an admin may not change while rewording.
 *
 * WHY. The loan engine reads an answer's CODE, never its label, so a reworded label cannot change
 * a calculation by itself. It changes WHICH answer an applicant picks. `1_to_3_years` is read as
 * 24 months whatever it says; relabel it "18 months" and the applicant who has been in the job a
 * year and a half picks it and is quoted on 24. The quantities in the words are part of what the
 * answer MEANS, so on a question the engine reads (`engine-contract.ts`, the lock) they stay:
 * the words around them change freely, the quantities do not. The same holds for the question's
 * own text ("…issued more than 18 months ago?") and its helper text.
 *
 * WHAT COUNTS — closed and deliberately small:
 *   - every number written in DIGITS — ASCII, Arabic-Indic (U+0660–0669) or Persian
 *     (U+06F0–06F9) — as a MULTISET of canonical values: `6`, `٦` and `06` are one number;
 *     `100,000` and `١٠٠٬٠٠٠` are one number; `2.50` and `٢٫٥` are one number. A sign is never
 *     read (`10–20` is 10 and 20, not 10 and −20).
 *   - the English number words two … twelve ("One to two years" is a live label).
 *   - the words that SCALE or MEASURE a number — thousand / million / billion, year / month /
 *     week / day, percent (and `%`, `٪`) — as a SET: "1 – 3 million" → "1 – 3 thousand" and
 *     "6 months" → "6 years" are as wrong as 6 → 12, while "10% – 20%" → "10–20%" says the same.
 *   - an Arabic DUAL, which is a number and a unit in one word (سنتين = 2 years, مليونين = 2
 *     million).
 *
 * WHAT DOES NOT — documented limits, each chosen to keep a refusal from firing on a reword that
 * means the same:
 *   - "one" (a pronoun in live text: "a government one", "if you have one") and the Arabic
 *     cardinals (الاثنان is "both"; ست is also "lady", as in ست بيت).
 *   - عام on its own (it is "public" in قطاع عام); عامًا, أعوام and عامين are years.
 *   - currency words (every figure is EGP) and adjectives (monthly, شهري).
 *   - a different way of grouping digits ("1,000,000" → "1.000.000" reads as other numbers).
 *
 * Arabic words are matched after normalising: harakat (U+064B–065F, U+0670) and tatweel
 * (U+0640) dropped, أ/إ/آ/ٱ → ا, ة → ه, ى → ي; then as written, or with one leading و/ف/ب/ل/ك,
 * ال, both, or لل taken off (والسنة, بالمئة, للسنة). English words are matched lower-cased.
 *
 * Pure and dependency-free: the questionnaire's engine contract judges every write with it and
 * the engine-rules view tells the admin, per answer, what has to stay.
 */

/** What a wording states, three ways. */
export interface WordingQuantities {
  /** Canonical numbers, sorted — a multiset (`"10% – 20%"` → `['10', '20']`). */
  readonly numbers: readonly string[];
  /** Canonical units and magnitudes, sorted, each once — a set (`['million']`). */
  readonly units: readonly string[];
  /** Every number and the first of each unit, as WRITTEN, in reading order — for a message. */
  readonly written: readonly string[];
}

const NONE: WordingQuantities = { numbers: [], units: [], written: [] };

/** ASCII, Arabic-Indic and Persian digits. */
const DIGIT = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]';

/**
 * A number as written: digits grouped in threes by `,` / `٬` (only when exactly three digits
 * follow every separator), or a plain run; either may carry a decimal part after `.` / `٫`.
 */
const NUMBER = new RegExp(
  `${DIGIT}{1,3}(?:[,\\u066C]${DIGIT}{3})+(?!${DIGIT})(?:[.\\u066B]${DIGIT}+)?` +
    `|${DIGIT}+(?:[.\\u066B]${DIGIT}+)?`,
  'gu',
);

/** The percent signs, Latin and Arabic. */
const PERCENT_SIGN = /[%٪]/gu;

/** A word: letters and the marks written on them (harakat stay inside the word). */
const WORD = /[\p{L}\p{M}]+/gu;

type Unit = 'year' | 'month' | 'week' | 'day' | 'percent' | 'thousand' | 'million' | 'billion';

interface Meaning {
  /** Canonical numbers the word states. */
  readonly numbers: readonly string[];
  readonly unit: Unit | null;
}

const unit = (u: Unit): Meaning => ({ numbers: [], unit: u });
const dual = (u: Unit): Meaning => ({ numbers: ['2'], unit: u });
const cardinal = (n: number): Meaning => ({ numbers: [String(n)], unit: null });

const ENGLISH: ReadonlyMap<string, Meaning> = new Map<string, Meaning>([
  ...['year', 'years'].map((w) => [w, unit('year')] as const),
  ...['month', 'months'].map((w) => [w, unit('month')] as const),
  ...['week', 'weeks'].map((w) => [w, unit('week')] as const),
  ...['day', 'days'].map((w) => [w, unit('day')] as const),
  ['percent', unit('percent')],
  ...['thousand', 'thousands'].map((w) => [w, unit('thousand')] as const),
  ...['million', 'millions'].map((w) => [w, unit('million')] as const),
  ...['billion', 'billions'].map((w) => [w, unit('billion')] as const),
  ...(
    [
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
      'eleven',
      'twelve',
    ] as const
  ).map((w, i) => [w, cardinal(i + 2)] as const),
]);

/** Arabic words in their NORMALISED spelling (see `normaliseArabic`). */
const ARABIC: ReadonlyMap<string, Meaning> = new Map<string, Meaning>([
  ...['سنه', 'سنوات', 'سنين', 'اعوام', 'عاما'].map((w) => [w, unit('year')] as const),
  ...['سنتين', 'سنتان', 'عامين', 'عامان'].map((w) => [w, dual('year')] as const),
  ...['شهر', 'اشهر', 'شهور', 'شهرا'].map((w) => [w, unit('month')] as const),
  ...['شهرين', 'شهران'].map((w) => [w, dual('month')] as const),
  ...['اسبوع', 'اسابيع', 'اسبوعا'].map((w) => [w, unit('week')] as const),
  ...['اسبوعين', 'اسبوعان'].map((w) => [w, dual('week')] as const),
  ...['يوم', 'ايام', 'يوما'].map((w) => [w, unit('day')] as const),
  ...['يومين', 'يومان'].map((w) => [w, dual('day')] as const),
  ...['المئه', 'المائه'].map((w) => [w, unit('percent')] as const),
  ...['الف', 'الاف'].map((w) => [w, unit('thousand')] as const),
  ...['الفين', 'الفان'].map((w) => [w, dual('thousand')] as const),
  ...['مليون', 'ملايين'].map((w) => [w, unit('million')] as const),
  ...['مليونين', 'مليونان'].map((w) => [w, dual('million')] as const),
  ...['مليار', 'مليارات'].map((w) => [w, unit('billion')] as const),
  ...['مليارين', 'ملياران'].map((w) => [w, dual('billion')] as const),
]);

const ARABIC_CLITICS = ['و', 'ف', 'ب', 'ل', 'ك'];

/** Everything a wording states, or nothing for an empty / absent one. */
export function wordingQuantities(text: string | null | undefined): WordingQuantities {
  if (text === null || text === undefined || text.trim() === '') return NONE;

  const found: { index: number; written: string; numbers: readonly string[]; unit: Unit | null }[] =
    [];
  for (const m of text.matchAll(NUMBER)) {
    found.push({
      index: m.index ?? 0,
      written: m[0],
      numbers: [canonicalNumber(m[0])],
      unit: null,
    });
  }
  for (const m of text.matchAll(PERCENT_SIGN)) {
    found.push({ index: m.index ?? 0, written: m[0], numbers: [], unit: 'percent' });
  }
  for (const m of text.matchAll(WORD)) {
    const meaning = meaningOf(m[0]);
    if (meaning !== undefined) {
      found.push({ index: m.index ?? 0, written: m[0], ...meaning });
    }
  }
  found.sort((a, b) => a.index - b.index);

  const numbers: string[] = [];
  const units = new Set<Unit>();
  const written: string[] = [];
  for (const token of found) {
    numbers.push(...token.numbers);
    // A unit is a SET member: it is written out once, at its first appearance; a token that
    // also states a number (a dual, a cardinal, a digit run) is always written out.
    const newUnit = token.unit !== null && !units.has(token.unit);
    if (token.unit !== null) units.add(token.unit);
    if (token.numbers.length > 0 || newUnit) written.push(token.written);
  }
  return { numbers: numbers.sort(), units: [...units].sort(), written };
}

/** Whether two wordings state the same quantities: the same numbers, as often, and units. */
export function sameQuantities(a: WordingQuantities, b: WordingQuantities): boolean {
  return sameList(a.numbers, b.numbers) && sameList(a.units, b.units);
}

/** The quantities as one message fragment: `6 · months`, or `—` when there are none. */
export function quantitiesForMessage(written: readonly string[]): string {
  return written.length === 0 ? '—' : written.join(' · ');
}

/** A wording quoted in a message, cut to `max` characters. */
export function clipForMessage(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

// ---- internals ------------------------------------------------------------------------------

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** A digit run → ASCII, separators dropped, `٫` → `.`, leading / trailing zeros trimmed. */
function canonicalNumber(written: string): string {
  let ascii = '';
  for (const ch of written) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0660 && cp <= 0x0669) ascii += String(cp - 0x0660);
    else if (cp >= 0x06f0 && cp <= 0x06f9) ascii += String(cp - 0x06f0);
    else if (ch === ',' || ch === '٬') continue;
    else if (ch === '٫') ascii += '.';
    else ascii += ch;
  }
  const [whole = '', fraction = ''] = ascii.split('.');
  const integer = whole.replace(/^0+(?=\d)/, '');
  const decimals = fraction.replace(/0+$/, '');
  return decimals === '' ? integer : `${integer}.${decimals}`;
}

function meaningOf(word: string): Meaning | undefined {
  const english = ENGLISH.get(word.toLowerCase());
  if (english !== undefined) return english;
  const arabic = normaliseArabic(word);
  for (const candidate of arabicCandidates(arabic)) {
    const meaning = ARABIC.get(candidate);
    if (meaning !== undefined) return meaning;
  }
  return undefined;
}

function normaliseArabic(word: string): string {
  return word
    .replace(/[ً-ٰٟـ]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/ى/gu, 'ي');
}

/** The word as written, then with one clitic, `ال`, both, or `لل` taken off — never shorter than 2. */
function arabicCandidates(word: string): string[] {
  const out = [word];
  const first = word.charAt(0);
  if (ARABIC_CLITICS.includes(first)) out.push(word.slice(1));
  if (word.startsWith('ال')) out.push(word.slice(2));
  if (ARABIC_CLITICS.includes(first) && word.slice(1).startsWith('ال')) out.push(word.slice(3));
  if (word.startsWith('لل')) out.push(word.slice(2));
  return out.filter((candidate) => candidate.length >= 2);
}
