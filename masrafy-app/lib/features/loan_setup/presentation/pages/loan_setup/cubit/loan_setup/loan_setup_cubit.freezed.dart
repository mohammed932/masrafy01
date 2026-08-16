// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'loan_setup_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$LoanSetupState {
  LoanCategory get category => throw _privateConstructorUsedError;

  /// What the backend says is pickable for [category]. Null until the first
  /// successful read, and cleared on every category change so a stale list can
  /// never be rendered under a new heading.
  ProgramOptionsEntity? get options => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get failure => throw _privateConstructorUsedError;

  /// The chosen income basis, or null before step 2 is answered.
  IncomeType? get incomeType => throw _privateConstructorUsedError;

  /// The chosen catalog name, or null before step 3 is answered / when the
  /// chosen basis offers none.
  String? get programKey => throw _privateConstructorUsedError;
  int get currentStep => throw _privateConstructorUsedError;

  /// One-shot: the page has everything it needs and should route on.
  bool get submitted => throw _privateConstructorUsedError;

  /// Create a copy of LoanSetupState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $LoanSetupStateCopyWith<LoanSetupState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LoanSetupStateCopyWith<$Res> {
  factory $LoanSetupStateCopyWith(
          LoanSetupState value, $Res Function(LoanSetupState) then) =
      _$LoanSetupStateCopyWithImpl<$Res, LoanSetupState>;
  @useResult
  $Res call(
      {LoanCategory category,
      ProgramOptionsEntity? options,
      RequestState status,
      Failure? failure,
      IncomeType? incomeType,
      String? programKey,
      int currentStep,
      bool submitted});
}

