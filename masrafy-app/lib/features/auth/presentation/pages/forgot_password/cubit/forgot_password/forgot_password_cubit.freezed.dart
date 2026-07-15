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
  ForgotPasswordStep get step => throw _privateConstructorUsedError;
  String get dialCode => throw _privateConstructorUsedError;
  String get phone => throw _privateConstructorUsedError;
  OtpChallengeEntity? get challenge => throw _privateConstructorUsedError;
  String get code => throw _privateConstructorUsedError;
  String? get passwordResetToken => throw _privateConstructorUsedError;
  String get newPassword => throw _privateConstructorUsedError;
  String get confirmPassword => throw _privateConstructorUsedError;
  bool get obscureNew => throw _privateConstructorUsedError;
  bool get obscureConfirm => throw _privateConstructorUsedError;
  int get secondsRemaining => throw _privateConstructorUsedError;
  int get attemptsLeft => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
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
      {ForgotPasswordStep step,
      String dialCode,
      String phone,
      OtpChallengeEntity? challenge,
      String code,
      String? passwordResetToken,
      String newPassword,
      String confirmPassword,
      bool obscureNew,
      bool obscureConfirm,
      int secondsRemaining,
      int attemptsLeft,
      RequestState status,
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
    Object? step = null,
    Object? dialCode = null,
    Object? phone = null,
    Object? challenge = freezed,
    Object? code = null,
    Object? passwordResetToken = freezed,
    Object? newPassword = null,
    Object? confirmPassword = null,
    Object? obscureNew = null,
    Object? obscureConfirm = null,
    Object? secondsRemaining = null,
    Object? attemptsLeft = null,
    Object? status = null,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as ForgotPasswordStep,
      dialCode: null == dialCode
          ? _value.dialCode
          : dialCode // ignore: cast_nullable_to_non_nullable
              as String,
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String,
      passwordResetToken: freezed == passwordResetToken
          ? _value.passwordResetToken
          : passwordResetToken // ignore: cast_nullable_to_non_nullable
              as String?,
      newPassword: null == newPassword
          ? _value.newPassword
          : newPassword // ignore: cast_nullable_to_non_nullable
              as String,
      confirmPassword: null == confirmPassword
          ? _value.confirmPassword
          : confirmPassword // ignore: cast_nullable_to_non_nullable
              as String,
      obscureNew: null == obscureNew
          ? _value.obscureNew
          : obscureNew // ignore: cast_nullable_to_non_nullable
              as bool,
      obscureConfirm: null == obscureConfirm
          ? _value.obscureConfirm
          : obscureConfirm // ignore: cast_nullable_to_non_nullable
              as bool,
      secondsRemaining: null == secondsRemaining
          ? _value.secondsRemaining
          : secondsRemaining // ignore: cast_nullable_to_non_nullable
              as int,
      attemptsLeft: null == attemptsLeft
          ? _value.attemptsLeft
          : attemptsLeft // ignore: cast_nullable_to_non_nullable
              as int,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
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
      {ForgotPasswordStep step,
      String dialCode,
      String phone,
      OtpChallengeEntity? challenge,
      String code,
      String? passwordResetToken,
      String newPassword,
      String confirmPassword,
      bool obscureNew,
      bool obscureConfirm,
      int secondsRemaining,
      int attemptsLeft,
      RequestState status,
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
    Object? step = null,
    Object? dialCode = null,
    Object? phone = null,
    Object? challenge = freezed,
    Object? code = null,
    Object? passwordResetToken = freezed,
    Object? newPassword = null,
    Object? confirmPassword = null,
    Object? obscureNew = null,
    Object? obscureConfirm = null,
    Object? secondsRemaining = null,
    Object? attemptsLeft = null,
    Object? status = null,
    Object? error = freezed,
  }) {
    return _then(_$ForgotPasswordStateImpl(
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as ForgotPasswordStep,
      dialCode: null == dialCode
          ? _value.dialCode
          : dialCode // ignore: cast_nullable_to_non_nullable
              as String,
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String,
      passwordResetToken: freezed == passwordResetToken
          ? _value.passwordResetToken
          : passwordResetToken // ignore: cast_nullable_to_non_nullable
              as String?,
      newPassword: null == newPassword
          ? _value.newPassword
          : newPassword // ignore: cast_nullable_to_non_nullable
              as String,
      confirmPassword: null == confirmPassword
          ? _value.confirmPassword
          : confirmPassword // ignore: cast_nullable_to_non_nullable
              as String,
      obscureNew: null == obscureNew
          ? _value.obscureNew
          : obscureNew // ignore: cast_nullable_to_non_nullable
              as bool,
      obscureConfirm: null == obscureConfirm
          ? _value.obscureConfirm
          : obscureConfirm // ignore: cast_nullable_to_non_nullable
              as bool,
      secondsRemaining: null == secondsRemaining
          ? _value.secondsRemaining
          : secondsRemaining // ignore: cast_nullable_to_non_nullable
              as int,
      attemptsLeft: null == attemptsLeft
          ? _value.attemptsLeft
          : attemptsLeft // ignore: cast_nullable_to_non_nullable
              as int,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
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
      {this.step = ForgotPasswordStep.phone,
      this.dialCode = '+20',
      this.phone = '',
      this.challenge,
      this.code = '',
      this.passwordResetToken,
      this.newPassword = '',
      this.confirmPassword = '',
      this.obscureNew = true,
      this.obscureConfirm = true,
      this.secondsRemaining = 0,
      this.attemptsLeft = 3,
      this.status = RequestState.initial,
      this.error})
      : super._();

  @override
  @JsonKey()
  final ForgotPasswordStep step;
  @override
  @JsonKey()
  final String dialCode;
  @override
  @JsonKey()
  final String phone;
  @override
  final OtpChallengeEntity? challenge;
  @override
  @JsonKey()
  final String code;
  @override
  final String? passwordResetToken;
  @override
  @JsonKey()
  final String newPassword;
  @override
  @JsonKey()
  final String confirmPassword;
  @override
  @JsonKey()
  final bool obscureNew;
  @override
  @JsonKey()
  final bool obscureConfirm;
  @override
  @JsonKey()
  final int secondsRemaining;
  @override
  @JsonKey()
  final int attemptsLeft;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'ForgotPasswordState(step: $step, dialCode: $dialCode, phone: $phone, challenge: $challenge, code: $code, passwordResetToken: $passwordResetToken, newPassword: $newPassword, confirmPassword: $confirmPassword, obscureNew: $obscureNew, obscureConfirm: $obscureConfirm, secondsRemaining: $secondsRemaining, attemptsLeft: $attemptsLeft, status: $status, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ForgotPasswordStateImpl &&
            (identical(other.step, step) || other.step == step) &&
            (identical(other.dialCode, dialCode) ||
                other.dialCode == dialCode) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.challenge, challenge) ||
                other.challenge == challenge) &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.passwordResetToken, passwordResetToken) ||
                other.passwordResetToken == passwordResetToken) &&
            (identical(other.newPassword, newPassword) ||
                other.newPassword == newPassword) &&
            (identical(other.confirmPassword, confirmPassword) ||
                other.confirmPassword == confirmPassword) &&
            (identical(other.obscureNew, obscureNew) ||
                other.obscureNew == obscureNew) &&
            (identical(other.obscureConfirm, obscureConfirm) ||
                other.obscureConfirm == obscureConfirm) &&
            (identical(other.secondsRemaining, secondsRemaining) ||
                other.secondsRemaining == secondsRemaining) &&
            (identical(other.attemptsLeft, attemptsLeft) ||
                other.attemptsLeft == attemptsLeft) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      step,
      dialCode,
      phone,
      challenge,
      code,
      passwordResetToken,
      newPassword,
      confirmPassword,
      obscureNew,
      obscureConfirm,
      secondsRemaining,
      attemptsLeft,
      status,
      error);

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
      {final ForgotPasswordStep step,
      final String dialCode,
      final String phone,
      final OtpChallengeEntity? challenge,
      final String code,
      final String? passwordResetToken,
      final String newPassword,
      final String confirmPassword,
      final bool obscureNew,
      final bool obscureConfirm,
      final int secondsRemaining,
      final int attemptsLeft,
      final RequestState status,
      final Failure? error}) = _$ForgotPasswordStateImpl;
  const _ForgotPasswordState._() : super._();

  @override
  ForgotPasswordStep get step;
  @override
  String get dialCode;
  @override
  String get phone;
  @override
  OtpChallengeEntity? get challenge;
  @override
  String get code;
  @override
  String? get passwordResetToken;
  @override
  String get newPassword;
  @override
  String get confirmPassword;
  @override
  bool get obscureNew;
  @override
  bool get obscureConfirm;
  @override
  int get secondsRemaining;
  @override
  int get attemptsLeft;
  @override
  RequestState get status;
  @override
  Failure? get error;

  /// Create a copy of ForgotPasswordState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ForgotPasswordStateImplCopyWith<_$ForgotPasswordStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
