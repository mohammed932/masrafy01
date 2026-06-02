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
        final Widget body;
        if (state.isFailure && state.snapshot == null) {
          // First-load failure: an explicit error + retry, never a stuck skeleton.
          body = _LoadError(
            message: _localizedFailure(l10n, state.error?.code ?? ''),
            l10n: l10n,
            textTheme: textTheme,
            onRetry: () => ctx.read<QuestionnaireCubit>().loadQuestionnaire(state.category),
          );
        } else if (state.isLoadingQuestionnaire || state.snapshot == null) {
          body = const QuestionnaireFormSkeleton();
        } else {
          body = _FormBody(
            snapshot: state.snapshot!,
            l10n: l10n,
            colors: colors,
            textTheme: textTheme,
          );
        }
        return Scaffold(
          appBar: AppBar(title: Text(l10n.questionnaire_form_title)),
          body: body,
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

class _LoadError extends StatelessWidget {
  const _LoadError({
    required this.message,
    required this.l10n,
    required this.textTheme,
    required this.onRetry,
  });

  final String message;
  final AppLocalizations l10n;
  final MasrafyTextTheme textTheme;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center, style: textTheme.bodyLarge),
            const Gap(16),
            FilledButton(
              onPressed: onRetry,
              child: Text(l10n.match_action_retry),
            ),
          ],
        ),
      ),
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!state.canSubmit) ...[
                Text(
                  l10n.questionnaire_form_submit_hint,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colors.textBase.withValues(alpha: 0.6)),
                ),
                const Gap(8),
              ],
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: enabled
                      ? () => ctx.read<QuestionnaireCubit>().submitPreview()
                      : null,
                  child: state.isSubmittingPreview
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.questionnaire_form_action_submit),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Map a backend error `code` to a localized message — never show the
/// raw code (Constitution Principle III). Transport/server failures map to
/// generic copy, NOT the empty-result "no matches" message.
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
    case 'NETWORK_UNREACHABLE':
      return l10n.match_network_error;
    default:
      return l10n.match_generic_error;
  }
}
