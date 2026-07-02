// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'complete_profile_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$CompleteProfileState {
  String get firstName => throw _privateConstructorUsedError;
  String get lastName => throw _privateConstructorUsedError;
  DateTime? get birthday => throw _privateConstructorUsedError;
  String get email => throw _privateConstructorUsedError;
  String get password => throw _privateConstructorUsedError;
  bool get obscure => throw _privateConstructorUsedError;
  RegistrationPath get registrationPath => throw _privateConstructorUsedError;
  bool get hasPassword => throw _privateConstructorUsedError;
  Uint8List? get photoBytes => throw _privateConstructorUsedError;
  bool get photoUploaded => throw _privateConstructorUsedError;
  bool get photoUploading => throw _privateConstructorUsedError;
  bool get idFrontUploaded => throw _privateConstructorUsedError;
  bool get idFrontUploading => throw _privateConstructorUsedError;
  bool get idBackUploaded => throw _privateConstructorUsedError;
  bool get idBackUploading => throw _privateConstructorUsedError;
  RequestState get loadStatus => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;
  CustomerSessionEntity? get session => throw _privateConstructorUsedError;

  /// Create a copy of CompleteProfileState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CompleteProfileStateCopyWith<CompleteProfileState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CompleteProfileStateCopyWith<$Res> {
  factory $CompleteProfileStateCopyWith(CompleteProfileState value,
          $Res Function(CompleteProfileState) then) =
      _$CompleteProfileStateCopyWithImpl<$Res, CompleteProfileState>;
  @useResult
  $Res call(
      {String firstName,
      String lastName,
      DateTime? birthday,
      String email,
      String password,
      bool obscure,
      RegistrationPath registrationPath,
      bool hasPassword,
      Uint8List? photoBytes,
      bool photoUploaded,
      bool photoUploading,
      bool idFrontUploaded,
      bool idFrontUploading,
      bool idBackUploaded,
      bool idBackUploading,
      RequestState loadStatus,
      RequestState status,
      Failure? error,
      CustomerSessionEntity? session});
}

/// @nodoc
class _$CompleteProfileStateCopyWithImpl<$Res,
        $Val extends CompleteProfileState>
    implements $CompleteProfileStateCopyWith<$Res> {
  _$CompleteProfileStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CompleteProfileState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = null,
    Object? lastName = null,
    Object? birthday = freezed,
    Object? email = null,
    Object? password = null,
    Object? obscure = null,
    Object? registrationPath = null,
    Object? hasPassword = null,
    Object? photoBytes = freezed,
    Object? photoUploaded = null,
    Object? photoUploading = null,
    Object? idFrontUploaded = null,
    Object? idFrontUploading = null,
    Object? idBackUploaded = null,
    Object? idBackUploading = null,
    Object? loadStatus = null,
    Object? status = null,
    Object? error = freezed,
    Object? session = freezed,
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
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      obscure: null == obscure
          ? _value.obscure
          : obscure // ignore: cast_nullable_to_non_nullable
              as bool,
      registrationPath: null == registrationPath
          ? _value.registrationPath
          : registrationPath // ignore: cast_nullable_to_non_nullable
              as RegistrationPath,
      hasPassword: null == hasPassword
          ? _value.hasPassword
          : hasPassword // ignore: cast_nullable_to_non_nullable
              as bool,
      photoBytes: freezed == photoBytes
          ? _value.photoBytes
          : photoBytes // ignore: cast_nullable_to_non_nullable
              as Uint8List?,
      photoUploaded: null == photoUploaded
          ? _value.photoUploaded
          : photoUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      photoUploading: null == photoUploading
          ? _value.photoUploading
          : photoUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      idFrontUploaded: null == idFrontUploaded
          ? _value.idFrontUploaded
          : idFrontUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      idFrontUploading: null == idFrontUploading
          ? _value.idFrontUploading
          : idFrontUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      idBackUploaded: null == idBackUploaded
          ? _value.idBackUploaded
          : idBackUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      idBackUploading: null == idBackUploading
          ? _value.idBackUploading
          : idBackUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      loadStatus: null == loadStatus
          ? _value.loadStatus
          : loadStatus // ignore: cast_nullable_to_non_nullable
              as RequestState,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
      session: freezed == session
          ? _value.session
          : session // ignore: cast_nullable_to_non_nullable
              as CustomerSessionEntity?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CompleteProfileStateImplCopyWith<$Res>
    implements $CompleteProfileStateCopyWith<$Res> {
  factory _$$CompleteProfileStateImplCopyWith(_$CompleteProfileStateImpl value,
          $Res Function(_$CompleteProfileStateImpl) then) =
      __$$CompleteProfileStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String firstName,
      String lastName,
      DateTime? birthday,
      String email,
      String password,
      bool obscure,
      RegistrationPath registrationPath,
      bool hasPassword,
      Uint8List? photoBytes,
      bool photoUploaded,
      bool photoUploading,
      bool idFrontUploaded,
      bool idFrontUploading,
      bool idBackUploaded,
      bool idBackUploading,
      RequestState loadStatus,
      RequestState status,
      Failure? error,
      CustomerSessionEntity? session});
}

