import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/features/profile/presentation/models/profile_data.dart';

part 'profile_edit_personal_cubit.freezed.dart';
part 'profile_edit_personal_state.dart';

/// Scalar fields editable on the Edit Personal Info screen.
enum ProfileEditPersonalField { firstName, lastName, password }

/// Drives the Edit Personal Info form (Figma `4028:4573`). Seeded once from the
/// route's [ProfilePersonalDraft]; on save the page pops [toDraft]. Pure
/// orchestration — `canSave` + draft mapping live on the state (Principle XXXI).
@injectable
class ProfileEditPersonalCubit extends Cubit<ProfileEditPersonalState> {
  ProfileEditPersonalCubit() : super(const ProfileEditPersonalState());

  /// Seed from the current profile slice (called once in the page's provider).
  void seed(ProfilePersonalDraft d) => emit(state.copyWith(
        firstName: d.firstName,
        lastName: d.lastName,
        birthday: d.birthday,
        frontUploaded: d.frontUploaded,
        backUploaded: d.backUploaded,
      ));

  /// Text-field edits. Exhaustive over [ProfileEditPersonalField] — no
  /// `default:` (the cast target is explicit per case).
  void updateField(ProfileEditPersonalField field, Object value) {
    switch (field) {
      case ProfileEditPersonalField.firstName:
        emit(state.copyWith(firstName: value as String));
      case ProfileEditPersonalField.lastName:
        emit(state.copyWith(lastName: value as String));
      case ProfileEditPersonalField.password:
        emit(state.copyWith(password: value as String));
    }
  }

  /// Birthday pick — kept off [updateField] so the cubit takes a typed
  /// `DateTime` rather than casting an `Object`.
  void setBirthday(DateTime value) => emit(state.copyWith(birthday: value));

  void toggleObscure() =>
      emit(state.copyWith(obscurePassword: !state.obscurePassword));

  void markFront() => emit(state.copyWith(frontUploaded: true));
  void markBack() => emit(state.copyWith(backUploaded: true));
}
