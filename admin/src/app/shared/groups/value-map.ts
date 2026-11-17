/**
 * Answers read through ANOTHER list (v37.0.0).
 *
 * A method or product may read a choice question through any Manage values list: each answer
 * the customer can give is mapped to one value of that list (Colonel → "Senior officers"), and
 * the amounts are set per list value — or per group of list values. The engine never sees the
 * list: the mapping is saved as the product's own groups, so an answer finds its amount by its
 * code exactly as it does today.
 */
import type { TemplateGroup } from '@features/bank-programs/bank-programs.types';

export interface ListValue {
  code: string;
  labelEn: string;
  labelAr: string;
}

/** How an axis reads its answers through a list that is not the question's own. */
export interface ValueMapping {
  /** The list the answers are read through. */
  listType: string;
  /** Answer code → list value code. An answer missing here is unmapped. */
  map: Record<string, string>;
  /** One amount per list value, or per group of list values. */
  mappedAs: 'value' | 'group';
  /** Per group only: list value code → group key. */
  valueGroups?: Record<string, string>;
}

const GROUP_KEY = /^[a-z][a-z0-9_]{0,39}$/;

/** A list value's group key: the value code when it already is one, else a safe form of it. */
export function valueGroupKey(code: string): string {
  if (GROUP_KEY.test(code)) return code;
  const safe = code
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `v_${safe}`.slice(0, 40);
}

/** Per value: one group per list value an answer is mapped to, in the list's own order. */
export function valueGroups(values: readonly ListValue[], m: ValueMapping): TemplateGroup[] {
  const used = new Set(Object.values(m.map));
  return values
    .filter((v) => used.has(v.code))
    .map((v) => ({ key: valueGroupKey(v.code), labelEn: v.labelEn, labelAr: v.labelAr }));
}

/** Answer → group the engine reads it by: its value's group, or the value itself per value. */
export function composePlacements(m: ValueMapping): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [answer, value] of Object.entries(m.map)) {
    const group = m.mappedAs === 'group' ? m.valueGroups?.[value] : valueGroupKey(value);
    if (group) out[answer] = group;
  }
  return out;
}

/** The answers not mapped to any value yet. */
export function unmapped(answers: readonly { code: string }[], m: ValueMapping): string[] {
  return answers.filter((a) => m.map[a.code] === undefined).map((a) => a.code);
}

/** The starting map: each answer to the list value with the same code, or the same name. */
export function guessMap(
  answers: readonly { code: string; label: string }[],
  values: readonly ListValue[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const norm = (t: string) => t.trim().toLowerCase();
  for (const a of answers) {
    const hit =
      values.find((v) => v.code === a.code) ??
      values.find((v) => norm(v.labelEn) === norm(a.label) || norm(v.labelAr) === norm(a.label));
    if (hit) out[a.code] = hit.code;
  }
  return out;
}
