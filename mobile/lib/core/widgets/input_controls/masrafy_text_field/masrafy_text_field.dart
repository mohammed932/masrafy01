import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

import 'masrafy_base_input.dart';
import 'masrafy_input.dart';

/// Themed single-line text input. The styling + state machine live in
/// the [MasrafyInput] mixin; this class only declares the prop surface
/// (via [MasrafyBaseInput]) and renders a `TextFormField` wired to the
/// mixin's controller, focus node, and decoration.
class MasrafyTextField extends MasrafyBaseInput {
  const MasrafyTextField({
    super.key,
    super.label,
    super.hint,
    super.initialValue,
    super.controller,
    super.focusNode,
    super.onChanged,
    super.onSubmitted,
    super.validator,
    super.keyboardType,
    super.textInputAction,
    super.inputFormatters,
    super.autofillHints,
    super.autofocus,
    super.obscureText,
    super.showObscureToggle,
    super.enabled,
    super.readOnly,
    super.maxLength,
    super.minLines,
    super.maxLines,
    super.prefixIcon,
    super.suffixIcon,
    super.autovalidateMode,
  });

  @override
  State<MasrafyTextField> createState() => _MasrafyTextFieldState();
}

class _MasrafyTextFieldState extends State<MasrafyTextField>
    with MasrafyInput<MasrafyTextField> {
  @override
  Widget buildField(BuildContext context, InputDecoration decoration) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return TextFormField(
      controller: controller,
      focusNode: focusNode,
      autofocus: widget.autofocus,
      enabled: widget.enabled,
      readOnly: widget.readOnly,
      obscureText: isObscured,
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      inputFormatters: widget.inputFormatters,
      autofillHints: widget.autofillHints,
      maxLength: widget.maxLength,
      minLines: widget.minLines,
      maxLines: isObscured ? 1 : widget.maxLines,
      validator: wrappedValidator,
      autovalidateMode: widget.autovalidateMode,
      onChanged: handleChanged,
      onFieldSubmitted: widget.onSubmitted,
      onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
      cursorColor: colors.primary.main,
      style: text.body.medium().copyWith(color: colors.text.primary),
      decoration: decoration,
    );
  }
}