/// @nodoc
class __$$CompleteProfileStateImplCopyWithImpl<$Res>
    extends _$CompleteProfileStateCopyWithImpl<$Res, _$CompleteProfileStateImpl>
    implements _$$CompleteProfileStateImplCopyWith<$Res> {
  __$$CompleteProfileStateImplCopyWithImpl(_$CompleteProfileStateImpl _value,
      $Res Function(_$CompleteProfileStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of CompleteProfileState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = null,
    Object? lastName = null,
    Object? birthday = freezed,
    Object? email = null,
    Object? password = null,
    Object? obscure = null,
    Object? registrationPath = null,
    Object? hasPassword = null,
    Object? photoBytes = freezed,
    Object? photoUploaded = null,
    Object? photoUploading = null,
    Object? idFrontUploaded = null,
    Object? idFrontUploading = null,
    Object? idBackUploaded = null,
    Object? idBackUploading = null,
    Object? loadStatus = null,
    Object? status = null,
    Object? error = freezed,
    Object? session = freezed,
  }) {
    return _then(_$CompleteProfileStateImpl(
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
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      obscure: null == obscure
          ? _value.obscure
          : obscure // ignore: cast_nullable_to_non_nullable
              as bool,
      registrationPath: null == registrationPath
          ? _value.registrationPath
          : registrationPath // ignore: cast_nullable_to_non_nullable
              as RegistrationPath,
      hasPassword: null == hasPassword
          ? _value.hasPassword
          : hasPassword // ignore: cast_nullable_to_non_nullable
              as bool,
      photoBytes: freezed == photoBytes
          ? _value.photoBytes
          : photoBytes // ignore: cast_nullable_to_non_nullable
              as Uint8List?,
      photoUploaded: null == photoUploaded
          ? _value.photoUploaded
          : photoUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      photoUploading: null == photoUploading
          ? _value.photoUploading
          : photoUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      idFrontUploaded: null == idFrontUploaded
          ? _value.idFrontUploaded
          : idFrontUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      idFrontUploading: null == idFrontUploading
          ? _value.idFrontUploading
          : idFrontUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      idBackUploaded: null == idBackUploaded
          ? _value.idBackUploaded
          : idBackUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      idBackUploading: null == idBackUploading
          ? _value.idBackUploading
          : idBackUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      loadStatus: null == loadStatus
          ? _value.loadStatus
          : loadStatus // ignore: cast_nullable_to_non_nullable
              as RequestState,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
      session: freezed == session
          ? _value.session
          : session // ignore: cast_nullable_to_non_nullable
              as CustomerSessionEntity?,
    ));
  }
}

/// @nodoc

class _$CompleteProfileStateImpl extends _CompleteProfileState {
  const _$CompleteProfileStateImpl(
      {this.firstName = '',
      this.lastName = '',
      this.birthday,
      this.email = '',
      this.password = '',
      this.obscure = true,
      this.registrationPath = RegistrationPath.phone,
      this.hasPassword = false,
      this.photoBytes,
      this.photoUploaded = false,
      this.photoUploading = false,
      this.idFrontUploaded = false,
      this.idFrontUploading = false,
      this.idBackUploaded = false,
      this.idBackUploading = false,
      this.loadStatus = RequestState.initial,
      this.status = RequestState.initial,
      this.error,
      this.session})
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
  @JsonKey()
  final String email;
  @override
  @JsonKey()
  final String password;
  @override
  @JsonKey()
  final bool obscure;
  @override
  @JsonKey()
  final RegistrationPath registrationPath;
  @override
  @JsonKey()
  final bool hasPassword;
  @override
  final Uint8List? photoBytes;
  @override
  @JsonKey()
  final bool photoUploaded;
  @override
  @JsonKey()
  final bool photoUploading;
  @override
  @JsonKey()
  final bool idFrontUploaded;
  @override
  @JsonKey()
  final bool idFrontUploading;
  @override
  @JsonKey()
  final bool idBackUploaded;
  @override
  @JsonKey()
  final bool idBackUploading;
  @override
  @JsonKey()
  final RequestState loadStatus;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final Failure? error;
  @override
  final CustomerSessionEntity? session;

