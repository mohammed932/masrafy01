// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'theme_bloc.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ThemeBlocEvent {
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initColorTheme,
    required TResult Function(ColorThemes mode) changeColorTheme,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initColorTheme,
    TResult? Function(ColorThemes mode)? changeColorTheme,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initColorTheme,
    TResult Function(ColorThemes mode)? changeColorTheme,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_InitColorTheme value) initColorTheme,
    required TResult Function(_ChangeColorTheme value) changeColorTheme,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_InitColorTheme value)? initColorTheme,
    TResult? Function(_ChangeColorTheme value)? changeColorTheme,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_InitColorTheme value)? initColorTheme,
    TResult Function(_ChangeColorTheme value)? changeColorTheme,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ThemeBlocEventCopyWith<$Res> {
  factory $ThemeBlocEventCopyWith(
          ThemeBlocEvent value, $Res Function(ThemeBlocEvent) then) =
      _$ThemeBlocEventCopyWithImpl<$Res, ThemeBlocEvent>;
}

/// @nodoc
class _$ThemeBlocEventCopyWithImpl<$Res, $Val extends ThemeBlocEvent>
    implements $ThemeBlocEventCopyWith<$Res> {
  _$ThemeBlocEventCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ThemeBlocEvent
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$InitColorThemeImplCopyWith<$Res> {
  factory _$$InitColorThemeImplCopyWith(_$InitColorThemeImpl value,
          $Res Function(_$InitColorThemeImpl) then) =
      __$$InitColorThemeImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$InitColorThemeImplCopyWithImpl<$Res>
    extends _$ThemeBlocEventCopyWithImpl<$Res, _$InitColorThemeImpl>
    implements _$$InitColorThemeImplCopyWith<$Res> {
  __$$InitColorThemeImplCopyWithImpl(
      _$InitColorThemeImpl _value, $Res Function(_$InitColorThemeImpl) _then)
      : super(_value, _then);

  /// Create a copy of ThemeBlocEvent
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$InitColorThemeImpl implements _InitColorTheme {
  const _$InitColorThemeImpl();

  @override
  String toString() {
    return 'ThemeBlocEvent.initColorTheme()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is _$InitColorThemeImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initColorTheme,
    required TResult Function(ColorThemes mode) changeColorTheme,
  }) {
    return initColorTheme();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initColorTheme,
    TResult? Function(ColorThemes mode)? changeColorTheme,
  }) {
    return initColorTheme?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initColorTheme,
    TResult Function(ColorThemes mode)? changeColorTheme,
    required TResult orElse(),
  }) {
    if (initColorTheme != null) {
      return initColorTheme();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_InitColorTheme value) initColorTheme,
    required TResult Function(_ChangeColorTheme value) changeColorTheme,
  }) {
    return initColorTheme(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_InitColorTheme value)? initColorTheme,
    TResult? Function(_ChangeColorTheme value)? changeColorTheme,
  }) {
    return initColorTheme?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_InitColorTheme value)? initColorTheme,
    TResult Function(_ChangeColorTheme value)? changeColorTheme,
    required TResult orElse(),
  }) {
    if (initColorTheme != null) {
      return initColorTheme(this);
    }
    return orElse();
  }
}

abstract class _InitColorTheme implements ThemeBlocEvent {
  const factory _InitColorTheme() = _$InitColorThemeImpl;
}

/// @nodoc
abstract class _$$ChangeColorThemeImplCopyWith<$Res> {
  factory _$$ChangeColorThemeImplCopyWith(_$ChangeColorThemeImpl value,
          $Res Function(_$ChangeColorThemeImpl) then) =
      __$$ChangeColorThemeImplCopyWithImpl<$Res>;
  @useResult
  $Res call({ColorThemes mode});
}

/// @nodoc
class __$$ChangeColorThemeImplCopyWithImpl<$Res>
    extends _$ThemeBlocEventCopyWithImpl<$Res, _$ChangeColorThemeImpl>
    implements _$$ChangeColorThemeImplCopyWith<$Res> {
  __$$ChangeColorThemeImplCopyWithImpl(_$ChangeColorThemeImpl _value,
      $Res Function(_$ChangeColorThemeImpl) _then)
      : super(_value, _then);

  /// Create a copy of ThemeBlocEvent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? mode = null,
  }) {
    return _then(_$ChangeColorThemeImpl(
      mode: null == mode
          ? _value.mode
          : mode // ignore: cast_nullable_to_non_nullable
              as ColorThemes,
    ));
  }
}

/// @nodoc

class _$ChangeColorThemeImpl implements _ChangeColorTheme {
  const _$ChangeColorThemeImpl({required this.mode});

  @override
  final ColorThemes mode;

