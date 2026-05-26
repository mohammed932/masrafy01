part of 'exam_reports_widgets.imports.dart';

/// T138 — composer (form) at top, aggregated country list below.
/// T141 — total count shown with AnimatedSwitcher for increment animation.
/// T142 — requires [ExamReportsCubit] provided by the caller.
class ExamReportsPanel extends StatelessWidget {
  const ExamReportsPanel({super.key, required this.questionId});

  final String questionId;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return BlocListener<ExamReportsCubit, ExamReportsState>(
      listenWhen: (p, c) => c.isTrialLocked && !p.isTrialLocked,
      listener: (ctx, _) => _showTrialLockedDialog(ctx, colors, texts),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Total count header with animation (T141)
          _TotalHeader(colors: colors, texts: texts),
          Gap(4.h),
          Divider(height: 1, color: colors.border.main),
          Gap(12.h),
          SeenInExamForm(questionId: questionId),
          Gap(16.h),
          Divider(height: 1, color: colors.border.main),
          Gap(12.h),
          Text(
            'Reports by CountryEntity',
            style: texts.body.semiBold().copyWith(color: colors.text.primary),
          ),
          Gap(8.h),
          BlocBuilder<ExamReportsCubit, ExamReportsState>(
            buildWhen: (p, c) =>
                c.reports != p.reports ||
                c.loadState != p.loadState ||
                c.expandedCountryCodes != p.expandedCountryCodes,
            builder: (context, state) {
              if (state.loadState.isLoading) {
                return Center(
                  child: Padding(
                    padding: EdgeInsets.all(24.h),
                    child: CircularProgressIndicator(
                        color: colors.primary.main),
                  ),
                );
              }
              if (state.reports.isEmpty) {
                return Text(
                  'No reports yet for this question.',
                  style:
                      texts.body.copyWith(color: colors.text.secondary),
                );
              }
              final cubit = context.read<ExamReportsCubit>();
              return Column(
                children: state.reports
                    .map((report) => CountryRow(
                          report: report,
                          isExpanded: state.expandedCountryCodes
                              .contains(report.countryCode),
                          onTap: () =>
                              cubit.toggleCountryExpand(report.countryCode),
                        ))
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  void _showTrialLockedDialog(
      BuildContext ctx, PilotColorTheme colors, PilotTextTheme texts) {
    PilotInfoDialog.show(
      ctx,
      title: 'Upgrade Required',
      message: 'Seen in Exam reports are available on the Pro plan.',
    );
  }
}

class _TotalHeader extends StatelessWidget {
  const _TotalHeader({required this.colors, required this.texts});

  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ExamReportsCubit, ExamReportsState>(
      buildWhen: (p, c) => c.totalReports != p.totalReports,
      builder: (context, state) => Row(
        children: [
          Icon(Icons.remove_red_eye_outlined,
              size: 18.r, color: colors.text.secondary),
          Gap(6.w),
          Text(
            'Seen in Exam',
            style: texts.body.semiBold().copyWith(color: colors.text.primary),
          ),
          Gap(8.w),
          // T141 — animated counter
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            transitionBuilder: (child, animation) =>
                FadeTransition(opacity: animation, child: child),
            child: Text(
              '${state.totalReports}',
              key: ValueKey(state.totalReports),
              style: texts.body.semiBold().copyWith(color: colors.primary.main),
            ),
          ),
        ],
      ),
    );
  }
}
