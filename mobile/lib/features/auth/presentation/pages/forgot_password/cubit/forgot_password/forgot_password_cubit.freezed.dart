// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'forgot_password_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ForgotPasswordState {
  String get phone => throw _privateConstructorUsedError;
  String get otpCode => throw _privateConstructorUsedError;
  String get newPassword => throw _privateConstructorUsedError;
  String get locale => throw _privateConstructorUsedError;
  ForgotPasswordStep get step => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  OtpChallengeEntity? get challenge => throw _privateConstructorUsedError;
  String? get passwordResetToken => throw _privateConstructorUsedError;
  CustomerSessionEntity? get session => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of ForgotPasswordState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ForgotPasswordStateCopyWith<ForgotPasswordState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ForgotPasswordStateCopyWith<$Res> {
  factory $ForgotPasswordStateCopyWith(
          ForgotPasswordState value, $Res Function(ForgotPasswordState) then) =
      _$ForgotPasswordStateCopyWithImpl<$Res, ForgotPasswordState>;
  @useResult
  $Res call(
      {String phone,
      String otpCode,
      String newPassword,
      String locale,
      ForgotPasswordStep step,
      RequestState status,
      OtpChallengeEntity? challenge,
      String? passwordResetToken,
      CustomerSessionEntity? session,
      Failure? error});
}

/// @nodoc
class _$ForgotPasswordStateCopyWithImpl<$Res, $Val extends ForgotPasswordState>
    implements $ForgotPasswordStateCopyWith<$Res> {
  _$ForgotPasswordStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ForgotPasswordState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? phone = null,
    Object? otpCode = null,
    Object? newPassword = null,
    Object? locale = null,
    Object? step = null,
    Object? status = null,
    Object? challenge = freezed,
    Object? passwordResetToken = freezed,
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
      newPassword: null == newPassword
          ? _value.newPassword
          : newPassword // ignore: cast_nullable_to_non_nullable
              as String,
      locale: null == locale
          ? _value.locale
          : locale // ignore: cast_nullable_to_non_nullable
              as String,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as ForgotPasswordStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      passwordResetToken: freezed == passwordResetToken
          ? _value.passwordResetToken
          : passwordResetToken // ignore: cast_nullable_to_non_nullable
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
abstract class _$$ForgotPasswordStateImplCopyWith<$Res>
    implements $ForgotPasswordStateCopyWith<$Res> {
  factory _$$ForgotPasswordStateImplCopyWith(_$ForgotPasswordStateImpl value,
          $Res Function(_$ForgotPasswordStateImpl) then) =
      __$$ForgotPasswordStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String phone,
      String otpCode,
      String newPassword,
      String locale,
      ForgotPasswordStep step,
      RequestState status,
      OtpChallengeEntity? challenge,
      String? passwordResetToken,
      CustomerSessionEntity? session,
      Failure? error});
}

/// @nodoc
class __$$ForgotPasswordStateImplCopyWithImpl<$Res>
    extends _$ForgotPasswordStateCopyWithImpl<$Res, _$ForgotPasswordStateImpl>
    implements _$$ForgotPasswordStateImplCopyWith<$Res> {
  __$$ForgotPasswordStateImplCopyWithImpl(_$ForgotPasswordStateImpl _value,
      $Res Function(_$ForgotPasswordStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of ForgotPasswordState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? phone = null,
    Object? otpCode = null,
    Object? newPassword = null,
    Object? locale = null,
    Object? step = null,
    Object? status = null,
    Object? challenge = freezed,
    Object? passwordResetToken = freezed,
    Object? session = freezed,
    Object? error = freezed,
  }) {
    return _then(_$ForgotPasswordStateImpl(
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
      otpCode: null == otpCode
          ? _value.otpCode
          : otpCode // ignore: cast_nullable_to_non_nullable
              as String,
      newPassword: null == newPassword
          ? _value.newPassword
          : newPassword // ignore: cast_nullable_to_non_nullable
              as String,
      locale: null == locale
          ? _value.locale
          : locale // ignore: cast_nullable_to_non_nullable
              as String,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as ForgotPasswordStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      passwordResetToken: freezed == passwordResetToken
          ? _value.passwordResetToken
          : passwordResetToken // ignore: cast_nullable_to_non_nullable
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

class _$ForgotPasswordStateImpl extends _ForgotPasswordState {
  const _$ForgotPasswordStateImpl(
      {this.phone = '',
      this.otpCode = '',
      this.newPassword = '',
      this.locale = 'en',
      this.step = ForgotPasswordStep.idle,
      this.status = RequestState.initial,
      this.challenge,
      this.passwordResetToken,
      this.session,
      this.error})
      : super._();

  @override
  @JsonKey()
  final String phone;
  @override
  @JsonKey()
  final String otpCode;
  @override
  @JsonKey()
  final String newPassword;
  @override
  @JsonKey()
  final String locale;
  @override
  @JsonKey()
  final ForgotPasswordStep step;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final OtpChallengeEntity? challenge;
  @override
  final String? passwordResetToken;
  @override
  final CustomerSessionEntity? session;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'ForgotPasswordState(phone: $phone, otpCode: $otpCode, newPassword: $newPassword, locale: $locale, step: $step, status: $status, challenge: $challenge, passwordResetToken: $passwordResetToken, session: $session, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ForgotPasswordStateImpl &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.otpCode, otpCode) || other.otpCode == otpCode) &&
            (identical(other.newPassword, newPassword) ||
                other.newPassword == newPassword) &&
            (identical(other.locale, locale) || other.locale == locale) &&
            (identical(other.step, step) || other.step == step) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.challenge, challenge) ||
                other.challenge == challenge) &&
            (identical(other.passwordResetToken, passwordResetToken) ||
                other.passwordResetToken == passwordResetToken) &&
            (identical(other.session, session) || other.session == session) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(runtimeType, phone, otpCode, newPassword,
      locale, step, status, challenge, passwordResetToken, session, error);

  /// Create a copy of ForgotPasswordState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ForgotPasswordStateImplCopyWith<_$ForgotPasswordStateImpl> get copyWith =>
      __$$ForgotPasswordStateImplCopyWithImpl<_$ForgotPasswordStateImpl>(
          this, _$identity);
}

abstract class _ForgotPasswordState extends ForgotPasswordState {
  const factory _ForgotPasswordState(
      {final String phone,
      final String otpCode,
      final String newPassword,
      final String locale,
      final ForgotPasswordStep step,
      final RequestState status,
      final OtpChallengeEntity? challenge,
      final String? passwordResetToken,
      final CustomerSessionEntity? session,
      final Failure? error}) = _$ForgotPasswordStateImpl;
  const _ForgotPasswordState._() : super._();

  @override
  String get phone;
  @override
  String get otpCode;
  @override
  String get newPassword;
  @override
  String get locale;
  @override
  ForgotPasswordStep get step;
  @override
  RequestState get status;
  @override
  OtpChallengeEntity? get challenge;
  @override
  String? get passwordResetToken;
  @override
  CustomerSessionEntity? get session;
  @override
  Failure? get error;

  /// Create a copy of ForgotPasswordState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ForgotPasswordStateImplCopyWith<_$ForgotPasswordStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
