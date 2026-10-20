import { categoryLabel, type LoanCategory } from '@core/loan-category';
import { formatGroupedNumber } from '@core/directives/money-input.directive';
import type { StatusTone } from '@shared/ui';
import type {
  AnswerMeaning,
  EmploymentBucket,
  EngineReader,
  EngineRuleQuestion,
  LabelledKey,
  MoneyBinding,
  QuestionRef,
} from './engine-rules.types';

/**
 * Every sentence the "Loan engine rules" tab shows about who reads a question and what an
 * answer means — built from the server's structured kinds (Principle III: the API sends codes
 * and data, the admin's catalog holds the words). Content (a question's wording, a program
 * name) is shown in the UI language; the sentence around it is translated.
 */

/** At most this many program names are spelled out before "+N more". */
const NAMES_SHOWN = 6;

export function labelOf(k: LabelledKey, isAr: boolean): string {
  return isAr ? k.labelAr : k.labelEn;
}

export function wordingOf(q: QuestionRef | EngineRuleQuestion, isAr: boolean): string {
  return isAr ? q.questionAr : q.questionEn;
}

function joined(items: readonly string[], isAr: boolean): string {
  return items.join(isAr ? '، ' : ', ');
}

function categoriesText(list: readonly LoanCategory[], isAr: boolean): string {
  return joined(
    list.map((c) => categoryLabel(c)),
    isAr,
  );
}

function quoted(questions: readonly QuestionRef[], isAr: boolean): string {
  return joined(
    questions.map((q) => (isAr ? `«${q.questionAr}»` : `“${q.questionEn}”`)),
    isAr,
  );
}

// ---- Lock -----------------------------------------------------------------------------------

export function lockEngineLabel(): string {
  return $localize`:@@qrules.lock_engine:Every quote`;
}
export function lockBaseLabel(): string {
  return $localize`:@@qrules.lock_base:Fixed income-proof set`;
}
export function lockProgramLabel(): string {
  return $localize`:@@qrules.lock_program:Bank programs`;
}

/**
 * The pills on a question: why it is locked, and — for a question every quote reads that is
 * also one of the fixed income-proof questions — that too. A lock is a fact, not a fault, so
 * no pill is a warning colour.
 */
export function lockPills(q: EngineRuleQuestion): { label: string; tone: StatusTone }[] {
  const out: { label: string; tone: StatusTone }[] = [];
  if (q.lock.reason === 'engine') out.push({ label: lockEngineLabel(), tone: 'info' });
  if (q.lock.reason === 'program') out.push({ label: lockProgramLabel(), tone: 'neutral' });
  if (q.lock.shapeFixed || q.lock.reason === 'base') {
    out.push({ label: lockBaseLabel(), tone: 'tonal' });
  }
  return out;
}

// ---- Who reads it ---------------------------------------------------------------------------

function moneyReader(binding: MoneyBinding): string {
  switch (binding) {
    case 'requested_amount':
      return $localize`:@@qrules.reader_money_requested_amount:The loan amount every quote is priced on`;
    case 'tenor_months':
      return $localize`:@@qrules.reader_money_tenor_months:The loan term every quote is priced on`;
    case 'monthly_income':
      return $localize`:@@qrules.reader_money_monthly_income:The monthly income every quote is worked out from`;
    case 'existing_obligations':
      return $localize`:@@qrules.reader_money_existing_obligations:The monthly commitments every quote subtracts`;
  }
}

export function readerText(r: EngineReader, isAr: boolean): string {
  switch (r.kind) {
    case 'money_input':
      return moneyReader(r.binding);
    case 'debt_types':
      return $localize`:@@qrules.reader_debt_types:Which debts are counted — each one asks for its own amount`;
    case 'obligation_amount': {
      if (r.monthlyPercent === null) {
        return $localize`:@@qrules.reader_obligation:A monthly debt every quote counts`;
      }
      const percent = formatGroupedNumber(r.monthlyPercent);
      return $localize`:@@qrules.reader_card_percent:A card limit every quote counts at ${percent}:percent:% a month`;
    }
    case 'employment_type':
      return $localize`:@@qrules.reader_employment:The job type — banks' debt-burden, term and rate tables are keyed by it`;
    case 'server_input':
      return r.input === 'months_in_job'
        ? $localize`:@@qrules.reader_months_in_job:Read by the server as the months in the current job`
        : $localize`:@@qrules.reader_salary_transfer:Read by the server as the salary-transfer row of the rate table`;
    case 'app_mapping': {
      const types = categoriesText(r.categories, isAr);
      return $localize`:@@qrules.reader_app:The app turns each answer into what it sends with the application (${types}:types:)`;
    }
    case 'platform_fact': {
      const facts = joined(
        r.facts.map((f) => labelOf(f, isAr)),
        isAr,
      );
      return $localize`:@@qrules.reader_platform_fact:Answers a fact the platform owns: ${facts}:facts:`;
    }
    case 'fixed_set': {
      const types = categoriesText(r.categories, isAr);
      return r.servedOn === 'income_proof'
        ? $localize`:@@qrules.reader_base_income_proof:A fixed income-proof question, asked on every payslip program (${types}:types:)`
        : $localize`:@@qrules.reader_base_every_name:A fixed question, asked on every program name (${types}:types:)`;
    }
    case 'programs': {
      const all = r.programNames.map((p) => labelOf(p, isAr));
      const count = all.length - NAMES_SHOWN;
      const shown = joined(all.slice(0, NAMES_SHOWN), isAr);
      const names =
        count > 0 ? `${shown} ${$localize`:@@qrules.more:+${count}:count: more`}` : shown;
      return $localize`:@@qrules.reader_programs:Read by bank programs sold as: ${names}:names:`;
    }
  }
}

