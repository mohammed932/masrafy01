part of 'home_cubit.dart';

/// The constitution-locked retail loan categories (Principle II). The no-payslip
/// product is NOT one of them: v16.0.0 made it a property of the bank program
/// (`programType`), not a card the customer taps. It is asked one screen later,
/// in the loan-setup wizard, as a filter over programs.
enum HomeLoanCategory { personal, mortgage, car, business }

/// The category slug the backend speaks (`apply`'s `category`, the value
/// `program_name` members are assigned to, and `program-options`' query param).
/// The enum name is a UI concern; this is the wire value, so the two never drift
/// through a `toString()`.
extension HomeLoanCategoryCode on HomeLoanCategory {
  String get code => switch (this) {
        HomeLoanCategory.personal => 'personal',
        HomeLoanCategory.mortgage => 'mortgage',
        HomeLoanCategory.car => 'car',
        HomeLoanCategory.business => 'business',
      };
}

@freezed
class HomeState with _$HomeState {
  const factory HomeState({
    @Default(HomeLoanCategory.personal) HomeLoanCategory selected,
  }) = _HomeState;

  // ignore: unused_element
  const HomeState._();

  /// Always true — a category is always selected, and everything downstream of
  /// it is now asked in the wizard, which is the only place the app can know
  /// what is actually on offer. Kept as a named getter so the CTA reads the same
  /// as every other gated CTA in the app.
  bool get canContinue => true;
}
