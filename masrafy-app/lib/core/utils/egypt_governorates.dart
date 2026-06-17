import 'package:app/l10n/generated/app_localizations.dart';

/// The 27 Egyptian governorates as proper-noun reference data — bilingual
/// in-file (Arabic-first), consistent with `CountryList` / `phone_dial_codes`
/// (reference data, not UI chrome, so not ~27 ARB keys). Shared by the
/// mortgage questionnaire and the profile contact editor (Principle XXXIII).
///
/// Widget-agnostic: exposes the raw entries + a label lookup; each consumer
/// maps [all] to whichever `MasrafySelectOption` variant its picker needs.
/// Each entry's [slug] is a stable, language-neutral id.
class EgyptGovernorates {
  EgyptGovernorates._();

  /// Localized label for a [slug] (null if unknown / null).
  static String? labelFor(AppLocalizations l, String? slug) {
    if (slug == null) return null;
    final isArabic = l.localeName.startsWith('ar');
    for (final g in all) {
      if (g.slug == slug) return isArabic ? g.ar : g.en;
    }
    return null;
  }

  static const List<EgyptGovernorate> all = [
    EgyptGovernorate('cairo', 'Cairo', 'القاهرة'),
    EgyptGovernorate('giza', 'Giza', 'الجيزة'),
    EgyptGovernorate('alexandria', 'Alexandria', 'الإسكندرية'),
    EgyptGovernorate('qalyubia', 'Qalyubia', 'القليوبية'),
    EgyptGovernorate('port_said', 'Port Said', 'بورسعيد'),
    EgyptGovernorate('suez', 'Suez', 'السويس'),
    EgyptGovernorate('dakahlia', 'Dakahlia', 'الدقهلية'),
    EgyptGovernorate('sharqia', 'Sharqia', 'الشرقية'),
    EgyptGovernorate('gharbia', 'Gharbia', 'الغربية'),
    EgyptGovernorate('monufia', 'Monufia', 'المنوفية'),
    EgyptGovernorate('beheira', 'Beheira', 'البحيرة'),
    EgyptGovernorate('kafr_el_sheikh', 'Kafr El Sheikh', 'كفر الشيخ'),
    EgyptGovernorate('damietta', 'Damietta', 'دمياط'),
    EgyptGovernorate('ismailia', 'Ismailia', 'الإسماعيلية'),
    EgyptGovernorate('faiyum', 'Faiyum', 'الفيوم'),
    EgyptGovernorate('beni_suef', 'Beni Suef', 'بني سويف'),
    EgyptGovernorate('minya', 'Minya', 'المنيا'),
    EgyptGovernorate('asyut', 'Asyut', 'أسيوط'),
    EgyptGovernorate('sohag', 'Sohag', 'سوهاج'),
    EgyptGovernorate('qena', 'Qena', 'قنا'),
    EgyptGovernorate('luxor', 'Luxor', 'الأقصر'),
    EgyptGovernorate('aswan', 'Aswan', 'أسوان'),
    EgyptGovernorate('red_sea', 'Red Sea', 'البحر الأحمر'),
    EgyptGovernorate('new_valley', 'New Valley', 'الوادي الجديد'),
    EgyptGovernorate('matrouh', 'Matrouh', 'مطروح'),
    EgyptGovernorate('north_sinai', 'North Sinai', 'شمال سيناء'),
    EgyptGovernorate('south_sinai', 'South Sinai', 'جنوب سيناء'),
  ];
}

class EgyptGovernorate {
  const EgyptGovernorate(this.slug, this.en, this.ar);
  final String slug;
  final String en;
  final String ar;

  String label(bool isArabic) => isArabic ? ar : en;
}
