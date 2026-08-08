import 'package:bloc/bloc.dart';
import 'package:flutter/widgets.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/features/id_capture/id_thumbnail.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/image_pick.dart';
import 'package:app/core/utils/validators.dart';
import 'package:app/features/auth/data/models/request/signup/signup_phone_start_request.dart';
import 'package:app/features/auth/domain/entities/otp_challenge_entity.dart';
import 'package:app/features/auth/domain/entities/signup_draft.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';

part 'signup_cubit.freezed.dart';
part 'signup_state.dart';

/// Create-Account screen (Figma `91:322`). Collects the full PHONE-signup form,
/// then on submit fires `signupPhoneStart` to issue the SMS OTP and hands the
/// challenge + [SignupDraft] to the OTP screen. Orchestration only — all
/// derivations live on [SignupState] (Principle XXXI).
@injectable
class SignupCubit extends Cubit<SignupState> {
  SignupCubit(this._auth) : super(const SignupState());

  final CustomerAuthUseCase _auth;

  void updateField(SignupField field, Object value) {
    switch (field) {
      case SignupField.firstName:
        emit(state.copyWith(firstName: value as String, error: null));
      case SignupField.lastName:
        emit(state.copyWith(lastName: value as String, error: null));
      case SignupField.dialCode:
        emit(state.copyWith(dialCode: value as String, error: null));
      case SignupField.phone:
        emit(state.copyWith(phone: value as String, error: null));
      case SignupField.email:
        emit(state.copyWith(email: value as String, error: null));
      case SignupField.birthday:
        emit(state.copyWith(birthday: value as DateTime, error: null));
      case SignupField.password:
        emit(state.copyWith(password: value as String, error: null));
      case SignupField.confirmPassword:
        emit(state.copyWith(confirmPassword: value as String, error: null));
      case SignupField.terms:
        emit(state.copyWith(agreedToTerms: value as bool, error: null));
    }
  }

  /// Keeps a National-ID side captured on this screen. Nothing is uploaded
  /// here: the upload endpoints are customer-scoped and no customer exists
  /// until the OTP is verified, so the bytes travel in the draft and the OTP
  /// cubit sends them the moment the session is issued. Kept off
  /// [updateField] so the cubit takes a typed [PickedImage] instead of casting
  /// an `Object`.
  void setNationalId({required bool front, required PickedImage image}) =>
      emit(front
          ? state.copyWith(idFront: image, error: null)
          : state.copyWith(idBack: image, error: null));

  void toggleObscure() => emit(state.copyWith(obscure: !state.obscure));

  void toggleObscureConfirm() =>
      emit(state.copyWith(obscureConfirm: !state.obscureConfirm));

  /// Requests the SMS OTP for the entered mobile. [locale] is the active app
  /// language code (`'ar'` / `'en'`) for the SMS template.
  Future<void> submit(String locale) async {
    if (!state.canSubmit) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _auth.signupPhoneStart(
      SignupPhoneStartRequest(phone: state.fullPhone, locale: locale),
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
