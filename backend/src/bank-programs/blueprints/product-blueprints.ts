/**
 * The predefined no-payslip products — one entry per product, bank-neutral.
 *
 * Read `product-blueprint.types.ts` first: it states what a blueprint may carry (structure,
 * the questions it asks, the bilingual DB content it writes, the brackets a sheet prints)
 * and what it may never carry (a bank's figure, a bank's name).
 *
 * ─── One card per PRODUCT, not per sheet ──────────────────────────────────────
 *
 * Four banks sell the compound guarantee and each works the ceiling out differently: one
 * reads the class the compound is filed under, one bands the down payment, one takes a share
 * of what has been paid, one keys it by the kind of unit. That is ONE product with four
 * ways, not four products — the engine has carried N ways per product since the template
 * layer shipped, each bank fills the ones it sells, and `combine: 'lower'` clamps a bank that
 * fills two. Four cards would be the same product duplicated, and the fifth bank would
 * mean a fifth card.
 *
 * The line is the MECHANISM plus the terms, though, not the mechanism alone. The two ABK
 * doctor sheets band years in practice identically and were one product for that reason, until
 * the terms were read side by side: different rate, tenor, age floor and maximum, opposite
 * accepted employment types, and a cap on one sheet and none on the other. That is two
 * products — `doctors_clinic_owner` and `doctors_in_practice` — and the applicant says which
 * is theirs by picking its catalog name, so nothing has to be gated to keep them apart.
 *
 * The same reasoning makes one list serve banks that group it differently: the professors'
 * seven ranks cover both the English and the Arabic sheet, and the three city tiers are cut
 * so each bank's own grouping is a union of whole tiers (§10.1). A bank that does not sell a
 * column simply leaves it blank, and `pickByFact` reads the one it filled.
 *
 * ─── Where the numbers are ────────────────────────────────────────────────────
 *
 * Not here. Every figure on every sheet is a BANK's figure and belongs in that bank's
 * program. What an operator sees beside an empty box — "one published sheet pays 30,000
 * here" — is screen copy in the admin bundle, keyed by the same blueprint keys.
 */

import { LoanCategory } from '@prisma/client';
import type { BlueprintCap, ProductBlueprint } from './product-blueprint.types';

const PERSONAL_AND_CAR = [LoanCategory.personal, LoanCategory.car] as const;
const ALL_CATEGORIES = [
  LoanCategory.personal,
  LoanCategory.car,
  LoanCategory.mortgage,
  LoanCategory.business,
] as const;

/**
 * The three city tiers, as migration `20260901120000` cut them.
 *
 * Named here rather than re-derived: they are the branch codes of a class-keyed column, and
 * a column whose branches drift from the class list silently reads the standard column.
 */
const CITY_TIERS = ['city_tier_major', 'city_tier_secondary', 'city_tier_other'] as const;

/**
 * The years-in-practice brackets both ABK doctor sheets print, HALF-OPEN: exactly five years
 * lands in `5–8`, never in `3–5`.
 *
 * Shared by the two doctor products, which band identically and pay figures that differ by
 * half at every row — the difference is a bank's, so it lives in each bank's programme.
 */
const PRACTICE_YEAR_EDGES: readonly { fromInclusive: string; toExclusive: string | null }[] = [
  { fromInclusive: '3', toExclusive: '5' },
  { fromInclusive: '5', toExclusive: '8' },
  { fromInclusive: '8', toExclusive: '11' },
  { fromInclusive: '11', toExclusive: '14' },
  { fromInclusive: '14', toExclusive: '20' },
  { fromInclusive: '20', toExclusive: null },
];

/** The six compound classes, as migration `20260829090000` seeded them. */
const COMPOUND_CLASSES = [
  { key: 'compound_tier_aa', labelEn: 'Class AA', labelAr: 'الفئة AA' },
  { key: 'compound_tier_ab', labelEn: 'Class AB', labelAr: 'الفئة AB' },
  { key: 'compound_tier_a', labelEn: 'Class A', labelAr: 'الفئة A' },
  { key: 'compound_tier_b', labelEn: 'Class B', labelAr: 'الفئة B' },
  { key: 'compound_tier_c', labelEn: 'Class C', labelAr: 'الفئة C' },
  { key: 'compound_tier_other', labelEn: 'Other', labelAr: 'أخرى' },
] as const;

