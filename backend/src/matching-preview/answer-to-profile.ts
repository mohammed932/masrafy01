import { Decimal } from '@prisma/client/runtime/library';
import { APPLICATION_PRIORITIES, type ApplicantProfile } from '@/matching/types';

export interface SnapshotOptionFull {
  code: string;
  numericPoint: string | null;
  profileValue: string | null;
}
export interface SnapshotQuestionFull {
  code: string;
  systemRole: string | null;
  profileField: string | null;
  options: SnapshotOptionFull[];
}

/** Booleans: yes/true/1 → true. */
function toBool(v: string): boolean {
  return ['true', 'yes', '1', 'y'].includes(v.trim().toLowerCase());
}

/**
 * Build an engine `ApplicantProfile` from dynamic questionnaire answers using
 * the snapshot's `systemRole` (arithmetic, value = option.numericPoint) and
 * `profileField` (categorical, value = option.profileValue) mappings. Unmapped
 * fields fall back to safe neutral defaults so the engine can still run; the
 * resulting eligibility is only as complete as the admin's mappings.
 */
export function buildApplicantProfile(args: {
  category: string;
  questions: SnapshotQuestionFull[];
  answers: ReadonlyArray<{ questionCode: string; optionCode: string }>;
}): ApplicantProfile {
  const profile: ApplicantProfile = {
    age: 30,
    loanPurpose: args.category,
    requestedAmountEGP: new Decimal(0),
    requestedCurrency: 'EGP',
    preferredTenorMonths: 60,
    priority: APPLICATION_PRIORITIES[0],
    employment: {
      employmentType: '',
      monthlyNetSalaryEGP: new Decimal(0),
      monthsInJob: 0,
      salaryTransferType: '',
      companyName: '',
      companyType: '',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal(0),
      hasCurrentLoan: false,
      hasPreviousRejection: false,
    },
    assets: {},
  };

  const byCode = new Map(args.questions.map((q) => [q.code, q]));
  for (const ans of args.answers) {
    const q = byCode.get(ans.questionCode);
    if (!q) continue;
    const opt = q.options.find((o) => o.code === ans.optionCode);
    if (!opt) continue;

    if (q.systemRole && opt.numericPoint !== null) {
      applySystemRole(profile, q.systemRole, opt.numericPoint);
    }
    if (q.profileField && opt.profileValue !== null) {
      applyProfileField(profile, q.profileField, opt.profileValue);
    }
  }
  return profile;
}

function applySystemRole(p: ApplicantProfile, role: string, point: string): void {
  const dec = new Decimal(point);
  const num = Number(point);
  switch (role) {
    case 'SALARY':
      p.employment.monthlyNetSalaryEGP = dec;
      break;
    case 'LOAN_AMOUNT':
      p.requestedAmountEGP = dec;
      break;
    case 'AGE':
      p.age = Math.round(num);
      break;
    case 'TENOR':
      p.preferredTenorMonths = Math.round(num);
      break;
    case 'CURRENT_INSTALLMENTS':
      p.obligations.existingMonthlyObligationsEGP = dec;
      p.obligations.hasCurrentLoan = dec.greaterThan(0);
      break;
    // DOWN_PAYMENT requires mortgage/car detail objects — handled via profileField.
  }
}

function applyProfileField(p: ApplicantProfile, field: string, value: string): void {
  const [root, leaf] = field.split('.');
  if (!root) return;
  if (root === 'employment' && leaf) {
    setLeaf(p.employment as unknown as Record<string, unknown>, leaf, value);
  } else if (root === 'obligations' && leaf) {
    setLeaf(p.obligations as unknown as Record<string, unknown>, leaf, value);
  } else if (root === 'assets' && leaf) {
    setLeaf(p.assets as unknown as Record<string, unknown>, leaf, value);
  } else if (!leaf) {
    setLeaf(p as unknown as Record<string, unknown>, root, value);
  }
}

/** Coerce a string value to the right type based on the field-name convention. */
function setLeaf(target: Record<string, unknown>, key: string, value: string): void {
  if (key.endsWith('EGP') || key.endsWith('Percent')) {
    target[key] = new Decimal(value);
  } else if (/^(has|is|owns)/.test(key) || key === 'clubMembership') {
    target[key] = toBool(value);
  } else if (/(months|years|age|Months)/.test(key)) {
    target[key] = Math.round(Number(value));
  } else {
    target[key] = value;
  }
}
