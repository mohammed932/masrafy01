import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';

import 'package:app/core/widgets/images/masrafy_network_image.dart';

/// Picks the image a National-ID tile should show.
///
/// [bytes] is a side captured in the current session; [url] is the short-lived
/// presigned GET returned by `GET /v1/profile/documents/status`. Bytes win when
/// both exist — they are the picture the user just took, they need no
/// round-trip, and they cannot be stale.
///
/// Shared by all three ID surfaces (apply-documents, complete-profile,
/// profile-edit) so the precedence is decided once. Returns null when there is
/// nothing to show; the tile then falls back to its icon rather than rendering
/// an empty box.
/// The presigned URL carries a signature that changes on every status read, so
/// the provider is keyed by the URL's stable path — otherwise each visit misses
/// the cache and re-downloads a picture the device already has.
ImageProvider? idThumbnail(Uint8List? bytes, String? url) {
  if (bytes != null && bytes.isNotEmpty) return MemoryImage(bytes);
  if (url != null && url.isNotEmpty) {
    return CachedNetworkImageProvider(
      url,
      cacheKey: MasrafyNetworkImage.stableKeyFor(url),
    );
  }
  return null;
}
