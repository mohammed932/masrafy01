import { categoryLabel, type LoanCategory } from '@core/loan-category';
import { formatGroupedNumber } from '@core/directives/money-input.directive';
import type { StatusTone } from '@shared/ui';
import { effectParts } from '../answer-effect';
import type {
  AnswerMeaning,
  EmploymentBucket,
  EngineReader,
  EngineRuleQuestion,
  LabelledKey,
  MoneyBinding,
  QuestionRef,
} from './engine-rules.types';
import type { ImpactArea, ImpactWhy } from './engine-rules.rules';

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
  return $localize`:@@qrules.lock_engine:Used in every offer`;
}
export function lockBaseLabel(): string {
  return $localize`:@@qrules.lock_base:Fixed question`;
}
export function lockProgramLabel(): string {
  return $localize`:@@qrules.lock_program:Used by bank programs`;
}

/**
 * The pills on a question: why the engine locks it, if it does, and that it is fixed — every
 * question this tab lists is (v31.0.0, the server lists the marked ones). A lock is a fact, not
 * a fault, so no pill is a warning colour.
 */
export function lockPills(q: EngineRuleQuestion): { label: string; tone: StatusTone }[] {
  const out: { label: string; tone: StatusTone }[] = [];
  if (q.lock?.reason === 'engine') out.push({ label: lockEngineLabel(), tone: 'info' });
  if (q.lock?.reason === 'program') out.push({ label: lockProgramLabel(), tone: 'neutral' });
  out.push({ label: lockBaseLabel(), tone: 'tonal' });
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

// ---- What it changes -------------------------------------------------------------------------

export function areaLabel(area: ImpactArea): string {
  switch (area) {
    case 'amount':
      return $localize`:@@qrules.area_amount:Loan amount`;
    case 'rate':
      return $localize`:@@qrules.area_rate:Interest rate`;
    case 'term':
      return $localize`:@@qrules.area_term:Loan term`;
    case 'debt_limit':
      return $localize`:@@qrules.area_debt_limit:Debt-burden limit`;
    case 'questions':
      return $localize`:@@qrules.area_questions:Which questions come next`;
    case 'application':
      return $localize`:@@qrules.area_application:What is sent with the application`;
  }
}

/** One plain sentence: why this question moves this part of the quote. */
export function impactWhyText(area: ImpactArea, why: ImpactWhy, isAr: boolean): string {
  switch (why.kind) {
    case 'requested_amount':
      return $localize`:@@qrules.why_requested_amount:Every quote is priced on the amount asked for`;
    case 'tenor_months':
      return area === 'rate'
        ? $localize`:@@qrules.why_tenor_rate:Some banks' rate tables change with the term`
        : $localize`:@@qrules.why_tenor_term:Every quote is priced on the term asked for`;
    case 'monthly_income':
      return area === 'debt_limit'
        ? $localize`:@@qrules.why_income_dbr:The share of income that can go to debts is measured against it`
        : $localize`:@@qrules.why_income_amount:How much can be lent is worked out from it`;
    case 'obligations':
      return area === 'debt_limit'
        ? $localize`:@@qrules.why_obligations_dbr:Counted as a monthly debt`
        : $localize`:@@qrules.why_obligations_amount:Every debt leaves less room for the new installment`;
    case 'debt_types':
      return area === 'questions'
        ? $localize`:@@qrules.why_debt_types_questions:Each debt picked asks for its own amount`
        : $localize`:@@qrules.why_debt_types_dbr:Picks which debts are counted`;
    case 'employment_type':
      switch (area) {
        case 'rate':
          return $localize`:@@qrules.why_job_rate:Banks' rate tables are keyed by the job type`;
        case 'term':
          return $localize`:@@qrules.why_job_term:The longest term a bank allows is keyed by the job type`;
        case 'debt_limit':
          return $localize`:@@qrules.why_job_dbr:The debt-burden cap is keyed by the job type`;
        default:
          return $localize`:@@qrules.why_job_amount:The largest loan a bank allows is keyed by the job type`;
      }
    case 'months_in_job':
      return $localize`:@@qrules.why_months_rate:Some rate tables change with the years in the job`;
    case 'salary_transfer':
      return area === 'rate'
        ? $localize`:@@qrules.why_transfer_rate:Picks the salary-transfer row of the rate table`
        : $localize`:@@qrules.why_transfer_amount:Some banks lend more when the salary is transferred`;
    case 'platform_fact': {
      const facts = joined(
        why.reader.facts.map((f) => labelOf(f, isAr)),
        isAr,
      );
      return $localize`:@@qrules.why_fact_amount:Feeds ${facts}:facts:, which scales or caps the amount`;
    }
    case 'programs': {
      const count = why.count;
      return $localize`:@@qrules.why_programs_amount:Sets the amount offered under ${count}:count: program names`;
    }
    case 'app_mapping':
      return $localize`:@@qrules.why_app:The app sends what each answer means with the application`;
    case 'follow_ups': {
      const count = why.answers;
      return $localize`:@@qrules.why_follow_ups:${count}:count: of its answers open or hide other questions`;
    }
    case 'answer_effects': {
      const count = why.answers;
      return $localize`:@@qrules.why_answer_effects:${count}:count: of its answers change it, as set on the answer`;
    }
    case 'range_effects': {
      const count = why.ranges;
      return $localize`:@@qrules.why_range_effects:${count}:count: ranges of the number change it, as set on the question`;
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
    case 'offer_effect':
      return effectParts(m).join(' · ');
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

// ---- The picker -------------------------------------------------------------------------------

/** The quiet line under a question in the picker. */
export function pickMeta(q: EngineRuleQuestion, numbered: number, isAr: boolean): string {
  if (q.type === 'TEXT') return $localize`:@@qrules.meta_text:Text`;
  if (q.options.length === 0) {
    const unit = (isAr ? q.numeric?.unitAr : q.numeric?.unitEn) ?? '';
    return unit === ''
      ? $localize`:@@qrules.meta_number:Number`
      : $localize`:@@qrules.meta_number_unit:Number in ${unit}:unit:`;
  }
  const count = q.options.length;
  const answers = $localize`:@@qrules.meta_answers:${count}:count: answers`;
  if (numbered === 0) return answers;
  const withNumbers = $localize`:@@qrules.meta_numbered:${numbered}:count: with numbers`;
  return `${answers} · ${withNumbers}`;
}

/** The quiet tag a follow-up carries in the picker. */
export function followUpTag(): string {
  return $localize`:@@qrules.meta_follow_up:follow-up`;
}

/**
 * When a question is asked, in one sentence. Every question on this screen is mandatory, so
 * this says WHEN — "Always", or which answer of which question opens it — never whether.
 */
export function askedWhenText(q: EngineRuleQuestion, isAr: boolean): string {
  const when = q.askedWhen;
  if (when === null) return $localize`:@@qrules.asked_always:Always`;
  const question = quoted([when.question], isAr);
  const or = $localize`:@@qrules.or:or`;
  // Each answer quoted, so one with a dash in it ("Lawyer — with another business") still
  // reads as one answer; commas between, "or" before the last.
  const names = when.answers.map((a) => (isAr ? `«${a.labelAr}»` : `“${a.labelEn}”`));
  const last = names.pop() ?? '';
  const answers = names.length === 0 ? last : `${joined(names, isAr)} ${or} ${last}`;
  return when.except
    ? $localize`:@@qrules.asked_unless:Unless the answer to ${question}:question: is ${answers}:answers:`
    : $localize`:@@qrules.asked_only_when:Only when the answer to ${question}:question: is ${answers}:answers:`;
}

// ---- How the answers are used, when no answer carries a meaning of its own ------------------

/**
 * When the server states no meaning for any answer (the app or a bank table owns it), one
 * plain line per reader saying who turns the answer into something — so the column is not
 * left as a row of dashes with no explanation. A question nothing reads yet (the owner's
 * register, tax card, payroll, governorate and bank-statement questions) says exactly that:
 * the answer is kept on the application, and no rule prices it.
 */
export function usageNotes(q: EngineRuleQuestion, isAr: boolean): string[] {
  const out: string[] = [];
  for (const r of q.readers) {
    switch (r.kind) {
      case 'programs':
        out.push(
          $localize`:@@qrules.usage_programs:Bank programs look each answer up in their own tables.`,
        );
        break;
      case 'app_mapping':
        out.push(
          $localize`:@@qrules.usage_app:The app turns each answer into a figure it sends with the application.`,
        );
        break;
      case 'platform_fact': {
        const facts = joined(
          r.facts.map((f) => labelOf(f, isAr)),
          isAr,
        );
        out.push($localize`:@@qrules.usage_fact:Each answer sets the customer's ${facts}:facts:.`);
        break;
      }
      default:
        break;
    }
  }
  if (out.length === 0) {
    out.push(
      $localize`:@@qrules.usage_saved:Saved with the application. No bank rule prices this answer yet.`,
    );
  }
  return out;
}
