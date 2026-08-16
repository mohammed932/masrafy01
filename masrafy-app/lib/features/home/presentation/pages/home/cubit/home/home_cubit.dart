import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

part 'home_cubit.freezed.dart';
part 'home_state.dart';

/// Home / loan-type selection (Figma `100:1503`). Tracks the chosen loan
/// category and nothing else — the four categories are static design data
/// (constitution-locked, Principle II).
///
/// The catalog program name USED to be picked here too, from the `program_name`
/// registry filtered by the category's assignment. It moved into the loan-setup
/// wizard because the assignment is the wrong authority: it says which names an
/// operator files under a category, not which of them a bank actually sells, nor
/// on which income basis. A name offered here could have no live program at all,
/// or only programs that read a payslip — shown to a customer who is about to say
/// they have none. The wizard asks for the basis first and then lists only names
/// with a live program under BOTH answers.
///
/// Orchestration only (Principle XXXI).
@injectable
class HomeCubit extends Cubit<HomeState> {
  HomeCubit() : super(const HomeState());

  void selectCategory(HomeLoanCategory category) =>
      emit(state.copyWith(selected: category));
}
