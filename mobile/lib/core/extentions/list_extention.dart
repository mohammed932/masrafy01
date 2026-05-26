extension NullableListExtention<T> on List<T>? {
  bool get isNullOrEmpty => this == null || this!.isEmpty;
  bool get isNotNullOrEmpty => !isNullOrEmpty;
  List<T> get orEmpty => this ?? const [];
}
