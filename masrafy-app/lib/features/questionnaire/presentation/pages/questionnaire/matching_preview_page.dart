part of 'questionnaire.imports.dart';

/// Live matching-preview result. Shows the shape-matched skeleton while
/// submitting, then the list of [PreviewMatchCard]s plus any
/// improvement [PreviewSuggestionTile]s. Back returns to the form.
class MatchingPreviewPage extends StatelessWidget {
  const MatchingPreviewPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocBuilder<QuestionnaireCubit, QuestionnaireState>(
      builder: (ctx, state) {
        final preview = state.preview;
        return Scaffold(
          appBar: AppBar(
            title: Text(l10n.match_preview_title),
            leading: BackButton(
              onPressed: () => ctx.read<QuestionnaireCubit>().backToForm(),
            ),
          ),
          body: state.isSubmittingPreview || preview == null
              ? const MatchingPreviewSkeleton()
              : _PreviewBody(preview: preview, l10n: l10n),
        );
      },
    );
  }
}

class _PreviewBody extends StatelessWidget {
  const _PreviewBody({required this.preview, required this.l10n});

  final MatchingPreviewEntity preview;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final textTheme = MasrafyTextTheme.of(context);
    final colors = MasrafyColorTheme.of(context);
    if (preview.matches.isEmpty && preview.suggestions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(24),
          child: Text(
            l10n.match_preview_no_matches,
            textAlign: TextAlign.center,
            style: textTheme.body.copyWith(color: colors.text.secondary),
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsetsDirectional.all(16),
      children: [
        for (final match in preview.matches) ...[
          PreviewMatchCard(match: match),
          const Gap(12),
        ],
        if (preview.suggestions.isNotEmpty) ...[
          const Gap(8),
          Text(
            l10n.match_preview_section_suggestions,
            style: textTheme.heading5.copyWith(color: colors.text.primary),
          ),
          const Gap(12),
          for (final suggestion in preview.suggestions) ...[
            PreviewSuggestionTile(suggestion: suggestion),
            const Gap(8),
          ],
        ],
      ],
    );
  }
}
