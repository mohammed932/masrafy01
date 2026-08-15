/**
 * How a bank establishes the income it lends against — the ONE product decision behind
 * every no-payslip surface in the admin.
 *
 * `ProgramType` is the wire value, stored on `bank_program.programType` and read by the
 * matching engine's own gate (`quote.ts#shouldConsultIncomeRule`). It lives here rather
 * than in the bank-programs feature because three features render it (the catalog, the
 * program wizard, the bank detail board) and `core/` is the only place all three may
 * import from. `bank-programs.types.ts` re-exports it, so no call site had to change.
 *
 * `IncomeBasis` is what an admin sees. The wire words — `income_proof`,
 * `income_surrogate` — are never rendered: "Income-surrogate" is a schema noun, and the
 * operator picking it is answering "does this bank read a payslip, or work the income
 * out?". One file owns that translation so the two cannot drift apart across the six
 * screens that ask the question.
 *
 * Note what is NOT here: any list of loan categories. Whether a category can sell a
 * no-payslip program is derived from whether its applicants are asked one of the four
 * surrogate facts — see `categoryAsksAnySurrogateFact` in `surrogate-facts.ts` (v16.0.0).
 */
export type ProgramType = 'income_proof' | 'income_surrogate';

export type IncomeBasis = 'payslip' | 'no_payslip';

/** Presentation order: the ordinary case first, so the default reads as the default. */
export const INCOME_BASES: readonly IncomeBasis[] = ['payslip', 'no_payslip'];

export function basisOf(type: ProgramType): IncomeBasis {
  return type === 'income_surrogate' ? 'no_payslip' : 'payslip';
}

export function programTypeOf(basis: IncomeBasis): ProgramType {
  return basis === 'no_payslip' ? 'income_surrogate' : 'income_proof';
}

/** Short label — a chip, a tag, a table cell. */
export function incomeBasisLabel(basis: IncomeBasis): string {
  return basis === 'no_payslip'
    ? $localize`:@@income_basis.no_payslip:No payslip`
    : $localize`:@@income_basis.payslip:Reads a payslip`;
}

/**
 * The one-line explanation under a choice card. Long enough to say what the bank DOES,
 * because "income-surrogate" told the operator nothing and the wrong pick here silently
 * changes what two later wizard steps mean.
 */
export function incomeBasisHint(basis: IncomeBasis): string {
  return basis === 'no_payslip'
    ? // Which facts exist is the registry's answer (operator-managed on Manage values),
      // so this line names none of them: a hardcoded four went stale the day someone
      // added a fifth, and the screens below already list the live set.
      $localize`:@@income_basis.no_payslip.hint:The bank works the income out from one of the income facts about the applicant. You enter its own table in step 4.`
    : $localize`:@@income_basis.payslip.hint:A salary transfer or payslip proves the income the bank lends against.`;
}
