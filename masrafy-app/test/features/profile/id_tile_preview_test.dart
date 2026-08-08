import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app/core/features/id_capture/id_thumbnail.dart';
import 'package:app/features/profile/presentation/models/profile_data.dart';

void main() {
  group('idThumbnail precedence', () {
    final bytes = Uint8List.fromList([1, 2, 3, 4]);
    const url = 'https://example.invalid/front.jpg?sig=abc';

    test('nothing available renders no image (tile falls back to its icon)', () {
      expect(idThumbnail(null, null), isNull);
    });

    test('captured bytes are used when only they exist', () {
      expect(idThumbnail(bytes, null), isA<MemoryImage>());
    });

    test('presigned url is used when only it exists', () {
      expect(idThumbnail(null, url), isA<CachedNetworkImageProvider>());
    });

    test('bytes beat the url — the shot just taken is never stale', () {
      expect(idThumbnail(bytes, url), isA<MemoryImage>());
    });

    test('empty bytes and empty url are treated as absent, not as an image', () {
      expect(idThumbnail(Uint8List(0), null), isNull);
      expect(idThumbnail(null, ''), isNull);
      expect(idThumbnail(Uint8List(0), url), isA<CachedNetworkImageProvider>());
    });
  });

  group('ProfileData.toPersonalDraft', () {
    test('does not claim the National ID is on file', () {
      // Regression: these were hardcoded `true`, so every customer — including
      // one with no documents at all — saw two green "Uploaded" ticks the
      // moment the edit screen opened. Only the server knows.
      final draft = ProfileData.mock().toPersonalDraft();

      expect(draft.frontUploaded, isFalse);
      expect(draft.backUploaded, isFalse);
    });

    test('still carries the scalar fields the screen edits', () {
      final data = ProfileData.mock();
      final draft = data.toPersonalDraft();

      expect(draft.firstName, data.firstName);
      expect(draft.lastName, data.lastName);
      expect(draft.birthday, data.birthday);
    });
  });
}
