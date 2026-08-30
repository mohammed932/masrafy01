/**
 * Merge `compound_owner_by_class` into `compound_owner` — one product, three ways.
 *
 * A ONE-OFF against the dev database, not a migration and not an npm script: both keys are
 * data that exists on one box, a migration would run unattended on every deploy, and a
 * permanent script named after two rows is a hardcoded product (Principle II / A1). Now
 * that the form holds more than two ways this is an admin action on the calculation screen;
 * this file is the same action, scripted, so the result is reproducible and auditable.
 *
 * Dry run by default. `--confirm` writes.
 *
 * Goes over HTTP rather than straight to Prisma so the real refusals run: `validateTemplate`,
 * `validateIncomeRule`, and `assertNoOrphanedFigures` (which is vacuous here — nothing links
 * to either product — but must be the thing that says so, not this file).
 */
const API = process.env.API ?? 'http://localhost:3000/api';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'ops@masrafy.local';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';

const KEEP = 'compound_owner';
const DROP = 'compound_owner_by_class';

/** The way `compound_owner_by_class` existed for: a ceiling keyed by the compound's class. */
const CLASS_WAY = { kind: 'classTable', fact: 'which_compound_is_your_unit_in' } as const;

/**
 * The unit-price floor, carried over from the product being dropped.
 *
 * Safe to merge a condition in: a gate applies only when the BANK turned it on, so a bank
 * that states no unit-price floor never sees it. That is the same posture that lets one
 * frame carry four banks' different conditions.
 */
const UNIT_PRICE_CONDITION = {
  id: 'c3',
  test: { op: 'atLeast' },
  measure: { of: 'fact', fact: 'what_is_the_contract_price_of_the_unit' },
  reasonCode: 'UNIT_PRICE_BELOW_MIN',
} as const;

async function main(): Promise<void> {
  const write = process.argv.includes('--confirm');

  const login = await fetch(`${API}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const auth = (await login.json()) as { data?: { accessToken?: string } };
  const token = auth.data?.accessToken;
  if (!token) throw new Error('login failed — set SEED_ADMIN_PASSWORD');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const read = async (key: string) => {
    const res = await fetch(`${API}/admin/bank-programs/surrogate-products/${key}/template`, {
      headers,
    });
    return (await res.json()) as { data?: { template: Record<string, unknown> | null } };
  };

  const keep = (await read(KEEP)).data?.template;
  if (!keep) throw new Error(`${KEEP} has no form to merge into`);

  const existing = Array.isArray(keep['alternatives'])
    ? (keep['alternatives'] as Array<Record<string, unknown>>)
    : keep['alternative']
      ? [keep['alternative'] as Record<string, unknown>]
      : [];
  const alreadyThere = existing.some(
    (way) => way['kind'] === CLASS_WAY.kind && way['fact'] === CLASS_WAY.fact,
  );

  const conditions = (keep['conditions'] as Array<Record<string, unknown>>) ?? [];
  const hasUnitPrice = conditions.some((c) => c['id'] === UNIT_PRICE_CONDITION.id);

  const merged = {
    ...keep,
    alternative: undefined,
    alternatives: alreadyThere ? existing : [...existing, CLASS_WAY],
    conditions: hasUnitPrice ? conditions : [...conditions, UNIT_PRICE_CONDITION],
  };
  delete (merged as Record<string, unknown>)['alternative'];

  console.log(`${KEEP}: ${existing.length} way(s) -> ${merged.alternatives.length + 1}`);
  console.log(`${KEEP}: ${conditions.length} condition(s) -> ${merged.conditions.length}`);
  console.log(JSON.stringify(merged, null, 2));

  if (!write) {
    console.log(`\nDRY RUN. Re-run with --confirm to write, and to delete ${DROP}.`);
    return;
  }

  const put = await fetch(`${API}/admin/bank-programs/surrogate-products/${KEEP}/template`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ template: merged }),
  });
  const putBody = await put.text();
  console.log(`PUT ${KEEP}/template -> ${put.status} ${putBody.slice(0, 400)}`);
  if (!put.ok) throw new Error('template write refused — nothing else attempted');

  // Deleted only after the merge landed: the way it carried has to exist somewhere first.
  const del = await fetch(`${API}/admin/bank-programs/surrogate-products/${DROP}`, {
    method: 'DELETE',
    headers,
  });
  console.log(`DELETE ${DROP} -> ${del.status} ${(await del.text()).slice(0, 400)}`);
}

void main();