const BLUEPRINTS: readonly ProductBlueprint[] = Object.freeze([
  // -------------------------------------------------------------------------
  // Works out a monthly income
  // -------------------------------------------------------------------------
  {
    key: 'armed_forces_grades',
    group: 'income',
    labelEn: 'Egyptian Armed Forces',
    labelAr: 'القوات المسلحة المصرية',
    asks: [
      {
        kind: 'platformFact',
        factKey: 'military_grade',
        // The seeded list holds three generic grades; the sheets publish seven named ones,
        // and the acceptance test for this product asks for "Major", which had no row.
        //
        // ADDED, never renamed: the three that are there are keys a live bank program's
        // table is filed under, and renaming one orphans that figure while the program
        // still reads as configured (§5.4). They stay pickable until whoever owns that
        // program re-keys it, which is the class-split procedure applied to a value list.
        addValues: {
          typeKey: 'military_grade',
          values: [
            { key: 'grade_major_general', labelEn: 'Major General', labelAr: 'لواء' },
            { key: 'grade_brigadier_general', labelEn: 'Brigadier General', labelAr: 'عميد' },
            { key: 'grade_colonel', labelEn: 'Colonel', labelAr: 'عقيد' },
            { key: 'grade_lt_colonel', labelEn: 'Lieutenant-Colonel', labelAr: 'مقدم' },
            { key: 'grade_major', labelEn: 'Major', labelAr: 'رائد' },
            { key: 'grade_captain', labelEn: 'Captain', labelAr: 'نقيب' },
            { key: 'grade_first_lieutenant', labelEn: 'First Lieutenant', labelAr: 'ملازم أول' },
          ],
        },
      },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      // EVERY income-bearing product adjusts by I-Score (operator decision, 2026-09-06): the
      // multiplier compiles LAST inside the rule, so it lands before `resolveDbrCap` picks a
      // band, and a bank that states no table multiplies by 100% — no figure moves until a bank
      // types one. Declared on the template rather than as a program-level field because two
      // sources of one multiplier would be two authorities (`uplift.scope` documents that trap).
      // The three cap-only products guess no income and have nothing to multiply.
      iScore: true,
      primary: { kind: 'choiceTable', fact: 'military_grade' },
      conditions: [],
    },
  },

  {
    key: 'academic_rank_table',
    group: 'income',
    labelEn: 'University Professors',
    labelAr: 'أساتذة الجامعات',
    asks: [
      {
        kind: 'platformFact',
        factKey: 'academic_rank',
        // Three of the sheets' seven ranks already exist under the keys they need
        // (`lecturer` = مدرس, `assistant_professor`, `professor`), so only four are added.
        // One list then serves both the English sheet's seven positions and the Arabic
        // sheet's six degrees — the granularity rule of §10.1, on a rank axis.
        addValues: {
          typeKey: 'professor_rank',
          values: [
            { key: 'dean', labelEn: 'Dean', labelAr: 'عميد' },
            {
              key: 'professor_section_head',
              labelEn: 'Professor & Section Head',
              labelAr: 'أستاذ ورئيس قسم',
            },
            { key: 'assistant_teacher', labelEn: 'Assistant Teacher', labelAr: 'مدرس مساعد' },
            { key: 'junior_staff', labelEn: 'Junior Staff', labelAr: 'معيد' },
          ],
        },
      },
      {
        kind: 'choice',
        factKey: 'university_type',
        questionEn: 'Is the university government or private?',
        questionAr: 'هل الجامعة حكومية أم خاصة؟',
        helperEn: 'Institutes are not included.',
        helperAr: 'المعاهد غير مشمولة.',
        categories: PERSONAL_AND_CAR,
        list: {
          typeKey: 'university_type',
          labelEn: 'University type',
          labelAr: 'نوع الجامعة',
          values: [
            { key: 'uni_government', labelEn: 'Government', labelAr: 'حكومية' },
            { key: 'uni_private', labelEn: 'Private', labelAr: 'خاصة' },
          ],
        },
      },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      iScore: true,
      primary: { kind: 'choiceTable', fact: 'academic_rank' },
      // A bank that publishes one column leaves the second blank and reads the first. The
      // column exists because one sheet prints two.
      secondColumn: { fact: 'university_type', branches: ['uni_government', 'uni_private'] },
      conditions: [],
    },
    cap: {
      factKey: 'academic_rank',
      columnFactKey: 'university_type',
      onNoMatch: 'useProgramMax',
      rowKeys: [
        'junior_staff',
        'assistant_teacher',
        'lecturer',
        'assistant_professor',
        'professor',
        'dean',
      ],
      columnKeys: ['uni_government', 'uni_private'],
    },
  },

  {
    key: 'doctors_clinic_owner',
    group: 'income',
    // App. A §7 — the doctor who OWNS the clinic.
    //
    // TWO doctor products, not one with two figure sets. The earlier reading was that the two
    // ABK sheets band years in practice identically and only pay differently, which would make
    // them two PROGRAMS of one product (§10.7). They differ by more than figures: 26.5% against
    // 30%, an age floor of 32 against 21, a maximum of 2,000,000 against 1,000,000, opposite
    // accepted employment types, and — the structural half — this one is capped by where the
    // doctor practises while the other carries no cap at all. One card described neither, and
    // the merged product had to invent a yes/no question and two gate conditions to stop both
    // quoting every doctor.
    //
    // Each product now carries its own catalog name, so the applicant states which one is
    // theirs in loan setup and nothing has to be gated to tell them apart.
    labelEn: 'Doctors — Clinic Owners',
    labelAr: 'الأطباء — أصحاب العيادات',
    asks: [
      { kind: 'platformFact', factKey: 'years_in_practice' },
      {
        kind: 'bindQuestion',
        factKey: 'practice_governorate',
        // NOT the mortgage `governorate` question, which asks where the PROPERTY is — in
        // Arabic it says so literally (`في أي محافظة يقع العقار؟`). A personal-loan doctor
        // is being asked where they PRACTISE, and the two answers legitimately differ for a
        // doctor with a clinic in one governorate and a flat in another. Its own question is
        // seeded in `seed-questionnaire.ts` for personal and car, and REQUIRED there: an
        // unanswered fact sends the cap to `onNoMatch`, which is the best cell in the table.
        questionCode: 'practice_governorate',
        // Stated for the same reason as the car instalment above: a bind carries no question
        // text, so `factLabels` falls back to the CODE and the registry row ends up named
        // after its own slug — in the Arabic bundle too, where a Latin slug reads as nothing.
        labelEn: 'Governorate of practice',
        labelAr: 'محافظة مزاولة المهنة',
        alsoAskIn: PERSONAL_AND_CAR,
      },
      { kind: 'derivedFact', factKey: 'loan_is_topup', alsoAskIn: PERSONAL_AND_CAR },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      iScore: true,
      primary: { kind: 'numberBand', fact: 'years_in_practice' },
      // Keyed by the TIER, not by the governorate. One bank groups Cairo and Alexandria
      // against everywhere else, another groups eight governorates against everywhere else,
      // and neither "everywhere else" is the other's — so the branches are whole classes and
      // the next governorate added to the list is priced without touching a bank's table.
      secondColumn: {
        fact: 'practice_governorate',
        branches: [...CITY_TIERS],
        branchOn: 'parentClass',
      },
      conditions: [],
    },
    suggestedBands: [{ wayIndex: 0, edges: [...PRACTICE_YEAR_EDGES] }],
    cap: {
      factKey: 'practice_governorate',
      rowVia: 'parentClass',
      columnFactKey: 'loan_is_topup',
      onNoMatch: 'useProgramMax',
      rowKeys: [...CITY_TIERS],
      columnKeys: ['new_loan', 'top_up'],
    },
  },

  {
    key: 'doctors_in_practice',
    group: 'income',
    // App. A §8 — the doctor EMPLOYED at a private hospital. Read the clinic-owner blueprint
    // above for why these are two products.
    //
    // The sheet prints ONE income table by years and no maximum-loan table, so this product
    // states no second column and no cap. The merged product gave this programme three
    // city-tier slots holding the identical figure three times, which said the bank prices by
    // city when its own sheet does not.
    labelEn: 'Doctors — In Practice',
    labelAr: 'الأطباء — الممارسة',
    // Its only axis. `years_in_practice` is now asked by two blueprints, so it is a SHARED
    // fact and neither product owns it — which is what stops one product going away and
    // taking the other's axis with it.
    asks: [{ kind: 'platformFact', factKey: 'years_in_practice' }],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      iScore: true,
      primary: { kind: 'numberBand', fact: 'years_in_practice' },
      conditions: [],
    },
    suggestedBands: [{ wayIndex: 0, edges: [...PRACTICE_YEAR_EDGES] }],
  },

  {
    key: 'card_limit_share',
    group: 'income',
    labelEn: 'PL Cross Sell to Credit Card',
    labelAr: 'التمويل الشخصي مقابل بطاقة ائتمان',
    asks: [
      // Already asked, in every category, as part of the obligations block — and asking it
      // again would be two answers to one question, free to disagree.
      { kind: 'platformFact', factKey: 'credit_card_limit' },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      iScore: true,
      primary: { kind: 'shareOf', fact: 'credit_card_limit' },
      conditions: [],
    },
  },

  {
    key: 'auto_loan_crosssell',
    group: 'income',
    labelEn: 'PL Cross Sell to Auto Loan',
    labelAr: 'التمويل الشخصي مقابل قرض سيارة',
    asks: [
      {
        kind: 'bindQuestion',
        factKey: 'car_loan_installment',
        // The instalment is already asked as an obligation, with its own branch and its own
        // helper text. A second question would ask the same thing twice.
        questionCode: 'obligation_car_loan',
        // Stated, because `factLabels` falls back to the question CODE when a bind supplies
        // none — `questionAssignments()` carries no question text to fall back to — and the
        // fact's label is what every operator screen renders. Without these the registry row
        // is literally named `obligation_car_loan`, which is what it was called until now.
        labelEn: 'Monthly car loan instalment',
        labelAr: 'القسط الشهري لقرض السيارة',
      },
      {
        kind: 'number',
        factKey: 'auto_loan_amount',
        questionEn: 'How much was the car loan when it started?',
        questionAr: 'كم كان مبلغ قرض السيارة عند بدايته؟',
        helperEn: 'The amount financed, not what is left to pay.',
        helperAr: 'المبلغ الممنوح، وليس المتبقي.',
        numeric: { min: 0, max: 20000000 },
        categories: PERSONAL_AND_CAR,
        enabledWhen: { questionCode: 'current_loans', optionCode: 'car_loan' },
      },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      iScore: true,
      // The genuine same-unit `minOf` the design keeps inside the rule: income against
      // income, three times the instalment or a share of the loan, whichever is lower.
      primary: { kind: 'multipleOf', fact: 'car_loan_installment' },
      alternatives: [{ kind: 'shareOf', fact: 'auto_loan_amount' }],
      combine: 'lower',
      // ONE way with two terms, not two ways: the sheet's whole sentence is the method and a
      // bank fills both halves of it. `waysOfRule` folds the heads into one way, so a program
      // names it (`primary`) and is never asked to choose between halves of one formula.
      waysAre: 'combined',
      conditions: [],
    },
  },

  {
    key: 'pledged_collateral_share',
    group: 'income',
    labelEn: 'Liabilities Cross Sell (CDs Holder)',
    labelAr: 'التمويل مقابل شهادات ادخار مرهونة',
    asks: [
      {
        kind: 'number',
        factKey: 'pledged_free_amount',
        questionEn: 'How much is the certificate or deposit you would pledge?',
        questionAr: 'ما قيمة الشهادة أو الوديعة التي ترغب في رهنها؟',
        helperEn: 'The free amount — what is not already pledged against something else.',
        helperAr: 'المبلغ الحر — وليس المرهون بالفعل مقابل شيء آخر.',
        numeric: { min: 0, max: 100000000 },
        categories: PERSONAL_AND_CAR,
      },
      {
        kind: 'number',
        factKey: 'pledged_months_since_issue',
        questionEn: 'How many months ago was it issued?',
        questionAr: 'منذ كم شهر تم إصدارها؟',
        numeric: { min: 0, max: 600 },
        categories: PERSONAL_AND_CAR,
      },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      iScore: true,
      primary: { kind: 'shareOf', fact: 'pledged_free_amount' },
      conditions: [
        {
          id: 'heldlongenough',
          measure: { of: 'fact', fact: 'pledged_months_since_issue' },
          test: { op: 'atLeast' },
          reasonCode: 'GATE_NOT_MET',
        },
      ],
    },
    cap: {
      factKey: 'pledged_free_amount',
      onNoMatch: 'useProgramMax',
      bands: [
        { fromInclusive: '0', toExclusive: '2000000' },
        { fromInclusive: '2000000', toExclusive: '5000000' },
        { fromInclusive: '5000000', toExclusive: '10000000' },
        { fromInclusive: '10000000', toExclusive: null },
      ],
    },
    usesReasonCodes: ['GATE_NOT_MET'],
  },

  // -------------------------------------------------------------------------
  // Works out a borrowing ceiling
  // -------------------------------------------------------------------------
  {
    key: 'compound_owner',
    group: 'ceiling',
    labelEn: 'Compound Owner',
    labelAr: 'مالك وحدة في كومباوند',
    asks: [
      {
        kind: 'choice',
        factKey: 'compound_name',
        questionEn: 'Which compound is your unit in?',
        questionAr: 'وحدتك في أي كومباوند؟',
        helperEn: 'Pick it by name. If it is not listed, choose "Other".',
        helperAr: 'اختره بالاسم. إذا لم يكن موجودًا اختر «أخرى».',
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
        list: {
          typeKey: 'compound',
          labelEn: 'Compounds',
          labelAr: 'الكومباوندات',
          // The catch-all only. Hundreds of real compounds are loaded by pasting a list —
          // one bank's table stays six class rows however many are added, which is the whole
          // point of the two-list design.
          values: [
            {
              key: 'compound_other',
              labelEn: 'My compound is not listed',
              labelAr: 'الكومباوند غير موجود بالقائمة',
              parentKey: 'compound_tier_other',
            },
          ],
          parent: {
            typeKey: 'compound_category',
            labelEn: 'Compound classes',
            labelAr: 'فئات الكومباوندات',
            values: [...COMPOUND_CLASSES],
            // A compound filed under nothing makes `factParentTable` answer
            // `no_matching_row`, which STOPS the rule — every bank keying by class quotes
            // nothing for that customer. So an unfiled value lands in the catch-all.
            fallbackParentKey: 'compound_tier_other',
          },
        },
      },
      {
        kind: 'choice',
        factKey: 'owned_unit_type',
        questionEn: 'What kind of unit do you own?',
        questionAr: 'ما نوع الوحدة التي تملكها؟',
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
        list: {
          // The list already exists with exactly these three rows.
          typeKey: 'property_type',
          labelEn: 'Property types',
          labelAr: 'أنواع العقارات',
          values: [
            { key: 'apartment', labelEn: 'Apartment', labelAr: 'شقة' },
            { key: 'twin_house', labelEn: 'Twin / Town house', labelAr: 'توين هاوس / تاون هاوس' },
            { key: 'villa', labelEn: 'Villa', labelAr: 'فيلا' },
          ],
        },
      },
      {
        kind: 'number',
        factKey: 'unit_paid_to_date',
        questionEn: 'How much have you paid for the unit so far?',
        questionAr: 'كم دفعت للوحدة حتى الآن؟',
        helperEn: 'The down payment plus every instalment you have paid.',
        helperAr: 'المقدم بالإضافة إلى كل الأقساط التي سددتها.',
        numeric: { min: 0, max: 500000000 },
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
      },
      {
        kind: 'number',
        factKey: 'unit_down_payment',
        questionEn: 'How much was the down payment on the unit?',
        questionAr: 'كم كان مقدم الوحدة؟',
        helperEn: 'The contract payment only — not the instalments you have paid since.',
        helperAr: 'دفعة العقد فقط — بدون الأقساط التي سددتها بعدها.',
        numeric: { min: 0, max: 500000000 },
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
      },
      {
        kind: 'number',
        factKey: 'unit_contract_price',
        questionEn: 'What is the contract price of the unit?',
        questionAr: 'ما سعر الوحدة في العقد؟',
        numeric: { min: 0, max: 500000000 },
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
      },
      {
        kind: 'number',
        factKey: 'unit_months_owned',
        questionEn: 'How many months ago did you sign the contract?',
        questionAr: 'منذ كم شهر وقّعت العقد؟',
        numeric: { min: 0, max: 600 },
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
      },
      {
        // A NUMBER, not a yes/no over a list. What the collateral supports is shared between
        // the owners in the proportion they own it, so the portion this applicant is lent
        // against is the percentage they state — an owner of 40% is not the same customer as
        // an owner of 90%, and a two-option list cannot tell them apart.
        //
        // REQUIRED, and stated here rather than left to the default because the figure is
        // read on every quote this product makes: an owner who skips it would be told the
        // program quotes nothing, with the missing answer named. The cost is accepted and it
        // is real — the ask is not gated, so every applicant in these three loan types
        // answers it, whether or not they own a unit.
        kind: 'number',
        factKey: 'unit_owned_share_pct',
        questionEn: 'What percentage of the unit do you own?',
        questionAr: 'ما نسبة ملكيتك في الوحدة؟',
        helperEn: 'Enter 100 if you own it on your own.',
        helperAr: 'اكتب 100 إذا كنت تملكها بالكامل.',
        numeric: { min: 0, max: 100 },
        required: true,
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
      },
      {
        kind: 'choice',
        factKey: 'unit_count_owned',
        questionEn: 'Do you own more than one unit?',
        questionAr: 'هل تملك أكثر من وحدة؟',
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
        list: {
          typeKey: 'unit_count_owned',
          labelEn: 'Units owned',
          labelAr: 'عدد الوحدات المملوكة',
          values: [
            { key: 'unit_one', labelEn: 'One unit', labelAr: 'وحدة واحدة' },
            { key: 'unit_more_than_one', labelEn: 'More than one unit', labelAr: 'أكثر من وحدة' },
          ],
        },
      },
      { kind: 'derivedFact', factKey: 'loan_is_topup', alsoAskIn: PERSONAL_AND_CAR },
    ],
    template: {
      version: 1,
      outputKind: 'maxAmount',
      iScore: true,
      // Five ways, in the order the ways were added and never reordered — the slot ids a
      // bank's figures are filed under are positional (`primary`, `alt`, `alt__<fact>`).
      //
      // Two of them read a MONEY figure the customer states, and which figure is not a
      // detail: App. B FABMISR bands its ceiling by the DOWN PAYMENT ("Down payment paid —
      // 250K–500K → 750,000"), while App. A §2 (ABK, 15%) and App. B CAE (50%) take a share
      // of EVERYTHING paid to date. A customer who put 250,000 down and has since paid
      // 1,500,000 in instalments reads the first FABMISR bracket on the down payment and the
      // last one on the total — 750,000 against 1,500,000 — so one fact cannot serve both.
      //
      // A fact may key at most ONE way past index 1, because that slot is named after the
      // fact and not after the mechanism (`waySlot`): the bracket way therefore keeps the
      // bare `alt` slot it has always had and the share of the down payment is appended.
      primary: { kind: 'classTable', fact: 'compound_name' },
      alternatives: [
        { kind: 'numberBand', fact: 'unit_down_payment' },
        { kind: 'shareOf', fact: 'unit_paid_to_date' },
        { kind: 'choiceTable', fact: 'owned_unit_type' },
        { kind: 'shareOf', fact: 'unit_down_payment' },
      ],
      combine: 'lower',
      // ALTERNATIVES: four banks derive this ceiling four different ways and no published
      // sheet pairs two of them, so a program filling two would quote the lower of a
      // mechanism nobody sells. `combine` cannot say this — the auto cross-sell carries
      // `'lower'` too and DOES pair its two ways (App. A §4). `combine` is kept beside it as
      // defence in depth rather than policy: with it absent `emitBasis` emits a bare
      // `coalesce`, so a row that somehow held two ways would quote the FIRST silently where
      // `minOf(skipUnset)` quotes the lower.
      waysAre: 'exclusive',
      secondColumn: { fact: 'loan_is_topup', branches: ['new_loan', 'top_up'] },
      // The sheet says "loan AMOUNTS can be increased by 10%", so it lifts the cap, and the
      // difference between the two readings is 300,000 on one applicant (§10.4). Declared,
      // never defaulted — it compiles to nothing here and is configured per bank on
      // `loanLimits.maxLoanAdjustments`.
      uplift: {
        fact: 'unit_count_owned',
        whenOption: 'unit_more_than_one',
        otherwiseOption: 'unit_one',
        scope: 'maxLoan',
      },
      // Ownership shares the imputed figure between the owners in the proportion they own
      // it, which is a statement about what the collateral supports and so belongs inside
      // the rule. The applicant states the percentage; no bank figure is involved, and none
      // should be — the portion is a fact about this applicant, not a bank's policy.
      share: {
        kind: 'statedPercent',
        fact: 'unit_owned_share_pct',
        scope: 'income',
      },
      conditions: [
        {
          id: 'ownedlongenough',
          measure: { of: 'fact', fact: 'unit_months_owned' },
          test: { op: 'atLeast' },
          reasonCode: 'CONTRACT_TOO_NEW',
        },
        {
          id: 'paidenough',
          measure: { of: 'fact', fact: 'unit_paid_to_date' },
          test: { op: 'atLeastShareOf', fact: 'unit_contract_price' },
          reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
        },
        {
          id: 'unitworthenough',
          measure: { of: 'fact', fact: 'unit_contract_price' },
          test: { op: 'atLeast' },
          reasonCode: 'UNIT_PRICE_BELOW_MIN',
        },
      ],
    },
    suggestedBands: [
      {
        // The down-payment brackets one sheet bands its ceiling by.
        wayIndex: 1,
        edges: [
          { fromInclusive: '250000', toExclusive: '500000' },
          { fromInclusive: '500000', toExclusive: '1000000' },
          { fromInclusive: '1000000', toExclusive: '1500000' },
          { fromInclusive: '1500000', toExclusive: null },
        ],
      },
    ],
    cap: {
      factKey: 'owned_unit_type',
      columnFactKey: 'loan_is_topup',
      onNoMatch: 'useProgramMax',
      // OPTION CODES, not the registry keys the list above is built from: a cap row is
      // matched against the code of the answer the applicant picked (`factAnswerHasKey`),
      // exactly as `factChoiceTable` is, and the question mirrors its options off the list's
      // LABELS — so "Twin / Town house" is `twin_or_town_house` here and `twin_house` there.
      // A row keyed by the registry key matches nobody and shows the bank's real row as
      // unlisted.
      rowKeys: ['apartment', 'twin_or_town_house', 'villa'],
      columnKeys: ['new_loan', 'top_up'],
    },
    openQuestion: 'PAID_SHARE_FORMULA_UNCONFIRMED',
    usesReasonCodes: ['CONTRACT_TOO_NEW', 'DOWN_PAYMENT_BELOW_MIN', 'UNIT_PRICE_BELOW_MIN'],
  },

  {
    key: 'school_stage_ceiling',
    group: 'ceiling',
    labelEn: 'Teachers — Predefined Limit',
    labelAr: 'المعلمون — حد محدد مسبقًا',
    asks: [
      {
        kind: 'choice',
        factKey: 'school_stage',
        questionEn: 'Which stage do you teach?',
        questionAr: 'ما المرحلة التي تدرّسها؟',
        categories: PERSONAL_AND_CAR,
        list: {
          typeKey: 'school_stage',
          labelEn: 'School stages',
          labelAr: 'المراحل الدراسية',
          values: [
            { key: 'stage_primary', labelEn: 'Primary', labelAr: 'ابتدائي' },
            { key: 'stage_preparatory', labelEn: 'Preparatory', labelAr: 'إعدادي' },
            { key: 'stage_secondary', labelEn: 'Secondary', labelAr: 'ثانوي' },
          ],
        },
      },
      {
        kind: 'choice',
        factKey: 'school_type',
        questionEn: 'Is the school international or national?',
        questionAr: 'هل المدرسة دولية أم وطنية؟',
        helperEn: 'International means an American diploma, an international Bachelor, or IGCSE.',
        helperAr: 'الدولية تعني الدبلومة الأمريكية أو البكالوريا الدولية أو IGCSE.',
        categories: PERSONAL_AND_CAR,
        list: {
          typeKey: 'school_type',
          labelEn: 'School types',
          labelAr: 'أنواع المدارس',
          values: [
            { key: 'school_international', labelEn: 'International', labelAr: 'دولية' },
            { key: 'school_national', labelEn: 'National', labelAr: 'وطنية' },
          ],
        },
      },
    ],
    template: {
      version: 1,
      outputKind: 'maxAmount',
      iScore: true,
      primary: { kind: 'choiceTable', fact: 'school_stage' },
      secondColumn: {
        fact: 'school_type',
        branches: ['school_national', 'school_international'],
      },
      conditions: [],
    },
  },

  // -------------------------------------------------------------------------
  // Only caps the loan — no income is worked out at all
  // -------------------------------------------------------------------------
  {
    key: 'company_coding_cap',
    group: 'cap',
    labelEn: 'Salaried — Company Coding',
    labelAr: 'أصحاب الرواتب — تصنيف جهة العمل',
    asks: [
      {
        kind: 'choice',
        factKey: 'employer_coding',
        questionEn: 'How is your employer coded at the bank?',
        questionAr: 'كيف تصنّف جهة عملك في البنك؟',
        helperEn: 'Your bank can tell you. Leave it if you do not know.',
        helperAr: 'يمكن للبنك إخبارك. اتركه إذا لم تكن متأكدًا.',
        categories: ALL_CATEGORIES,
        list: {
          typeKey: 'employer_coding',
          labelEn: 'Employer coding',
          labelAr: 'تصنيف جهة العمل',
          values: [
            { key: 'coding_cat_a', labelEn: 'CAT A', labelAr: 'الفئة A' },
            { key: 'coding_cat_b', labelEn: 'CAT B', labelAr: 'الفئة B' },
            { key: 'coding_cat_c', labelEn: 'CAT C', labelAr: 'الفئة C' },
          ],
        },
      },
    ],
    template: null,
    cap: {
      factKey: 'employer_coding',
      onNoMatch: 'useProgramMax',
      rowKeys: ['coding_cat_a', 'coding_cat_b', 'coding_cat_c'],
    },
  },

  {
    key: 'school_type_cap',
    group: 'cap',
    labelEn: 'Teachers — Standard',
    labelAr: 'المعلمون — البرنامج القياسي',
    asks: [
      {
        kind: 'choice',
        factKey: 'school_type',
        questionEn: 'Is the school international or national?',
        questionAr: 'هل المدرسة دولية أم وطنية؟',
        categories: PERSONAL_AND_CAR,
        list: {
          typeKey: 'school_type',
          labelEn: 'School types',
          labelAr: 'أنواع المدارس',
          values: [
            { key: 'school_international', labelEn: 'International', labelAr: 'دولية' },
            { key: 'school_national', labelEn: 'National', labelAr: 'وطنية' },
          ],
        },
      },
    ],
    template: null,
    cap: {
      factKey: 'school_type',
      onNoMatch: 'useProgramMax',
      rowKeys: ['school_national', 'school_international'],
    },
    // The sheet states the ceiling and says the debt-burden percentage is "as per retail
    // risk policy" — it prints no number. The program quotes nothing until a bank gives one.
    openQuestion: 'DBR_PERCENT_UNCONFIRMED',
  },

  {
    key: 'club_branch_cap',
    group: 'cap',
    labelEn: 'Club Membership',
    labelAr: 'عضوية النادي',
    asks: [
      {
        kind: 'choice',
        factKey: 'club_branch',
        questionEn: 'Which club branch is your membership at?',
        questionAr: 'عضويتك في أي فرع من النادي؟',
        categories: PERSONAL_AND_CAR,
        list: {
          typeKey: 'club_branch',
          labelEn: 'Club branches',
          labelAr: 'فروع النوادي',
          // Adding a branch is more rows, never more code.
          values: [
            { key: 'branch_new_cairo', labelEn: 'New Cairo', labelAr: 'القاهرة الجديدة' },
            { key: 'branch_sheikh_zayed', labelEn: 'Sheikh Zayed', labelAr: 'الشيخ زايد' },
            { key: 'branch_main', labelEn: 'Main', labelAr: 'الفرع الرئيسي' },
          ],
        },
      },
    ],
    template: null,
    cap: {
      factKey: 'club_branch',
      onNoMatch: 'useProgramMax',
      rowKeys: ['branch_new_cairo', 'branch_sheikh_zayed', 'branch_main'],
    },
    openQuestion: 'DBR_PERCENT_UNCONFIRMED',
  },

  {
    key: 'down_payment_income',
    group: 'income',
    // The label names the loan type, not just the mechanism: this product is only ever sold
    // under `car`, and the board sorts by the rendered label — it filed under D with nothing
    // on the card saying it is an auto product. The KEY is untouched: it is what
    // `surrogate_product_ask.productId`, `platform_enumeration.surrogateProductKey` and the
    // blueprint registry all address.
    labelEn: 'Auto Loan — Down Payment as Income',
    labelAr: 'قرض سيارة — الدفعة المقدمة كدخل',
    asks: [
      // Already asked of every car applicant as an amount, and read by the rate cascade and
      // the LTV ceiling as well. Asking it again would be two answers to one question.
      { kind: 'platformFact', factKey: 'car_down_payment', alsoAskIn: [LoanCategory.car] },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      iScore: true,
      // The sheet's own sentence: the down payment is N months of saving, and the saving is
      // a share of income — so income = down payment ÷ (months × share). ONE divisor, and it
      // is the number the sheet prints.
      primary: { kind: 'dividedBy', fact: 'car_down_payment' },
      conditions: [],
    },
  },

  {
    key: 'savings_income',
    group: 'income',
    // Auto-only, same reasoning as `down_payment_income` above.
    labelEn: 'Auto Loan — Savings as Income',
    labelAr: 'قرض سيارة — المدخرات كدخل',
    asks: [
      // Both questions are authored by `seed-questionnaire.ts` and bound here rather than
      // minted: that seed switches off every question outside its own pool, and
      // `seed:blueprints` skips a product that already holds a calculation without reviving
      // anything — so a blueprint-minted question is dead after the next `prisma:seed`.
      {
        kind: 'bindQuestion',
        factKey: 'total_savings',
        questionCode: 'total_savings',
        labelEn: 'Total savings',
        labelAr: 'إجمالي المدخرات',
        alsoAskIn: [LoanCategory.car],
      },
      {
        kind: 'bindQuestion',
        factKey: 'green_buyer_type',
        questionCode: 'green_buyer_type',
        labelEn: 'How the purchase is paid for',
        labelAr: 'طريقة سداد الشراء',
        alsoAskIn: [LoanCategory.car],
      },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      iScore: true,
      primary: { kind: 'dividedBy', fact: 'total_savings' },
      // The two divisors are a different sentence per buyer, not a different mechanism: an
      // instalment buyer's savings are read over one horizon and a cash buyer's over another.
      // The FIRST branch keeps the bare slot, so the instalment column is `primary`.
      secondColumn: { fact: 'green_buyer_type', branches: ['instalment_buyer', 'cash_buyer'] },
      conditions: [],
    },
  },
]);

