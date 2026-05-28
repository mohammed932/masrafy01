import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/request/otp/otp_verify_request.dart';
import '../../data/models/request/signup/signup_phone_complete_request.dart';
import '../../data/models/request/signup/signup_phone_start_request.dart';
import '../../domain/entities/customer_entity.dart';
import '../../domain/entities/otp_challenge_entity.dart';
import '../../domain/enums/otp_purpose.dart';
import '../../domain/repositories/customer_auth_repository.dart';

abstract class PhoneSignupState extends Equatable {
  const PhoneSignupState();
  @override
  List<Object?> get props => [];
}

class PhoneSignupIdle extends PhoneSignupState {
  const PhoneSignupIdle();
}

class PhoneSignupRequestingOtp extends PhoneSignupState {
  const PhoneSignupRequestingOtp();
}

class PhoneSignupOtpSent extends PhoneSignupState {
  const PhoneSignupOtpSent(this.challenge);
  final OtpChallengeEntity challenge;
  @override
  List<Object?> get props => [challenge];
}

class PhoneSignupVerifyingOtp extends PhoneSignupState {
  const PhoneSignupVerifyingOtp(this.challenge);
  final OtpChallengeEntity challenge;
  @override
  List<Object?> get props => [challenge];
}

class PhoneSignupMobileVerified extends PhoneSignupState {
  const PhoneSignupMobileVerified(this.verifiedMobileToken, this.phone);
  final String verifiedMobileToken;
  final String phone;
  @override
  List<Object?> get props => [verifiedMobileToken, phone];
}

class PhoneSignupSubmittingProfile extends PhoneSignupState {
  const PhoneSignupSubmittingProfile();
}

class PhoneSignupSuccess extends PhoneSignupState {
  const PhoneSignupSuccess(this.session);
  final CustomerSessionEntity session;
  @override
  List<Object?> get props => [session];
}

class PhoneSignupFailure extends PhoneSignupState {
  const PhoneSignupFailure(this.error);
  final Object error;
  @override
  List<Object?> get props => [error];
}

class PhoneSignupCubit extends Cubit<PhoneSignupState> {
  PhoneSignupCubit(this._repo) : super(const PhoneSignupIdle());
  final CustomerAuthRepository _repo;

  Future<void> requestOtp({required String phone, required String locale}) async {
    emit(const PhoneSignupRequestingOtp());
    final res = await _repo.signupPhoneStart(
      SignupPhoneStartRequest(phone: phone, locale: locale),
    );
    res.fold(
      (err) => emit(PhoneSignupFailure(err)),
      (ch) => emit(PhoneSignupOtpSent(ch)),
    );
  }

  Future<void> verifyOtp({required String code}) async {
    final s = state;
    if (s is! PhoneSignupOtpSent) return;
    emit(PhoneSignupVerifyingOtp(s.challenge));
    final res = await _repo.verifyOtp(
      OtpVerifyRequest(
        otpId: s.challenge.otpId,
        code: code,
        purpose: OtpPurpose.signup,
      ),
    );
    res.fold(
      (err) => emit(PhoneSignupFailure(err)),
      (out) {
        if (out.verifiedMobileToken == null) {
          emit(PhoneSignupFailure(StateError('expected verifiedMobileToken')));
          return;
        }
        emit(PhoneSignupMobileVerified(out.verifiedMobileToken!, out.phone ?? ''));
      },
    );
  }

  Future<void> completeProfile({
    required String name,
    String? email,
    required String password,
    required int age,
  }) async {
    final s = state;
    if (s is! PhoneSignupMobileVerified) return;
    emit(const PhoneSignupSubmittingProfile());
    final res = await _repo.signupPhoneComplete(
      SignupPhoneCompleteRequest(
        verifiedMobileToken: s.verifiedMobileToken,
        name: name,
        email: email,
        password: password,
        age: age,
      ),
    );
    res.fold(
      (err) => emit(PhoneSignupFailure(err)),
      (session) => emit(PhoneSignupSuccess(session)),
    );
  }

  void reset() => emit(const PhoneSignupIdle());
}
