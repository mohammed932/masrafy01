import 'package:cookie_jar/cookie_jar.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

@module
abstract class InjectionModule {
  @preResolve
  Future<SharedPreferences> get prefs => SharedPreferences.getInstance();

  @lazySingleton
  FirebaseMessaging get messaging => FirebaseMessaging.instance;

  // NOTE: `AutoRouteObserver` is intentionally NOT registered as a
  // singleton here — a `NavigatorObserver` can only be attached to one
  // Navigator at a time, so the root + nested AutoRouters each need
  // their own instance. `main.dart` mints a fresh one per call inside
  // `routerConfig.navigatorObservers`.

  /// In-memory cookie jar shared by the Dio cookie manager and the
  /// session-expiration handler. Lifted to DI so force-logout can wipe
  /// the backend session cookies (`MasrafyAuthToken`, `XSRF-TOKEN`).
  @lazySingleton
  CookieJar get cookieJar => CookieJar();
}
