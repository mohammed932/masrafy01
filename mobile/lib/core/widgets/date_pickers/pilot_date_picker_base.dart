import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/widgets/bottom_sheets/pilot_bottom_sheet_base.dart';
import 'package:app/core/widgets/buttons/pilot_primary_button.dart';
import 'package:app/core/widgets/buttons/pilot_secondary_button.dart';

/// Abstract base for every Masrafy date-picker sheet's `State` class.
///
/// Subclasses implement four hooks:
///   • [initialDisplayedMonth] — what month to open on.
///   • [buildPickerBody] — the calendar widget(s) below the day-of-week headers.
///   • [onSavePressed] — return `null` to keep Save disabled.
///   • [buildCalendarFooter] — optional widget rendered between the grid and
///     the Cancel/Save actions (e.g. a "Today" link row).
///
/// The [showDayOfWeekHeaders] getter controls whether [PilotDayOfWeekHeaders]
/// is inserted above the picker body.
abstract class PilotDatePickerBase<W extends StatefulWidget> extends State<W> {
  late DateTime _displayedMonth;

  DateTime get displayedMonth => _displayedMonth;

  @protected
  void setDisplayedMonth(DateTime month) {
    if (!mounted) return;
    final next = DateTime(month.year, month.month);
    if (next == _displayedMonth) return;
    setState(() => _displayedMonth = next);
  }

  // ── Hooks ─────────────────────────────────────────────────────────────

  DateTime initialDisplayedMonth();
  Widget buildPickerBody(BuildContext context);
  VoidCallback? onSavePressed(BuildContext context);

  bool get showDayOfWeekHeaders => false;
  String get cancelLabel => 'Cancel';
  String get saveLabel => 'Save';

  /// Optional footer rendered between the calendar grid and the Cancel/Save
  /// actions — e.g. a "Today" link row with a top border.
  Widget? buildCalendarFooter(BuildContext context) => null;

  // ── Lifecycle ─────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    final initial = initialDisplayedMonth();
    _displayedMonth = DateTime(initial.year, initial.month);
  }

  @override
  Widget build(BuildContext context) {
    final calendarFooter = buildCalendarFooter(context);
    return PilotDatePickerScaffold(
      actions: PilotDatePickerActions(
        cancelLabel: cancelLabel,
        saveLabel: saveLabel,
        onCancel: () => Navigator.of(context).pop(),
        onSave: onSavePressed(context),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          PilotMonthNavRow(
            displayedMonth: _displayedMonth,
            onMonthChanged: setDisplayedMonth,
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 18.w, vertical: 8.h),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (showDayOfWeekHeaders) ...[
                  const PilotDayOfWeekHeaders(),
                  Gap(4.h),
                ],
                buildPickerBody(context),
              ],
            ),
          ),
          if (calendarFooter != null) calendarFooter,
        ],
      ),
    );
  }
}

// ── Scaffold ──────────────────────────────────────────────────────────────────

class PilotDatePickerScaffold extends StatelessWidget {
  const PilotDatePickerScaffold({
    super.key,
    required this.content,
    required this.actions,
  });

  final Widget content;
  final Widget actions;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return PilotBottomSheetShell(
      topRadius: 20,
      dragHandleColor: colors.fill.secondary,
      contentPadding: EdgeInsets.symmetric(horizontal: 16.w),
      footer: Padding(
        padding: EdgeInsets.fromLTRB(16.w, 8.h, 16.w, 16.h),
        child: actions,
      ),
      content: content,
    );
  }
}

// ── Month nav row ─────────────────────────────────────────────────────────────

/// Header row with 4 navigation buttons: prev-year (<<), prev-month (<),
/// next-month (>), next-year (>>), and the centred month+year label.
/// Matches Figma node 3173-66117 exactly.
class PilotMonthNavRow extends StatelessWidget {
  const PilotMonthNavRow({
    super.key,
    required this.displayedMonth,
    required this.onMonthChanged,
  });

