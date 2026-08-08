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

  /// Stable cache key. Defaults to the URL with its query stripped, which is
  /// what makes signed S3 URLs cacheable at all: the signature rotates on every
  /// presign, so keying by the full URL misses the cache and re-downloads the
  /// same bytes on every visit. Object keys are minted fresh per upload, so the
  /// path changes whenever the picture does — the default key cannot go stale.
  /// Pass this explicitly for a backend that overwrites objects in place.
  final String? cacheKey;

  /// Origin + path, no query. See [cacheKey].
  static String? stableKeyFor(String? url) {
    if (url == null || url.isEmpty) return null;
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasQuery) return url;
    return Uri(
      scheme: uri.scheme,
      host: uri.host,
      port: uri.hasPort ? uri.port : null,
      path: uri.path,
    ).toString();
  }

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
    final err = errorWidget ??
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
    // Decode to the painted size rather than the source resolution. Exactly
    // ONE axis is constrained — passing both makes the decoder resize to those
    // exact dimensions and distort the aspect ratio before [fit] ever applies.
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final memWidth = width == null ? null : (width! * dpr).round();
    final memHeight =
        width != null || height == null ? null : (height! * dpr).round();
    final Widget child = SizedBox(
      width: width,
      height: height,
      child: hasUrl
          ? CachedNetworkImage(
              imageUrl: imageUrl!,
              cacheKey: cacheKey ?? stableKeyFor(imageUrl),
              width: width,
              height: height,
              memCacheWidth: memWidth,
              memCacheHeight: memHeight,
              fit: fit,
              // The package defaults to a 500ms fade-in over a 1s fade-out, so
              // a picture already in cache still takes over a second to settle.
              // Trimmed to a single quick cross-fade: on a cache hit it reads as
              // instant, and a fresh download no longer pays a second of
              // animation on top of the request.
              fadeInDuration: const Duration(milliseconds: 150),
              fadeOutDuration: const Duration(milliseconds: 100),
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
