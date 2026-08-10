import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// A titled profile section (Figma `4028:4449`): an uppercase section label
/// with an azure "Edit" action on the layout background, over a white rounded
/// card holding the section's [ProfileFieldRow]s. Flow-local (Principle XXXII).
class ProfileInfoCard extends StatelessWidget {
  const ProfileInfoCard({
    super.key,
    required this.title,
    required this.editLabel,
    required this.onEdit,
    required this.rows,
  });

  final String title;
  final String editLabel;
  final VoidCallback onEdit;
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title.toUpperCase(),
                style: text.caption.semiBold().copyWith(
                      color: colors.text.label,
                      letterSpacing: 0.8,
                    ),
              ),
            ),
            GestureDetector(
              onTap: onEdit,
              behavior: HitTestBehavior.opaque,
              child: Text(
                editLabel,
                style: text.bodySmall
                    .bold()
                    .copyWith(color: colors.secondary.main),
              ),
            ),
          ],
        ),
        Gap(10.h),
        Container(
          width: double.infinity,
          padding: EdgeInsetsDirectional.fromSTEB(18.w, 18.h, 18.w, 18.h),
          decoration: BoxDecoration(
            color: colors.bg.container,
            borderRadius: BorderRadius.circular(16.r),
            border: Border.all(color: colors.border.secondary),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: rows,
          ),
        ),
      ],
    );
  }
}
