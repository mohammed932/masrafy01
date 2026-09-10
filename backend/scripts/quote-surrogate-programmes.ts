/**
 * Quote EVERY surrogate bank program through its real stored rows, for a fixed set of
 * applicants, and print one line per (program, applicant).
 *
 * Read-only. Exists because the repo's testing policy asks a change that claims to move no
 * money to PROVE it: run this before, run it after, diff the two files.
 *
 *   npx tsx scripts/quote-surrogate-programmes.ts > before.txt
 *
 * The assembly is deliberately the SAME as the production read path, in the same order, so a
 * figure here is the figure a customer would be quoted:
 *
 *   platform_enumeration(program_name).incomeRule + surrogate_product  → effectiveProgramNameRule
 *   → catalogRuleOf → effectiveIncomeRule(program's own rule, catalog) → normalizeIncomeAssumption
 *   → evaluateProductRule(rule, { facts, parentKeyByValue })
 *
 * `parentKeyByValue` is built with the same ACTIVE + non-null filter the repository uses, or a
 * class-keyed table would resolve differently here than in production.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  catalogRuleOf,
  effectiveIncomeRule,
  effectiveProgramNameRule,
  type CatalogRuleResolution,
  type LinkedProduct,
} from '../src/matching/pipeline/income-rule-inherit';
import { normalizeIncomeAssumption } from '../src/matching/pipeline/income-rule-normalize';
import { evaluateProductRule, type ProductRule } from '../src/matching/pipeline/product-rule';
import type { IncomeAssumptionConfig, SurrogateFactValue } from '../src/matching/types';

const prisma = new PrismaClient();

function asRule(raw: unknown): IncomeAssumptionConfig | undefined {
  return raw === null || raw === undefined ? undefined : (raw as IncomeAssumptionConfig);
}

const num = (v: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(v) });
const pick = (code: string): SurrogateFactValue => ({ kind: 'choice', optionCode: code });

/**
 * Three applicants, each answering EVERY fact any product reads, so a figure that moves is a
 * rule change and never a missing answer. Deliberately fixed rather than generated: the
 * expected figures are recorded in CLAUDE.md against exactly these inputs.
 */
const APPLICANTS: ReadonlyArray<{ name: string; facts: Record<string, SurrogateFactValue> }> = [
  {
    name: 'A/senior',
    facts: {
      military_grade: pick('grade_major_general'),
      academic_rank: pick('dean'),
      university_type: pick('uni_private'),
      years_in_practice: num('12'),
      practice_governorate: pick('cairo'),
      credit_card_limit: num('60000'),
      car_loan_installment: num('8000'),
      auto_loan_amount: num('400000'),
      pledged_free_amount: num('1000000'),
      pledged_months_since_issue: num('12'),
      car_down_payment: num('500000'),
      car_price: num('1000000'),
      total_savings: num('36000'),
      green_buyer_type: pick('instalment_buyer'),
      compound_name: pick('mivida'),
      owned_unit_type: pick('villa'),
      unit_paid_to_date: num('3000000'),
      unit_down_payment: num('1000000'),
      unit_contract_price: num('5000000'),
      unit_months_owned: num('36'),
      unit_owned_share_pct: num('100'),
      school_stage: pick('stage_secondary'),
      school_type: pick('school_international'),
      employer_coding: pick('coding_cat_a'),
      club_branch: pick('branch_new_cairo'),
      i_score: num('700'),
      // The sheet-condition answers. Every one of these questions is REQUIRED, so a real
      // applicant always states something; what varies is whether it passes. Here they pass,
      // which is what makes the figures below comparable with the recorded ones.
      business_months: pick('24m_or_more'),
      self_employed_licence: pick('yes'),
      hospital_sector: pick('private_hospital'),
      home_ownership: pick('owned_by_me'),
      unit_approved_compound: pick('yes'),
      car_loan_original_tenor: num('60'),
      car_loan_instalments_paid: num('36'),
      car_loan_down_payment: num('200000'),
    },
  },
  {
    name: 'B/mid',
    facts: {
      military_grade: pick('grade_major'),
      academic_rank: pick('lecturer'),
      university_type: pick('uni_government'),
      years_in_practice: num('5'),
      practice_governorate: pick('gharbia'),
      credit_card_limit: num('30000'),
      car_loan_installment: num('4000'),
      auto_loan_amount: num('200000'),
      pledged_free_amount: num('300000'),
      pledged_months_since_issue: num('6'),
      car_down_payment: num('200000'),
      car_price: num('600000'),
      total_savings: num('36000'),
      green_buyer_type: pick('cash_buyer'),
      compound_name: pick('madinaty'),
      owned_unit_type: pick('apartment'),
      unit_paid_to_date: num('1000000'),
      unit_down_payment: num('400000'),
      unit_contract_price: num('2000000'),
      unit_months_owned: num('24'),
      unit_owned_share_pct: num('50'),
      school_stage: pick('stage_primary'),
      school_type: pick('school_national'),
      employer_coding: pick('coding_cat_b'),
      club_branch: pick('branch_main'),
      i_score: num('600'),
      // The exemption path, deliberately: this applicant runs no business and works at no
      // hospital, and states so. Both answers are allow-listed, so every condition passes
      // and the figures match the baseline — which is the whole point of putting the
      // exemption in the ANSWER rather than in a gate.
      business_months: pick('not_self_employed'),
      self_employed_licence: pick('not_self_employed'),
      hospital_sector: pick('not_at_a_hospital'),
      home_ownership: pick('owned_by_relative'),
      unit_approved_compound: pick('yes'),
      car_loan_original_tenor: num('48'),
      car_loan_instalments_paid: num('24'),
      car_loan_down_payment: num('80000'),
    },
  },
  // Answers NOTHING. Every programme must report a stated reason and never a figure — the
  // control that proves a refusal is a refusal and not a zero.
  { name: 'C/blank', facts: {} },
];

