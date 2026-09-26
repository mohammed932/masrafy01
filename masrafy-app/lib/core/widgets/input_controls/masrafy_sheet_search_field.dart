import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';

/// Search input at the top of the shared select sheets
/// ([showMasrafySingleSelectSheet] / [showMasrafyMultiSelectSheet]).
///
/// Resting: a soft tinted pill with a magnifier and a visible hint — it sits
/// on the sheet's own container tone, so a plain outline read as an empty box.
/// Focused: lifts to the field plate with a brand stroke + glow and the
/// magnifier turns brand. A clear button appears once there is a query.
class MasrafySheetSearchField extends StatefulWidget {
  const MasrafySheetSearchField({
    super.key,
    required this.controller,
    required this.hint,
  });

  final TextEditingController controller;
  final String hint;

  @override
  State<MasrafySheetSearchField> createState() =>
      _MasrafySheetSearchFieldState();
}

class _MasrafySheetSearchFieldState extends State<MasrafySheetSearchField> {
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_rebuild);
    widget.controller.addListener(_rebuild);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_rebuild);
    _focusNode
      ..removeListener(_rebuild)
      ..dispose();
    super.dispose();
  }

  void _rebuild() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final focused = _focusNode.hasFocus;
    final hasQuery = widget.controller.text.isNotEmpty;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      height: MasrafyFieldMetrics.height,
      padding: EdgeInsetsDirectional.only(start: 14.w, end: 6.w),
      decoration: BoxDecoration(
        color: focused ? colors.bg.container : colors.fill.tertiary,
        border: Border.all(
          color: focused ? colors.primary.main : Colors.transparent,
          width: MasrafyFieldMetrics.borderWidth,
        ),
        borderRadius: BorderRadius.circular(MasrafyFieldMetrics.radius),
        boxShadow: focused
            ? MasrafyFieldMetrics.shadowFor(colors, focused: true)
            : null,
      ),
      child: Row(
        children: [
          Icon(
            Icons.search_rounded,
            size: 20.r,
            color: focused ? colors.primary.main : colors.text.tertiary,
          ),
          Gap(10.w),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              textInputAction: TextInputAction.search,
              cursorColor: colors.primary.main,
              style: texts.body.regular().copyWith(color: colors.text.heading),
              decoration: InputDecoration(
                isDense: true,
                contentPadding: EdgeInsets.zero,
                border: InputBorder.none,
                hintText: widget.hint,
                hintStyle: texts.body.regular().copyWith(
                      color: colors.text.placeholder,
                    ),
              ),
            ),
          ),
          if (hasQuery)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.controller.clear,
              // 36 hit box around a 20 chip — the chip stays small, the tap
              // target does not.
              child: SizedBox.square(
                dimension: 36.r,
                child: Center(
                  child: Container(
                    width: 20.r,
                    height: 20.r,
                    decoration: BoxDecoration(
                      color: colors.fill.main,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.close_rounded,
                      size: 13.r,
                      color: colors.bg.container,
                    ),
                  ),
                ),
              ),
            )
          else
            Gap(8.w),
        ],
      ),
    );
  }
}
