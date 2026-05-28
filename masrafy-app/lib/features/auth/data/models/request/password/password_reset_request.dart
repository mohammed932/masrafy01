class PasswordResetRequest {
  const PasswordResetRequest({
    required this.passwordResetToken,
    required this.newPassword,
  });

  final String passwordResetToken;
  final String newPassword;

  Map<String, dynamic> toJson() => {
        'passwordResetToken': passwordResetToken,
        'newPassword': newPassword,
      };
}

class PasswordChangeRequest {
  const PasswordChangeRequest({
    required this.currentPassword,
    required this.newPassword,
  });

  final String currentPassword;
  final String newPassword;

  Map<String, dynamic> toJson() => {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      };
}
