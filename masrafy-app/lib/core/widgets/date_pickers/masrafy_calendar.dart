import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/widgets/date_pickers/masrafy_date_picker_base.dart';

/// Inline (non-sheet) calendar widget. Pixel-perfect match to Figma node
/// 3173-66113. Shares [MasrafyMonthNavRow], [MasrafyDayOfWeekHeaders], and
/// [MasrafyCalendarGrid] with the sheet-based pickers.
///
/// Calls [onDateSelected] immediately on each tap — no Save button.
class MasrafyCalendar extends StatefulWidget {
  const MasrafyCalendar({
    super.key,
    required this.onDateSelected,
    this.initialDate,
    this.minDate,
    this.maxDate,
    this.disabledDates = const {},
  });

  final ValueChanged<DateTime> onDateSelected;
  final DateTime? initialDate;
  final DateTime? minDate;
  final DateTime? maxDate;
  final Set<DateTime> disabledDates;

  @override
  State<MasrafyCalendar> createState() => _MasrafyCalendarState();
}

class _MasrafyCalendarState extends State<MasrafyCalendar> {
  late DateTime _displayedMonth;
  late DateTime _selectedDate;

  @override
  void initState() {
    super.initState();
    final initial =
        DateUtils.dateOnly(widget.initialDate ?? DateTime.now());
    _selectedDate = initial;
    _displayedMonth = DateTime(initial.year, initial.month);
  }

  void _changeMonth(DateTime month) {
    setState(() => _displayedMonth = DateTime(month.year, month.month));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        MasrafyMonthNavRow(
          displayedMonth: _displayedMonth,
          onMonthChanged: _changeMonth,
        ),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 18.w, vertical: 8.h),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const MasrafyDayOfWeekHeaders(),
              Gap(4.h),
              MasrafyCalendarGrid(
                displayedMonth: _displayedMonth,
                selectedDate: _selectedDate,
                minDate: widget.minDate,
                maxDate: widget.maxDate,
                disabledDates: widget.disabledDates,
                onDayTap: (date) {
                  setState(() {
                    _selectedDate = date;
                    _displayedMonth = DateTime(date.year, date.month);
                  });
                  widget.onDateSelected(date);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
