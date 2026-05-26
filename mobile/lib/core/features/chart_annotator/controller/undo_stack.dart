import '../model/annotation.dart';

/// Immutable-snapshot undo/redo for the annotation list.
///
/// Push only on **commit**, never during draft updates. Snapshots are
/// `List.unmodifiable`-wrapped so accidental mutation throws.
class UndoStack {
  UndoStack() : _history = [const []], _cursor = 0;

  static const int maxHistory = 50;

  final List<List<Annotation>> _history;
  int _cursor;

  /// Most recent committed snapshot.
  List<Annotation> get current => _history[_cursor];

  bool get canUndo => _cursor > 0;
  bool get canRedo => _cursor < _history.length - 1;

  /// Append [newState] as the new head. Any redo branch above the cursor is
  /// discarded. Drops oldest entry when exceeding [maxHistory].
  void push(List<Annotation> newState) {
    if (_cursor < _history.length - 1) {
      _history.removeRange(_cursor + 1, _history.length);
    }
    _history.add(List.unmodifiable(newState));
    _cursor = _history.length - 1;
    if (_history.length > maxHistory) {
      _history.removeAt(0);
      _cursor--;
    }
  }

  /// Steps the cursor back one slot and returns the snapshot. Returns `null`
  /// when [canUndo] is false.
  List<Annotation>? undo() {
    if (!canUndo) return null;
    _cursor--;
    return _history[_cursor];
  }

  /// Steps the cursor forward one slot and returns the snapshot. Returns
  /// `null` when [canRedo] is false.
  List<Annotation>? redo() {
    if (!canRedo) return null;
    _cursor++;
    return _history[_cursor];
  }

  /// Wipes history back to the empty baseline. Used on controller reset.
  void clear() {
    _history
      ..clear()
      ..add(const []);
    _cursor = 0;
  }
}
