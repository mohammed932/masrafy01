import 'package:app/core/services/integrity/integrity_violation_severity.dart';

class IntegrityViolationEntity {
  const IntegrityViolationEntity({
    required this.probeType,
    required this.severity,
    required this.score,
    required this.occurredAt,
    required this.payload,
  });

  final String probeType;
  final IntegrityViolationSeverity severity;
  final int score;
  final DateTime occurredAt;
  final Map<String, Object?> payload;

  Map<String, dynamic> toJson() => {
        'probeType': probeType,
        'severity': severity.name,
        'score': score,
        'occurredAt': occurredAt.toIso8601String(),
        'payload': payload,
      };
}