async function main(): Promise<void> {
  const rows = await prisma.platformEnumeration.findMany({
    where: { type: { in: ['program_name', 'surrogate_product'] } },
    select: {
      type: true,
      key: true,
      incomeRule: true,
      surrogateProductKey: true,
      active: true,
      deprecatedAt: true,
    },
  });

  const products = new Map<string, LinkedProduct>();
  for (const row of rows) {
    if (row.type !== 'surrogate_product') continue;
    products.set(row.key, {
      key: row.key,
      active: row.active,
      deprecatedAt: row.deprecatedAt,
      rule: asRule(row.incomeRule),
    });
  }
  const catalog = new Map<string, CatalogRuleResolution>();
  for (const row of rows) {
    if (row.type !== 'program_name') continue;
    const resolution = effectiveProgramNameRule(
      asRule(row.incomeRule),
      row.surrogateProductKey === null ? undefined : products.get(row.surrogateProductKey),
    );
    if (resolution !== undefined) catalog.set(row.key, resolution);
  }

  const parentRows = await prisma.platformEnumeration.findMany({
    where: { active: true, deprecatedAt: null, parentKey: { not: null } },
    select: { key: true, parentKey: true },
  });
  const parentKeyByValue: Record<string, string> = {};
  for (const row of parentRows) {
    if (row.parentKey !== null) parentKeyByValue[row.key] = row.parentKey;
  }

  const programs = await prisma.bankProgram.findMany({
    where: { programType: 'income_surrogate' },
    select: { programCode: true, programNameKey: true, incomeAssumption: true },
    orderBy: { programCode: 'asc' },
  });

  console.log(`# ${programs.length} surrogate programmes x ${APPLICANTS.length} applicants`);
  for (const program of programs) {
    const resolution =
      program.programNameKey === null ? undefined : catalog.get(program.programNameKey);
    const rule = normalizeIncomeAssumption(
      effectiveIncomeRule(
        program.incomeAssumption as unknown as IncomeAssumptionConfig,
        catalogRuleOf(resolution),
      ),
    ) as unknown as ProductRule;

    for (const applicant of APPLICANTS) {
      const withheld = resolution !== undefined && 'withheld' in resolution;
      const outcome = withheld
        ? { ok: false as const, reason: 'surrogate_product_retired' }
        : evaluateProductRule(rule, { facts: applicant.facts, parentKeyByValue });
      const verdict = outcome.ok
        ? `OK ${outcome.kind} ${outcome.valueEGP.toFixed(2)}`
        : `-- ${outcome.reason}` +
          ('factKey' in outcome && outcome.factKey ? ` fact=${outcome.factKey}` : '') +
          ('gateReasonCode' in outcome && outcome.gateReasonCode
            ? ` gate=${outcome.gateReasonCode}`
            : '');
      console.log(
        `${program.programCode}\t${program.programNameKey ?? '-'}\t${applicant.name}\t${verdict}`,
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
