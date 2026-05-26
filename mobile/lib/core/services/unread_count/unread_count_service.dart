import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';
import 'package:app/features/notifications/domain/usecases/notifications_usecase.dart';

@lazySingleton
class UnreadCountService {
  final NotificationsUseCase _useCase;
  Timer? _timer;
  bool _started = false;

  /// Authoritative unread count exposed to listeners.
  /// Header bell + Notifications cubit both consume this.
  final ValueNotifier<int> count = ValueNotifier<int>(0);

  UnreadCountService(this._useCase);

  /// Idempotent: starts the 10-minute poll on first call. Safe to call from
  /// every screen that wants the count to be fresh.
  Future<void> startPolling() async {
    if (_started) return;
    _started = true;
    await fetchFromServer();
    _timer = Timer.periodic(
      const Duration(minutes: 10),
      (_) => fetchFromServer(),
    );
  }

  Future<void> fetchFromServer() async {
    final result = await _useCase.getUnreadCount();
    result.fold((_) {}, (n) => count.value = n);
  }

  void adjust(int delta) {
    final next = (count.value + delta).clamp(0, 1 << 30);
    count.value = next;
  }

  void set(int value) {
    count.value = value < 0 ? 0 : value;
  }

  /// Stop the poll, zero the count. Called on sign-out by the auth flow.
  void reset() {
    _timer?.cancel();
    _timer = null;
    _started = false;
    count.value = 0;
  }
}