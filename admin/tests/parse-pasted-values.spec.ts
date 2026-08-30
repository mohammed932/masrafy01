/**
 * The paste parser.
 *
 * Every case here is one an operator will actually hit with a spreadsheet of Egyptian
 * compounds, and several of them only ever go wrong in the Arabic build — which is the
 * primary one, and the one a developer reading LTR never sees.
 */
import { describe, expect, it } from 'vitest';
import {
  parsePastedValues,
  type PasteClass,
} from '../src/app/shared/lookups/parse-pasted-values';

const CLASSES: PasteClass[] = [
  { key: 'compound_tier_aa', labelEn: 'Class AA', labelAr: 'الفئة AA' },
  { key: 'compound_tier_a', labelEn: 'Class A', labelAr: 'الفئة أ' },
  { key: 'compound_tier_other', labelEn: 'Other', labelAr: 'أخرى' },
];

function parse(text: string, over: Partial<Parameters<typeof parsePastedValues>[0]> = {}) {
  return parsePastedValues({
    text,
    separator: 'auto',
    classes: CLASSES,
    fallbackKey: 'compound_tier_other',
    existingSlugs: new Set<string>(),
    ...over,
  });
}

describe('separator', () => {
  it('reads the whole document as tabbed when any line carries a tab', () => {
    // Per DOCUMENT, not per line: a spreadsheet paste is uniformly tabbed, and a document
    // with one stray tab is one whose commas are inside labels.
    const r = parse('Mivida, Phase 2\tميفيدا\tClass AA\nPalm Hills\tبالم\tClass A');
    expect(r.separator).toBe('tab');
    expect(r.rows[0]?.labelEn).toBe('Mivida, Phase 2');
  });

  it('falls back to comma, and keeps commas inside the English name', () => {
    // The reason there is no CSV quoter: the class is the LAST field and the Arabic label the
    // one before it, so everything before that is the name — commas and all.
    const r = parse('Mivida, Phase 2,ميفيدا,Class AA');
    expect(r.separator).toBe('comma');
    expect(r.rows[0]?.labelEn).toBe('Mivida, Phase 2');
    expect(r.rows[0]?.labelAr).toBe('ميفيدا');
    expect(r.rows[0]?.classKey).toBe('compound_tier_aa');
  });

  it('honours an explicit choice over what it would have guessed', () => {
    const r = parse('a\tb,c', { separator: 'comma' });
    expect(r.separator).toBe('comma');
  });
});

describe('class resolution', () => {
  it('matches a class by key, by English label and by ARABIC label', () => {
    // The Arabic pass is separate and load-bearing: `slugify` strips everything outside
    // [a-z0-9], so slugify('الفئة أ') is '' and every Arabic token would collide on it.
    const r = parse(
      [
        'One,واحد,compound_tier_aa',
        'Two,اثنان,Class AA',
        'Three,ثلاثة,class-aa',
        'Four,أربعة,الفئة أ',
      ].join('\n'),
    );
    expect(r.rows.map((x) => x.classKey)).toEqual([
      'compound_tier_aa',
      'compound_tier_aa',
      'compound_tier_aa',
      'compound_tier_a',
    ]);
  });

  it('sends a MISSING class to the catch-all, amber and counted', () => {
    const r = parse('Nowhere,لا مكان,');
    expect(r.rows[0]?.classKey).toBe('compound_tier_other');
    expect(r.rows[0]?.states).toContain('fallback');
    expect(r.counts.fallback).toBe(1);
    expect(r.importable).toHaveLength(1);
  });

  it('treats a MISTYPED class as an error, never as the catch-all', () => {
    // The distinction the whole design turns on. Sweeping `Clsss B` into the catch-all files
    // a Class-B value at the catch-all figure with nothing on screen saying so.
    const r = parse('Somewhere,مكان,Clsss B');
    expect(r.rows[0]?.states).toContain('error');
    expect(r.importable).toHaveLength(0);
    expect(r.unknownTokens).toEqual([{ token: 'Clsss B', lines: [1] }]);
  });

  it('groups every line sharing one unknown spelling, so ONE pick fixes them all', () => {
    const r = parse(['A,أ,Clsss B', 'B,ب,Clsss B', 'C,ج,Clsss B'].join('\n'));
    expect(r.unknownTokens).toEqual([{ token: 'Clsss B', lines: [1, 2, 3] }]);
  });
});