export function productBlueprints(): readonly ProductBlueprint[] {
  return BLUEPRINTS;
}

/**
 * Fact keys more than one blueprint asks for.
 *
 * These must NOT be filed under a product, and the reason is a cascade: deleting a surrogate
 * product deletes the facts filed under it, so a fact two products read would die with
 * whichever one happened to create it — and the other would be refused at its next save,
 * naming a fact nobody could see had been deleted. Found by deleting a test product and
 * watching the second one lose its axis.
 *
 * `school_type` is the live example: one blueprint reads it as a ceiling's column, another
 * as a cap of its own.
 */
export function sharedBlueprintFactKeys(): ReadonlySet<string> {
  const seen = new Map<string, number>();
  for (const blueprint of BLUEPRINTS) {
    for (const key of new Set(blueprint.asks.map((ask) => ask.factKey))) {
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key));
}

export function productBlueprint(key: string): ProductBlueprint | undefined {
  return BLUEPRINTS.find((blueprint) => blueprint.key === key);
}

/**
 * Every blueprint that asks for this fact key, and the question each one declares for it.
 *
 * Read by the operator-facing ask door on a product's step ①, for two refusals that are
 * about the same thing from opposite ends:
 *
 *   - a tick whose derived key a blueprint declares against a DIFFERENT question would
 *     silently repoint that blueprint's product at the operator's question, with no plan
 *     step, no log line and no refusal — the seed treats an existing bound key as reuse;
 *   - an untick of a blueprint's own ask would be undone by the next seed run, so it is
 *     refused rather than allowed and quietly reverted.
 *
 * `questionCode` is `undefined` for the ask kinds that declare none: a `choice` or `number`
 * ask MINTS its question (the code is slugged from the English wording and is not knowable
 * here), while `bindQuestion`, `platformFact` and `derivedFact` name an existing one.
 */
