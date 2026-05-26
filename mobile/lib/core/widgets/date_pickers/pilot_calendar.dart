import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/widgets/date_pickers/pilot_date_picker_base.dart';

/// Inline (non-sheet) calendar widget. Pixel-perfect match to Figma node
/// 3173-66113. Shares [PilotMonthNavRow], [PilotDayOfWeekHeaders], and
/// [PilotCalendarGrid] with the sheet-based pickers.
///
/// Calls [onDateSelected] immediately on each tap — no Save button.
class PilotCalendar extends StatefulWidget {
  const PilotCalendar({
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
  State<PilotCalendar> createState() => _PilotCalendarState();
}

class _PilotCalendarState extends State<PilotCalendar> {
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
        PilotMonthNavRow(
          displayedMonth: _displayedMonth,
          onMonthChanged: _changeMonth,
        ),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 18.w, vertical: 8.h),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const PilotDayOfWeekHeaders(),
              Gap(4.h),
              PilotCalendarGrid(
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
