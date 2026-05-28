import 'package:flutter/widgets.dart';

/// Locale helpers on `BuildContext` for the Masrafy auth/notification flows.
///
/// The platform supports two locales: Arabic (primary, RTL) and English
/// (secondary, LTR). Cubit + repository calls that need to forward the
/// user-visible language to the backend (OTP SMS body, password-reset
/// email copy, etc.) should call `context.masrafyLocaleCode` rather than
/// inline `Localizations.localeOf(...).languageCode == 'en' ? 'en' : 'ar'`.
extension MasrafyContextLocale on BuildContext {
  /// Canonical Masrafy locale code: `'en'` when the current locale's
  /// `languageCode` is exactly `en`, otherwise `'ar'` (Arabic is the
  /// default fallback per Principle IV — Arabic-First).
  String get masrafyLocaleCode =>
      Localizations.localeOf(this).languageCode == 'en' ? 'en' : 'ar';

  /// `true` when the current locale renders right-to-left (Arabic).
  bool get isRtl => Directionality.of(this) == TextDirection.rtl;
}
