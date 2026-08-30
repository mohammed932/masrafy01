/**
 * A pasted block of text → the rows a bulk create would write.
 *
 * PURE, and deliberately outside any component: the same posture `income-rule.rules.ts` takes.
 * A parser only exercisable by typing into a textarea is a parser nobody exercises, and every
 * interesting case here (a comma inside a name, an Arabic class label, a header row, a line
 * that is short by one column) is a case worth pinning in a spec.
 *
 * ── WHAT IT DOES NOT DO ───────────────────────────────────────────────────────
 * It does not mint the key that gets stored. The SERVER slugs `labelEn` and is the only
 * authority on codes — a client that could name the key would be a second one, which is the
 * trap `createQuestionWithOptions` refuses when it rejects `options` alongside
 * `optionsFromEnumerationType`. `slugify` is used here for ONE thing: deciding whether two
 * lines, or a line and an existing value, are the same row. Being the same function the
 * server slugs with is what makes "we think it is a duplicate" and "the key would collide"
 * one question rather than two that can disagree.
 */
import { slugify } from './slug';

/** How the columns are split. `auto` decides per DOCUMENT — see `chooseSeparator`. */
export type PasteSeparator = 'auto' | 'tab' | 'comma';

/**
 * What is true about one parsed line. A line can carry SEVERAL — a row with no Arabic name
 * that also names no class is both `noArabic` and `fallback` — which is why this is a list
 * and not an enum. Only `error` and `skipped` stop a row being written.
 */
export type PasteRowState =
  | 'ready'
  /** No class named, so it goes to the catch-all. Amber, counted, never silent. */
  | 'fallback'
  /** No Arabic label, so the English one is used for both. Amber, counted. */
  | 'noArabic'
  /** An earlier line in this same paste is the same row. */
  | 'duplicate'
  /** The list already holds this row. What a RE-PASTE looks like; not a problem. */
  | 'existing'
  /** Unusable as typed. Blocks the save. */
  | 'error'
  /** The operator took this line out by hand. */
  | 'skipped';

export interface PasteRow {
  /** 1-based line number in the pasted text — what the preview shows and an error names. */
  readonly line: number;
  /** The source line this row was parsed from. An overlay is dropped when this changes. */
  readonly raw: string;
  readonly labelEn: string;
  readonly labelAr: string;
  /** The resolved class KEY, or `null` when the row falls to the catch-all. */
  readonly classKey: string | null;
  /** What the operator actually typed in the class column — what the token fixer groups on. */
  readonly classToken: string;
  readonly states: readonly PasteRowState[];
  /** The comparison key: `slugify(labelEn)`. Not what gets stored — see the file header. */
  readonly slug: string;
  /** For `duplicate`: the earlier line this repeats. */
  readonly duplicateOf?: number;
}

/** One class, as the host supplies it. `key` is what a row resolves to. */
export interface PasteClass {
  readonly key: string;
  readonly labelEn: string;
  readonly labelAr: string;
}

export interface PasteParseInput {
  readonly text: string;
  readonly separator: PasteSeparator;
  /** Empty when the list has no parent axis — the parse then expects two columns, not three. */
  readonly classes: readonly PasteClass[];
  /** Where a row with no class named goes. `null` = the list has no catch-all. */
  readonly fallbackKey: string | null;
  /** Keys the list already holds, so a re-paste reports `existing` rather than writing twice. */
  readonly existingSlugs: ReadonlySet<string>;
  /** Line numbers the operator removed by hand. */
  readonly removedLines?: ReadonlySet<number>;
}

export interface PasteParseResult {
  readonly rows: readonly PasteRow[];
  /** The rows a save would actually send. */
  readonly importable: readonly PasteRow[];
  readonly counts: Readonly<Record<PasteRowState, number>>;
  /** Class names typed that resolve to nothing, grouped so ONE pick fixes every line. */
  readonly unknownTokens: readonly { token: string; lines: readonly number[] }[];
  /** What the separator actually resolved to — always stated on screen, never inferred silently. */
  readonly separator: 'tab' | 'comma';
  readonly headerSkipped: boolean;
  /** How many columns a line is expected to carry: 3 with a class axis, 2 without. */
  readonly columns: 2 | 3;
}

/** The server's cap. Mirrored so the screen can refuse before the request, not after. */
export const PASTE_MAX_ROWS = 500;