/// @nodoc
class _$LoanSetupStateCopyWithImpl<$Res, $Val extends LoanSetupState>
    implements $LoanSetupStateCopyWith<$Res> {
  _$LoanSetupStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of LoanSetupState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? category = null,
    Object? options = freezed,
    Object? status = null,
    Object? failure = freezed,
    Object? incomeType = freezed,
    Object? programKey = freezed,
    Object? currentStep = null,
    Object? submitted = null,
  }) {
    return _then(_value.copyWith(
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as LoanCategory,
      options: freezed == options
          ? _value.options
          : options // ignore: cast_nullable_to_non_nullable
              as ProgramOptionsEntity?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      failure: freezed == failure
          ? _value.failure
          : failure // ignore: cast_nullable_to_non_nullable
              as Failure?,
      incomeType: freezed == incomeType
          ? _value.incomeType
          : incomeType // ignore: cast_nullable_to_non_nullable
              as IncomeType?,
      programKey: freezed == programKey
          ? _value.programKey
          : programKey // ignore: cast_nullable_to_non_nullable
              as String?,
      currentStep: null == currentStep
          ? _value.currentStep
          : currentStep // ignore: cast_nullable_to_non_nullable
              as int,
      submitted: null == submitted
          ? _value.submitted
          : submitted // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$LoanSetupStateImplCopyWith<$Res>
    implements $LoanSetupStateCopyWith<$Res> {
  factory _$$LoanSetupStateImplCopyWith(_$LoanSetupStateImpl value,
          $Res Function(_$LoanSetupStateImpl) then) =
      __$$LoanSetupStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {LoanCategory category,
      ProgramOptionsEntity? options,
      RequestState status,
      Failure? failure,
      IncomeType? incomeType,
      String? programKey,
      int currentStep,
      bool submitted});
}

/// @nodoc
class __$$LoanSetupStateImplCopyWithImpl<$Res>
    extends _$LoanSetupStateCopyWithImpl<$Res, _$LoanSetupStateImpl>
    implements _$$LoanSetupStateImplCopyWith<$Res> {
  __$$LoanSetupStateImplCopyWithImpl(
      _$LoanSetupStateImpl _value, $Res Function(_$LoanSetupStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of LoanSetupState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? category = null,
    Object? options = freezed,
    Object? status = null,
    Object? failure = freezed,
    Object? incomeType = freezed,
    Object? programKey = freezed,
    Object? currentStep = null,
    Object? submitted = null,
  }) {
    return _then(_$LoanSetupStateImpl(
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as LoanCategory,
      options: freezed == options
          ? _value.options
          : options // ignore: cast_nullable_to_non_nullable
              as ProgramOptionsEntity?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      failure: freezed == failure
          ? _value.failure
          : failure // ignore: cast_nullable_to_non_nullable
              as Failure?,
      incomeType: freezed == incomeType
          ? _value.incomeType
          : incomeType // ignore: cast_nullable_to_non_nullable
              as IncomeType?,
      programKey: freezed == programKey
          ? _value.programKey
          : programKey // ignore: cast_nullable_to_non_nullable
              as String?,
      currentStep: null == currentStep
          ? _value.currentStep
          : currentStep // ignore: cast_nullable_to_non_nullable
              as int,
      submitted: null == submitted
          ? _value.submitted
          : submitted // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$LoanSetupStateImpl extends _LoanSetupState {
  const _$LoanSetupStateImpl(
      {this.category = LoanCategory.personal,
      this.options,
      this.status = RequestState.initial,
      this.failure,
      this.incomeType,
      this.programKey,
      this.currentStep = 0,
      this.submitted = false})
      : super._();

  @override
  @JsonKey()
  final LoanCategory category;

  /// What the backend says is pickable for [category]. Null until the first
  /// successful read, and cleared on every category change so a stale list can
  /// never be rendered under a new heading.
  @override
  final ProgramOptionsEntity? options;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final Failure? failure;

  /// The chosen income basis, or null before step 2 is answered.
  @override
  final IncomeType? incomeType;

  /// The chosen catalog name, or null before step 3 is answered / when the
  /// chosen basis offers none.
  @override
  final String? programKey;
  @override
  @JsonKey()
  final int currentStep;

  /// One-shot: the page has everything it needs and should route on.
  @override
  @JsonKey()
  final bool submitted;

  @override
  String toString() {
    return 'LoanSetupState(category: $category, options: $options, status: $status, failure: $failure, incomeType: $incomeType, programKey: $programKey, currentStep: $currentStep, submitted: $submitted)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LoanSetupStateImpl &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.options, options) || other.options == options) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.failure, failure) || other.failure == failure) &&
            (identical(other.incomeType, incomeType) ||
                other.incomeType == incomeType) &&
            (identical(other.programKey, programKey) ||
                other.programKey == programKey) &&
            (identical(other.currentStep, currentStep) ||
                other.currentStep == currentStep) &&
            (identical(other.submitted, submitted) ||
                other.submitted == submitted));
  }

  @override
  int get hashCode => Object.hash(runtimeType, category, options, status,
      failure, incomeType, programKey, currentStep, submitted);

  /// Create a copy of LoanSetupState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$LoanSetupStateImplCopyWith<_$LoanSetupStateImpl> get copyWith =>
      __$$LoanSetupStateImplCopyWithImpl<_$LoanSetupStateImpl>(
          this, _$identity);
}

abstract class _LoanSetupState extends LoanSetupState {
  const factory _LoanSetupState(
      {final LoanCategory category,
      final ProgramOptionsEntity? options,
      final RequestState status,
      final Failure? failure,
      final IncomeType? incomeType,
      final String? programKey,
      final int currentStep,
      final bool submitted}) = _$LoanSetupStateImpl;
  const _LoanSetupState._() : super._();

  @override
  LoanCategory get category;

  /// What the backend says is pickable for [category]. Null until the first
  /// successful read, and cleared on every category change so a stale list can
  /// never be rendered under a new heading.
  @override
  ProgramOptionsEntity? get options;
  @override
  RequestState get status;
  @override
  Failure? get failure;

  /// The chosen income basis, or null before step 2 is answered.
  @override
  IncomeType? get incomeType;

  /// The chosen catalog name, or null before step 3 is answered / when the
  /// chosen basis offers none.
  @override
  String? get programKey;
  @override
  int get currentStep;

  /// One-shot: the page has everything it needs and should route on.
  @override
  bool get submitted;

  /// Create a copy of LoanSetupState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$LoanSetupStateImplCopyWith<_$LoanSetupStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
