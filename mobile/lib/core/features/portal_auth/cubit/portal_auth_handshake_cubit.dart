import 'dart:async';
import 'dart:developer' as developer;

import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/features/portal_auth/payloads/portal_auth_channel_message.dart';
import 'package:app/core/features/portal_auth/payloads/portal_auth_incoming_message.dart';
import 'package:app/core/features/portal_auth/portal_kind.dart';
import 'package:app/core/services/firebase_auth_service.dart';

part 'portal_auth_handshake_cubit.freezed.dart';
part 'portal_auth_handshake_state.dart';

/// Drives the auth handshake between Flutter and a hosted portal page.
///
/// One instance per portal route. Owns:
///   * the lifecycle state machine (`PortalLifecycle`),
///   * the outbound JS message stream consumed by the WebView shell,
///   * Firebase token retrieval + forced-refresh on `AUTH_REQUIRED`,
///   * telemetry events via `developer.log(name: 'portal')`.
///
/// Caps `retryCount` at 2 — after a third consecutive `AUTH_REQUIRED` the
/// cubit short-circuits to `tokenRevoked` instead of asking Firebase for yet
/// another token.
@injectable
class PortalAuthHandshakeCubit extends Cubit<PortalAuthHandshakeState> {
  PortalAuthHandshakeCubit(this._authService)
      : super(const PortalAuthHandshakeState());

  final FirebaseAuthService _authService;
  final StreamController<String> _outgoingJs =
      StreamController<String>.broadcast();

  static const int _maxRetries = 2;

  PortalKind? _kind;
  String? _attachmentId;

  /// Stream of JS strings the shell pushes into the WebView via
  /// `controller.runJavaScript(...)`. Each string is already wrapped in a
  /// `window.postMessage('…','*')` call so the shell forwards verbatim.
  Stream<String> get outgoingJs => _outgoingJs.stream;

  /// Called by the shell as soon as it mounts. Records the portal flavor +
  /// optional attachment id so subsequent refresh cycles preserve them.
  void onMounted({required PortalKind kind, String? attachmentId}) {
    _kind = kind;
    _attachmentId = attachmentId;
    _log('open');
    emit(state.copyWith(
      status: PortalLifecycle.loadingPage,
      failure: null,
      pageReady: false,
      retryCount: 0,
    ));
  }

  /// Called by the shell from `NavigationDelegate.onPageFinished` once the
  /// hosted page reports it has loaded its document.
  Future<void> onPageFinished() async {
    if (state.isFailed) return;
    emit(state.copyWith(status: PortalLifecycle.sendingToken));
    await _sendToken();
  }

  /// Routes inbound JS-channel messages from the hosted page.
  Future<void> onIncomingMessage(PortalAuthIncomingMessage msg) async {
    if (msg.type == 'AUTH_READY') {
      _log('ready');
      emit(state.copyWith(
        status: PortalLifecycle.ready,
        pageReady: true,
        failure: null,
      ));
      return;
    }
    if (msg.type != 'AUTH_REQUIRED') return;

    final resetAt = msg.resetAtIso == null
        ? null
        : DateTime.tryParse(msg.resetAtIso!);
    final failure =
        PortalAuthFailure.fromReason(msg.reason, resetAt: resetAt);
    await _handleFailure(failure);
  }

  /// Called by the shell from `NavigationDelegate.onWebResourceError`.
  void markNetworkError() {
    _log('failure', reason: 'network_error');
    emit(state.copyWith(
      status: PortalLifecycle.failed,
      failure: const PortalAuthFailure.networkError(),
    ));
  }

  /// Public re-entry point for "Try again" CTAs on the failure views.
  Future<void> retry() async {
    if (_kind == null) return;
    onMounted(kind: _kind!, attachmentId: _attachmentId);
  }

  Future<void> _handleFailure(PortalAuthFailure failure) async {
    final isSilentRefresh = failure is _PortalAuthTokenExpired;
    if (isSilentRefresh && state.retryCount < _maxRetries) {
      _log('failure', reason: 'token_expired', isRetry: true);
      emit(state.copyWith(retryCount: state.retryCount + 1));
      await _sendToken(forceRefresh: true);
      return;
    }
    // Either retries exhausted (treat as revoked) or a terminal failure.
    final terminal = isSilentRefresh
        ? const PortalAuthFailure.tokenRevoked()
        : failure;

    _log(
      terminal is _PortalAuthRateLimited ? 'rate_limited' : 'failure',
      reason: _failureName(terminal),
      resetAt: terminal is _PortalAuthRateLimited
          ? terminal.resetAt?.toIso8601String()
          : null,
    );
    emit(state.copyWith(
      status: PortalLifecycle.failed,
      failure: terminal,
    ));
  }

  Future<void> _sendToken({bool forceRefresh = false}) async {
    try {
      final token = await _authService.getIdToken(forceRefresh: forceRefresh);
      if (token.isEmpty) {
        await _handleFailure(const PortalAuthFailure.invalidToken());
        return;
      }
      final msg = PortalAuthChannelMessage(
        token: token,
        attachmentId: _attachmentId,
      );
      final json = msg.toJsonString();
      // Escape single quotes so the surrounding JS string literal stays valid.
      final escaped = json.replaceAll(r"\", r"\\").replaceAll("'", r"\'");
      // Replay the postMessage a few times after `onPageFinished` because
      // the Angular SPA's listener may attach a tick or two after the doc
      // is finished loading. Three retries spaced 200/600/1200 ms covers the
      // typical mount window without blocking the UI thread.
      final jsBurst =
          "(function(){"
          "var p=function(){window.postMessage('$escaped','*');};"
          "p();"
          "setTimeout(p,200);"
          "setTimeout(p,600);"
          "setTimeout(p,1200);"
          "})();";
      _outgoingJs.add(jsBurst);
      // Hosted page renders silently on success (no AUTH_READY echo).
      // Transition to ready immediately so the loading overlay clears; if
      // AUTH_REQUIRED arrives later, the failure layer takes over.
      _log('ready');
      emit(state.copyWith(
        status: PortalLifecycle.ready,
        pageReady: true,
        failure: null,
      ));
    } catch (_) {
      // Any Firebase error here = the local session is unusable. Treat as
      // revoked — same UX as a backend revocation.
      await _handleFailure(const PortalAuthFailure.tokenRevoked());
    }
  }

  String _failureName(PortalAuthFailure failure) {
    return failure.when(
      tokenExpired: () => 'token_expired',
      tokenRevoked: () => 'token_revoked',
      userDisabled: () => 'user_disabled',
      userNotFound: () => 'user_not_found',
      invalidToken: () => 'invalid_token',
      rateLimited: (_) => 'rate_limited',
      networkError: () => 'network_error',
      attachmentNotFound: () => 'attachment_not_found',
      unknown: (raw) => 'unknown(${raw ?? ''})',
    );
  }

  void _log(
    String event, {
    String? reason,
    String? resetAt,
    bool isRetry = false,
  }) {
    final fields = <String, Object?>{
      'portal': _kind?.telemetryName,
      'event': event,
      if (_attachmentId != null) 'attachmentId': _attachmentId,
      if (reason != null) 'reason': reason,
      if (resetAt != null) 'resetAt': resetAt,
      if (isRetry) 'retryCount': state.retryCount + 1,
    };
    developer.log(fields.toString(), name: 'portal');
  }

  @override
  Future<void> close() {
    _outgoingJs.close();
    return super.close();
  }
}
