// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'national_id_status_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$NationalIdStatusState {
  RequestState get status => throw _privateConstructorUsedError;
  bool get frontUploaded => throw _privateConstructorUsedError;
  bool get backUploaded => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of NationalIdStatusState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $NationalIdStatusStateCopyWith<NationalIdStatusState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $NationalIdStatusStateCopyWith<$Res> {
  factory $NationalIdStatusStateCopyWith(NationalIdStatusState value,
          $Res Function(NationalIdStatusState) then) =
      _$NationalIdStatusStateCopyWithImpl<$Res, NationalIdStatusState>;
  @useResult
  $Res call(
      {RequestState status,
      bool frontUploaded,
      bool backUploaded,
      Failure? error});
}

/// @nodoc
class _$NationalIdStatusStateCopyWithImpl<$Res,
        $Val extends NationalIdStatusState>
    implements $NationalIdStatusStateCopyWith<$Res> {
  _$NationalIdStatusStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of NationalIdStatusState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? frontUploaded = null,
    Object? backUploaded = null,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      frontUploaded: null == frontUploaded
          ? _value.frontUploaded
          : frontUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      backUploaded: null == backUploaded
          ? _value.backUploaded
          : backUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$NationalIdStatusStateImplCopyWith<$Res>
    implements $NationalIdStatusStateCopyWith<$Res> {
  factory _$$NationalIdStatusStateImplCopyWith(
          _$NationalIdStatusStateImpl value,
          $Res Function(_$NationalIdStatusStateImpl) then) =
      __$$NationalIdStatusStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {RequestState status,
      bool frontUploaded,
      bool backUploaded,
      Failure? error});
}

/// @nodoc
class __$$NationalIdStatusStateImplCopyWithImpl<$Res>
    extends _$NationalIdStatusStateCopyWithImpl<$Res,
        _$NationalIdStatusStateImpl>
    implements _$$NationalIdStatusStateImplCopyWith<$Res> {
  __$$NationalIdStatusStateImplCopyWithImpl(_$NationalIdStatusStateImpl _value,
      $Res Function(_$NationalIdStatusStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of NationalIdStatusState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? frontUploaded = null,
    Object? backUploaded = null,
    Object? error = freezed,
  }) {
    return _then(_$NationalIdStatusStateImpl(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      frontUploaded: null == frontUploaded
          ? _value.frontUploaded
          : frontUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      backUploaded: null == backUploaded
          ? _value.backUploaded
          : backUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$NationalIdStatusStateImpl extends _NationalIdStatusState {
  const _$NationalIdStatusStateImpl(
      {this.status = RequestState.initial,
      this.frontUploaded = false,
      this.backUploaded = false,
      this.error})
      : super._();

  @override
  @JsonKey()
  final RequestState status;
  @override
  @JsonKey()
  final bool frontUploaded;
  @override
  @JsonKey()
  final bool backUploaded;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'NationalIdStatusState(status: $status, frontUploaded: $frontUploaded, backUploaded: $backUploaded, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NationalIdStatusStateImpl &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.frontUploaded, frontUploaded) ||
                other.frontUploaded == frontUploaded) &&
            (identical(other.backUploaded, backUploaded) ||
                other.backUploaded == backUploaded) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, status, frontUploaded, backUploaded, error);

  /// Create a copy of NationalIdStatusState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NationalIdStatusStateImplCopyWith<_$NationalIdStatusStateImpl>
      get copyWith => __$$NationalIdStatusStateImplCopyWithImpl<
          _$NationalIdStatusStateImpl>(this, _$identity);
}

abstract class _NationalIdStatusState extends NationalIdStatusState {
  const factory _NationalIdStatusState(
      {final RequestState status,
      final bool frontUploaded,
      final bool backUploaded,
      final Failure? error}) = _$NationalIdStatusStateImpl;
  const _NationalIdStatusState._() : super._();

  @override
  RequestState get status;
  @override
  bool get frontUploaded;
  @override
  bool get backUploaded;
  @override
  Failure? get error;

  /// Create a copy of NationalIdStatusState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NationalIdStatusStateImplCopyWith<_$NationalIdStatusStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
