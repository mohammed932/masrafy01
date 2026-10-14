/**
 * The six I-Score classes the Egyptian credit bureau reports a score in, and the share of the
 * income each one counts.
 *
 * DATA: the classes live as the `i_score_class` lookup on Manage values — labels, the score
 * range and the income percentage are all editable there — and together they ARE the shared
 * I-Score table every program reads when neither it nor its product states one
 * (`PostgresPlatformEnumerationsRepository.platformIScoreTiers`). This list is only the seed
 * the `iscore_classes` / `iscore_shared_table` migrations wrote, kept here so the figures a
 * fresh database starts from are readable in one place.
 *
 * The ranges are the bureau's, inclusive at both ends. The table built from them opens the
 * ends (the lowest band from 0, the highest with no top), so a score outside 300–850 reads as
 * the nearest class. The class with no range is the bureau's N/A — no score given — and its
 * percentage is what a blank score counts. `0%` would be a stated figure too: the class
 * counts no income and the program offers nothing.
 *
 * Seeded figures (the operator's bank table, v30.4.0): N/A 85% · below 521 60% ·
 * 521–625 90% · above 625 100%.
 */
export interface IScoreClass {
  readonly key: string;
  readonly labelEn: string;
  readonly labelAr: string;
  /** `null` on the one "No I-Score" class — the bureau's N/A, a score nobody gave. */
  readonly rangeFrom: number | null;
  readonly rangeTo: number | null;
  readonly incomePercent: string;
}

export const I_SCORE_CLASS_TYPE = 'i_score_class';

export const I_SCORE_CLASSES: readonly IScoreClass[] = [
  {
    key: 'no_score',
    labelEn: 'No I-Score',
    labelAr: 'لا يوجد تقييم',
    rangeFrom: null,
    rangeTo: null,
    incomePercent: '85',
  },
  {
    key: 'defaulted',
    labelEn: 'Defaulted',
    labelAr: 'متعثر',
    rangeFrom: 300,
    rangeTo: 399,
    incomePercent: '60',
  },
  {
    key: 'high_risk',
    labelEn: 'High Risk',
    labelAr: 'مخاطر مرتفعة',
    rangeFrom: 400,
    rangeTo: 520,
    incomePercent: '60',
  },
  {
    key: 'unsatisfactory',
    labelEn: 'Unsatisfactory',
    labelAr: 'غير مرضي',
    rangeFrom: 521,
    rangeTo: 625,
    incomePercent: '90',
  },
  {
    key: 'satisfactory',
    labelEn: 'Satisfactory',
    labelAr: 'مرضي',
    rangeFrom: 626,
    rangeTo: 700,
    incomePercent: '100',
  },
  {
    key: 'very_good',
    labelEn: 'Very Good',
    labelAr: 'جيد جدًا',
    rangeFrom: 701,
    rangeTo: 750,
    incomePercent: '100',
  },
  {
    key: 'excellent',
    labelEn: 'Excellent',
    labelAr: 'ممتاز',
    rangeFrom: 751,
    rangeTo: 850,
    incomePercent: '100',
  },
];
