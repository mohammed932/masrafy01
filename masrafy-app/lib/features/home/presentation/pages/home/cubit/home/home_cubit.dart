import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

part 'home_cubit.freezed.dart';
part 'home_state.dart';

/// Home / loan-type selection (Figma `100:1503`). Tracks the chosen loan
/// category for the "Continue" CTA. Content is static design data (the four
/// constitution-locked retail categories) — no remote fetch, so no shimmer
/// (Principle XXXIV applies to async, content-bearing screens). Orchestration
/// only (Principle XXXI).
@injectable
class HomeCubit extends Cubit<HomeState> {
  HomeCubit() : super(const HomeState());

  void selectCategory(HomeLoanCategory category) =>
      emit(state.copyWith(selected: category));
}
