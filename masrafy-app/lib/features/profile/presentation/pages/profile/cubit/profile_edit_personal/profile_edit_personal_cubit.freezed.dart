// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'profile_edit_personal_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ProfileEditPersonalState {
  String get firstName => throw _privateConstructorUsedError;
  String get lastName => throw _privateConstructorUsedError;
  DateTime? get birthday => throw _privateConstructorUsedError;
  String? get photoUrl => throw _privateConstructorUsedError;
  Uint8List? get photoBytes => throw _privateConstructorUsedError;
  bool get photoUploading => throw _privateConstructorUsedError;
  Failure? get photoError => throw _privateConstructorUsedError;
  bool get frontUploaded => throw _privateConstructorUsedError;
  bool get backUploaded => throw _privateConstructorUsedError;
  bool get frontUploading => throw _privateConstructorUsedError;
  bool get backUploading => throw _privateConstructorUsedError;

  /// Whether the server has actually been asked yet. Without this, a failed
  /// or in-flight status read is indistinguishable from a confirmed "nothing
  /// uploaded", and the tiles state something the app does not know.
  RequestState get docsStatus => throw _privateConstructorUsedError;

  /// Presigned previews from the last status read, and the bytes of a side
  /// captured in THIS session. Bytes win: they are the picture the user just
  /// took, and they render with no round-trip.
  String? get frontUrl => throw _privateConstructorUsedError;
  String? get backUrl => throw _privateConstructorUsedError;
  Uint8List? get frontBytes => throw _privateConstructorUsedError;
  Uint8List? get backBytes => throw _privateConstructorUsedError;
  Failure? get docError => throw _privateConstructorUsedError;
  bool get saving => throw _privateConstructorUsedError;
  Failure? get saveError => throw _privateConstructorUsedError;
  bool get saved => throw _privateConstructorUsedError;

  /// Create a copy of ProfileEditPersonalState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProfileEditPersonalStateCopyWith<ProfileEditPersonalState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProfileEditPersonalStateCopyWith<$Res> {
  factory $ProfileEditPersonalStateCopyWith(ProfileEditPersonalState value,
          $Res Function(ProfileEditPersonalState) then) =
      _$ProfileEditPersonalStateCopyWithImpl<$Res, ProfileEditPersonalState>;
  @useResult
  $Res call(
      {String firstName,
      String lastName,
      DateTime? birthday,
      String? photoUrl,
      Uint8List? photoBytes,
      bool photoUploading,
      Failure? photoError,
      bool frontUploaded,
      bool backUploaded,
      bool frontUploading,
      bool backUploading,
      RequestState docsStatus,
      String? frontUrl,
      String? backUrl,
      Uint8List? frontBytes,
      Uint8List? backBytes,
      Failure? docError,
      bool saving,
      Failure? saveError,
      bool saved});
}