  @override
  String toString() {
    return 'CompleteProfileState(firstName: $firstName, lastName: $lastName, birthday: $birthday, email: $email, password: $password, obscure: $obscure, registrationPath: $registrationPath, hasPassword: $hasPassword, photoBytes: $photoBytes, photoUploaded: $photoUploaded, photoUploading: $photoUploading, idFrontUploaded: $idFrontUploaded, idFrontUploading: $idFrontUploading, idBackUploaded: $idBackUploaded, idBackUploading: $idBackUploading, loadStatus: $loadStatus, status: $status, error: $error, session: $session)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CompleteProfileStateImpl &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.birthday, birthday) ||
                other.birthday == birthday) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.password, password) ||
                other.password == password) &&
            (identical(other.obscure, obscure) || other.obscure == obscure) &&
            (identical(other.registrationPath, registrationPath) ||
                other.registrationPath == registrationPath) &&
            (identical(other.hasPassword, hasPassword) ||
                other.hasPassword == hasPassword) &&
            const DeepCollectionEquality()
                .equals(other.photoBytes, photoBytes) &&
            (identical(other.photoUploaded, photoUploaded) ||
                other.photoUploaded == photoUploaded) &&
            (identical(other.photoUploading, photoUploading) ||
                other.photoUploading == photoUploading) &&
            (identical(other.idFrontUploaded, idFrontUploaded) ||
                other.idFrontUploaded == idFrontUploaded) &&
            (identical(other.idFrontUploading, idFrontUploading) ||
                other.idFrontUploading == idFrontUploading) &&
            (identical(other.idBackUploaded, idBackUploaded) ||
                other.idBackUploaded == idBackUploaded) &&
            (identical(other.idBackUploading, idBackUploading) ||
                other.idBackUploading == idBackUploading) &&
            (identical(other.loadStatus, loadStatus) ||
                other.loadStatus == loadStatus) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error) &&
            (identical(other.session, session) || other.session == session));
  }

  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        firstName,
        lastName,
        birthday,
        email,
        password,
        obscure,
        registrationPath,
        hasPassword,
        const DeepCollectionEquality().hash(photoBytes),
        photoUploaded,
        photoUploading,
        idFrontUploaded,
        idFrontUploading,
        idBackUploaded,
        idBackUploading,
        loadStatus,
        status,
        error,
        session
      ]);

  /// Create a copy of CompleteProfileState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CompleteProfileStateImplCopyWith<_$CompleteProfileStateImpl>
      get copyWith =>
          __$$CompleteProfileStateImplCopyWithImpl<_$CompleteProfileStateImpl>(
              this, _$identity);
}

abstract class _CompleteProfileState extends CompleteProfileState {
  const factory _CompleteProfileState(
      {final String firstName,
      final String lastName,
      final DateTime? birthday,
      final String email,
      final String password,
      final bool obscure,
      final RegistrationPath registrationPath,
      final bool hasPassword,
      final Uint8List? photoBytes,
      final bool photoUploaded,
      final bool photoUploading,
      final bool idFrontUploaded,
      final bool idFrontUploading,
      final bool idBackUploaded,
      final bool idBackUploading,
      final RequestState loadStatus,
      final RequestState status,
      final Failure? error,
      final CustomerSessionEntity? session}) = _$CompleteProfileStateImpl;
  const _CompleteProfileState._() : super._();

  @override
  String get firstName;
  @override
  String get lastName;
  @override
  DateTime? get birthday;
  @override
  String get email;
  @override
  String get password;
  @override
  bool get obscure;
  @override
  RegistrationPath get registrationPath;
  @override
  bool get hasPassword;
  @override
  Uint8List? get photoBytes;
  @override
  bool get photoUploaded;
  @override
  bool get photoUploading;
  @override
  bool get idFrontUploaded;
  @override
  bool get idFrontUploading;
  @override
  bool get idBackUploaded;
  @override
  bool get idBackUploading;
  @override
  RequestState get loadStatus;
  @override
  RequestState get status;
  @override
  Failure? get error;
  @override
  CustomerSessionEntity? get session;

  /// Create a copy of CompleteProfileState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CompleteProfileStateImplCopyWith<_$CompleteProfileStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
