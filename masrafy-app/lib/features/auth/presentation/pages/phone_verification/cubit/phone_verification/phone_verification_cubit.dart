import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/validators.dart';
import 'package:app/core/widgets/input_controls/phone_dial_codes.dart';
import 'package:app/features/auth/data/models/request/profile/profile_completion_request.dart';
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'phone_verification_cubit.freezed.dart';
part 'phone_verification_state.dart';

/// Mobile-entry screen for any account still missing a verified phone —
/// today that is the Google lite account, but the gate is keyed on
/// `mobileVerifiedAt`, not on registration path. On submit
/// [profileMobileRequestOtp] issues an SMS OTP and the page hands the challenge
/// (+ phone) to the shared OTP screen with [OtpPurpose.profileMobile].
/// Orchestration only — derivations live on [PhoneVerificationState] (Principle XXXI).
@injectable
class PhoneVerificationCubit extends Cubit<PhoneVerificationState> {
  PhoneVerificationCubit(this._auth) : super(const PhoneVerificationState());

  final CustomerAuthUseCase _auth;

  /// Prefills the form from the account's abandoned verification attempt
  /// (`pendingMobile` on the profile payload). No-op when there is nothing to
  /// resume or the number carries a dial code the picker does not list — the
  /// default stays rather than showing a code the picker cannot render.
  void seedPhone(String? pendingMobile) {
    final parts = splitDialCode(pendingMobile);
    if (parts == null || parts.national.isEmpty) return;
    emit(state.copyWith(dialCode: parts.dialCode, phone: parts.national));
  }

  void updateField(PhoneVerificationField field, String value) {
    switch (field) {
      case PhoneVerificationField.dialCode:
        emit(state.copyWith(dialCode: value, error: null));
      case PhoneVerificationField.phone:
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
