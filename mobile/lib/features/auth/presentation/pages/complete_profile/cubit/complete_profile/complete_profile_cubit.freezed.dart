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
  String get phone => throw _privateConstructorUsedError;
  String get otpCode => throw _privateConstructorUsedError;
  CompleteProfileStep get step => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  OtpChallengeEntity? get challenge => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

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
      {String phone,
      String otpCode,
      CompleteProfileStep step,
      RequestState status,
      OtpChallengeEntity? challenge,
      Failure? error});
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
    Object? phone = null,
    Object? otpCode = null,
    Object? step = null,
    Object? status = null,
    Object? challenge = freezed,
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
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as CompleteProfileStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
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
      {String phone,
      String otpCode,
      CompleteProfileStep step,
      RequestState status,
      OtpChallengeEntity? challenge,
      Failure? error});
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
    Object? phone = null,
    Object? otpCode = null,
    Object? step = null,
    Object? status = null,
    Object? challenge = freezed,
    Object? error = freezed,
  }) {
    return _then(_$CompleteProfileStateImpl(
      phone: null == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String,
      otpCode: null == otpCode
          ? _value.otpCode
          : otpCode // ignore: cast_nullable_to_non_nullable
              as String,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as CompleteProfileStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      challenge: freezed == challenge
          ? _value.challenge
          : challenge // ignore: cast_nullable_to_non_nullable
              as OtpChallengeEntity?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$CompleteProfileStateImpl extends _CompleteProfileState {
  const _$CompleteProfileStateImpl(
      {this.phone = '',
      this.otpCode = '',
      this.step = CompleteProfileStep.idle,
      this.status = RequestState.initial,
      this.challenge,
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
  final CompleteProfileStep step;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final OtpChallengeEntity? challenge;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'CompleteProfileState(phone: $phone, otpCode: $otpCode, step: $step, status: $status, challenge: $challenge, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CompleteProfileStateImpl &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.otpCode, otpCode) || other.otpCode == otpCode) &&
            (identical(other.step, step) || other.step == step) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.challenge, challenge) ||
                other.challenge == challenge) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, phone, otpCode, step, status, challenge, error);

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
      {final String phone,
      final String otpCode,
      final CompleteProfileStep step,
      final RequestState status,
      final OtpChallengeEntity? challenge,
      final Failure? error}) = _$CompleteProfileStateImpl;
  const _CompleteProfileState._() : super._();

  @override
  String get phone;
  @override
  String get otpCode;
  @override
  CompleteProfileStep get step;
  @override
  RequestState get status;
  @override
  OtpChallengeEntity? get challenge;
  @override
  Failure? get error;

  /// Create a copy of CompleteProfileState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CompleteProfileStateImplCopyWith<_$CompleteProfileStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