export function blueprintKeysAsking(
  factKey: string,
): readonly { blueprintKey: string; questionCode?: string }[] {
  const found: { blueprintKey: string; questionCode?: string }[] = [];
  for (const blueprint of BLUEPRINTS) {
    for (const ask of blueprint.asks) {
      if (ask.factKey !== factKey) continue;
      found.push({
        blueprintKey: blueprint.key,
        questionCode: 'questionCode' in ask ? ask.questionCode : undefined,
      });
      break;
    }
  }
  return found;
}

/**
 * The maximum-loan grid this product implies — the axes and the row and column keys, in the
 * order the sheet prints them. `undefined` when the product declares none.
 *
 * Resolved AT READ TIME off the registry rather than stored on the product row, and the
 * reason is that `product-blueprints.ts` is already the single authority. A `capSpec` column
 * would be a second one, free to disagree with the file that declares it, plus a migration
 * and a seed pass for a fact the code already states. `templateSpec.cap` is not an option
 * either: a cap-only product never gets a `templateSpec` at all, and the column is set back
 * to NULL one-way the moment an operator opens the advanced editor — a shape stored there
 * would vanish from live programs on a click that has nothing to do with it.
 *
 * FIGURES ARE NOT HERE, and that is deliberate rather than an omission. Every cap figure in
 * this repo is a named bank's (App. A §2, §3 and §7 are all ABK), and EGBank, FABMISR and
 * CAE publish no unit-type cap at all — writing ABK's numbers into a shared product would
 * hand three banks a policy they never published (Principle II / A1). The default AMOUNTS an
 * operator wants every new program to start from are theirs to type, once, on the product.
 *
 * `blueprintKey` is the fallback for a product an operator renamed: `seedProductKey()` writes
 * the blueprint key verbatim, so the product key IS the blueprint key on every seeded row,
 * and `templateSpec.blueprintKey` is what survives a rename.
 *
 * Frozen, because the registry is a module singleton: a caller that sorted `rowKeys` in place
 * would reorder the grid for every later request in the process.
 */
