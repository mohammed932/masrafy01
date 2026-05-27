import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:app/core/extentions/string_extention.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

/// Themed wrapper around [CachedNetworkImage] — the canonical way to
/// render a remote image in the app. Higher-level widgets like
/// [MasrafyAvatar] and `MasrafyAttachmentThumbnail` compose this; raw
/// `CachedNetworkImage` calls outside this file are a review block per
/// Principle IX (Shared Widget Reuse).
///
/// Defaults:
/// - placeholder: solid `colors.fill.handleBg` rectangle (matches the
///   resting card surface so loading is invisible until bytes arrive).
/// - errorWidget: tinted `Icons.broken_image_outlined` over the same
///   placeholder background.
///
/// Pass [placeholder] / [errorWidget] to override either default.
class MasrafyNetworkImage extends StatelessWidget {
  const MasrafyNetworkImage({
    super.key,
    required this.imageUrl,
    this.cacheKey,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholder,
    this.errorWidget,
  });

  /// Image URL. When null or empty the [errorWidget] is shown — same as
  /// when the network call fails — so callers don't need a separate
  /// "no URL yet" branch.
  final String? imageUrl;

  /// Stable cache key. Pass this when the URL itself rotates between
  /// fetches (e.g. signed S3/CloudFront URLs that include an expiring
  /// signature). Without it, [CachedNetworkImage] keys by the URL string
  /// and re-downloads every time even when the underlying image is the
  /// same. Use a domain-stable id (attachment id, asset id, etc.).
  final String? cacheKey;

  final double? width;
  final double? height;
  final BoxFit fit;

  /// Clips the entire widget (image, placeholder, error) to the given
  /// radius. Use `BorderRadius.circular(size / 2)` for circular shapes.
  final BorderRadius? borderRadius;

  final WidgetBuilder? placeholder;
  final WidgetBuilder? errorWidget;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final ph = placeholder ?? (_) => ColoredBox(color: colors.fill.handleBg);
    final err =
        errorWidget ??
        (_) => ColoredBox(
          color: colors.fill.handleBg,
          child: Center(
            child: Icon(
              Icons.broken_image_outlined,
              color: colors.text.tertiary,
            ),
          ),
        );

    final hasUrl = imageUrl.isNotNullOrEmpty;
    final Widget child = SizedBox(
      width: width,
      height: height,
      child: hasUrl
          ? CachedNetworkImage(
              imageUrl: imageUrl!,
              cacheKey: cacheKey,
              width: width,
              height: height,
              fit: fit,
              placeholder: (ctx, _) => ph(ctx),
              errorWidget: (ctx, _, __) => err(ctx),
            )
          : err(context),
    );

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: child);
    }
    return child;
  }
}
