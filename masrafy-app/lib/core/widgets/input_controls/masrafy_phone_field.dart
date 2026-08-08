import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';
import 'package:app/core/widgets/input_controls/phone_dial_codes.dart';

/// Pixel-perfect mirror of Figma node 3173:91172 (Phone Code + Phone Number row).
/// Layout:
///   [Phone Code select 158w]   [Phone Number input flex-1]
///   gap 16
/// Each column has its own label above its control — pass [uppercaseLabels] to
/// get the uppercase indigo `caption` label of the edit-form field family.
/// Both controls: transparent, 1px `border.main`, [MasrafyFieldMetrics.radius],
/// [MasrafyFieldMetrics.height] — the same height as every other single-line
/// field, so a form mixing this row with text inputs / selects stays even. The
/// select uses a 12r DownOutlined SVG (`kSetStudyChevronDown`).
///
/// State is fully external — caller owns the dial code (e.g. `"+1"`) and
/// phone number strings, plus the matching `onChanged` callbacks.
class MasrafyPhoneField extends StatelessWidget {
  const MasrafyPhoneField({
    super.key,
    required this.dialCode,
    required this.onDialCodeChanged,
    required this.phoneNumber,
    required this.onPhoneNumberChanged,
    this.phoneCodeLabel = 'Phone Code',
    this.phoneNumberLabel = 'Phone Number',
    this.phoneCodePlaceholder = '+1 (US/CA)',
    this.phoneNumberPlaceholder = 'Phone number',
    this.phoneNumberValidator,
    this.dialCodes = phoneDialCodes,
    this.uppercaseLabels = false,
  });

  final String? dialCode;
  final ValueChanged<String> onDialCodeChanged;

  final String? phoneNumber;
  final ValueChanged<String> onPhoneNumberChanged;

  final String phoneCodeLabel;
  final String phoneNumberLabel;
  final String phoneCodePlaceholder;
  final String phoneNumberPlaceholder;
  final String? Function(String?)? phoneNumberValidator;
  final List<PhoneDialCode> dialCodes;

  /// When true the labels render as the uppercase indigo `caption` style used by
  /// the edit-form field family (`MasrafyLabeledField`); default `false` keeps
  /// the Figma sign-up label (`body` regular `text.primary`).
  final bool uppercaseLabels;

