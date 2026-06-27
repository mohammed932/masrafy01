import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// A labelled group of [SettingsTile]s on the Settings & Security screen
/// (Figma `2107:70` / `2107:94` / `2107:110`): an uppercase, tracked section
/// caption over its rows. Flow-local to the settings_security flow (XXXII).
class SettingsSection extends StatelessWidget {
  const SettingsSection({
    super.key,
    required this.label,
    required this.children,
  });

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsetsDirectional.only(top: 10.h, bottom: 5.h),
          child: Text(
            label.toUpperCase(),
            style: text.caption.bold().copyWith(
                  color: colors.text.tertiary,
                  letterSpacing: 0.99,
                ),
          ),
        ),
        for (var i = 0; i < children.length; i++) ...[
          if (i != 0) Gap(15.h),
          children[i],
        ],
      ],
    );
  }
}
