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
import type { ProductBlueprint } from './product-blueprint.types';

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
    labelEn: 'Income by armed-forces grade',
    labelAr: 'الدخل حسب الرتبة العسكرية',
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
      primary: { kind: 'choiceTable', fact: 'military_grade' },
      conditions: [],
    },
  },

  {
    key: 'academic_rank_table',
    group: 'income',
    labelEn: 'Income by academic rank',
    labelAr: 'الدخل حسب الدرجة العلمية',
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
    key: 'years_in_practice_bands',
    group: 'income',
    labelEn: 'Income by years in practice',
    labelAr: 'الدخل حسب سنوات الممارسة',
    asks: [
      { kind: 'platformFact', factKey: 'years_in_practice' },
      {
        kind: 'platformFact',
        factKey: 'property_governorate',
        // The governorate question is seeded for mortgages only, so a personal-loan doctor
        // is never asked where they practise — and the column, and the cap, read nothing.
        alsoAskIn: PERSONAL_AND_CAR,
      },
      { kind: 'derivedFact', factKey: 'loan_is_topup', alsoAskIn: PERSONAL_AND_CAR },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'numberBand', fact: 'years_in_practice' },
      // Keyed by the TIER, not by the governorate. One bank groups Cairo and Alexandria
      // against everywhere else, another groups eight governorates against everywhere else,
      // and neither "everywhere else" is the other's — so the branches are whole classes and
      // the next governorate added to the list is priced without touching a bank's table.
      secondColumn: {
        fact: 'property_governorate',
        branches: [...CITY_TIERS],
        branchOn: 'parentClass',
      },
      conditions: [],
    },
    suggestedBands: [
      {
        wayIndex: 0,
        // Half-open: exactly five years lands in `5–8`, never in `3–5`.
        edges: [
          { fromInclusive: '3', toExclusive: '5' },
          { fromInclusive: '5', toExclusive: '8' },
          { fromInclusive: '8', toExclusive: '11' },
          { fromInclusive: '11', toExclusive: '14' },
          { fromInclusive: '14', toExclusive: '20' },
          { fromInclusive: '20', toExclusive: null },
        ],
      },
    ],
    cap: {
      factKey: 'property_governorate',
      rowVia: 'parentClass',
      columnFactKey: 'loan_is_topup',
      onNoMatch: 'useProgramMax',
      rowKeys: [...CITY_TIERS],
      columnKeys: ['new_loan', 'top_up'],
    },
  },

  {
    key: 'card_limit_share',
    group: 'income',
    labelEn: 'Income as a share of a card limit',
    labelAr: 'الدخل كنسبة من حد البطاقة',
    asks: [
      // Already asked, in every category, as part of the obligations block — and asking it
      // again would be two answers to one question, free to disagree.
      { kind: 'platformFact', factKey: 'credit_card_limit' },
    ],
    template: {
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'shareOf', fact: 'credit_card_limit' },
      conditions: [],
    },
  },

  {
    key: 'auto_loan_crosssell',
    group: 'income',
    labelEn: 'Income from an existing car loan',
    labelAr: 'الدخل من قرض سيارة قائم',
    asks: [
      {
        kind: 'bindQuestion',
        factKey: 'car_loan_installment',
        // The instalment is already asked as an obligation, with its own branch and its own
        // helper text. A second question would ask the same thing twice.
        questionCode: 'obligation_car_loan',
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
      // The genuine same-unit `minOf` the design keeps inside the rule: income against
      // income, three times the instalment or a share of the loan, whichever is lower.
      primary: { kind: 'multipleOf', fact: 'car_loan_installment' },
      alternatives: [{ kind: 'shareOf', fact: 'auto_loan_amount' }],
      combine: 'lower',
      conditions: [],
    },
  },

  {
    key: 'pledged_collateral_share',
    group: 'income',
    labelEn: 'Income as a share of pledged savings',
    labelAr: 'الدخل كنسبة من مدخرات مرهونة',
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
    labelEn: 'Ceiling from a compound unit the customer owns',
    labelAr: 'الحد الأقصى من وحدة يملكها العميل في كومباوند',
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
        kind: 'choice',
        factKey: 'unit_joint_ownership',
        questionEn: 'Do you own the unit with someone else?',
        questionAr: 'هل تملك الوحدة بالشراكة مع شخص آخر؟',
        categories: [LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage],
        list: {
          typeKey: 'unit_ownership_share',
          labelEn: 'Unit ownership',
          labelAr: 'ملكية الوحدة',
          values: [
            { key: 'joint_sole', labelEn: 'I own it on my own', labelAr: 'أملكها بالكامل' },
            {
              key: 'joint_shared',
              labelEn: 'I own it with someone else',
              labelAr: 'أملكها بالشراكة',
            },
          ],
        },
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
      // Four ways, in the order the ways were added and never reordered — the slot ids a
      // bank's figures are filed under are positional (`primary`, `alt`, `alt__<fact>`).
      primary: { kind: 'classTable', fact: 'compound_name' },
      alternatives: [
        { kind: 'numberBand', fact: 'unit_paid_to_date' },
        { kind: 'shareOf', fact: 'unit_paid_to_date' },
        { kind: 'choiceTable', fact: 'owned_unit_type' },
      ],
      combine: 'lower',
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
      // Joint ownership shares the imputed figure between the owners, which is a statement
      // about what the collateral supports and so belongs inside the rule.
      share: {
        fact: 'unit_joint_ownership',
        whenOption: 'joint_shared',
        otherwiseOption: 'joint_sole',
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
      rowKeys: ['apartment', 'twin_house', 'villa'],
      columnKeys: ['new_loan', 'top_up'],
    },
    openQuestion: 'PAID_SHARE_FORMULA_UNCONFIRMED',
    usesReasonCodes: ['CONTRACT_TOO_NEW', 'DOWN_PAYMENT_BELOW_MIN', 'UNIT_PRICE_BELOW_MIN'],
  },

  {
    key: 'school_stage_ceiling',
    group: 'ceiling',
    labelEn: 'Ceiling by the stage a teacher teaches',
    labelAr: 'الحد الأقصى حسب المرحلة التي يدرّسها المعلم',
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
    labelEn: 'Cap by how the employer is coded',
    labelAr: 'الحد الأقصى حسب تصنيف جهة العمل',
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
    labelEn: 'Cap by the kind of school',
    labelAr: 'الحد الأقصى حسب نوع المدرسة',
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
    labelEn: 'Cap by club branch',
    labelAr: 'الحد الأقصى حسب فرع النادي',
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
