// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'select_offer_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$SelectOfferState {
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of SelectOfferState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SelectOfferStateCopyWith<SelectOfferState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SelectOfferStateCopyWith<$Res> {
  factory $SelectOfferStateCopyWith(
          SelectOfferState value, $Res Function(SelectOfferState) then) =
      _$SelectOfferStateCopyWithImpl<$Res, SelectOfferState>;
  @useResult
  $Res call({RequestState status, Failure? error});
}

/// @nodoc
class _$SelectOfferStateCopyWithImpl<$Res, $Val extends SelectOfferState>
    implements $SelectOfferStateCopyWith<$Res> {
  _$SelectOfferStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SelectOfferState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
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
abstract class _$$SelectOfferStateImplCopyWith<$Res>
    implements $SelectOfferStateCopyWith<$Res> {
  factory _$$SelectOfferStateImplCopyWith(_$SelectOfferStateImpl value,
          $Res Function(_$SelectOfferStateImpl) then) =
      __$$SelectOfferStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({RequestState status, Failure? error});
}

/// @nodoc
class __$$SelectOfferStateImplCopyWithImpl<$Res>
    extends _$SelectOfferStateCopyWithImpl<$Res, _$SelectOfferStateImpl>
    implements _$$SelectOfferStateImplCopyWith<$Res> {
  __$$SelectOfferStateImplCopyWithImpl(_$SelectOfferStateImpl _value,
      $Res Function(_$SelectOfferStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of SelectOfferState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? error = freezed,
  }) {
    return _then(_$SelectOfferStateImpl(
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

class _$SelectOfferStateImpl extends _SelectOfferState {
  const _$SelectOfferStateImpl({this.status = RequestState.initial, this.error})
      : super._();

  @override
  @JsonKey()
  final RequestState status;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'SelectOfferState(status: $status, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SelectOfferStateImpl &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(runtimeType, status, error);

  /// Create a copy of SelectOfferState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SelectOfferStateImplCopyWith<_$SelectOfferStateImpl> get copyWith =>
      __$$SelectOfferStateImplCopyWithImpl<_$SelectOfferStateImpl>(
          this, _$identity);
}

abstract class _SelectOfferState extends SelectOfferState {
  const factory _SelectOfferState(
      {final RequestState status,
      final Failure? error}) = _$SelectOfferStateImpl;
  const _SelectOfferState._() : super._();

  @override
  RequestState get status;
  @override
  Failure? get error;

  /// Create a copy of SelectOfferState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SelectOfferStateImplCopyWith<_$SelectOfferStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
