import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_step_scaffold.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// One questionnaire step — renders a backend [group]'s visible questions as
/// tap-to-select fields inside the collapsing hero scaffold. Each field drives
/// the cubit (`select`). Flow-local, UI-only (Principle XXXII / XXXVI). Only
/// `SINGLE_SELECT` questions ship in Phase 1; any other type is skipped rather
/// than crashing.
class QuestionnaireStep extends StatelessWidget {
  const QuestionnaireStep({
    super.key,
    required this.state,
    required this.group,
    required this.stepIndex,
  });

  final QuestionnaireState state;
  final QuestionGroupEntity group;
  final int stepIndex;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<QuestionnaireCubit>();
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final questions = state.visibleQuestions(group);

    void onBack() {
      if (!cubit.back()) context.router.maybePop();
    }

    return QuestionnaireStepScaffold(
      title: group.title(isAr),
      subtitle: l.q_dyn_subtitle,
      stepIndex: stepIndex,
      totalSteps: state.totalSteps,
      onBack: onBack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < questions.length; i++) ...[
            if (i > 0) Gap(20.h),
            _QuestionField(
              question: questions[i],
              value: state.answers[questions[i].code],
              isAr: isAr,
              hint: l.q_dyn_select_hint,
              searchHint: l.q_common_search,
              onSelected: (code) => cubit.select(questions[i].code, code),
            ),
          ],
        ],
      ),
    );
  }
}

/// A single question rendered as the shared instant tap-to-select field
/// (Principle XXXIII / A36). Options come straight from the backend snapshot;
/// [value] is the language-neutral option code. Long lists get search.
class _QuestionField extends StatelessWidget {
  const _QuestionField({
    required this.question,
    required this.value,
    required this.isAr,
    required this.hint,
    required this.searchHint,
    required this.onSelected,
  });

  final QuestionEntity question;
  final String? value;
  final bool isAr;
  final String hint;
  final String searchHint;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final label = question.label(isAr);
    final options = [
      for (final option in question.options)
        MasrafySelectOption<String>(value: option.code, label: option.label(isAr)),
    ];

    return MasrafySelectField<String>(
      label: label,
      hint: hint,
      sheetTitle: label,
      options: options,
      value: value,
      showSearch: options.length > 12,
      searchHint: searchHint,
      onSelected: onSelected,
    );
  }
}
