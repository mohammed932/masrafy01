/// Coerces a dynamic JSON value into an `int`, handling:
/// - `int` / `double` → `toInt()`
/// - `String` numeric literals (e.g. `"100"`, `"42.5"`) → parsed
/// - `null` / non-numeric strings / anything else → [fallback]
///
/// The backend occasionally serializes numeric fields as quoted strings
/// (e.g. `"progress": "100"` on `subject/progress/:packageId`,
/// `"progressPercentage": "7.69"` on study-planner). The Angular frontend
/// coerces via `Number(x)`; Flutter needs an equivalent.
int coerceInt(dynamic value, {int fallback = 0}) {
  if (value is num) return value.toInt();
  if (value is String) {
    final parsed = num.tryParse(value);
    if (parsed != null) return parsed.toInt();
  }
  return fallback;
}

/// Same coercion as [coerceInt] but returns a `double`.
double coerceDouble(dynamic value, {double fallback = 0.0}) {
  if (value is num) return value.toDouble();
  if (value is String) {
    final parsed = num.tryParse(value);
    if (parsed != null) return parsed.toDouble();
  }
  return fallback;
}

/// Parses dates the backend may serve in mixed formats. The reports
/// `notes` / `comments` endpoints in particular ship dates as
/// `April 15, 2026` or `23 May, 2024` rather than ISO 8601.
///
/// `DateTime.tryParse` is gated by an ISO-shaped regex so debuggers
/// configured to break on all exceptions don't pause on the
/// `FormatException` that `parse` throws (and `tryParse` swallows)
/// for non-ISO inputs.
DateTime? parseFlexibleDate(String? raw) {
  if (raw == null) return null;
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  if (RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(trimmed)) {
    final iso = DateTime.tryParse(trimmed);
    if (iso != null) return iso;
  }
  final tokens = trimmed
      .replaceAll(RegExp(r'\s*,\s*'), ' ')
      .split(RegExp(r'\s+'));
  if (tokens.length != 3) return null;
  int? day;
  int? month;
  int? year;
  for (final token in tokens) {
    final monthFromName = _kMonthByName[token.toLowerCase()];
    if (monthFromName != null) {
      month = monthFromName;
      continue;
    }
    final n = int.tryParse(token);
    if (n == null) return null;
    if (n >= 1000) {
      year = n;
    } else if (day == null) {
      day = n;
    } else {
      year = n;
    }
  }
  if (day == null || month == null || year == null) return null;
  return DateTime(year, month, day);
}

const Map<String, int> _kMonthByName = {
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'sept': 9, 'september': 9,
  'oct': 10, 'october': 10,
  'nov': 11, 'november': 11,
  'dec': 12, 'december': 12,
};
