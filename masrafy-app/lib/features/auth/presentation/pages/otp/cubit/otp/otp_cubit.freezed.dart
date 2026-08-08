// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'otp_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$OtpState {
  String get code => throw _privateConstructorUsedError;
  OtpChallengeEntity? get challenge => throw _privateConstructorUsedError;
  OtpPurpose? get purpose => throw _privateConstructorUsedError;
  SignupDraft? get draft =>
      throw _privateConstructorUsedError; // Raw mobile number, carried for the SOCIAL PROFILE_MOBILE flow so resend
// can re-issue via `profile/mobile-request-otp` (no SignupDraft there).
  String? get phone => throw _privateConstructorUsedError;
  int get secondsRemaining => throw _privateConstructorUsedError;
  int get attemptsLeft => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;
  CustomerSessionEntity? get session =>
      throw _privateConstructorUsedError; // Single-use OTP result, retained so a retry after a later-step failure
// resumes from signup/complete instead of re-verifying the consumed OTP.
  String? get verifiedMobileToken =>
      throw _privateConstructorUsedError; // A National-ID side captured at signup that did not survive the upload.
// Deliberately NOT an error: the account is complete without it (Principle
// XXXVII), so the page still routes Home — it just says the ID needs
// re-adding instead of losing the capture quietly.
  bool get nationalIdUploadFailed => throw _privateConstructorUsedError;

  /// Create a copy of OtpState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OtpStateCopyWith<OtpState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OtpStateCopyWith<$Res> {
  factory $OtpStateCopyWith(OtpState value, $Res Function(OtpState) then) =
      _$OtpStateCopyWithImpl<$Res, OtpState>;
  @useResult
  $Res call(
      {String code,
      OtpChallengeEntity? challenge,
      OtpPurpose? purpose,
      SignupDraft? draft,
      String? phone,
      int secondsRemaining,
      int attemptsLeft,
      RequestState status,
      Failure? error,
      CustomerSessionEntity? session,
      String? verifiedMobileToken,
      bool nationalIdUploadFailed});
}

