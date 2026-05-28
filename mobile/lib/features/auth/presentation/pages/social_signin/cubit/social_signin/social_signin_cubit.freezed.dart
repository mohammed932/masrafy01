// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'social_signin_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$SocialSignInState {
  SocialSignInStep get step => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  bool get cancelled => throw _privateConstructorUsedError;
  SocialSessionEntity? get socialSession => throw _privateConstructorUsedError;
  CustomerSessionEntity? get customerSession =>
      throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of SocialSignInState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SocialSignInStateCopyWith<SocialSignInState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SocialSignInStateCopyWith<$Res> {
  factory $SocialSignInStateCopyWith(
          SocialSignInState value, $Res Function(SocialSignInState) then) =
      _$SocialSignInStateCopyWithImpl<$Res, SocialSignInState>;
  @useResult
  $Res call(
      {SocialSignInStep step,
      RequestState status,
      bool cancelled,
      SocialSessionEntity? socialSession,
      CustomerSessionEntity? customerSession,
      Failure? error});
}

/// @nodoc
class _$SocialSignInStateCopyWithImpl<$Res, $Val extends SocialSignInState>
    implements $SocialSignInStateCopyWith<$Res> {
  _$SocialSignInStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SocialSignInState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? step = null,
    Object? status = null,
    Object? cancelled = null,
    Object? socialSession = freezed,
    Object? customerSession = freezed,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as SocialSignInStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      cancelled: null == cancelled
          ? _value.cancelled
          : cancelled // ignore: cast_nullable_to_non_nullable
              as bool,
      socialSession: freezed == socialSession
          ? _value.socialSession
          : socialSession // ignore: cast_nullable_to_non_nullable
              as SocialSessionEntity?,
      customerSession: freezed == customerSession
          ? _value.customerSession
          : customerSession // ignore: cast_nullable_to_non_nullable
              as CustomerSessionEntity?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SocialSignInStateImplCopyWith<$Res>
    implements $SocialSignInStateCopyWith<$Res> {
  factory _$$SocialSignInStateImplCopyWith(_$SocialSignInStateImpl value,
          $Res Function(_$SocialSignInStateImpl) then) =
      __$$SocialSignInStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {SocialSignInStep step,
      RequestState status,
      bool cancelled,
      SocialSessionEntity? socialSession,
      CustomerSessionEntity? customerSession,
      Failure? error});
}

/// @nodoc
class __$$SocialSignInStateImplCopyWithImpl<$Res>
    extends _$SocialSignInStateCopyWithImpl<$Res, _$SocialSignInStateImpl>
    implements _$$SocialSignInStateImplCopyWith<$Res> {
  __$$SocialSignInStateImplCopyWithImpl(_$SocialSignInStateImpl _value,
      $Res Function(_$SocialSignInStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of SocialSignInState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? step = null,
    Object? status = null,
    Object? cancelled = null,
    Object? socialSession = freezed,
    Object? customerSession = freezed,
    Object? error = freezed,
  }) {
    return _then(_$SocialSignInStateImpl(
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as SocialSignInStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      cancelled: null == cancelled
          ? _value.cancelled
          : cancelled // ignore: cast_nullable_to_non_nullable
              as bool,
      socialSession: freezed == socialSession
          ? _value.socialSession
          : socialSession // ignore: cast_nullable_to_non_nullable
              as SocialSessionEntity?,
      customerSession: freezed == customerSession
          ? _value.customerSession
          : customerSession // ignore: cast_nullable_to_non_nullable
              as CustomerSessionEntity?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$SocialSignInStateImpl extends _SocialSignInState {
  const _$SocialSignInStateImpl(
      {this.step = SocialSignInStep.idle,
      this.status = RequestState.initial,
      this.cancelled = false,
      this.socialSession,
      this.customerSession,
      this.error})
      : super._();

  @override
  @JsonKey()
  final SocialSignInStep step;
  @override
  @JsonKey()
  final RequestState status;
  @override
  @JsonKey()
  final bool cancelled;
  @override
  final SocialSessionEntity? socialSession;
  @override
  final CustomerSessionEntity? customerSession;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'SocialSignInState(step: $step, status: $status, cancelled: $cancelled, socialSession: $socialSession, customerSession: $customerSession, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SocialSignInStateImpl &&
            (identical(other.step, step) || other.step == step) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.cancelled, cancelled) ||
                other.cancelled == cancelled) &&
            (identical(other.socialSession, socialSession) ||
                other.socialSession == socialSession) &&
            (identical(other.customerSession, customerSession) ||
                other.customerSession == customerSession) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(runtimeType, step, status, cancelled,
      socialSession, customerSession, error);

  /// Create a copy of SocialSignInState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SocialSignInStateImplCopyWith<_$SocialSignInStateImpl> get copyWith =>
      __$$SocialSignInStateImplCopyWithImpl<_$SocialSignInStateImpl>(
          this, _$identity);
}

abstract class _SocialSignInState extends SocialSignInState {
  const factory _SocialSignInState(
      {final SocialSignInStep step,
      final RequestState status,
      final bool cancelled,
      final SocialSessionEntity? socialSession,
      final CustomerSessionEntity? customerSession,
      final Failure? error}) = _$SocialSignInStateImpl;
  const _SocialSignInState._() : super._();

  @override
  SocialSignInStep get step;
  @override
  RequestState get status;
  @override
  bool get cancelled;
  @override
  SocialSessionEntity? get socialSession;
  @override
  CustomerSessionEntity? get customerSession;
  @override
  Failure? get error;

  /// Create a copy of SocialSignInState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SocialSignInStateImplCopyWith<_$SocialSignInStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
