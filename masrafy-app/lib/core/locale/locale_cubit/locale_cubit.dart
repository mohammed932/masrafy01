import 'package:bloc/bloc.dart';
import 'package:flutter/widgets.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/cache/shared_prefs_service.dart';
import 'package:app/core/enums/storage_keys.dart';

part 'locale_state.dart';
part 'locale_cubit.freezed.dart';

/// App-wide UI language. Mirrors [ThemeBloc]: reads/writes the persisted code in
/// [SharedPrefsService] under [StorageKeys.locale] and feeds `MaterialApp.router`
/// `locale:` so the whole tree re-renders (RTL flips automatically via
/// `flutter_localizations`). English is the default.
@injectable
class LocaleCubit extends Cubit<LocaleState> {
  LocaleCubit(this._prefs) : super(const LocaleState());

  final SharedPrefsService _prefs;

  /// Hydrate from the persisted preference. Unknown / absent → keep the English
  /// default. Called once when provided at the app root.
  void init() {
    final raw = _prefs.getString(StorageKeys.locale.name);
    if (raw == 'en' || raw == 'ar') {
      emit(state.copyWith(languageCode: raw!));
    }
  }

  /// Persist and switch the active language. No-op for unsupported codes.
  Future<void> change(String code) async {
    if (code != 'en' && code != 'ar') return;
    await _prefs.setString(StorageKeys.locale.name, code);
    emit(state.copyWith(languageCode: code));
  }
}
