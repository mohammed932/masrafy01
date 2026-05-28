import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/request/otp/otp_request.dart';
import '../../data/models/request/otp/otp_verify_request.dart';
import '../../data/models/request/password/password_reset_request.dart';
import '../../domain/entities/customer_entity.dart';
import '../../domain/entities/otp_challenge_entity.dart';
import '../../domain/enums/otp_purpose.dart';
import '../../domain/repositories/customer_auth_repository.dart';

abstract class ForgotPasswordState extends Equatable {
  const ForgotPasswordState();
  @override
  List<Object?> get props => [];
}

class ForgotPasswordIdle extends ForgotPasswordState {
  const ForgotPasswordIdle();
}

class ForgotPasswordRequestingOtp extends ForgotPasswordState {
  const ForgotPasswordRequestingOtp();
}

class ForgotPasswordOtpSent extends ForgotPasswordState {
  const ForgotPasswordOtpSent(this.challenge);
  final OtpChallengeEntity challenge;
  @override
  List<Object?> get props => [challenge];
}

class ForgotPasswordVerifying extends ForgotPasswordState {
  const ForgotPasswordVerifying();
}

class ForgotPasswordTokenIssued extends ForgotPasswordState {
  const ForgotPasswordTokenIssued(this.passwordResetToken);
  final String passwordResetToken;
  @override
  List<Object?> get props => [passwordResetToken];
}

class ForgotPasswordResetting extends ForgotPasswordState {
  const ForgotPasswordResetting();
}

class ForgotPasswordSuccess extends ForgotPasswordState {
  const ForgotPasswordSuccess(this.session);
  final CustomerSessionEntity session;
  @override
  List<Object?> get props => [session];
}

class ForgotPasswordFailure extends ForgotPasswordState {
  const ForgotPasswordFailure(this.error);
  final Object error;
  @override
  List<Object?> get props => [error];
}

class ForgotPasswordCubit extends Cubit<ForgotPasswordState> {
  ForgotPasswordCubit(this._repo) : super(const ForgotPasswordIdle());
  final CustomerAuthRepository _repo;

  Future<void> requestOtp({required String phone, required String locale}) async {
    emit(const ForgotPasswordRequestingOtp());
    final res = await _repo.requestOtp(
      OtpRequestRequest(
        phone: phone,
        purpose: OtpPurpose.forgotPassword,
        locale: locale,
      ),
    );
    res.fold(
      (err) => emit(ForgotPasswordFailure(err)),
      (ch) => emit(ForgotPasswordOtpSent(ch)),
    );
  }

  Future<void> verifyOtp({required String code}) async {
    final s = state;
    if (s is! ForgotPasswordOtpSent) return;
    emit(const ForgotPasswordVerifying());
    final res = await _repo.verifyOtp(
      OtpVerifyRequest(
        otpId: s.challenge.otpId,
        code: code,
        purpose: OtpPurpose.forgotPassword,
      ),
    );
    res.fold(
      (err) => emit(ForgotPasswordFailure(err)),
      (out) {
        if (out.passwordResetToken == null) {
          emit(ForgotPasswordFailure(StateError('no_reset_token_issued')));
          return;
        }
        emit(ForgotPasswordTokenIssued(out.passwordResetToken!));
      },
    );
  }

  Future<void> reset({required String newPassword}) async {
    final s = state;
    if (s is! ForgotPasswordTokenIssued) return;
    emit(const ForgotPasswordResetting());
    final res = await _repo.resetPassword(
      PasswordResetRequest(
        passwordResetToken: s.passwordResetToken,
        newPassword: newPassword,
      ),
    );
    res.fold(
      (err) => emit(ForgotPasswordFailure(err)),
      (sess) => emit(ForgotPasswordSuccess(sess)),
    );
  }
}