/** The server slugs at 60; this mirrors it so a very long name is judged the same both ends. */
const SLUG_CAP = 60;

const HEADER_WORDS: Readonly<Record<'en' | 'ar' | 'class', readonly string[]>> = {
  en: ['english', 'english name', 'en', 'name', 'الاسم بالإنجليزية'],
  ar: ['arabic', 'arabic name', 'ar', 'الاسم بالعربية', 'الاسم'],
  class: ['class', 'category', 'tier', 'الفئة', 'التصنيف'],
};

/**
 * Tab when the document contains one ANYWHERE, comma otherwise.
 *
 * Per DOCUMENT and not per line, deliberately. A spreadsheet paste is uniformly tabbed, and a
 * document with one stray tab is a document whose commas are inside labels. Deciding per line
 * would guess differently on adjacent lines with nothing on screen saying it had happened.
 *
 * Tab wins by default because copying a range out of Excel or Sheets is the actual workflow,
 * and it makes the commas-inside-a-name problem disappear: `Mivida, Phase 2` is one cell.
 */
function chooseSeparator(text: string, requested: PasteSeparator): 'tab' | 'comma' {
  if (requested !== 'auto') return requested;
  return text.includes('\t') ? 'tab' : 'comma';
}

/**
 * Split into at most `columns` fields, taking the LAST ones first.
 *
 * No CSV quoter, on purpose: quoting rules are the thing operators get wrong, and a half-quoted
 * paste fails in a way nobody can see. The class is the last field and the Arabic label the one
 * before it, so the English label is EVERYTHING before that — commas and all.
 *
 *   `Mivida, Phase 2,ميفيدا,AA` → `Mivida, Phase 2` · `ميفيدا` · `AA`
 *
 * Correct with no rules to learn, and it degrades honestly: a line with fewer fields than
 * expected is short, never mis-split.
 */
function splitFromEnd(line: string, sep: string, columns: number): string[] {
  const parts = line.split(sep);
  if (parts.length <= columns) return parts.map((p) => p.trim());
  // The head is rejoined from the RAW parts, not the trimmed ones: trimming first turns
  // `Mivida, Phase 2` into `Mivida,Phase 2` — the parser silently editing the operator's
  // name while claiming to preserve it.
  const cut = parts.length - (columns - 1);
  const head = parts.slice(0, cut).join(sep).trim();
  return [head, ...parts.slice(cut).map((p) => p.trim())];
}

function looksLikeHeader(fields: readonly string[]): boolean {
  const first = (fields[0] ?? '').toLowerCase();
  const second = (fields[1] ?? '').toLowerCase();
  return (
    HEADER_WORDS.en.includes(first) &&
    (fields.length < 2 || HEADER_WORDS.ar.includes(second) || HEADER_WORDS.class.includes(second))
  );
}

/**
 * Match a typed class name against the list, three passes, first match wins.
 *
 * Pass 3 is separate and load-bearing. `slugify` strips everything outside `[a-z0-9]`, so
 * `slugify('فئة أ')` is the empty string and EVERY Arabic class token would collide on it —
 * a bug that only ever appears in the Arabic build, which is the primary one. So the Arabic
 * label is compared as text, case-folded, and never slugged.
 */
function resolveClass(token: string, classes: readonly PasteClass[]): PasteClass[] {
  const trimmed = token.trim();
  if (trimmed === '') return [];
  const slug = slugify(trimmed);
  if (slug !== '') {
    const byKey = classes.filter((c) => slugify(c.key) === slug);
    if (byKey.length > 0) return byKey;
    const byEn = classes.filter((c) => slugify(c.labelEn) === slug);
    if (byEn.length > 0) return byEn;
  }
  const folded = trimmed.toLocaleLowerCase();
  return classes.filter((c) => c.labelAr.trim().toLocaleLowerCase() === folded);
}

const EMPTY_COUNTS: Record<PasteRowState, number> = {
  ready: 0,
  fallback: 0,
  noArabic: 0,
  duplicate: 0,
  existing: 0,
  error: 0,
  skipped: 0,
};

