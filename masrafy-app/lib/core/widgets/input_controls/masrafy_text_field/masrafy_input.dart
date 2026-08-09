import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';

import 'masrafy_base_input.dart';

/// Shared state + decoration for every input that extends [MasrafyBaseInput].
///
/// Concrete State subclasses (e.g. `_MasrafyTextFieldState`) mix this in and
/// implement `buildField(decoration)` — the mixin takes care of:
///   - controller + focus-node lifecycle (creates them if the widget
///     doesn't provide its own; disposes only the ones it created)
///   - focus-driven border and label colors
///   - obscure-toggle state and suffix icon
///   - the `InputDecoration` (border, fill, label, hint, prefix/suffix)
mixin MasrafyInput<T extends MasrafyBaseInput> on State<T> {
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
  // Last message the validator produced, so [handleChanged] only rebuilds
  // when the error actually appears, changes, or clears.
  String? _lastError;

  TextEditingController get controller => _controller;
  FocusNode get focusNode => _focusNode;
  bool get isFocused => _focused;
  bool get isObscured => _obscured;
  // Error styling kicks in as soon as the user interacts — the first keystroke
  // ([handleChanged]) or the first blur — and then tracks every keystroke
  // live. Fields stay neutral on first render; Form.validate() also touches an
  // untyped field via [wrappedValidator].
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

  /// Wrap the caller-provided `onChanged` so we can note the first keystroke
  /// and re-validate live. `buildField` must call this via `handleChanged`
  /// instead of forwarding `widget.onChanged` directly.
  ///
  /// Typing is what makes the field "touched" — the error text appears and
  /// clears on every keystroke, with no blur / submit / `Form.validate()`
  /// needed. The rebuild is skipped while the message is unchanged, so typing
  /// inside a valid range costs nothing.
  void handleChanged(String value) {
    _userHasTyped = true;
    widget.onChanged?.call(value);

    final validator = widget.validator;
    if (validator == null) return;

    final error = validator(value);
    if (_touched && error == _lastError) return;
    setState(() {
      _touched = true;
      _lastError = error;
    });
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
          if (!mounted) return;
          setState(() {
            _touched = true;
            _lastError = error;
          });
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
      // drives the border / label color. Keep `_lastError` in step so the
      // next keystroke's change-detection compares against what's on screen.
      if (!_focused) {
        _touched = true;
        _lastError = widget.validator?.call(_controller.text);
      }
    });
  }

  void toggleObscured() => setState(() => _obscured = !_obscured);

  // ----- decoration helpers -----

  Color borderColor(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    if (hasError) return colors.error.main;
    if (_focused) return colors.primary.main;
    return colors.border.field;
  }

  Color labelColor(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    if (hasError) return colors.error.main;
    if (_focused) return colors.primary.main;
    return colors.text.secondary;
  }

  OutlineInputBorder buildBorder(BuildContext context) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(MasrafyFieldMetrics.radius),
        borderSide: BorderSide(
          color: borderColor(context),
          width: MasrafyFieldMetrics.borderWidth,
        ),
      );

  /// The suffix icon to show. If the widget has an obscure-toggle, the
  /// eye icon replaces any provided `suffixIcon`. Subclasses that want
  /// different suffix behavior can override this getter.
  Widget? resolveSuffix(BuildContext context) {
    if (!showObscureToggle) return widget.suffixIcon;
    final colors = MasrafyColorTheme.of(context);
    return IconButton(
      icon: Icon(
        _obscured ? Icons.visibility_off : Icons.visibility,
        color: colors.text.secondary,
      ),
      onPressed: toggleObscured,
    );
  }

  /// The style the concrete field renders its text with. The box height is
  /// derived from it ([MasrafyFieldMetrics.verticalPaddingFor]), so `buildField`
  /// MUST pass this exact style to its `TextField` — a larger style set only on
  /// the field would silently grow the box past the shared height.
  TextStyle inputTextStyle(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return MasrafyTextTheme.of(context)
        .body
        .medium()
        .copyWith(color: colors.text.primary);
  }

  /// True while this field can honour [MasrafyFieldMetrics.height]. A floating
  /// label needs room above the text and a multi-line box grows by definition —
  /// neither fits 48px, so both keep a padding of their own instead of clipping.
  bool get usesSharedHeight =>
      widget.label.isEmpty && widget.maxLines == 1 && widget.minLines == null;

  BoxConstraints get _affixConstraints => BoxConstraints(
        minWidth: 40.w,
        maxHeight: MasrafyFieldMetrics.height - 2,
      );

  InputDecoration buildDecoration(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final border = buildBorder(context);
    final style = inputTextStyle(context);
    return InputDecoration(
      labelText: widget.label.isEmpty ? null : widget.label,
      labelStyle: text.body.regular().copyWith(color: labelColor(context)),
      floatingLabelStyle:
          text.bodySmall.medium().copyWith(color: labelColor(context)),
      hintText: widget.hint,
      // Same metrics as the input text (weight aside) — a hint on a different
      // line box would size the empty field differently from the filled one.
      hintStyle: style.regular().copyWith(color: colors.text.tertiary),
      prefixIcon: widget.prefixIcon,
      suffixIcon: resolveSuffix(context),
      // Caps the affixes (a 48² IconButton by default, e.g. the obscure toggle)
      // so they cannot inflate the box past [MasrafyFieldMetrics.height].
      prefixIconConstraints: usesSharedHeight ? _affixConstraints : null,
      suffixIconConstraints: usesSharedHeight ? _affixConstraints : null,
      // Transparent like every other field in the family (labeled / select /
      // phone / DOB): the `border.field` stroke carries the box, so a solid
      // plate would only make this one control read as a different species
      // next to them.
      filled: false,
      // One height across the whole single-line family (Principle XXXIII): the
      // padding — not a SizedBox — is what sets it, because `OutlineInputBorder`
      // paints around the decorator's own content rect.
      isDense: usesSharedHeight,
      contentPadding: usesSharedHeight
          ? EdgeInsetsDirectional.symmetric(
              horizontal: MasrafyFieldMetrics.horizontalPadding,
              vertical: MasrafyFieldMetrics.verticalPaddingFor(style),
            )
          : EdgeInsetsDirectional.symmetric(horizontal: 16.w, vertical: 14.h),
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
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final currentError = resolvedErrorText;

    // One line under the field: the error while invalid, otherwise the standing
    // rule (`helperText`) — never both, so the field height stays stable.
    final belowField = currentError ?? widget.helperText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        buildField(context, buildDecoration(context)),
        if (belowField != null) ...[
          Gap(4.h),
          Text(
            belowField,
            style: text.caption.regular().copyWith(
                  color: currentError != null
                      ? colors.error.main
                      : colors.text.tertiary,
                ),
          ),
        ],
      ],
    );
  }
}
