// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'attachment_editor_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$AttachmentEditorState {
  AttachmentEditorTool get currentTool => throw _privateConstructorUsedError;

  /// Image rotation in degrees (0 / 90 / 180 / 270). Mirrors Angular
  /// `HistoryState.imageRotation`.
  int get imageRotation => throw _privateConstructorUsedError;

  /// Cubit-side mirrors of `PainterController.canUndo / canRedo` so the
  /// toolbar's undo/redo buttons can rebuild via `BlocBuilder` without
  /// reading the controller directly. The screen wires a controller
  /// listener that calls `setUndoRedoAvailability(...)` after every
  /// drawable add / undo / redo.
  bool get canUndo => throw _privateConstructorUsedError;
  bool get canRedo => throw _privateConstructorUsedError;

  /// Create a copy of AttachmentEditorState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AttachmentEditorStateCopyWith<AttachmentEditorState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AttachmentEditorStateCopyWith<$Res> {
  factory $AttachmentEditorStateCopyWith(AttachmentEditorState value,
          $Res Function(AttachmentEditorState) then) =
      _$AttachmentEditorStateCopyWithImpl<$Res, AttachmentEditorState>;
  @useResult
  $Res call(
      {AttachmentEditorTool currentTool,
      int imageRotation,
      bool canUndo,
      bool canRedo});
}

/// @nodoc
class _$AttachmentEditorStateCopyWithImpl<$Res,
        $Val extends AttachmentEditorState>
    implements $AttachmentEditorStateCopyWith<$Res> {
  _$AttachmentEditorStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AttachmentEditorState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentTool = null,
    Object? imageRotation = null,
    Object? canUndo = null,
    Object? canRedo = null,
  }) {
    return _then(_value.copyWith(
      currentTool: null == currentTool
          ? _value.currentTool
          : currentTool // ignore: cast_nullable_to_non_nullable
              as AttachmentEditorTool,
      imageRotation: null == imageRotation
          ? _value.imageRotation
          : imageRotation // ignore: cast_nullable_to_non_nullable
              as int,
      canUndo: null == canUndo
          ? _value.canUndo
          : canUndo // ignore: cast_nullable_to_non_nullable
              as bool,
      canRedo: null == canRedo
          ? _value.canRedo
          : canRedo // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AttachmentEditorStateImplCopyWith<$Res>
    implements $AttachmentEditorStateCopyWith<$Res> {
  factory _$$AttachmentEditorStateImplCopyWith(
          _$AttachmentEditorStateImpl value,
          $Res Function(_$AttachmentEditorStateImpl) then) =
      __$$AttachmentEditorStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {AttachmentEditorTool currentTool,
      int imageRotation,
      bool canUndo,
      bool canRedo});
}

/// @nodoc
class __$$AttachmentEditorStateImplCopyWithImpl<$Res>
    extends _$AttachmentEditorStateCopyWithImpl<$Res,
        _$AttachmentEditorStateImpl>
    implements _$$AttachmentEditorStateImplCopyWith<$Res> {
  __$$AttachmentEditorStateImplCopyWithImpl(_$AttachmentEditorStateImpl _value,
      $Res Function(_$AttachmentEditorStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of AttachmentEditorState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentTool = null,
    Object? imageRotation = null,
    Object? canUndo = null,
    Object? canRedo = null,
  }) {
    return _then(_$AttachmentEditorStateImpl(
      currentTool: null == currentTool
          ? _value.currentTool
          : currentTool // ignore: cast_nullable_to_non_nullable
              as AttachmentEditorTool,
      imageRotation: null == imageRotation
          ? _value.imageRotation
          : imageRotation // ignore: cast_nullable_to_non_nullable
              as int,
      canUndo: null == canUndo
          ? _value.canUndo
          : canUndo // ignore: cast_nullable_to_non_nullable
              as bool,
      canRedo: null == canRedo
          ? _value.canRedo
          : canRedo // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$AttachmentEditorStateImpl implements _AttachmentEditorState {
  const _$AttachmentEditorStateImpl(
      {this.currentTool = AttachmentEditorTool.none,
      this.imageRotation = 0,
      this.canUndo = false,
      this.canRedo = false});

  @override
  @JsonKey()
  final AttachmentEditorTool currentTool;

  /// Image rotation in degrees (0 / 90 / 180 / 270). Mirrors Angular
  /// `HistoryState.imageRotation`.
  @override
  @JsonKey()
  final int imageRotation;

  /// Cubit-side mirrors of `PainterController.canUndo / canRedo` so the
  /// toolbar's undo/redo buttons can rebuild via `BlocBuilder` without
  /// reading the controller directly. The screen wires a controller
  /// listener that calls `setUndoRedoAvailability(...)` after every
  /// drawable add / undo / redo.
  @override
  @JsonKey()
  final bool canUndo;
  @override
  @JsonKey()
  final bool canRedo;

  @override
  String toString() {
    return 'AttachmentEditorState(currentTool: $currentTool, imageRotation: $imageRotation, canUndo: $canUndo, canRedo: $canRedo)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AttachmentEditorStateImpl &&
            (identical(other.currentTool, currentTool) ||
                other.currentTool == currentTool) &&
            (identical(other.imageRotation, imageRotation) ||
                other.imageRotation == imageRotation) &&
            (identical(other.canUndo, canUndo) || other.canUndo == canUndo) &&
            (identical(other.canRedo, canRedo) || other.canRedo == canRedo));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, currentTool, imageRotation, canUndo, canRedo);

  /// Create a copy of AttachmentEditorState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AttachmentEditorStateImplCopyWith<_$AttachmentEditorStateImpl>
      get copyWith => __$$AttachmentEditorStateImplCopyWithImpl<
          _$AttachmentEditorStateImpl>(this, _$identity);
}

abstract class _AttachmentEditorState implements AttachmentEditorState {
  const factory _AttachmentEditorState(
      {final AttachmentEditorTool currentTool,
      final int imageRotation,
      final bool canUndo,
      final bool canRedo}) = _$AttachmentEditorStateImpl;

  @override
  AttachmentEditorTool get currentTool;

  /// Image rotation in degrees (0 / 90 / 180 / 270). Mirrors Angular
  /// `HistoryState.imageRotation`.
  @override
  int get imageRotation;

  /// Cubit-side mirrors of `PainterController.canUndo / canRedo` so the
  /// toolbar's undo/redo buttons can rebuild via `BlocBuilder` without
  /// reading the controller directly. The screen wires a controller
  /// listener that calls `setUndoRedoAvailability(...)` after every
  /// drawable add / undo / redo.
  @override
  bool get canUndo;
  @override
  bool get canRedo;

  /// Create a copy of AttachmentEditorState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AttachmentEditorStateImplCopyWith<_$AttachmentEditorStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
