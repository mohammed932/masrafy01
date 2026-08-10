import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// An editable counterpart to [ProfileInfoCard]: an optional uppercase section
/// label over a white rounded card that hosts the section's input fields. Gives
/// the edit screens the same white surface as the read-only profile view, so
/// the grey-filled inputs read correctly and group into sections. Flow-local
/// (Principle XXXII); tokens + logical insets only.
///
/// The header takes an optional [hint] and [trailing]: [trailing] is where a
/// section-level status (e.g. "Uploaded") belongs — beside its heading rather
/// than buried in the fields.
class ProfileFormSection extends StatelessWidget {
  const ProfileFormSection({
    super.key,
    this.title,
    this.hint,
    this.trailing,
    required this.children,
  });

  /// Section label shown above the card; omitted when null (e.g. a card whose
  /// child already renders its own heading).
  final String? title;

  /// Muted qualifier after [title] (e.g. "— required for loan eligibility").
  /// Wraps to its own line on narrow screens rather than squeezing the title.
  final String? hint;

  /// Status affordance pinned to the header's end (e.g. a [MasrafyBadge]).
  /// Ignored without a title.
  final Widget? trailing;

  /// The section's fields, stacked with [Gap] separators inside the card.
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null) ...[
          Row(
            children: [
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6.w,
                  children: [
                    Text(
                      title!.toUpperCase(),
                      style: text.caption.semiBold().copyWith(
                            color: colors.text.label,
                            letterSpacing: 0.8,
                          ),
                    ),
                    if (hint != null)
                      Text(
                        hint!,
                        style: text.caption
                            .regular()
                            .copyWith(color: colors.text.placeholder),
                      ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          Gap(10.h),
        ],
        Container(
          width: double.infinity,
          padding: EdgeInsetsDirectional.fromSTEB(18.w, 18.h, 18.w, 18.h),
          decoration: BoxDecoration(
            color: colors.bg.container,
            borderRadius: BorderRadius.circular(16.r),
            border: Border.all(color: colors.border.secondary),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i != 0) Gap(16.h),
                children[i],
              ],
            ],
          ),
        ),
      ],
    );
  }
}
