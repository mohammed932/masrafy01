import 'package:equatable/equatable.dart';

import '../enums/approval_tier.dart';

/// One bank-program match in the matching preview. Money fields stay
/// decimal STRINGS end-to-end (Constitution Principle I — no float math).
class PreviewMatchEntity extends Equatable {
  const PreviewMatchEntity({
    required this.bankProgramId,
    required this.programCode,
    required this.bankName,
    required this.bankIsFeatured,
    required this.programFriendlyName,
    required this.eligible,
    required this.monthlyInstallmentEGP,
    required this.effectiveRatePercent,
    required this.approvalProbability,
    required this.approvalTier,
    required this.rejectionReasons,
    required this.requiredDocuments,
    required this.usedDefaultWeights,
  });

  final String bankProgramId;
  final String programCode;
  final String bankName;
  final bool bankIsFeatured;
  final String programFriendlyName;
  final bool eligible;
  final String monthlyInstallmentEGP;
  final String effectiveRatePercent;
  final double approvalProbability;
  final ApprovalTier approvalTier;
  final List<String> rejectionReasons;
  final List<String> requiredDocuments;
  final bool usedDefaultWeights;

  @override
  List<Object?> get props => [
        bankProgramId,
        programCode,
        eligible,
        approvalProbability,
        approvalTier,
      ];
}
