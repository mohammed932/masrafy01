import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

/// Shared image picking + downscaling for every upload surface in the app
/// (profile avatar, National ID front/back).
///
/// Downscaling is done natively by `image_picker` itself via
/// `maxWidth`/`maxHeight`/`imageQuality` — no extra package, no isolate hop.
/// The bytes that come back here are the bytes that get PUT to object storage,
/// so the constraints on [ImagePickProfile] are the single place that decides
/// what an uploaded image costs.
///
/// Before this existed, all four pick sites shared one set of values
/// (`imageQuality: 85, maxWidth: 2000`) regardless of what the image was for:
/// an avatar rendered in a 128-logical-pixel circle was uploaded at 2000px /
/// ~1.2 MB — roughly 15× the pixels any avatar surface can display.
enum ImagePickProfile {
  /// Profile avatar. The largest avatar surface in the app is a `128.r`
  /// circle, i.e. ~512 physical px on a DPR-4 device, and both avatar widgets
  /// crop with `BoxFit.cover` — anything beyond that is decoded and thrown
  /// away. 512px @ q80 lands around 40–90 KB.
  avatar(maxEdge: 512, quality: 80, maxBytes: 512 * 1024),

  /// National ID front/back. Must stay legible for manual review, so this
  /// keeps far more resolution than the avatar — 1600px @ q85 preserves the
  /// ID number while dropping most of the wasted bytes.
  document(maxEdge: 1600, quality: 85, maxBytes: 3 * 1024 * 1024);

  const ImagePickProfile({
    required this.maxEdge,
    required this.quality,
    required this.maxBytes,
  });

  /// Applied to BOTH axes, so the image is scaled to fit inside a square of
  /// this size and the aspect ratio is preserved for portrait and landscape.
  final double maxEdge;

  /// JPEG re-encode quality passed to the platform resizer (0–100).
  final int quality;

  /// Client-side ceiling checked after the native downscale. The server's
  /// 10 MB cap remains the real limit; this exists so an over-budget file
  /// gets a message that explains itself instead of a doomed "try again".
  final int maxBytes;
}

/// A picked, downscaled image ready to upload.
class PickedImage {
  const PickedImage({
    required this.bytes,
    required this.contentType,
    required this.filename,
  });

  final Uint8List bytes;
  final String contentType;
  final String filename;
}

/// Outcome of a pick. Cancelling is not an error, and an over-budget file is
/// not a generic failure — callers must handle the three cases distinctly.
sealed class ImagePickResult {
  const ImagePickResult();
}

/// The user dismissed the picker/camera. Nothing to do.
class ImagePickCancelled extends ImagePickResult {
  const ImagePickCancelled();
}

/// Still over [ImagePickProfile.maxBytes] after downscaling.
class ImagePickTooLarge extends ImagePickResult {
  const ImagePickTooLarge({required this.bytes, required this.maxBytes});

  final int bytes;
  final int maxBytes;
}

class ImagePickSuccess extends ImagePickResult {
  const ImagePickSuccess(this.image);

  final PickedImage image;
}

/// Picks an image from [source] under the constraints of [profile].
///
/// Two parameters, so no `<Name>Request` DTO is required (A28).
class MasrafyImagePicker {
  MasrafyImagePicker({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  Future<ImagePickResult> pick(
    ImageSource source,
    ImagePickProfile profile,
  ) async {
    final file = await _picker.pickImage(
      source: source,
      imageQuality: profile.quality,
      maxWidth: profile.maxEdge,
      maxHeight: profile.maxEdge,
    );
    if (file == null) return const ImagePickCancelled();

    final bytes = await file.readAsBytes();
    if (bytes.length > profile.maxBytes) {
      return ImagePickTooLarge(
        bytes: bytes.length,
        maxBytes: profile.maxBytes,
      );
    }

    return ImagePickSuccess(
      PickedImage(
        bytes: bytes,
        contentType: mimeFromBytes(bytes),
        filename: file.name,
      ),
    );
  }

  /// Reads the container format from the file's magic bytes.
  ///
  /// Deliberately NOT derived from the filename: the platform resizer decodes
  /// and re-encodes the picture, so a `.heic` pick comes back as JPEG bytes.
  /// The old extension sniff declared `image/heic` for those, and that string
  /// is both signed into the presign request and sent as the `Content-Type`
  /// on the S3 PUT — so the object was stored permanently mislabelled.
  ///
  /// Anything unrecognised falls back to `image/jpeg`, which is what the
  /// resizer emits and what the backend allowlist accepts.
  static String mimeFromBytes(Uint8List bytes) {
    if (bytes.length >= 8 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47 &&
        bytes[4] == 0x0D &&
        bytes[5] == 0x0A &&
        bytes[6] == 0x1A &&
        bytes[7] == 0x0A) {
      return 'image/png';
    }
    if (bytes.length >= 3 &&
        bytes[0] == 0xFF &&
        bytes[1] == 0xD8 &&
        bytes[2] == 0xFF) {
      return 'image/jpeg';
    }
    // ISO-BMFF: bytes 4..8 are 'ftyp', followed by the brand. HEIC survives
    // untouched when the platform hands back the original file.
    if (bytes.length >= 12 &&
        bytes[4] == 0x66 &&
        bytes[5] == 0x74 &&
        bytes[6] == 0x79 &&
        bytes[7] == 0x70) {
      const heicBrands = {'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'};
      final brand = String.fromCharCodes(bytes.sublist(8, 12));
      if (heicBrands.contains(brand)) return 'image/heic';
    }
    return 'image/jpeg';
  }
}
