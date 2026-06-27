// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'settings_security_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$SettingsSecurityState {
  bool get biometricEnabled => throw _privateConstructorUsedError;
  bool get notificationsEnabled => throw _privateConstructorUsedError;

  /// Create a copy of SettingsSecurityState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SettingsSecurityStateCopyWith<SettingsSecurityState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SettingsSecurityStateCopyWith<$Res> {
  factory $SettingsSecurityStateCopyWith(SettingsSecurityState value,
          $Res Function(SettingsSecurityState) then) =
      _$SettingsSecurityStateCopyWithImpl<$Res, SettingsSecurityState>;
  @useResult
  $Res call({bool biometricEnabled, bool notificationsEnabled});
}

/// @nodoc
class _$SettingsSecurityStateCopyWithImpl<$Res,
        $Val extends SettingsSecurityState>
    implements $SettingsSecurityStateCopyWith<$Res> {
  _$SettingsSecurityStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SettingsSecurityState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? biometricEnabled = null,
    Object? notificationsEnabled = null,
  }) {
    return _then(_value.copyWith(
      biometricEnabled: null == biometricEnabled
          ? _value.biometricEnabled
          : biometricEnabled // ignore: cast_nullable_to_non_nullable
              as bool,
      notificationsEnabled: null == notificationsEnabled
          ? _value.notificationsEnabled
          : notificationsEnabled // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SettingsSecurityStateImplCopyWith<$Res>
    implements $SettingsSecurityStateCopyWith<$Res> {
  factory _$$SettingsSecurityStateImplCopyWith(
          _$SettingsSecurityStateImpl value,
          $Res Function(_$SettingsSecurityStateImpl) then) =
      __$$SettingsSecurityStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool biometricEnabled, bool notificationsEnabled});
}

/// @nodoc
class __$$SettingsSecurityStateImplCopyWithImpl<$Res>
    extends _$SettingsSecurityStateCopyWithImpl<$Res,
        _$SettingsSecurityStateImpl>
    implements _$$SettingsSecurityStateImplCopyWith<$Res> {
  __$$SettingsSecurityStateImplCopyWithImpl(_$SettingsSecurityStateImpl _value,
      $Res Function(_$SettingsSecurityStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of SettingsSecurityState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? biometricEnabled = null,
    Object? notificationsEnabled = null,
  }) {
    return _then(_$SettingsSecurityStateImpl(
      biometricEnabled: null == biometricEnabled
          ? _value.biometricEnabled
          : biometricEnabled // ignore: cast_nullable_to_non_nullable
              as bool,
      notificationsEnabled: null == notificationsEnabled
          ? _value.notificationsEnabled
          : notificationsEnabled // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$SettingsSecurityStateImpl implements _SettingsSecurityState {
  const _$SettingsSecurityStateImpl(
      {this.biometricEnabled = true, this.notificationsEnabled = true});

  @override
  @JsonKey()
  final bool biometricEnabled;
  @override
  @JsonKey()
  final bool notificationsEnabled;

  @override
  String toString() {
    return 'SettingsSecurityState(biometricEnabled: $biometricEnabled, notificationsEnabled: $notificationsEnabled)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SettingsSecurityStateImpl &&
            (identical(other.biometricEnabled, biometricEnabled) ||
                other.biometricEnabled == biometricEnabled) &&
            (identical(other.notificationsEnabled, notificationsEnabled) ||
                other.notificationsEnabled == notificationsEnabled));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, biometricEnabled, notificationsEnabled);

  /// Create a copy of SettingsSecurityState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SettingsSecurityStateImplCopyWith<_$SettingsSecurityStateImpl>
      get copyWith => __$$SettingsSecurityStateImplCopyWithImpl<
          _$SettingsSecurityStateImpl>(this, _$identity);
}

abstract class _SettingsSecurityState implements SettingsSecurityState {
  const factory _SettingsSecurityState(
      {final bool biometricEnabled,
      final bool notificationsEnabled}) = _$SettingsSecurityStateImpl;

  @override
  bool get biometricEnabled;
  @override
  bool get notificationsEnabled;

  /// Create a copy of SettingsSecurityState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SettingsSecurityStateImplCopyWith<_$SettingsSecurityStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
