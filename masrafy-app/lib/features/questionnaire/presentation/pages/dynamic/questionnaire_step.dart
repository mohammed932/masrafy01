import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/grouped_number_input_formatter.dart';
import 'package:app/core/widgets/input_controls/masrafy_multi_select_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_text_field/masrafy_text_field.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/question_type.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_step_scaffold.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// One questionnaire step — renders a backend [group]'s visible questions
/// inside the collapsing hero scaffold, one control per answer type
/// (feature 010): single choice and multi choice use the shared tap-to-select
/// bottom sheets (Principle XXXIII / A36), number and text use the themed
/// input. Each control drives the cubit. Flow-local, UI-only
/// (Principle XXXII / XXXVI).
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
              // Keyed by code so a branch rule that swaps the visible set never
              // hands one question's text controller to another.
              key: ValueKey(questions[i].code),
              question: questions[i],
              answer: state.answers[questions[i].code],
              isAr: isAr,
            ),
          ],
        ],
      ),
    );
  }
}

/// Dispatches one question to the control its type calls for. An unknown type
/// renders nothing rather than crashing.
class _QuestionField extends StatelessWidget {
  const _QuestionField({
    super.key,
    required this.question,
    required this.answer,
    required this.isAr,
  });

  final QuestionEntity question;
  final QuestionAnswer? answer;
  final bool isAr;

  @override
  Widget build(BuildContext context) {
    return switch (question.type) {
      QuestionType.singleSelect => _SingleChoiceField(
          question: question,
          value: answer is SingleChoiceAnswer
              ? (answer! as SingleChoiceAnswer).optionCode
              : null,
          isAr: isAr,
        ),
      QuestionType.multiSelect => _MultiChoiceField(
          question: question,
          values: answer is MultiChoiceAnswer
              ? (answer! as MultiChoiceAnswer).optionCodes
              : const [],
          isAr: isAr,
        ),
      QuestionType.numeric => _NumericField(
          question: question,
          initialValue:
              answer is NumericAnswer ? (answer! as NumericAnswer).value : '',
          isAr: isAr,
        ),
      QuestionType.text => _FreeTextField(
          question: question,
          initialValue:
              answer is TextAnswer ? (answer! as TextAnswer).value : '',
          isAr: isAr,
        ),
    };
  }
}

/// `SINGLE_SELECT` — the shared instant tap-to-select field. [value] is the
/// language-neutral option code. Long lists get search.
class _SingleChoiceField extends StatelessWidget {
  const _SingleChoiceField({
    required this.question,
    required this.value,
    required this.isAr,
  });

  final QuestionEntity question;
  final String? value;
  final bool isAr;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<QuestionnaireCubit>();
    final label = question.label(isAr);
    final options = [
      for (final option in question.options)
        MasrafySelectOption<String>(
          value: option.code,
          label: option.label(isAr),
        ),
    ];

    return MasrafySelectField<String>(
      label: label,
      hint: l.q_dyn_select_hint,
      sheetTitle: label,
      options: options,
      value: value,
      showSearch: options.length > 12,
      searchHint: l.q_common_search,
      onSelected: (code) => cubit.selectOne(question.code, code),
    );
  }
}

/// `MULTI_SELECT` — the shared multi-select sheet (toggle rows, Save applies).
class _MultiChoiceField extends StatelessWidget {
  const _MultiChoiceField({
    required this.question,
    required this.values,
    required this.isAr,
  });

  final QuestionEntity question;
  final List<String> values;
  final bool isAr;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<QuestionnaireCubit>();
    final label = question.label(isAr);
    final options = [
      for (final option in question.options)
        MasrafyMultiSelectOption<String>(
          value: option.code,
          label: option.label(isAr),
        ),
    ];

    return MasrafyMultiSelectField<String>(
      label: label,
      hint: l.q_dyn_select_many_hint,
      sheetTitle: label,
      options: options,
      values: values,
      showSearch: options.length > 12,
      searchHint: l.q_common_search,
      applyLabel: l.q_common_save,
      cancelLabel: l.q_common_cancel,
      emptyMessage: l.q_dyn_empty,
      onChanged: (codes) => cubit.selectMany(question.code, codes),
    );
  }
}

/// `NUMERIC` — a typed figure with the admin-set bounds. The value travels as a
/// decimal STRING (Principle I / A3); the bounds are enforced here only for
/// immediate feedback, and authoritatively by the server
/// (`ANSWER_OUT_OF_RANGE`).
class _NumericField extends StatefulWidget {
  const _NumericField({
    required this.question,
    required this.initialValue,
    required this.isAr,
  });

  final QuestionEntity question;
  final String initialValue;
  final bool isAr;

  @override
  State<_NumericField> createState() => _NumericFieldState();
}

