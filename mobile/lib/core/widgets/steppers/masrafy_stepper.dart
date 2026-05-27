import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

class MasrafyStepperItem {
  final String label;
  final IconData? icon;

  const MasrafyStepperItem({required this.label, this.icon});
}

/// Inline horizontal stepper matching the Figma "Steps" component:
/// [number circle] [label] [connector line] … [number circle] [label]
class MasrafyStepper extends StatelessWidget {
  final int currentStep;
  final List<MasrafyStepperItem> steps;

  const MasrafyStepper({
    super.key,
    required this.currentStep,
    required this.steps,
  });

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final textTheme = MasrafyTextTheme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        for (int i = 0; i < steps.length; i++) ...[
          if (i < steps.length - 1)
            Expanded(
              child: _StepWithConnector(
                index: i,
                item: steps[i],
                isActive: i == currentStep,
                isCompleted: i < currentStep,
                colors: colors,
                textTheme: textTheme,
              ),
            )
          else
            _StepHeader(
              index: i,
              item: steps[i],
              isActive: i == currentStep,
              isCompleted: i < currentStep,
              colors: colors,
              textTheme: textTheme,
            ),
        ],
      ],
    );
  }
}

class _StepWithConnector extends StatelessWidget {
  final int index;
  final MasrafyStepperItem item;
  final bool isActive;
  final bool isCompleted;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme textTheme;

  const _StepWithConnector({
    required this.index,
    required this.item,
    required this.isActive,
    required this.isCompleted,
    required this.colors,
    required this.textTheme,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StepHeader(
          index: index,
          item: item,
          isActive: isActive,
          isCompleted: isCompleted,
          colors: colors,
          textTheme: textTheme,
        ),
        Gap(8.w),
        Expanded(
          child: Container(
            height: 1,
            color: isCompleted ? colors.primary.main : colors.border.main,
          ),
        ),
      ],
    );
  }
}

class _StepHeader extends StatelessWidget {
  final int index;
  final MasrafyStepperItem item;
  final bool isActive;
  final bool isCompleted;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme textTheme;

  const _StepHeader({
    required this.index,
    required this.item,
    required this.isActive,
    required this.isCompleted,
    required this.colors,
    required this.textTheme,
  });

  @override
  Widget build(BuildContext context) {
    // Per Figma: completed steps use primary.bg + teal check icon,
    // active uses primary.main + white number, inactive uses fill.secondary
    // + tertiary number. All three share text.heading label EXCEPT the
    // inactive (still-pending) step, which uses text.tertiary.
    final Color circleColor;
    final Widget circleContent;
    final Color labelColor;

    if (isCompleted) {
      circleColor = colors.primary.bg;
      circleContent = Icon(
        Icons.check,
        size: 12.r,
        color: colors.primary.main,
      );
      labelColor = colors.text.heading;
    } else if (isActive) {
      circleColor = colors.primary.main;
      circleContent = Text(
        '${index + 1}',
        style: textTheme.bodySmall.regular().copyWith(
              color: Colors.white,
              height: 22 / 14,
            ),
      );
      labelColor = colors.text.heading;
    } else {
      circleColor = colors.fill.secondary;
      circleContent = Text(
        '${index + 1}',
        style: textTheme.bodySmall.regular().copyWith(
              color: colors.text.tertiary,
              height: 22 / 14,
            ),
      );
      labelColor = colors.text.tertiary;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 24.r,
          height: 24.r,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: circleColor,
          ),
          alignment: Alignment.center,
          child: circleContent,
        ),
        Gap(12.w),
        Text(
          item.label,
          style: textTheme.bodySmall.regular().copyWith(
                color: labelColor,
                height: 22 / 14,
              ),
        ),
      ],
    );
  }
}
