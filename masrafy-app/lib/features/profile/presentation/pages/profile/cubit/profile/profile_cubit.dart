import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/profile/domain/entities/customer_profile_entity.dart';
import 'package:app/features/profile/domain/usecases/profile_usecase.dart';
import 'package:app/features/profile/presentation/models/profile_data.dart';

part 'profile_cubit.freezed.dart';
part 'profile_state.dart';

/// Holds the currently-authenticated customer's profile (Figma `4028:4449`).
/// Loads from `GET /api/v1/auth/me` (shimmer while loading, Principle XXXIV)
/// and merges the two edit screens' returned drafts locally. Pure
/// orchestration; the display shape + derivations live on [ProfileData]
/// (Principle XXXI).
@injectable
class ProfileCubit extends Cubit<ProfileState> {
  ProfileCubit(this._useCase) : super(const ProfileState());

  final ProfileUseCase _useCase;

  Future<void> load() async {
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _useCase.getMe();
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (customer) => emit(state.copyWith(
        status: RequestState.loaded,
        data: _toProfileData(customer),
        error: null,
      )),
    );
  }

  /// Merge the Edit Personal Info result. A non-empty new password bumps the
  /// "last changed" timestamp (the password itself is never stored here).
  void applyPersonal(ProfilePersonalDraft d) {
    final current = state.data;
    if (current == null) return;
    emit(state.copyWith(
      data: current.copyWith(
        firstName: d.firstName,
        lastName: d.lastName,
        birthday: d.birthday,
        photoBytes: d.photoBytes ?? current.photoBytes,
      ),
    ));
  }

  /// Merge the Edit Contact Details result.
  void applyContact(ProfileContactDraft d) {
    final current = state.data;
    if (current == null) return;
    emit(state.copyWith(
      data: current.copyWith(
        dialCode: d.dialCode,
        phone: d.phone,
        email: d.email,
        governorate: d.governorate,
        city: d.city,
        address: d.address,
      ),
    ));
  }

  /// Maps the backend customer onto the screen's display model. Fields the
  /// backend has no source for (National ID number, address, password-changed
  /// date) are left blank — their rows are hidden on the Profile screen.
  static ProfileData _toProfileData(CustomerProfileEntity c) {
    final phone = _splitPhone(c.phone);
    return ProfileData(
      firstName: c.firstName,
      lastName: c.lastName,
      lastPasswordChange: DateTime.now(),
      // Profile is only reachable once complete (Principle XXXVII), so birthday
      // is always set; the fallback is a defensive guard only.
      birthday: c.birthday ?? DateTime(2000, 1, 1),
      nationalId: '',
      photoUrl: c.photoUrl,
      dialCode: phone.$1,
      phone: phone.$2,
      email: c.email ?? '',
      governorate: (c.governorate != null && c.governorate!.isNotEmpty)
          ? c.governorate
          : null,
      city: c.city ?? '',
      address: c.address ?? '',
    );
  }

  /// Splits a stored phone (`+201012345678`) into (`+20`, `1012345678`).
  /// Falls back to `+20` when no country code prefix is present.
  static (String, String) _splitPhone(String phone) {
    final p = phone.trim();
    if (p.startsWith('+20')) return ('+20', p.substring(3));
    if (p.startsWith('+')) {
      final cut = p.length >= 3 ? 3 : p.length;
      return (p.substring(0, cut), p.substring(cut));
    }
    return ('+20', p);
  }
}
