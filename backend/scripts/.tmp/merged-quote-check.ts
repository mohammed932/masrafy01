/**
 * The merged compound-owner product, quoted through the REAL evaluator against the REAL
 * stored rule and the REAL parent map — the same join apply does.
 *
 * A rule can be valid, and a product can be live, while the string join between step ids and
 * a bank's `stepParams` keys silently fails. Only running it says otherwise.
 */
import { PrismaClient } from '@prisma/client';
import { evaluateProductRule } from '../../src/matching/pipeline/product-rule';
import type { ProductRule } from '../../src/matching/pipeline/product-rule';
import type { SurrogateFactValue } from '../../src/matching/types';
import { Decimal } from '@prisma/client/runtime/library';

const p = new PrismaClient();
let failures = 0;

function check(label: string, got: string, want: string): void {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(62)} got=${got} want=${want}`);
}

const choice = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });
const num = (value: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(value) });

(async () => {
  const row = await p.platformEnumeration.findFirst({
    where: { type: 'surrogate_product', key: 'compound_owner' },
    select: { incomeRule: true },
  });
  const rule = row?.incomeRule as unknown as ProductRule;
  if (!rule) throw new Error('compound_owner has no rule');

  const parents = await p.platformEnumeration.findMany({
    where: { type: 'compound', parentKey: { not: null } },
    select: { key: true, parentKey: true },
  });
  const parentKeyByValue: Record<string, string> = {};
  for (const r of parents) parentKeyByValue[r.key] = r.parentKey!;

  // A compound really filed under a class, and one that landed in the catch-all — picked
  // from the live registry rather than named here, so the check follows the data.
  const classed = parents.find((r) => r.parentKey !== 'compound_tier_other');
  if (!classed) throw new Error('no compound is filed under a real class');
  const classKey = classed.parentKey!;
  console.log(`using compound ${classed.key} filed under ${classKey}\n`);

  const CLASS_SLOT = 'alt__which_compound_is_your_unit_in';

  // The three banks, as figures only. Nothing about them is in the product.
  const abk = {
    primary: { scalar: { value: '15', unit: 'percent' as const } },
    alt: {
      keyTable: [
        { key: 'apartment', incomeEGP: '2000000' },
        { key: 'villa', incomeEGP: '4000000' },
      ],
    },
  };
  const byClass = { [CLASS_SLOT]: { keyTable: [{ key: classKey, incomeEGP: '6000000' }] } };

  const facts = {
    how_much_have_you_paid_for_the_unit_so_far: num('20000000'),
    what_kind_of_unit_do_you_own: choice('apartment'),
    which_compound_is_your_unit_in: choice(classed.key),
    do_you_own_more_than_one_residential_unit: choice('no'),
  };

  const quote = (
    stepParams: Record<string, unknown>,
    over: Partial<Record<string, SurrogateFactValue>> = {},
    drop: string[] = [],
  ) => {
    const bag: Record<string, SurrogateFactValue> = { ...facts, ...over };
    for (const key of drop) delete bag[key];
    const out = evaluateProductRule(
      { ...rule, stepParams } as ProductRule,
      { facts: bag, parentKeyByValue },
    );
    return out.ok ? out.valueEGP.toString() : `REFUSED:${out.reason}`;
  };

  // 15% of 20,000,000 is 3,000,000; the apartment ceiling is 2,000,000. The class table is
  // this bank's blank and must not turn the answer back into 3,000,000.
  check('ABK — lower of 15% of paid and the unit-type ceiling', quote(abk), '2000000');

  check('by-class bank — its own class ceiling', quote(byClass), '6000000');

  // The regression the pruning fixes: a bank whose ceiling comes from the class must not
  // lose its quote to a question it never reads.
  check(
    'by-class bank — still quotes when "how much have you paid" is skipped',
    quote(byClass, {}, ['how_much_have_you_paid_for_the_unit_so_far']),
    '6000000',
  );

  // The regression `skipUnset` fixes: at three ways the old wrapper fell through to the
  // FIRST way alone, which here is 3,000,000.
  check(
    'a bank filling all three — the lowest of them',
    quote({ ...abk, ...byClass }),
    '2000000',
  );

  // The line skipUnset must not cross: a way this bank DID fill in that cannot resolve is a
  // refusal, not a fall-through.
  check(
    'an unanswered unit type still refuses the bank that keys on it',
    quote(abk, {}, ['what_kind_of_unit_do_you_own']),
    'REFUSED:fact_not_answered',
  );

  await p.$disconnect();
  console.log(failures === 0 ? '\nall green' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
