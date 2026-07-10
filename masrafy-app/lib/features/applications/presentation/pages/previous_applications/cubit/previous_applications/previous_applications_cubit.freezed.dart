// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'previous_applications_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$PreviousApplicationsState {
  RequestState get status => throw _privateConstructorUsedError;
  List<PastApplication> get applications => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of PreviousApplicationsState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PreviousApplicationsStateCopyWith<PreviousApplicationsState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PreviousApplicationsStateCopyWith<$Res> {
  factory $PreviousApplicationsStateCopyWith(PreviousApplicationsState value,
          $Res Function(PreviousApplicationsState) then) =
      _$PreviousApplicationsStateCopyWithImpl<$Res, PreviousApplicationsState>;
  @useResult
  $Res call(
      {RequestState status,
      List<PastApplication> applications,
      Failure? error});
}

/// @nodoc
class _$PreviousApplicationsStateCopyWithImpl<$Res,
        $Val extends PreviousApplicationsState>
    implements $PreviousApplicationsStateCopyWith<$Res> {
  _$PreviousApplicationsStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PreviousApplicationsState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? applications = null,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      applications: null == applications
          ? _value.applications
          : applications // ignore: cast_nullable_to_non_nullable
              as List<PastApplication>,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PreviousApplicationsStateImplCopyWith<$Res>
    implements $PreviousApplicationsStateCopyWith<$Res> {
  factory _$$PreviousApplicationsStateImplCopyWith(
          _$PreviousApplicationsStateImpl value,
          $Res Function(_$PreviousApplicationsStateImpl) then) =
      __$$PreviousApplicationsStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {RequestState status,
      List<PastApplication> applications,
      Failure? error});
}

/// @nodoc
class __$$PreviousApplicationsStateImplCopyWithImpl<$Res>
    extends _$PreviousApplicationsStateCopyWithImpl<$Res,
        _$PreviousApplicationsStateImpl>
    implements _$$PreviousApplicationsStateImplCopyWith<$Res> {
  __$$PreviousApplicationsStateImplCopyWithImpl(
      _$PreviousApplicationsStateImpl _value,
      $Res Function(_$PreviousApplicationsStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of PreviousApplicationsState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? applications = null,
    Object? error = freezed,
  }) {
    return _then(_$PreviousApplicationsStateImpl(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      applications: null == applications
          ? _value._applications
          : applications // ignore: cast_nullable_to_non_nullable
              as List<PastApplication>,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$PreviousApplicationsStateImpl extends _PreviousApplicationsState {
  const _$PreviousApplicationsStateImpl(
      {this.status = RequestState.initial,
      final List<PastApplication> applications = const <PastApplication>[],
      this.error})
      : _applications = applications,
        super._();

  @override
  @JsonKey()
  final RequestState status;
  final List<PastApplication> _applications;
  @override
  @JsonKey()
  List<PastApplication> get applications {
    if (_applications is EqualUnmodifiableListView) return _applications;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_applications);
  }

  @override
  final Failure? error;

  @override
  String toString() {
    return 'PreviousApplicationsState(status: $status, applications: $applications, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PreviousApplicationsStateImpl &&
            (identical(other.status, status) || other.status == status) &&
            const DeepCollectionEquality()
                .equals(other._applications, _applications) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(runtimeType, status,
      const DeepCollectionEquality().hash(_applications), error);

  /// Create a copy of PreviousApplicationsState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PreviousApplicationsStateImplCopyWith<_$PreviousApplicationsStateImpl>
      get copyWith => __$$PreviousApplicationsStateImplCopyWithImpl<
          _$PreviousApplicationsStateImpl>(this, _$identity);
}

abstract class _PreviousApplicationsState extends PreviousApplicationsState {
  const factory _PreviousApplicationsState(
      {final RequestState status,
      final List<PastApplication> applications,
      final Failure? error}) = _$PreviousApplicationsStateImpl;
  const _PreviousApplicationsState._() : super._();

  @override
  RequestState get status;
  @override
  List<PastApplication> get applications;
  @override
  Failure? get error;

  /// Create a copy of PreviousApplicationsState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PreviousApplicationsStateImplCopyWith<_$PreviousApplicationsStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
