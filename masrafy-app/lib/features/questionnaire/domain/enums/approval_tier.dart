/// Approval-probability tier returned per matched bank program. `unknown`
/// is the forward-compatible fallback for an unrecognised wire token.
enum ApprovalTier {
  excellent,
  good,
  moderate,
  low,
  veryLow,
  unknown;

  static ApprovalTier fromWire(String wire) => switch (wire) {
        'excellent' => ApprovalTier.excellent,
        'good' => ApprovalTier.good,
        'moderate' => ApprovalTier.moderate,
        'low' => ApprovalTier.low,
        'very_low' => ApprovalTier.veryLow,
        _ => ApprovalTier.unknown,
      };
}
