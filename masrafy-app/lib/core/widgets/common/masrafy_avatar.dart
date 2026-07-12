import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/images/masrafy_network_image.dart';

/// Circular profile avatar.
///
/// When [imageUrl] is null/empty (or fails to load), the widget renders a
/// themed person-glyph fallback (no bundled asset — avoids a missing-asset
/// crash and works in both light and dark). Image loading is delegated to
/// [MasrafyNetworkImage] (the shared `CachedNetworkImage` wrapper).
class MasrafyAvatar extends StatelessWidget {
  const MasrafyAvatar({
    super.key,
    required this.size,
    this.imageUrl,
    this.borderColor,
    this.borderWidth,
  });

  final double size;
  final String? imageUrl;
  final Color? borderColor;
  final double? borderWidth;

  @override
  Widget build(BuildContext context) {
    final hasBorder = borderColor != null;
    final effectiveBorderWidth = borderWidth ?? 2.r;

    final avatar = MasrafyNetworkImage(
      imageUrl: imageUrl,
      width: size,
      height: size,
      borderRadius: BorderRadius.circular(size / 2),
      placeholder: (_) => _DefaultAvatar(size: size),
      errorWidget: (_) => _DefaultAvatar(size: size),
    );

    if (!hasBorder) return avatar;

    return Container(
      width: size + effectiveBorderWidth * 2,
      height: size + effectiveBorderWidth * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: borderColor!, width: effectiveBorderWidth),
      ),
      child: ClipOval(child: avatar),
    );
  }
}

class _DefaultAvatar extends StatelessWidget {
  const _DefaultAvatar({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Container(
      width: size,
      height: size,
      color: colors.bg.containerDisabled,
      alignment: Alignment.center,
      child: Icon(
        Icons.person_rounded,
        size: size * 0.56,
        color: colors.secondary.main.withValues(alpha: 0.55),
      ),
    );
  }
}
