import 'package:app/core/environments/base_environment.dart';

/// Which hosted portal a WebView shell is currently showing. Drives the URL
/// to load and the outbound auth payload shape (with vs without
/// `attachmentId`).
enum PortalKind {
  flightComputer,
  attachmentEditor;

  /// Telemetry-friendly identifier used inside `developer.log` events.
  String get telemetryName => switch (this) {
        PortalKind.flightComputer => 'flight_computer',
        PortalKind.attachmentEditor => 'attachment_editor',
      };
}

/// Resolves the hosted portal URL for [kind] against [environment].
Uri portalUrlFor(PortalKind kind, BaseEnvironment environment) {
  final path = switch (kind) {
    PortalKind.flightComputer => '/mobile/flightcomputer',
    PortalKind.attachmentEditor => '/mobile/attachment',
  };
  return Uri.parse('${environment.webBaseUrl}$path');
}
