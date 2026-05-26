import 'dart:async';

import 'package:injectable/injectable.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import 'package:app/core/network/network_interface.dart';
import 'package:app/core/services/integrity/integrity_probe.dart';
import 'package:app/core/services/integrity/integrity_violation_entity.dart';
import 'package:app/core/services/integrity/integrity_violation_severity.dart';
import 'package:app/core/services/integrity/probes/automation_probe.dart';
import 'package:app/core/services/integrity/probes/clipboard_probe.dart';
import 'package:app/core/services/integrity/probes/visibility_probe.dart';

@lazySingleton
class IntegrityService {
  IntegrityService(this._network);

  final BaseNetwork _network;

  final List<IntegrityProbe> _probes = [];
  final List<IntegrityViolationEntity> _pendingEvents = [];
  final List<StreamSubscription<IntegrityViolationEntity>> _subscriptions = [];
  Timer? _flushTimer;
  String? _activeSessionId;
  int _accumulatedScore = 0;

  // Public access to ClipboardProbe for question-transition checks.
  ClipboardProbe? get clipboardProbe =>
      _probes.whereType<ClipboardProbe>().firstOrNull;

  static const int _softThreshold = 30;  // accumulated score → warning modal
  static const int _hardThreshold = 100; // accumulated score → invalidation
  static const Duration _flushInterval = Duration(seconds: 30);

  // Violation stream for the cubit to observe soft/hard events.
  final _violationController =
      StreamController<IntegrityViolationEntity>.broadcast();
  Stream<IntegrityViolationEntity> get violations => _violationController.stream;

  Future<void> startSession(String sessionId) async {
    _activeSessionId = sessionId;
    _accumulatedScore = 0;
    _pendingEvents.clear();

    final probes = [VisibilityProbe(), ClipboardProbe(), AutomationProbe()];
    _probes.addAll(probes);

    for (final probe in _probes) {
      await probe.start();
      _subscriptions.add(probe.violations.listen(_onViolation));
    }

    _flushTimer = Timer.periodic(_flushInterval, (_) => _flush());
  }

  Future<void> stopSession() async {
    _flushTimer?.cancel();
    _flushTimer = null;

    for (final sub in _subscriptions) {
      await sub.cancel();
    }
    _subscriptions.clear();

    for (final probe in _probes) {
      await probe.stop();
    }
    _probes.clear();

    await _flush();
    _activeSessionId = null;
  }

  void _onViolation(IntegrityViolationEntity violation) {
    _pendingEvents.add(violation);
    _violationController.add(violation);
    _accumulatedScore += violation.score;

    if (violation.severity == IntegrityViolationSeverity.hard ||
        _accumulatedScore >= _hardThreshold) {
      _invalidateSession(violation);
    } else if (_accumulatedScore >= _softThreshold) {
      // Score crossed soft threshold — cubit observes violation stream
      // and shows warning modal to the learner.
    }
  }

  Future<void> _flush() async {
    if (_pendingEvents.isEmpty || _activeSessionId == null) return;
    final sessionId = _activeSessionId!;
    final events = List<IntegrityViolationEntity>.from(_pendingEvents);
    _pendingEvents.clear();

    try {
      await _network.post(
        PilotEndpoint(endpoint: ApiStrings.integrityEvents(sessionId)),
        // Body matches Angular `IntegrityApiService.sendEvents`
        // (integrity-api.service.ts L22): just `{ events }` — the
        // sessionId is encoded in the URL path.
        data: {'events': events.map((e) => e.toJson()).toList()},
      );
    } catch (_) {
      // Silent — re-add on next flush.
      _pendingEvents.insertAll(0, events);
    }
  }

  Future<void> _invalidateSession(IntegrityViolationEntity trigger) async {
    await invalidate(
      reason: 'SCORE_THRESHOLD',
      probeType: trigger.probeType,
      payload: trigger.payload,
    );
  }

  /// User-callable invalidate. Mirrors Angular `IntegrityService.invalidate`.
  /// Posts to `/api/integrity/invalidate` with the supplied [reason]
  /// (`USER_ENDED`, `GRACE_EXPIRED`, `SCORE_THRESHOLD`, ...). Idempotent
  /// on no-op when there's no active session.
  Future<void> invalidate({
    required String reason,
    String? probeType,
    Map<String, dynamic>? payload,
  }) async {
    final sessionId = _activeSessionId;
    if (sessionId == null) return;
    try {
      await _network.post(
        PilotEndpoint(endpoint: ApiStrings.integrityInvalidate(sessionId)),
        // Body matches Angular `IntegrityApiService.invalidate`
        // (integrity-api.service.ts L36): `{ triggerType, payload }`
        // — the sessionId rides on the URL path.
        data: {
          'triggerType': probeType ?? reason,
          if (payload != null) 'payload': payload,
        },
      );
    } catch (_) {
      // Silent — server will detect on next answer submit.
    }
  }
}