  @override
  String toString() {
    return 'ThemeBlocEvent.changeColorTheme(mode: $mode)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChangeColorThemeImpl &&
            (identical(other.mode, mode) || other.mode == mode));
  }

  @override
  int get hashCode => Object.hash(runtimeType, mode);

  /// Create a copy of ThemeBlocEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChangeColorThemeImplCopyWith<_$ChangeColorThemeImpl> get copyWith =>
      __$$ChangeColorThemeImplCopyWithImpl<_$ChangeColorThemeImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initColorTheme,
    required TResult Function(ColorThemes mode) changeColorTheme,
  }) {
    return changeColorTheme(mode);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initColorTheme,
    TResult? Function(ColorThemes mode)? changeColorTheme,
  }) {
    return changeColorTheme?.call(mode);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initColorTheme,
    TResult Function(ColorThemes mode)? changeColorTheme,
    required TResult orElse(),
  }) {
    if (changeColorTheme != null) {
      return changeColorTheme(mode);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_InitColorTheme value) initColorTheme,
    required TResult Function(_ChangeColorTheme value) changeColorTheme,
  }) {
    return changeColorTheme(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_InitColorTheme value)? initColorTheme,
    TResult? Function(_ChangeColorTheme value)? changeColorTheme,
  }) {
    return changeColorTheme?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_InitColorTheme value)? initColorTheme,
    TResult Function(_ChangeColorTheme value)? changeColorTheme,
    required TResult orElse(),
  }) {
    if (changeColorTheme != null) {
      return changeColorTheme(this);
    }
    return orElse();
  }
}

abstract class _ChangeColorTheme implements ThemeBlocEvent {
  const factory _ChangeColorTheme({required final ColorThemes mode}) =
      _$ChangeColorThemeImpl;

  ColorThemes get mode;

  /// Create a copy of ThemeBlocEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChangeColorThemeImplCopyWith<_$ChangeColorThemeImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$ThemeBlocState {
  ColorThemes get mode => throw _privateConstructorUsedError;

  /// Create a copy of ThemeBlocState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ThemeBlocStateCopyWith<ThemeBlocState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ThemeBlocStateCopyWith<$Res> {
  factory $ThemeBlocStateCopyWith(
          ThemeBlocState value, $Res Function(ThemeBlocState) then) =
      _$ThemeBlocStateCopyWithImpl<$Res, ThemeBlocState>;
  @useResult
  $Res call({ColorThemes mode});
}

/// @nodoc
class _$ThemeBlocStateCopyWithImpl<$Res, $Val extends ThemeBlocState>
    implements $ThemeBlocStateCopyWith<$Res> {
  _$ThemeBlocStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ThemeBlocState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? mode = null,
  }) {
    return _then(_value.copyWith(
      mode: null == mode
          ? _value.mode
          : mode // ignore: cast_nullable_to_non_nullable
              as ColorThemes,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ThemeBlocStateImplCopyWith<$Res>
    implements $ThemeBlocStateCopyWith<$Res> {
  factory _$$ThemeBlocStateImplCopyWith(_$ThemeBlocStateImpl value,
          $Res Function(_$ThemeBlocStateImpl) then) =
      __$$ThemeBlocStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({ColorThemes mode});
}

/// @nodoc
class __$$ThemeBlocStateImplCopyWithImpl<$Res>
    extends _$ThemeBlocStateCopyWithImpl<$Res, _$ThemeBlocStateImpl>
    implements _$$ThemeBlocStateImplCopyWith<$Res> {
  __$$ThemeBlocStateImplCopyWithImpl(
      _$ThemeBlocStateImpl _value, $Res Function(_$ThemeBlocStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of ThemeBlocState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? mode = null,
  }) {
    return _then(_$ThemeBlocStateImpl(
      mode: null == mode
          ? _value.mode
          : mode // ignore: cast_nullable_to_non_nullable
              as ColorThemes,
    ));
  }
}

/// @nodoc

class _$ThemeBlocStateImpl implements _ThemeBlocState {
  const _$ThemeBlocStateImpl({this.mode = ColorThemes.light});

  @override
  @JsonKey()
  final ColorThemes mode;

  @override
  String toString() {
    return 'ThemeBlocState(mode: $mode)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ThemeBlocStateImpl &&
            (identical(other.mode, mode) || other.mode == mode));
  }

  @override
  int get hashCode => Object.hash(runtimeType, mode);

  /// Create a copy of ThemeBlocState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ThemeBlocStateImplCopyWith<_$ThemeBlocStateImpl> get copyWith =>
      __$$ThemeBlocStateImplCopyWithImpl<_$ThemeBlocStateImpl>(
          this, _$identity);
}

abstract class _ThemeBlocState implements ThemeBlocState {
  const factory _ThemeBlocState({final ColorThemes mode}) =
      _$ThemeBlocStateImpl;

  @override
  ColorThemes get mode;

  /// Create a copy of ThemeBlocState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ThemeBlocStateImplCopyWith<_$ThemeBlocStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
