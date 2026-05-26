import 'dart:convert';

/// Outbound JS-channel payload sent from Flutter to the hosted portal page.
/// See `specs/024-mobile-webview-portals/contracts/auth-token-message.md`.
///
/// Plain class with a hand-written `toJson()` per Constitution A6: request /
/// outbound DTOs carry no annotations and no codegen.
class PortalAuthChannelMessage {
  const PortalAuthChannelMessage({
    required this.token,
    this.attachmentId,
  });

  /// Discriminator literal. The hosted page filters on this exact string.
  static const String type = 'AUTH_TOKEN';

  /// Current Firebase ID token issued by `FirebaseAuthService.getIdToken`.
  final String token;

  /// Required for the Attachment Editor; omitted (null) for the Flight
  /// Computer.
  final String? attachmentId;

  Map<String, dynamic> toJson() => {
        'type': type,
        'token': token,
        if (attachmentId != null) 'attachmentId': attachmentId,
      };

  /// Serializes to a single-line JSON string suitable for embedding inside a
  /// `window.postMessage(...)` call via
  /// `WebViewController.runJavaScript(...)`. Escapes single quotes so the
  /// surrounding JS string literal stays well-formed.
  String toJsonString() => jsonEncode(toJson());
}
