import 'dart:typed_data';

import 'package:app/core/utils/image_pick.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Uint8List bytesOf(List<int> header) =>
      Uint8List.fromList([...header, ...List<int>.filled(32, 0)]);

  group('mimeFromBytes', () {
    test('detects JPEG from the SOI marker', () {
      expect(
        MasrafyImagePicker.mimeFromBytes(bytesOf([0xFF, 0xD8, 0xFF, 0xE0])),
        'image/jpeg',
      );
    });

    test('detects PNG from the 8-byte signature', () {
      expect(
        MasrafyImagePicker.mimeFromBytes(
          bytesOf([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        ),
        'image/png',
      );
    });

    test('detects HEIC from the ftyp brand', () {
      // 4-byte box size, 'ftyp', then the brand.
      final heic = bytesOf([
        0x00, 0x00, 0x00, 0x18, // box size
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x68, 0x65, 0x69, 0x63, // 'heic'
      ]);
      expect(MasrafyImagePicker.mimeFromBytes(heic), 'image/heic');
    });

    test('an ISO-BMFF box with a non-HEIC brand is not reported as HEIC', () {
      final mp4 = bytesOf([
        0x00, 0x00, 0x00, 0x18,
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x69, 0x73, 0x6F, 0x6D, // 'isom'
      ]);
      expect(MasrafyImagePicker.mimeFromBytes(mp4), 'image/jpeg');
    });

    test('falls back to JPEG — what the platform resizer emits', () {
      expect(MasrafyImagePicker.mimeFromBytes(bytesOf([0x00, 0x01])), 'image/jpeg');
      expect(MasrafyImagePicker.mimeFromBytes(Uint8List(0)), 'image/jpeg');
    });

    test('a .heic-named file holding JPEG bytes reports JPEG', () {
      // The regression this replaced: the old helper sniffed the FILENAME, so
      // a HEIC pick that the resizer transcoded to JPEG was declared
      // image/heic — and that string was both signed into the presign request
      // and sent as Content-Type on the S3 PUT.
      expect(
        MasrafyImagePicker.mimeFromBytes(bytesOf([0xFF, 0xD8, 0xFF, 0xE1])),
        'image/jpeg',
      );
    });
  });

  group('ImagePickProfile budgets', () {
    test('avatar is capped at the largest avatar surface (128.r @ DPR4)', () {
      expect(ImagePickProfile.avatar.maxEdge, 512);
      expect(ImagePickProfile.avatar.quality, 80);
      expect(ImagePickProfile.avatar.maxBytes, 512 * 1024);
    });

    test('document keeps more resolution so the ID stays legible', () {
      expect(ImagePickProfile.document.maxEdge, 1600);
      expect(ImagePickProfile.document.quality, 85);
      expect(
        ImagePickProfile.document.maxEdge,
        greaterThan(ImagePickProfile.avatar.maxEdge),
      );
    });

    test('every budget stays under the backend 10 MB ceiling', () {
      for (final profile in ImagePickProfile.values) {
        expect(profile.maxBytes, lessThan(10 * 1024 * 1024));
      }
    });
  });
}
