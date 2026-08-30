/**
 * Quote both compound-owner products against the REAL stored rules, with the parent map
 * built from the live registry — the same join the engine does at apply time.
 */
import { PrismaClient } from '@prisma/client';
import { evaluateProductRule } from '../../src/matching/pipeline/product-rule';
import type { ProductRule } from '../../src/matching/pipeline/product-rule';
import type { SurrogateFactValue } from '../../src/matching/types';
import { Decimal } from '@prisma/client/runtime/library';

const p = new PrismaClient();

function pass(label: string, got: string, want: string) {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} got=${got} want=${want}`);
  return ok;
}

(async () => {
  const rows = await p.platformEnumeration.findMany({
    where: { type: 'surrogate_product', key: { in: ['compound_owner', 'compound_owner_by_class'] } },
    select: { key: true, incomeRule: true },
  });
  const rules = new Map(rows.map((r) => [r.key, r.incomeRule as unknown as ProductRule]));

  const parentRows = await p.platformEnumeration.findMany({
    where: { parentKey: { not: null } },
    select: { key: true, parentKey: true },
  });
  const parentKeyByValue: Record<string, string> = {};
  for (const r of parentRows) parentKeyByValue[r.key] = r.parentKey!;

  const choice = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });
  const num = (value: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(value) });

  let ok = true;
  const P1 = rules.get('compound_owner')!;

  // ABK, apartment, 30 months owned, 20,000,000 paid. 15% = 3,000,000; apartment ceiling
  // 2,000,000; LOWER wins.
  let r = evaluateProductRule(P1, {
    facts: {
      how_much_have_you_paid_for_the_unit_so_far: num('20000000'),
      what_kind_of_unit_do_you_own: choice('apartment'),
      do_you_own_more_than_one_residential_unit: choice('no'),
      how_many_months_ago_did_you_buy_the_unit: num('30'),
    },
    parentKeyByValue,
  });
  ok = pass('P1 apartment, 20M paid -> lower of 3M and 2M', r.ok ? r.valueEGP.toString() : `ERR:${(r as any).reason}`, '2000000') && ok;

  // Villa, only 10,000,000 paid. 15% = 1,500,000 beats the 4,000,000 villa ceiling.
  r = evaluateProductRule(P1, {
    facts: {
      how_much_have_you_paid_for_the_unit_so_far: num('10000000'),
      what_kind_of_unit_do_you_own: choice('villa'),
      do_you_own_more_than_one_residential_unit: choice('no'),
      how_many_months_ago_did_you_buy_the_unit: num('30'),
    },
    parentKeyByValue,
  });
  ok = pass('P1 villa, 10M paid -> lower of 1.5M and 4M', r.ok ? r.valueEGP.toString() : `ERR:${(r as any).reason}`, '1500000') && ok;

  // Same, owning more than one unit: +10% on the 1,500,000.
  r = evaluateProductRule(P1, {
    facts: {
      how_much_have_you_paid_for_the_unit_so_far: num('10000000'),
      what_kind_of_unit_do_you_own: choice('villa'),
      do_you_own_more_than_one_residential_unit: choice('yes'),
      how_many_months_ago_did_you_buy_the_unit: num('30'),
    },
    parentKeyByValue,
  });
  ok = pass('P1 same + more than one unit -> +10%', r.ok ? r.valueEGP.toString() : `ERR:${(r as any).reason}`, '1650000') && ok;

  // Bought 6 months ago — the 18-month gate refuses, with the sheet's own reason.
  r = evaluateProductRule(P1, {
    facts: {
      how_much_have_you_paid_for_the_unit_so_far: num('20000000'),
      what_kind_of_unit_do_you_own: choice('apartment'),
      do_you_own_more_than_one_residential_unit: choice('no'),
      how_many_months_ago_did_you_buy_the_unit: num('6'),
    },
    parentKeyByValue,
  });
  ok = pass('P1 owned 6 months -> refused', r.ok ? 'QUOTED' : `${(r as any).reason}:${(r as any).gateReasonCode}`, 'gate_failed:CONTRACT_TOO_NEW') && ok;

  // I-Score unanswered must NOT kill the quote (the `optional` flag).
  r = evaluateProductRule(P1, {
    facts: {
      how_much_have_you_paid_for_the_unit_so_far: num('10000000'),
      what_kind_of_unit_do_you_own: choice('villa'),
      do_you_own_more_than_one_residential_unit: choice('no'),
      how_many_months_ago_did_you_buy_the_unit: num('24'),
    },
    parentKeyByValue,
  });
  ok = pass('P1 no I-Score answer -> still quotes at 100%', r.ok ? r.valueEGP.toString() : `ERR:${(r as any).reason}`, '1500000') && ok;

  const P2 = rules.get('compound_owner_by_class')!;
  for (const [compound, want] of [['mivida', null], ['madinaty', null]] as const) {
    const row = await p.platformEnumeration.findFirst({ where: { type: 'compound', key: compound }, select: { key: true, parentKey: true, labelEn: true } });
    if (!row) { console.log(`skip ${compound} — not in the list`); continue; }
    const res = evaluateProductRule(P2, { facts: { which_compound_is_your_unit_in: choice(row.key) }, parentKeyByValue });
    console.log(`P2 ${row.labelEn} (class ${row.parentKey}) -> ${res.ok ? res.valueEGP.toString() : 'ERR:' + (res as any).reason}`);
  }

  console.log(ok ? '\nALL ASSERTIONS PASS' : '\nSOME ASSERTIONS FAILED');
  await p.$disconnect();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
