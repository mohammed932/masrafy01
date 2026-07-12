import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/bottom_sheets/masrafy_bottom_sheet_base.dart';

/// Where to source a picked image from.
enum PhotoPickSource { camera, gallery }

/// Instant tap-to-pick sheet offering "Take Photo" / "Choose from Gallery".
/// Returns the chosen [PhotoPickSource] (null when dismissed).
class MasrafyPhotoSourceSheet extends MasrafyBottomSheetBase {
  const MasrafyPhotoSourceSheet({
    super.key,
    required this.headerTitle,
    required this.cameraLabel,
    required this.galleryLabel,
  });

  final String headerTitle;
  final String cameraLabel;
  final String galleryLabel;

  /// Opens the sheet and resolves to the chosen source, or null if dismissed.
  static Future<PhotoPickSource?> show(
    BuildContext context, {
    required String title,
    required String cameraLabel,
    required String galleryLabel,
  }) {
    return MasrafyBottomSheetBase.show<PhotoPickSource>(
      context: context,
      sheet: MasrafyPhotoSourceSheet(
        headerTitle: title,
        cameraLabel: cameraLabel,
        galleryLabel: galleryLabel,
      ),
    );
  }

  @override
  String? get title => headerTitle;

  @override
  Widget buildContent(BuildContext context) {
    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(16.w, 4.h, 16.w, 12.h),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _SourceRow(
            icon: Icons.photo_camera_outlined,
            label: cameraLabel,
            onTap: () => Navigator.of(context).pop(PhotoPickSource.camera),
          ),
          Gap(4.h),
          _SourceRow(
            icon: Icons.photo_library_outlined,
            label: galleryLabel,
            onTap: () => Navigator.of(context).pop(PhotoPickSource.gallery),
          ),
        ],
      ),
    );
  }
}

class _SourceRow extends StatelessWidget {
  const _SourceRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14.r),
      child: Padding(
        padding: EdgeInsetsDirectional.symmetric(horizontal: 8.w, vertical: 14.h),
        child: Row(
          children: [
            Container(
              width: 40.r,
              height: 40.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.secondary.main.withValues(alpha: 0.12),
              ),
              child: Icon(icon, size: 20.r, color: colors.secondary.main),
            ),
            Gap(14.w),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 15.sp,
                  fontWeight: FontWeight.w600,
                  color: colors.text.heading,
                ),
              ),
            ),
            Icon(Icons.chevron_right, size: 20.r, color: colors.icon.main),
          ],
        ),
      ),
    );
  }
}
