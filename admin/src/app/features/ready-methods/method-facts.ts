/**
 * What a ready method can read, and how one is described in a line — shared by the Ready
 * methods screens and the product page's "Use a ready method" picker, so both name a method
 * the same way.
 */
import { DERIVED_FACTS, derivedFactByKey } from '@core/surrogate-facts';
import type {
  MethodTemplate,
  RegistryFact,
  TemplateMechanismKind,
} from '@features/bank-programs/bank-programs.types';

export interface MethodOption {
  code: string;
  label: string;
}

/** A question a method can read: its answers, or that it is a number. */
export interface MethodFact {
  key: string;
  label: string;
  type: 'number' | 'choice';
  derived: boolean;
  options: readonly MethodOption[];
  /** The list's own groups (compound classes, city tiers), when it has them. */
  groups: readonly MethodOption[];
  /** The value list its answers come from — what own groups are filed in. */
  listType: string | null;
}

/** Every bound number or one-choice fact, then what the platform works out itself. */
export function methodFacts(facts: readonly RegistryFact[], isAr: boolean): MethodFact[] {
  const out: MethodFact[] = [];
  for (const f of facts) {
    const q = f.question;
    if (q === null || (q.type !== 'NUMERIC' && q.type !== 'SINGLE_SELECT')) continue;
    out.push({
      key: f.key,
      label: q.label?.trim() || f.label,
      type: q.type === 'NUMERIC' ? 'number' : 'choice',
      derived: false,
      options: (q.options ?? []).map((o) => ({
        code: o.code,
        label: isAr ? o.labelAr : o.labelEn,
      })),
      groups: (q.parentOptions ?? []).map((o) => ({
        code: o.code,
        label: isAr ? o.labelAr : o.labelEn,
      })),
      listType: q.optionsEnumerationType ?? null,
    });
  }
  for (const d of DERIVED_FACTS) {
    out.push({
      key: d.key,
      label: d.label,
      type: 'choice',
      derived: true,
      options: d.options.map((o) => ({ code: o.code, label: o.label })),
      groups: [],
      listType: null,
    });
  }
  return out;
}

export function howLabel(kind: TemplateMechanismKind): string {
  switch (kind) {
    case 'choiceTable':
      return $localize`:@@spt.v2.per_answer:One amount per answer`;
    case 'classTable':
      return $localize`:@@spt.v2.per_group:One amount per group`;
    case 'numberBand':
      return $localize`:@@spt.v2.by_ranges:By ranges`;
    case 'shareOf':
      return $localize`:@@spt.v2.pct_of_it:% of it`;
    case 'multipleOf':
      return $localize`:@@spt.v2.times:Multiplied by`;
    case 'dividedBy':
      return $localize`:@@spt.v2.divided:Divided by`;
    default:
      return '';
  }
}

/** "Which compound is your unit in? · One amount per group · columns: Topping up …". */
export function methodSummary(m: MethodTemplate, facts: readonly MethodFact[]): string {
  const name = (key: string) =>
    facts.find((f) => f.key === key)?.label ?? derivedFactByKey(key)?.label ?? key;
  const mech = m.mechanism;
  const first = mech.kind === 'flatAmount' ? '' : name(mech.fact);
  const parts = [first, howLabel(mech.kind)];
  if (mech.column) {
    const col = name(mech.column.fact);
    parts.push($localize`:@@rm.columns_by:columns by ${col}:NAME:`);
  }
  return parts.filter((p) => p !== '').join(' · ');
}

export function methodName(m: MethodTemplate, isAr: boolean): string {
  return (isAr ? m.labelAr : m.labelEn).trim() || m.labelEn;
}
