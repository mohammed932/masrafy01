// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'phone_verification_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$PhoneVerificationState {
  String get dialCode => throw _privateConstructorUsedError;
  String get phone => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;
  OtpChallengeEntity? get challenge => throw _privateConstructorUsedError;

  /// Create a copy of PhoneVerificationState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PhoneVerificationStateCopyWith<PhoneVerificationState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PhoneVerificationStateCopyWith<$Res> {
  factory $PhoneVerificationStateCopyWith(PhoneVerificationState value,
          $Res Function(PhoneVerificationState) then) =
      _$PhoneVerificationStateCopyWithImpl<$Res, PhoneVerificationState>;
  @useResult
  $Res call(
      {String dialCode,
      String phone,
      RequestState status,
      Failure? error,
      OtpChallengeEntity? challenge});
}

/// @nodoc
class _$PhoneVerificationStateCopyWithImpl<$Res,
        $Val extends PhoneVerificationState>
    implements $PhoneVerificationStateCopyWith<$Res> {
  _$PhoneVerificationStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PhoneVerificationState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dialCode = null,
    Object? phone = null,
    Object? status = null,
    Object? error = freezed,
    Object? challenge = freezed,
  }) {
    return _then(_value.copyWith(
      dialCode: null == dialCode
          ? _value.dialCode
          : dialCode // ignore: cast_nullable_to_non_nullable
              as String,
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
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
abstract class _$$PhoneVerificationStateImplCopyWith<$Res>
    implements $PhoneVerificationStateCopyWith<$Res> {
  factory _$$PhoneVerificationStateImplCopyWith(
          _$PhoneVerificationStateImpl value,
          $Res Function(_$PhoneVerificationStateImpl) then) =
      __$$PhoneVerificationStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String dialCode,
      String phone,
      RequestState status,
      Failure? error,
      OtpChallengeEntity? challenge});
}

/// @nodoc
class __$$PhoneVerificationStateImplCopyWithImpl<$Res>
    extends _$PhoneVerificationStateCopyWithImpl<$Res,
        _$PhoneVerificationStateImpl>
    implements _$$PhoneVerificationStateImplCopyWith<$Res> {
  __$$PhoneVerificationStateImplCopyWithImpl(
      _$PhoneVerificationStateImpl _value,
      $Res Function(_$PhoneVerificationStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of PhoneVerificationState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dialCode = null,
    Object? phone = null,
    Object? status = null,
    Object? error = freezed,
    Object? challenge = freezed,
  }) {
    return _then(_$PhoneVerificationStateImpl(
      dialCode: null == dialCode
          ? _value.dialCode
          : dialCode // ignore: cast_nullable_to_non_nullable
              as String,
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
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

class _$PhoneVerificationStateImpl extends _PhoneVerificationState {
  const _$PhoneVerificationStateImpl(
      {this.dialCode = '+20',
      this.phone = '',
      this.status = RequestState.initial,
      this.error,
      this.challenge})
      : super._();

  @override
  @JsonKey()
  final String dialCode;
  @override
  @JsonKey()
  final String phone;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final Failure? error;
  @override
  final OtpChallengeEntity? challenge;

  @override
  String toString() {
    return 'PhoneVerificationState(dialCode: $dialCode, phone: $phone, status: $status, error: $error, challenge: $challenge)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PhoneVerificationStateImpl &&
            (identical(other.dialCode, dialCode) ||
                other.dialCode == dialCode) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error) &&
            (identical(other.challenge, challenge) ||
                other.challenge == challenge));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, dialCode, phone, status, error, challenge);

  /// Create a copy of PhoneVerificationState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PhoneVerificationStateImplCopyWith<_$PhoneVerificationStateImpl>
      get copyWith => __$$PhoneVerificationStateImplCopyWithImpl<
          _$PhoneVerificationStateImpl>(this, _$identity);
}

abstract class _PhoneVerificationState extends PhoneVerificationState {
  const factory _PhoneVerificationState(
      {final String dialCode,
      final String phone,
      final RequestState status,
      final Failure? error,
      final OtpChallengeEntity? challenge}) = _$PhoneVerificationStateImpl;
  const _PhoneVerificationState._() : super._();

  @override
  String get dialCode;
  @override
  String get phone;
  @override
  RequestState get status;
  @override
  Failure? get error;
  @override
  OtpChallengeEntity? get challenge;

  /// Create a copy of PhoneVerificationState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PhoneVerificationStateImplCopyWith<_$PhoneVerificationStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
