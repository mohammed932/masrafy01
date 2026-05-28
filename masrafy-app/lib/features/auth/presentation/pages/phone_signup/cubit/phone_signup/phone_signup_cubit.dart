import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import '../../../../../../../core/enums/request_state.dart';
import '../../../../../../../core/result/failure.dart';
import '../../../../../data/models/request/otp/otp_verify_request.dart';
import '../../../../../data/models/request/signup/signup_phone_complete_request.dart';
import '../../../../../data/models/request/signup/signup_phone_start_request.dart';
import '../../../../../domain/entities/customer_entity.dart';
import '../../../../../domain/entities/otp_challenge_entity.dart';
import '../../../../../domain/enums/otp_purpose.dart';
import '../../../../../domain/repositories/customer_auth_repository.dart';

part 'phone_signup_cubit.freezed.dart';
part 'phone_signup_state.dart';

@injectable
class PhoneSignupCubit extends Cubit<PhoneSignupState> {
  PhoneSignupCubit(this._repo) : super(const PhoneSignupState());

  final CustomerAuthRepository _repo;

  void updateField(PhoneSignupField field, Object value) {
    switch (field) {
      case PhoneSignupField.phone:
        emit(state.copyWith(phone: value as String));
        break;
      case PhoneSignupField.otpCode:
        emit(state.copyWith(otpCode: value as String));
        break;
      case PhoneSignupField.locale:
        emit(state.copyWith(locale: value as String));
        break;
      case PhoneSignupField.name:
        emit(state.copyWith(name: value as String));
        break;
      case PhoneSignupField.email:
        emit(state.copyWith(email: value as String));
        break;
      case PhoneSignupField.password:
        emit(state.copyWith(password: value as String));
        break;
      case PhoneSignupField.age:
        emit(state.copyWith(age: value as int));
        break;
    }
  }

  Future<void> requestOtp() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: PhoneSignupStep.requestingOtp,
      error: null,
    ));
    final res = await _repo.signupPhoneStart(
      SignupPhoneStartRequest(phone: state.phone, locale: state.locale),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (ch) => emit(state.copyWith(
        status: RequestState.loaded,
        step: PhoneSignupStep.otpSent,
        challenge: ch,
        error: null,
      )),
    );
  }

  Future<void> verifyOtp() async {
    if (state.challenge == null) return;
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: PhoneSignupStep.verifyingOtp,
      error: null,
    ));
    final res = await _repo.verifyOtp(
      OtpVerifyRequest(
        otpId: state.challenge!.otpId,
        code: state.otpCode,
        purpose: OtpPurpose.signup,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (out) {
        if (out.verifiedMobileToken == null) {
          emit(state.copyWith(
            status: RequestState.error,
            error: const ServerFailure(code: 'NO_VERIFIED_MOBILE_TOKEN'),
          ));
          return;
        }
        emit(state.copyWith(
          status: RequestState.loaded,
          step: PhoneSignupStep.mobileVerified,
          verifiedMobileToken: out.verifiedMobileToken,
          verifiedPhone: out.phone ?? state.phone,
          error: null,
        ));
      },
    );
  }

  Future<void> completeProfile() async {
    if (state.verifiedMobileToken == null) return;
    if (state.status.isLoading) return;
    final ageValue = state.age;
    if (ageValue == null) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: PhoneSignupStep.submittingProfile,
      error: null,
    ));
    final res = await _repo.signupPhoneComplete(
      SignupPhoneCompleteRequest(
        verifiedMobileToken: state.verifiedMobileToken!,
        name: state.name,
        email: state.email.isEmpty ? null : state.email,
        password: state.password,
        age: ageValue,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (session) => emit(state.copyWith(
        status: RequestState.loaded,
        step: PhoneSignupStep.success,
        session: session,
        error: null,
      )),
    );
  }

  void reset() => emit(const PhoneSignupState());
}
