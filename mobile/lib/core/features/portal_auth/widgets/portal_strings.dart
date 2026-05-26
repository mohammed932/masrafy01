import 'package:flutter/widgets.dart';

/// Tiny inline localizer for portal shell strings. Six strings only; the
/// project does not yet ship a full `intl`/`.arb` workflow, so this is a
/// deliberate per-feature stopgap. Migrate when the app-wide localization
/// effort lands.
///
/// Falls back to English for any locale other than Arabic.
class PortalStrings {
  PortalStrings._();

  static const String loading = 'loading';
  static const String pleaseWait = 'pleaseWait';
  static const String offline = 'offline';
  static const String accountDisabled = 'accountDisabled';
  static const String accountDisabledBody = 'accountDisabledBody';
  static const String accountNotFound = 'accountNotFound';
  static const String networkError = 'networkError';
  static const String tryAgain = 'tryAgain';
  static const String contactSupport = 'contactSupport';
  static const String attachmentNotFound = 'attachmentNotFound';
  static const String backToQuestion = 'backToQuestion';

  static const Map<String, Map<String, String>> _table = {
    'en': {
      loading: 'Loading…',
      pleaseWait: 'Too many attempts. Please wait.',
      offline: "You're offline.",
      accountDisabled: 'Your account is disabled',
      accountDisabledBody:
          'Contact support to restore access to your Masrafy account.',
      accountNotFound: "We couldn't find your profile",
      networkError: "We couldn't reach the server. Try again.",
      tryAgain: 'Try again',
      contactSupport: 'Contact support',
      attachmentNotFound: 'Attachment not found',
      backToQuestion: 'Back to question',
    },
    'ar': {
      loading: '...جارٍ التحميل',
      pleaseWait: 'محاولات كثيرة. الرجاء الانتظار.',
      offline: 'أنت غير متصل بالإنترنت',
      accountDisabled: 'تم تعطيل حسابك',
      accountDisabledBody:
          'تواصل مع الدعم لاستعادة الوصول إلى حسابك في بايلوت100.',
      accountNotFound: 'تعذر العثور على ملفك الشخصي',
      networkError: 'تعذر الوصول إلى الخادم. حاول مرة أخرى.',
      tryAgain: 'حاول مرة أخرى',
      contactSupport: 'تواصل مع الدعم',
      attachmentNotFound: 'الملحق غير موجود',
      backToQuestion: 'العودة إلى السؤال',
    },
  };

  static String of(BuildContext context, String key) {
    final lang = Localizations.localeOf(context).languageCode;
    final bundle = _table[lang] ?? _table['en']!;
    return bundle[key] ?? _table['en']![key] ?? key;
  }
}
