part of '../questionnaire.imports.dart';

/// One improvement hint. The backend `code` is never shown raw
/// (Constitution Principle III) — it is mapped to a localized,
/// count-aware message.
class PreviewSuggestionTile extends StatelessWidget {
  const PreviewSuggestionTile({super.key, required this.suggestion});

  final PreviewSuggestionEntity suggestion;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final textTheme = MasrafyTextTheme.of(context);
    final l10n = AppLocalizations.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(12),
      decoration: BoxDecoration(
        color: colors.info.bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.info.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lightbulb_outline, size: 18, color: colors.info.text),
          const Gap(8),
          Expanded(
            child: Text(
              l10n.match_preview_suggestion_unlock(suggestion.programsUnlocked),
              style: textTheme.bodySmall.copyWith(color: colors.text.primary),
            ),
          ),
        ],
      ),
    );
  }
}
