/**
 * The applicant's existing relationship with the bank being quoted — a DERIVED fact.
 *
 * Several banks price a compound-ownership guarantee off two columns: one for a customer
 * they do not have yet, a higher one for a customer they already do ("top-up", "X-SELL").
 * The uplift is not one percentage — 2M → 3M on an apartment but 4M → 4.5M on a villa —
 * so it is a second column, and something has to say which column an applicant reads.
 *
 * ─── Why this is derived, not a registry fact ─────────────────────────────────
 *
 * Every other fact is ONE answer read by every program. This one is a different answer for
 * every program: the same customer is new to one bank and existing at another. So the
 * QUESTION is bank-agnostic — "which banks do you already use?", one multi-select — and the
 * FACT is computed per program from that answer and the program's own bank.
 *
 * It is also the only shape that could work: `MULTI_SELECT` is deliberately not bindable as
 * a registry fact (`BINDABLE_QUESTION_TYPES`) because a multi-pick answer has no single
 * value to look up. Here there IS a single value — a membership test against one bank.
 *
 * ─── Why the slug, and why it is shared ───────────────────────────────────────
 *
 * The option codes of the question and the bank names on the programs have to agree, and
 * they are written by different files (`seed-questionnaire.ts` authors the options, the
 * engine reads `BankProgramSnapshot.bankName`). One pure function derives both, so a bank
 * renamed in one place cannot quietly stop matching in the other.
 */

import type { ApplicantProfile, SurrogateFactValue } from '../types';

/** The fact key a rule names, and the question whose answer feeds it. */
export const BANK_RELATIONSHIP_FACT_KEY = 'bank_relationship';
export const BANK_RELATIONSHIP_QUESTION_CODE = 'existing_bank_relationships';

/**
 * The two branches a rule may key off.
 *
 * `ntb` ("new to bank") is the DEFAULT and the first branch by convention: a bank's
 * standard column is the one every applicant can read, and the second column is the
 * exception a bank may or may not sell.
 */
export const BANK_RELATIONSHIP_NEW = 'ntb';
export const BANK_RELATIONSHIP_EXISTING = 'xsell';
export const BANK_RELATIONSHIP_CODES = [BANK_RELATIONSHIP_NEW, BANK_RELATIONSHIP_EXISTING] as const;

/**
 * A bank's display name reduced to a stable option code.
 *
 * Accents are folded rather than stripped byte-wise, because one seeded bank is
 * `Crédit Agricole Egypt` and `credit_agricole_egypt` has to be what both sides produce.
 */
export function bankSlug(bankName: string): string {
  return bankName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Which column this applicant reads at this bank.
 *
 * Always an answer, never "not answered": the question is optional, and a customer who
 * skipped it is quoted as a new customer — the bank's standard column — rather than
 * refused. Saying `fact_not_answered` here would turn an optional question into a
 * requirement for every program that carries a second column.
 */
export function bankRelationshipFact(
  bankName: string | undefined,
  chosenSlugs: readonly string[] | undefined,
): SurrogateFactValue {
  if (!bankName || !chosenSlugs || chosenSlugs.length === 0) {
    return { kind: 'choice', optionCode: BANK_RELATIONSHIP_NEW };
  }
  const slug = bankSlug(bankName);
  return {
    kind: 'choice',
    optionCode: chosenSlugs.includes(slug) ? BANK_RELATIONSHIP_EXISTING : BANK_RELATIONSHIP_NEW,
  };
}

/**
 * Every fact this program may read — the applicant's stored answers, plus the facts the
 * platform derives per program.
 *
 * ONE builder, because two callers now need the same map: the income resolver, which runs a
 * product rule against it, and `quoteProgram`, which reads it for the program's own cap
 * table (`loanLimits.maxLoanByFact`). Two hand-built maps would be two chances for the same
 * applicant to read one column in the income table and the other column in the cap table.
 *
 * Derived FIRST so a stored answer wins a collision. For a real applicant there can be no
 * collision — `surrogateFactsFromAnswers` refuses to emit a derived key — and the one caller
 * that supplies facts directly is the admin's rule-check panel, where the operator is
 * deliberately naming the case they want to see.
 */
export function factsForProgram(args: {
  profile: Pick<ApplicantProfile, 'surrogateFacts' | 'bankRelationshipSlugs'>;
  programBankName?: string;
}): Readonly<Record<string, SurrogateFactValue>> {
  return {
    [BANK_RELATIONSHIP_FACT_KEY]: bankRelationshipFact(
      args.programBankName,
      args.profile.bankRelationshipSlugs,
    ),
    ...(args.profile.surrogateFacts ?? {}),
  };
}
