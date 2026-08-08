import 'package:flutter/material.dart';

/// State-preserving tab body host with a fade-through switch.
///
/// Every tab stays mounted, so a tab comes back exactly as it was left (scroll
/// offset, cubit state, text fields) — the native tab-bar contract. Only the
/// active tab paints: the outgoing tab holds at full opacity underneath while
/// the incoming one fades in on top, so the swap reads as one continuous
/// surface instead of a page transition. Hidden tabs are pointer-inert,
/// semantics-excluded, and their tickers are paused.
///
/// Every tab keeps the SAME wrapper chain (`KeyedSubtree` → `Opacity` →
/// `ExcludeSemantics` → `IgnorePointer` → `TickerMode`) in every phase: swapping
/// a wrapper's type would remount the subtree underneath it and throw away the
/// state this widget exists to preserve.
class MainShellTabStack extends StatefulWidget {
  const MainShellTabStack({
    super.key,
    required this.index,
    required this.children,
    this.duration = const Duration(milliseconds: 220),
  });

  final int index;
  final List<Widget> children;
  final Duration duration;

  @override
  State<MainShellTabStack> createState() => _MainShellTabStackState();
}

class _MainShellTabStackState extends State<MainShellTabStack>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
    value: 1,
  )..addStatusListener((status) {
      // Drop the outgoing tab from the paint list once the fade lands.
      if (status == AnimationStatus.completed && _outgoing != null) {
        setState(() => _outgoing = null);
      }
    });

  late final Animation<double> _fade =
      CurvedAnimation(parent: _controller, curve: Curves.easeOut);

  int? _outgoing;

  @override
  void didUpdateWidget(covariant MainShellTabStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.index != widget.index) {
      _outgoing = oldWidget.index;
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Paint order: hidden tabs, then the outgoing one, then the active one on
  /// top. [KeyedSubtree] keeps each tab's element (and state) bound to its own
  /// slot across that reordering.
  List<int> _paintOrder() => [
        for (var i = 0; i < widget.children.length; i++)
          if (i != widget.index && i != _outgoing) i,
        if (_outgoing != null && _outgoing != widget.index) _outgoing!,
        widget.index,
      ];

  /// 1 for the active tab (ramping up mid-switch) and for the outgoing tab it
  /// covers; 0 otherwise — `Opacity(0)` lays out but never paints, so a hidden
  /// tab costs nothing while it waits.
  double _opacityFor(int i) {
    if (i == widget.index) return _fade.value;
    if (i == _outgoing) return 1;
    return 0;
  }

  Widget _tab(int i) {
    final isActive = i == widget.index;
    return KeyedSubtree(
      key: ValueKey(i),
      child: Opacity(
        opacity: _opacityFor(i),
        child: ExcludeSemantics(
          excluding: !isActive,
          child: IgnorePointer(
            ignoring: !isActive,
            child: TickerMode(enabled: isActive, child: widget.children[i]),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _fade,
      builder: (context, _) => Stack(
        fit: StackFit.expand,
        children: [for (final i in _paintOrder()) _tab(i)],
      ),
    );
  }
}
