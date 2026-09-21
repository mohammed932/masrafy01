import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// The sub-label a field shows between its prompt and its control — the
/// sentence that says what the value IS when the prompt alone reads two ways
/// ("the AMOUNT, not a percentage"; "the total LIMIT, not the balance").
///
/// One widget rather than the same four lines in each control, because the
/// questionnaire renders `Question.helperText*` through whichever control the
/// question's type picks, and a helper that looks different under a select than
/// under a number reads as two different kinds of remark. Collapses to nothing
/// when there is no helper, so a caller can pass the field's optional value
/// straight through without guarding it.
///
/// Emits the leading gap itself; the caller keeps its own
/// `MasrafyFieldMetrics.labelGap` before the control.
class MasrafyFieldHelper extends StatelessWidget {
  const MasrafyFieldHelper(this.text, {super.key});

  final String? text;

  @override
  Widget build(BuildContext context) {
    final helper = text?.trim();
    if (helper == null || helper.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Gap(4.h),
        Text(
          helper,
          style: MasrafyTextTheme.of(context)
              .caption
              .regular()
              .copyWith(color: MasrafyColorTheme.of(context).text.tertiary),
        ),
      ],
    );
  }
}
