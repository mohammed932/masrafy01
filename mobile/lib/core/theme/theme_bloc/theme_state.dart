part of 'theme_bloc.dart';

@freezed
class ThemeBlocState with _$ThemeBlocState {
  const factory ThemeBlocState({
    @Default(ColorThemes.dark) ColorThemes mode,
  }) = _ThemeBlocState;
}
