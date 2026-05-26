import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/cache/shared_prefs_service.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/enums/storage_keys.dart';

part 'theme_event.dart';
part 'theme_state.dart';
part 'theme_bloc.freezed.dart';

@injectable
class ThemeBloc extends Bloc<ThemeBlocEvent, ThemeBlocState> {
  final SharedPrefsService _prefs;

  ThemeBloc(this._prefs) : super(const ThemeBlocState()) {
    on<ThemeBlocEvent>((event, emit) async {
      await event.when(
        initColorTheme: () => _initColorTheme(emit),
        changeColorTheme: (mode) => _changeColorTheme(emit, mode),
      );
    });
  }

  Future<void> _initColorTheme(Emitter<ThemeBlocState> emit) async {
    emit(state.copyWith(mode: _readSavedMode()));
  }

  Future<void> _changeColorTheme(
    Emitter<ThemeBlocState> emit,
    ColorThemes mode,
  ) async {
    await _prefs.setString(StorageKeys.pilotColorTheme.name, mode.name);
    emit(state.copyWith(mode: mode));
  }

  ColorThemes _readSavedMode() {
    final raw = _prefs.getString(StorageKeys.pilotColorTheme.name);
    if (raw == null) return ColorThemes.dark;
    return ColorThemes.values.firstWhere(
      (e) => e.name == raw,
      orElse: () => ColorThemes.dark,
    );
  }
}