export function capShapeOf(
  productKey: string,
  blueprintKey?: string | null,
): BlueprintCap | undefined {
  const cap =
    productBlueprint(productKey)?.cap ??
    (blueprintKey ? productBlueprint(blueprintKey)?.cap : undefined);
  if (cap === undefined) return undefined;
  const copy: BlueprintCap = {
    ...cap,
    ...(cap.rowKeys ? { rowKeys: [...cap.rowKeys] } : {}),
    ...(cap.columnKeys ? { columnKeys: [...cap.columnKeys] } : {}),
    ...(cap.bands ? { bands: cap.bands.map((band) => Object.freeze({ ...band })) } : {}),
  };
  if (copy.rowKeys) Object.freeze(copy.rowKeys);
  if (copy.columnKeys) Object.freeze(copy.columnKeys);
  if (copy.bands) Object.freeze(copy.bands);
  return Object.freeze(copy);
}

/**
 * True when a `surrogate_product` of this key guesses no income at all — it asks its
 * question, and each bank states the MAXIMUM it will lend against the answer on its own
 * program (`loanLimits.maxLoanByFact`).
 *
 * A product row exists for these so an operator has one card and one switch per product,
 * but it holds no calculation and never will, so a catalog program name must not be
 * linked to one: the name would be sold with no payslip and work out no income. That
 * refusal (`SURROGATE_PRODUCT_CAP_ONLY`) is the only reader of this function.
 *
 * The KEY is the marker, and it can be, because a key is immutable in this registry by
 * construction — the whole reason `createFromBlueprint` refuses a taken key rather than
 * minting `_2`. The alternative, a `capOnly` column, would be a migration for a fact the
 * blueprint already states, and a second place for it to disagree.
 */
