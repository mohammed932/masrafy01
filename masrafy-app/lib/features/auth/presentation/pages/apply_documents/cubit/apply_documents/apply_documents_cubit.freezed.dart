// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'apply_documents_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ApplyDocumentsState {
  RequestState get loadStatus => throw _privateConstructorUsedError;
  bool get idFrontUploaded => throw _privateConstructorUsedError;
  bool get idFrontUploading => throw _privateConstructorUsedError;
  bool get idBackUploaded => throw _privateConstructorUsedError;
  bool get idBackUploading => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of ApplyDocumentsState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ApplyDocumentsStateCopyWith<ApplyDocumentsState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ApplyDocumentsStateCopyWith<$Res> {
  factory $ApplyDocumentsStateCopyWith(
          ApplyDocumentsState value, $Res Function(ApplyDocumentsState) then) =
      _$ApplyDocumentsStateCopyWithImpl<$Res, ApplyDocumentsState>;
  @useResult
  $Res call(
      {RequestState loadStatus,
      bool idFrontUploaded,
      bool idFrontUploading,
      bool idBackUploaded,
      bool idBackUploading,
      Failure? error});
}

/// @nodoc
class _$ApplyDocumentsStateCopyWithImpl<$Res, $Val extends ApplyDocumentsState>
    implements $ApplyDocumentsStateCopyWith<$Res> {
  _$ApplyDocumentsStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ApplyDocumentsState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? loadStatus = null,
    Object? idFrontUploaded = null,
    Object? idFrontUploading = null,
    Object? idBackUploaded = null,
    Object? idBackUploading = null,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      loadStatus: null == loadStatus
          ? _value.loadStatus
          : loadStatus // ignore: cast_nullable_to_non_nullable
              as RequestState,
      idFrontUploaded: null == idFrontUploaded
          ? _value.idFrontUploaded
          : idFrontUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      idFrontUploading: null == idFrontUploading
          ? _value.idFrontUploading
          : idFrontUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      idBackUploaded: null == idBackUploaded
          ? _value.idBackUploaded
          : idBackUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      idBackUploading: null == idBackUploading
          ? _value.idBackUploading
          : idBackUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ApplyDocumentsStateImplCopyWith<$Res>
    implements $ApplyDocumentsStateCopyWith<$Res> {
  factory _$$ApplyDocumentsStateImplCopyWith(_$ApplyDocumentsStateImpl value,
          $Res Function(_$ApplyDocumentsStateImpl) then) =
      __$$ApplyDocumentsStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {RequestState loadStatus,
      bool idFrontUploaded,
      bool idFrontUploading,
      bool idBackUploaded,
      bool idBackUploading,
      Failure? error});
}

/// @nodoc
class __$$ApplyDocumentsStateImplCopyWithImpl<$Res>
    extends _$ApplyDocumentsStateCopyWithImpl<$Res, _$ApplyDocumentsStateImpl>
    implements _$$ApplyDocumentsStateImplCopyWith<$Res> {
  __$$ApplyDocumentsStateImplCopyWithImpl(_$ApplyDocumentsStateImpl _value,
      $Res Function(_$ApplyDocumentsStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of ApplyDocumentsState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? loadStatus = null,
    Object? idFrontUploaded = null,
    Object? idFrontUploading = null,
    Object? idBackUploaded = null,
    Object? idBackUploading = null,
    Object? error = freezed,
  }) {
    return _then(_$ApplyDocumentsStateImpl(
      loadStatus: null == loadStatus
          ? _value.loadStatus
          : loadStatus // ignore: cast_nullable_to_non_nullable
              as RequestState,
      idFrontUploaded: null == idFrontUploaded
          ? _value.idFrontUploaded
          : idFrontUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      idFrontUploading: null == idFrontUploading
          ? _value.idFrontUploading
          : idFrontUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      idBackUploaded: null == idBackUploaded
          ? _value.idBackUploaded
          : idBackUploaded // ignore: cast_nullable_to_non_nullable
              as bool,
      idBackUploading: null == idBackUploading
          ? _value.idBackUploading
          : idBackUploading // ignore: cast_nullable_to_non_nullable
              as bool,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$ApplyDocumentsStateImpl extends _ApplyDocumentsState {
  const _$ApplyDocumentsStateImpl(
      {this.loadStatus = RequestState.initial,
      this.idFrontUploaded = false,
      this.idFrontUploading = false,
      this.idBackUploaded = false,
      this.idBackUploading = false,
      this.error})
      : super._();

  @override
  @JsonKey()
  final RequestState loadStatus;
  @override
  @JsonKey()
  final bool idFrontUploaded;
  @override
  @JsonKey()
  final bool idFrontUploading;
  @override
  @JsonKey()
  final bool idBackUploaded;
  @override
  @JsonKey()
  final bool idBackUploading;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'ApplyDocumentsState(loadStatus: $loadStatus, idFrontUploaded: $idFrontUploaded, idFrontUploading: $idFrontUploading, idBackUploaded: $idBackUploaded, idBackUploading: $idBackUploading, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ApplyDocumentsStateImpl &&
            (identical(other.loadStatus, loadStatus) ||
                other.loadStatus == loadStatus) &&
            (identical(other.idFrontUploaded, idFrontUploaded) ||
                other.idFrontUploaded == idFrontUploaded) &&
            (identical(other.idFrontUploading, idFrontUploading) ||
                other.idFrontUploading == idFrontUploading) &&
            (identical(other.idBackUploaded, idBackUploaded) ||
                other.idBackUploaded == idBackUploaded) &&
            (identical(other.idBackUploading, idBackUploading) ||
                other.idBackUploading == idBackUploading) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(runtimeType, loadStatus, idFrontUploaded,
      idFrontUploading, idBackUploaded, idBackUploading, error);

  /// Create a copy of ApplyDocumentsState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ApplyDocumentsStateImplCopyWith<_$ApplyDocumentsStateImpl> get copyWith =>
      __$$ApplyDocumentsStateImplCopyWithImpl<_$ApplyDocumentsStateImpl>(
          this, _$identity);
}

abstract class _ApplyDocumentsState extends ApplyDocumentsState {
  const factory _ApplyDocumentsState(
      {final RequestState loadStatus,
      final bool idFrontUploaded,
      final bool idFrontUploading,
      final bool idBackUploaded,
      final bool idBackUploading,
      final Failure? error}) = _$ApplyDocumentsStateImpl;
  const _ApplyDocumentsState._() : super._();

  @override
  RequestState get loadStatus;
  @override
  bool get idFrontUploaded;
  @override
  bool get idFrontUploading;
  @override
  bool get idBackUploaded;
  @override
  bool get idBackUploading;
  @override
  Failure? get error;

  /// Create a copy of ApplyDocumentsState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ApplyDocumentsStateImplCopyWith<_$ApplyDocumentsStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
