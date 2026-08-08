/// Parses a wire `birthday`-style value as a pure calendar date.
///
/// The backend sends it either as `yyyy-MM-dd` or as UTC midnight
/// (`yyyy-MM-ddT00:00:00.000Z`) — both encode the same calendar day. Only the
/// `yyyy-MM-dd` prefix is used, producing a naive (local, no-TZ) `DateTime`, so
/// display (`DateFormat`) and the `yyyy-MM-dd` re-serialization on save agree
/// and round-trip exactly. `DateTime.tryParse` alone yields a UTC-flagged value
/// that renders one day off on negative-offset devices → spurious
/// `PROFILE_FIELD_IMMUTABLE` on a save the customer never edited.
DateTime? parseCalendarDate(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final datePart = iso.split('T').first;
  final parts = datePart.split('-');
  if (parts.length != 3) return DateTime.tryParse(iso);
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return DateTime.tryParse(iso);
  return DateTime(y, m, d);
}
