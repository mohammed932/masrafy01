part of 'locale_cubit.dart';

@freezed
class LocaleState with _$LocaleState {
  const factory LocaleState({
    @Default('en') String languageCode,
  }) = _LocaleState;

  const LocaleState._();

  /// The active [Locale] fed to `MaterialApp.router`.
  Locale get locale => Locale(languageCode);
}
