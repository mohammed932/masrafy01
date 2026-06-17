part of 'theme_bloc.dart';

@freezed
class ThemeBlocState with _$ThemeBlocState {
  const factory ThemeBlocState({
    @Default(ColorThemes.light) ColorThemes mode,
  }) = _ThemeBlocState;
}
