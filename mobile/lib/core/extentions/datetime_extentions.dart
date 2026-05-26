import 'package:intl/intl.dart';

extension DateTimeExtentions on DateTime {
  /// Returns "Jun 18, 2025"-style string — used by AchievementUnlockedMarker.
  String get monDayYear => DateFormat('MMM d, yyyy').format(this);
}

String relativeTimeOf(DateTime moment, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final diff = reference.difference(moment);

  if (diff.inSeconds < 60) return 'Just now';
  if (diff.inMinutes < 60) {
    final m = diff.inMinutes;
    return m == 1 ? '1 minute ago' : '$m minutes ago';
  }
  if (diff.inHours < 24) {
    final h = diff.inHours;
    return h == 1 ? '1 hour ago' : '$h hours ago';
  }
  if (diff.inDays < 7) {
    final d = diff.inDays;
    return d == 1 ? '1 day ago' : '$d days ago';
  }
  return DateFormat('MMM d, yyyy').format(moment);
}

String dayLabelOf(DateTime moment, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final today = DateTime(reference.year, reference.month, reference.day);
  final target = DateTime(moment.year, moment.month, moment.day);
  final diff = today.difference(target).inDays;

  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  return DateFormat('MMM d, yyyy').format(moment);
}