describe('column count', () => {
  it('reads a two-field line as name + class when the second field IS a class', () => {
    const r = parse('Mivida,Class AA');
    expect(r.rows[0]?.classKey).toBe('compound_tier_aa');
    expect(r.rows[0]?.states).toContain('noArabic');
  });

  it('reads a two-field line as name + Arabic when the second field is not a class', () => {
    const r = parse('Mivida,ميفيدا');
    expect(r.rows[0]?.labelAr).toBe('ميفيدا');
    expect(r.rows[0]?.classKey).toBe('compound_tier_other');
    expect(r.rows[0]?.states).toContain('fallback');
  });

  it('expects two columns, not three, for a list with no class axis', () => {
    const r = parse('Cairo,القاهرة', { classes: [], fallbackKey: null });
    expect(r.columns).toBe(2);
    expect(r.rows[0]?.classKey).toBeNull();
    expect(r.rows[0]?.states).toEqual(['ready']);
  });

  it('falls back on the English name for a missing Arabic one, and counts it', () => {
    // Never blocks — re-pasting 400 lines because 37 lack Arabic is worse than fixing 37
    // labels later. But it is stated, because Principle IV is Arabic-primary.
    const r = parse('Mivida,,Class AA');
    expect(r.rows[0]?.labelAr).toBe('Mivida');
    expect(r.counts.noArabic).toBe(1);
    expect(r.importable).toHaveLength(1);
  });
});

describe('duplicates', () => {
  it('names the earlier line a repeat collides with', () => {
    const r = parse(['Rehab,الرحاب,Class A', 'Obour,العبور,Class A', 'rehab,الرحاب,Class AA'].join('\n'));
    expect(r.rows[2]?.states).toContain('duplicate');
    expect(r.rows[2]?.duplicateOf).toBe(1);
    expect(r.importable.map((x) => x.line)).toEqual([1, 2]);
  });

  it('reports a row the list already holds as existing, not as an error', () => {
    // What a RE-PASTE looks like, and the reason the second paste of a sheet is free.
    const r = parse('Mivida,ميفيدا,Class AA', { existingSlugs: new Set(['mivida']) });
    expect(r.rows[0]?.states).toContain('existing');
    expect(r.counts.error).toBe(0);
    expect(r.importable).toHaveLength(0);
  });
});

describe('noise', () => {
  it('skips blank, whitespace-only and separator-only lines silently', () => {
    // A trailing newline is how every text box ends; calling it an error puts a red count on
    // a clean sheet.
    const r = parse('Mivida,ميفيدا,Class AA\n\n   \n,,\nPalm,بالم,Class A\n');
    expect(r.rows).toHaveLength(2);
    expect(r.counts.error).toBe(0);
  });

  it('drops a header row and says so', () => {
    const r = parse('English name,Arabic name,Class\nMivida,ميفيدا,Class AA');
    expect(r.headerSkipped).toBe(true);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.line).toBe(2);
  });

  it('drops an ARABIC header row too', () => {
    const r = parse('الاسم بالإنجليزية,الاسم بالعربية,الفئة\nMivida,ميفيدا,Class AA');
    expect(r.headerSkipped).toBe(true);
    expect(r.rows).toHaveLength(1);
  });

  it('does not mistake a real first row for a header', () => {
    const r = parse('Mivida,ميفيدا,Class AA');
    expect(r.headerSkipped).toBe(false);
    expect(r.rows).toHaveLength(1);
  });

  it('refuses a name longer than the server will take', () => {
    const r = parse(`${'x'.repeat(161)},اسم,Class AA`);
    expect(r.rows[0]?.states).toContain('error');
  });

  it('keeps 1-based line numbers through skipped lines', () => {
    const r = parse('\n\nMivida,ميفيدا,Class AA');
    expect(r.rows[0]?.line).toBe(3);
  });

  it('takes a removed line out of the import and counts it', () => {
    const r = parse(['A,أ,Class A', 'B,ب,Class A'].join('\n'), { removedLines: new Set([1]) });
    expect(r.counts.skipped).toBe(1);
    expect(r.importable.map((x) => x.line)).toEqual([2]);
  });
});

describe('the catch-all is not assumed', () => {
  it('errors on a missing class when the list declares no catch-all', () => {
    // Without one there is nowhere honest to put the row, and picking a class would be the
    // client stating a price tier.
    const r = parse('Nowhere,لا مكان,', { fallbackKey: null });
    expect(r.rows[0]?.states).toContain('error');
    expect(r.importable).toHaveLength(0);
  });
});
