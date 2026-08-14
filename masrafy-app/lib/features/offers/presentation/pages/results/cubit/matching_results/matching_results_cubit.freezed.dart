// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'matching_results_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$MatchingResultsState {
  RequestState get status => throw _privateConstructorUsedError;
  List<MatchOffer> get offers => throw _privateConstructorUsedError;

  /// Feature 011 — programs the engine checked but could not price, WITH the
  /// reason. Surfaced rather than dropped: FR-022 requires the program to stay
  /// listed and FR-023 requires the reason in plain language, because "we haven't
  /// asked you this yet" and "your answer isn't in this bank's table" are things
  /// the applicant (or an admin reading over their shoulder) can act on, while a
  /// bank that silently vanishes reads as "this bank doesn't exist for me".
  List<UnavailableProgramEntity> get unavailablePrograms =>
      throw _privateConstructorUsedError;
  String get applicationId => throw _privateConstructorUsedError;
  bool get matched => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of MatchingResultsState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MatchingResultsStateCopyWith<MatchingResultsState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MatchingResultsStateCopyWith<$Res> {
  factory $MatchingResultsStateCopyWith(MatchingResultsState value,
          $Res Function(MatchingResultsState) then) =
      _$MatchingResultsStateCopyWithImpl<$Res, MatchingResultsState>;
  @useResult
  $Res call(
      {RequestState status,
      List<MatchOffer> offers,
      List<UnavailableProgramEntity> unavailablePrograms,
      String applicationId,
      bool matched,
      Failure? error});
}

/// @nodoc
class _$MatchingResultsStateCopyWithImpl<$Res,
        $Val extends MatchingResultsState>
    implements $MatchingResultsStateCopyWith<$Res> {
  _$MatchingResultsStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MatchingResultsState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? offers = null,
    Object? unavailablePrograms = null,
    Object? applicationId = null,
    Object? matched = null,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      offers: null == offers
          ? _value.offers
          : offers // ignore: cast_nullable_to_non_nullable
              as List<MatchOffer>,
      unavailablePrograms: null == unavailablePrograms
          ? _value.unavailablePrograms
          : unavailablePrograms // ignore: cast_nullable_to_non_nullable
              as List<UnavailableProgramEntity>,
      applicationId: null == applicationId
          ? _value.applicationId
          : applicationId // ignore: cast_nullable_to_non_nullable
              as String,
      matched: null == matched
          ? _value.matched
          : matched // ignore: cast_nullable_to_non_nullable
              as bool,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MatchingResultsStateImplCopyWith<$Res>
    implements $MatchingResultsStateCopyWith<$Res> {
  factory _$$MatchingResultsStateImplCopyWith(_$MatchingResultsStateImpl value,
          $Res Function(_$MatchingResultsStateImpl) then) =
      __$$MatchingResultsStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {RequestState status,
      List<MatchOffer> offers,
      List<UnavailableProgramEntity> unavailablePrograms,
      String applicationId,
      bool matched,
      Failure? error});
}

