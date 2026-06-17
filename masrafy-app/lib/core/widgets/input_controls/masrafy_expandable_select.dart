import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// One selectable option for [MasrafyExpandableSelect]. [value] is a stable,
/// language-neutral identifier; [label] is the already-localized display text.
class MasrafySelectOption<T> {
  const MasrafySelectOption({required this.value, required this.label});

  final T value;
  final String label;
}

/// Single-select dropdown matching the Masrafy questionnaire Figma
/// (`4024:2197`+): an uppercase question label, a tappable field showing the
/// current value (or hint) with a chevron, and — when expanded — the option
/// list **floating over** the content in a root [OverlayEntry] anchored to the
/// field (via [LayerLink]) rather than expanding inline. Floating leaves the
/// widgets below untouched (no layout push). The selected row is tinted azure
/// (`secondary`), mirroring the home loan-card selected state.
///
/// Expand/collapse is **caller-owned** ([expanded] + [onToggle]) so the parent
/// (a cubit holding `openField`) can guarantee only one accordion is open at a
/// time. Long lists (e.g. governorates) pass [maxListHeight] to cap the
/// floating list height and scroll internally.
///
/// Tokens only — no raw hex (Principle VIII / A18); logical insets only (A19).
/// Promoted to `core/widgets/input_controls/` per Principle XXXIII.
class MasrafyExpandableSelect<T> extends StatefulWidget {
  const MasrafyExpandableSelect({
    super.key,
    required this.label,
    required this.options,
    required this.value,
    required this.expanded,
    required this.onToggle,
    required this.onSelected,
    this.hint,
    this.isEnabled = true,
    this.maxListHeight,
  });

  /// Uppercased question prompt shown above the field.
  final String label;
  final List<MasrafySelectOption<T>> options;
  final T? value;
  final bool expanded;
  final VoidCallback onToggle;
  final ValueChanged<T> onSelected;
  final String? hint;
  final bool isEnabled;

  /// When set, the floating option list is capped to this height and scrolls.
  final double? maxListHeight;

  @override
  State<MasrafyExpandableSelect<T>> createState() =>
      _MasrafyExpandableSelectState<T>();
}

