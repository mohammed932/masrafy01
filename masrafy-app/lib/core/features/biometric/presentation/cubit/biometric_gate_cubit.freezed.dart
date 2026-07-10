// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'biometric_gate_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$BiometricGateState {
  BiometricGateStatus get status => throw _privateConstructorUsedError;

  /// Create a copy of BiometricGateState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BiometricGateStateCopyWith<BiometricGateState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BiometricGateStateCopyWith<$Res> {
  factory $BiometricGateStateCopyWith(
          BiometricGateState value, $Res Function(BiometricGateState) then) =
      _$BiometricGateStateCopyWithImpl<$Res, BiometricGateState>;
  @useResult
  $Res call({BiometricGateStatus status});
}

/// @nodoc
class _$BiometricGateStateCopyWithImpl<$Res, $Val extends BiometricGateState>
    implements $BiometricGateStateCopyWith<$Res> {
  _$BiometricGateStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BiometricGateState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
  }) {
    return _then(_value.copyWith(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as BiometricGateStatus,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$BiometricGateStateImplCopyWith<$Res>
    implements $BiometricGateStateCopyWith<$Res> {
  factory _$$BiometricGateStateImplCopyWith(_$BiometricGateStateImpl value,
          $Res Function(_$BiometricGateStateImpl) then) =
      __$$BiometricGateStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({BiometricGateStatus status});
}

/// @nodoc
class __$$BiometricGateStateImplCopyWithImpl<$Res>
    extends _$BiometricGateStateCopyWithImpl<$Res, _$BiometricGateStateImpl>
    implements _$$BiometricGateStateImplCopyWith<$Res> {
  __$$BiometricGateStateImplCopyWithImpl(_$BiometricGateStateImpl _value,
      $Res Function(_$BiometricGateStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of BiometricGateState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
  }) {
    return _then(_$BiometricGateStateImpl(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as BiometricGateStatus,
    ));
  }
}

/// @nodoc

class _$BiometricGateStateImpl implements _BiometricGateState {
  const _$BiometricGateStateImpl({this.status = BiometricGateStatus.idle});

  @override
  @JsonKey()
  final BiometricGateStatus status;

  @override
  String toString() {
    return 'BiometricGateState(status: $status)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BiometricGateStateImpl &&
            (identical(other.status, status) || other.status == status));
  }

  @override
  int get hashCode => Object.hash(runtimeType, status);

  /// Create a copy of BiometricGateState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BiometricGateStateImplCopyWith<_$BiometricGateStateImpl> get copyWith =>
      __$$BiometricGateStateImplCopyWithImpl<_$BiometricGateStateImpl>(
          this, _$identity);
}

abstract class _BiometricGateState implements BiometricGateState {
  const factory _BiometricGateState({final BiometricGateStatus status}) =
      _$BiometricGateStateImpl;

  @override
  BiometricGateStatus get status;

  /// Create a copy of BiometricGateState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BiometricGateStateImplCopyWith<_$BiometricGateStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
