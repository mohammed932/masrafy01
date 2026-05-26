import 'package:injectable/injectable.dart';
import 'package:app/core/entities/user_entity.dart';

@singleton
class UserService {
  UserEntity? _user;

  UserEntity? get user => _user;

  bool get hasUser => _user != null;

  /// Alias kept for callers that used the older name.
  bool get isLoggedIn => hasUser;

  void setUser(UserEntity user) => _user = user;

  void clear() => _user = null;
}
