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
 * `IncomeBasis` is what an admin sees, and since v20.1.1 the words are the wire words'
 * own — "Income proof" and "Surrogate". They are still translated here rather than
 * printed off the enum: the wire value is snake_case, the label is a locale string with
 * an Arabic target, and one file owning the pair is what keeps the six screens that ask
 * this question from drifting apart.
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

/**
 * Short label — a chip, a tag, a table cell.
 *
 * The words are the two the platform names its income types by — "Income proof" and
 * "Surrogate" — NOT a description of the document ("Reads a payslip" / "No payslip",
 * which is what these read until v20.1.1). The two are the same distinction, but the
 * old pair named one type by what it lacks, which reads as an exception rather than as
 * one of two peers, and matched nothing else on the screens beside it (Surrogate
 * products, the surrogate accent, `income_surrogate` on the wire).
 *
 * A payslip is still the right word in a SENTENCE that explains what a bank reads —
 * see `incomeBasisHint` below, which deliberately keeps it.
 */
export function incomeBasisLabel(basis: IncomeBasis): string {
  return basis === 'no_payslip'
    ? $localize`:@@income_basis.no_payslip:Surrogate`
    : $localize`:@@income_basis.payslip:Income proof`;
}

/**
 * The plain-English explanation under a choice card.
 *
 * Says what the bank DOES, in the words someone who has never read the schema would
 * use: "income-surrogate" told the operator nothing, and the wrong pick here changes
 * what two later wizard steps mean.
 *
 * Names no STEP NUMBER. This line is rendered by the program wizard AND by the catalog
 * name dialog, which has no steps at all — and the number it used to give ("step 4")
 * silently became wrong the day the wizard gained a step. Where the table is entered is
 * the wizard's own business, so the wizard says it, by step NAME.
 */
export function incomeBasisHint(basis: IncomeBasis): string {
  return basis === 'no_payslip'
    ? // Which facts exist is the registry's answer (operator-managed on Manage values),
      // so this line names none of them: a hardcoded four went stale the day someone
      // added a fifth, and the screens below already list the live set. The two
      // examples are illustrative and flagged as such by "such as".
      $localize`:@@income_basis.no_payslip.hint:The customer has no payslip. The bank works out what they earn from something else about them, such as their job grade or years of work.`
    : $localize`:@@income_basis.payslip.hint:The customer is paid a salary into a bank account. The bank lends against that salary.`;
}
