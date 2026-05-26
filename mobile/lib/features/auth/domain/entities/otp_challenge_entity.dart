import 'package:equatable/equatable.dart';

class OtpChallengeEntity extends Equatable {
  const OtpChallengeEntity({
    required this.otpId,
    required this.maskedPhone,
    required this.expiresInSeconds,
    required this.resendAvailableInSeconds,
  });

  final String otpId;
  final String maskedPhone;
  final int expiresInSeconds;
  final int resendAvailableInSeconds;

  @override
  List<Object?> get props => [otpId, maskedPhone, expiresInSeconds, resendAvailableInSeconds];
}
