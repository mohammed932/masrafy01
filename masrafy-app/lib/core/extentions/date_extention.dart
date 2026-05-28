import 'package:intl/intl.dart';

extension DateExtention on DateTime {
  String format([String pattern = 'yyyy-MM-dd']) =>
      DateFormat(pattern).format(this);

  /// Returns the date portion as `yyyy-MM-dd` for use in API query params.
  String get toApiDateString => format();
}
