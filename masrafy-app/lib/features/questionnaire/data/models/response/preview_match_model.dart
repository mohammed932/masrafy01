import '../../../domain/entities/preview_match_entity.dart';
import '../../../domain/enums/approval_tier.dart';

/// Wire-format DTO for one matched bank program in the preview. Money
/// stays a decimal STRING (Constitution Principle I).
class PreviewMatchModel {
  PreviewMatchModel({
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

  factory PreviewMatchModel.fromJson(Map<String, dynamic> json) {
    return PreviewMatchModel(
      bankProgramId: json['bankProgramId'] as String? ?? '',
      programCode: json['programCode'] as String? ?? '',
      bankName: json['bankName'] as String? ?? '',
      bankIsFeatured: json['bankIsFeatured'] as bool? ?? false,
      programFriendlyName: json['programFriendlyName'] as String? ?? '',
      eligible: json['eligible'] as bool? ?? false,
      monthlyInstallmentEGP: json['monthlyInstallmentEGP'] as String? ?? '0',
      effectiveRatePercent: json['effectiveRatePercent'] as String? ?? '0',
      approvalProbability:
          (json['approvalProbability'] as num?)?.toDouble() ?? 0,
      approvalTier: json['approvalTier'] as String? ?? '',
      rejectionReasons:
          (json['rejectionReasons'] as List<dynamic>? ?? const []).cast<String>(),
      requiredDocuments:
          (json['requiredDocuments'] as List<dynamic>? ?? const []).cast<String>(),
      usedDefaultWeights: json['usedDefaultWeights'] as bool? ?? false,
    );
  }

  final String bankProgramId;
  final String programCode;
  final String bankName;
  final bool bankIsFeatured;
  final String programFriendlyName;
  final bool eligible;
  final String monthlyInstallmentEGP;
  final String effectiveRatePercent;
  final double approvalProbability;
  final String approvalTier;
  final List<String> rejectionReasons;
  final List<String> requiredDocuments;
  final bool usedDefaultWeights;

  PreviewMatchEntity toEntity() => PreviewMatchEntity(
        bankProgramId: bankProgramId,
        programCode: programCode,
        bankName: bankName,
        bankIsFeatured: bankIsFeatured,
        programFriendlyName: programFriendlyName,
        eligible: eligible,
        monthlyInstallmentEGP: monthlyInstallmentEGP,
        effectiveRatePercent: effectiveRatePercent,
        approvalProbability: approvalProbability,
        approvalTier: ApprovalTier.fromWire(approvalTier),
        rejectionReasons: rejectionReasons,
        requiredDocuments: requiredDocuments,
        usedDefaultWeights: usedDefaultWeights,
      );
}
