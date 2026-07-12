// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'change_password_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ChangePasswordState {
  String get currentPassword => throw _privateConstructorUsedError;
  String get newPassword => throw _privateConstructorUsedError;
  String get confirmPassword => throw _privateConstructorUsedError;
  bool get obscureCurrent => throw _privateConstructorUsedError;
  bool get obscureNew => throw _privateConstructorUsedError;
  bool get obscureConfirm => throw _privateConstructorUsedError;
  RequestState get status => throw _privateConstructorUsedError;
  Failure? get error => throw _privateConstructorUsedError;

  /// Create a copy of ChangePasswordState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChangePasswordStateCopyWith<ChangePasswordState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChangePasswordStateCopyWith<$Res> {
  factory $ChangePasswordStateCopyWith(
          ChangePasswordState value, $Res Function(ChangePasswordState) then) =
      _$ChangePasswordStateCopyWithImpl<$Res, ChangePasswordState>;
  @useResult
  $Res call(
      {String currentPassword,
      String newPassword,
      String confirmPassword,
      bool obscureCurrent,
      bool obscureNew,
      bool obscureConfirm,
      RequestState status,
      Failure? error});
}

/// @nodoc
class _$ChangePasswordStateCopyWithImpl<$Res, $Val extends ChangePasswordState>
    implements $ChangePasswordStateCopyWith<$Res> {
  _$ChangePasswordStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChangePasswordState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentPassword = null,
    Object? newPassword = null,
    Object? confirmPassword = null,
    Object? obscureCurrent = null,
    Object? obscureNew = null,
    Object? obscureConfirm = null,
    Object? status = null,
    Object? error = freezed,
  }) {
    return _then(_value.copyWith(
      currentPassword: null == currentPassword
          ? _value.currentPassword
          : currentPassword // ignore: cast_nullable_to_non_nullable
              as String,
      newPassword: null == newPassword
          ? _value.newPassword
          : newPassword // ignore: cast_nullable_to_non_nullable
              as String,
      confirmPassword: null == confirmPassword
          ? _value.confirmPassword
          : confirmPassword // ignore: cast_nullable_to_non_nullable
              as String,
      obscureCurrent: null == obscureCurrent
          ? _value.obscureCurrent
          : obscureCurrent // ignore: cast_nullable_to_non_nullable
              as bool,
      obscureNew: null == obscureNew
          ? _value.obscureNew
          : obscureNew // ignore: cast_nullable_to_non_nullable
              as bool,
      obscureConfirm: null == obscureConfirm
          ? _value.obscureConfirm
          : obscureConfirm // ignore: cast_nullable_to_non_nullable
              as bool,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ChangePasswordStateImplCopyWith<$Res>
    implements $ChangePasswordStateCopyWith<$Res> {
  factory _$$ChangePasswordStateImplCopyWith(_$ChangePasswordStateImpl value,
          $Res Function(_$ChangePasswordStateImpl) then) =
      __$$ChangePasswordStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String currentPassword,
      String newPassword,
      String confirmPassword,
      bool obscureCurrent,
      bool obscureNew,
      bool obscureConfirm,
      RequestState status,
      Failure? error});
}

/// @nodoc
class __$$ChangePasswordStateImplCopyWithImpl<$Res>
    extends _$ChangePasswordStateCopyWithImpl<$Res, _$ChangePasswordStateImpl>
    implements _$$ChangePasswordStateImplCopyWith<$Res> {
  __$$ChangePasswordStateImplCopyWithImpl(_$ChangePasswordStateImpl _value,
      $Res Function(_$ChangePasswordStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of ChangePasswordState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentPassword = null,
    Object? newPassword = null,
    Object? confirmPassword = null,
    Object? obscureCurrent = null,
    Object? obscureNew = null,
    Object? obscureConfirm = null,
    Object? status = null,
    Object? error = freezed,
  }) {
    return _then(_$ChangePasswordStateImpl(
      currentPassword: null == currentPassword
          ? _value.currentPassword
          : currentPassword // ignore: cast_nullable_to_non_nullable
              as String,
      newPassword: null == newPassword
          ? _value.newPassword
          : newPassword // ignore: cast_nullable_to_non_nullable
              as String,
      confirmPassword: null == confirmPassword
          ? _value.confirmPassword
          : confirmPassword // ignore: cast_nullable_to_non_nullable
              as String,
      obscureCurrent: null == obscureCurrent
          ? _value.obscureCurrent
          : obscureCurrent // ignore: cast_nullable_to_non_nullable
              as bool,
      obscureNew: null == obscureNew
          ? _value.obscureNew
          : obscureNew // ignore: cast_nullable_to_non_nullable
              as bool,
      obscureConfirm: null == obscureConfirm
          ? _value.obscureConfirm
          : obscureConfirm // ignore: cast_nullable_to_non_nullable
              as bool,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as RequestState,
      error: freezed == error
          ? _value.error
          : error // ignore: cast_nullable_to_non_nullable
              as Failure?,
    ));
  }
}

/// @nodoc

class _$ChangePasswordStateImpl extends _ChangePasswordState {
  const _$ChangePasswordStateImpl(
      {this.currentPassword = '',
      this.newPassword = '',
      this.confirmPassword = '',
      this.obscureCurrent = true,
      this.obscureNew = true,
      this.obscureConfirm = true,
      this.status = RequestState.initial,
      this.error})
      : super._();

  @override
  @JsonKey()
  final String currentPassword;
  @override
  @JsonKey()
  final String newPassword;
  @override
  @JsonKey()
  final String confirmPassword;
  @override
  @JsonKey()
  final bool obscureCurrent;
  @override
  @JsonKey()
  final bool obscureNew;
  @override
  @JsonKey()
  final bool obscureConfirm;
  @override
  @JsonKey()
  final RequestState status;
  @override
  final Failure? error;

  @override
  String toString() {
    return 'ChangePasswordState(currentPassword: $currentPassword, newPassword: $newPassword, confirmPassword: $confirmPassword, obscureCurrent: $obscureCurrent, obscureNew: $obscureNew, obscureConfirm: $obscureConfirm, status: $status, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChangePasswordStateImpl &&
            (identical(other.currentPassword, currentPassword) ||
                other.currentPassword == currentPassword) &&
            (identical(other.newPassword, newPassword) ||
                other.newPassword == newPassword) &&
            (identical(other.confirmPassword, confirmPassword) ||
                other.confirmPassword == confirmPassword) &&
            (identical(other.obscureCurrent, obscureCurrent) ||
                other.obscureCurrent == obscureCurrent) &&
            (identical(other.obscureNew, obscureNew) ||
                other.obscureNew == obscureNew) &&
            (identical(other.obscureConfirm, obscureConfirm) ||
                other.obscureConfirm == obscureConfirm) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      currentPassword,
      newPassword,
      confirmPassword,
      obscureCurrent,
      obscureNew,
      obscureConfirm,
      status,
      error);

  /// Create a copy of ChangePasswordState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChangePasswordStateImplCopyWith<_$ChangePasswordStateImpl> get copyWith =>
      __$$ChangePasswordStateImplCopyWithImpl<_$ChangePasswordStateImpl>(
          this, _$identity);
}

abstract class _ChangePasswordState extends ChangePasswordState {
  const factory _ChangePasswordState(
      {final String currentPassword,
      final String newPassword,
      final String confirmPassword,
      final bool obscureCurrent,
      final bool obscureNew,
      final bool obscureConfirm,
      final RequestState status,
      final Failure? error}) = _$ChangePasswordStateImpl;
  const _ChangePasswordState._() : super._();

  @override
  String get currentPassword;
  @override
  String get newPassword;
  @override
  String get confirmPassword;
  @override
  bool get obscureCurrent;
  @override
  bool get obscureNew;
  @override
  bool get obscureConfirm;
  @override
  RequestState get status;
  @override
  Failure? get error;

  /// Create a copy of ChangePasswordState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChangePasswordStateImplCopyWith<_$ChangePasswordStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
