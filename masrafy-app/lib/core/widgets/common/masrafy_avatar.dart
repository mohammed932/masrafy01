import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/images/masrafy_network_image.dart';
import 'package:app/core/widgets/shimmers/masrafy_shimmer.dart';

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
    this.imageBytes,
    this.borderColor,
    this.borderWidth,
  });

  final double size;
  final String? imageUrl;

  /// Locally-picked image bytes. When set, rendered in place of [imageUrl]
  /// (e.g. an instant preview right after the user picks a new photo).
  final Uint8List? imageBytes;
  final Color? borderColor;
  final double? borderWidth;

  @override
  Widget build(BuildContext context) {
    final hasBorder = borderColor != null;
    final effectiveBorderWidth = borderWidth ?? 2.r;

    final bytes = imageBytes;
    // Decode at the size actually painted. Without this the full-resolution
    // picture is held in the image cache to fill a ~104px circle.
    final decodeWidth = (size * MediaQuery.devicePixelRatioOf(context)).round();
    final Widget avatar = bytes != null
        ? Image.memory(
            bytes,
            width: size,
            height: size,
            cacheWidth: decodeWidth,
            fit: BoxFit.cover,
            gaplessPlayback: true,
          )
        : MasrafyNetworkImage(
            imageUrl: imageUrl,
            width: size,
            height: size,
            borderRadius: BorderRadius.circular(size / 2),
            // Loading and "no photo" must not look the same. The glyph is the
            // empty state; a photo still on the wire shimmers (Principle
            // XXXIV), so the wait reads as progress rather than as an account
            // with no picture.
            placeholder: (_) => _LoadingAvatar(size: size),
            errorWidget: (_) => _DefaultAvatar(size: size),
          );

    if (!hasBorder) {
      return bytes != null ? ClipOval(child: avatar) : avatar;
    }

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

/// Shape-matched wait state: a shimmering disc the exact size of the photo it
/// is standing in for, so nothing shifts when the bytes land.
class _LoadingAvatar extends StatelessWidget {
  const _LoadingAvatar({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return MasrafyShimmer(
      child: Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
        ),
      ),
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
