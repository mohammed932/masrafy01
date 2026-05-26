import 'package:app/core/services/integrity/integrity_violation_entity.dart';

abstract class IntegrityProbe {
  Stream<IntegrityViolationEntity> get violations;

  Future<void> start();
  Future<void> stop();
}