  final DateTime displayedMonth;
  final ValueChanged<DateTime> onMonthChanged;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final iconTint = ColorFilter.mode(colors.text.secondary, BlendMode.srcIn);
    final y = displayedMonth.year;
    final m = displayedMonth.month;

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: colors.border.split, width: 1),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 9.h),
        child: Row(
          children: [
            // << < (prev year, prev month)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _NavButton(
                  asset: PilotAssets.kCalNavDoubleLeft,
                  width: 10.r,
                  height: 11.r,
                  colorFilter: iconTint,
                  onTap: () => onMonthChanged(DateTime(y - 1, m)),
                ),
                _NavButton(
                  asset: PilotAssets.kCalNavLeft,
                  width: 7.r,
                  height: 12.r,
                  colorFilter: iconTint,
                  onTap: () => onMonthChanged(DateTime(y, m - 1)),
                ),
              ],
            ),
            // Month + year label
            Expanded(
              child: Text(
                '${pilotMonthName(m)} $y',
                textAlign: TextAlign.center,
                style: texts.bodySmall
                    .semiBold()
                    .copyWith(color: colors.text.primary),
              ),
            ),
            // > >> (next month, next year)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _NavButton(
                  asset: PilotAssets.kCalNavRight,
                  width: 7.r,
                  height: 12.r,
                  colorFilter: iconTint,
                  onTap: () => onMonthChanged(DateTime(y, m + 1)),
                ),
                _NavButton(
                  asset: PilotAssets.kCalNavDoubleRight,
                  width: 10.r,
                  height: 11.r,
                  colorFilter: iconTint,
                  onTap: () => onMonthChanged(DateTime(y + 1, m)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.asset,
    required this.width,
    required this.height,
    required this.colorFilter,
    required this.onTap,
  });

  final String asset;
  final double width;
  final double height;
  final ColorFilter colorFilter;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: EdgeInsets.all(10.r),
        child: SvgPicture.asset(
          asset,
          width: width,
          height: height,
          colorFilter: colorFilter,
        ),
      ),
    );
  }
}

// ── Day-of-week header row ────────────────────────────────────────────────────

/// Su Mo Tu We Th Fr Sa header row — Sunday-first, matches Figma.
class PilotDayOfWeekHeaders extends StatelessWidget {
  const PilotDayOfWeekHeaders({super.key});