/// @nodoc
class _$ProfileEditPersonalStateCopyWithImpl<$Res,
        $Val extends ProfileEditPersonalState>
    implements $ProfileEditPersonalStateCopyWith<$Res> {
  _$ProfileEditPersonalStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProfileEditPersonalState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = null,
    Object? lastName = null,
    Object? birthday = freezed,
    Object? photoUrl = freezed,
    Object? photoBytes = freezed,
    Object? photoUploading = null,
    Object? photoError = freezed,
    Object? frontUploaded = null,
    Object? backUploaded = null,
    Object? frontUploading = null,
    Object? backUploading = null,
    Object? docsStatus = null,
    Object? frontUrl = freezed,
    Object? backUrl = freezed,
    Object? frontBytes = freezed,
    Object? backBytes = freezed,
    Object? docError = freezed,
    Object? saving = null,
    Object? saveError = freezed,
    Object? saved = null,
  }) {
    return _then(_value.copyWith(
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      birthday: freezed == birthday
          ? _value.birthday
          : birthday // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      photoUrl: freezed == photoUrl
          ? _value.photoUrl
          : photoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      photoBytes: freezed == photoBytes
          ? _value.photoBytes
          : photoBytes // ignore: cast_nullable_to_non_nullable
              as Uint8List?,
      photoUploading: null == photoUploading
          ? _value.photoUploading
          : photoUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      photoError: freezed == photoError
          ? _value.photoError
          : photoError // ignore: cast_nullable_to_non_nullable
              as Failure?,
      frontUploaded: null == frontUploaded
          ? _value.frontUploaded
          : frontUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      backUploaded: null == backUploaded
          ? _value.backUploaded
          : backUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      frontUploading: null == frontUploading
          ? _value.frontUploading
          : frontUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      backUploading: null == backUploading
          ? _value.backUploading
          : backUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      docsStatus: null == docsStatus
          ? _value.docsStatus
          : docsStatus // ignore: cast_nullable_to_non_nullable
              as RequestState,
      frontUrl: freezed == frontUrl
          ? _value.frontUrl
          : frontUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      backUrl: freezed == backUrl
          ? _value.backUrl
          : backUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      frontBytes: freezed == frontBytes
          ? _value.frontBytes
          : frontBytes // ignore: cast_nullable_to_non_nullable
              as Uint8List?,
      backBytes: freezed == backBytes
          ? _value.backBytes
          : backBytes // ignore: cast_nullable_to_non_nullable
              as Uint8List?,
      docError: freezed == docError
          ? _value.docError
          : docError // ignore: cast_nullable_to_non_nullable
              as Failure?,
      saving: null == saving
          ? _value.saving
          : saving // ignore: cast_nullable_to_non_nullable
              as bool,
      saveError: freezed == saveError
          ? _value.saveError
          : saveError // ignore: cast_nullable_to_non_nullable
              as Failure?,
      saved: null == saved
          ? _value.saved
          : saved // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProfileEditPersonalStateImplCopyWith<$Res>
    implements $ProfileEditPersonalStateCopyWith<$Res> {
  factory _$$ProfileEditPersonalStateImplCopyWith(
          _$ProfileEditPersonalStateImpl value,
          $Res Function(_$ProfileEditPersonalStateImpl) then) =
      __$$ProfileEditPersonalStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String firstName,
      String lastName,
      DateTime? birthday,
      String? photoUrl,
      Uint8List? photoBytes,
      bool photoUploading,
      Failure? photoError,
      bool frontUploaded,
      bool backUploaded,
      bool frontUploading,
      bool backUploading,
      RequestState docsStatus,
      String? frontUrl,
      String? backUrl,
      Uint8List? frontBytes,
      Uint8List? backBytes,
      Failure? docError,
      bool saving,
      Failure? saveError,
      bool saved});
}

/// @nodoc
class __$$ProfileEditPersonalStateImplCopyWithImpl<$Res>
    extends _$ProfileEditPersonalStateCopyWithImpl<$Res,
        _$ProfileEditPersonalStateImpl>
    implements _$$ProfileEditPersonalStateImplCopyWith<$Res> {
  __$$ProfileEditPersonalStateImplCopyWithImpl(
      _$ProfileEditPersonalStateImpl _value,
      $Res Function(_$ProfileEditPersonalStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProfileEditPersonalState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = null,
    Object? lastName = null,
    Object? birthday = freezed,
    Object? photoUrl = freezed,
    Object? photoBytes = freezed,
    Object? photoUploading = null,
    Object? photoError = freezed,
    Object? frontUploaded = null,
    Object? backUploaded = null,
    Object? frontUploading = null,
    Object? backUploading = null,
    Object? docsStatus = null,
    Object? frontUrl = freezed,
    Object? backUrl = freezed,
    Object? frontBytes = freezed,
    Object? backBytes = freezed,
    Object? docError = freezed,
    Object? saving = null,
    Object? saveError = freezed,
    Object? saved = null,
  }) {
    return _then(_$ProfileEditPersonalStateImpl(
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      birthday: freezed == birthday
          ? _value.birthday
          : birthday // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      photoUrl: freezed == photoUrl
          ? _value.photoUrl
          : photoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      photoBytes: freezed == photoBytes
          ? _value.photoBytes
          : photoBytes // ignore: cast_nullable_to_non_nullable
              as Uint8List?,
      photoUploading: null == photoUploading
          ? _value.photoUploading
          : photoUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      photoError: freezed == photoError
          ? _value.photoError
          : photoError // ignore: cast_nullable_to_non_nullable
              as Failure?,
      frontUploaded: null == frontUploaded
          ? _value.frontUploaded
          : frontUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      backUploaded: null == backUploaded
          ? _value.backUploaded
          : backUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      frontUploading: null == frontUploading
          ? _value.frontUploading
          : frontUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      backUploading: null == backUploading
          ? _value.backUploading
          : backUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      docsStatus: null == docsStatus
          ? _value.docsStatus
          : docsStatus // ignore: cast_nullable_to_non_nullable
              as RequestState,
      frontUrl: freezed == frontUrl
          ? _value.frontUrl
          : frontUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      backUrl: freezed == backUrl
          ? _value.backUrl
          : backUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      frontBytes: freezed == frontBytes
          ? _value.frontBytes
          : frontBytes // ignore: cast_nullable_to_non_nullable
              as Uint8List?,
      backBytes: freezed == backBytes
          ? _value.backBytes
          : backBytes // ignore: cast_nullable_to_non_nullable
              as Uint8List?,
      docError: freezed == docError
          ? _value.docError
          : docError // ignore: cast_nullable_to_non_nullable
              as Failure?,
      saving: null == saving
          ? _value.saving
          : saving // ignore: cast_nullable_to_non_nullable
              as bool,
      saveError: freezed == saveError
          ? _value.saveError
          : saveError // ignore: cast_nullable_to_non_nullable
              as Failure?,
      saved: null == saved
          ? _value.saved
          : saved // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$ProfileEditPersonalStateImpl extends _ProfileEditPersonalState {
  const _$ProfileEditPersonalStateImpl(
      {this.firstName = '',
      this.lastName = '',
      this.birthday,
      this.photoUrl,
      this.photoBytes,
      this.photoUploading = false,
      this.photoError,
      this.frontUploaded = false,
      this.backUploaded = false,
      this.frontUploading = false,
      this.backUploading = false,
      this.docsStatus = RequestState.initial,
      this.frontUrl,
      this.backUrl,
      this.frontBytes,
      this.backBytes,
      this.docError,
      this.saving = false,
      this.saveError,
      this.saved = false})
      : super._();

  @override
  @JsonKey()
  final String firstName;
  @override
  @JsonKey()
  final String lastName;
  @override
  final DateTime? birthday;
  @override
  final String? photoUrl;
  @override
  final Uint8List? photoBytes;
  @override
  @JsonKey()
  final bool photoUploading;
  @override
  final Failure? photoError;
  @override
  @JsonKey()
  final bool frontUploaded;
  @override
  @JsonKey()
  final bool backUploaded;
  @override
  @JsonKey()
  final bool frontUploading;
  @override
  @JsonKey()
  final bool backUploading;

  /// Whether the server has actually been asked yet. Without this, a failed
  /// or in-flight status read is indistinguishable from a confirmed "nothing
  /// uploaded", and the tiles state something the app does not know.
  @override
  @JsonKey()
  final RequestState docsStatus;

  /// Presigned previews from the last status read, and the bytes of a side
  /// captured in THIS session. Bytes win: they are the picture the user just
  /// took, and they render with no round-trip.
  @override
  final String? frontUrl;
  @override
  final String? backUrl;
  @override
  final Uint8List? frontBytes;
  @override
  final Uint8List? backBytes;
  @override
  final Failure? docError;
  @override
  @JsonKey()
  final bool saving;
  @override
  final Failure? saveError;
  @override
  @JsonKey()
  final bool saved;

  @override
  String toString() {
    return 'ProfileEditPersonalState(firstName: $firstName, lastName: $lastName, birthday: $birthday, photoUrl: $photoUrl, photoBytes: $photoBytes, photoUploading: $photoUploading, photoError: $photoError, frontUploaded: $frontUploaded, backUploaded: $backUploaded, frontUploading: $frontUploading, backUploading: $backUploading, docsStatus: $docsStatus, frontUrl: $frontUrl, backUrl: $backUrl, frontBytes: $frontBytes, backBytes: $backBytes, docError: $docError, saving: $saving, saveError: $saveError, saved: $saved)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProfileEditPersonalStateImpl &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.birthday, birthday) ||
                other.birthday == birthday) &&
            (identical(other.photoUrl, photoUrl) ||
                other.photoUrl == photoUrl) &&
            const DeepCollectionEquality()
                .equals(other.photoBytes, photoBytes) &&
            (identical(other.photoUploading, photoUploading) ||
                other.photoUploading == photoUploading) &&
            (identical(other.photoError, photoError) ||
                other.photoError == photoError) &&
            (identical(other.frontUploaded, frontUploaded) ||
                other.frontUploaded == frontUploaded) &&
            (identical(other.backUploaded, backUploaded) ||
                other.backUploaded == backUploaded) &&
            (identical(other.frontUploading, frontUploading) ||
                other.frontUploading == frontUploading) &&
            (identical(other.backUploading, backUploading) ||
                other.backUploading == backUploading) &&
            (identical(other.docsStatus, docsStatus) ||
                other.docsStatus == docsStatus) &&
            (identical(other.frontUrl, frontUrl) ||
                other.frontUrl == frontUrl) &&
            (identical(other.backUrl, backUrl) || other.backUrl == backUrl) &&
            const DeepCollectionEquality()
                .equals(other.frontBytes, frontBytes) &&
            const DeepCollectionEquality().equals(other.backBytes, backBytes) &&
            (identical(other.docError, docError) ||
                other.docError == docError) &&
            (identical(other.saving, saving) || other.saving == saving) &&
            (identical(other.saveError, saveError) ||
                other.saveError == saveError) &&
            (identical(other.saved, saved) || other.saved == saved));
  }

  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        firstName,
        lastName,
        birthday,
        photoUrl,
        const DeepCollectionEquality().hash(photoBytes),
        photoUploading,
        photoError,
        frontUploaded,
        backUploaded,
        frontUploading,
        backUploading,
        docsStatus,
        frontUrl,
        backUrl,
        const DeepCollectionEquality().hash(frontBytes),
        const DeepCollectionEquality().hash(backBytes),
        docError,
        saving,
        saveError,
        saved
      ]);

  /// Create a copy of ProfileEditPersonalState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProfileEditPersonalStateImplCopyWith<_$ProfileEditPersonalStateImpl>
      get copyWith => __$$ProfileEditPersonalStateImplCopyWithImpl<
          _$ProfileEditPersonalStateImpl>(this, _$identity);
}

