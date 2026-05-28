import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:app/core/services/integrity/integrity_probe.dart';
import 'package:app/core/services/integrity/integrity_violation_entity.dart';
import 'package:app/core/services/integrity/integrity_violation_severity.dart';

class VisibilityProbe extends IntegrityProbe with WidgetsBindingObserver {
  final _controller = StreamController<IntegrityViolationEntity>.broadcast();
  int _backgroundCount = 0;
  static const int _hardThreshold = 10;

  @override
  Stream<IntegrityViolationEntity> get violations => _controller.stream;

  @override
  Future<void> start() async {
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  Future<void> stop() async {
    WidgetsBinding.instance.removeObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _backgroundCount++;
      final severity = _backgroundCount >= _hardThreshold
          ? IntegrityViolationSeverity.hard
          : IntegrityViolationSeverity.medium;
      _controller.add(IntegrityViolationEntity(
        probeType: 'visibility',
        severity: severity,
        score: severity == IntegrityViolationSeverity.hard ? 100 : 10,
        occurredAt: DateTime.now(),
        payload: {'backgroundCount': _backgroundCount, 'lifecycleState': state.name},
      ));
    }
  }

  void dispose() {
    _controller.close();
  }
}
