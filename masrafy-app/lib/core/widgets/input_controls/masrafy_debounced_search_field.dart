import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';

class MasrafyDebouncedSearchField extends StatefulWidget {
  const MasrafyDebouncedSearchField({
    super.key,
    required this.onDebouncedChange,
    this.initialValue = '',
    this.hintText,
    this.debounce = const Duration(milliseconds: 400),
    this.controller,
    this.suffixIcon,
    this.maxLength,
  });

  final ValueChanged<String> onDebouncedChange;
  final String initialValue;
  final String? hintText;
  final Duration debounce;
  final TextEditingController? controller;
  final Widget? suffixIcon;
  final int? maxLength;

  @override
  State<MasrafyDebouncedSearchField> createState() =>
      _MasrafyDebouncedSearchFieldState();
}

class _MasrafyDebouncedSearchFieldState
    extends State<MasrafyDebouncedSearchField> {
  late final TextEditingController _ownedController;
  Timer? _debounceTimer;

  TextEditingController get _controller =>
      widget.controller ?? _ownedController;

  @override
  void initState() {
    super.initState();
    _ownedController = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _ownedController.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(widget.debounce, () {
      if (mounted) widget.onDebouncedChange(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return TextField(
      controller: _controller,
      onChanged: _onChanged,
      style: texts.body,
      inputFormatters: [
        if (widget.maxLength != null)
          LengthLimitingTextInputFormatter(widget.maxLength!),
      ],
      decoration: InputDecoration(
        hintText: widget.hintText ?? 'Search…',
        hintStyle: texts.body.copyWith(color: colors.text.tertiary),
        prefixIcon: Icon(Icons.search,
            size: 20.r, color: colors.text.secondary),
        suffixIcon: widget.suffixIcon,
        filled: true,
        fillColor: colors.fill.alterSolid,
        contentPadding:
            EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24.r),
          borderSide: BorderSide(
            color: colors.border.field,
            width: MasrafyFieldMetrics.borderWidth,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24.r),
          borderSide: BorderSide(
            color: colors.border.field,
            width: MasrafyFieldMetrics.borderWidth,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24.r),
          borderSide: BorderSide(
            color: colors.primary.main,
            width: MasrafyFieldMetrics.borderWidth,
          ),
        ),
      ),
    );
  }
}
