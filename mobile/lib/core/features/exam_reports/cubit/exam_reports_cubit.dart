import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/network/erros/failure_messages.dart';
import 'package:app/core/network/erros/failures.dart';
import 'package:app/core/enums/request_state.dart';
import 'package:app/features/study_session/domain/entities/real_exam_report_entity.dart';
import 'package:app/features/question_preview/domain/usecases/seen_in_exam_usecase.dart';

part 'exam_reports_cubit.freezed.dart';
part 'exam_reports_state.dart';

@injectable
class ExamReportsCubit extends Cubit<ExamReportsState> {
  final SeenInExamUseCase _useCase;

  ExamReportsCubit(this._useCase) : super(const ExamReportsState());

  // T137 — load reports for the current question
  Future<void> loadReports(String questionId) async {
    emit(state.copyWith(loadState: RequestState.loading, errorMessage: null));
    final result = await _useCase.getRealExamReports(questionId);
    result.fold(
      (failure) => emit(state.copyWith(
        loadState: RequestState.error,
        isTrialLocked: failure is ForbiddenFailure,
        errorMessage: failure is ForbiddenFailure ? null : failure.userFacingMessage,
      )),
      (reports) => emit(state.copyWith(
        loadState: RequestState.loaded,
        reports: reports,
      )),
    );
  }

  void selectDate(DateTime date) => emit(state.copyWith(selectedDate: date));

  void clearError() => emit(state.copyWith(errorMessage: null));

  void toggleCountryExpand(String countryCode) {
    final expanded = Set<String>.from(state.expandedCountryCodes);
    if (expanded.contains(countryCode)) {
      expanded.remove(countryCode);
    } else {
      expanded.add(countryCode);
    }
    emit(state.copyWith(expandedCountryCodes: expanded));
  }

  // T137 — submit with optimistic increment + de-dup guard (FR-047)
  Future<void> submitReport(String questionId) async {
    if (!state.canSubmit) return;
    final date = state.selectedDate!;

    // optimistic: increment total in the first country or show pending
    emit(state.copyWith(isSubmitting: true, errorMessage: null));

    final result = await _useCase.reportSeenInExam(questionId, date);
    result.fold(
      (failure) => emit(state.copyWith(
        isSubmitting: false,
        isTrialLocked: failure is ForbiddenFailure,
        errorMessage: failure is ForbiddenFailure ? null : failure.userFacingMessage,
      )),
      (_) {
        emit(state.copyWith(
          isSubmitting: false,
          userHasReported: true,
          selectedDate: null,
        ));
        // reload to get server-side aggregated counts
        loadReports(questionId);
      },
    );
  }
}
