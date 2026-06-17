import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/utils/validators.dart';
import 'package:app/features/profile/presentation/models/profile_data.dart';

part 'profile_edit_contact_cubit.freezed.dart';
part 'profile_edit_contact_state.dart';

/// Scalar fields editable on the Edit Contact Details screen.
enum ProfileEditContactField { dialCode, phone, email, governorate, city, address }

/// Drives the Edit Contact Details form (Figma `4028:4690`). Seeded once from
/// the route's [ProfileContactDraft]; on save the page pops [toDraft]. Pure
/// orchestration — `canSave` + draft mapping live on the state (Principle XXXI).
@injectable
class ProfileEditContactCubit extends Cubit<ProfileEditContactState> {
  ProfileEditContactCubit() : super(const ProfileEditContactState());

  /// Seed from the current profile slice (called once in the page's provider).
  void seed(ProfileContactDraft d) => emit(state.copyWith(
        dialCode: d.dialCode,
        phone: d.phone,
        email: d.email,
        governorate: d.governorate,
        city: d.city,
        address: d.address,
      ));

  /// Field edits. Exhaustive over [ProfileEditContactField] — no `default:`.
  void updateField(ProfileEditContactField field, Object value) {
    switch (field) {
      case ProfileEditContactField.dialCode:
        emit(state.copyWith(dialCode: value as String));
      case ProfileEditContactField.phone:
        emit(state.copyWith(phone: value as String));
      case ProfileEditContactField.email:
        emit(state.copyWith(email: value as String));
      case ProfileEditContactField.governorate:
        emit(state.copyWith(governorate: value as String));
      case ProfileEditContactField.city:
        emit(state.copyWith(city: value as String));
      case ProfileEditContactField.address:
        emit(state.copyWith(address: value as String));
    }
  }
}
