/**
 * The car list's first-run contents (v36.4.0): country of make → brand → model.
 *
 * KEYS ARE ANSWER CODES. The countries are `car_origin`'s own answers and the brands are
 * `what_brand_is_the_car`'s, so mirroring a list onto its question changes no stored answer
 * and no bank table keyed on one. Models are new. The operator owns the list after the first
 * run (the Car list page); the seed only inserts what is missing and never renames, refiles
 * or removes.
 */
export interface CarListRow {
  key: string;
  labelEn: string;
  labelAr: string;
  parentKey?: string;
}

export const CAR_COUNTRY_TYPE = 'car_country';
export const CAR_BRAND_TYPE = 'car_brand';
export const CAR_MODEL_TYPE = 'car_model';

export const CAR_COUNTRY_QUESTION = 'car_origin';
export const CAR_BRAND_QUESTION = 'what_brand_is_the_car';
export const CAR_MODEL_QUESTION = 'what_model_is_the_car';

export const CAR_LIST_TYPES = [
  {
    key: CAR_COUNTRY_TYPE,
    labelEn: 'Country',
    labelAr: 'البلد',
    parentTypeKey: null,
    question: CAR_COUNTRY_QUESTION,
  },
  {
    key: CAR_BRAND_TYPE,
    labelEn: 'Brand',
    labelAr: 'الماركة',
    parentTypeKey: CAR_COUNTRY_TYPE,
    question: CAR_BRAND_QUESTION,
  },
  {
    key: CAR_MODEL_TYPE,
    labelEn: 'Model',
    labelAr: 'الطراز',
    parentTypeKey: CAR_BRAND_TYPE,
    question: CAR_MODEL_QUESTION,
  },
] as const;

/** `car_origin`'s answers, unchanged. */
export const CAR_COUNTRIES: CarListRow[] = [
  { key: 'germany', labelEn: 'Germany', labelAr: 'ألمانيا' },
  { key: 'japan', labelEn: 'Japan', labelAr: 'اليابان' },
  { key: 'usa', labelEn: 'United States', labelAr: 'الولايات المتحدة' },
  { key: 'korea', labelEn: 'South Korea', labelAr: 'كوريا الجنوبية' },
  { key: 'france', labelEn: 'France', labelAr: 'فرنسا' },
  { key: 'italy', labelEn: 'Italy', labelAr: 'إيطاليا' },
  { key: 'spain', labelEn: 'Spain', labelAr: 'إسبانيا' },
  { key: 'czechia', labelEn: 'Czech Republic', labelAr: 'التشيك' },
  { key: 'china', labelEn: 'China', labelAr: 'الصين' },
  { key: 'egypt', labelEn: 'Assembled in Egypt', labelAr: 'مجمّعة في مصر' },
  { key: 'other_origin', labelEn: 'Somewhere else', labelAr: 'بلد آخر' },
];

/** `what_brand_is_the_car`'s answers, each filed under where the brand is from. */
export const CAR_BRANDS: CarListRow[] = [
  { key: 'toyota', labelEn: 'Toyota', labelAr: 'تويوتا', parentKey: 'japan' },
  { key: 'nissan', labelEn: 'Nissan', labelAr: 'نيسان', parentKey: 'japan' },
  { key: 'mitsubishi', labelEn: 'Mitsubishi', labelAr: 'ميتسوبيشي', parentKey: 'japan' },
  { key: 'suzuki', labelEn: 'Suzuki', labelAr: 'سوزوكي', parentKey: 'japan' },
  { key: 'hyundai', labelEn: 'Hyundai', labelAr: 'هيونداي', parentKey: 'korea' },
  { key: 'kia', labelEn: 'Kia', labelAr: 'كيا', parentKey: 'korea' },
  { key: 'chevrolet', labelEn: 'Chevrolet', labelAr: 'شيفروليه', parentKey: 'usa' },
  { key: 'jeep', labelEn: 'Jeep', labelAr: 'جيب', parentKey: 'usa' },
  { key: 'mg', labelEn: 'MG', labelAr: 'إم جي', parentKey: 'china' },
  { key: 'chery', labelEn: 'Chery', labelAr: 'شيري', parentKey: 'china' },
  { key: 'byd', labelEn: 'BYD', labelAr: 'بي واي دي', parentKey: 'china' },
  { key: 'geely', labelEn: 'Geely', labelAr: 'جيلي', parentKey: 'china' },
  { key: 'peugeot', labelEn: 'Peugeot', labelAr: 'بيجو', parentKey: 'france' },
  { key: 'renault', labelEn: 'Renault', labelAr: 'رينو', parentKey: 'france' },
  { key: 'skoda', labelEn: 'Skoda', labelAr: 'سكودا', parentKey: 'czechia' },
  { key: 'volkswagen', labelEn: 'Volkswagen', labelAr: 'فولكس فاجن', parentKey: 'germany' },
  { key: 'mercedes_benz', labelEn: 'Mercedes-Benz', labelAr: 'مرسيدس بنز', parentKey: 'germany' },
  { key: 'bmw', labelEn: 'BMW', labelAr: 'بي إم دبليو', parentKey: 'germany' },
  { key: 'audi', labelEn: 'Audi', labelAr: 'أودي', parentKey: 'germany' },
  {
    key: 'another_brand',
    labelEn: 'Another brand',
    labelAr: 'ماركة أخرى',
    parentKey: 'other_origin',
  },
];

