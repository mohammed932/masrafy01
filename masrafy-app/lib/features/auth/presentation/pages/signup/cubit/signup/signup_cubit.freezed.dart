// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'signup_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$SignupState {
  String get firstName => throw _privateConstructorUsedError;
  String get lastName => throw _privateConstructorUsedError;
  String get dialCode => throw _privateConstructorUsedError;
  String get phone => throw _privateConstructorUsedError;
  String get email => throw _privateConstructorUsedError;
  DateTime? get birthday => throw _privateConstructorUsedError;
  String get password => throw _privateConstructorUsedError;
  String get confirmPassword => throw _privateConstructorUsedError;
  bool get agreedToTerms => throw _privateConstructorUsedError;
  bool get obscure => throw _privateConstructorUsedError;
  bool get obscureConfirm => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;
  OtpChallengeEntity? get challenge => throw _privateConstructorUsedError;

  /// Create a copy of SignupState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SignupStateCopyWith<SignupState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SignupStateCopyWith<$Res> {
  factory $SignupStateCopyWith(
          SignupState value, $Res Function(SignupState) then) =
      _$SignupStateCopyWithImpl<$Res, SignupState>;
  @useResult
  $Res call(
      {String firstName,
      String lastName,
      String dialCode,
      String phone,
      String email,
      DateTime? birthday,
      String password,
      String confirmPassword,
      bool agreedToTerms,
      bool obscure,
      bool obscureConfirm,
      RequestState status,
      Failure? error,
      OtpChallengeEntity? challenge});
}

/// @nodoc
class _$SignupStateCopyWithImpl<$Res, $Val extends SignupState>
    implements $SignupStateCopyWith<$Res> {
  _$SignupStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SignupState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = null,
    Object? lastName = null,
    Object? dialCode = null,
    Object? phone = null,
    Object? email = null,
    Object? birthday = freezed,
    Object? password = null,
    Object? confirmPassword = null,
    Object? agreedToTerms = null,
    Object? obscure = null,
    Object? obscureConfirm = null,
    Object? status = null,
    Object? error = freezed,
    Object? challenge = freezed,
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
      dialCode: null == dialCode
          ? _value.dialCode
          : dialCode // ignore: cast_nullable_to_non_nullable
              as String,
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      birthday: freezed == birthday
          ? _value.birthday
          : birthday // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      confirmPassword: null == confirmPassword
          ? _value.confirmPassword
          : confirmPassword // ignore: cast_nullable_to_non_nullable
              as String,
      agreedToTerms: null == agreedToTerms
          ? _value.agreedToTerms
          : agreedToTerms // ignore: cast_nullable_to_non_nullable
              as bool,
      obscure: null == obscure
          ? _value.obscure
          : obscure // ignore: cast_nullable_to_non_nullable
              as bool,
      obscureConfirm: null == obscureConfirm
          ? _value.obscureConfirm
          : obscureConfirm // ignore: cast_nullable_to_non_nullable
              as bool,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SignupStateImplCopyWith<$Res>
    implements $SignupStateCopyWith<$Res> {
  factory _$$SignupStateImplCopyWith(
          _$SignupStateImpl value, $Res Function(_$SignupStateImpl) then) =
      __$$SignupStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String firstName,
      String lastName,
      String dialCode,
      String phone,
      String email,
      DateTime? birthday,
      String password,
      String confirmPassword,
      bool agreedToTerms,
      bool obscure,
      bool obscureConfirm,
      RequestState status,
      Failure? error,
      OtpChallengeEntity? challenge});
}

/// @nodoc
class __$$SignupStateImplCopyWithImpl<$Res>
    extends _$SignupStateCopyWithImpl<$Res, _$SignupStateImpl>
    implements _$$SignupStateImplCopyWith<$Res> {
  __$$SignupStateImplCopyWithImpl(
      _$SignupStateImpl _value, $Res Function(_$SignupStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of SignupState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = null,
    Object? lastName = null,
    Object? dialCode = null,
    Object? phone = null,
    Object? email = null,
    Object? birthday = freezed,
    Object? password = null,
    Object? confirmPassword = null,
    Object? agreedToTerms = null,
    Object? obscure = null,
    Object? obscureConfirm = null,
    Object? status = null,
    Object? error = freezed,
    Object? challenge = freezed,
  }) {
    return _then(_$SignupStateImpl(
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      dialCode: null == dialCode
          ? _value.dialCode
          : dialCode // ignore: cast_nullable_to_non_nullable
              as String,
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      birthday: freezed == birthday
          ? _value.birthday
          : birthday // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      confirmPassword: null == confirmPassword
          ? _value.confirmPassword
          : confirmPassword // ignore: cast_nullable_to_non_nullable
              as String,
      agreedToTerms: null == agreedToTerms
          ? _value.agreedToTerms
          : agreedToTerms // ignore: cast_nullable_to_non_nullable
              as bool,
      obscure: null == obscure
          ? _value.obscure
          : obscure // ignore: cast_nullable_to_non_nullable
              as bool,
      obscureConfirm: null == obscureConfirm
          ? _value.obscureConfirm
          : obscureConfirm // ignore: cast_nullable_to_non_nullable
              as bool,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
    ));
  }
}

