import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

import 'pilot_base_input.dart';

/// Shared state + decoration for every input that extends [PilotBaseInput].
///
/// Concrete State subclasses (e.g. `_PilotTextFieldState`) mix this in and
/// implement `buildField(decoration)` — the mixin takes care of:
///   - controller + focus-node lifecycle (creates them if the widget
///     doesn't provide its own; disposes only the ones it created)
///   - focus-driven border and label colors
///   - obscure-toggle state and suffix icon
///   - the `InputDecoration` (border, fill, label, hint, prefix/suffix)
mixin PilotInput<T extends PilotBaseInput> on State<T> {
  late TextEditingController _controller;
  late FocusNode _focusNode;
  late bool _ownsController;
  late bool _ownsFocusNode;

  bool _focused = false;
  bool _obscured = false;
  bool _touched = false;
  // Flips true on the first user keystroke. Used by [didUpdateWidget] so an
  // updated `initialValue` from the parent re-seeds the controller only
  // while the field is still pristine — never overwriting typed input.
  bool _userHasTyped = false;

  TextEditingController get controller => _controller;
  FocusNode get focusNode => _focusNode;
  bool get isFocused => _focused;
  bool get isObscured => _obscured;
  // Error styling only kicks in after the user has interacted with the field
  // (first blur after a focus). This keeps fields in a neutral state on first
  // render; Form.validate() / explicit touch is what turns them red.
  bool get hasError =>
      _touched && widget.validator?.call(controller.text) != null;
  bool get showObscureToggle =>
      widget.obscureText && (widget.showObscureToggle ?? true);

  @override
  void initState() {
    super.initState();
    _ownsController = widget.controller == null;
    _controller = widget.controller ??
        TextEditingController(text: widget.initialValue ?? '');

    _ownsFocusNode = widget.focusNode == null;
    _focusNode = widget.focusNode ?? FocusNode();
    _focusNode.addListener(_handleFocusChanged);

    _obscured = widget.obscureText;
  }

  @override
  void didUpdateWidget(covariant T oldWidget) {
    super.didUpdateWidget(oldWidget);
    // If the parent rebuilds with a new `initialValue` and we own the
    // controller, adopt it — but only while the field is still pristine.
    // This covers the common case where the prefill value isn't available
    // at first `build` (e.g. a Bloc state that resolves asynchronously).
    if (_ownsController &&
        !_userHasTyped &&
        oldWidget.initialValue != widget.initialValue &&
        widget.initialValue != _controller.text) {
      _controller.text = widget.initialValue ?? '';
    }
  }

  /// Wrap the caller-provided `onChanged` so we can note the first keystroke.
  /// `buildField` must call this via `handleChanged` instead of forwarding
  /// `widget.onChanged` directly.
  void handleChanged(String value) {
    _userHasTyped = true;
    widget.onChanged?.call(value);
  }

  /// Wrapper passed to `TextFormField.validator` instead of `widget.validator`
  /// directly. When `Form.validate()` is called on a field the user has never
  /// typed in, this forces `_touched = true` (post-frame) so `hasError`
  /// becomes true and the error text renders in our [build] Column.
  FormFieldValidator<String>? get wrappedValidator {
    if (widget.validator == null) return null;
    return (v) {
      final error = widget.validator!(v);
      if (error != null && !_userHasTyped && !_touched) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) setState(() => _touched = true);
        });
      }
      return error;
    };
  }

  /// The error message to display below the field, or null when the field
  /// is valid or hasn't been interacted with yet.
  String? get resolvedErrorText =>
      hasError ? widget.validator?.call(controller.text) : null;

  @override
  void dispose() {
    _focusNode.removeListener(_handleFocusChanged);
    if (_ownsFocusNode) _focusNode.dispose();
    if (_ownsController) _controller.dispose();
    super.dispose();
  }

  void _handleFocusChanged() {
    if (!mounted) return;
    setState(() {
      _focused = _focusNode.hasFocus;
      // First blur marks the field as touched — from then on validation
      // drives the border / label color.
      if (!_focused) _touched = true;
    });
  }

  void toggleObscured() => setState(() => _obscured = !_obscured);

  // ----- decoration helpers -----

  Color borderColor(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    if (hasError) return colors.error.main;
    if (_focused) return colors.primary.main;
    return colors.border.main;
  }

  Color labelColor(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    if (hasError) return colors.error.main;
    if (_focused) return colors.primary.main;
    return colors.text.secondary;
  }

  OutlineInputBorder buildBorder(BuildContext context) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(8.r),
        borderSide: BorderSide(color: borderColor(context), width: 1),
      );

  /// The suffix icon to show. If the widget has an obscure-toggle, the
  /// eye icon replaces any provided `suffixIcon`. Subclasses that want
  /// different suffix behavior can override this getter.
  Widget? resolveSuffix(BuildContext context) {
    if (!showObscureToggle) return widget.suffixIcon;
    final colors = PilotColorTheme.of(context);
    return IconButton(
      icon: Icon(
        _obscured ? Icons.visibility_off : Icons.visibility,
        color: colors.text.secondary,
      ),
      onPressed: toggleObscured,
    );
  }

  InputDecoration buildDecoration(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);
    final border = buildBorder(context);
    return InputDecoration(
      labelText: widget.label.isEmpty ? null : widget.label,
      labelStyle: text.body.regular().copyWith(color: labelColor(context)),
      floatingLabelStyle:
          text.bodySmall.medium().copyWith(color: labelColor(context)),
      hintText: widget.hint,
      hintStyle: text.body.regular().copyWith(color: colors.text.tertiary),
      prefixIcon: widget.prefixIcon,
      suffixIcon: resolveSuffix(context),
      filled: true,
      fillColor: colors.bg.container,
      contentPadding: EdgeInsets.symmetric(
        horizontal: 16.w,
        vertical: 14.h,
      ),
      counterText: '',
      border: border,
      enabledBorder: border,
      focusedBorder: border,
      disabledBorder: border,
      errorBorder: border,
      focusedErrorBorder: border,
      // Suppress InputDecorator's built-in error text (which is indented by
      // contentPadding.left). We render it ourselves in build() so it aligns
      // flush with the field's outer left edge.
      errorStyle: const TextStyle(fontSize: 0.1, height: 0.01),
    );
  }

  /// Subclasses implement this to return the actual input widget (usually
  /// a `TextFormField` variant).
  Widget buildField(BuildContext context, InputDecoration decoration);

  @override
  @mustCallSuper
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);
    final currentError = resolvedErrorText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        buildField(context, buildDecoration(context)),
        if (currentError != null) ...[
          Gap(4.h),
          Text(
            currentError,
            style: text.caption.regular().copyWith(color: colors.error.main),
          ),
        ],
      ],
    );
  }
}
