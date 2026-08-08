// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'home_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$HomeState {
  HomeLoanCategory get selected => throw _privateConstructorUsedError;

  /// Whole `program_name` catalog, unfiltered — [programsForCategory] narrows
  /// it per selection.
  List<PlatformEnumerationEntity> get programs =>
      throw _privateConstructorUsedError;
  RequestState get programsStatus => throw _privateConstructorUsedError;

  /// The picked catalog name, or null when nothing is picked yet / the
  /// category offers none.
  String? get programKey => throw _privateConstructorUsedError;

  /// Create a copy of HomeState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $HomeStateCopyWith<HomeState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $HomeStateCopyWith<$Res> {
  factory $HomeStateCopyWith(HomeState value, $Res Function(HomeState) then) =
      _$HomeStateCopyWithImpl<$Res, HomeState>;
  @useResult
  $Res call(
      {HomeLoanCategory selected,
      List<PlatformEnumerationEntity> programs,
      RequestState programsStatus,
      String? programKey});
}

/// @nodoc
class _$HomeStateCopyWithImpl<$Res, $Val extends HomeState>
    implements $HomeStateCopyWith<$Res> {
  _$HomeStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of HomeState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? selected = null,
    Object? programs = null,
    Object? programsStatus = null,
    Object? programKey = freezed,
  }) {
    return _then(_value.copyWith(
      selected: null == selected
          ? _value.selected
          : selected // ignore: cast_nullable_to_non_nullable
              as HomeLoanCategory,
      programs: null == programs
          ? _value.programs
          : programs // ignore: cast_nullable_to_non_nullable
              as List<PlatformEnumerationEntity>,
      programsStatus: null == programsStatus
          ? _value.programsStatus
          : programsStatus // ignore: cast_nullable_to_non_nullable
              as RequestState,
      programKey: freezed == programKey
          ? _value.programKey
          : programKey // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$HomeStateImplCopyWith<$Res>
    implements $HomeStateCopyWith<$Res> {
  factory _$$HomeStateImplCopyWith(
          _$HomeStateImpl value, $Res Function(_$HomeStateImpl) then) =
      __$$HomeStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {HomeLoanCategory selected,
      List<PlatformEnumerationEntity> programs,
      RequestState programsStatus,
      String? programKey});
}

/// @nodoc
class __$$HomeStateImplCopyWithImpl<$Res>
    extends _$HomeStateCopyWithImpl<$Res, _$HomeStateImpl>
    implements _$$HomeStateImplCopyWith<$Res> {
  __$$HomeStateImplCopyWithImpl(
      _$HomeStateImpl _value, $Res Function(_$HomeStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of HomeState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? selected = null,
    Object? programs = null,
    Object? programsStatus = null,
    Object? programKey = freezed,
  }) {
    return _then(_$HomeStateImpl(
      selected: null == selected
          ? _value.selected
          : selected // ignore: cast_nullable_to_non_nullable
              as HomeLoanCategory,
      programs: null == programs
          ? _value._programs
          : programs // ignore: cast_nullable_to_non_nullable
              as List<PlatformEnumerationEntity>,
      programsStatus: null == programsStatus
          ? _value.programsStatus
          : programsStatus // ignore: cast_nullable_to_non_nullable
              as RequestState,
      programKey: freezed == programKey
          ? _value.programKey
          : programKey // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class _$HomeStateImpl extends _HomeState {
  const _$HomeStateImpl(
      {this.selected = HomeLoanCategory.personal,
      final List<PlatformEnumerationEntity> programs =
          const <PlatformEnumerationEntity>[],
      this.programsStatus = RequestState.initial,
      this.programKey})
      : _programs = programs,
        super._();

  @override
  @JsonKey()
  final HomeLoanCategory selected;

  /// Whole `program_name` catalog, unfiltered — [programsForCategory] narrows
  /// it per selection.
  final List<PlatformEnumerationEntity> _programs;

  /// Whole `program_name` catalog, unfiltered — [programsForCategory] narrows
  /// it per selection.
  @override
  @JsonKey()
  List<PlatformEnumerationEntity> get programs {
    if (_programs is EqualUnmodifiableListView) return _programs;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_programs);
  }

  @override
  @JsonKey()
  final RequestState programsStatus;

  /// The picked catalog name, or null when nothing is picked yet / the
  /// category offers none.
  @override
  final String? programKey;

  @override
  String toString() {
    return 'HomeState(selected: $selected, programs: $programs, programsStatus: $programsStatus, programKey: $programKey)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$HomeStateImpl &&
            (identical(other.selected, selected) ||
                other.selected == selected) &&
            const DeepCollectionEquality().equals(other._programs, _programs) &&
            (identical(other.programsStatus, programsStatus) ||
                other.programsStatus == programsStatus) &&
            (identical(other.programKey, programKey) ||
                other.programKey == programKey));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      selected,
      const DeepCollectionEquality().hash(_programs),
      programsStatus,
      programKey);

  /// Create a copy of HomeState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$HomeStateImplCopyWith<_$HomeStateImpl> get copyWith =>
      __$$HomeStateImplCopyWithImpl<_$HomeStateImpl>(this, _$identity);
}

abstract class _HomeState extends HomeState {
  const factory _HomeState(
      {final HomeLoanCategory selected,
      final List<PlatformEnumerationEntity> programs,
      final RequestState programsStatus,
      final String? programKey}) = _$HomeStateImpl;
  const _HomeState._() : super._();

  @override
  HomeLoanCategory get selected;

  /// Whole `program_name` catalog, unfiltered — [programsForCategory] narrows
  /// it per selection.
  @override
  List<PlatformEnumerationEntity> get programs;
  @override
  RequestState get programsStatus;

  /// The picked catalog name, or null when nothing is picked yet / the
  /// category offers none.
  @override
  String? get programKey;

  /// Create a copy of HomeState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$HomeStateImplCopyWith<_$HomeStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
