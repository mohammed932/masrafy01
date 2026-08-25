/**
 * The gate in front of `PROGRAM_NAME_INCOME_PROOF_MISMATCH`.
 *
 * A catalog program name states exactly ONE income proof, and every surrogate
 * program filed under it must read that same proof. Turning that into a save-time
 * rejection is only safe once the stored book already obeys it: a program that
 * violates the rule becomes UNSAVABLE from admin, and — per the reasoning already
 * written into `20260817090400`'s header — an unsavable program can be unfixable,
 * because `pruneValueSources` only runs on update, so the fixing save is the
 * failing save.
 *
 *   npx tsx scripts/income-proof-conflicts.ts
 *
 * Read-only. It reports three separate problems, because they have three different
 * fixes and lumping them together is how the wrong one gets applied:
 *
 *   MISMATCH  the name has a rule and the program reads something else
 *             → repoint the program to a name whose proof matches, or fix the program
 *   SPLIT     two programs under one name read two different proofs
 *             → the name is two names; split it (this is the only one that needs
 *               a NEW catalog name, and it is never safe to guess which side keeps
 *               the old key)
 *   MISSING   surrogate programs agree on a proof but the name carries no rule
 *             → write the rule onto the name; nothing about the programs moves
 *
 * Exit code is 0 when clean, 1 when anything is reported, so it can gate a deploy.
 */
import { PrismaClient } from '@prisma/client';
import { factKeyOf, type IncomeAssumptionConfig } from '../src/matching/types';
import { normalizeIncomeAssumption } from '../src/matching/pipeline/income-rule-normalize';

/**
 * The proof a rule reads, as one comparable string. `declared` is a real answer
 * ("this program states no proof"), NOT the absence of one — seven seeded business
 * and professional programs carry it deliberately, so it must compare equal to
 * itself and unequal to everything else rather than being skipped.
 */
function proofOf(raw: unknown): string {
  const cfg = normalizeIncomeAssumption(raw as IncomeAssumptionConfig);
  return cfg.strategy;
}

/** `fact:academic_rank` → `academic_rank (registry fact)`, for a readable report. */
function describeProof(strategy: string): string {
  const factKey = factKeyOf(strategy as IncomeAssumptionConfig['strategy']);
  return factKey === null ? strategy : `${factKey} (registry fact)`;
}

interface ProgramRow {
  programCode: string;
  bankName: string;
  proof: string;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.platformEnumeration.findMany({
      where: { type: { in: ['program_name', 'surrogate_product'] } },
      select: {
        type: true,
        key: true,
        labelEn: true,
        incomeRule: true,
        active: true,
        surrogateProductKey: true,
      },
      orderBy: { key: 'asc' },
    });

    // A name that links to a surrogate product carries NULL in its own `incomeRule`
    // and states the PRODUCT's proof. Reading only `program_name` would report every
    // linked name as MISSING and hand the operator a FIX line telling them to write a
    // rule back onto the name — which is precisely the fork the link exists to end.
    const productRules = new Map(
      rows.flatMap((r) =>
        r.type === 'surrogate_product' && r.incomeRule !== null
          ? [[r.key, r.incomeRule] as const]
          : [],
      ),
    );
    const names = rows.filter((r) => r.type === 'program_name');
    const linkedTo = new Map(
      names.flatMap((n) => (n.surrogateProductKey === null ? [] : [[n.key, n.surrogateProductKey] as const])),
    );
    const catalogProof = new Map<string, string | null>(
      names.map((n) => {
        const linked = n.surrogateProductKey === null ? undefined : productRules.get(n.surrogateProductKey);
        const rule = linked ?? n.incomeRule;
        return [n.key, rule === null || rule === undefined ? null : proofOf(rule)];
      }),
    );
    const catalogLabel = new Map(names.map((n) => [n.key, n.labelEn]));

