part of 'home_cubit.dart';

/// The four constitution-locked retail loan categories (Principle II).
enum HomeLoanCategory { personal, mortgage, car, business }

@freezed
class HomeState with _$HomeState {
  const factory HomeState({
    @Default(HomeLoanCategory.personal) HomeLoanCategory selected,
  }) = _HomeState;

  // ignore: unused_element
  const HomeState._();
}
