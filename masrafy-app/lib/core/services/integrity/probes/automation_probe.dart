import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:app/core/services/integrity/integrity_probe.dart';
import 'package:app/core/services/integrity/integrity_violation_entity.dart';
import 'package:app/core/services/integrity/integrity_violation_severity.dart';

class AutomationProbe extends IntegrityProbe {
  static const _accessibilityChannel =
      MethodChannel('masrafy/accessibility_check');

  /// Cached availability flag for the native accessibility channel.
  /// Once we've discovered the channel isn't wired on the running
  /// platform, we skip subsequent invocations entirely so the
  /// debugger / Talker logger doesn't surface a `MissingPluginException`
  /// first-chance throw on every probe run.
  static bool? _channelAvailable;

  final _controller = StreamController<IntegrityViolationEntity>.broadcast();

  @override
  Stream<IntegrityViolationEntity> get violations => _controller.stream;

  @override
  Future<void> start() async {
    final detected = await _isAutomationDetected();
    if (detected) {
      _controller.add(IntegrityViolationEntity(
        probeType: 'automation',
        severity: IntegrityViolationSeverity.high,
        score: 50,
        occurredAt: DateTime.now(),
        payload: {'platform': Platform.operatingSystem},
      ));
    }
  }

  @override
  Future<void> stop() async {
    _controller.close();
  }

  Future<bool> _isAutomationDetected() async {
    // Channel is only ever wired on Android / iOS; bail early on
    // desktop & web so the throw never happens there.
    if (!Platform.isAndroid && !Platform.isIOS) return false;

    // Fast-path: previously detected as unavailable on this platform.
    if (_channelAvailable == false) return false;

    try {
      final result = await _accessibilityChannel
          .invokeMethod<bool>('checkAutomationServices');
      _channelAvailable = true;
      return result ?? false;
    } on MissingPluginException {
      // Native handler not registered (yet) — flip the flag so future
      // probe runs short-circuit instead of repeatedly throwing.
      _channelAvailable = false;
      return false;
    } catch (_) {
      return false;
    }
  }
}