export function isCapOnlyProductKey(key: string): boolean {
  return productBlueprint(key)?.group === 'cap';
}

/**
 * The facts a cap-only product's switch may turn off with it — the ones it asks for and
 * nobody else does.
 *
 * Read from the BLUEPRINT rather than from `platform_enumeration.surrogateProductKey`,
 * because that column answers a different question. A cap blueprint creates no product row
 * for the planner to file its fact under, so its facts are filed under nothing at all — and
 * on the live database every one of them is, which is why an ownership-keyed flip did
 * nothing and the switch was inert. Measured, not assumed.
 *
 * SHARED facts are excluded, and this is the load-bearing half: `school_type` is read by
 * `school_stage_ceiling` as a ceiling's column AND by `school_type_cap` as a cap of its own.
 * Turning off the cap product must not stop the ceiling product reading the answer, so a
 * fact more than one blueprint asks for is never taken away by one of them. That is the same
 * rule, and the same function, `sharedBlueprintFactKeys` already states for deletion.
 */
export function exclusiveFactKeysOf(productKey: string): readonly string[] {
  const blueprint = productBlueprint(productKey);
  if (!blueprint) return [];
  const shared = sharedBlueprintFactKeys();
  return [...new Set(blueprint.asks.map((ask) => ask.factKey))].filter((key) => !shared.has(key));
}
