import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

class PilotDebouncedSearchField extends StatefulWidget {
  const PilotDebouncedSearchField({
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
  State<PilotDebouncedSearchField> createState() =>
      _PilotDebouncedSearchFieldState();
}

class _PilotDebouncedSearchFieldState
    extends State<PilotDebouncedSearchField> {
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
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
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
          borderSide: BorderSide(color: colors.border.main),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24.r),
          borderSide: BorderSide(color: colors.border.main),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24.r),
          borderSide:
              BorderSide(color: colors.primary.main, width: 1.5),
        ),
      ),
    );
  }
}
