/**
 * The plan for making a question's options BE a registry list.
 *
 * Pure, and separate from the repository for the usual reason: the interesting half is the
 * DIFF — what gets resurrected, what gets retired, what order everything ends up in — and a
 * diff that can only be exercised through a Prisma transaction is a diff nobody exercises.
 *
 * The one invariant this whole seam exists to hold: `question_option.code` ===
 * `platform_enumeration.key`. Codes are never minted here. See
 * `EnumerationTypeDef.mirrorQuestionId`.
 */

/** A registry value, already ordered by `sortOrder`. */
export interface MirroredValue {
  code: string;
  labelAr: string;
  labelEn: string;
}

/** An option row as it currently stands. */
export interface ExistingOption {
  id: string;
  code: string;
  labelAr: string;
  labelEn: string;
  displayOrder: number;
  isActive: boolean;
}

export interface MirroredOptionPlan {
  /** Options whose value left the list. Deactivated, never deleted — see below. */
  deactivate: string[];
  /** Options that exist but whose label, order or active flag has moved. */
  update: Array<{ id: string; labelAr: string; labelEn: string; displayOrder: number }>;
  /** Values with no option yet. */
  create: Array<MirroredValue & { displayOrder: number }>;
}

/** Whether the plan would change anything — the gate on republishing. */
export function planIsEmpty(plan: MirroredOptionPlan): boolean {
  return plan.deactivate.length === 0 && plan.update.length === 0 && plan.create.length === 0;
}

/**
 * What to write so `existing` becomes `values`.
 *
 * DEACTIVATE, NEVER DELETE. `application_answer` stores the option code a customer picked, an
 * archived questionnaire snapshot carries it, and a bank's key table may still be keyed by it.
 * A deactivated option leaves the picker and leaves the next published snapshot, which is
 * exactly what "the operator retired this value" should look like on every surface.
 *
 * RESURRECT on return. A value that comes back reuses its own row rather than getting a second
 * one — which would collide on `@@unique([questionId, code])` anyway — so the answers already
 * given against that code stay attached to the option they were given against.
 *
 * `displayOrder` is the index in `values`, so the registry's `sortOrder` is the only thing
 * deciding the order the customer sees. A retired option keeps whatever order it had: nothing
 * renders it, and rewriting it would put a write in the plan that changes nothing visible.
 */
export function mirroredOptionPlan(
  existing: readonly ExistingOption[],
  values: readonly MirroredValue[],
): MirroredOptionPlan {
  const wanted = new Map(values.map((value, index) => [value.code, { ...value, displayOrder: index }]));
  const plan: MirroredOptionPlan = { deactivate: [], update: [], create: [] };

  for (const option of existing) {
    const want = wanted.get(option.code);
    if (!want) {
      if (option.isActive) plan.deactivate.push(option.id);
      continue;
    }
    wanted.delete(option.code);
    const unchanged =
      option.isActive &&
      option.labelAr === want.labelAr &&
      option.labelEn === want.labelEn &&
      option.displayOrder === want.displayOrder;
    if (unchanged) continue;
    plan.update.push({
      id: option.id,
      labelAr: want.labelAr,
      labelEn: want.labelEn,
      displayOrder: want.displayOrder,
    });
  }

  plan.create.push(...wanted.values());
  return plan;
}
