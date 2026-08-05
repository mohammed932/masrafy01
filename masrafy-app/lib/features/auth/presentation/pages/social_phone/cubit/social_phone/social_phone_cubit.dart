import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/validators.dart';
import 'package:app/features/auth/data/models/request/profile/profile_completion_request.dart';
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'social_phone_cubit.freezed.dart';
part 'social_phone_state.dart';

/// SOCIAL onboarding — mobile entry screen. After a Google sign-in creates
/// a profile-incomplete lite account, the customer binds a phone here: on submit
/// [profileMobileRequestOtp] issues an SMS OTP and the page hands the challenge
/// (+ phone) to the shared OTP screen with [OtpPurpose.profileMobile].
/// Orchestration only — derivations live on [SocialPhoneState] (Principle XXXI).
@injectable
class SocialPhoneCubit extends Cubit<SocialPhoneState> {
  SocialPhoneCubit(this._auth) : super(const SocialPhoneState());

  final CustomerAuthUseCase _auth;

  void updateField(SocialPhoneField field, String value) {
    switch (field) {
      case SocialPhoneField.dialCode:
        emit(state.copyWith(dialCode: value, error: null));
      case SocialPhoneField.phone:
        emit(state.copyWith(phone: value, error: null));
    }
  }

  /// Requests the SMS OTP for the entered mobile (authenticated PROFILE_MOBILE
  /// flow). On success the page navigates to the OTP screen.
  Future<void> submit() async {
    if (!state.canSubmit) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.profileMobileRequestOtp(
      ProfileMobileRequestOtpRequest(phone: state.fullPhone),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (challenge) => emit(state.copyWith(
        status: RequestState.loaded,
        challenge: challenge,
        error: null,
      )),
    );
  }
}
