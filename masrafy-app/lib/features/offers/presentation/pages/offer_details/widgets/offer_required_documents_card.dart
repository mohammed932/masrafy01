part of '../offer_details.imports.dart';

/// The papers this offer's bank asks for.
///
/// Banks have always configured `requiredDocuments` per program, but the list
/// never reached the customer — it arrived in the apply response and stopped
/// there. Showing it here is the difference between "apply and find out" and
/// knowing what to bring.
///
/// Labels come from the operator-managed `required_document` registry so they
/// are bilingual and stay in step with the admin dashboard. If the registry is
/// unreachable (or DI is absent, e.g. a widget test pumping this page), each key
/// degrades to a readable form of itself rather than an empty card.
class OfferRequiredDocumentsCard extends StatelessWidget {
  const OfferRequiredDocumentsCard({super.key, required this.documentKeys});

  final List<String> documentKeys;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);
    final isArabic = l.localeName.startsWith('ar');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l.match_preview_required_documents.toUpperCase(),
          style: text.bodySmall.copyWith(
            color: colors.primary.border,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.9,
          ),
        ),
        Gap(12.h),
        Container(
          width: double.infinity,
          padding: EdgeInsetsDirectional.fromSTEB(16.w, 14.h, 16.w, 14.h),
          decoration: BoxDecoration(
            color: colors.bg.container,
            borderRadius: BorderRadius.circular(16.r),
            border: Border.all(color: colors.border.split),
          ),
          child: FutureBuilder<Map<String, String>>(
            future: _labels(isArabic: isArabic),
            builder: (context, snapshot) {
              final labels = snapshot.data ?? const <String, String>{};
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final key in documentKeys) ...[
                    Padding(
                      padding: EdgeInsetsDirectional.only(bottom: 10.h),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.description_outlined,
                            size: 18.r,
                            color: colors.primary.main,
                          ),
                          Gap(10.w),
                          Expanded(
                            child: Text(
                              labels[key] ?? _humanize(key),
                              style:
                                  text.body.copyWith(color: colors.textBase),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  /// Registry lookup, guarded so this widget stays pumpable without DI.
  Future<Map<String, String>> _labels({required bool isArabic}) async {
    if (!getIt.isRegistered<PlatformEnumerationsUseCase>()) return const {};
    final res = await getIt<PlatformEnumerationsUseCase>()
        .byType(EnumerationTypes.requiredDocument);
    return res.fold(
      (_) => const <String, String>{},
      (list) => {
        for (final m in list) m.key: m.label(isArabic: isArabic),
      },
    );
  }

  /// `bank_statement` → `Bank statement`. Last-resort only.
  static String _humanize(String key) {
    if (key.isEmpty) return key;
    final spaced = key.replaceAll('_', ' ').toLowerCase();
    return spaced[0].toUpperCase() + spaced.substring(1);
  }
}
