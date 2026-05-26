enum IntegrityViolationSeverity { low, medium, high, hard }

extension IntegrityViolationSeverityX on IntegrityViolationSeverity {
  bool get isHard => this == IntegrityViolationSeverity.hard;
  bool get isSoft => !isHard;
}
