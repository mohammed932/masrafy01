import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/common/masrafy_avatar.dart';
import 'package:app/core/widgets/common/masrafy_customer_avatar.dart';

/// Editable avatar (Figma `4028:4573`): the circular profile photo with an
/// azure camera badge pinned to its bottom edge. Tapping picks + uploads a new
/// photo; [imageBytes] shows the freshly-picked image and [uploading] overlays
/// a spinner while the upload runs. Flow-local (Principle XXXII).
class ProfileAvatarEditor extends StatelessWidget {
  const ProfileAvatarEditor({
    super.key,
    this.imageUrl,
    this.imageBytes,
    this.uploading = false,
    required this.onTap,
    this.size = 104,
  });

  final String? imageUrl;
  final Uint8List? imageBytes;
  final bool uploading;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return Center(
      child: GestureDetector(
        onTap: uploading ? null : onTap,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Store-backed like every other avatar, so a photo uploaded on
            // another screen (e.g. Complete Profile) is already the one shown
            // here. [imageBytes] still wins while it is set locally.
            if (imageBytes != null)
              MasrafyAvatar(
                size: size.r,
                imageBytes: imageBytes,
                borderColor: colors.secondary.main.withValues(alpha: 0.4),
                borderWidth: 2,
              )
            else
              MasrafyCustomerAvatar(
                size: size.r,
                fallbackUrl: imageUrl,
                borderColor: colors.secondary.main.withValues(alpha: 0.4),
                borderWidth: 2,
              ),
            if (uploading)
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.bg.mask.withValues(alpha: 0.45),
                  ),
                  alignment: Alignment.center,
                  child: SizedBox(
                    width: 26.r,
                    height: 26.r,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: colors.white,
                    ),
                  ),
                ),
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
