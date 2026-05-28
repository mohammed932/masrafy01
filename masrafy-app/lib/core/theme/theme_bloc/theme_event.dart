part of 'theme_bloc.dart';

@freezed
class ThemeBlocEvent with _$ThemeBlocEvent {
  const factory ThemeBlocEvent.initColorTheme() = _InitColorTheme;
  const factory ThemeBlocEvent.changeColorTheme({
    required ColorThemes mode,
  }) = _ChangeColorTheme;
}
