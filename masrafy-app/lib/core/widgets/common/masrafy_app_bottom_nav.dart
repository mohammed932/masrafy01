import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// The three customer-app tabs (Figma `137:2976`).
enum MasrafyAppNavTab { loans, home, profile }

/// Customer-app bottom navigation — My Loans / Home (raised accent circle) /
/// Profile. Shared by the home + profile screens (Principle XXXIII); the
/// [active] tab is emphasised in `primary.main`, the others muted. Each item's
/// tap is wired by the host screen.
class MasrafyAppBottomNav extends StatelessWidget {
  const MasrafyAppBottomNav({
    super.key,
    required this.active,
    required this.loansLabel,
    required this.profileLabel,
    this.onLoans,
    this.onHome,
    this.onProfile,
  });

  final MasrafyAppNavTab active;
  final String loansLabel;
  final String profileLabel;
  final VoidCallback? onLoans;
  final VoidCallback? onHome;
  final VoidCallback? onProfile;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    Widget item(IconData icon, String label, bool isActive, VoidCallback? onTap) {
      final color = isActive ? colors.primary.main : colors.icon.main;
      return InkWell(
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20.r, color: color),
            Gap(2.h),
            Text(label, style: text.caption.copyWith(color: color)),
          ],
        ),
      );
    }

    return Container(
      color: colors.bg.container,
      padding: EdgeInsetsDirectional.only(top: 8.h, bottom: 15.h),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            item(Icons.favorite_border, loansLabel,
                active == MasrafyAppNavTab.loans, onLoans),
            InkWell(
              onTap: onHome,
              customBorder: const CircleBorder(),
              child: Container(
                width: 45.r,
                height: 45.r,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.primary.main,
                  border: Border.all(color: colors.white, width: 4),
                ),
                child: Icon(Icons.home_rounded, color: colors.white, size: 22.r),
              ),
            ),
            item(Icons.person_outline, profileLabel,
                active == MasrafyAppNavTab.profile, onProfile),
          ],
        ),
      ),
    );
  }
}
