import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/date_pickers/pilot_date_picker_base.dart';

/// Bottom-sheet single-date picker.
///
/// Uses the shared [PilotCalendarGrid] for pixel-perfect Figma parity.
/// A "Today" link is rendered below the grid with a top divider.
class PilotSingleDatePickerSheet extends StatefulWidget {
  const PilotSingleDatePickerSheet({
    super.key,
    required this.onDateSelected,
    this.initialDate,
    this.firstDate,
    this.lastDate,
    this.disabledDates = const {},
  });

  final ValueChanged<DateTime> onDateSelected;
  final DateTime? initialDate;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final Set<DateTime> disabledDates;

  @override
  State<PilotSingleDatePickerSheet> createState() =>
      _PilotSingleDatePickerSheetState();
}

class _PilotSingleDatePickerSheetState
    extends PilotDatePickerBase<PilotSingleDatePickerSheet> {
  late DateTime _current;

  @override
  void initState() {
    _current = DateUtils.dateOnly(widget.initialDate ?? DateTime.now());
    super.initState();
  }

  @override
  DateTime initialDisplayedMonth() => _current;

  @override
  bool get showDayOfWeekHeaders => true;

  @override
  VoidCallback? onSavePressed(BuildContext context) {
    return () {
      widget.onDateSelected(_current);
      Navigator.of(context).pop();
    };
  }

  @override
  Widget buildPickerBody(BuildContext context) {
    return PilotCalendarGrid(
      displayedMonth: displayedMonth,
      selectedDate: _current,
      minDate: widget.firstDate,
      maxDate: widget.lastDate,
      disabledDates: widget.disabledDates,
      onDayTap: (date) {
        setState(() => _current = date);
        setDisplayedMonth(date);
      },
    );
  }

  @override
  Widget? buildCalendarFooter(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: colors.border.split, width: 1),
        ),
      ),
      child: SizedBox(
        width: double.infinity,
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 9.h),
          child: GestureDetector(
            onTap: () {
              final today = DateUtils.dateOnly(DateTime.now());
              setState(() => _current = today);
              setDisplayedMonth(today);
            },
            child: Center(
              child: Text(
                'Today',
                style: texts.bodySmall.copyWith(color: colors.primary.main),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
