/**
 * The words for the predefined products — and the only place a bank's published figure
 * appears anywhere in this feature.
 *
 * ─── Why the words are HERE and not on the wire ───────────────────────────────
 *
 * Same reason the starter shapes' words are (`product-shape-picker.component.ts`): a label
 * sent from the server would be English on the wire, which the platform does not do
 * (Principle III / A2), and it would be untranslatable. The server sends a key; this bundle
 * says what it means, in whichever locale the operator is reading.
 *
 * ─── Why the FIGURES are here too ─────────────────────────────────────────────
 *
 * Every number below is what one bank publishes on one sheet, shown in grey beside an empty
 * box so the operator can see what belongs there. It is never saved, never sent, and never
 * read by anything that quotes: the blueprint on the server carries no figures at all, and a
 * test asserts that. Keeping them on the screen is what keeps that true — a default in the
 * template layer would become somebody's live table the first time nobody overwrote it.
 *
 * A bank is NAMED in an example only where the sheet is the source of the number and naming
 * it is what makes the number checkable. It is display text: no code branches on it, and the
 * product it describes is sold by several banks off the same mechanism.
 */

/** 24×24 stroke glyphs, drawn to the same weight as the starter shapes' set. */
const GLYPH = {
  rank: 'M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8z',
  years: 'M3 6h7v4H3zM3 14h12v4H3zM14 6h7v4h-7z',
  card: 'M3 6h18v12H3zM3 10h18M6 14h4',
  car: 'M5 16h14M6 16l1-5h10l1 5M8 19h2M14 19h2M4 11h16',
  vault: 'M4 4h16v16H4zm8 4a4 4 0 100 8 4 4 0 000-8zm0 0v-2m0 12v-2m4-4h2M6 12H4',
  compound: 'M12 3 3 8l9 5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  school: 'M12 4 3 9l9 5 9-5zM7 12v5c0 1 2.2 2 5 2s5-1 5-2v-5',
  coding: 'M4 5h16v4H4zM4 15h16v4H4zM8 9v6',
  club: 'M12 3a4 4 0 100 8 4 4 0 000-8zM5 21c0-3.9 3.1-7 7-7s7 3.1 7 7',
} as const;

export interface BlueprintCopy {
  /** What the product IS, in one noun phrase. Overrides the server's default name. */
  title: string;
  /** How the figure is worked out, in one sentence an operator can check against a sheet. */
  mechanism: string;
  /** What one published sheet puts in these boxes. Grey, never saved. */
  example: string;
  glyph: string;
}

/**
 * Thunks, not strings: `$localize` resolves at call time, so a map evaluated at module load
 * would freeze the first locale it saw for the life of the bundle.
 */