/// @nodoc
class __$$MatchingResultsStateImplCopyWithImpl<$Res>
    extends _$MatchingResultsStateCopyWithImpl<$Res, _$MatchingResultsStateImpl>
    implements _$$MatchingResultsStateImplCopyWith<$Res> {
  __$$MatchingResultsStateImplCopyWithImpl(_$MatchingResultsStateImpl _value,
      $Res Function(_$MatchingResultsStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of MatchingResultsState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? offers = null,
    Object? unavailablePrograms = null,
    Object? applicationId = null,
    Object? matched = null,
    Object? error = freezed,
  }) {
    return _then(_$MatchingResultsStateImpl(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      offers: null == offers
          ? _value._offers
          : offers // ignore: cast_nullable_to_non_nullable
              as List<MatchOffer>,
      unavailablePrograms: null == unavailablePrograms
          ? _value._unavailablePrograms
          : unavailablePrograms // ignore: cast_nullable_to_non_nullable
              as List<UnavailableProgramEntity>,
      applicationId: null == applicationId
          ? _value.applicationId
          : applicationId // ignore: cast_nullable_to_non_nullable
              as String,
      matched: null == matched
          ? _value.matched
          : matched // ignore: cast_nullable_to_non_nullable
              as bool,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$MatchingResultsStateImpl extends _MatchingResultsState {
  const _$MatchingResultsStateImpl(
      {this.status = RequestState.initial,
      final List<MatchOffer> offers = const <MatchOffer>[],
      final List<UnavailableProgramEntity> unavailablePrograms =
          const <UnavailableProgramEntity>[],
      this.applicationId = '',
      this.matched = false,
      this.error})
      : _offers = offers,
        _unavailablePrograms = unavailablePrograms,
        super._();

  @override
  @JsonKey()
  final RequestState status;
  final List<MatchOffer> _offers;
  @override
  @JsonKey()
  List<MatchOffer> get offers {
    if (_offers is EqualUnmodifiableListView) return _offers;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_offers);
  }

  /// Feature 011 — programs the engine checked but could not price, WITH the
  /// reason. Surfaced rather than dropped: FR-022 requires the program to stay
  /// listed and FR-023 requires the reason in plain language, because "we haven't
  /// asked you this yet" and "your answer isn't in this bank's table" are things
  /// the applicant (or an admin reading over their shoulder) can act on, while a
  /// bank that silently vanishes reads as "this bank doesn't exist for me".
  final List<UnavailableProgramEntity> _unavailablePrograms;

  /// Feature 011 — programs the engine checked but could not price, WITH the
  /// reason. Surfaced rather than dropped: FR-022 requires the program to stay
  /// listed and FR-023 requires the reason in plain language, because "we haven't
  /// asked you this yet" and "your answer isn't in this bank's table" are things
  /// the applicant (or an admin reading over their shoulder) can act on, while a
  /// bank that silently vanishes reads as "this bank doesn't exist for me".
  @override
  @JsonKey()
  List<UnavailableProgramEntity> get unavailablePrograms {
    if (_unavailablePrograms is EqualUnmodifiableListView)
      return _unavailablePrograms;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_unavailablePrograms);
  }

  @override
  @JsonKey()
  final String applicationId;
  @override
  @JsonKey()
  final bool matched;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'MatchingResultsState(status: $status, offers: $offers, unavailablePrograms: $unavailablePrograms, applicationId: $applicationId, matched: $matched, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MatchingResultsStateImpl &&
            (identical(other.status, status) || other.status == status) &&
            const DeepCollectionEquality().equals(other._offers, _offers) &&
            const DeepCollectionEquality()
                .equals(other._unavailablePrograms, _unavailablePrograms) &&
            (identical(other.applicationId, applicationId) ||
                other.applicationId == applicationId) &&
            (identical(other.matched, matched) || other.matched == matched) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      status,
      const DeepCollectionEquality().hash(_offers),
      const DeepCollectionEquality().hash(_unavailablePrograms),
      applicationId,
      matched,
      error);

  /// Create a copy of MatchingResultsState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MatchingResultsStateImplCopyWith<_$MatchingResultsStateImpl>
      get copyWith =>
          __$$MatchingResultsStateImplCopyWithImpl<_$MatchingResultsStateImpl>(
              this, _$identity);
}

abstract class _MatchingResultsState extends MatchingResultsState {
  const factory _MatchingResultsState(
      {final RequestState status,
      final List<MatchOffer> offers,
      final List<UnavailableProgramEntity> unavailablePrograms,
      final String applicationId,
      final bool matched,
      final Failure? error}) = _$MatchingResultsStateImpl;
  const _MatchingResultsState._() : super._();

  @override
  RequestState get status;
  @override
  List<MatchOffer> get offers;

  /// Feature 011 — programs the engine checked but could not price, WITH the
  /// reason. Surfaced rather than dropped: FR-022 requires the program to stay
  /// listed and FR-023 requires the reason in plain language, because "we haven't
  /// asked you this yet" and "your answer isn't in this bank's table" are things
  /// the applicant (or an admin reading over their shoulder) can act on, while a
  /// bank that silently vanishes reads as "this bank doesn't exist for me".
  @override
  List<UnavailableProgramEntity> get unavailablePrograms;
  @override
  String get applicationId;
  @override
  bool get matched;
  @override
  Failure? get error;

  /// Create a copy of MatchingResultsState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MatchingResultsStateImplCopyWith<_$MatchingResultsStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
