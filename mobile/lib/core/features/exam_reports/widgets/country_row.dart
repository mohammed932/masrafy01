part of 'exam_reports_widgets.imports.dart';

/// T140 — flag + country name + count badge + chevron.
/// Expanded state shows date list descending with calendar icons.
class CountryRow extends StatelessWidget {
  const CountryRow({
    super.key,
    required this.report,
    required this.isExpanded,
    required this.onTap,
  });

  final RealExamReportEntity report;
  final bool isExpanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return Column(
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8.r),
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 4.w),
            child: Row(
              children: [
                // CountryEntity flag emoji derived from country code
                Text(
                  _flagEmoji(report.countryCode),
                  style: TextStyle(fontSize: 20.sp),
                ),
                Gap(10.w),
                Expanded(
                  child: Text(
                    report.countryName,
                    style: texts.body.copyWith(color: colors.text.primary),
                  ),
                ),
                Container(
                  padding:
                      EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                  decoration: BoxDecoration(
                    color: colors.primary.bg,
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                  child: Text(
                    '${report.totalReports}',
                    style: texts.bodySmall
                        .semiBold()
                        .copyWith(color: colors.primary.text),
                  ),
                ),
                Gap(6.w),
                Icon(
                  isExpanded
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                  size: 18.r,
                  color: colors.text.secondary,
                ),
              ],
            ),
          ),
        ),
        if (isExpanded) ...[
          ...report.examDates.map(
            (date) => Padding(
              padding: EdgeInsets.only(left: 30.w, bottom: 6.h),
              child: Row(
                children: [
                  Icon(Icons.calendar_today_outlined,
                      size: 14.r, color: colors.text.secondary),
                  Gap(8.w),
                  Text(
                    _formatDate(date),
                    style: texts.bodySmall
                        .copyWith(color: colors.text.secondary),
                  ),
                ],
              ),
            ),
          ),
          Gap(4.h),
        ],
        Divider(height: 1, color: colors.border.main),
      ],
    );
  }

  String _flagEmoji(String countryCode) {
    if (countryCode.length != 2) return '🌍';
    const base = 0x1F1E6;
    final first = countryCode.codeUnitAt(0) - 0x41;
    final second = countryCode.codeUnitAt(1) - 0x41;
    return String.fromCharCode(base + first) + String.fromCharCode(base + second);
  }

  String _formatDate(DateTime date) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${date.day} ${months[date.month - 1]}, ${date.year}';
  }
}
