part of 'exam_reports_widgets.imports.dart';

/// T139 — composer form: heading, date picker, Submit button.
/// CountryEntity is resolved server-side from the user's profile (matching Angular).
class SeenInExamForm extends StatelessWidget {
  const SeenInExamForm({super.key, required this.questionId});

  final String questionId;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return BlocBuilder<ExamReportsCubit, ExamReportsState>(
      buildWhen: (p, c) =>
          c.selectedDate != p.selectedDate ||
          c.isSubmitting != p.isSubmitting ||
          c.userHasReported != p.userHasReported ||
          c.isTrialLocked != p.isTrialLocked,
      builder: (context, state) {
        final cubit = context.read<ExamReportsCubit>();

        if (state.userHasReported) {
          return Padding(
            padding: EdgeInsets.symmetric(vertical: 12.h),
            child: Row(
              children: [
                Icon(Icons.check_circle_outline,
                    size: 18.r, color: colors.success.main),
                Gap(8.w),
                Text(
                  'You reported this question.',
                  style:
                      texts.body.copyWith(color: colors.success.main),
                ),
              ],
            ),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Have you seen this question in your official exam? Please let us know when.',
              style: texts.bodySmall.copyWith(color: colors.text.secondary),
            ),
            Gap(12.h),
            // Date picker row
            GestureDetector(
              onTap: () {
                final theme = PilotColorTheme.of(context);
                showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => PilotColorThemeProvider(
                    theme: theme,
                    child: PilotSingleDatePickerSheet(
                      initialDate: state.selectedDate ?? DateTime.now(),
                      firstDate: DateTime(2010),
                      lastDate: DateTime.now(),
                      onDateSelected: cubit.selectDate,
                    ),
                  ),
                );
              },
              child: Container(
                padding: EdgeInsets.symmetric(
                    horizontal: 12.w, vertical: 10.h),
                decoration: BoxDecoration(
                  border: Border.all(color: colors.border.main),
                  borderRadius: BorderRadius.circular(8.r),
                  color: colors.fill.alterSolid,
                ),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today_outlined,
                        size: 18.r, color: colors.text.secondary),
                    Gap(10.w),
                    Expanded(
                      child: Text(
                        state.selectedDate != null
                            ? _formatDate(state.selectedDate!)
                            : 'Select exam date',
                        style: texts.body.copyWith(
                          color: state.selectedDate != null
                              ? colors.text.primary
                              : colors.text.secondary,
                        ),
                      ),
                    ),
                    Icon(Icons.arrow_drop_down,
                        size: 20.r, color: colors.text.secondary),
                  ],
                ),
              ),
            ),
            Gap(12.h),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: state.canSubmit
                    ? () => cubit.submitReport(questionId)
                    : null,
                style: FilledButton.styleFrom(
                    backgroundColor: colors.primary.main),
                child: state.isSubmitting
                    ? SizedBox(
                        width: 18.r,
                        height: 18.r,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: colors.bg.container,
                        ),
                      )
                    : Text(
                        'Submit',
                        style: texts.body
                            .copyWith(color: colors.bg.container),
                      ),
              ),
            ),
          ],
        );
      },
    );
  }

  String _formatDate(DateTime date) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${date.day} ${months[date.month - 1]}, ${date.year}';
  }
}
