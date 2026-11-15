/**
 * The ready methods the platform ships with (v37.0.0): every way of every live no-payslip
 * product, with the default figures it was stored with on 2026-11-15.
 *
 * Put in by `MethodTemplatesService.onApplicationBootstrap` — a method whose key is missing is
 * inserted, and nothing else: an edited method keeps its edits and a deleted one stays deleted
 * (it is tombstoned, not removed). Picking a method on a product COPIES it, so nothing here
 * ever reaches a live product by itself.
 */
import type { TemplateMechanism } from '@/matching/pipeline/product-template';

export interface MethodTemplateSeed {
  key: string;
  labelEn: string;
  labelAr: string;
  sortOrder: number;
  mechanism: TemplateMechanism;
  /** Default figures by column: `''` = the first column, else the column's branch key. */
  figures: Record<string, unknown>;
}

export const METHOD_TEMPLATE_SEEDS: readonly MethodTemplateSeed[] = [
  {
    key: 'military_grade',
    labelEn: 'By military grade',
    labelAr: 'حسب الرتبة العسكرية',
    sortOrder: 10,
    mechanism: {
      fact: 'military_grade',
      kind: 'choiceTable',
    },
    figures: {
      '': {
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
  {
    key: 'academic_rank_university',
    labelEn: 'By academic rank and university type',
    labelAr: 'حسب الدرجة العلمية ونوع الجامعة',
    sortOrder: 20,
    mechanism: {
      fact: 'academic_rank',
      kind: 'choiceTable',
      column: {
        fact: 'university_type',
        branches: ['uni_government', 'uni_private'],
      },
    },
    figures: {
      '': {
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
      uni_private: {
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
  {
    key: 'years_in_practice_city',
    labelEn: 'By years in practice and governorate group',
    labelAr: 'حسب سنوات الممارسة ومجموعة المحافظة',
    sortOrder: 30,
    mechanism: {
      fact: 'years_in_practice',
      kind: 'numberBand',
      column: {
        fact: 'practice_governorate',
        branchOn: 'parentClass',
        branches: ['city_tier_major', 'city_tier_secondary', 'city_tier_other'],
      },
    },
    figures: {
      '': {
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
      city_tier_secondary: {
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
      city_tier_other: {
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
    },
  },
  {
    key: 'years_in_practice',
    labelEn: 'By years in practice',
    labelAr: 'حسب سنوات الممارسة',
    sortOrder: 40,
    mechanism: {
      fact: 'years_in_practice',
      kind: 'numberBand',
    },
    figures: {},
  },
  {
    key: 'card_limit_share',
    labelEn: 'A share of the credit card limit',
    labelAr: 'نسبة من حد بطاقة الائتمان',
    sortOrder: 50,
    mechanism: {
      fact: 'credit_card_limit',
      kind: 'shareOf',
    },
    figures: {
      '': {
        scalar: {
          unit: 'percent',
          value: '50',
        },
      },
    },
  },
  {
    key: 'car_instalment_times',
    labelEn: 'The car loan instalment, multiplied',
    labelAr: 'قسط قرض السيارة مضروبًا',
    sortOrder: 60,
    mechanism: {
      fact: 'car_loan_installment',
      kind: 'multipleOf',
    },
    figures: {
      '': {
        scalar: {
          unit: 'multiplier',
          value: '3',
        },
      },
    },
  },
  {
    key: 'car_loan_share',
    labelEn: 'A share of the car loan',
    labelAr: 'نسبة من قرض السيارة',
    sortOrder: 70,
    mechanism: {
      fact: 'auto_loan_amount',
      kind: 'shareOf',
    },
    figures: {
      '': {
        scalar: {
          unit: 'percent',
          value: '10',
        },
      },
    },
  },
  {
    key: 'pledged_share',
    labelEn: 'A share of the pledged certificate or deposit',
    labelAr: 'نسبة من الشهادة أو الوديعة المرهونة',
    sortOrder: 80,
    mechanism: {
      fact: 'pledged_free_amount',
      kind: 'shareOf',
    },
    figures: {
      '': {
        scalar: {
          unit: 'percent',
          value: '30',
        },
      },
    },
  },
  {
    key: 'compound_class',
    labelEn: 'By compound class (new loan or top-up)',
    labelAr: 'حسب فئة الكومباوند (قرض جديد أو زيادة)',
    sortOrder: 90,
    mechanism: {
      fact: 'compound_name',
      kind: 'classTable',
      column: {
        fact: 'loan_is_topup',
        branches: ['new_loan', 'top_up'],
      },
    },
    figures: {
      '': {
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
      top_up: {
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
    },
  },
  {
    key: 'compound_down_payment',
    labelEn: 'By down payment on the unit (holds a product here or not)',
    labelAr: 'حسب مقدم الوحدة (لديه منتج لدى البنك أم لا)',
    sortOrder: 100,
    mechanism: {
      fact: 'unit_down_payment',
      kind: 'numberBand',
      column: {
        fact: 'holds_other_product',
        branches: ['other_product_none', 'other_product_held'],
      },
    },
    figures: {
      '': {
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
      other_product_held: {
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
    },
  },
  {
    key: 'compound_paid_share',
    labelEn: 'A share of what was paid for the unit',
    labelAr: 'نسبة مما دُفع في الوحدة',
    sortOrder: 110,
    mechanism: {
      fact: 'unit_paid_to_date',
      kind: 'shareOf',
    },
    figures: {
      '': {
        scalar: {
          unit: 'percent',
          value: '15',
        },
      },
    },
  },
  {
    key: 'unit_type',
    labelEn: 'By kind of unit (new loan or top-up)',
    labelAr: 'حسب نوع الوحدة (قرض جديد أو زيادة)',
    sortOrder: 120,
    mechanism: {
      fact: 'owned_unit_type',
      kind: 'choiceTable',
      column: {
        fact: 'loan_is_topup',
        branches: ['new_loan', 'top_up'],
      },
    },
    figures: {
      '': {
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
      top_up: {
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
  {
    key: 'school_stage_type',
    labelEn: 'By school stage and school type',
    labelAr: 'حسب المرحلة الدراسية ونوع المدرسة',
    sortOrder: 130,
    mechanism: {
      fact: 'school_stage',
      kind: 'choiceTable',
      column: {
        fact: 'school_type',
        branches: ['school_national', 'school_international'],
      },
    },
    figures: {
      '': {
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
      school_international: {
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
  {
    key: 'club_branch',
    labelEn: 'By club branch',
    labelAr: 'حسب فرع النادي',
    sortOrder: 140,
    mechanism: {
      fact: 'club_branch',
      kind: 'choiceTable',
    },
    figures: {
      '': {
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
  {
    key: 'car_down_payment_divided',
    labelEn: 'The car down payment, divided',
    labelAr: 'مقدم السيارة مقسومًا',
    sortOrder: 150,
    mechanism: {
      fact: 'car_down_payment',
      kind: 'dividedBy',
    },
    figures: {
      '': {
        scalar: {
          unit: 'multiplier',
          value: '3.6',
        },
      },
    },
  },
  {
    key: 'savings_divided',
    labelEn: 'Savings, divided (instalments or cash)',
    labelAr: 'المدخرات مقسومة (تقسيط أو كاش)',
    sortOrder: 160,
    mechanism: {
      fact: 'total_savings',
      kind: 'dividedBy',
      column: {
        fact: 'green_buyer_type',
        branches: ['instalment_buyer', 'cash_buyer'],
      },
    },
    figures: {
      '': {
        scalar: {
          unit: 'multiplier',
          value: '6',
        },
      },
      cash_buyer: {
        scalar: {
          unit: 'multiplier',
          value: '10',
        },
      },
    },
  },
] as unknown as readonly MethodTemplateSeed[];
