/**
 * Which operator-managed LIST a bound question's options came from — derived on read,
 * never stored.
 *
 * This is what lets a screen say "this product reads the district list, and those are
 * filed under district classes" without any product knowledge in the client. Getting it
 * wrong is not cosmetic: the answer decides which list an operator is sent to when a
 * value is missing, and sending them to the wrong one means the fix they make does
 * nothing.
 *
 * The bar is COVERAGE OF ALL OPTIONS, and both ways of falling short must resolve to
 * "unknown" rather than to a guess:
 *   · an option that is no list's member  → the question is hand-authored
 *   · two lists that both cover it        → ambiguous, and picking one is a coin flip
 *     rendered as a fact
 */
import { describe, expect, it, vi } from 'vitest';
import { PostgresPlatformEnumerationsRepository } from '@/platform-enumerations/postgres-platform-enumerations.repository';

interface Row {
  key: string;
  type: string;
  parentKey?: string | null;
  labelAr?: string;
  labelEn?: string;
}

/**
 * Drives the real `getActiveMembers` for the fact type. Three different `findMany` shapes
 * are served off one row table, keyed by what the call selects — the same rows the real
 * queries would return.
 */
function repoOver(facts: Array<{ key: string; options: string[] }>, registry: Row[]) {
  const prisma = {
    platformEnumeration: {
      findMany: vi.fn(async (args: Record<string, never>) => {
        const a = args as unknown as {
          where?: { type?: string; key?: { in: string[] }; parentKey?: unknown };
          select?: Record<string, boolean>;
        };
        // 1. the fact rows themselves
        if (a.where?.type === 'surrogate_fact') {
          return facts.map((f) => ({
            id: f.key,
            type: 'surrogate_fact',
            key: f.key,
            labelAr: f.key,
            labelEn: f.key,
            active: true,
            deprecatedAt: null,
            systemOnly: false,
            parentKey: null,
            surrogateProductKey: null,
            sortOrder: 0,
            createdAt: new Date(0),
            updatedAt: new Date(0),
            loanCategories: [],
            boundQuestion: {
              id: f.key,
              code: f.key,
              type: 'SINGLE_SELECT',
              questionAr: f.key,
              questionEn: f.key,
              isActive: true,
              options: f.options.map((code) => ({ code, labelAr: code, labelEn: code })),
              loanCategories: [],
            },
          }));
        }
        // 2. the flat parentKey map
        if (a.where?.parentKey !== undefined) {
          return registry.filter((r) => r.parentKey != null).map((r) => ({ key: r.key, parentKey: r.parentKey }));
        }
        // 3. the code -> {type,label} lookups (coverage, then parent labels)
        const wanted = new Set(a.where?.key?.in ?? []);
        return registry
          .filter((r) => wanted.has(r.key))
          .map((r) => ({ key: r.key, type: r.type, labelAr: r.labelAr ?? r.key, labelEn: r.labelEn ?? r.key }));
      }),
    },
  };
  return new PostgresPlatformEnumerationsRepository(prisma as never);
}

const DISTRICTS: Row[] = [
  { key: 'district_class_a', type: 'district_class' },
  { key: 'district_class_b', type: 'district_class' },
  { key: 'maadi', type: 'district', parentKey: 'district_class_a' },
  { key: 'nasr_city', type: 'district', parentKey: 'district_class_b' },
];

async function provenanceOf(
  facts: Array<{ key: string; options: string[] }>,
  registry: Row[],
  key: string,
) {
  const members = await repoOver(facts, registry).getActiveMembers('surrogate_fact' as never);
  return members.find((m) => m.key === key)?.boundQuestion;
}

describe('option provenance', () => {
  it('names the list the options came from, and the list those are filed under', async () => {
    const bound = await provenanceOf(
      [{ key: 'district_name', options: ['maadi', 'nasr_city'] }],
      DISTRICTS,
      'district_name',
    );
    expect(bound?.optionsEnumerationType).toBe('district');
    expect(bound?.parentEnumerationType).toBe('district_class');
  });

  it('names a flat list with no parent axis, and leaves the parent unset', async () => {
    // Generic, not district-specific — this falls out for free and is why the product
    // screen needs no product knowledge.
    const bound = await provenanceOf(
      [{ key: 'military_grade', options: ['officer', 'nco'] }],
      [
        { key: 'officer', type: 'military_grade' },
        { key: 'nco', type: 'military_grade' },
      ],
      'military_grade',
    );
    expect(bound?.optionsEnumerationType).toBe('military_grade');
    expect(bound?.parentEnumerationType).toBeUndefined();
  });

  it('reports nothing for a hand-authored question', async () => {
    // A yes/no question is not backed by a list. `undefined` is what the admin renders as
    // "this fact reads no operator-managed list", rather than an empty list to edit.
    const bound = await provenanceOf(
      [{ key: 'district_multi_unit', options: ['yes', 'no'] }],
      DISTRICTS,
      'district_multi_unit',
    );
    expect(bound?.optionsEnumerationType).toBeUndefined();
  });

  it('reports nothing when only SOME options are members', async () => {
    // Partial coverage is the case where an answer has no row in the list. Naming the
    // list would tell the operator the missing value is editable there; it is not.
    const bound = await provenanceOf(
      [{ key: 'district_name', options: ['maadi', 'not_a_row'] }],
      DISTRICTS,
      'district_name',
    );
    expect(bound?.optionsEnumerationType).toBeUndefined();
  });

  it('reports nothing when two lists both cover every option', async () => {
    // `key` is unique per TYPE, so one code can live in two lists. Picking one would be a
    // coin flip rendered as a fact.
    const bound = await provenanceOf(
      [{ key: 'ambiguous', options: ['shared_code'] }],
      [
        { key: 'shared_code', type: 'district' },
        { key: 'shared_code', type: 'property_type' },
      ],
      'ambiguous',
    );
    expect(bound?.optionsEnumerationType).toBeUndefined();
  });

  it('resolves each fact independently in one pass', async () => {
    const members = await repoOver(
      [
        { key: 'district_name', options: ['maadi', 'nasr_city'] },
        { key: 'district_multi_unit', options: ['yes', 'no'] },
      ],
      DISTRICTS,
    ).getActiveMembers('surrogate_fact' as never);
    const byKey = new Map(members.map((m) => [m.key, m.boundQuestion]));
    expect(byKey.get('district_name')?.optionsEnumerationType).toBe('district');
    expect(byKey.get('district_multi_unit')?.optionsEnumerationType).toBeUndefined();
  });
});