  Future<void> _pickDialCode(BuildContext context) async {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final picked = await showModalBottomSheet<PhoneDialCode>(
      context: context,
      backgroundColor: colors.bg.container,
      shape: RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(20.r)),
      ),
      builder: (sheetCtx) => SafeArea(
        top: false,
        child: ListView.separated(
          padding: EdgeInsets.symmetric(vertical: 12.h),
          shrinkWrap: true,
          itemCount: dialCodes.length,
          separatorBuilder: (_, __) =>
              Container(height: 1, color: colors.border.main),
          itemBuilder: (_, i) {
            final entry = dialCodes[i];
            final isSelected = entry.code == dialCode;
            return ListTile(
              title: Text(
                entry.display,
                style: texts.bodyLarge.copyWith(
                  color: isSelected
                      ? colors.primary.main
                      : colors.text.primary,
                ),
              ),
              trailing: isSelected
                  ? SvgPicture.asset(
                      MasrafyAssets.kNotifCheckMark,
                      width: 16.r,
                      height: 16.r,
                      colorFilter: ColorFilter.mode(
                        colors.primary.main,
                        BlendMode.srcIn,
                      ),
                    )
                  : null,
              onTap: () => Navigator.pop(sheetCtx, entry),
            );
          },
        ),
      ),
    );
    if (picked != null) onDialCodeChanged(picked.code);
  }

  @override
  Widget build(BuildContext context) {
    final selected = dialCodes
        .where((e) => e.code == dialCode)
        .firstOrNull;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120.w,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Label(text: phoneCodeLabel, uppercase: uppercaseLabels),
              _DialCodeSelect(
                placeholder: phoneCodePlaceholder,
                value: selected?.display,
                onTap: () => _pickDialCode(context),
              ),
            ],
          ),
        ),
        Gap(12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Label(text: phoneNumberLabel, uppercase: uppercaseLabels),
              _PhoneNumberInput(
                value: phoneNumber,
                onChanged: onPhoneNumberChanged,
                placeholder: phoneNumberPlaceholder,
                validator: phoneNumberValidator,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Phone-number input — same chrome as the dial-code select so the two fields
/// are vertically pixel-aligned: transparent + 1px `border.main` +
/// [MasrafyFieldMetrics.radius] + [MasrafyFieldMetrics.height], `body` text.
/// Wires through digits-only formatter + 20-char limit + optional
/// validator (form-level error rendering left to the caller).
class _PhoneNumberInput extends StatefulWidget {
  const _PhoneNumberInput({
    required this.value,
    required this.onChanged,
    required this.placeholder,
    this.validator,
  });

  final String? value;
  final ValueChanged<String> onChanged;
  final String placeholder;
  final String? Function(String?)? validator;

  @override
  State<_PhoneNumberInput> createState() => _PhoneNumberInputState();
}

class _PhoneNumberInputState extends State<_PhoneNumberInput> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value ?? '');
  }

  @override
  void didUpdateWidget(covariant _PhoneNumberInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.value ?? '';
    if (next != _controller.text) {
      _controller.value = _controller.value.copyWith(
        text: next,
        selection: TextSelection.collapsed(offset: next.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    // Fixed height (shared with every other field) instead of vertical padding,
    // and the text centred inside it.
    return Container(
      height: MasrafyFieldMetrics.height,
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: MasrafyFieldMetrics.horizontalPadding,
      ),
      alignment: AlignmentDirectional.centerStart,
      decoration: BoxDecoration(
        color: Colors.transparent,
        border: Border.all(color: colors.border.main),
        borderRadius: BorderRadius.circular(MasrafyFieldMetrics.radius),
      ),
      child: TextField(
        controller: _controller,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(20),
        ],
        cursorColor: colors.primary.main,
        // Same value + placeholder styles as `MasrafyLabeledField`.
        style: texts.body.copyWith(color: colors.text.heading),
        onChanged: widget.onChanged,
        onTapOutside: (_) =>
            FocusManager.instance.primaryFocus?.unfocus(),
        decoration: InputDecoration(
          isCollapsed: true,
          border: InputBorder.none,
          hintText: widget.placeholder,
          hintStyle: texts.body.copyWith(color: colors.text.tertiary),
        ),
      ),
    );
  }
}

/// Field label — Inter Regular 14/22 `text.primary`, 8h pad below; or, when
/// [uppercase] is set, the uppercase indigo `caption` style of the edit-form
/// field family (`MasrafyLabeledField`).
class _Label extends StatelessWidget {
  const _Label({required this.text, this.uppercase = false});

  final String text;
  final bool uppercase;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return Padding(
      padding: EdgeInsetsDirectional.only(
        bottom: uppercase ? MasrafyFieldMetrics.labelGap : 8.h,
      ),
      child: Text(
        uppercase ? text.toUpperCase() : text,
        style: uppercase
            ? texts.caption.semiBold().copyWith(
                  color: colors.primary.main,
                  letterSpacing: 0.66,
                )
            : texts.body.regular().copyWith(color: colors.text.primary),
      ),
    );
  }
}

/// Tappable select — transparent + 1px `border.main` +
/// [MasrafyFieldMetrics.radius] + [MasrafyFieldMetrics.height]. Trailing 12r
/// `DownOutlined` SVG.
class _DialCodeSelect extends StatelessWidget {
  const _DialCodeSelect({
    required this.placeholder,
    required this.value,
    required this.onTap,
  });

  final String placeholder;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final hasValue = value != null && value!.isNotEmpty;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: MasrafyFieldMetrics.height,
        padding: EdgeInsetsDirectional.symmetric(
          horizontal: MasrafyFieldMetrics.horizontalPadding,
        ),
        decoration: BoxDecoration(
          color: Colors.transparent,
          border: Border.all(color: colors.border.main),
          borderRadius: BorderRadius.circular(MasrafyFieldMetrics.radius),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                hasValue ? value! : placeholder,
                style: texts.body.copyWith(
                  color: hasValue
                      ? colors.text.heading
                      : colors.text.tertiary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Gap(8.w),
            SvgPicture.asset(
              MasrafyAssets.kSetStudyChevronDown,
              width: 12.r,
              height: 12.r,
              colorFilter: ColorFilter.mode(
                colors.icon.main,
                BlendMode.srcIn,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

