import 'dart:async';
import 'dart:convert';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:app/core/features/portal_auth/cubit/portal_auth_handshake_cubit.dart';
import 'package:app/core/features/portal_auth/payloads/portal_auth_incoming_message.dart';
import 'package:app/core/features/portal_auth/portal_kind.dart';
import 'package:app/core/features/portal_auth/widgets/portal_auth_widgets.imports.dart';
import 'package:app/core/router/router.dart';
import 'package:app/core/services/firebase_auth_service.dart';
import 'package:app/core/services/user_service.dart';
import 'package:app/core/injection/injection.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Shared shell that hosts a [WebView] for a portal page, runs the auth
/// handshake via [PortalAuthHandshakeCubit], and overlays the failure /
/// loading native views.
///
/// Consumers provide a parent [BlocProvider] with a fresh
/// [PortalAuthHandshakeCubit] instance:
///
/// ```dart
/// BlocProvider(
///   create: (_) => getIt<PortalAuthHandshakeCubit>(),
///   child: PilotPortalWebViewShell(
///     kind: PortalKind.flightComputer,
///     url: portalUrlFor(kind, env),
///   ),
/// );
/// ```
class PilotPortalWebViewShell extends StatefulWidget {
  const PilotPortalWebViewShell({
    super.key,
    required this.kind,
    required this.url,
    this.attachmentId,
    this.footer,
    this.onClose,
  });

  final PortalKind kind;
  final Uri url;

  /// Required when [kind] is [PortalKind.attachmentEditor].
  final String? attachmentId;

  /// Optional overlay aligned to the bottom of the WebView. Used by the
  /// Attachment Editor to render the MCQ peek-bottom-sheet.
  final Widget? footer;

  /// Optional handler for terminal "exit this portal" CTAs (account disabled,
  /// attachment not found). Defaults to `context.router.maybePop()`.
  final VoidCallback? onClose;

  @override
  State<PilotPortalWebViewShell> createState() =>
      _PilotPortalWebViewShellState();
}

class _PilotPortalWebViewShellState extends State<PilotPortalWebViewShell> {
  late final WebViewController _controller;
  StreamSubscription<String>? _outgoingSub;
  bool _initialLoadStarted = false;

