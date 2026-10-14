/**
 * Can every applicant actually finish?
 *
 * The engine cannot price a loan without four figures — the amount, the term, the income and
 * what the applicant already pays each month. `money-field-bindings.ts` names the question
 * each one is answered by, `ApplyRequestDto` refuses a submission without them, and
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
import { PrismaClient, type LoanCategory } from '@prisma/client';
import {
  MONEY_FIELD_BINDINGS,
  MONEY_FIELD_BINDING_KEYS,
} from '../src/matching/pipeline/money-field-bindings';

const prisma = new PrismaClient();
const REPORT = process.argv.includes('--report');

/** The four question codes a quote cannot be built without. */
const REQUIRED_CODES = MONEY_FIELD_BINDING_KEYS.map((k) => MONEY_FIELD_BINDINGS[k]);

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

  // The questions each category asks, with their required flag. One read, not one per flow:
  // the money bindings are CORE, so they are never narrowed by the program-name axis — if a
  // category asks one, every name under it does.
  const assigned = await prisma.questionLoanCategory.findMany({
    where: { question: { isActive: true, code: { in: REQUIRED_CODES } } },
    select: { category: true, question: { select: { code: true, isRequired: true } } },
  });
  const byCategory = new Map<string, Map<string, boolean>>();
  for (const row of assigned) {
    const cat = row.category as unknown as string;
    const map = byCategory.get(cat) ?? byCategory.set(cat, new Map()).get(cat)!;
    map.set(row.question.code, row.question.isRequired);
  }

  /**
   * The amount need not be ASKED when the flow already states the two figures it is the
   * difference of — `MoneyFigures.fromAnswers` derives `price - down payment` rather than
   * making a car buyer type a number the form already knows. Arithmetic, not a default:
   * everything else here still has to be asked outright.
   */
  const DERIVABLE_FROM: Readonly<Record<string, readonly string[]>> = {
    [MONEY_FIELD_BINDINGS.requested_amount]: ['car_price', 'car_down_payment'],
  };
  const alsoAsked = await prisma.questionLoanCategory.findMany({
    where: {
      question: { isActive: true, code: { in: ['car_price', 'car_down_payment'] } },
    },
    select: { category: true, question: { select: { code: true } } },
  });
  const derivableBy = new Map<string, Set<string>>();
  for (const row of alsoAsked) {
    const cat = row.category as unknown as string;
    (derivableBy.get(cat) ?? derivableBy.set(cat, new Set()).get(cat)!).add(row.question.code);
  }
  const isDerivable = (category: string, code: string): boolean => {
    const from = DERIVABLE_FROM[code];
    if (from === undefined) return false;
    const have = derivableBy.get(category) ?? new Set<string>();
    return from.every((c) => have.has(c));
  };

  const failures: Failure[] = [];
  const rows: string[] = [];
  for (const [category, names] of [...offered].sort()) {
    const asked = byCategory.get(category) ?? new Map<string, boolean>();
    const notAsked = REQUIRED_CODES.filter((c) => !asked.has(c) && !isDerivable(category, c));
    const optional = REQUIRED_CODES.filter((c) => asked.get(c) === false);
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
      `  clean — all four money figures are asked and required on every one of the ${flows} flows a customer can walk.\n`,
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
    `\n  ${failures.length} flow(s) a customer cannot finish. Assign the question to that loan ` +
      `type on /questionnaire/categories, and keep it required.\n`,
  );
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('[check:money] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
