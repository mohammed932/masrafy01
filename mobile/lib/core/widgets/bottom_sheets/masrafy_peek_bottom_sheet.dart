import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

/// Reusable peek-and-expand bottom sheet.
///
/// Renders as a [DraggableScrollableSheet] anchored to the parent's bottom.
/// Snaps between a `peek` size (default 10% of screen height) and a full size
/// (default 92%). Caller supplies separate builders for the peek and expanded
/// bodies — the sheet decides which to show based on the current snap.
///
/// Provide a fresh [MasrafyPeekSheetController] to programmatically toggle the
/// snap (used by the editor cubit when an answer is picked).
class MasrafyPeekBottomSheet extends StatefulWidget {
  const MasrafyPeekBottomSheet({
    super.key,
    required this.peekBuilder,
    required this.expandedBuilder,
    this.controller,
    this.minChildSize = 0.10,
    this.maxChildSize = 0.92,
  });

  final WidgetBuilder peekBuilder;
  final WidgetBuilder expandedBuilder;
  final MasrafyPeekSheetController? controller;
  final double minChildSize;
  final double maxChildSize;

  @override
  State<MasrafyPeekBottomSheet> createState() => _MasrafyPeekBottomSheetState();
}

class _MasrafyPeekBottomSheetState extends State<MasrafyPeekBottomSheet> {
  final DraggableScrollableController _scrollCtl =
      DraggableScrollableController();

  static const double _expandedThreshold = 0.40;

  bool _isExpanded = false;
  bool _autoExpanding = false;
  double? _lastSize;

  @override
  void initState() {
    super.initState();
    _scrollCtl.addListener(_onScrollChanged);
    widget.controller?._attach(_scrollCtl, this);
  }

  @override
  void dispose() {
    _scrollCtl.removeListener(_onScrollChanged);
    widget.controller?._detach();
    _scrollCtl.dispose();
    super.dispose();
  }

  void _onScrollChanged() {
    if (!_scrollCtl.isAttached) return;
    final size = _scrollCtl.size;
    final last = _lastSize;
    _lastSize = size;
    final increasing = last != null && size > last;

    // Sticky-expand: when the user starts dragging UP from the peek baseline
    // (collapsed state), force-animate to max so a slow upward drag doesn't
    // bounce back to peek. Skip when collapsing (size decreasing) or when
    // the sheet is already past the expanded threshold — otherwise the
    // downward swipe to dismiss would also get re-snapped to open.
    final liftThreshold = widget.minChildSize + 0.04;
    if (!_autoExpanding &&
        !_isExpanded &&
        increasing &&
        size > liftThreshold &&
        size < widget.maxChildSize - 0.01) {
      _autoExpanding = true;
      _scrollCtl
          .animateTo(
            widget.maxChildSize,
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
          )
          .whenComplete(() => _autoExpanding = false);
    }

    final nowExpanded = size > _expandedThreshold;
    if (nowExpanded != _isExpanded) {
      setState(() => _isExpanded = nowExpanded);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return DraggableScrollableSheet(
      controller: _scrollCtl,
      initialChildSize: widget.minChildSize,
      minChildSize: widget.minChildSize,
      maxChildSize: widget.maxChildSize,
      snap: true,
      snapSizes: [widget.minChildSize, widget.maxChildSize],
      builder: (ctx, scrollController) {
        return DecoratedBox(
          decoration: BoxDecoration(
            color: colors.bg.elevated,
            border: Border.all(color: colors.border.main),
            borderRadius: BorderRadius.vertical(top: Radius.circular(20.r)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.10),
                offset: const Offset(0, -2),
                blurRadius: 12,
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            child: ListView(
              controller: scrollController,
              padding: EdgeInsets.zero,
              children: [
                _DragHandle(color: colors.border.secondary),
                if (_isExpanded)
                  widget.expandedBuilder(ctx)
                else
                  widget.peekBuilder(ctx),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Programmatic snap toggle. Pass to [MasrafyPeekBottomSheet.controller] and
/// call [collapse] / [expand] from outside the sheet (e.g. after an answer
/// pick).
class MasrafyPeekSheetController {
  MasrafyPeekSheetController();

  DraggableScrollableController? _drag;
  // ignore: unused_field
  _MasrafyPeekBottomSheetState? _state;

  void _attach(DraggableScrollableController c, _MasrafyPeekBottomSheetState s) {
    _drag = c;
    _state = s;
  }

  void _detach() {
    _drag = null;
    _state = null;
  }

  Future<void> expand({double to = 0.92}) async {
    final c = _drag;
    if (c == null || !c.isAttached) return;
    await c.animateTo(
      to,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  Future<void> collapse({double to = 0.10}) async {
    final c = _drag;
    if (c == null || !c.isAttached) return;
    await c.animateTo(
      to,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }
}

class _DragHandle extends StatelessWidget {
  const _DragHandle({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: 8.h, bottom: 8.h),
      child: Center(
        child: Container(
          width: 44.w,
          height: 4.h,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2.r),
          ),
        ),
      ),
    );
  }
}
