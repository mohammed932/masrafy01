part of 'home_cubit.dart';

/// The four constitution-locked retail loan categories (Principle II).
enum HomeLoanCategory { personal, mortgage, car, business }

/// The category slug the backend speaks (`apply`'s `category`, and the value
/// `program_name` members are assigned to). The enum name is a UI concern; this
/// is the wire value, so the two never drift through a `toString()`.
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

    /// Whole `program_name` catalog, unfiltered — [programsForCategory] narrows
    /// it per selection.
    @Default(<PlatformEnumerationEntity>[])
    List<PlatformEnumerationEntity> programs,
    @Default(RequestState.initial) RequestState programsStatus,

    /// The picked catalog name, or null when nothing is picked yet / the
    /// category offers none.
    String? programKey,
  }) = _HomeState;

  // ignore: unused_element
  const HomeState._();

  /// The catalog names offered under the selected category.
  ///
  /// Filtered on the ASSIGNMENT the member carries, so a name assigned to
  /// nothing (parked) is offered nowhere — matching the backend, which rejects
  /// an unassigned (name, category) pair. Anything laxer would let the customer
  /// pick a name and then be refused at apply.
  List<PlatformEnumerationEntity> get programsForCategory => programs
      .where((p) => p.offeredUnder(selected.code))
      .toList(growable: false);

  /// True while the catalog is still being fetched — the picker shows a
  /// disabled field rather than an empty list that reads as "none exist".
  bool get isLoadingPrograms =>
      programsStatus == RequestState.initial ||
      programsStatus == RequestState.loading;

  /// Whether a program name must be picked before continuing.
  ///
  /// False when the category has none — a customer must never be trapped on
  /// Home by a catalog an operator has not filled in (or that failed to load).
  /// The request then goes out category-only, which is what it always was.
  bool get requiresProgram =>
      !isLoadingPrograms && programsForCategory.isNotEmpty;

  bool get canContinue => !isLoadingPrograms && (!requiresProgram || programKey != null);
}