    // Surrogate programs only. A payslip program consults no proof (`quote.ts`
    // reaches the rule for one only when the applicant declared nothing), so
    // holding it to the name's proof would reject saves for no reader's benefit.
    const programs = await prisma.bankProgram.findMany({
      where: { programType: 'income_surrogate' },
      select: {
        programCode: true,
        bankName: true,
        programNameKey: true,
        incomeAssumption: true,
        active: true,
      },
      orderBy: [{ programNameKey: 'asc' }, { programCode: 'asc' }],
    });

    const byName = new Map<string, ProgramRow[]>();
    const unfiled: string[] = [];
    for (const p of programs) {
      if (p.programNameKey === null) {
        unfiled.push(p.programCode);
        continue;
      }
      const row = { programCode: p.programCode, bankName: p.bankName, proof: proofOf(p.incomeAssumption) };
      const bucket = byName.get(p.programNameKey);
      if (bucket === undefined) byName.set(p.programNameKey, [row]);
      else bucket.push(row);
    }

    const splits: string[] = [];
    const mismatches: string[] = [];
    const missing: string[] = [];

    for (const [key, rows] of [...byName.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const distinct = [...new Set(rows.map((r) => r.proof))];
      const stated = catalogProof.get(key);
      const label = catalogLabel.get(key) ?? '(no catalog row)';
      const list = (rs: ProgramRow[]): string =>
        rs.map((r) => `      ${r.programCode.padEnd(24)} ${describeProof(r.proof)}`).join('\n');

      if (distinct.length > 1) {
        splits.push(
          `  ${key} — "${label}"\n` +
            `    ${distinct.length} different proofs under one name:\n${list(rows)}\n` +
            `    FIX: this name is two names. Add a catalog name for the odd proof and\n` +
            `         repoint those programs to it (by programCode, never by id).`,
        );
        continue;
      }

      const programProof = distinct[0] as string;
      if (stated === undefined || stated === null) {
        const product = linkedTo.get(key);
        missing.push(
          product === undefined
            ? `  ${key} — "${label}"\n` +
              `    ${rows.length} program(s) agree on ${describeProof(programProof)}, the name states nothing.\n` +
              `${list(rows)}\n` +
              `    FIX: write incomeRule onto the catalog name, or link it to a surrogate\n` +
              `         product that states ${describeProof(programProof)}. No program moves.`
            : `  ${key} — "${label}"\n` +
              `    links to surrogate product '${product}', which has no rule or does not exist.\n` +
              `${list(rows)}\n` +
              `    FIX: fix the product, not the name. Writing a rule back onto the name\n` +
              `         would fork the calculation with nothing to reveal it.`,
        );
        continue;
      }
      if (stated !== programProof) {
        mismatches.push(
          `  ${key} — "${label}"\n` +
            `    name states ${describeProof(stated)}, program(s) read ${describeProof(programProof)}:\n` +
            `${list(rows)}\n` +
            `    FIX: repoint the program(s) to a name stating ${describeProof(programProof)},\n` +
            `         or correct whichever side is wrong.`,
        );
      }
    }

    // A name with a rule and no program is fine (it is a template waiting to be used).
    // A surrogate program with no name is not: enforcement has nothing to compare it to.
    const out: string[] = ['', '=== income proof conflicts ===', ''];
    const section = (title: string, items: string[]): void => {
      if (items.length === 0) return;
      out.push(`${title} (${items.length})`, '', ...items, '');
    };
    section('SPLIT — one name, two proofs', splits);
    section('MISMATCH — name and program disagree', mismatches);
    section('MISSING — name states no proof', missing);
    if (unfiled.length > 0) {
      out.push(
        `UNFILED — surrogate program with no programNameKey (${unfiled.length})`,
        '',
        ...unfiled.map((c) => `  ${c}`),
        '    FIX: file each under a catalog name before enforcement ships.',
        '',
      );
    }

    const total = splits.length + mismatches.length + missing.length + unfiled.length;
    if (total === 0) {
      out.push(
        `clean — ${programs.length} surrogate program(s) across ${byName.size} name(s) obey the rule.`,
        '',
      );
    } else {
      out.push(`${total} problem(s). Enforcement must not ship until this prints clean.`, '');
    }
    process.stdout.write(out.join('\n'));
    process.exitCode = total === 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
