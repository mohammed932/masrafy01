import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Shared prop surface for every input widget in this folder.
///
/// Concrete subclasses (`PilotTextField`, future `PilotPhoneField`,
/// `PilotDropdown`, …) extend this. The rendering + state machine comes
/// from the `PilotInput` mixin — subclasses only need to build the actual
/// input widget.
abstract class PilotBaseInput extends StatefulWidget {
  final String label;  // empty string → no floating label, use external label
  final String? hint;
  final String? initialValue;

  final TextEditingController? controller;
  final FocusNode? focusNode;

  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final FormFieldValidator<String>? validator;

  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;

  final bool autofocus;
  final bool obscureText;

  /// Show the eye-toggle icon on obscure fields. Defaults to true when
  /// `obscureText == true`.
  final bool? showObscureToggle;

  final bool enabled;
  final bool readOnly;

  final int? maxLength;
  final int? minLines;
  final int? maxLines;

  final Widget? prefixIcon;
  final Widget? suffixIcon;

  /// Controls when the validator fires. Defaults to
  /// [AutovalidateMode.onUserInteraction] so error text appears as soon as
  /// the user leaves a field — no [Form.validate()] call required for
  /// per-field feedback.
  final AutovalidateMode autovalidateMode;

  const PilotBaseInput({
    super.key,
    this.label = '',
    this.hint,
    this.initialValue,
    this.controller,
    this.focusNode,
    this.onChanged,
    this.onSubmitted,
    this.validator,
    this.keyboardType,
    this.textInputAction,
    this.inputFormatters,
    this.autofillHints,
    this.autofocus = false,
    this.obscureText = false,
    this.showObscureToggle,
    this.enabled = true,
    this.readOnly = false,
    this.maxLength,
    this.minLines,
    this.maxLines = 1,
    this.prefixIcon,
    this.suffixIcon,
    this.autovalidateMode = AutovalidateMode.onUserInteraction,
  });
}