/// @nodoc

class _$SignupStateImpl extends _SignupState {
  const _$SignupStateImpl(
      {this.firstName = '',
      this.lastName = '',
      this.dialCode = '+20',
      this.phone = '',
      this.email = '',
      this.birthday,
      this.password = '',
      this.confirmPassword = '',
      this.agreedToTerms = false,
      this.obscure = true,
      this.obscureConfirm = true,
      this.status = RequestState.initial,
      this.error,
      this.challenge})
      : super._();

  @override
  @JsonKey()
  final String firstName;
  @override
  @JsonKey()
  final String lastName;
  @override
  @JsonKey()
  final String dialCode;
  @override
  @JsonKey()
  final String phone;
  @override
  @JsonKey()
  final String email;
  @override
  final DateTime? birthday;
  @override
  @JsonKey()
  final String password;
  @override
  @JsonKey()
  final String confirmPassword;
  @override
  @JsonKey()
  final bool agreedToTerms;
  @override
  @JsonKey()
  final bool obscure;
  @override
  @JsonKey()
  final bool obscureConfirm;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final Failure? error;
  @override
  final OtpChallengeEntity? challenge;

  @override
  String toString() {
    return 'SignupState(firstName: $firstName, lastName: $lastName, dialCode: $dialCode, phone: $phone, email: $email, birthday: $birthday, password: $password, confirmPassword: $confirmPassword, agreedToTerms: $agreedToTerms, obscure: $obscure, obscureConfirm: $obscureConfirm, status: $status, error: $error, challenge: $challenge)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SignupStateImpl &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.dialCode, dialCode) ||
                other.dialCode == dialCode) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.birthday, birthday) ||
                other.birthday == birthday) &&
            (identical(other.password, password) ||
                other.password == password) &&
            (identical(other.confirmPassword, confirmPassword) ||
                other.confirmPassword == confirmPassword) &&
            (identical(other.agreedToTerms, agreedToTerms) ||
                other.agreedToTerms == agreedToTerms) &&
            (identical(other.obscure, obscure) || other.obscure == obscure) &&
            (identical(other.obscureConfirm, obscureConfirm) ||
                other.obscureConfirm == obscureConfirm) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error) &&
            (identical(other.challenge, challenge) ||
                other.challenge == challenge));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      firstName,
      lastName,
      dialCode,
      phone,
      email,
      birthday,
      password,
      confirmPassword,
      agreedToTerms,
      obscure,
      obscureConfirm,
      status,
      error,
      challenge);

  /// Create a copy of SignupState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SignupStateImplCopyWith<_$SignupStateImpl> get copyWith =>
      __$$SignupStateImplCopyWithImpl<_$SignupStateImpl>(this, _$identity);
}

abstract class _SignupState extends SignupState {
  const factory _SignupState(
      {final String firstName,
      final String lastName,
      final String dialCode,
      final String phone,
      final String email,
      final DateTime? birthday,
      final String password,
      final String confirmPassword,
      final bool agreedToTerms,
      final bool obscure,
      final bool obscureConfirm,
      final RequestState status,
      final Failure? error,
      final OtpChallengeEntity? challenge}) = _$SignupStateImpl;
  const _SignupState._() : super._();

  @override
  String get firstName;
  @override
  String get lastName;
  @override
  String get dialCode;
  @override
  String get phone;
  @override
  String get email;
  @override
  DateTime? get birthday;
  @override
  String get password;
  @override
  String get confirmPassword;
  @override
  bool get agreedToTerms;
  @override
  bool get obscure;
  @override
  bool get obscureConfirm;
  @override
  RequestState get status;
  @override
  Failure? get error;
  @override
  OtpChallengeEntity? get challenge;

  /// Create a copy of SignupState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SignupStateImplCopyWith<_$SignupStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
