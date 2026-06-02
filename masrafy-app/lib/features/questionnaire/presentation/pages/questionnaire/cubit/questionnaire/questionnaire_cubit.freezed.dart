// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'questionnaire_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$QuestionnaireState {
  LoanCategory get category => throw _privateConstructorUsedError;
  QuestionnaireSnapshotEntity? get snapshot =>
      throw _privateConstructorUsedError;
  Map<String, String> get answers => throw _privateConstructorUsedError;
  QuestionnaireStep get step => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  MatchingPreviewEntity? get preview => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of QuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $QuestionnaireStateCopyWith<QuestionnaireState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $QuestionnaireStateCopyWith<$Res> {
  factory $QuestionnaireStateCopyWith(
          QuestionnaireState value, $Res Function(QuestionnaireState) then) =
      _$QuestionnaireStateCopyWithImpl<$Res, QuestionnaireState>;
  @useResult
  $Res call(
      {LoanCategory category,
      QuestionnaireSnapshotEntity? snapshot,
      Map<String, String> answers,
      QuestionnaireStep step,
      RequestState status,
      MatchingPreviewEntity? preview,
      Failure? error});
}

/// @nodoc
class _$QuestionnaireStateCopyWithImpl<$Res, $Val extends QuestionnaireState>
    implements $QuestionnaireStateCopyWith<$Res> {
  _$QuestionnaireStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of QuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? category = null,
    Object? snapshot = freezed,
    Object? answers = null,
    Object? step = null,
    Object? status = null,
    Object? preview = freezed,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as LoanCategory,
      snapshot: freezed == snapshot
          ? _value.snapshot
          : snapshot // ignore: cast_nullable_to_non_nullable
              as QuestionnaireSnapshotEntity?,
      answers: null == answers
          ? _value.answers
          : answers // ignore: cast_nullable_to_non_nullable
              as Map<String, String>,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as QuestionnaireStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      preview: freezed == preview
          ? _value.preview
          : preview // ignore: cast_nullable_to_non_nullable
              as MatchingPreviewEntity?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$QuestionnaireStateImplCopyWith<$Res>
    implements $QuestionnaireStateCopyWith<$Res> {
  factory _$$QuestionnaireStateImplCopyWith(_$QuestionnaireStateImpl value,
          $Res Function(_$QuestionnaireStateImpl) then) =
      __$$QuestionnaireStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {LoanCategory category,
      QuestionnaireSnapshotEntity? snapshot,
      Map<String, String> answers,
      QuestionnaireStep step,
      RequestState status,
      MatchingPreviewEntity? preview,
      Failure? error});
}

/// @nodoc
class __$$QuestionnaireStateImplCopyWithImpl<$Res>
    extends _$QuestionnaireStateCopyWithImpl<$Res, _$QuestionnaireStateImpl>
    implements _$$QuestionnaireStateImplCopyWith<$Res> {
  __$$QuestionnaireStateImplCopyWithImpl(_$QuestionnaireStateImpl _value,
      $Res Function(_$QuestionnaireStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of QuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? category = null,
    Object? snapshot = freezed,
    Object? answers = null,
    Object? step = null,
    Object? status = null,
    Object? preview = freezed,
    Object? error = freezed,
  }) {
    return _then(_$QuestionnaireStateImpl(
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as LoanCategory,
      snapshot: freezed == snapshot
          ? _value.snapshot
          : snapshot // ignore: cast_nullable_to_non_nullable
              as QuestionnaireSnapshotEntity?,
      answers: null == answers
          ? _value._answers
          : answers // ignore: cast_nullable_to_non_nullable
              as Map<String, String>,
      step: null == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as QuestionnaireStep,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      preview: freezed == preview
          ? _value.preview
          : preview // ignore: cast_nullable_to_non_nullable
              as MatchingPreviewEntity?,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$QuestionnaireStateImpl extends _QuestionnaireState {
  const _$QuestionnaireStateImpl(
      {this.category = LoanCategory.personal,
      this.snapshot,
      final Map<String, String> answers = const <String, String>{},
      this.step = QuestionnaireStep.idle,
      this.status = RequestState.initial,
      this.preview,
      this.error})
      : _answers = answers,
        super._();

  @override
  @JsonKey()
  final LoanCategory category;
  @override
  final QuestionnaireSnapshotEntity? snapshot;
  final Map<String, String> _answers;
  @override
  @JsonKey()
  Map<String, String> get answers {
    if (_answers is EqualUnmodifiableMapView) return _answers;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_answers);
  }

  @override
  @JsonKey()
  final QuestionnaireStep step;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final MatchingPreviewEntity? preview;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'QuestionnaireState(category: $category, snapshot: $snapshot, answers: $answers, step: $step, status: $status, preview: $preview, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$QuestionnaireStateImpl &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.snapshot, snapshot) ||
                other.snapshot == snapshot) &&
            const DeepCollectionEquality().equals(other._answers, _answers) &&
            (identical(other.step, step) || other.step == step) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.preview, preview) || other.preview == preview) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      category,
      snapshot,
      const DeepCollectionEquality().hash(_answers),
      step,
      status,
      preview,
      error);

  /// Create a copy of QuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$QuestionnaireStateImplCopyWith<_$QuestionnaireStateImpl> get copyWith =>
      __$$QuestionnaireStateImplCopyWithImpl<_$QuestionnaireStateImpl>(
          this, _$identity);
}

abstract class _QuestionnaireState extends QuestionnaireState {
  const factory _QuestionnaireState(
      {final LoanCategory category,
      final QuestionnaireSnapshotEntity? snapshot,
      final Map<String, String> answers,
      final QuestionnaireStep step,
      final RequestState status,
      final MatchingPreviewEntity? preview,
      final Failure? error}) = _$QuestionnaireStateImpl;
  const _QuestionnaireState._() : super._();

  @override
  LoanCategory get category;
  @override
  QuestionnaireSnapshotEntity? get snapshot;
  @override
  Map<String, String> get answers;
  @override
  QuestionnaireStep get step;
  @override
  RequestState get status;
  @override
  MatchingPreviewEntity? get preview;
  @override
  Failure? get error;

  /// Create a copy of QuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$QuestionnaireStateImplCopyWith<_$QuestionnaireStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