const MODELS: Record<string, string[]> = {
  toyota: ['Corolla', 'Yaris', 'RAV4', 'Fortuner'],
  nissan: ['Sunny', 'Sentra', 'Qashqai'],
  mitsubishi: ['Lancer', 'Attrage', 'Eclipse Cross'],
  suzuki: ['Swift', 'Dzire', 'Vitara'],
  hyundai: ['Elantra', 'Accent', 'Tucson'],
  kia: ['Cerato', 'Sportage', 'Picanto'],
  chevrolet: ['Optra', 'Aveo', 'Captiva'],
  jeep: ['Compass', 'Grand Cherokee'],
  mg: ['MG5', 'ZS', 'RX5'],
  chery: ['Tiggo 4', 'Tiggo 7', 'Arrizo 5'],
  byd: ['F3', 'Seal'],
  geely: ['Coolray', 'Emgrand'],
  peugeot: ['301', '2008', '3008'],
  renault: ['Logan', 'Duster', 'Megane'],
  skoda: ['Octavia', 'Kamiq', 'Kodiaq'],
  volkswagen: ['Polo', 'Passat', 'Tiguan'],
  mercedes_benz: ['C 200', 'E 180', 'GLA 200'],
  bmw: ['320i', 'X1', 'X3'],
  audi: ['A3', 'A4', 'Q3'],
};

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** A model's key is its brand's key + its own name, so two brands' "X1" never collide. */
export const CAR_MODELS: CarListRow[] = Object.entries(MODELS).flatMap(([brand, names]) =>
  names.map((name) => ({
    key: `${brand}_${slug(name)}`,
    labelEn: name,
    labelAr: name,
    parentKey: brand,
  })),
);

/**
 * A demo car program (v36.6.0) that prices on the nested answers, so a fresh machine shows
 * what Cases do: Bank NXT's "New Car", its figures copied from the bank's used-car program,
 * with five cases read top to bottom. Created once; after that it is the operator's.
 */
export const CAR_DEMO_PROGRAM = {
  programCode: 'NXT-CAR-NEW_CAR',
  copyFrom: 'NXT-CAR-USED_CAR',
  programNameKey: 'new_car',
  friendlyName: 'Nested car demo',
  friendlyNameAr: 'عرض السيارات المتداخل',
  cases: [
    {
      id: 'case_1',
      allOf: [
        { factKey: CAR_BRAND_QUESTION, option: 'mercedes_benz' },
        { factKey: CAR_MODEL_QUESTION, option: 'mercedes_benz_c_200' },
      ],
      effects: { ratePercent: '11' },
    },
    {
      id: 'case_2',
      allOf: [{ factKey: CAR_BRAND_QUESTION, option: 'mercedes_benz' }],
      effects: { ratePercent: '13' },
    },
    {
      id: 'case_3',
      allOf: [{ factKey: CAR_COUNTRY_QUESTION, option: 'germany' }],
      effects: { ratePercent: '15', maxMonths: 72 },
    },
    {
      id: 'case_4',
      allOf: [
        { factKey: CAR_COUNTRY_QUESTION, option: 'china' },
        { factKey: 'car_model_year', before: '2022' },
      ],
      effects: { ltvCeilingPercent: '50', maxMonths: 48 },
    },
    {
      id: 'case_5',
      allOf: [{ factKey: CAR_BRAND_QUESTION, option: 'chery' }],
      effects: {},
      refuse: true,
    },
  ],
} as const;
