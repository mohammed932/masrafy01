part of 'questionnaire.imports.dart';

/// Dynamic questionnaire form. Renders the snapshot's groups (each a
/// [QuestionGroupSection]) and a submit button that triggers the live
/// matching preview once every visible required question is answered.
class QuestionnaireFormPage extends StatelessWidget {
  const QuestionnaireFormPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = MasrafyColorTheme.of(context);
    final textTheme = MasrafyTextTheme.of(context);
    return BlocConsumer<QuestionnaireCubit, QuestionnaireState>(
      listenWhen: (a, b) => b.isFailure && a.error != b.error,
      listener: (ctx, state) {
        final failure = state.error;
        if (failure == null) return;
        ScaffoldMessenger.of(ctx)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(content: Text(_localizedFailure(l10n, failure.code))),
          );
      },
      builder: (ctx, state) {
        return Scaffold(
          appBar: AppBar(title: Text(l10n.questionnaire_form_title)),
          body: state.isLoadingQuestionnaire || state.snapshot == null
              ? const QuestionnaireFormSkeleton()
              : _FormBody(
                  snapshot: state.snapshot!,
                  l10n: l10n,
                  colors: colors,
                  textTheme: textTheme,
                ),
        );
      },
    );
  }
}

class _FormBody extends StatelessWidget {
  const _FormBody({
    required this.snapshot,
    required this.l10n,
    required this.colors,
    required this.textTheme,
  });

  final QuestionnaireSnapshotEntity snapshot;
  final AppLocalizations l10n;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    final groups = [...snapshot.groups]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    return Column(
      children: [
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsetsDirectional.all(16),
            itemCount: groups.length,
            separatorBuilder: (_, __) => const Gap(24),
            itemBuilder: (_, i) => QuestionGroupSection(group: groups[i]),
          ),
        ),
        _SubmitBar(l10n: l10n, colors: colors),
      ],
    );
  }
}

class _SubmitBar extends StatelessWidget {
  const _SubmitBar({required this.l10n, required this.colors});

  final AppLocalizations l10n;
  final MasrafyColorTheme colors;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<QuestionnaireCubit, QuestionnaireState>(
      buildWhen: (a, b) =>
          a.canSubmit != b.canSubmit ||
          a.isSubmittingPreview != b.isSubmittingPreview,
      builder: (ctx, state) {
        final enabled = state.canSubmit && !state.isSubmittingPreview;
        return SafeArea(
          minimum: const EdgeInsets.all(16),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed:
                  enabled ? () => ctx.read<QuestionnaireCubit>().submitPreview() : null,
              child: state.isSubmittingPreview
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l10n.questionnaire_form_action_submit),
            ),
          ),
        );
      },
    );
  }
}

/// Map a backend error `code` to a localized message — never show the
/// raw code (Constitution Principle III). Falls back to the generic
/// "no matches" copy for unmapped codes.
String _localizedFailure(AppLocalizations l10n, String code) {
  switch (code) {
    case 'QUESTIONNAIRE_NOT_PUBLISHED':
      return l10n.match_questionnaire_not_published;
    case 'UNKNOWN_QUESTION_CODE':
      return l10n.match_unknown_question_code;
    case 'UNKNOWN_OPTION_CODE':
      return l10n.match_unknown_option_code;
    case 'PROGRAM_NO_LONGER_MATCHES':
      return l10n.match_program_no_longer_matches;
    default:
      return l10n.match_preview_no_matches;
  }
}
