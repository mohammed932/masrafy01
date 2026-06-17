import 'package:bloc/bloc.dart';
import 'package:injectable/injectable.dart';

import 'package:app/features/profile/presentation/models/profile_data.dart';

/// Holds the customer's profile (Figma `4028:4449`). UI-only mock for now —
/// seeded with [ProfileData.mock] and merged locally from the two edit screens'
/// returned drafts (no backend read/update endpoint yet, see plan). Pure
/// orchestration; the data shape + derivations live on [ProfileData]
/// (Principle XXXI). Synchronous mock ⇒ no shimmer (Principle XXXIV).
@injectable
class ProfileCubit extends Cubit<ProfileData> {
  ProfileCubit() : super(ProfileData.mock());

  /// Merge the Edit Personal Info result. A non-empty new password bumps the
  /// "last changed" timestamp (the password itself is never stored here).
  void applyPersonal(ProfilePersonalDraft d) => emit(state.copyWith(
        firstName: d.firstName,
        lastName: d.lastName,
        birthday: d.birthday,
        lastPasswordChange:
            d.newPassword.isEmpty ? state.lastPasswordChange : DateTime.now(),
      ));

  /// Merge the Edit Contact Details result.
  void applyContact(ProfileContactDraft d) => emit(state.copyWith(
        dialCode: d.dialCode,
        phone: d.phone,
        email: d.email,
        governorate: d.governorate,
        city: d.city,
        address: d.address,
      ));
}