const COPY: Readonly<Record<string, () => BlueprintCopy>> = {
  armed_forces_grades: () => ({
    title: $localize`:@@bpl.armed.title:Egyptian Armed Forces`,
    mechanism: $localize`:@@bpl.armed.mech:The customer states their grade, and the bank assumes that grade earns a set amount every month.`,
    example: $localize`:@@bpl.armed.eg:One sheet pays 75,000 for a Major General down to 18,000 for a First Lieutenant.`,
    glyph: GLYPH.rank,
  }),
  academic_rank_table: () => ({
    title: $localize`:@@bpl.rank.title:University Professors`,
    mechanism: $localize`:@@bpl.rank.mech:A table by rank, and a second column for a private university where a bank prices those differently.`,
    example: $localize`:@@bpl.rank.eg:One sheet pays a Dean 100,000 and a teaching assistant 12,000; another pays 300,000 and 20,000 at private universities.`,
    glyph: GLYPH.rank,
  }),
  years_in_practice_bands: () => ({
    title: $localize`:@@bpl.years.title:Doctors (In Practice)`,
    mechanism: $localize`:@@bpl.years.mech:The customer states how many years they have practised, and the bank has a row for the bracket it falls in — by city tier where it prices those apart.`,
    example: $localize`:@@bpl.years.eg:One sheet pays 30,000 at 3–5 years and 300,000 above 20, and caps the loan at 1,500,000 in Cairo against 500,000 elsewhere.`,
    glyph: GLYPH.years,
  }),
  card_limit_share: () => ({
    title: $localize`:@@bpl.card.title:PL Cross Sell to Credit Card`,
    mechanism: $localize`:@@bpl.card.mech:The bank treats a percentage of the limit on a card the customer holds elsewhere as their monthly income.`,
    example: $localize`:@@bpl.card.eg:One sheet takes half: a 60,000 limit reads as 30,000 a month.`,
    glyph: GLYPH.card,
  }),
  auto_loan_crosssell: () => ({
    title: $localize`:@@bpl.auto.title:PL Cross Sell to Auto Loan`,
    mechanism: $localize`:@@bpl.auto.mech:Two ways at once — a multiple of the instalment they already pay, or a share of what the car loan was — and the lower of the two.`,
    example: $localize`:@@bpl.auto.eg:One sheet takes 3× the instalment or 10% of the loan, whichever is less.`,
    glyph: GLYPH.car,
  }),
  pledged_collateral_share: () => ({
    title: $localize`:@@bpl.pledged.title:Liabilities Cross Sell (CDs Holder)`,
    mechanism: $localize`:@@bpl.pledged.mech:A share of a certificate or deposit they put up as collateral, with a cap by how large it is and a condition on how long they have held it.`,
    example: $localize`:@@bpl.pledged.eg:One sheet takes 30% of the free amount and caps the loan at 500,000 under 2M, rising to 2,000,000 at 10M and above.`,
    glyph: GLYPH.vault,
  }),
  compound_owner: () => ({
    title: $localize`:@@bpl.compound.title:Compound Owner`,
    mechanism: $localize`:@@bpl.compound.mech:Four ways to the same ceiling — the class the compound is filed under, the bracket of what they have paid, a share of what they have paid, or the kind of unit — and the lower of whichever ones a bank fills.`,
    example: $localize`:@@bpl.compound.eg:One sheet lends 15% of everything paid; another 6,000,000 against a Class AA compound; a third 4,000,000 against a villa.`,
    glyph: GLYPH.compound,
  }),
  school_stage_ceiling: () => ({
    title: $localize`:@@bpl.stage.title:Teachers — Predefined Limit`,
    mechanism: $localize`:@@bpl.stage.mech:A ceiling by stage, with a second column for an international school.`,
    example: $localize`:@@bpl.stage.eg:One sheet lends 200,000 for primary and 600,000 for secondary at an international school; half that at a national one.`,
    glyph: GLYPH.school,
  }),
  company_coding_cap: () => ({
    title: $localize`:@@bpl.coding.title:Salaried — Company Coding`,
    mechanism: $localize`:@@bpl.coding.mech:No income is worked out — the customer has a payslip. This only caps what the bank will lend, by the code it files their employer under.`,
    example: $localize`:@@bpl.coding.eg:One sheet caps CAT A at 6,000,000, CAT B at 1,000,000 and CAT C at 500,000.`,
    glyph: GLYPH.coding,
  }),
  school_type_cap: () => ({
    title: $localize`:@@bpl.schooltype.title:Teachers — Standard`,
    mechanism: $localize`:@@bpl.schooltype.mech:A cap on top of a real payslip — the bank checks the income the normal way and will not lend past the ceiling for that kind of school.`,
    example: $localize`:@@bpl.schooltype.eg:One sheet caps a national school at 500,000 and an international one at 750,000.`,
    glyph: GLYPH.school,
  }),
  club_branch_cap: () => ({
    title: $localize`:@@bpl.club.title:Club Membership`,
    mechanism: $localize`:@@bpl.club.mech:A cap on top of a real payslip, by the branch the membership is at. Adding a branch later is more rows, not more code.`,
    example: $localize`:@@bpl.club.eg:One sheet caps New Cairo at 750,000, Sheikh Zayed at 510,000 and the main branch at 160,000.`,
    glyph: GLYPH.club,
  }),
};

/**
 * A product the server offers and this bundle has no words for.
 *
 * Falls back to the server's own default name — which is a real name in both locales, just
 * not one written for this screen — rather than to a blank card. A card with a key on it
 * sends somebody to add the copy; a blank one reads as a product that does nothing.
 */
export function blueprintCopy(key: string, fallbackTitle: string): BlueprintCopy {
  const found = COPY[key];
  if (found) return found();
  return { title: fallbackTitle, mechanism: '', example: '', glyph: GLYPH.rank };
}

/** Whether this bundle has words for a key — the thing a test can assert without a locale. */
export function hasBlueprintCopy(key: string): boolean {
  return COPY[key] !== undefined;
}
