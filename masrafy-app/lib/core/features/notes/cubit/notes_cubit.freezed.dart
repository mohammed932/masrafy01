// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'notes_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$NotesState {
  RequestState get noteState => throw _privateConstructorUsedError;
  UserNoteEntity? get note => throw _privateConstructorUsedError;
  String get composerText => throw _privateConstructorUsedError;
  bool get isSaving => throw _privateConstructorUsedError;
  bool get isDeleting => throw _privateConstructorUsedError;
  bool get isTrialLocked => throw _privateConstructorUsedError;
  String? get errorMessage => throw _privateConstructorUsedError;

  /// Create a copy of NotesState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $NotesStateCopyWith<NotesState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $NotesStateCopyWith<$Res> {
  factory $NotesStateCopyWith(
          NotesState value, $Res Function(NotesState) then) =
      _$NotesStateCopyWithImpl<$Res, NotesState>;
  @useResult
  $Res call(
      {RequestState noteState,
      UserNoteEntity? note,
      String composerText,
      bool isSaving,
      bool isDeleting,
      bool isTrialLocked,
      String? errorMessage});
}

/// @nodoc
class _$NotesStateCopyWithImpl<$Res, $Val extends NotesState>
    implements $NotesStateCopyWith<$Res> {
  _$NotesStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of NotesState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? noteState = null,
    Object? note = freezed,
    Object? composerText = null,
    Object? isSaving = null,
    Object? isDeleting = null,
    Object? isTrialLocked = null,
    Object? errorMessage = freezed,
  }) {
    return _then(_value.copyWith(
      noteState: null == noteState
          ? _value.noteState
          : noteState // ignore: cast_nullable_to_non_nullable
              as RequestState,
      note: freezed == note
          ? _value.note
          : note // ignore: cast_nullable_to_non_nullable
              as UserNoteEntity?,
      composerText: null == composerText
          ? _value.composerText
          : composerText // ignore: cast_nullable_to_non_nullable
              as String,
      isSaving: null == isSaving
          ? _value.isSaving
          : isSaving // ignore: cast_nullable_to_non_nullable
              as bool,
      isDeleting: null == isDeleting
          ? _value.isDeleting
          : isDeleting // ignore: cast_nullable_to_non_nullable
              as bool,
      isTrialLocked: null == isTrialLocked
          ? _value.isTrialLocked
          : isTrialLocked // ignore: cast_nullable_to_non_nullable
              as bool,
      errorMessage: freezed == errorMessage
          ? _value.errorMessage
          : errorMessage // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$NotesStateImplCopyWith<$Res>
    implements $NotesStateCopyWith<$Res> {
  factory _$$NotesStateImplCopyWith(
          _$NotesStateImpl value, $Res Function(_$NotesStateImpl) then) =
      __$$NotesStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {RequestState noteState,
      UserNoteEntity? note,
      String composerText,
      bool isSaving,
      bool isDeleting,
      bool isTrialLocked,
      String? errorMessage});
}

/// @nodoc
class __$$NotesStateImplCopyWithImpl<$Res>
    extends _$NotesStateCopyWithImpl<$Res, _$NotesStateImpl>
    implements _$$NotesStateImplCopyWith<$Res> {
  __$$NotesStateImplCopyWithImpl(
      _$NotesStateImpl _value, $Res Function(_$NotesStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of NotesState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? noteState = null,
    Object? note = freezed,
    Object? composerText = null,
    Object? isSaving = null,
    Object? isDeleting = null,
    Object? isTrialLocked = null,
    Object? errorMessage = freezed,
  }) {
    return _then(_$NotesStateImpl(
      noteState: null == noteState
          ? _value.noteState
          : noteState // ignore: cast_nullable_to_non_nullable
              as RequestState,
      note: freezed == note
          ? _value.note
          : note // ignore: cast_nullable_to_non_nullable
              as UserNoteEntity?,
      composerText: null == composerText
          ? _value.composerText
          : composerText // ignore: cast_nullable_to_non_nullable
              as String,
      isSaving: null == isSaving
          ? _value.isSaving
          : isSaving // ignore: cast_nullable_to_non_nullable
              as bool,
      isDeleting: null == isDeleting
          ? _value.isDeleting
          : isDeleting // ignore: cast_nullable_to_non_nullable
              as bool,
      isTrialLocked: null == isTrialLocked
          ? _value.isTrialLocked
          : isTrialLocked // ignore: cast_nullable_to_non_nullable
              as bool,
      errorMessage: freezed == errorMessage
          ? _value.errorMessage
          : errorMessage // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class _$NotesStateImpl extends _NotesState {
  const _$NotesStateImpl(
      {this.noteState = RequestState.initial,
      this.note,
      this.composerText = '',
      this.isSaving = false,
      this.isDeleting = false,
      this.isTrialLocked = false,
      this.errorMessage})
      : super._();

  @override
  @JsonKey()
  final RequestState noteState;
  @override
  final UserNoteEntity? note;
  @override
  @JsonKey()
  final String composerText;
  @override
  @JsonKey()
  final bool isSaving;
  @override
  @JsonKey()
  final bool isDeleting;
  @override
  @JsonKey()
  final bool isTrialLocked;
  @override
  final String? errorMessage;

  @override
  String toString() {
    return 'NotesState(noteState: $noteState, note: $note, composerText: $composerText, isSaving: $isSaving, isDeleting: $isDeleting, isTrialLocked: $isTrialLocked, errorMessage: $errorMessage)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NotesStateImpl &&
            (identical(other.noteState, noteState) ||
                other.noteState == noteState) &&
            const DeepCollectionEquality().equals(other.note, note) &&
            (identical(other.composerText, composerText) ||
                other.composerText == composerText) &&
            (identical(other.isSaving, isSaving) ||
                other.isSaving == isSaving) &&
            (identical(other.isDeleting, isDeleting) ||
                other.isDeleting == isDeleting) &&
            (identical(other.isTrialLocked, isTrialLocked) ||
                other.isTrialLocked == isTrialLocked) &&
            (identical(other.errorMessage, errorMessage) ||
                other.errorMessage == errorMessage));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      noteState,
      const DeepCollectionEquality().hash(note),
      composerText,
      isSaving,
      isDeleting,
      isTrialLocked,
      errorMessage);

  /// Create a copy of NotesState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NotesStateImplCopyWith<_$NotesStateImpl> get copyWith =>
      __$$NotesStateImplCopyWithImpl<_$NotesStateImpl>(this, _$identity);
}

abstract class _NotesState extends NotesState {
  const factory _NotesState(
      {final RequestState noteState,
      final UserNoteEntity? note,
      final String composerText,
      final bool isSaving,
      final bool isDeleting,
      final bool isTrialLocked,
      final String? errorMessage}) = _$NotesStateImpl;
  const _NotesState._() : super._();

  @override
  RequestState get noteState;
  @override
  UserNoteEntity? get note;
  @override
  String get composerText;
  @override
  bool get isSaving;
  @override
  bool get isDeleting;
  @override
  bool get isTrialLocked;
  @override
  String? get errorMessage;

  /// Create a copy of NotesState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NotesStateImplCopyWith<_$NotesStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
