/// Approval-probability tier surfaced by the matching engine
/// (Constitution Principle V). Mirrors the backend `ApprovalTier`
/// literals (`excellent | good | moderate | low | very_low`).
enum ApprovalTier {
  excellent,
  good,
  moderate,
  low,
  veryLow;

  /// Parse the backend wire code. Unknown / missing → [ApprovalTier.veryLow].
  static ApprovalTier fromCode(String? code) {
    switch (code) {
      case 'excellent':
        return ApprovalTier.excellent;
      case 'good':
        return ApprovalTier.good;
      case 'moderate':
        return ApprovalTier.moderate;
      case 'low':
        return ApprovalTier.low;
      case 'very_low':
      default:
        return ApprovalTier.veryLow;
    }
  }
}
