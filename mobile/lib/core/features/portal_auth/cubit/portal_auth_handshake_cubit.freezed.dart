// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'portal_auth_handshake_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$PortalAuthFailure {
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PortalAuthFailureCopyWith<$Res> {
  factory $PortalAuthFailureCopyWith(
          PortalAuthFailure value, $Res Function(PortalAuthFailure) then) =
      _$PortalAuthFailureCopyWithImpl<$Res, PortalAuthFailure>;
}

/// @nodoc
class _$PortalAuthFailureCopyWithImpl<$Res, $Val extends PortalAuthFailure>
    implements $PortalAuthFailureCopyWith<$Res> {
  _$PortalAuthFailureCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$PortalAuthTokenExpiredImplCopyWith<$Res> {
  factory _$$PortalAuthTokenExpiredImplCopyWith(
          _$PortalAuthTokenExpiredImpl value,
          $Res Function(_$PortalAuthTokenExpiredImpl) then) =
      __$$PortalAuthTokenExpiredImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$PortalAuthTokenExpiredImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res, _$PortalAuthTokenExpiredImpl>
    implements _$$PortalAuthTokenExpiredImplCopyWith<$Res> {
  __$$PortalAuthTokenExpiredImplCopyWithImpl(
      _$PortalAuthTokenExpiredImpl _value,
      $Res Function(_$PortalAuthTokenExpiredImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$PortalAuthTokenExpiredImpl implements _PortalAuthTokenExpired {
  const _$PortalAuthTokenExpiredImpl();

  @override
  String toString() {
    return 'PortalAuthFailure.tokenExpired()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthTokenExpiredImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return tokenExpired();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return tokenExpired?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (tokenExpired != null) {
      return tokenExpired();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return tokenExpired(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return tokenExpired?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (tokenExpired != null) {
      return tokenExpired(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthTokenExpired implements PortalAuthFailure {
  const factory _PortalAuthTokenExpired() = _$PortalAuthTokenExpiredImpl;
}

/// @nodoc
abstract class _$$PortalAuthTokenRevokedImplCopyWith<$Res> {
  factory _$$PortalAuthTokenRevokedImplCopyWith(
          _$PortalAuthTokenRevokedImpl value,
          $Res Function(_$PortalAuthTokenRevokedImpl) then) =
      __$$PortalAuthTokenRevokedImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$PortalAuthTokenRevokedImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res, _$PortalAuthTokenRevokedImpl>
    implements _$$PortalAuthTokenRevokedImplCopyWith<$Res> {
  __$$PortalAuthTokenRevokedImplCopyWithImpl(
      _$PortalAuthTokenRevokedImpl _value,
      $Res Function(_$PortalAuthTokenRevokedImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$PortalAuthTokenRevokedImpl implements _PortalAuthTokenRevoked {
  const _$PortalAuthTokenRevokedImpl();

  @override
  String toString() {
    return 'PortalAuthFailure.tokenRevoked()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthTokenRevokedImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return tokenRevoked();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return tokenRevoked?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (tokenRevoked != null) {
      return tokenRevoked();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return tokenRevoked(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return tokenRevoked?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (tokenRevoked != null) {
      return tokenRevoked(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthTokenRevoked implements PortalAuthFailure {
  const factory _PortalAuthTokenRevoked() = _$PortalAuthTokenRevokedImpl;
}

/// @nodoc
abstract class _$$PortalAuthUserDisabledImplCopyWith<$Res> {
  factory _$$PortalAuthUserDisabledImplCopyWith(
          _$PortalAuthUserDisabledImpl value,
          $Res Function(_$PortalAuthUserDisabledImpl) then) =
      __$$PortalAuthUserDisabledImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$PortalAuthUserDisabledImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res, _$PortalAuthUserDisabledImpl>
    implements _$$PortalAuthUserDisabledImplCopyWith<$Res> {
  __$$PortalAuthUserDisabledImplCopyWithImpl(
      _$PortalAuthUserDisabledImpl _value,
      $Res Function(_$PortalAuthUserDisabledImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$PortalAuthUserDisabledImpl implements _PortalAuthUserDisabled {
  const _$PortalAuthUserDisabledImpl();

  @override
  String toString() {
    return 'PortalAuthFailure.userDisabled()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthUserDisabledImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return userDisabled();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return userDisabled?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (userDisabled != null) {
      return userDisabled();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return userDisabled(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return userDisabled?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (userDisabled != null) {
      return userDisabled(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthUserDisabled implements PortalAuthFailure {
  const factory _PortalAuthUserDisabled() = _$PortalAuthUserDisabledImpl;
}

/// @nodoc
abstract class _$$PortalAuthUserNotFoundImplCopyWith<$Res> {
  factory _$$PortalAuthUserNotFoundImplCopyWith(
          _$PortalAuthUserNotFoundImpl value,
          $Res Function(_$PortalAuthUserNotFoundImpl) then) =
      __$$PortalAuthUserNotFoundImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$PortalAuthUserNotFoundImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res, _$PortalAuthUserNotFoundImpl>
    implements _$$PortalAuthUserNotFoundImplCopyWith<$Res> {
  __$$PortalAuthUserNotFoundImplCopyWithImpl(
      _$PortalAuthUserNotFoundImpl _value,
      $Res Function(_$PortalAuthUserNotFoundImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$PortalAuthUserNotFoundImpl implements _PortalAuthUserNotFound {
  const _$PortalAuthUserNotFoundImpl();

  @override
  String toString() {
    return 'PortalAuthFailure.userNotFound()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthUserNotFoundImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return userNotFound();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return userNotFound?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (userNotFound != null) {
      return userNotFound();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return userNotFound(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return userNotFound?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (userNotFound != null) {
      return userNotFound(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthUserNotFound implements PortalAuthFailure {
  const factory _PortalAuthUserNotFound() = _$PortalAuthUserNotFoundImpl;
}

/// @nodoc
abstract class _$$PortalAuthInvalidTokenImplCopyWith<$Res> {
  factory _$$PortalAuthInvalidTokenImplCopyWith(
          _$PortalAuthInvalidTokenImpl value,
          $Res Function(_$PortalAuthInvalidTokenImpl) then) =
      __$$PortalAuthInvalidTokenImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$PortalAuthInvalidTokenImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res, _$PortalAuthInvalidTokenImpl>
    implements _$$PortalAuthInvalidTokenImplCopyWith<$Res> {
  __$$PortalAuthInvalidTokenImplCopyWithImpl(
      _$PortalAuthInvalidTokenImpl _value,
      $Res Function(_$PortalAuthInvalidTokenImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$PortalAuthInvalidTokenImpl implements _PortalAuthInvalidToken {
  const _$PortalAuthInvalidTokenImpl();

  @override
  String toString() {
    return 'PortalAuthFailure.invalidToken()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthInvalidTokenImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return invalidToken();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return invalidToken?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (invalidToken != null) {
      return invalidToken();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return invalidToken(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return invalidToken?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (invalidToken != null) {
      return invalidToken(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthInvalidToken implements PortalAuthFailure {
  const factory _PortalAuthInvalidToken() = _$PortalAuthInvalidTokenImpl;
}

/// @nodoc
abstract class _$$PortalAuthRateLimitedImplCopyWith<$Res> {
  factory _$$PortalAuthRateLimitedImplCopyWith(
          _$PortalAuthRateLimitedImpl value,
          $Res Function(_$PortalAuthRateLimitedImpl) then) =
      __$$PortalAuthRateLimitedImplCopyWithImpl<$Res>;
  @useResult
  $Res call({DateTime? resetAt});
}

/// @nodoc
class __$$PortalAuthRateLimitedImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res, _$PortalAuthRateLimitedImpl>
    implements _$$PortalAuthRateLimitedImplCopyWith<$Res> {
  __$$PortalAuthRateLimitedImplCopyWithImpl(_$PortalAuthRateLimitedImpl _value,
      $Res Function(_$PortalAuthRateLimitedImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? resetAt = freezed,
  }) {
    return _then(_$PortalAuthRateLimitedImpl(
      resetAt: freezed == resetAt
          ? _value.resetAt
          : resetAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc

class _$PortalAuthRateLimitedImpl implements _PortalAuthRateLimited {
  const _$PortalAuthRateLimitedImpl({this.resetAt});

  @override
  final DateTime? resetAt;

  @override
  String toString() {
    return 'PortalAuthFailure.rateLimited(resetAt: $resetAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthRateLimitedImpl &&
            (identical(other.resetAt, resetAt) || other.resetAt == resetAt));
  }

  @override
  int get hashCode => Object.hash(runtimeType, resetAt);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PortalAuthRateLimitedImplCopyWith<_$PortalAuthRateLimitedImpl>
      get copyWith => __$$PortalAuthRateLimitedImplCopyWithImpl<
          _$PortalAuthRateLimitedImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return rateLimited(resetAt);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return rateLimited?.call(resetAt);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (rateLimited != null) {
      return rateLimited(resetAt);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return rateLimited(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return rateLimited?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (rateLimited != null) {
      return rateLimited(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthRateLimited implements PortalAuthFailure {
  const factory _PortalAuthRateLimited({final DateTime? resetAt}) =
      _$PortalAuthRateLimitedImpl;

  DateTime? get resetAt;

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PortalAuthRateLimitedImplCopyWith<_$PortalAuthRateLimitedImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$PortalAuthNetworkErrorImplCopyWith<$Res> {
  factory _$$PortalAuthNetworkErrorImplCopyWith(
          _$PortalAuthNetworkErrorImpl value,
          $Res Function(_$PortalAuthNetworkErrorImpl) then) =
      __$$PortalAuthNetworkErrorImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$PortalAuthNetworkErrorImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res, _$PortalAuthNetworkErrorImpl>
    implements _$$PortalAuthNetworkErrorImplCopyWith<$Res> {
  __$$PortalAuthNetworkErrorImplCopyWithImpl(
      _$PortalAuthNetworkErrorImpl _value,
      $Res Function(_$PortalAuthNetworkErrorImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$PortalAuthNetworkErrorImpl implements _PortalAuthNetworkError {
  const _$PortalAuthNetworkErrorImpl();

  @override
  String toString() {
    return 'PortalAuthFailure.networkError()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthNetworkErrorImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return networkError();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return networkError?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (networkError != null) {
      return networkError();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return networkError(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return networkError?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (networkError != null) {
      return networkError(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthNetworkError implements PortalAuthFailure {
  const factory _PortalAuthNetworkError() = _$PortalAuthNetworkErrorImpl;
}

/// @nodoc
abstract class _$$PortalAuthAttachmentNotFoundImplCopyWith<$Res> {
  factory _$$PortalAuthAttachmentNotFoundImplCopyWith(
          _$PortalAuthAttachmentNotFoundImpl value,
          $Res Function(_$PortalAuthAttachmentNotFoundImpl) then) =
      __$$PortalAuthAttachmentNotFoundImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$PortalAuthAttachmentNotFoundImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res,
        _$PortalAuthAttachmentNotFoundImpl>
    implements _$$PortalAuthAttachmentNotFoundImplCopyWith<$Res> {
  __$$PortalAuthAttachmentNotFoundImplCopyWithImpl(
      _$PortalAuthAttachmentNotFoundImpl _value,
      $Res Function(_$PortalAuthAttachmentNotFoundImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$PortalAuthAttachmentNotFoundImpl
    implements _PortalAuthAttachmentNotFound {
  const _$PortalAuthAttachmentNotFoundImpl();

  @override
  String toString() {
    return 'PortalAuthFailure.attachmentNotFound()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthAttachmentNotFoundImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return attachmentNotFound();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return attachmentNotFound?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (attachmentNotFound != null) {
      return attachmentNotFound();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return attachmentNotFound(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return attachmentNotFound?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (attachmentNotFound != null) {
      return attachmentNotFound(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthAttachmentNotFound implements PortalAuthFailure {
  const factory _PortalAuthAttachmentNotFound() =
      _$PortalAuthAttachmentNotFoundImpl;
}

/// @nodoc
abstract class _$$PortalAuthUnknownImplCopyWith<$Res> {
  factory _$$PortalAuthUnknownImplCopyWith(_$PortalAuthUnknownImpl value,
          $Res Function(_$PortalAuthUnknownImpl) then) =
      __$$PortalAuthUnknownImplCopyWithImpl<$Res>;
  @useResult
  $Res call({String? raw});
}

/// @nodoc
class __$$PortalAuthUnknownImplCopyWithImpl<$Res>
    extends _$PortalAuthFailureCopyWithImpl<$Res, _$PortalAuthUnknownImpl>
    implements _$$PortalAuthUnknownImplCopyWith<$Res> {
  __$$PortalAuthUnknownImplCopyWithImpl(_$PortalAuthUnknownImpl _value,
      $Res Function(_$PortalAuthUnknownImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? raw = freezed,
  }) {
    return _then(_$PortalAuthUnknownImpl(
      freezed == raw
          ? _value.raw
          : raw // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc

class _$PortalAuthUnknownImpl implements _PortalAuthUnknown {
  const _$PortalAuthUnknownImpl(this.raw);

  @override
  final String? raw;

  @override
  String toString() {
    return 'PortalAuthFailure.unknown(raw: $raw)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthUnknownImpl &&
            (identical(other.raw, raw) || other.raw == raw));
  }

  @override
  int get hashCode => Object.hash(runtimeType, raw);

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PortalAuthUnknownImplCopyWith<_$PortalAuthUnknownImpl> get copyWith =>
      __$$PortalAuthUnknownImplCopyWithImpl<_$PortalAuthUnknownImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() tokenExpired,
    required TResult Function() tokenRevoked,
    required TResult Function() userDisabled,
    required TResult Function() userNotFound,
    required TResult Function() invalidToken,
    required TResult Function(DateTime? resetAt) rateLimited,
    required TResult Function() networkError,
    required TResult Function() attachmentNotFound,
    required TResult Function(String? raw) unknown,
  }) {
    return unknown(raw);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? tokenExpired,
    TResult? Function()? tokenRevoked,
    TResult? Function()? userDisabled,
    TResult? Function()? userNotFound,
    TResult? Function()? invalidToken,
    TResult? Function(DateTime? resetAt)? rateLimited,
    TResult? Function()? networkError,
    TResult? Function()? attachmentNotFound,
    TResult? Function(String? raw)? unknown,
  }) {
    return unknown?.call(raw);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? tokenExpired,
    TResult Function()? tokenRevoked,
    TResult Function()? userDisabled,
    TResult Function()? userNotFound,
    TResult Function()? invalidToken,
    TResult Function(DateTime? resetAt)? rateLimited,
    TResult Function()? networkError,
    TResult Function()? attachmentNotFound,
    TResult Function(String? raw)? unknown,
    required TResult orElse(),
  }) {
    if (unknown != null) {
      return unknown(raw);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(_PortalAuthTokenExpired value) tokenExpired,
    required TResult Function(_PortalAuthTokenRevoked value) tokenRevoked,
    required TResult Function(_PortalAuthUserDisabled value) userDisabled,
    required TResult Function(_PortalAuthUserNotFound value) userNotFound,
    required TResult Function(_PortalAuthInvalidToken value) invalidToken,
    required TResult Function(_PortalAuthRateLimited value) rateLimited,
    required TResult Function(_PortalAuthNetworkError value) networkError,
    required TResult Function(_PortalAuthAttachmentNotFound value)
        attachmentNotFound,
    required TResult Function(_PortalAuthUnknown value) unknown,
  }) {
    return unknown(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult? Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult? Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult? Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult? Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult? Function(_PortalAuthRateLimited value)? rateLimited,
    TResult? Function(_PortalAuthNetworkError value)? networkError,
    TResult? Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult? Function(_PortalAuthUnknown value)? unknown,
  }) {
    return unknown?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(_PortalAuthTokenExpired value)? tokenExpired,
    TResult Function(_PortalAuthTokenRevoked value)? tokenRevoked,
    TResult Function(_PortalAuthUserDisabled value)? userDisabled,
    TResult Function(_PortalAuthUserNotFound value)? userNotFound,
    TResult Function(_PortalAuthInvalidToken value)? invalidToken,
    TResult Function(_PortalAuthRateLimited value)? rateLimited,
    TResult Function(_PortalAuthNetworkError value)? networkError,
    TResult Function(_PortalAuthAttachmentNotFound value)? attachmentNotFound,
    TResult Function(_PortalAuthUnknown value)? unknown,
    required TResult orElse(),
  }) {
    if (unknown != null) {
      return unknown(this);
    }
    return orElse();
  }
}

abstract class _PortalAuthUnknown implements PortalAuthFailure {
  const factory _PortalAuthUnknown(final String? raw) = _$PortalAuthUnknownImpl;

  String? get raw;

  /// Create a copy of PortalAuthFailure
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PortalAuthUnknownImplCopyWith<_$PortalAuthUnknownImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$PortalAuthHandshakeState {
  PortalLifecycle get status => throw _privateConstructorUsedError;
  PortalAuthFailure? get failure => throw _privateConstructorUsedError;
  bool get pageReady => throw _privateConstructorUsedError;
  int get retryCount => throw _privateConstructorUsedError;

  /// Create a copy of PortalAuthHandshakeState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PortalAuthHandshakeStateCopyWith<PortalAuthHandshakeState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PortalAuthHandshakeStateCopyWith<$Res> {
  factory $PortalAuthHandshakeStateCopyWith(PortalAuthHandshakeState value,
          $Res Function(PortalAuthHandshakeState) then) =
      _$PortalAuthHandshakeStateCopyWithImpl<$Res, PortalAuthHandshakeState>;
  @useResult
  $Res call(
      {PortalLifecycle status,
      PortalAuthFailure? failure,
      bool pageReady,
      int retryCount});

  $PortalAuthFailureCopyWith<$Res>? get failure;
}

/// @nodoc
class _$PortalAuthHandshakeStateCopyWithImpl<$Res,
        $Val extends PortalAuthHandshakeState>
    implements $PortalAuthHandshakeStateCopyWith<$Res> {
  _$PortalAuthHandshakeStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PortalAuthHandshakeState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? failure = freezed,
    Object? pageReady = null,
    Object? retryCount = null,
  }) {
    return _then(_value.copyWith(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as PortalLifecycle,
      failure: freezed == failure
          ? _value.failure
          : failure // ignore: cast_nullable_to_non_nullable
              as PortalAuthFailure?,
      pageReady: null == pageReady
          ? _value.pageReady
          : pageReady // ignore: cast_nullable_to_non_nullable
              as bool,
      retryCount: null == retryCount
          ? _value.retryCount
          : retryCount // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }

  /// Create a copy of PortalAuthHandshakeState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PortalAuthFailureCopyWith<$Res>? get failure {
    if (_value.failure == null) {
      return null;
    }

    return $PortalAuthFailureCopyWith<$Res>(_value.failure!, (value) {
      return _then(_value.copyWith(failure: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$PortalAuthHandshakeStateImplCopyWith<$Res>
    implements $PortalAuthHandshakeStateCopyWith<$Res> {
  factory _$$PortalAuthHandshakeStateImplCopyWith(
          _$PortalAuthHandshakeStateImpl value,
          $Res Function(_$PortalAuthHandshakeStateImpl) then) =
      __$$PortalAuthHandshakeStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {PortalLifecycle status,
      PortalAuthFailure? failure,
      bool pageReady,
      int retryCount});

  @override
  $PortalAuthFailureCopyWith<$Res>? get failure;
}

/// @nodoc
class __$$PortalAuthHandshakeStateImplCopyWithImpl<$Res>
    extends _$PortalAuthHandshakeStateCopyWithImpl<$Res,
        _$PortalAuthHandshakeStateImpl>
    implements _$$PortalAuthHandshakeStateImplCopyWith<$Res> {
  __$$PortalAuthHandshakeStateImplCopyWithImpl(
      _$PortalAuthHandshakeStateImpl _value,
      $Res Function(_$PortalAuthHandshakeStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of PortalAuthHandshakeState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? status = null,
    Object? failure = freezed,
    Object? pageReady = null,
    Object? retryCount = null,
  }) {
    return _then(_$PortalAuthHandshakeStateImpl(
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as PortalLifecycle,
      failure: freezed == failure
          ? _value.failure
          : failure // ignore: cast_nullable_to_non_nullable
              as PortalAuthFailure?,
      pageReady: null == pageReady
          ? _value.pageReady
          : pageReady // ignore: cast_nullable_to_non_nullable
              as bool,
      retryCount: null == retryCount
          ? _value.retryCount
          : retryCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc

class _$PortalAuthHandshakeStateImpl extends _PortalAuthHandshakeState {
  const _$PortalAuthHandshakeStateImpl(
      {this.status = PortalLifecycle.idle,
      this.failure,
      this.pageReady = false,
      this.retryCount = 0})
      : super._();

  @override
  @JsonKey()
  final PortalLifecycle status;
  @override
  final PortalAuthFailure? failure;
  @override
  @JsonKey()
  final bool pageReady;
  @override
  @JsonKey()
  final int retryCount;

  @override
  String toString() {
    return 'PortalAuthHandshakeState(status: $status, failure: $failure, pageReady: $pageReady, retryCount: $retryCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PortalAuthHandshakeStateImpl &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.failure, failure) || other.failure == failure) &&
            (identical(other.pageReady, pageReady) ||
                other.pageReady == pageReady) &&
            (identical(other.retryCount, retryCount) ||
                other.retryCount == retryCount));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, status, failure, pageReady, retryCount);

  /// Create a copy of PortalAuthHandshakeState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PortalAuthHandshakeStateImplCopyWith<_$PortalAuthHandshakeStateImpl>
      get copyWith => __$$PortalAuthHandshakeStateImplCopyWithImpl<
          _$PortalAuthHandshakeStateImpl>(this, _$identity);
}

abstract class _PortalAuthHandshakeState extends PortalAuthHandshakeState {
  const factory _PortalAuthHandshakeState(
      {final PortalLifecycle status,
      final PortalAuthFailure? failure,
      final bool pageReady,
      final int retryCount}) = _$PortalAuthHandshakeStateImpl;
  const _PortalAuthHandshakeState._() : super._();

  @override
  PortalLifecycle get status;
  @override
  PortalAuthFailure? get failure;
  @override
  bool get pageReady;
  @override
  int get retryCount;

  /// Create a copy of PortalAuthHandshakeState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PortalAuthHandshakeStateImplCopyWith<_$PortalAuthHandshakeStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
