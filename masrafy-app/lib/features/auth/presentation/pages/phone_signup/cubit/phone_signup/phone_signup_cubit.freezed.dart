// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'phone_signup_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$PhoneSignupState {
// Form fields
  String get phone => throw _privateConstructorUsedError;
  String get otpCode => throw _privateConstructorUsedError;
  String get locale => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get email => throw _privateConstructorUsedError;
  String get password => throw _privateConstructorUsedError;
  int? get age => throw _privateConstructorUsedError; // Flow tracking
  PhoneSignupStep get step => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  OtpChallengeEntity? get challenge => throw _privateConstructorUsedError;
  String? get verifiedMobileToken => throw _privateConstructorUsedError;
  String? get verifiedPhone => throw _privateConstructorUsedError;
  CustomerSessionEntity? get session => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of PhoneSignupState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PhoneSignupStateCopyWith<PhoneSignupState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PhoneSignupStateCopyWith<$Res> {
  factory $PhoneSignupStateCopyWith(
          PhoneSignupState value, $Res Function(PhoneSignupState) then) =
      _$PhoneSignupStateCopyWithImpl<$Res, PhoneSignupState>;
  @useResult
  $Res call(
      {String phone,
      String otpCode,
      String locale,
      String name,
      String email,
      String password,
      int? age,
      PhoneSignupStep step,
      RequestState status,
      OtpChallengeEntity? challenge,
      String? verifiedMobileToken,
      String? verifiedPhone,
      CustomerSessionEntity? session,
      Failure? error});
}

/// @nodoc
class _$PhoneSignupStateCopyWithImpl<$Res, $Val extends PhoneSignupState>
    implements $PhoneSignupStateCopyWith<$Res> {
  _$PhoneSignupStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PhoneSignupState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? phone = null,
    Object? otpCode = null,
    Object? locale = null,
    Object? name = null,
    Object? email = null,
    Object? password = null,
    Object? age = freezed,
    Object? step = null,
    Object? status = null,
    Object? challenge = freezed,
    Object? verifiedMobileToken = freezed,
    Object? verifiedPhone = freezed,
    Object? session = freezed,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
      otpCode: null == otpCode
          ? _value.otpCode
          : otpCode // ignore: cast_nullable_to_non_nullable
              as String,
      locale: null == locale
          ? _value.locale
          : locale // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      age: freezed == age
          ? _value.age
          : age // ignore: cast_nullable_to_non_nullable
              as int?,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as PhoneSignupStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      verifiedMobileToken: freezed == verifiedMobileToken
          ? _value.verifiedMobileToken
          : verifiedMobileToken // ignore: cast_nullable_to_non_nullable
              as String?,
      verifiedPhone: freezed == verifiedPhone
          ? _value.verifiedPhone
          : verifiedPhone // ignore: cast_nullable_to_non_nullable
              as String?,
      session: freezed == session
          ? _value.session
          : session // ignore: cast_nullable_to_non_nullable
              as CustomerSessionEntity?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PhoneSignupStateImplCopyWith<$Res>
    implements $PhoneSignupStateCopyWith<$Res> {
  factory _$$PhoneSignupStateImplCopyWith(_$PhoneSignupStateImpl value,
          $Res Function(_$PhoneSignupStateImpl) then) =
      __$$PhoneSignupStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String phone,
      String otpCode,
      String locale,
      String name,
      String email,
      String password,
      int? age,
      PhoneSignupStep step,
      RequestState status,
      OtpChallengeEntity? challenge,
      String? verifiedMobileToken,
      String? verifiedPhone,
      CustomerSessionEntity? session,
      Failure? error});
}

