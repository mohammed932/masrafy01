/**
 * Opening a CSV, and writing one back out (spec §8).
 *
 * The two are one feature: what the values panel writes must be what the paste screen can
 * read, or an operator who exports a list to fix a hundred Arabic labels in a spreadsheet
 * cannot get it back in. Both sides are pure string work, so both are pinned here — the file
 * plumbing around them (`FileReader`, `Blob`) is browser API with nothing to assert.
 *
 * The normalisation the file path performs before handing text to the parser is copied here
 * from `PasteValuesFormComponent.openFile`. Kept as a local helper on purpose: the component
 * is not constructible without a DOM, and what matters is that the PARSER, unchanged, reads
 * what a real export produces.
 */
import { describe, expect, it } from 'vitest';
import {
  parsePastedValues,
  type PasteClass,
} from '../src/app/shared/lookups/parse-pasted-values';

const CLASSES: PasteClass[] = [
  { key: 'compound_tier_aa', labelEn: 'Class AA', labelAr: 'الفئة AA' },
  { key: 'compound_tier_other', labelEn: 'Other', labelAr: 'أخرى' },
];

/** What `openFile` does to a file's text before the parser sees it. */
function normalizeFileText(raw: string): string {
  return raw
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '');
}

/**
 * What `exportCsv` writes for one row — no quoter, matching the parser (which has none and
 * splits from the end), with a separator inside the two TRAILING fields replaced by a space.
 */
function exportRow(labelEn: string, labelAr: string, className: string): string {
  const cell = (v: string): string => v.replace(/,/g, ' ').trim();
  return [labelEn.trim(), cell(labelAr), cell(className)].join(',');
}

function parse(text: string) {
  return parsePastedValues({
    text,
    separator: 'auto',
    classes: CLASSES,
    fallbackKey: 'compound_tier_other',
    existingSlugs: new Set<string>(),
  });
}

describe('opening a CSV file', () => {
  it('strips the BOM Excel writes in an Arabic locale', () => {
    // Without this the first label is "﻿Mivida" and the KEY slugged from it is wrong —
    // silently, and only on the first row of the file.
    const text = normalizeFileText('﻿Mivida,ميفيدا,Class AA\n');
    const rows = parse(text).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.labelEn).toBe('Mivida');
    expect(rows[0]?.slug).toBe('mivida');
  });

  it('reads a Windows sheet with CRLF endings as rows, not as one line', () => {
    const text = normalizeFileText('Mivida,ميفيدا,Class AA\r\nSodic East,سوديك إيست,Other\r\n');
    expect(parse(text).rows).toHaveLength(2);
  });

  it('does not read a trailing newline as an empty row', () => {
    const text = normalizeFileText('Mivida,ميفيدا,Class AA\n\n');
    expect(parse(text).rows).toHaveLength(1);
  });
});

describe('the export the paste screen reads back', () => {
  it('round-trips a label holding the separator itself', () => {
    // "Mivida, Phase 2" is why every field is quoted: unquoted, it becomes two columns and
    // the Arabic label lands in the class column.
    const line = exportRow('Mivida, Phase 2', 'ميفيدا المرحلة ٢', 'Class AA');
    const row = parse(normalizeFileText(line)).rows[0];
    expect(row?.labelEn).toBe('Mivida, Phase 2');
    expect(row?.labelAr).toBe('ميفيدا المرحلة ٢');
    expect(row?.classKey).toBe('compound_tier_aa');
  });

  it('leaves a quote in a label alone, because neither side runs a quoter', () => {
    const line = exportRow('The "Village"', 'الڤيلدج', 'Other');
    const row = parse(normalizeFileText(line)).rows[0];
    expect(row?.labelEn).toBe('The "Village"');
  });

  it('writes the class LABEL, which the parser matches as readily as the key', () => {
    const byLabel = parse(normalizeFileText(exportRow('Mivida', 'ميفيدا', 'Class AA'))).rows[0];
    const byKey = parse(
      normalizeFileText(exportRow('Mivida', 'ميفيدا', 'compound_tier_aa')),
    ).rows[0];
    expect(byLabel?.classKey).toBe('compound_tier_aa');
    expect(byKey?.classKey).toBe('compound_tier_aa');
  });

  it('reads a row with no class as the catch-all, never as unfiled', () => {
    // §8.4: a value with no class quotes NOTHING at every bank keying off the class, and it
    // fails silently on a customer. The parser resolves the blank column to the list's own
    // catch-all and flags the row, so the operator sees which lines were filed for them.
    const row = parse(normalizeFileText(exportRow('Mivida', 'ميفيدا', ''))).rows[0];
    expect(row?.classKey).toBe('compound_tier_other');
    expect(row?.states).toContain('fallback');
  });
});
