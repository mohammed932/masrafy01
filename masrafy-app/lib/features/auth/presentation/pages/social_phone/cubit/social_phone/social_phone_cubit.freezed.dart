// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'social_phone_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$SocialPhoneState {
  String get dialCode => throw _privateConstructorUsedError;
  String get phone => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;
  OtpChallengeEntity? get challenge => throw _privateConstructorUsedError;

  /// Create a copy of SocialPhoneState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SocialPhoneStateCopyWith<SocialPhoneState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SocialPhoneStateCopyWith<$Res> {
  factory $SocialPhoneStateCopyWith(
          SocialPhoneState value, $Res Function(SocialPhoneState) then) =
      _$SocialPhoneStateCopyWithImpl<$Res, SocialPhoneState>;
  @useResult
  $Res call(
      {String dialCode,
      String phone,
      RequestState status,
      Failure? error,
      OtpChallengeEntity? challenge});
}

/// @nodoc
class _$SocialPhoneStateCopyWithImpl<$Res, $Val extends SocialPhoneState>
    implements $SocialPhoneStateCopyWith<$Res> {
  _$SocialPhoneStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SocialPhoneState
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
abstract class _$$SocialPhoneStateImplCopyWith<$Res>
    implements $SocialPhoneStateCopyWith<$Res> {
  factory _$$SocialPhoneStateImplCopyWith(_$SocialPhoneStateImpl value,
          $Res Function(_$SocialPhoneStateImpl) then) =
      __$$SocialPhoneStateImplCopyWithImpl<$Res>;
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
class __$$SocialPhoneStateImplCopyWithImpl<$Res>
    extends _$SocialPhoneStateCopyWithImpl<$Res, _$SocialPhoneStateImpl>
    implements _$$SocialPhoneStateImplCopyWith<$Res> {
  __$$SocialPhoneStateImplCopyWithImpl(_$SocialPhoneStateImpl _value,
      $Res Function(_$SocialPhoneStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of SocialPhoneState
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
    return _then(_$SocialPhoneStateImpl(
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

class _$SocialPhoneStateImpl extends _SocialPhoneState {
  const _$SocialPhoneStateImpl(
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
    return 'SocialPhoneState(dialCode: $dialCode, phone: $phone, status: $status, error: $error, challenge: $challenge)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SocialPhoneStateImpl &&
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

  /// Create a copy of SocialPhoneState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SocialPhoneStateImplCopyWith<_$SocialPhoneStateImpl> get copyWith =>
      __$$SocialPhoneStateImplCopyWithImpl<_$SocialPhoneStateImpl>(
          this, _$identity);
}

abstract class _SocialPhoneState extends SocialPhoneState {
  const factory _SocialPhoneState(
      {final String dialCode,
      final String phone,
      final RequestState status,
      final Failure? error,
      final OtpChallengeEntity? challenge}) = _$SocialPhoneStateImpl;
  const _SocialPhoneState._() : super._();

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

  /// Create a copy of SocialPhoneState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SocialPhoneStateImplCopyWith<_$SocialPhoneStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
