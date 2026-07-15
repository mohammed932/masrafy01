import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Boxed OTP entry (Figma `137:2708`): [length] cells rendered over a single
/// transparent [TextField] that captures the keyboard input. The active cell
/// shows an accent border + caret; filled cells show a success border.
///
/// Feature-shared across the OTP verify + forgot-password flows (Principle
/// XXXII — shared widgets live under `pages/widgets/`).
class OtpCodeField extends StatefulWidget {
  const OtpCodeField({
    super.key,
    required this.value,
    required this.onChanged,
    this.length = 6,
    this.hasError = false,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final int length;
  final bool hasError;

  @override
  State<OtpCodeField> createState() => _OtpCodeFieldState();
}

class _OtpCodeFieldState extends State<OtpCodeField> {
  late final TextEditingController _controller;
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
    _focus.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(covariant OtpCodeField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _focus.requestFocus(),
      child: Stack(
        children: [
          Row(
            children: [
              for (var i = 0; i < widget.length; i++) ...[
                if (i > 0) Gap(10.w),
                Expanded(child: _Cell(
                  char: i < widget.value.length ? widget.value[i] : '',
                  filled: i < widget.value.length,
                  active: _focus.hasFocus && i == widget.value.length,
                  hasError: widget.hasError,
                )),
              ],
            ],
          ),
          Positioned.fill(
            child: TextField(
              controller: _controller,
              focusNode: _focus,
              autofocus: true,
              keyboardType: TextInputType.number,
              showCursor: false,
              enableInteractiveSelection: false,
              cursorWidth: 0,
              style: const TextStyle(color: Colors.transparent, height: 0.01),
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(widget.length),
              ],
              decoration: const InputDecoration(
                counterText: '',
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                fillColor: Colors.transparent,
                filled: true,
              ),
              onChanged: widget.onChanged,
              onTapOutside: (_) => _focus.unfocus(),
            ),
          ),
        ],
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.char,
    required this.filled,
    required this.active,
    required this.hasError,
  });

  final String char;
  final bool filled;
  final bool active;
  final bool hasError;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    final Color border;
    final Color bg;
    if (hasError && filled) {
      border = colors.error.main;
      bg = colors.error.main.withValues(alpha: 0.06);
    } else if (filled) {
      border = colors.success.main;
      bg = colors.success.main.withValues(alpha: 0.06);
    } else if (active) {
      border = colors.secondary.main;
      bg = colors.bg.container;
    } else {
      border = colors.border.main;
      bg = colors.bg.layout;
    }

    return AspectRatio(
      aspectRatio: 50 / 56,
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(14.r),
        ),
        child: filled
            ? Text(
                char,
                style: text.heading4.bold().copyWith(color: colors.text.heading),
              )
            : (active
                ? Container(
                    width: 2.w,
                    height: 28.h,
                    decoration: BoxDecoration(
                      color: colors.secondary.main,
                      borderRadius: BorderRadius.circular(1.r),
                    ),
                  )
                : const SizedBox.shrink()),
      ),
    );
  }
}