  @override
  Widget build(BuildContext context) {
    final texts = PilotTextTheme.of(context);
    final colors = PilotColorTheme.of(context);
    return Row(
      children: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
          .map(
            (label) => Expanded(
              child: Center(
                child: Text(
                  label,
                  style: texts.bodySmall.copyWith(color: colors.text.secondary),
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

// ── Shared calendar grid ──────────────────────────────────────────────────────

/// 6-row × 7-column calendar grid. Shared by single-date picker, range picker,
/// and the standalone [PilotCalendar] widget.
///
/// Always renders 42 cells: out-of-month days from the previous and next month
/// are shown greyed and are not tappable.
///
/// Supports three selection modes (set only the relevant fields):
///   - Single date: set [selectedDate].
///   - Range: set [rangeStart] and/or [rangeEnd].
class PilotCalendarGrid extends StatelessWidget {
  const PilotCalendarGrid({
    super.key,
    required this.displayedMonth,
    required this.onDayTap,
    this.selectedDate,
    this.rangeStart,
    this.rangeEnd,
    this.minDate,
    this.maxDate,
    this.disabledDates = const {},
  });

  final DateTime displayedMonth;
  final ValueChanged<DateTime> onDayTap;
  final DateTime? selectedDate;
  final DateTime? rangeStart;
  final DateTime? rangeEnd;
  final DateTime? minDate;
  final DateTime? maxDate;
  final Set<DateTime> disabledDates;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    final firstOfMonth = DateTime(displayedMonth.year, displayedMonth.month);
    // Sunday-first column index: Mon=1%7=1 … Sat=6%7=6, Sun=7%7=0
    final leadingCells = firstOfMonth.weekday % 7;
    final daysInMonth =
        DateUtils.getDaysInMonth(displayedMonth.year, displayedMonth.month);
    const totalCells = 42;
    final trailingCells = totalCells - leadingCells - daysInMonth;

    // Build ordered list of (date, isCurrentMonth)
    final cells = <({DateTime date, bool isCurrentMonth})>[];

    // Leading: last N days from the previous month
    final firstLeadingDate =
        firstOfMonth.subtract(Duration(days: leadingCells));
    for (int i = 0; i < leadingCells; i++) {
      cells.add((
        date: firstLeadingDate.add(Duration(days: i)),
        isCurrentMonth: false,
      ));
    }
    // Current month
    for (int d = 1; d <= daysInMonth; d++) {
      cells.add((
        date: DateTime(displayedMonth.year, displayedMonth.month, d),
        isCurrentMonth: true,
      ));
    }
    // Trailing: days from next month
    final nextMonthStart =
        DateTime(displayedMonth.year, displayedMonth.month + 1);
    for (int i = 0; i < trailingCells; i++) {
      cells.add((
        date: nextMonthStart.add(Duration(days: i)),
        isCurrentMonth: false,
      ));
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (int row = 0; row < 6; row++)
          Row(
            children: [
              for (int col = 0; col < 7; col++)
                _CalendarDayCell(
                  date: cells[row * 7 + col].date,
                  isCurrentMonth: cells[row * 7 + col].isCurrentMonth,
                  selectedDate: selectedDate,
                  rangeStart: rangeStart,
                  rangeEnd: rangeEnd,
                  minDate: minDate,
                  maxDate: maxDate,
                  disabledDates: disabledDates,
                  onTap: onDayTap,
                  colors: colors,
                  texts: texts,
                ),
            ],
          ),
      ],
    );
  }
}

class _CalendarDayCell extends StatelessWidget {
  const _CalendarDayCell({
    required this.date,
    required this.isCurrentMonth,
    required this.selectedDate,
    required this.rangeStart,
    required this.rangeEnd,
    required this.minDate,
    required this.maxDate,
    required this.disabledDates,
    required this.onTap,
    required this.colors,
    required this.texts,
  });

  final DateTime date;
  final bool isCurrentMonth;
  final DateTime? selectedDate;
  final DateTime? rangeStart;
  final DateTime? rangeEnd;
  final DateTime? minDate;
  final DateTime? maxDate;
  final Set<DateTime> disabledDates;
  final ValueChanged<DateTime> onTap;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  bool get _isDisabled {
    if (!isCurrentMonth) return true;
    if (minDate != null && date.isBefore(minDate!)) return true;
    if (maxDate != null && date.isAfter(maxDate!)) return true;
    return disabledDates.contains(DateUtils.dateOnly(date));
  }

  bool get _isSelected =>
      selectedDate != null && DateUtils.isSameDay(date, selectedDate!);
  bool get _isRangeStart =>
      rangeStart != null && DateUtils.isSameDay(date, rangeStart!);
  bool get _isRangeEnd =>
      rangeEnd != null && DateUtils.isSameDay(date, rangeEnd!);
  bool get _isBetween =>
      rangeStart != null &&
      rangeEnd != null &&
      date.isAfter(rangeStart!) &&
      date.isBefore(rangeEnd!);
  bool get _isToday => DateUtils.isSameDay(date, DateTime.now());
  bool get _isHighlighted => _isSelected || _isRangeStart || _isRangeEnd;

  Color _bgColor() {
    if (_isHighlighted) return colors.primary.main;
    if (_isBetween) return colors.primary.bg;
    return Colors.transparent;
  }

  Color _textColor() {
    if (_isDisabled) return colors.text.disabled;
    if (_isHighlighted) return Colors.white;
    if (_isBetween || _isToday) return colors.primary.main;
    return colors.text.primary;
  }

  Border? _border() {
    if (_isToday && !_isHighlighted) {
      return Border.all(color: colors.primary.main, width: 1);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: _isDisabled ? null : () => onTap(date),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 4.r, vertical: 6.r),
          child: Center(
            child: Container(
              width: 36.r,
              height: 36.r,
              decoration: BoxDecoration(
                color: _bgColor(),
                border: _border(),
                borderRadius: BorderRadius.circular(8.r),
              ),
              child: Center(
                child: Text(
                  '${date.day}',
                  style: texts.body.copyWith(color: _textColor()),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Actions footer ────────────────────────────────────────────────────────────

class PilotDatePickerActions extends StatelessWidget {
  const PilotDatePickerActions({
    super.key,
    required this.onCancel,
    required this.onSave,
    this.cancelLabel = 'Cancel',
    this.saveLabel = 'Save',
  });

  final VoidCallback onCancel;
  final VoidCallback? onSave;
  final String cancelLabel;
  final String saveLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: PilotSecondaryButton(label: cancelLabel, onPressed: onCancel),
        ),
        Gap(12.w),
        Expanded(
          child: PilotPrimaryButton(label: saveLabel, onPressed: onSave),
        ),
      ],
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Returns the English month name for `1..12`.
String pilotMonthName(int month) {
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return names[month - 1];
}
