// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'save_offer_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$SaveOfferState {
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of SaveOfferState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SaveOfferStateCopyWith<SaveOfferState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SaveOfferStateCopyWith<$Res> {
  factory $SaveOfferStateCopyWith(
          SaveOfferState value, $Res Function(SaveOfferState) then) =
      _$SaveOfferStateCopyWithImpl<$Res, SaveOfferState>;
  @useResult
  $Res call({RequestState status, Failure? error});
}

/// @nodoc
class _$SaveOfferStateCopyWithImpl<$Res, $Val extends SaveOfferState>
    implements $SaveOfferStateCopyWith<$Res> {
  _$SaveOfferStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SaveOfferState
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
abstract class _$$SaveOfferStateImplCopyWith<$Res>
    implements $SaveOfferStateCopyWith<$Res> {
  factory _$$SaveOfferStateImplCopyWith(_$SaveOfferStateImpl value,
          $Res Function(_$SaveOfferStateImpl) then) =
      __$$SaveOfferStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({RequestState status, Failure? error});
}

/// @nodoc
class __$$SaveOfferStateImplCopyWithImpl<$Res>
    extends _$SaveOfferStateCopyWithImpl<$Res, _$SaveOfferStateImpl>
    implements _$$SaveOfferStateImplCopyWith<$Res> {
  __$$SaveOfferStateImplCopyWithImpl(
      _$SaveOfferStateImpl _value, $Res Function(_$SaveOfferStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of SaveOfferState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? error = freezed,
  }) {
    return _then(_$SaveOfferStateImpl(
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

class _$SaveOfferStateImpl extends _SaveOfferState {
  const _$SaveOfferStateImpl({this.status = RequestState.initial, this.error})
      : super._();

  @override
  @JsonKey()
  final RequestState status;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'SaveOfferState(status: $status, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SaveOfferStateImpl &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(runtimeType, status, error);

  /// Create a copy of SaveOfferState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SaveOfferStateImplCopyWith<_$SaveOfferStateImpl> get copyWith =>
      __$$SaveOfferStateImplCopyWithImpl<_$SaveOfferStateImpl>(
          this, _$identity);
}

abstract class _SaveOfferState extends SaveOfferState {
  const factory _SaveOfferState(
      {final RequestState status, final Failure? error}) = _$SaveOfferStateImpl;
  const _SaveOfferState._() : super._();

  @override
  RequestState get status;
  @override
  Failure? get error;

  /// Create a copy of SaveOfferState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SaveOfferStateImplCopyWith<_$SaveOfferStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