  static const String _channelName = 'FlutterAuthChannel';

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setUserAgent(
        kIsWeb ? null : 'Masrafy-Flutter/${_appVersion()}',
      )
      ..addJavaScriptChannel(
        _channelName,
        onMessageReceived: _onJsMessage,
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            _applyThemeBackground();
            context.read<PortalAuthHandshakeCubit>().onPageFinished();
          },
          onWebResourceError: (_) =>
              context.read<PortalAuthHandshakeCubit>().markNetworkError(),
        ),
      );

    final cubit = context.read<PortalAuthHandshakeCubit>();
    cubit.onMounted(kind: widget.kind, attachmentId: widget.attachmentId);
    _outgoingSub = cubit.outgoingJs.listen(_controller.runJavaScript);

    _initialLoadStarted = true;
    _controller.loadRequest(widget.url);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _applyThemeBackground();
  }

  @override
  void dispose() {
    _outgoingSub?.cancel();
    super.dispose();
  }

  void _onJsMessage(JavaScriptMessage message) {
    Map<String, dynamic>? json;
    try {
      json = jsonDecode(message.message) as Map<String, dynamic>;
    } catch (_) {
      return; // ignore malformed payloads
    }
    final incoming = PortalAuthIncomingMessage.fromJson(json);
    context.read<PortalAuthHandshakeCubit>().onIncomingMessage(incoming);
  }

  void _reload() {
    if (!_initialLoadStarted) return;
    _controller.loadRequest(widget.url);
  }

  /// Re-skins the hosted page background + text colour to match active Pilot
  /// theme. Injects a `<style>` tag with `!important` rules so hosted Angular
  /// CSS can't override. Re-applied on every `onPageFinished` + on theme change.
  void _applyThemeBackground() {
    if (!mounted) return;
    final colors = PilotColorTheme.of(context);
    final bg = _colorToCssHex(colors.bg.container);
    final fg = _colorToCssHex(colors.text.primary);
    final isDark = colors.bg.container.computeLuminance() < 0.5;
    final scheme = isDark ? 'dark' : 'light';
    _controller.runJavaScript("""
      (function(){
        var id='pilot-theme-overlay';
        var existing=document.getElementById(id);
        if(existing) existing.remove();
        var style=document.createElement('style');
        style.id=id;
        style.textContent=`
          :root { color-scheme: $scheme !important; }
          html, body {
            background-color: $bg !important;
            background-image: none !important;
            color: $fg !important;
          }
        `;
        (document.head||document.documentElement).appendChild(style);
        var ds=document.documentElement.style;
        ds.setProperty('background-color', '$bg', 'important');
        ds.setProperty('color', '$fg', 'important');
        ds.setProperty('color-scheme', '$scheme', 'important');
        if(document.body){
          var bs=document.body.style;
          bs.setProperty('background-color', '$bg', 'important');
          bs.setProperty('color', '$fg', 'important');
        }
      })();
    """);
  }

  String _colorToCssHex(Color c) {
    final r = (c.r * 255.0).round().toRadixString(16).padLeft(2, '0');
    final g = (c.g * 255.0).round().toRadixString(16).padLeft(2, '0');
    final b = (c.b * 255.0).round().toRadixString(16).padLeft(2, '0');
    return '#$r$g$b';
  }

  void _close(BuildContext ctx) {
    final onClose = widget.onClose;
    if (onClose != null) {
      onClose();
    } else {
      ctx.router.maybePop();
    }
  }

  Future<void> _onRetryFromFailure() async {
    await context.read<PortalAuthHandshakeCubit>().retry();
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<PortalAuthHandshakeCubit, PortalAuthHandshakeState>(
      listenWhen: (p, c) => p.failure != c.failure && c.failure != null,
      listener: (ctx, state) => _onFailureSideEffects(ctx, state.failure!),
      builder: (ctx, state) {
        return Stack(
          fit: StackFit.expand,
          children: [
            WebViewWidget(controller: _controller),
            if (widget.footer != null)
              Align(
                alignment: Alignment.bottomCenter,
                child: widget.footer!,
              ),
            PortalLoadingOverlay(visible: !state.isReady && !state.isFailed),
            if (state.isFailed)
              _FailureLayer(
                failure: state.failure!,
                onRetry: _onRetryFromFailure,
                onClose: () => _close(ctx),
              ),
          ],
        );
      },
    );
  }

  void _onFailureSideEffects(BuildContext ctx, PortalAuthFailure failure) {
    failure.when(
      tokenExpired: () {},
      tokenRevoked: () => _forceReauth(ctx),
      invalidToken: () => _forceReauth(ctx),
      userDisabled: () {},
      userNotFound: () {
        ctx.router.replaceAll([const CompleteProfileRoute()]);
      },
      rateLimited: (_) {},
      networkError: () {},
      attachmentNotFound: () {},
      unknown: (_) {},
    );
  }

  Future<void> _forceReauth(BuildContext ctx) async {
    try {
      await getIt<FirebaseAuthService>().signOut();
    } catch (_) {
      // Sign-out failure is non-fatal — we route to login regardless.
    }
    getIt<UserService>().clear();
    if (!ctx.mounted) return;
    ctx.router.replaceAll([LoginRoute()]);
  }
}

class _FailureLayer extends StatelessWidget {
  const _FailureLayer({
    required this.failure,
    required this.onRetry,
    required this.onClose,
  });

  final PortalAuthFailure failure;
  final VoidCallback onRetry;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return ColoredBox(
      color: colors.bg.container,
      child: failure.when(
        tokenExpired: () => const SizedBox.shrink(),
        tokenRevoked: () => const SizedBox.shrink(),
        invalidToken: () => const SizedBox.shrink(),
        userNotFound: () => const SizedBox.shrink(),
        userDisabled: () => PortalAccountDisabledView(onBack: onClose),
        rateLimited: (resetAt) => PortalRateLimitedView(
          resetAt: resetAt,
          onRetry: onRetry,
        ),
        networkError: () =>
            PortalOfflineView(networkError: true, onRetry: onRetry),
        attachmentNotFound: () =>
            PortalAttachmentNotFoundView(onBack: onClose),
        unknown: (_) => PortalOfflineView(networkError: true, onRetry: onRetry),
      ),
    );
  }
}

String _appVersion() {
  // Static reference — matches pubspec `version: X.Y.Z+N`. Kept hard-coded
  // because pulling `package_info_plus` introduces an async fetch and a new
  // dependency; the backend's only need is the `Masrafy-Flutter/` marker.
  return '1.0.0';
}