/// @nodoc
class __$$PhoneSignupStateImplCopyWithImpl<$Res>
    extends _$PhoneSignupStateCopyWithImpl<$Res, _$PhoneSignupStateImpl>
    implements _$$PhoneSignupStateImplCopyWith<$Res> {
  __$$PhoneSignupStateImplCopyWithImpl(_$PhoneSignupStateImpl _value,
      $Res Function(_$PhoneSignupStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of PhoneSignupState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? phone = null,
    Object? otpCode = null,
    Object? locale = null,
    Object? name = null,
    Object? email = null,
    Object? password = null,
    Object? age = freezed,
    Object? step = null,
    Object? status = null,
    Object? challenge = freezed,
    Object? verifiedMobileToken = freezed,
    Object? verifiedPhone = freezed,
    Object? session = freezed,
    Object? error = freezed,
  }) {
    return _then(_$PhoneSignupStateImpl(
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
      otpCode: null == otpCode
          ? _value.otpCode
          : otpCode // ignore: cast_nullable_to_non_nullable
              as String,
      locale: null == locale
          ? _value.locale
          : locale // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      age: freezed == age
          ? _value.age
          : age // ignore: cast_nullable_to_non_nullable
              as int?,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as PhoneSignupStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      verifiedMobileToken: freezed == verifiedMobileToken
          ? _value.verifiedMobileToken
          : verifiedMobileToken // ignore: cast_nullable_to_non_nullable
              as String?,
      verifiedPhone: freezed == verifiedPhone
          ? _value.verifiedPhone
          : verifiedPhone // ignore: cast_nullable_to_non_nullable
              as String?,
      session: freezed == session
          ? _value.session
          : session // ignore: cast_nullable_to_non_nullable
              as CustomerSessionEntity?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$PhoneSignupStateImpl extends _PhoneSignupState {
  const _$PhoneSignupStateImpl(
      {this.phone = '',
      this.otpCode = '',
      this.locale = 'en',
      this.name = '',
      this.email = '',
      this.password = '',
      this.age,
      this.step = PhoneSignupStep.idle,
      this.status = RequestState.initial,
      this.challenge,
      this.verifiedMobileToken,
      this.verifiedPhone,
      this.session,
      this.error})
      : super._();

// Form fields
  @override
  @JsonKey()
  final String phone;
  @override
  @JsonKey()
  final String otpCode;
  @override
  @JsonKey()
  final String locale;
  @override
  @JsonKey()
  final String name;
  @override
  @JsonKey()
  final String email;
  @override
  @JsonKey()
  final String password;
  @override
  final int? age;
// Flow tracking
  @override
  @JsonKey()
  final PhoneSignupStep step;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final OtpChallengeEntity? challenge;
  @override
  final String? verifiedMobileToken;
  @override
  final String? verifiedPhone;
  @override
  final CustomerSessionEntity? session;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'PhoneSignupState(phone: $phone, otpCode: $otpCode, locale: $locale, name: $name, email: $email, password: $password, age: $age, step: $step, status: $status, challenge: $challenge, verifiedMobileToken: $verifiedMobileToken, verifiedPhone: $verifiedPhone, session: $session, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PhoneSignupStateImpl &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.otpCode, otpCode) || other.otpCode == otpCode) &&
            (identical(other.locale, locale) || other.locale == locale) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.password, password) ||
                other.password == password) &&
            (identical(other.age, age) || other.age == age) &&
            (identical(other.step, step) || other.step == step) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.challenge, challenge) ||
                other.challenge == challenge) &&
            (identical(other.verifiedMobileToken, verifiedMobileToken) ||
                other.verifiedMobileToken == verifiedMobileToken) &&
            (identical(other.verifiedPhone, verifiedPhone) ||
                other.verifiedPhone == verifiedPhone) &&
            (identical(other.session, session) || other.session == session) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      phone,
      otpCode,
      locale,
      name,
      email,
      password,
      age,
      step,
      status,
      challenge,
      verifiedMobileToken,
      verifiedPhone,
      session,
      error);

  /// Create a copy of PhoneSignupState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PhoneSignupStateImplCopyWith<_$PhoneSignupStateImpl> get copyWith =>
      __$$PhoneSignupStateImplCopyWithImpl<_$PhoneSignupStateImpl>(
          this, _$identity);
}

abstract class _PhoneSignupState extends PhoneSignupState {
  const factory _PhoneSignupState(
      {final String phone,
      final String otpCode,
      final String locale,
      final String name,
      final String email,
      final String password,
      final int? age,
      final PhoneSignupStep step,
      final RequestState status,
      final OtpChallengeEntity? challenge,
      final String? verifiedMobileToken,
      final String? verifiedPhone,
      final CustomerSessionEntity? session,
      final Failure? error}) = _$PhoneSignupStateImpl;
  const _PhoneSignupState._() : super._();

// Form fields
  @override
  String get phone;
  @override
  String get otpCode;
  @override
  String get locale;
  @override
  String get name;
  @override
  String get email;
  @override
  String get password;
  @override
  int? get age; // Flow tracking
  @override
  PhoneSignupStep get step;
  @override
  RequestState get status;
  @override
  OtpChallengeEntity? get challenge;
  @override
  String? get verifiedMobileToken;
  @override
  String? get verifiedPhone;
  @override
  CustomerSessionEntity? get session;
  @override
  Failure? get error;

  /// Create a copy of PhoneSignupState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PhoneSignupStateImplCopyWith<_$PhoneSignupStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