class _MasrafyExpandableSelectState<T>
    extends State<MasrafyExpandableSelect<T>>
    with SingleTickerProviderStateMixin {
  final LayerLink _link = LayerLink();
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
  );
  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeInOut,
  );
  OverlayEntry? _entry;

  @override
  void initState() {
    super.initState();
    if (widget.expanded) _show();
  }

  @override
  void didUpdateWidget(covariant MasrafyExpandableSelect<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.expanded && !oldWidget.expanded) {
      _show();
    } else if (!widget.expanded && oldWidget.expanded) {
      _hide();
    }
  }

  @override
  void dispose() {
    _entry?.remove();
    _entry = null;
    _controller.dispose();
    super.dispose();
  }

  void _show() {
    if (_entry != null) return;
    final entry = OverlayEntry(builder: _buildOverlay);
    _entry = entry;
    // Defer the Overlay mutation: _show fires from didUpdateWidget while the
    // BlocBuilder subtree is rebuilding, and inserting mid-build throws
    // "setState()/markNeedsBuild() called during build" on the Overlay.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _entry != entry || entry.mounted) return;
      Overlay.of(context, rootOverlay: true).insert(entry);
      _controller.forward(from: 0);
    });
  }

  Future<void> _hide() async {
    final entry = _entry;
    if (entry == null) return;
    await _controller.reverse();
    // Guard against a re-open or dispose racing the reverse animation.
    if (_entry != entry) return;
    entry.remove();
    _entry = null;
  }

  String? get _selectedLabel {
    for (final option in widget.options) {
      if (option.value == widget.value) return option.label;
    }
    return null;
  }

  double get _fieldWidth {
    final box = context.findRenderObject();
    return box is RenderBox && box.hasSize ? box.size.width : 0;
  }

  Widget _buildOverlay(BuildContext _) {
    return Stack(
      children: [
        // Transparent tap-to-dismiss barrier (no dimming scrim — this is a
        // dropdown, not a modal; A34 does not apply). Tapping outside calls
        // onToggle, which the cubit turns into openField: null → close.
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onToggle,
            child: const SizedBox.expand(),
          ),
        ),
        CompositedTransformFollower(
          link: _link,
          showWhenUnlinked: false,
          targetAnchor: Alignment.bottomLeft,
          followerAnchor: Alignment.topLeft,
          offset: Offset(0, 8.h),
          child: SizedBox(
            width: _fieldWidth,
            // Material ancestor so Text inherits a real DefaultTextStyle —
            // without it, overlay text renders with Flutter's yellow
            // debug-underline fallback.
            child: Material(
              type: MaterialType.transparency,
              child: FadeTransition(
                opacity: _curve,
                child: SizeTransition(
                  sizeFactor: _curve,
                  axisAlignment: -1,
                  child: _OptionList<T>(
                    options: widget.options,
                    value: widget.value,
                    onSelected: widget.onSelected,
                    maxListHeight: widget.maxListHeight,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final selectedLabel = _selectedLabel;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label.toUpperCase(),
          style: text.caption.semiBold().copyWith(
                color: colors.text.secondary,
                letterSpacing: 0.5,
              ),
        ),
        Gap(8.h),
        // Field header — anchor for the floating option list.
        CompositedTransformTarget(
          link: _link,
          child: GestureDetector(
            onTap: widget.isEnabled ? widget.onToggle : null,
            behavior: HitTestBehavior.opaque,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 44.h,
              padding: EdgeInsetsDirectional.symmetric(horizontal: 14.w),
              decoration: BoxDecoration(
                color:
                    widget.isEnabled ? colors.bg.container : colors.fill.quaternary,
                border: Border.all(
                  color: widget.expanded
                      ? colors.secondary.main
                      : colors.border.main,
                ),
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      selectedLabel ?? widget.hint ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.body.copyWith(
                        color: selectedLabel != null
                            ? colors.text.heading
                            : colors.text.placeholder,
                      ),
                    ),
                  ),
                  Gap(8.w),
                  AnimatedRotation(
                    duration: const Duration(milliseconds: 200),
                    turns: widget.expanded ? 0.5 : 0,
                    child: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 22.r,
                      color: widget.expanded
                          ? colors.secondary.main
                          : colors.icon.main,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _OptionList<T> extends StatelessWidget {
  const _OptionList({
    required this.options,
    required this.value,
    required this.onSelected,
    required this.maxListHeight,
  });

  final List<MasrafySelectOption<T>> options;
  final T? value;
  final ValueChanged<T> onSelected;
  final double? maxListHeight;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    final list = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (int i = 0; i < options.length; i++)
          _OptionRow<T>(
            option: options[i],
            selected: options[i].value == value,
            showDivider: i != options.length - 1,
            onTap: () => onSelected(options[i].value),
          ),
      ],
    );

    // Shadow on the outer container so the list reads as floating above the
    // page; ClipRRect inside clips the rows to the rounded corners. Shadow
    // alpha mirrors the MasrafyToast precedent (no shadow token in the theme).
    return Container(
      decoration: BoxDecoration(
        color: colors.bg.container,
        border: Border.all(color: colors.border.main),
        borderRadius: BorderRadius.circular(12.r),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 16.r,
            offset: Offset(0, 4.h),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12.r),
        child: maxListHeight == null
            ? list
            : ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxListHeight!),
                child: SingleChildScrollView(child: list),
              ),
      ),
    );
  }
}

class _OptionRow<T> extends StatelessWidget {
  const _OptionRow({
    required this.option,
    required this.selected,
    required this.showDivider,
    required this.onTap,
  });

  final MasrafySelectOption<T> option;
  final bool selected;
  final bool showDivider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        color: selected ? colors.secondary.bg : Colors.transparent,
        padding: EdgeInsetsDirectional.symmetric(horizontal: 14.w, vertical: 13.h),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    option.label,
                    style: text.body.copyWith(
                      color:
                          selected ? colors.secondary.main : colors.text.primary,
                    ),
                  ),
                ),
                if (selected)
                  Icon(
                    Icons.check_rounded,
                    size: 18.r,
                    color: colors.secondary.main,
                  ),
              ],
            ),
            if (showDivider) ...[
              Gap(13.h),
              Container(height: 1, color: colors.border.split),
            ],
          ],
        ),
      ),
    );
  }
}