// ---- What an answer means -------------------------------------------------------------------

function bucketLabel(bucket: EmploymentBucket): string {
  switch (bucket) {
    case 'salaried':
      return $localize`:@@bank_programs.employment.salaried:Salaried`;
    case 'self_employed':
      return $localize`:@@bank_programs.employment.self_employed:Self-employed`;
    case 'retired':
      return $localize`:@@bank_programs.employment.retired:Retired`;
  }
}

export function meaningText(m: AnswerMeaning, isAr: boolean): string {
  switch (m.kind) {
    case 'job': {
      const bucket = bucketLabel(m.bucket);
      return $localize`:@@qrules.meaning_bucket:Priced as ${bucket}:bucket:`;
    }
    case 'iscore_band': {
      const from = m.from ?? '';
      const to = m.to ?? '';
      if (m.from !== null && m.to !== null) {
        return $localize`:@@qrules.meaning_iscore_range:Scores ${from}:from: to ${to}:to:`;
      }
      return m.from !== null
        ? $localize`:@@qrules.meaning_iscore_from:Scores ${from}:from: and up`
        : $localize`:@@qrules.meaning_iscore_upto:Scores up to ${to}:to:`;
    }
    case 'iscore_none':
      return $localize`:@@qrules.meaning_iscore_none:No bureau score`;
    case 'transfer': {
      const row = labelOf(m.transferType, isAr);
      return $localize`:@@qrules.meaning_transfer:Reads the “${row}:row:” row of the rate table`;
    }
    case 'debt_amount': {
      const question = quoted([m.question], isAr);
      return $localize`:@@qrules.meaning_debt_amount:Asks for its amount: ${question}:question:`;
    }
    case 'no_debts':
      return $localize`:@@qrules.meaning_no_debts:Monthly debts counted as zero`;
    case 'opens': {
      const questions = quoted(m.questions, isAr);
      return $localize`:@@qrules.meaning_opens:Opens: ${questions}:questions:`;
    }
    case 'hides': {
      const questions = quoted(m.questions, isAr);
      return $localize`:@@qrules.meaning_hides:Hides: ${questions}:questions:`;
    }
  }
}

// ---- A number or text question's fixed rule -------------------------------------------------

export function numericRuleParts(q: EngineRuleQuestion, isAr: boolean): string[] {
  const n = q.numeric;
  if (n === null) return [$localize`:@@qrules.rule_number:A number`];
  const out: string[] = [];
  const unit = (isAr ? n.unitAr : n.unitEn) ?? '';
  if (unit !== '') out.push($localize`:@@qrules.rule_unit:In ${unit}:unit:`);
  if (n.minValue !== null) {
    const min = formatGroupedNumber(n.minValue);
    out.push($localize`:@@qrules.rule_min:At least ${min}:min:`);
  }
  if (n.maxValue !== null) {
    const max = formatGroupedNumber(n.maxValue);
    out.push($localize`:@@qrules.rule_max:At most ${max}:max:`);
  }
  if (n.step !== null) {
    const step = formatGroupedNumber(n.step);
    out.push($localize`:@@qrules.rule_step:In steps of ${step}:step:`);
  }
  return out;
}

export function textRuleText(q: EngineRuleQuestion): string {
  if (q.text === null) return $localize`:@@qrules.rule_text:Free text`;
  const max = q.text.maxLength;
  return $localize`:@@qrules.rule_text_max:Free text, up to ${max}:max: characters`;
}

/** The quantities a label has to keep, as one line: `1 · 3 · million`. */
export function keepLine(written: readonly string[]): string {
  return written.join(' · ');
}
