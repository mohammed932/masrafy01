import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/common/masrafy_avatar.dart';

/// Editable avatar (Figma `4028:4573`): the circular profile photo with an
/// azure camera badge pinned to its bottom edge. Photo pick is a coming-soon
/// stub for now (like signup) — [onTap] surfaces the hint from the page.
/// Flow-local (Principle XXXII).
class ProfileAvatarEditor extends StatelessWidget {
  const ProfileAvatarEditor({
    super.key,
    this.imageUrl,
    required this.onTap,
    this.size = 104,
  });

  final String? imageUrl;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return Center(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            MasrafyAvatar(
              size: size.r,
              imageUrl: imageUrl,
              borderColor: colors.secondary.main.withValues(alpha: 0.4),
              borderWidth: 2,
            ),
            PositionedDirectional(
              bottom: 0,
              end: 0,
              child: Container(
                width: 32.r,
                height: 32.r,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.secondary.main,
                  border: Border.all(color: colors.bg.layout, width: 2),
                ),
                child: Icon(
                  Icons.photo_camera_outlined,
                  size: 16.r,
                  color: colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
