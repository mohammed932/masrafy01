import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

@singleton
class SharedPrefsService {
  final SharedPreferences _prefs;

  SharedPrefsService(this._prefs);

  SharedPreferences get instance => _prefs;

  Future<bool> clear() => _prefs.clear();

  Future<void> setString(String key, String value) => _prefs.setString(key, value);

  String? getString(String key) => _prefs.getString(key);

  Future<bool> remove(String key) => _prefs.remove(key);
}
