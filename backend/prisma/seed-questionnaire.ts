/**
 * Feature 009 seed — a runnable `personal` questionnaire + scoring factors +
 * ACTIVE per-program weight sets, so the dynamic-questionnaire + matching-preview
 * flow works end-to-end against real data. Idempotent. Run via:
 *   npx tsx prisma/seed-questionnaire.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CATEGORY = 'personal' as const;
const SEED_ACTOR = 'seed-system';

// Factors (DIRECT read option scoreValue; COMPUTED computed in code).
const FACTORS = [
  { code: 'salary_level', kind: 'DIRECT', labelEn: 'Salary level', labelAr: 'مستوى الدخل', sourceQuestionCode: 'monthly_income' },
  { code: 'job_stability', kind: 'DIRECT', labelEn: 'Job stability', labelAr: 'استقرار الوظيفة', sourceQuestionCode: 'job_tenure' },
  { code: 'salary_transferred', kind: 'DIRECT', labelEn: 'Salary transferred', labelAr: 'تحويل الراتب', sourceQuestionCode: 'salary_transfer' },
  { code: 'debt_burden', kind: 'COMPUTED', labelEn: 'Debt burden', labelAr: 'عبء الدين', sourceQuestionCode: null },
] as const;

// Per-program weight presets (each sums to 100) — assigned round-robin so the
// matching simulator visibly shows DIFFERENT approval % per program out of the
// box. Ops re-tunes any of these via the in-dashboard maker-checker flow.
const WEIGHT_PRESETS: Array<Record<string, number>> = [
  { salary_level: 25, job_stability: 20, salary_transferred: 25, debt_burden: 30 },
  { salary_level: 40, job_stability: 15, salary_transferred: 20, debt_burden: 25 },
  { salary_level: 15, job_stability: 30, salary_transferred: 15, debt_burden: 40 },
  { salary_level: 30, job_stability: 25, salary_transferred: 30, debt_burden: 15 },
];

interface SeedOption {
  labelEn: string;
  labelAr: string;
  numericPoint?: number;
  scoreValue?: number;
  profileValue?: string;
}
interface SeedQuestion {
  code: string;
  questionEn: string;
  questionAr: string;
  systemRole?: string;
  scoringFactorCode?: string;
  profileField?: string;
  options: SeedOption[];
}

const QUESTIONS: SeedQuestion[] = [
  {
    code: 'monthly_income', questionEn: 'Monthly net income', questionAr: 'صافي الدخل الشهري',
    systemRole: 'SALARY', scoringFactorCode: 'salary_level',
    options: [
      { labelEn: 'Less than 10,000', labelAr: 'أقل من 10,000', numericPoint: 7000, scoreValue: 0.15 },
      { labelEn: '10,000 - 20,000', labelAr: '10,000 - 20,000', numericPoint: 15000, scoreValue: 0.45 },
      { labelEn: '20,000 - 40,000', labelAr: '20,000 - 40,000', numericPoint: 30000, scoreValue: 0.75 },
      { labelEn: 'More than 40,000', labelAr: 'أكثر من 40,000', numericPoint: 55000, scoreValue: 1.0 },
    ],
  },
  {
    code: 'amount_requested', questionEn: 'Amount requested', questionAr: 'المبلغ المطلوب',
    systemRole: 'LOAN_AMOUNT',
    options: [
      { labelEn: 'Below 50,000', labelAr: 'أقل من 50,000', numericPoint: 40000 },
      { labelEn: '50,000 - 150,000', labelAr: '50,000 - 150,000', numericPoint: 100000 },
      { labelEn: '150,000 - 400,000', labelAr: '150,000 - 400,000', numericPoint: 275000 },
      { labelEn: 'More than 400,000', labelAr: 'أكثر من 400,000', numericPoint: 600000 },
    ],
  },
  {
    code: 'repayment_tenor', questionEn: 'Repayment period', questionAr: 'مدة السداد',
    systemRole: 'TENOR',
    options: [
      { labelEn: '36 months', labelAr: '36 شهر', numericPoint: 36 },
      { labelEn: '48 months', labelAr: '48 شهر', numericPoint: 48 },
      { labelEn: '60 months', labelAr: '60 شهر', numericPoint: 60 },
    ],
  },
  {
    code: 'your_age', questionEn: 'Your age', questionAr: 'عمرك',
    systemRole: 'AGE',
    options: [
      { labelEn: '21 - 30', labelAr: '21 - 30', numericPoint: 26 },
      { labelEn: '31 - 45', labelAr: '31 - 45', numericPoint: 38 },
      { labelEn: '46 - 60', labelAr: '46 - 60', numericPoint: 52 },
    ],
  },
  {
    code: 'employment_status', questionEn: 'Employment type', questionAr: 'نوع الوظيفة',
    profileField: 'employment.employmentType',
    options: [
      { labelEn: 'Government employee', labelAr: 'موظف حكومي', profileValue: 'government_employee' },
      { labelEn: 'Private employee', labelAr: 'موظف قطاع خاص', profileValue: 'private_employee' },
      { labelEn: 'Business owner', labelAr: 'صاحب عمل', profileValue: 'business_owner' },
    ],
  },
  {
    code: 'salary_transfer', questionEn: 'Is your salary transferred to the bank?', questionAr: 'هل يتم تحويل راتبك للبنك؟',
    profileField: 'employment.salaryTransferType', scoringFactorCode: 'salary_transferred',
    options: [
      { labelEn: 'Yes', labelAr: 'نعم', profileValue: 'full_transfer', scoreValue: 1.0 },
      { labelEn: 'No', labelAr: 'لا', profileValue: 'no_transfer', scoreValue: 0.2 },
    ],
  },
  {
    code: 'job_tenure', questionEn: 'Years in current job', questionAr: 'سنوات في الوظيفة الحالية',
    scoringFactorCode: 'job_stability', profileField: 'employment.monthsInJob',
    options: [
      { labelEn: 'Less than 1 year', labelAr: 'أقل من سنة', profileValue: '6', scoreValue: 0.2 },
      { labelEn: '1 - 3 years', labelAr: '1 - 3 سنوات', profileValue: '24', scoreValue: 0.6 },
      { labelEn: 'More than 3 years', labelAr: 'أكثر من 3 سنوات', profileValue: '60', scoreValue: 1.0 },
    ],
  },
  {
    code: 'current_installments', questionEn: 'Current monthly installments', questionAr: 'الأقساط الشهرية الحالية',
    systemRole: 'CURRENT_INSTALLMENTS',
    options: [
      { labelEn: 'None', labelAr: 'لا يوجد', numericPoint: 0 },
      { labelEn: 'Up to 3,000', labelAr: 'حتى 3,000', numericPoint: 3000 },
      { labelEn: 'More than 3,000', labelAr: 'أكثر من 3,000', numericPoint: 6000 },
    ],
  },
];

async function main(): Promise<void> {
  // 1) Factors
  for (const f of FACTORS) {
    await prisma.scoringFactor.upsert({
      where: { uniq_scoring_factor_category_code: { category: CATEGORY, code: f.code } },
      update: { labelEn: f.labelEn, labelAr: f.labelAr, kind: f.kind, sourceQuestionCode: f.sourceQuestionCode },
      create: {
        category: CATEGORY, code: f.code, kind: f.kind, labelEn: f.labelEn, labelAr: f.labelAr,
        sourceQuestionCode: f.sourceQuestionCode,
      },
    });
  }

  // 2) Group + questions + options
  const group = await prisma.questionGroup.upsert({
    where: { uniq_question_group_category_code: { category: CATEGORY, code: 'financing_info' } },
    update: {},
    create: { category: CATEGORY, code: 'financing_info', titleEn: 'Financing Information', titleAr: 'معلومات التمويل', displayOrder: 1 },
  });

  let qOrder = 0;
  for (const q of QUESTIONS) {
    qOrder += 1;
    const question = await prisma.question.upsert({
      where: { uniq_question_category_code: { category: CATEGORY, code: q.code } },
      update: {
        questionEn: q.questionEn, questionAr: q.questionAr, displayOrder: qOrder,
        systemRole: (q.systemRole as never) ?? null, scoringFactorCode: q.scoringFactorCode ?? null,
        profileField: q.profileField ?? null,
      },
      create: {
        groupId: group.id, category: CATEGORY, code: q.code, type: 'SINGLE_SELECT',
        questionEn: q.questionEn, questionAr: q.questionAr, displayOrder: qOrder,
        systemRole: (q.systemRole as never) ?? null, scoringFactorCode: q.scoringFactorCode ?? null,
        profileField: q.profileField ?? null,
      },
    });
    let oOrder = 0;
    for (const o of q.options) {
      oOrder += 1;
      const code = slug(o.labelEn);
      await prisma.questionOption.upsert({
        where: { uniq_question_option_question_code: { questionId: question.id, code } },
        update: {
          labelEn: o.labelEn, labelAr: o.labelAr, displayOrder: oOrder,
          numericPoint: o.numericPoint ?? null, scoreValue: o.scoreValue ?? null, profileValue: o.profileValue ?? null,
        },
        create: {
          questionId: question.id, code, labelEn: o.labelEn, labelAr: o.labelAr, displayOrder: oOrder,
          numericPoint: o.numericPoint ?? null, scoreValue: o.scoreValue ?? null, profileValue: o.profileValue ?? null,
        },
      });
    }
  }

  // 3) Publish an active version (assemble snapshot from seeded rows)
  await publishVersion();

  // 4) ACTIVE weight set per active personal program
  const programs = await prisma.bankProgram.findMany({
    where: { active: true, productCategory: CATEGORY },
    select: { id: true },
  });
  for (let i = 0; i < programs.length; i++) {
    const p = programs[i]!;
    const weights = WEIGHT_PRESETS[i % WEIGHT_PRESETS.length]!;
    const existingActive = await prisma.scoringWeightSet.findFirst({
      where: { bankProgramId: p.id, status: 'ACTIVE' },
    });
    if (existingActive) {
      // Refresh the ACTIVE set so re-running the seed differentiates weights.
      await prisma.scoringWeightSet.update({ where: { id: existingActive.id }, data: { weights } });
      continue;
    }
    const last = await prisma.scoringWeightSet.findFirst({
      where: { bankProgramId: p.id }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true },
    });
    await prisma.scoringWeightSet.create({
      data: {
        bankProgramId: p.id, status: 'ACTIVE', versionNumber: (last?.versionNumber ?? 0) + 1,
        weights, createdBy: SEED_ACTOR, approvedBy: 'seed-approver', approvedAt: new Date(),
      },
    });
  }

  console.log(`seed-questionnaire: ${QUESTIONS.length} questions, ${FACTORS.length} factors, ${programs.length} program weight sets.`);
}

async function publishVersion(): Promise<void> {
  const groups = await prisma.questionGroup.findMany({
    where: { category: CATEGORY, isActive: true }, orderBy: { displayOrder: 'asc' },
  });
  const snapshotGroups = [];
  for (const g of groups) {
    const questions = await prisma.question.findMany({
      where: { groupId: g.id, isActive: true }, orderBy: { displayOrder: 'asc' },
    });
    const qOut = [];
    for (const q of questions) {
      const options = await prisma.questionOption.findMany({
        where: { questionId: q.id, isActive: true }, orderBy: { displayOrder: 'asc' },
      });
      qOut.push({
        code: q.code, type: q.type, questionAr: q.questionAr, questionEn: q.questionEn,
        helperTextAr: q.helperTextAr, helperTextEn: q.helperTextEn, isRequired: q.isRequired,
        displayOrder: q.displayOrder, enabledWhen: q.enabledWhen ?? null, systemRole: q.systemRole,
        scoringFactorCode: q.scoringFactorCode, profileField: q.profileField,
        options: options.map((o) => ({
          code: o.code, labelAr: o.labelAr, labelEn: o.labelEn, displayOrder: o.displayOrder,
          numericMin: o.numericMin?.toString() ?? null, numericMax: o.numericMax?.toString() ?? null,
          numericPoint: o.numericPoint?.toString() ?? null, scoreValue: o.scoreValue?.toString() ?? null,
          profileValue: o.profileValue ?? null,
        })),
      });
    }
    snapshotGroups.push({ code: g.code, titleAr: g.titleAr, titleEn: g.titleEn, displayOrder: g.displayOrder, questions: qOut });
  }
  const last = await prisma.questionnaireVersion.findFirst({
    where: { category: CATEGORY }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;
  await prisma.questionnaireVersion.updateMany({ where: { category: CATEGORY, isActive: true }, data: { isActive: false } });
  await prisma.questionnaireVersion.create({
    data: {
      category: CATEGORY, versionNumber, isActive: true, publishedAt: new Date(), publishedBy: SEED_ACTOR,
      snapshot: { category: CATEGORY, versionNumber, groups: snapshotGroups },
    },
  });
}

function slug(label: string): string {
  return label.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_').slice(0, 60) || 'opt';
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
