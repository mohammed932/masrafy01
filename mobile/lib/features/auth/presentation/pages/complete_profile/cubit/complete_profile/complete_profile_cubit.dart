import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import '../../../../../../../core/enums/request_state.dart';
import '../../../../../../../core/result/failure.dart';
import '../../../../../data/models/request/profile/profile_completion_request.dart';
import '../../../../../domain/entities/otp_challenge_entity.dart';
import '../../../../../domain/repositories/customer_auth_repository.dart';

part 'complete_profile_cubit.freezed.dart';
part 'complete_profile_state.dart';

@injectable
class CompleteProfileCubit extends Cubit<CompleteProfileState> {
  CompleteProfileCubit(this._repo) : super(const CompleteProfileState());

  final CustomerAuthRepository _repo;

  void updateField(CompleteProfileField field, Object value) {
    switch (field) {
      case CompleteProfileField.phone:
        emit(state.copyWith(phone: value as String));
        break;
      case CompleteProfileField.otpCode:
        emit(state.copyWith(otpCode: value as String));
        break;
    }
  }

  Future<void> requestOtp() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: CompleteProfileStep.requestingOtp,
      error: null,
    ));
    final res = await _repo.profileMobileRequestOtp(
      ProfileMobileRequestOtpRequest(phone: state.phone),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (ch) => emit(state.copyWith(
        status: RequestState.loaded,
        step: CompleteProfileStep.otpSent,
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
      step: CompleteProfileStep.verifyingOtp,
      error: null,
    ));
    final res = await _repo.profileMobileVerifyOtp(
      ProfileMobileVerifyOtpRequest(
        otpId: state.challenge!.otpId,
        code: state.otpCode,
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (_) => emit(state.copyWith(
        status: RequestState.loaded,
        step: CompleteProfileStep.mobileBound,
        error: null,
      )),
    );
  }

  void reset() => emit(const CompleteProfileState());
}
