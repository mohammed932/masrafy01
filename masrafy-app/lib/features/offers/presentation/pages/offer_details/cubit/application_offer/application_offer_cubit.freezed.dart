// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'application_offer_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ApplicationOfferState {
  RequestState get status => throw _privateConstructorUsedError;
  PastApplication? get application => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of ApplicationOfferState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ApplicationOfferStateCopyWith<ApplicationOfferState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ApplicationOfferStateCopyWith<$Res> {
  factory $ApplicationOfferStateCopyWith(ApplicationOfferState value,
          $Res Function(ApplicationOfferState) then) =
      _$ApplicationOfferStateCopyWithImpl<$Res, ApplicationOfferState>;
  @useResult
  $Res call(
      {RequestState status, PastApplication? application, Failure? error});
}

/// @nodoc
class _$ApplicationOfferStateCopyWithImpl<$Res,
        $Val extends ApplicationOfferState>
    implements $ApplicationOfferStateCopyWith<$Res> {
  _$ApplicationOfferStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ApplicationOfferState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? application = freezed,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      application: freezed == application
          ? _value.application
          : application // ignore: cast_nullable_to_non_nullable
              as PastApplication?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ApplicationOfferStateImplCopyWith<$Res>
    implements $ApplicationOfferStateCopyWith<$Res> {
  factory _$$ApplicationOfferStateImplCopyWith(
          _$ApplicationOfferStateImpl value,
          $Res Function(_$ApplicationOfferStateImpl) then) =
      __$$ApplicationOfferStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {RequestState status, PastApplication? application, Failure? error});
}

/// @nodoc
class __$$ApplicationOfferStateImplCopyWithImpl<$Res>
    extends _$ApplicationOfferStateCopyWithImpl<$Res,
        _$ApplicationOfferStateImpl>
    implements _$$ApplicationOfferStateImplCopyWith<$Res> {
  __$$ApplicationOfferStateImplCopyWithImpl(_$ApplicationOfferStateImpl _value,
      $Res Function(_$ApplicationOfferStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of ApplicationOfferState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? application = freezed,
    Object? error = freezed,
  }) {
    return _then(_$ApplicationOfferStateImpl(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      application: freezed == application
          ? _value.application
          : application // ignore: cast_nullable_to_non_nullable
              as PastApplication?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$ApplicationOfferStateImpl extends _ApplicationOfferState {
  const _$ApplicationOfferStateImpl(
      {this.status = RequestState.initial, this.application, this.error})
      : super._();

  @override
  @JsonKey()
  final RequestState status;
  @override
  final PastApplication? application;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'ApplicationOfferState(status: $status, application: $application, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ApplicationOfferStateImpl &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.application, application) ||
                other.application == application) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(runtimeType, status, application, error);

  /// Create a copy of ApplicationOfferState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ApplicationOfferStateImplCopyWith<_$ApplicationOfferStateImpl>
      get copyWith => __$$ApplicationOfferStateImplCopyWithImpl<
          _$ApplicationOfferStateImpl>(this, _$identity);
}

abstract class _ApplicationOfferState extends ApplicationOfferState {
  const factory _ApplicationOfferState(
      {final RequestState status,
      final PastApplication? application,
      final Failure? error}) = _$ApplicationOfferStateImpl;
  const _ApplicationOfferState._() : super._();

  @override
  RequestState get status;
  @override
  PastApplication? get application;
  @override
  Failure? get error;

  /// Create a copy of ApplicationOfferState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ApplicationOfferStateImplCopyWith<_$ApplicationOfferStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