class _NumericFieldState extends State<_NumericField> {
  // A saved answer arrives ungrouped (`1000000`), so it is formatted once on
  // seed; every later keystroke is grouped by the input formatter.
  late final TextEditingController _controller = TextEditingController(
    text: GroupedNumberInputFormatter.format(widget.initialValue) ??
        widget.initialValue,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Local mirror of the server's numeric rule. Returns null when the value is
  /// acceptable (or empty — "required" is the wizard's gate, not this field's).
  ///
  /// The message names the rule that actually failed: a bounds violation reads
  /// as a range, an OFF-STEP figure reads as a step. Reporting the range for
  /// both told a `step: 6` tenor typed as `9` to "enter 6 – 120", which it
  /// already had.
  String? _validate(String? raw, AppLocalizations l) {
    // `raw` carries the grouped display text — the separators come off before
    // the bounds are checked.
    final value = GroupedNumberInputFormatter.unformat((raw ?? '').trim());
    if (value.isEmpty) return null;
    final parsed = num.tryParse(value);
    if (parsed == null) return l.q_dyn_number_invalid;

    final rules = widget.question.numeric;
    if (rules == null || rules.accepts(parsed)) return null;
    if (!rules.withinBounds(parsed)) return _boundsError(rules, l);
    return _stepError(rules, parsed, l);
  }

  /// Value outside [min, max].
  String _boundsError(NumericRulesEntity rules, AppLocalizations l) {
    final min = rules.minDisplay;
    final max = rules.maxDisplay;
    if (min != null && max != null) return l.q_dyn_number_range(min, max);
    if (min != null) return l.q_dyn_number_min(min);
    if (max != null) return l.q_dyn_number_max(max);
    return l.q_dyn_number_invalid;
  }

  /// Value inside the band but off the step grid — the two grid points either
  /// side are named, so the fix is a tap away instead of a guess.
  String _stepError(NumericRulesEntity rules, num parsed, AppLocalizations l) {
    final step = rules.stepDisplay ?? '';
    final below = rules.stepBelowDisplay(parsed);
    final above = rules.stepAboveDisplay(parsed);
    if (below != null && above != null) {
      return l.q_dyn_number_step_nearest(step, below, above);
    }
    final only = below ?? above;
    if (only != null) return l.q_dyn_number_step_nearest_one(step, only);
    return l.q_dyn_number_step(step);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<QuestionnaireCubit>();
    final rules = widget.question.numeric;
    final unit = rules?.unit(widget.isAr);

    // The unit rides the field as a trailing suffix (`6 – 120  months`) instead
    // of tailing the prompt — it stays visible once the user types.
    return _TitledField(
      title: widget.question.label(widget.isAr),
      child: MasrafyTextField(
        hint: _boundsHint(rules, l),
        // The step rule is invisible in a `6 – 120` hint, so it stands under the
        // field until the value breaks it.
        helperText: _stepHelper(rules, l),
        suffixIcon: unit == null || unit.isEmpty ? null : _UnitSuffix(unit),
        controller: _controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        // Digits + one decimal point only, grouped in thousands for reading
        // (`1,000,000`); the cubit and the server take the ungrouped 2-dp
        // decimal string.
        inputFormatters: [
          GroupedNumberInputFormatter.allowedCharacters,
          const GroupedNumberInputFormatter(),
        ],
        validator: (raw) => _validate(raw, l),
        onChanged: (raw) => cubit.setNumber(
          widget.question.code,
          GroupedNumberInputFormatter.unformat(raw),
        ),
      ),
    );
  }

  /// Standing note about the step grid, or null when any figure in the band is
  /// acceptable.
  String? _stepHelper(NumericRulesEntity? rules, AppLocalizations l) {
    final step = rules?.stepNum;
    if (step == null || step <= 0) return null;
    return l.q_dyn_number_step_helper(rules!.stepDisplay ?? '');
  }

  /// Placeholder describing the accepted band, e.g. `1000 – 20000000`.
  String _boundsHint(NumericRulesEntity? rules, AppLocalizations l) {
    final min = rules?.minDisplay;
    final max = rules?.maxDisplay;
    if (min != null && max != null) return '$min – $max';
    if (min != null) return l.q_dyn_number_min(min);
    if (max != null) return l.q_dyn_number_max(max);
    return l.q_dyn_number_hint;
  }
}

/// Admin-set unit (`months`, `EGP`, …) pinned to the trailing edge of a numeric
/// field. Sized down to the text so it doesn't eat the 48px suffix slot.
class _UnitSuffix extends StatelessWidget {
  const _UnitSuffix(this.unit);

  final String unit;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Padding(
      padding: EdgeInsetsDirectional.only(start: 8.w, end: 14.w),
      child: Align(
        alignment: AlignmentDirectional.centerEnd,
        widthFactor: 1,
        child: Text(
          unit,
          style: text.body.regular().copyWith(color: colors.text.tertiary),
        ),
      ),
    );
  }
}

/// `TEXT` — free text, capped at the admin-set length.
class _FreeTextField extends StatefulWidget {
  const _FreeTextField({
    required this.question,
    required this.initialValue,
    required this.isAr,
  });

  final QuestionEntity question;
  final String initialValue;
  final bool isAr;

  @override
  State<_FreeTextField> createState() => _FreeTextFieldState();
}

class _FreeTextFieldState extends State<_FreeTextField> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialValue);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<QuestionnaireCubit>();

    return _TitledField(
      title: widget.question.label(widget.isAr),
      child: MasrafyTextField(
        hint: l.q_dyn_text_hint,
        controller: _controller,
        keyboardType: TextInputType.text,
        maxLength: widget.question.text?.maxLength,
        maxLines: 1,
        onChanged: (raw) => cubit.setText(widget.question.code, raw),
      ),
    );
  }
}

/// Question prompt rendered ABOVE the input instead of as a floating label —
/// a long prompt ellipsizes inside the field, so text/number questions get the
/// same external uppercase title chrome the select fields use
/// ([MasrafySelectField] default density), with a short hint left inside.
class _TitledField extends StatelessWidget {
  const _TitledField({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: text.caption.semiBold().copyWith(
                color: colors.text.secondary,
                letterSpacing: 0.5,
              ),
        ),
        Gap(8.h),
        child,
      ],
    );
  }
}