export function parsePastedValues(input: PasteParseInput): PasteParseResult {
  const separator = chooseSeparator(input.text, input.separator);
  const sep = separator === 'tab' ? '\t' : ',';
  const columns: 2 | 3 = input.classes.length > 0 ? 3 : 2;
  const removed = input.removedLines ?? new Set<number>();

  const rows: PasteRow[] = [];
  const counts: Record<PasteRowState, number> = { ...EMPTY_COUNTS };
  const unknown = new Map<string, number[]>();
  const seen = new Map<string, number>();
  let headerSkipped = false;

  const lines = input.text.split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    // A blank, whitespace-only or separator-only line is SKIPPED SILENTLY, not reported.
    // A trailing newline is how every text box ends and a spreadsheet paste often carries a
    // blank row; calling either an error would put a red count on a clean sheet.
    if (raw.trim() === '' || raw.split(sep).every((p) => p.trim() === '')) continue;

    const fields = splitFromEnd(raw, sep, columns);
    if (rows.length === 0 && !headerSkipped && looksLikeHeader(fields)) {
      headerSkipped = true;
      continue;
    }

    const states: PasteRowState[] = [];
    const labelEn = fields[0] ?? '';
    let labelAr = '';
    let classToken = '';

    if (columns === 3) {
      if (fields.length >= 3) {
        labelAr = fields[1] ?? '';
        classToken = fields[2] ?? '';
      } else if (fields.length === 2) {
        // AMBIGUOUS, resolved deterministically rather than guessed: if the second field
        // names a class it IS the class, otherwise it is the Arabic label. Either reading is
        // reported on the row, so the operator can see which one happened.
        const second = fields[1] ?? '';
        if (resolveClass(second, input.classes).length === 1) classToken = second;
        else labelAr = second;
      }
    } else if (fields.length >= 2) {
      labelAr = fields[1] ?? '';
    }

    if (fields.length > columns) {
      // Unreachable via `splitFromEnd`, which caps the count — kept as the explicit statement
      // that over-long lines are folded into the FIRST field, never truncated away.
      states.push('error');
    }

    let classKey: string | null = null;
    if (columns === 3) {
      if (classToken.trim() === '') {
        // MISSING is silence, and silence goes to the catch-all — amber and counted, never
        // hidden. Different from MISTYPED below: a name the operator typed that resolves to
        // nothing is a decision that went wrong, and sweeping it into the catch-all would
        // file a Class-B value at the catch-all figure with nothing on screen saying so.
        classKey = input.fallbackKey;
        states.push(classKey === null ? 'error' : 'fallback');
      } else {
        const matches = resolveClass(classToken, input.classes);
        if (matches.length === 1) classKey = matches[0]?.key ?? null;
        else {
          states.push('error');
          const at = unknown.get(classToken) ?? [];
          at.push(line);
          unknown.set(classToken, at);
        }
      }
    }

    if (labelEn.trim() === '') states.push('error');
    if (labelEn.length > 160 || labelAr.length > 160) states.push('error');
    if (labelAr.trim() === '') states.push('noArabic');

    const slug = slugify(labelEn).slice(0, SLUG_CAP);
    let duplicateOf: number | undefined;
    if (slug !== '') {
      const first = seen.get(slug);
      if (first !== undefined) {
        states.push('duplicate');
        duplicateOf = first;
      } else if (input.existingSlugs.has(slug)) {
        states.push('existing');
      } else {
        seen.set(slug, line);
      }
    }

    if (removed.has(line)) states.push('skipped');
    if (states.length === 0) states.push('ready');

    rows.push({
      line,
      raw,
      labelEn: labelEn.trim(),
      // The server refuses an empty `labelAr`, so the English name stands in. Counted amber
      // rather than applied silently: Principle IV is Arabic-primary, and an English string
      // showing up in the Arabic build has to be a thing the operator was told about.
      labelAr: labelAr.trim() === '' ? labelEn.trim() : labelAr.trim(),
      classKey,
      classToken,
      states,
      slug,
      ...(duplicateOf !== undefined ? { duplicateOf } : {}),
    });
    for (const state of states) counts[state] += 1;
  }

  const blocked: readonly PasteRowState[] = ['error', 'duplicate', 'existing', 'skipped'];
  const importable = rows.filter((r) => !r.states.some((s) => blocked.includes(s)));

  return {
    rows,
    importable,
    counts,
    unknownTokens: [...unknown.entries()].map(([token, lines]) => ({ token, lines })),
    separator,
    headerSkipped,
    columns,
  };
}
