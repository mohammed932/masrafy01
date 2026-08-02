import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/features/platform_enumerations/domain/entities/platform_enumeration_entity.dart';
import 'package:app/core/features/platform_enumerations/domain/usecases/platform_enumerations_usecase.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/validators.dart';
import 'package:app/features/profile/data/models/request/update_profile_request.dart';
import 'package:app/features/profile/domain/usecases/profile_usecase.dart';
import 'package:app/features/profile/presentation/models/profile_data.dart';

part 'profile_edit_contact_cubit.freezed.dart';
part 'profile_edit_contact_state.dart';

/// Editable fields on the Edit Contact Details screen. Phone is read-only
/// (immutable for PHONE accounts) so it is NOT in this enum.
enum ProfileEditContactField { email, governorate, city, address }

/// Drives the Edit Contact Details form (Figma `4028:4690`). Seeded once from
/// the route's [ProfileContactDraft]; `save()` persists email/governorate/city/
/// address via `PATCH /auth/profile`, then the page pops [toDraft]. Pure
/// orchestration — `canSave` + draft mapping live on the state (Principle XXXI).
@injectable
class ProfileEditContactCubit extends Cubit<ProfileEditContactState> {
  ProfileEditContactCubit(this._profile, this._enums)
      : super(const ProfileEditContactState());

  final ProfileUseCase _profile;
  final PlatformEnumerationsUseCase _enums;

  /// Seed from the current profile slice (called once in the page's provider).
  void seed(ProfileContactDraft d) {
    emit(state.copyWith(
      dialCode: d.dialCode,
      phone: d.phone,
      email: d.email,
      governorate: d.governorate,
      city: d.city,
      address: d.address,
    ));
    unawaited(_loadGovernorates());
  }

  /// The backend rejects a governorate that is not a live registry key, so the
  /// picker must offer exactly what the registry holds. A failed load leaves the
  /// list empty — the field then shows no options rather than stale ones.
  Future<void> _loadGovernorates() async {
    final res = await _enums.byType(EnumerationTypes.governorate);
    res.fold(
      (_) {},
      (list) => emit(state.copyWith(governorates: list)),
    );
  }

  /// Field edits. Exhaustive over [ProfileEditContactField] — no `default:`.
  void updateField(ProfileEditContactField field, Object value) {
    switch (field) {
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

  /// Persists contact scalars via `PATCH /auth/profile` (partial update — phone
  /// never sent). Empty fields are omitted (sent as null) — the backend rejects
  /// blank optional scalars (`@Length(1,…)`), so blanks mean "leave unchanged"
  /// rather than triggering a 422. On success flips [saved] so the page pops.
  Future<void> save() async {
    if (!state.canSave) return;
    emit(state.copyWith(saving: true, saveError: null));
    final res = await _profile.updateProfile(
      UpdateProfileRequest(
        email: _nullIfBlank(state.email),
        governorate: _nullIfBlank(state.governorate),
        city: _nullIfBlank(state.city),
        address: _nullIfBlank(state.address),
      ),
    );
    res.fold(
      (err) => emit(state.copyWith(saving: false, saveError: err)),
      (_) => emit(state.copyWith(saving: false, saved: true)),
    );
  }

  static String? _nullIfBlank(String? v) {
    final t = v?.trim() ?? '';
    return t.isEmpty ? null : t;
  }
}
