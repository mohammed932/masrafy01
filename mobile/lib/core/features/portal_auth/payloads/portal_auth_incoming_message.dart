/// Inbound JS-channel payload received from the hosted portal page.
/// See `specs/024-mobile-webview-portals/contracts/auth-required-message.md`.
///
/// Plain class with a `fromJson` factory — see Constitution A6 for the
/// outbound-DTO rule; the inbound side mirrors it for symmetry and to keep
/// the parse site in one place.
class PortalAuthIncomingMessage {
  const PortalAuthIncomingMessage({
    required this.type,
    this.returnUrl,
    this.reason,
    this.resetAtIso,
  });

  /// Discriminator. Expected values:
  ///   * `AUTH_REQUIRED` — the page failed to validate; Flutter should refresh
  ///     the token or surface the failure UI.
  ///   * `AUTH_READY` — the page is rendered; Flutter should fade out the
  ///     loading overlay.
  final String type;

  /// Optional relative path the page wants to resume after re-auth. Used as a
  /// hint when several portals share the same channel.
  final String? returnUrl;

  /// Optional backend failure reason. One of `token_expired`, `token_revoked`,
  /// `user_disabled`, `user_not_found`, `invalid_token`, `rate_limited`,
  /// `not_found`.
  final String? reason;

  /// Optional ISO-8601 timestamp accompanying a `rate_limited` reason. Parsed
  /// by callers, not here, to keep this DTO dependency-free.
  final String? resetAtIso;

  factory PortalAuthIncomingMessage.fromJson(Map<String, dynamic> json) =>
      PortalAuthIncomingMessage(
        type: (json['type'] as String?) ?? '',
        returnUrl: json['returnUrl'] as String?,
        reason: json['reason'] as String?,
        resetAtIso: json['resetAt'] as String?,
      );
}