/// @nodoc
class _$OtpStateCopyWithImpl<$Res, $Val extends OtpState>
    implements $OtpStateCopyWith<$Res> {
  _$OtpStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OtpState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? code = null,
    Object? challenge = freezed,
    Object? purpose = freezed,
    Object? draft = freezed,
    Object? phone = freezed,
    Object? secondsRemaining = null,
    Object? attemptsLeft = null,
    Object? status = null,
    Object? error = freezed,
    Object? session = freezed,
    Object? verifiedMobileToken = freezed,
    Object? nationalIdUploadFailed = null,
  }) {
    return _then(_value.copyWith(
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      purpose: freezed == purpose
          ? _value.purpose
          : purpose // ignore: cast_nullable_to_non_nullable
              as OtpPurpose?,
      draft: freezed == draft
          ? _value.draft
          : draft // ignore: cast_nullable_to_non_nullable
              as SignupDraft?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
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
      session: freezed == session
          ? _value.session
          : session // ignore: cast_nullable_to_non_nullable
              as CustomerSessionEntity?,
      verifiedMobileToken: freezed == verifiedMobileToken
          ? _value.verifiedMobileToken
          : verifiedMobileToken // ignore: cast_nullable_to_non_nullable
              as String?,
      nationalIdUploadFailed: null == nationalIdUploadFailed
          ? _value.nationalIdUploadFailed
          : nationalIdUploadFailed // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OtpStateImplCopyWith<$Res>
    implements $OtpStateCopyWith<$Res> {
  factory _$$OtpStateImplCopyWith(
          _$OtpStateImpl value, $Res Function(_$OtpStateImpl) then) =
      __$$OtpStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String code,
      OtpChallengeEntity? challenge,
      OtpPurpose? purpose,
      SignupDraft? draft,
      String? phone,
      int secondsRemaining,
      int attemptsLeft,
      RequestState status,
      Failure? error,
      CustomerSessionEntity? session,
      String? verifiedMobileToken,
      bool nationalIdUploadFailed});
}

/// @nodoc
class __$$OtpStateImplCopyWithImpl<$Res>
    extends _$OtpStateCopyWithImpl<$Res, _$OtpStateImpl>
    implements _$$OtpStateImplCopyWith<$Res> {
  __$$OtpStateImplCopyWithImpl(
      _$OtpStateImpl _value, $Res Function(_$OtpStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of OtpState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? code = null,
    Object? challenge = freezed,
    Object? purpose = freezed,
    Object? draft = freezed,
    Object? phone = freezed,
    Object? secondsRemaining = null,
    Object? attemptsLeft = null,
    Object? status = null,
    Object? error = freezed,
    Object? session = freezed,
    Object? verifiedMobileToken = freezed,
    Object? nationalIdUploadFailed = null,
  }) {
    return _then(_$OtpStateImpl(
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      purpose: freezed == purpose
          ? _value.purpose
          : purpose // ignore: cast_nullable_to_non_nullable
              as OtpPurpose?,
      draft: freezed == draft
          ? _value.draft
          : draft // ignore: cast_nullable_to_non_nullable
              as SignupDraft?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
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
      session: freezed == session
          ? _value.session
          : session // ignore: cast_nullable_to_non_nullable
              as CustomerSessionEntity?,
      verifiedMobileToken: freezed == verifiedMobileToken
          ? _value.verifiedMobileToken
          : verifiedMobileToken // ignore: cast_nullable_to_non_nullable
              as String?,
      nationalIdUploadFailed: null == nationalIdUploadFailed
          ? _value.nationalIdUploadFailed
          : nationalIdUploadFailed // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$OtpStateImpl extends _OtpState {
  const _$OtpStateImpl(
      {this.code = '',
      this.challenge,
      this.purpose,
      this.draft,
      this.phone,
      this.secondsRemaining = 0,
      this.attemptsLeft = 3,
      this.status = RequestState.initial,
      this.error,
      this.session,
      this.verifiedMobileToken,
      this.nationalIdUploadFailed = false})
      : super._();

  @override
  @JsonKey()
  final String code;
  @override
  final OtpChallengeEntity? challenge;
  @override
  final OtpPurpose? purpose;
  @override
  final SignupDraft? draft;
// Raw mobile number, carried for the SOCIAL PROFILE_MOBILE flow so resend
// can re-issue via `profile/mobile-request-otp` (no SignupDraft there).
  @override
  final String? phone;
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
  final CustomerSessionEntity? session;
// Single-use OTP result, retained so a retry after a later-step failure
// resumes from signup/complete instead of re-verifying the consumed OTP.
  @override
  final String? verifiedMobileToken;
// A National-ID side captured at signup that did not survive the upload.
// Deliberately NOT an error: the account is complete without it (Principle
// XXXVII), so the page still routes Home — it just says the ID needs
// re-adding instead of losing the capture quietly.
  @override
  @JsonKey()
  final bool nationalIdUploadFailed;

  @override
  String toString() {
    return 'OtpState(code: $code, challenge: $challenge, purpose: $purpose, draft: $draft, phone: $phone, secondsRemaining: $secondsRemaining, attemptsLeft: $attemptsLeft, status: $status, error: $error, session: $session, verifiedMobileToken: $verifiedMobileToken, nationalIdUploadFailed: $nationalIdUploadFailed)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OtpStateImpl &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.challenge, challenge) ||
                other.challenge == challenge) &&
            (identical(other.purpose, purpose) || other.purpose == purpose) &&
            (identical(other.draft, draft) || other.draft == draft) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.secondsRemaining, secondsRemaining) ||
                other.secondsRemaining == secondsRemaining) &&
            (identical(other.attemptsLeft, attemptsLeft) ||
                other.attemptsLeft == attemptsLeft) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error) &&
            (identical(other.session, session) || other.session == session) &&
            (identical(other.verifiedMobileToken, verifiedMobileToken) ||
                other.verifiedMobileToken == verifiedMobileToken) &&
            (identical(other.nationalIdUploadFailed, nationalIdUploadFailed) ||
                other.nationalIdUploadFailed == nationalIdUploadFailed));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      code,
      challenge,
      purpose,
      draft,
      phone,
      secondsRemaining,
      attemptsLeft,
      status,
      error,
      session,
      verifiedMobileToken,
      nationalIdUploadFailed);

  /// Create a copy of OtpState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OtpStateImplCopyWith<_$OtpStateImpl> get copyWith =>
      __$$OtpStateImplCopyWithImpl<_$OtpStateImpl>(this, _$identity);
}

abstract class _OtpState extends OtpState {
  const factory _OtpState(
      {final String code,
      final OtpChallengeEntity? challenge,
      final OtpPurpose? purpose,
      final SignupDraft? draft,
      final String? phone,
      final int secondsRemaining,
      final int attemptsLeft,
      final RequestState status,
      final Failure? error,
      final CustomerSessionEntity? session,
      final String? verifiedMobileToken,
      final bool nationalIdUploadFailed}) = _$OtpStateImpl;
  const _OtpState._() : super._();

  @override
  String get code;
  @override
  OtpChallengeEntity? get challenge;
  @override
  OtpPurpose? get purpose;
  @override
  SignupDraft?
      get draft; // Raw mobile number, carried for the SOCIAL PROFILE_MOBILE flow so resend
// can re-issue via `profile/mobile-request-otp` (no SignupDraft there).
  @override
  String? get phone;
  @override
  int get secondsRemaining;
  @override
  int get attemptsLeft;
  @override
  RequestState get status;
  @override
  Failure? get error;
  @override
  CustomerSessionEntity?
      get session; // Single-use OTP result, retained so a retry after a later-step failure
// resumes from signup/complete instead of re-verifying the consumed OTP.
  @override
  String?
      get verifiedMobileToken; // A National-ID side captured at signup that did not survive the upload.
// Deliberately NOT an error: the account is complete without it (Principle
// XXXVII), so the page still routes Home — it just says the ID needs
// re-adding instead of losing the capture quietly.
  @override
  bool get nationalIdUploadFailed;

  /// Create a copy of OtpState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OtpStateImplCopyWith<_$OtpStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
