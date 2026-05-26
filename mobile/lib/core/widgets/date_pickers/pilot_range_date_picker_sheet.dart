import 'package:flutter/material.dart';
import 'package:app/core/widgets/date_pickers/pilot_date_picker_base.dart';

/// Bottom-sheet date-range picker.
///
/// Two-step selection: tap once to set the start, tap again to set the end.
/// The **Save** button stays disabled until both endpoints are chosen.
class PilotRangeDatePickerSheet extends StatefulWidget {
  const PilotRangeDatePickerSheet({
    super.key,
    required this.onRangeSaved,
    this.initialStart,
    this.initialEnd,
    this.minDate,
    this.maxDate,
  });

  final void Function(DateTime start, DateTime end) onRangeSaved;
  final DateTime? initialStart;
  final DateTime? initialEnd;
  final DateTime? minDate;
  final DateTime? maxDate;

  @override
  State<PilotRangeDatePickerSheet> createState() =>
      _PilotRangeDatePickerSheetState();
}

class _PilotRangeDatePickerSheetState
    extends PilotDatePickerBase<PilotRangeDatePickerSheet> {
  DateTime? _rangeStart;
  DateTime? _rangeEnd;

  @override
  void initState() {
    _rangeStart = widget.initialStart;
    _rangeEnd = widget.initialEnd;
    super.initState();
  }

  @override
  DateTime initialDisplayedMonth() => _rangeStart ?? DateTime.now();

  @override
  bool get showDayOfWeekHeaders => true;

  @override
  VoidCallback? onSavePressed(BuildContext context) {
    if (_rangeStart == null || _rangeEnd == null) return null;
    return () {
      widget.onRangeSaved(_rangeStart!, _rangeEnd!);
      Navigator.of(context).pop();
    };
  }

  void _handleDayTap(DateTime tappedDay) {
    final normalized = DateUtils.dateOnly(tappedDay);
    setState(() {
      if (_rangeStart == null || _rangeEnd != null) {
        _rangeStart = normalized;
        _rangeEnd = null;
      } else if (!tappedDay.isAfter(_rangeStart!)) {
        _rangeStart = normalized;
      } else {
        _rangeEnd = normalized;
      }
    });
  }

  @override
  Widget buildPickerBody(BuildContext context) {
    return PilotCalendarGrid(
      displayedMonth: displayedMonth,
      rangeStart: _rangeStart,
      rangeEnd: _rangeEnd,
      minDate: widget.minDate,
      maxDate: widget.maxDate,
      onDayTap: _handleDayTap,
    );
  }
}
