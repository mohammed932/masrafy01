import 'package:equatable/equatable.dart';

import '../../domain/entities/customer_entity.dart';

enum LoginStatus { idle, submitting, success, failure }

class LoginState extends Equatable {
  const LoginState({
    this.status = LoginStatus.idle,
    this.errorCode,
    this.session,
  });

  final LoginStatus status;
  final String? errorCode;
  final CustomerSessionEntity? session;

  LoginState copyWith({
    LoginStatus? status,
    String? errorCode,
    CustomerSessionEntity? session,
    bool clearError = false,
  }) {
    return LoginState(
      status: status ?? this.status,
      errorCode: clearError ? null : (errorCode ?? this.errorCode),
      session: session ?? this.session,
    );
  }

  @override
  List<Object?> get props => [status, errorCode, session];
}
