/**
 * Can every applicant actually finish?
 *
 * The engine cannot price a loan without four figures — the amount, the term, the income and
 * what the applicant already pays each month. `money-field-bindings.ts` names the question
 * each one is answered by (the last one, since 2026-10-26, through the debt-type pick and its
 * amounts rather than a stated total), `ApplyRequestDto` refuses a submission without them, and
 * `MoneyFigures.fromAnswers` on the phone throws rather than invent one (FR-044).
 *
 *   npx tsx scripts/check-money-bindings.ts            (npm run check:money)
 *   npx tsx scripts/check-money-bindings.ts --report   + the per-flow table
 *
 * This is the standing proof that the QUESTIONNAIRE asks all four, as REQUIRED questions, on
 * every path a customer can walk — every (category, program name) the wizard can produce.
 *
 * It exists because the client used to carry the guarantee itself: the Finish button was held
 * down by a hardcoded list of the four codes, so a category that stopped asking one of them
 * showed a permanently grey button with no way to diagnose it from the app. That check has
 * moved here, where the failure names the flow and the question instead of stranding a
 * customer. It is the reason the wizard can now trust `isRequired` from the snapshot alone.
 *
 * The failure it guards is silent in both directions:
 *   - the question is not ASKED   -> nothing to answer, Finish never enables
 *   - the question is OPTIONAL    -> Finish enables, then apply 422s on a missing figure
 *
 * Read-only. Exit 0 when clean, 1 when anything is reported, so it can gate a deploy.
 */
import { PrismaClient } from '@prisma/client';
import {
  ASKED_MONEY_FIELD_BINDING_KEYS,
  DEBT_TYPES_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
} from '../src/matching/pipeline/money-field-bindings';

const prisma = new PrismaClient();
const REPORT = process.argv.includes('--report');

/**
 * The questions a quote cannot be built without: the amount, the term, the income — and what
 * the applicant owes, asked as the debt-type pick and its amounts since the stated total was
 * retired (2026-10-26).
 */
const REQUIRED_CODES = [
  ...ASKED_MONEY_FIELD_BINDING_KEYS.map((k) => MONEY_FIELD_BINDINGS[k]),
  DEBT_TYPES_QUESTION_CODE,
];

interface Failure {
  readonly category: string;
  readonly programNameKey: string;
  readonly notAsked: string[];
  readonly optional: string[];
}

async function main(): Promise<void> {
  // Every (category, name) the wizard can offer — derived from live programs, exactly as
  // `/v1/program-options` does, so a path this cannot reach is a path no customer can either.
  const programs = await prisma.bankProgram.findMany({
    where: { active: true, programNameKey: { not: null } },
    select: { productCategory: true, programNameKey: true },
  });
  const offered = new Map<string, Set<string>>();
  for (const p of programs) {
    const cat = p.productCategory as unknown as string;
    (offered.get(cat) ?? offered.set(cat, new Set()).get(cat)!).add(p.programNameKey!);
  }

  // The money questions, live and with their required flag. A question carries no loan type
  // since v32.0.0, and these are CORE — every program asks them (`question-scope.ts`) — so
  // "asked" is "switched on", and the answer is the same for every flow.
  const live = await prisma.question.findMany({
    where: {
      isActive: true,
      code: { in: [...REQUIRED_CODES, 'car_price', 'car_down_payment'] },
    },
    select: { code: true, isRequired: true },
  });
  const asked = new Map(live.map((q) => [q.code, q.isRequired]));

  /**
   * The amount need not be ASKED when the flow already states the two figures it is the
   * difference of — `MoneyFigures.fromAnswers` derives `price - down payment` rather than
   * making a car buyer type a number the form already knows. Arithmetic, not a default:
   * everything else here still has to be asked outright.
   */
  const DERIVABLE_FROM: Readonly<Record<string, readonly string[]>> = {
    [MONEY_FIELD_BINDINGS.requested_amount]: ['car_price', 'car_down_payment'],
  };
  const isDerivable = (code: string): boolean =>
    DERIVABLE_FROM[code]?.every((c) => asked.has(c)) ?? false;

  const failures: Failure[] = [];
  const rows: string[] = [];
  const notAsked = REQUIRED_CODES.filter((c) => !asked.has(c) && !isDerivable(c));
  const optional = REQUIRED_CODES.filter((c) => asked.get(c) === false);
  for (const [category, names] of [...offered].sort()) {
    for (const programNameKey of [...names].sort()) {
      rows.push(
        `  ${category.padEnd(10)} ${programNameKey.padEnd(28)} ` +
          `${notAsked.length === 0 && optional.length === 0 ? 'can finish' : 'BLOCKED'}`,
      );
      if (notAsked.length > 0 || optional.length > 0) {
        failures.push({ category, programNameKey, notAsked, optional });
      }
    }
  }

  console.log('\n[check:money]\n');
  if (REPORT) {
    console.log(rows.join('\n'));
    console.log('');
  }

  if (failures.length === 0) {
    const flows = [...offered.values()].reduce((n, s) => n + s.size, 0);
    console.log(
      `  clean — all four money figures (debts via the debt-type pick) are asked and required on every one of the ${flows} flows a customer can walk.\n`,
    );
    return;
  }

  for (const f of failures) {
    console.log(`  ${f.category}/${f.programNameKey}`);
    if (f.notAsked.length > 0) {
      console.log(`     never asked  : ${f.notAsked.join(', ')}  -> Finish can never enable`);
    }
    if (f.optional.length > 0) {
      console.log(`     optional     : ${f.optional.join(', ')}  -> Finish enables, apply 422s`);
    }
  }
  console.log(
    `\n  ${failures.length} flow(s) a customer cannot finish. Switch the question back on ` +
      `(Questionnaire → Questions), and keep it required.\n`,
  );
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('[check:money] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
