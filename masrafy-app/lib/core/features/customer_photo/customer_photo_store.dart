import 'dart:typed_data';

import 'package:flutter/foundation.dart';

/// The signed-in customer's avatar, held app-wide.
///
/// The photo is uploaded from one screen (Edit Personal Info, Complete Profile)
/// but painted on several, each with its own cubit. Without a shared broadcast
/// every other surface keeps its stale copy until it happens to re-read `/me` —
/// the picture visibly changes on the screen that picked it and nowhere else.
/// Publishing here instead makes the swap instant everywhere, with no
/// round-trip and no dependency on how the user navigated away.
///
/// Cross-feature concern → `core/features/` (Principle XXXV). A plain
/// [ValueNotifier] rather than a cubit: it holds no logic, and widgets in
/// `core/widgets/` must be able to listen without a BlocProvider above them.
class CustomerPhotoStore extends ValueNotifier<CustomerPhoto> {
  CustomerPhotoStore() : super(const CustomerPhoto());

  /// A photo the user just picked and the server accepted. Bytes render with no
  /// network round-trip, so the new picture is on screen the moment it lands.
  void publishUpload(Uint8List bytes) =>
      value = CustomerPhoto(bytes: bytes, url: value.url);

  /// The presigned URL from the latest `/me` read. Kept as the fallback for
  /// screens opened later in the session (and after a restart, when there are
  /// no bytes at all).
  void publishRemote(String? url) =>
      value = CustomerPhoto(bytes: value.bytes, url: url);

  /// Drop everything on logout — the next account must not inherit a face.
  void clear() => value = const CustomerPhoto();
}

/// What the app currently knows about the customer's avatar. [bytes] win over
/// [url]: they are the picture the user picked in THIS session, so they are
/// never older than whatever the last presign pointed at.
@immutable
class CustomerPhoto {
  const CustomerPhoto({this.bytes, this.url});

  final Uint8List? bytes;
  final String? url;

  bool get isEmpty => bytes == null && (url == null || url!.isEmpty);
}
