part of 'exam_reports_cubit.dart';

@freezed
class ExamReportsState with _$ExamReportsState {
  const factory ExamReportsState({
    @Default(RequestState.initial) RequestState loadState,
    @Default([]) List<RealExamReportEntity> reports,
    @Default({}) Set<String> expandedCountryCodes,
    DateTime? selectedDate,
    @Default(false) bool isSubmitting,
    @Default(false) bool isTrialLocked,
    @Default(false) bool userHasReported,
    String? errorMessage,
  }) = _ExamReportsState;
  // ignore: unused_element
  const ExamReportsState._();

  bool get canSubmit => selectedDate != null && !isSubmitting && !userHasReported;

  int get totalReports =>
      reports.fold(0, (sum, r) => sum + r.totalReports);
}
