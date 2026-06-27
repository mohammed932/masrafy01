// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'saved_offers_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$SavedOffersState {
  RequestState get status => throw _privateConstructorUsedError;
  List<SavedOfferEntity> get offers => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;
  Failure? get removeError => throw _privateConstructorUsedError;

  /// Create a copy of SavedOffersState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SavedOffersStateCopyWith<SavedOffersState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SavedOffersStateCopyWith<$Res> {
  factory $SavedOffersStateCopyWith(
          SavedOffersState value, $Res Function(SavedOffersState) then) =
      _$SavedOffersStateCopyWithImpl<$Res, SavedOffersState>;
  @useResult
  $Res call(
      {RequestState status,
      List<SavedOfferEntity> offers,
      Failure? error,
      Failure? removeError});
}

/// @nodoc
class _$SavedOffersStateCopyWithImpl<$Res, $Val extends SavedOffersState>
    implements $SavedOffersStateCopyWith<$Res> {
  _$SavedOffersStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SavedOffersState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? offers = null,
    Object? error = freezed,
    Object? removeError = freezed,
  }) {
    return _then(_value.copyWith(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      offers: null == offers
          ? _value.offers
          : offers // ignore: cast_nullable_to_non_nullable
              as List<SavedOfferEntity>,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
      removeError: freezed == removeError
          ? _value.removeError
          : removeError // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SavedOffersStateImplCopyWith<$Res>
    implements $SavedOffersStateCopyWith<$Res> {
  factory _$$SavedOffersStateImplCopyWith(_$SavedOffersStateImpl value,
          $Res Function(_$SavedOffersStateImpl) then) =
      __$$SavedOffersStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {RequestState status,
      List<SavedOfferEntity> offers,
      Failure? error,
      Failure? removeError});
}

/// @nodoc
class __$$SavedOffersStateImplCopyWithImpl<$Res>
    extends _$SavedOffersStateCopyWithImpl<$Res, _$SavedOffersStateImpl>
    implements _$$SavedOffersStateImplCopyWith<$Res> {
  __$$SavedOffersStateImplCopyWithImpl(_$SavedOffersStateImpl _value,
      $Res Function(_$SavedOffersStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of SavedOffersState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? offers = null,
    Object? error = freezed,
    Object? removeError = freezed,
  }) {
    return _then(_$SavedOffersStateImpl(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      offers: null == offers
          ? _value._offers
          : offers // ignore: cast_nullable_to_non_nullable
              as List<SavedOfferEntity>,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
      removeError: freezed == removeError
          ? _value.removeError
          : removeError // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$SavedOffersStateImpl extends _SavedOffersState {
  const _$SavedOffersStateImpl(
      {this.status = RequestState.initial,
      final List<SavedOfferEntity> offers = const <SavedOfferEntity>[],
      this.error,
      this.removeError})
      : _offers = offers,
        super._();

  @override
  @JsonKey()
  final RequestState status;
  final List<SavedOfferEntity> _offers;
  @override
  @JsonKey()
  List<SavedOfferEntity> get offers {
    if (_offers is EqualUnmodifiableListView) return _offers;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_offers);
  }

  @override
  final Failure? error;
  @override
  final Failure? removeError;

  @override
  String toString() {
    return 'SavedOffersState(status: $status, offers: $offers, error: $error, removeError: $removeError)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SavedOffersStateImpl &&
            (identical(other.status, status) || other.status == status) &&
            const DeepCollectionEquality().equals(other._offers, _offers) &&
            (identical(other.error, error) || other.error == error) &&
            (identical(other.removeError, removeError) ||
                other.removeError == removeError));
  }

  @override
  int get hashCode => Object.hash(runtimeType, status,
      const DeepCollectionEquality().hash(_offers), error, removeError);

  /// Create a copy of SavedOffersState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SavedOffersStateImplCopyWith<_$SavedOffersStateImpl> get copyWith =>
      __$$SavedOffersStateImplCopyWithImpl<_$SavedOffersStateImpl>(
          this, _$identity);
}

abstract class _SavedOffersState extends SavedOffersState {
  const factory _SavedOffersState(
      {final RequestState status,
      final List<SavedOfferEntity> offers,
      final Failure? error,
      final Failure? removeError}) = _$SavedOffersStateImpl;
  const _SavedOffersState._() : super._();

  @override
  RequestState get status;
  @override
  List<SavedOfferEntity> get offers;
  @override
  Failure? get error;
  @override
  Failure? get removeError;

  /// Create a copy of SavedOffersState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SavedOffersStateImplCopyWith<_$SavedOffersStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
