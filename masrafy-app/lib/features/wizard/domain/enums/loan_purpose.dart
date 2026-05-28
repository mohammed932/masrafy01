/// Constitution v1.7.0 / Principle II scope-lock: exactly four retail loan
/// categories. Credit cards (Phase 2) are NOT a loan and are not represented
/// here.
enum LoanPurpose {
  personal('personal', 'قرض شخصي', 'Personal loan'),
  car('car', 'قرض سيارة', 'Car loan'),
  mortgage('mortgage', 'قرض عقاري', 'Mortgage'),
  business('business', 'قرض الأعمال', 'Business loan');

  const LoanPurpose(this.key, this.labelAr, this.labelEn);

  final String key;
  final String labelAr;
  final String labelEn;
}