abstract class _ProfileEditPersonalState extends ProfileEditPersonalState {
  const factory _ProfileEditPersonalState(
      {final String firstName,
      final String lastName,
      final DateTime? birthday,
      final String? photoUrl,
      final Uint8List? photoBytes,
      final bool photoUploading,
      final Failure? photoError,
      final bool frontUploaded,
      final bool backUploaded,
      final bool frontUploading,
      final bool backUploading,
      final RequestState docsStatus,
      final String? frontUrl,
      final String? backUrl,
      final Uint8List? frontBytes,
      final Uint8List? backBytes,
      final Failure? docError,
      final bool saving,
      final Failure? saveError,
      final bool saved}) = _$ProfileEditPersonalStateImpl;
  const _ProfileEditPersonalState._() : super._();

  @override
  String get firstName;
  @override
  String get lastName;
  @override
  DateTime? get birthday;
  @override
  String? get photoUrl;
  @override
  Uint8List? get photoBytes;
  @override
  bool get photoUploading;
  @override
  Failure? get photoError;
  @override
  bool get frontUploaded;
  @override
  bool get backUploaded;
  @override
  bool get frontUploading;
  @override
  bool get backUploading;

  /// Whether the server has actually been asked yet. Without this, a failed
  /// or in-flight status read is indistinguishable from a confirmed "nothing
  /// uploaded", and the tiles state something the app does not know.
  @override
  RequestState get docsStatus;

  /// Presigned previews from the last status read, and the bytes of a side
  /// captured in THIS session. Bytes win: they are the picture the user just
  /// took, and they render with no round-trip.
  @override
  String? get frontUrl;
  @override
  String? get backUrl;
  @override
  Uint8List? get frontBytes;
  @override
  Uint8List? get backBytes;
  @override
  Failure? get docError;
  @override
  bool get saving;
  @override
  Failure? get saveError;
  @override
  bool get saved;

  /// Create a copy of ProfileEditPersonalState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProfileEditPersonalStateImplCopyWith<_$ProfileEditPersonalStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
