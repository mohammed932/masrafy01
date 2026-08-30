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
function repoOver(
  facts: Array<{ key: string; options: string[] }>,
  registry: Row[],
  /**
   * Declared parent AXES, by child type. `{}` = no kind declares one, which is the state
   * every case below the axis block exercises: provenance then falls back to the DATA walk
   * over the parents the options actually reference.
   */
  axes: Record<string, string> = {},
) {
  const types = [...new Set(registry.map((r) => r.type))];
  const prisma = {
    enumerationTypeDef: {
      findMany: vi.fn(async () =>
        types.map((key) => ({
          id: key,
          key,
          labelAr: key,
          labelEn: key,
          descriptionAr: null,
          descriptionEn: null,
          icon: null,
          exampleAr: null,
          exampleEn: null,
          parentTypeKey: axes[key] ?? null,
          fallbackParentKey: null,
          deletable: false,
          onValuesRail: true,
          systemOnly: false,
          active: true,
          sortOrder: 0,
          surrogateProductKey: null,
          mirrorQuestionId: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          createdBy: null,
          updatedBy: null,
        })),
      ),
    },
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
        // 3. every member of one list — what the AXIS pass reads once the child type
        //    declares a `parentTypeKey`.
        if (a.where?.type !== undefined && a.where.key === undefined) {
          return registry
            .filter((r) => r.type === a.where?.type)
            .map((r) => ({
              id: r.key,
              type: r.type,
              key: r.key,
              labelAr: r.labelAr ?? r.key,
              labelEn: r.labelEn ?? r.key,
              active: true,
              deprecatedAt: null,
              systemOnly: false,
              parentKey: r.parentKey ?? null,
              surrogateProductKey: null,
              sortOrder: 0,
              createdAt: new Date(0),
              updatedAt: new Date(0),
              loanCategories: [],
              boundQuestion: null,
            }));
        }
        // 4. the code -> {type,label} lookups (coverage, then parent labels)
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
  axes: Record<string, string> = {},
) {
  const members = await repoOver(facts, registry, axes).getActiveMembers('surrogate_fact' as never);
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

  it('reads the AXIS when the list declares one, even with nothing filed under it', async () => {
    // The state a product is authored IN: the classes exist, no value has been filed yet.
    // The data walk answers "no classes" here, and a picker filtering on that would hide the
    // class mechanism at exactly the moment the operator reached for it.
    const bound = await provenanceOf(
      [{ key: 'district_name', options: ['maadi', 'nasr_city'] }],
      [
        { key: 'district_class_a', type: 'district_class' },
        { key: 'district_class_b', type: 'district_class' },
        { key: 'maadi', type: 'district' },
        { key: 'nasr_city', type: 'district' },
      ],
      'district_name',
      { district: 'district_class' },
    );
    expect(bound?.parentAxisType).toBe('district_class');
    expect(bound?.parentEnumerationType).toBe('district_class');
    expect(bound?.parentOptions?.map((o) => o.code)).toEqual([
      'district_class_a',
      'district_class_b',
    ]);
  });

  it('offers EVERY class of the axis, not only the ones something is filed under', async () => {
    // Both values sit in class A. The bank must still be able to state a figure for B, and
    // "one class has no row" must be reachable for exactly the class that needs it.
    const bound = await provenanceOf(
      [{ key: 'district_name', options: ['maadi', 'nasr_city'] }],
      [
        { key: 'district_class_a', type: 'district_class' },
        { key: 'district_class_b', type: 'district_class' },
        { key: 'maadi', type: 'district', parentKey: 'district_class_a' },
        { key: 'nasr_city', type: 'district', parentKey: 'district_class_a' },
      ],
      'district_name',
      { district: 'district_class' },
    );
    expect(bound?.parentOptions?.map((o) => o.code)).toEqual([
      'district_class_a',
      'district_class_b',
    ]);
  });

  it('leaves parentAxisType unset for a list that declares none, and still walks the data', async () => {
    // The unchanged branch, and the guarantee that adding the axis pass moved no live fact:
    // `military_grade` and `professor_rank` declare no `parentTypeKey`.
    const bound = await provenanceOf(
      [{ key: 'district_name', options: ['maadi', 'nasr_city'] }],
      DISTRICTS,
      'district_name',
    );
    expect(bound?.parentAxisType).toBeUndefined();
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
