import 'dart:async';

import 'package:flutter/services.dart';
import 'package:app/core/services/integrity/integrity_probe.dart';
import 'package:app/core/services/integrity/integrity_violation_entity.dart';
import 'package:app/core/services/integrity/integrity_violation_severity.dart';

class ClipboardProbe extends IntegrityProbe {
  final _controller = StreamController<IntegrityViolationEntity>.broadcast();
  String? _lastClipboardContent;

  @override
  Stream<IntegrityViolationEntity> get violations => _controller.stream;

  @override
  Future<void> start() async {
    // Passive — called explicitly on question transitions via checkClipboard().
  }

  @override
  Future<void> stop() async {
    _controller.close();
  }

  Future<void> checkClipboard(String currentQuestionId) async {
    try {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final text = data?.text;
      if (text != null &&
          text.isNotEmpty &&
          text != _lastClipboardContent &&
          text.length > 20) {
        _lastClipboardContent = text;
        _controller.add(IntegrityViolationEntity(
          probeType: 'clipboard',
          severity: IntegrityViolationSeverity.low,
          score: 5,
          occurredAt: DateTime.now(),
          payload: {'questionId': currentQuestionId, 'textLength': text.length},
        ));
      }
    } catch (_) {
      // Clipboard access denied — not a violation.
    }
  }
}
