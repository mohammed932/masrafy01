/**
 * The KIND registry, as a fake repository serves it.
 *
 * ONE copy, shared by every spec that builds a `PlatformEnumerationsAdminService` fake.
 * Three specs needed it the moment `parentTypeOf` / `childTypesOf` / the delete gate started
 * reading data instead of a constant, and three hand-rolled copies would be three chances to
 * disagree with the migration about which kinds have a parent axis — the one fact those specs
 * exist to exercise.
 *
 * The defaults mirror the registry as it stands after
 * `20260827090000_surrogate_product_authoring`: 12 live builtins plus the two compound kinds
 * it RETIRED, which are present and inactive rather than gone — the migration deactivates
 * them because values of them may survive and a kind cannot be deleted while they do.
 *
 * They are here, inactive, precisely so a spec cannot come to believe an inactive kind loses
 * its parent axis: `typeDefinitions()` returns them deliberately, and `factParentTable` goes
 * on walking a surviving value's class.
 *
 * The axis a spec should EXERCISE is `operatorAxisDefinitions()`, which is the truthful shape
 * now — a filed-under pair is something a PRODUCT authors on its own screen, never something
 * the platform ships. A spec that needs a different shape passes `extra`.
 */
import type {
  EnumerationTypeDefinition,
  EnumerationTypeDefinitions,
} from '@/platform-enumerations/platform-enumerations.repository';

/** Every field spelled out, so a new one on the interface fails here rather than silently. */
function def(
  key: string,
  overrides: Partial<EnumerationTypeDefinition> = {},
): EnumerationTypeDefinition {
  return {
    key,
    labelAr: key,
    labelEn: key,
    descriptionAr: null,
    descriptionEn: null,
    icon: null,
    exampleAr: null,
    exampleEn: null,
    parentTypeKey: null,
    deletable: false,
    onValuesRail: false,
    systemOnly: true,
    active: true,
    sortOrder: 0,
    ...overrides,
  };
}

/** The 7 kinds `20260826090000` seeds as deletable — the old `DELETABLE_TYPES`, verbatim. */
const DELETABLE = new Set([
  'program_name',
  'product_category',
  'required_document',
  'governorate',
  'employment_type',
  'transfer_type',
  'surrogate_fact',
]);

/** Retired by `20260827090000` — present and inactive, never deleted. See above. */
const RETIRED = new Set(['compound', 'compound_category']);

const BUILTIN_KEYS = [
  'transfer_type',
  'employment_type',
  'product_category',
  'required_document',
  'governorate',
  'compound_category',
  'compound',
  'military_grade',
  'professor_rank',
  'property_type',
  'company_type',
  'program_name',
  'surrogate_fact',
  'surrogate_product',
];

/**
 * The 14 kinds the registry holds, plus anything a spec adds.
 *
 * `extra` OVERWRITES a builtin of the same key rather than being ignored, so a spec can say
 * "in this world `governorate` HAS a parent axis" and have that be true.
 */
export function fakeTypeDefinitions(
  extra: readonly EnumerationTypeDefinition[] = [],
): EnumerationTypeDefinitions {
  const defs = new Map<string, EnumerationTypeDefinition>();
  BUILTIN_KEYS.forEach((key, index) => {
    defs.set(
      key,
      def(key, {
        deletable: DELETABLE.has(key),
        ...(RETIRED.has(key)
          ? { active: false, onValuesRail: false, systemOnly: false }
          : {}),
        parentTypeKey: key === 'compound' ? 'compound_category' : null,
        sortOrder: (index + 1) * 10,
      }),
    );
  });
  for (const one of extra) defs.set(one.key, one);
  return defs;
}

/**
 * A filed-under pair an operator authored: `district` filed under `district_class`.
 *
 * The shape the compound demo used to supply as a builtin. It is a fixture rather than a
 * builtin now because that is what the registry says: no kind the platform ships has a parent
 * axis, and every one that does was made on a product's own screen.
 */
export function operatorAxisDefinitions(): readonly EnumerationTypeDefinition[] {
  return [
    operatorTypeDefinition('district_class'),
    operatorTypeDefinition('district', { parentTypeKey: 'district_class' }),
  ];
}

/** A definition for a kind an operator invented — no code path names it. */
export function operatorTypeDefinition(
  key: string,
  overrides: Partial<EnumerationTypeDefinition> = {},
): EnumerationTypeDefinition {
  return def(key, { systemOnly: false, onValuesRail: true, deletable: true, ...overrides });
}
