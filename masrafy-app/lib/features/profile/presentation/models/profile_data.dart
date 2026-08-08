import 'dart:typed_data';

import 'package:freezed_annotation/freezed_annotation.dart';

part 'profile_data.freezed.dart';

/// Full customer profile shown on the Profile view (Figma `4028:4449`).
///
/// UI-only mock "for now" — there is no mobile profile-read/update endpoint
/// yet, so this is seeded with [ProfileData.mock] and mutated locally by the
/// two edit screens. National ID is a masked display string (the document is
/// captured via the uploader, not typed). Age is never stored — it is derived
/// from [birthday] (Principle XXXVII / A31).
@freezed
class ProfileData with _$ProfileData {
  const factory ProfileData({
    required String firstName,
    required String lastName,
    required DateTime lastPasswordChange,
    required DateTime birthday,
    required String nationalId,
    String? photoUrl,
    Uint8List? photoBytes,
    required String dialCode,
    required String phone,
    required String email,
    String? governorate,
    required String city,
    required String address,
  }) = _ProfileData;

  const ProfileData._();

  String get fullName => '$firstName $lastName'.trim();

  /// Whole months since the password was last changed (for the masked
  /// "Last changed N months ago" row).
  int get passwordChangedMonthsAgo {
    final days = DateTime.now().difference(lastPasswordChange).inDays;
    return days < 30 ? 0 : days ~/ 30;
  }

  /// Slice consumed by the Edit Personal Info screen.
  ///
  /// National-ID flags are deliberately NOT seeded here. They used to be
  /// hardcoded `true` (a leftover from when this whole screen was a mock), so
  /// both tiles painted a green "Uploaded" tick the instant the screen opened
  /// — for every customer, including ones with no documents at all. The server
  /// is the only thing that knows, so the screen starts at `false` and
  /// `loadDocumentsStatus()` fills it in.
  ProfilePersonalDraft toPersonalDraft() => ProfilePersonalDraft(
        firstName: firstName,
        lastName: lastName,
        birthday: birthday,
        photoUrl: photoUrl,
      );

  /// Slice consumed by the Edit Contact Details screen.
  ProfileContactDraft toContactDraft() => ProfileContactDraft(
        dialCode: dialCode,
        phone: phone,
        email: email,
        governorate: governorate,
        city: city,
        address: address,
      );

  /// Seed values mirroring the Figma profile mock.
  factory ProfileData.mock() => ProfileData(
        firstName: 'David',
        lastName: 'Iskandar',
        lastPasswordChange: DateTime.now().subtract(const Duration(days: 92)),
        birthday: DateTime(1992, 3, 15),
        nationalId: '29203150XXXXXXX',
        photoUrl: null,
        dialCode: '+20',
        phone: '1012345678',
        email: 'ahmed@example.com',
        governorate: 'cairo',
        city: 'Cairo',
        address: '12 Tahrir St',
      );
}

/// Personal-info edit result (returned from the Edit Personal screen to the
/// Profile view via the route result). Password is changed on its own
/// dedicated screen, not here.
@freezed
class ProfilePersonalDraft with _$ProfilePersonalDraft {
  const factory ProfilePersonalDraft({
    required String firstName,
    required String lastName,
    required DateTime birthday,
    String? photoUrl,
    Uint8List? photoBytes,
    @Default(false) bool frontUploaded,
    @Default(false) bool backUploaded,
  }) = _ProfilePersonalDraft;
}

/// Contact-details edit result returned to the Profile view.
@freezed
class ProfileContactDraft with _$ProfileContactDraft {
  const factory ProfileContactDraft({
    required String dialCode,
    required String phone,
    required String email,
    String? governorate,
    required String city,
    required String address,
  }) = _ProfileContactDraft;
}
