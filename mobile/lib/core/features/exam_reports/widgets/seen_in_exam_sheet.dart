part of 'exam_reports_widgets.imports.dart';

/// Pixel-perfect mirror of Figma frame 3263:49723 (Seen-in-Exam panel).
/// Opens as a modal bottom sheet from the study-screen header chip.
/// Re-uses [ExamReportsCubit] for the form + per-country aggregated list.
class SeenInExamSheet extends StatelessWidget {
  const SeenInExamSheet({super.key, required this.questionId});

  final String questionId;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return BlocListener<ExamReportsCubit, ExamReportsState>(
      listenWhen: (prev, curr) =>
          curr.errorMessage != null &&
          curr.errorMessage != prev.errorMessage,
      listener: (context, state) {
        PilotErrorToast(message: state.errorMessage!).show(context);
        // Clear so subsequent identical errors still fire the listener.
        context.read<ExamReportsCubit>().clearError();
      },
      child: Container(
        height: MediaQuery.of(context).size.height * 0.6,
        decoration: BoxDecoration(
          color: colors.bg.container,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24.r)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              _SheetHeader(colors: colors, texts: texts),
              Expanded(
                child: SingleChildScrollView(
                  padding: EdgeInsets.fromLTRB(16.w, 24.h, 16.w, 24.h),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _IntroAndForm(
                        questionId: questionId,
                        colors: colors,
                        texts: texts,
                      ),
                      Gap(24.h),
                      Container(height: 1, color: colors.border.main),
                      Gap(24.h),
                      Text(
                        'All Users',
                        style: texts.body
                            .semiBold()
                            .copyWith(color: colors.text.primary),
                      ),
                      Gap(16.h),
                      _AllUsersList(colors: colors, texts: texts),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Sheet header — handle (44×4 #DEDEDE) at top:8h, 24h gap, title
/// "Seen in Exam" centered, 0.75 hairline divider at bottom edge.
class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.colors, required this.texts});

  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 76.h,
      child: Stack(
        children: [
          Positioned(
            top: 8.h,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Container(
                  width: 44.w,
                  height: 4.h,
                  decoration: BoxDecoration(
                    color: colors.border.main,
                    borderRadius: BorderRadius.circular(4.r),
                  ),
                ),
                Gap(24.h),
                Text(
                  'Seen in Exam',
                  style: texts.body.semiBold().copyWith(
                        color: colors.text.primary,
                        height: 1.0,
                      ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SizedBox(
              height: 0.75,
              child: ColoredBox(color: colors.border.main),
            ),
          ),
        ],
      ),
    );
  }
}

/// Intro line + horizontal flag/date-picker/Confirm row.
/// Mirrors Figma nodes 3263:49758–3263:49763.
class _IntroAndForm extends StatelessWidget {
  const _IntroAndForm({
    required this.questionId,
    required this.colors,
    required this.texts,
  });

  final String questionId;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ExamReportsCubit, ExamReportsState>(
      buildWhen: (p, c) =>
          c.selectedDate != p.selectedDate ||
          c.isSubmitting != p.isSubmitting ||
          c.userHasReported != p.userHasReported,
      builder: (context, state) {
        final cubit = context.read<ExamReportsCubit>();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Have you seen this question in your official exam? '
              'Please let us know where and when.',
              style: texts.body.copyWith(color: colors.text.primary),
            ),
            Gap(16.h),
            Row(
              children: [
                // The country is resolved server-side from the user's
                // profile (matches Angular). Globe glyph is a neutral
                // placeholder until submission echoes the country back.
                Text('🌍', style: TextStyle(fontSize: 22.sp)),
                Gap(16.w),
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: state.userHasReported || state.isSubmitting
                        ? null
                        : () {
                            final theme = PilotColorTheme.of(context);
                            showModalBottomSheet<void>(
                              context: context,
                              isScrollControlled: true,
                              backgroundColor: Colors.transparent,
                              builder: (_) => PilotColorThemeProvider(
                                theme: theme,
                                child: PilotSingleDatePickerSheet(
                                  initialDate:
                                      state.selectedDate ?? DateTime.now(),
                                  firstDate: DateTime(2010),
                                  lastDate: DateTime.now(),
                                  onDateSelected: cubit.selectDate,
                                ),
                              ),
                            );
                          },
                    child: Container(
                      height: 40.h,
                      padding: EdgeInsets.symmetric(horizontal: 12.w),
                      decoration: BoxDecoration(
                        color: colors.bg.container,
                        border: Border.all(color: colors.border.main),
                        borderRadius: BorderRadius.circular(6.r),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              state.selectedDate != null
                                  ? _formatDate(state.selectedDate!)
                                  : 'Select date',
                              style: texts.bodyLarge.copyWith(
                                color: state.selectedDate != null
                                    ? colors.text.primary
                                    : colors.text.disabled,
                              ),
                            ),
                          ),
                          Gap(4.w),
                          SvgPicture.asset(
                            PilotAssets.kStudyClockCircle,
                            width: 18.r,
                            height: 18.r,
                            colorFilter: ColorFilter.mode(
                              colors.text.secondary,
                              BlendMode.srcIn,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            Gap(16.h),
            Align(
              alignment: Alignment.centerRight,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: state.canSubmit
                    ? () => cubit.submitReport(questionId)
                    : null,
                child: Container(
                  height: 40.h,
                  padding: EdgeInsets.symmetric(horizontal: 24.w),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: state.canSubmit
                        ? colors.primary.main
                        : colors.primary.main.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(24.r),
                  ),
                  child: state.isSubmitting
                      ? SizedBox(
                          width: 18.r,
                          height: 18.r,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: colors.text.lightSolid,
                          ),
                        )
                      : Text(
                          state.userHasReported ? 'Submitted' : 'Confirm',
                          style: texts.bodyLarge
                              .copyWith(color: colors.text.lightSolid),
                        ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// "All Users" container — rounded #303030/handleBg card containing
/// per-country expandable rows. Mirrors Figma node 3263:49767.
class _AllUsersList extends StatelessWidget {
  const _AllUsersList({required this.colors, required this.texts});

  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ExamReportsCubit, ExamReportsState>(
      buildWhen: (p, c) =>
          c.reports != p.reports ||
          c.loadState != p.loadState ||
          c.expandedCountryCodes != p.expandedCountryCodes,
      builder: (context, state) {
        if (state.loadState.isLoading) {
          return const AllUsersListSkeleton();
        }
        if (state.reports.isEmpty) {
          return Container(
            decoration: BoxDecoration(
              color: colors.fill.handleBg,
              border: Border.all(color: colors.border.main, width: 0.8),
              borderRadius: BorderRadius.circular(20.r),
            ),
            padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
            child: Text(
              'No reports yet for this question.',
              style: texts.body.copyWith(color: colors.text.secondary),
            ),
          );
        }

        final cubit = context.read<ExamReportsCubit>();
        return Container(
          decoration: BoxDecoration(
            color: colors.fill.handleBg,
            border: Border.all(color: colors.border.main, width: 0.8),
            borderRadius: BorderRadius.circular(20.r),
          ),
          padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
          child: Column(
            children: [
              for (int i = 0; i < state.reports.length; i++) ...[
                if (i > 0) ...[
                  Gap(12.h),
                  Container(height: 1, color: colors.border.main),
                  Gap(12.h),
                ],
                Builder(builder: (_) {
                  // Country code may come back empty from the API, so
                  // every empty-code row would collide and toggle the
                  // same key. Fall back to country name so each row
                  // gets a unique stable key.
                  final key =
                      state.reports[i].countryCode.isNotEmpty
                          ? state.reports[i].countryCode
                          : state.reports[i].countryName;
                  return _CountryReportRow(
                    report: state.reports[i],
                    isExpanded:
                        state.expandedCountryCodes.contains(key),
                    onTap: () => cubit.toggleCountryExpand(key),
                    colors: colors,
                    texts: texts,
                  );
                }),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// Single country row — flag + name + count + chevron, with optional
/// expanded list of exam dates. Mirrors Figma 3327:89802 + 3263:49780.
class _CountryReportRow extends StatelessWidget {
  const _CountryReportRow({
    required this.report,
    required this.isExpanded,
    required this.onTap,
    required this.colors,
    required this.texts,
  });

  final RealExamReportEntity report;
  final bool isExpanded;
  final VoidCallback onTap;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Row(
            children: [
              Text(
                _flagEmoji(report.countryCode),
                style: TextStyle(fontSize: 22.sp),
              ),
              Gap(12.w),
              Expanded(
                child: Text(
                  report.countryName,
                  style: texts.body
                      .semiBold()
                      .copyWith(color: colors.text.primary),
                ),
              ),
              SizedBox(
                width: 40.w,
                child: Text(
                  '${report.totalReports}',
                  textAlign: TextAlign.right,
                  style: texts.bodyLarge
                      .copyWith(color: colors.text.primary),
                ),
              ),
              Gap(16.w),
              Container(
                width: 32.r,
                height: 32.r,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.fill.handleBg,
                  border: Border.all(color: colors.border.main),
                  borderRadius: BorderRadius.circular(24.r),
                ),
                child: AnimatedRotation(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  turns: isExpanded ? 0.25 : 0,
                  child: SvgPicture.asset(
                    PilotAssets.kStudyCaretRight,
                    width: 14.r,
                    height: 14.r,
                    colorFilter: ColorFilter.mode(
                      colors.text.primary,
                      BlendMode.srcIn,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          alignment: Alignment.topCenter,
          child: !isExpanded
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: EdgeInsets.only(top: 12.h, left: 32.w),
                  child: Wrap(
                    spacing: 8.w,
                    runSpacing: 8.h,
                    children: [
                      for (final date in report.examDates)
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: 10.w,
                            vertical: 6.h,
                          ),
                          decoration: BoxDecoration(
                            color: colors.fill.alterSolid,
                            border:
                                Border.all(color: colors.border.main),
                            borderRadius: BorderRadius.circular(20.r),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SvgPicture.asset(
                                PilotAssets.kStudyClockCircle,
                                width: 14.r,
                                height: 14.r,
                                colorFilter: ColorFilter.mode(
                                  colors.text.secondary,
                                  BlendMode.srcIn,
                                ),
                              ),
                              Gap(6.w),
                              Text(
                                _formatDate(date),
                                style: texts.bodySmall.copyWith(
                                  color: colors.text.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}

/// Renders a country code (ISO-3166 2-letter) as a regional-indicator
/// emoji flag — same approach used by `CountryRow`.
String _flagEmoji(String countryCode) {
  if (countryCode.length != 2) return '🌍';
  const base = 0x1F1E6;
  final first = countryCode.codeUnitAt(0) - 0x41;
  final second = countryCode.codeUnitAt(1) - 0x41;
  return String.fromCharCode(base + first) +
      String.fromCharCode(base + second);
}

String _formatDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}
