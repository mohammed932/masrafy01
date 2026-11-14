/**
 * The live no-payslip products, as stored on 2026-11-14: each one's friendly form and the
 * catalog's default figures, copied from the database so the tests below run without it.
 *
 * STATIC on purpose (operator's call): a change to a live product is expected to fail
 * `product-snapshots.spec.ts` until this file is refreshed to match, which makes every money
 * move a visible, reviewed edit. Refresh by re-reading `GET /api/admin/bank-programs/
 * surrogate-products/:key/template` for each key below.
 */
import type { ProductTemplate } from '@/matching/pipeline/product-template';
import type { ProductRule } from '@/matching/pipeline/product-rule';

export interface ProductSnapshot {
  template: ProductTemplate;
  stepParams: NonNullable<ProductRule['stepParams']>;
}

export const PRODUCT_SNAPSHOTS = {
  academic_rank_table: {
    template: {
      primary: {
        fact: 'academic_rank',
        kind: 'choiceTable',
      },
      version: 1,
      conditions: [],
      outputKind: 'monthlyIncome',
      blueprintKey: 'academic_rank_table',
      secondColumn: {
        fact: 'university_type',
        branches: ['uni_government', 'uni_private'],
      },
    },
    stepParams: {
      primary: {
        keyTable: [
          {
            key: 'junior_staff',
            incomeEGP: '12000',
          },
          {
            key: 'assistant_teacher',
            incomeEGP: '20000',
          },
          {
            key: 'lecturer',
            incomeEGP: '35000',
          },
          {
            key: 'assistant_professor',
            incomeEGP: '50000',
          },
          {
            key: 'professor',
            incomeEGP: '100000',
          },
          {
            key: 'professor_section_head',
            incomeEGP: '75000',
          },
          {
            key: 'dean',
            incomeEGP: '150000',
          },
        ],
      },
      primary__uni_private: {
        keyTable: [
          {
            key: 'junior_staff',
            incomeEGP: '20000',
          },
          {
            key: 'assistant_teacher',
            incomeEGP: '30000',
          },
          {
            key: 'lecturer',
            incomeEGP: '50000',
          },
          {
            key: 'assistant_professor',
            incomeEGP: '75000',
          },
          {
            key: 'professor',
            incomeEGP: '150000',
          },
          {
            key: 'professor_section_head',
            incomeEGP: '200000',
          },
          {
            key: 'dean',
            incomeEGP: '300000',
          },
        ],
      },
    },
  },
  armed_forces_grades: {
    template: {
      primary: {
        fact: 'military_grade',
        kind: 'choiceTable',
      },
      version: 1,
      conditions: [],
      outputKind: 'monthlyIncome',
      blueprintKey: 'armed_forces_grades',
    },
    stepParams: {
      primary: {
        keyTable: [
          {
            key: 'grade_major_general',
            incomeEGP: '75000',
          },
          {
            key: 'grade_brigadier_general',
            incomeEGP: '60000',
          },
          {
            key: 'grade_colonel',
            incomeEGP: '45000',
          },
          {
            key: 'grade_lt_colonel',
            incomeEGP: '40000',
          },
          {
            key: 'grade_major',
            incomeEGP: '30000',
          },
          {
            key: 'grade_captain',
            incomeEGP: '28000',
          },
          {
            key: 'grade_first_lieutenant',
            incomeEGP: '18000',
          },
        ],
      },
    },
  },
  auto_loan_crosssell: {
    template: {
      combine: 'lower',
      primary: {
        fact: 'car_loan_installment',
        kind: 'multipleOf',
      },
      version: 1,
      waysAre: 'combined',
      conditions: [
        {
          id: 'paidenoughmonths',
          test: {
            op: 'atLeast',
          },
          measure: {
            of: 'fact',
            fact: 'car_loan_instalments_paid',
          },
          reasonCode: 'LOAN_TOO_NEW',
        },
        {
          id: 'paidenoughofterm',
          test: {
            op: 'atLeastShareOf',
            fact: 'car_loan_original_tenor',
          },
          measure: {
            of: 'fact',
            fact: 'car_loan_instalments_paid',
          },
          reasonCode: 'LOAN_TOO_NEW',
        },
        {
          id: 'bookedwithdownpayment',
          test: {
            op: 'atLeastShareOf',
            fact: 'auto_loan_amount',
          },
          measure: {
            of: 'fact',
            fact: 'car_loan_down_payment',
          },
          reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
        },
      ],
      outputKind: 'monthlyIncome',
      alternatives: [
        {
          fact: 'auto_loan_amount',
          kind: 'shareOf',
        },
      ],
      blueprintKey: 'auto_loan_crosssell',
    },
    stepParams: {
      alt: {
        scalar: {
          unit: 'percent',
          value: '10',
        },
      },
      primary: {
        scalar: {
          unit: 'multiplier',
          value: '3',
        },
      },
    },
  },
  card_limit_share: {
    template: {
      primary: {
        fact: 'credit_card_limit',
        kind: 'shareOf',
      },
      version: 1,
      conditions: [],
      outputKind: 'monthlyIncome',
      blueprintKey: 'card_limit_share',
    },
    stepParams: {
      primary: {
        scalar: {
          unit: 'percent',
          value: '50',
        },
      },
    },
  },
  club_branch_cap: {
    template: {
      primary: {
        fact: 'club_branch',
        kind: 'choiceTable',
      },
      version: 1,
      conditions: [],
      outputKind: 'maxAmount',
      blueprintKey: 'club_branch_cap',
      baselineDbrPercent: '50',
    },
    stepParams: {
      primary: {
        keyTable: [
          {
            key: 'branch_new_cairo',
            incomeEGP: '750000',
          },
          {
            key: 'branch_sheikh_zayed',
            incomeEGP: '510000',
          },
          {
            key: 'branch_main',
            incomeEGP: '160000',
          },
        ],
      },
    },
  },
  compound_owner: {
    template: {
      share: {
        fact: 'unit_owned_share_pct',
        kind: 'statedPercent',
        scope: 'income',
      },
      combine: 'lower',
      primary: {
        fact: 'compound_name',
        kind: 'classTable',
        column: {
          fact: 'loan_is_topup',
          branches: ['new_loan', 'top_up'],
        },
      },
      version: 1,
      waysAre: 'exclusive',
      conditions: [
        {
          id: 'ownedlongenough',
          test: {
            op: 'atLeast',
          },
          measure: {
            of: 'fact',
            fact: 'unit_months_owned',
          },
          reasonCode: 'CONTRACT_TOO_NEW',
        },
        {
          id: 'paidenough',
          test: {
            op: 'atLeastShareOf',
            fact: 'unit_contract_price',
          },
          measure: {
            of: 'fact',
            fact: 'unit_paid_to_date',
          },
          reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
        },
        {
          id: 'unitworthenough',
          test: {
            op: 'atLeast',
          },
          measure: {
            of: 'fact',
            fact: 'unit_contract_price',
          },
          reasonCode: 'UNIT_PRICE_BELOW_MIN',
        },
        {
          id: 'businessoldenough',
          test: {
            op: 'oneOf',
            expect: ['24m_or_more', 'not_self_employed'],
          },
          measure: {
            of: 'fact',
            fact: 'business_months',
          },
          reasonCode: 'BUSINESS_TOO_NEW',
        },
        {
          id: 'selfemployedpapers',
          test: {
            op: 'oneOf',
            expect: ['yes', 'not_self_employed'],
          },
          measure: {
            of: 'fact',
            fact: 'self_employed_licence',
          },
          reasonCode: 'SELF_EMPLOYED_DOCS_MISSING',
        },
      ],
      outputKind: 'maxAmount',
      alternatives: [
        {
          fact: 'unit_down_payment',
          kind: 'numberBand',
          column: {
            fact: 'holds_other_product',
            branches: ['other_product_none', 'other_product_held'],
          },
        },
        {
          fact: 'unit_paid_to_date',
          kind: 'shareOf',
        },
        {
          fact: 'owned_unit_type',
          kind: 'choiceTable',
          column: {
            fact: 'loan_is_topup',
            branches: ['new_loan', 'top_up'],
          },
        },
      ],
      blueprintKey: 'compound_owner',
      baselineDbrPercent: '50',
    },
    stepParams: {
      alt: {
        bands: [
          {
            incomeEGP: '750000',
            toExclusive: '500000',
            fromInclusive: '250000',
          },
          {
            incomeEGP: '1000000',
            toExclusive: '1000000',
            fromInclusive: '500000',
          },
          {
            incomeEGP: '1250000',
            toExclusive: '1500000',
            fromInclusive: '1000000',
          },
          {
            incomeEGP: '1500000',
            toExclusive: null,
            fromInclusive: '1500000',
          },
        ],
      },
      primary: {
        keyTable: [
          {
            key: 'compound_tier_aa',
            incomeEGP: '6000000',
          },
          {
            key: 'compound_tier_ab',
            incomeEGP: '5000000',
          },
          {
            key: 'compound_tier_a',
            incomeEGP: '4000000',
          },
          {
            key: 'compound_tier_b',
            incomeEGP: '3000000',
          },
          {
            key: 'compound_tier_c',
            incomeEGP: '2000000',
          },
          {
            key: 'compound_tier_other',
            incomeEGP: '2000000',
          },
        ],
      },
      primary__top_up: {
        keyTable: [
          {
            key: 'compound_tier_aa',
            incomeEGP: '7000000',
          },
          {
            key: 'compound_tier_ab',
            incomeEGP: '5500000',
          },
          {
            key: 'compound_tier_a',
            incomeEGP: '4500000',
          },
          {
            key: 'compound_tier_b',
            incomeEGP: '3500000',
          },
          {
            key: 'compound_tier_c',
            incomeEGP: '2500000',
          },
          {
            key: 'compound_tier_other',
            incomeEGP: '2000000',
          },
        ],
      },
      alt__owned_unit_type: {
        keyTable: [
          {
            key: 'apartment',
            incomeEGP: '2000000',
          },
          {
            key: 'twin_house',
            incomeEGP: '3000000',
          },
          {
            key: 'villa',
            incomeEGP: '4000000',
          },
        ],
      },
      cond__ownedlongenough: {
        minValue: '18',
      },
      cond__unitworthenough: {
        minValue: '1000000',
      },
      alt__unit_paid_to_date: {
        scalar: {
          unit: 'percent',
          value: '15',
        },
      },
      alt__other_product_held: {
        bands: [
          {
            incomeEGP: '1250000',
            toExclusive: '500000',
            fromInclusive: '250000',
          },
          {
            incomeEGP: '1500000',
            toExclusive: '1000000',
            fromInclusive: '500000',
          },
          {
            incomeEGP: '1750000',
            toExclusive: '1500000',
            fromInclusive: '1000000',
          },
          {
            incomeEGP: '2000000',
            toExclusive: null,
            fromInclusive: '1500000',
          },
        ],
      },
      cond__paidenough__bound: {
        scalar: {
          unit: 'percent',
          value: '30',
        },
      },
      alt__owned_unit_type__top_up: {
        keyTable: [
          {
            key: 'apartment',
            incomeEGP: '3000000',
          },
          {
            key: 'twin_house',
            incomeEGP: '3500000',
          },
          {
            key: 'villa',
            incomeEGP: '4500000',
          },
        ],
      },
    },
  },
  doctors_clinic_owner: {
    template: {
      primary: {
        fact: 'years_in_practice',
        kind: 'numberBand',
      },
      version: 1,
      conditions: [],
      outputKind: 'monthlyIncome',
      blueprintKey: 'doctors_clinic_owner',
      secondColumn: {
        fact: 'practice_governorate',
        branchOn: 'parentClass',
        branches: ['city_tier_major', 'city_tier_secondary', 'city_tier_other'],
      },
    },
    stepParams: {
      primary: {
        bands: [
          {
            incomeEGP: '42500',
            toExclusive: '5',
            fromInclusive: '2',
          },
          {
            incomeEGP: '81000',
            toExclusive: '8',
            fromInclusive: '5',
          },
          {
            incomeEGP: '134000',
            toExclusive: '12',
            fromInclusive: '8',
          },
          {
            incomeEGP: '195000',
            toExclusive: '15',
            fromInclusive: '12',
          },
          {
            incomeEGP: '320000',
            toExclusive: null,
            fromInclusive: '15',
          },
        ],
      },
      primary__city_tier_other: {
        bands: [
          {
            incomeEGP: '32000',
            toExclusive: '5',
            fromInclusive: '2',
          },
          {
            incomeEGP: '60000',
            toExclusive: '8',
            fromInclusive: '5',
          },
          {
            incomeEGP: '100000',
            toExclusive: '12',
            fromInclusive: '8',
          },
          {
            incomeEGP: '150000',
            toExclusive: '15',
            fromInclusive: '12',
          },
          {
            incomeEGP: '240000',
            toExclusive: null,
            fromInclusive: '15',
          },
        ],
      },
      primary__city_tier_secondary: {
        bands: [
          {
            incomeEGP: '42500',
            toExclusive: '5',
            fromInclusive: '2',
          },
          {
            incomeEGP: '81000',
            toExclusive: '8',
            fromInclusive: '5',
          },
          {
            incomeEGP: '134000',
            toExclusive: '12',
            fromInclusive: '8',
          },
          {
            incomeEGP: '195000',
            toExclusive: '15',
            fromInclusive: '12',
          },
          {
            incomeEGP: '320000',
            toExclusive: null,
            fromInclusive: '15',
          },
        ],
      },
    },
  },
  doctors_in_practice: {
    template: {
      primary: {
        fact: 'years_in_practice',
        kind: 'numberBand',
      },
      version: 1,
      conditions: [
        {
          id: 'privatehospitalonly',
          test: {
            op: 'oneOf',
            expect: ['private_hospital', 'not_at_a_hospital'],
          },
          measure: {
            of: 'fact',
            fact: 'hospital_sector',
          },
          reasonCode: 'GATE_NOT_MET',
        },
      ],
      outputKind: 'monthlyIncome',
      blueprintKey: 'doctors_in_practice',
    },
    stepParams: {},
  },
  down_payment_income: {
    template: {
      primary: {
        fact: 'car_down_payment',
        kind: 'dividedBy',
      },
      version: 1,
      waysAre: 'exclusive',
      conditions: [],
      outputKind: 'monthlyIncome',
      alternatives: [
        {
          fact: 'total_savings',
          kind: 'dividedBy',
          column: {
            fact: 'green_buyer_type',
            branches: ['instalment_buyer', 'cash_buyer'],
          },
        },
      ],
      blueprintKey: 'down_payment_income',
    },
    stepParams: {
      alt: {
        scalar: {
          unit: 'multiplier',
          value: '6',
        },
      },
      primary: {
        scalar: {
          unit: 'multiplier',
          value: '3.6',
        },
      },
      alt__cash_buyer: {
        scalar: {
          unit: 'multiplier',
          value: '10',
        },
      },
    },
  },
  pledged_collateral_share: {
    template: {
      primary: {
        fact: 'pledged_free_amount',
        kind: 'shareOf',
      },
      version: 1,
      conditions: [
        {
          id: 'heldlongenough',
          test: {
            op: 'atLeast',
          },
          measure: {
            of: 'fact',
            fact: 'pledged_months_since_issue',
          },
          reasonCode: 'GATE_NOT_MET',
        },
      ],
      outputKind: 'monthlyIncome',
      blueprintKey: 'pledged_collateral_share',
    },
    stepParams: {
      primary: {
        scalar: {
          unit: 'percent',
          value: '30',
        },
      },
    },
  },
  school_stage_ceiling: {
    template: {
      primary: {
        fact: 'school_stage',
        kind: 'choiceTable',
      },
      version: 1,
      conditions: [],
      outputKind: 'maxAmount',
      blueprintKey: 'school_stage_ceiling',
      secondColumn: {
        fact: 'school_type',
        branches: ['school_national', 'school_international'],
      },
      baselineDbrPercent: '50',
    },
    stepParams: {
      primary: {
        keyTable: [
          {
            key: 'stage_primary',
            incomeEGP: '100000',
          },
          {
            key: 'stage_preparatory',
            incomeEGP: '200000',
          },
          {
            key: 'stage_secondary',
            incomeEGP: '300000',
          },
        ],
      },
      primary__school_international: {
        keyTable: [
          {
            key: 'stage_primary',
            incomeEGP: '200000',
          },
          {
            key: 'stage_preparatory',
            incomeEGP: '400000',
          },
          {
            key: 'stage_secondary',
            incomeEGP: '600000',
          },
        ],
      },
    },
  },
} as unknown as Record<string, ProductSnapshot>;

/** Where the shared lists file the answers the tests pick (`platform_enumeration.parentKey`). */
export const SHARED_CLASSES: Readonly<Record<string, string>> = {
  mivida: 'compound_tier_aa',
  hyde_park: 'compound_tier_ab',
  madinaty: 'compound_tier_b',
  al_rehab: 'compound_tier_c',
  cairo: 'city_tier_major',
  giza: 'city_tier_secondary',
  aswan: 'city_tier_other',
};
