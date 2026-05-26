import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/request/profile/profile_completion_request.dart';
import '../../domain/entities/otp_challenge_entity.dart';
import '../../domain/repositories/customer_auth_repository.dart';

abstract class CompleteProfileState extends Equatable {
  const CompleteProfileState();
  @override
  List<Object?> get props => [];
}

class CompleteProfileIdle extends CompleteProfileState {
  const CompleteProfileIdle();
}

class CompleteProfileRequestingOtp extends CompleteProfileState {
  const CompleteProfileRequestingOtp();
}

class CompleteProfileOtpSent extends CompleteProfileState {
  const CompleteProfileOtpSent(this.challenge);
  final OtpChallengeEntity challenge;
  @override
  List<Object?> get props => [challenge];
}

class CompleteProfileVerifyingOtp extends CompleteProfileState {
  const CompleteProfileVerifyingOtp();
}

class CompleteProfileMobileBound extends CompleteProfileState {
  const CompleteProfileMobileBound();
}

class CompleteProfileFailure extends CompleteProfileState {
  const CompleteProfileFailure(this.error);
  final Object error;
  @override
  List<Object?> get props => [error];
}

class CompleteProfileCubit extends Cubit<CompleteProfileState> {
  CompleteProfileCubit(this._repo) : super(const CompleteProfileIdle());
  final CustomerAuthRepository _repo;

  Future<void> requestOtp({required String phone}) async {
    emit(const CompleteProfileRequestingOtp());
    final res = await _repo.profileMobileRequestOtp(
      ProfileMobileRequestOtpRequest(phone: phone),
    );
    res.fold(
      (err) => emit(CompleteProfileFailure(err)),
      (ch) => emit(CompleteProfileOtpSent(ch)),
    );
  }

  Future<void> verifyOtp({required String code}) async {
    final s = state;
    if (s is! CompleteProfileOtpSent) return;
    emit(const CompleteProfileVerifyingOtp());
    final res = await _repo.profileMobileVerifyOtp(
      ProfileMobileVerifyOtpRequest(otpId: s.challenge.otpId, code: code),
    );
    res.fold(
      (err) => emit(CompleteProfileFailure(err)),
      (_) => emit(const CompleteProfileMobileBound()),
    );
  }

  void reset() => emit(const CompleteProfileIdle());
}
