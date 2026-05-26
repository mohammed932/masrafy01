import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

/// Stateful-friendly chrome wrapper for Masrafy bottom sheets.
///
/// Use this directly when your sheet is a `StatefulWidget` (its `State`
/// returns this from `build`). For purely declarative sheets, extend
/// [PilotBottomSheetBase] instead — it composes this shell from a small set
/// of hooks.
///
/// Owns: rounded top corners, [SafeArea], optional drag handle + title +
/// divider, content area clamped to [maxHeightFraction], optional pinned
/// footer.
class PilotBottomSheetShell extends StatelessWidget {
  const PilotBottomSheetShell({
    super.key,
    required this.content,
    this.title,
    this.header,
    this.footer,
    this.showDragHandle = true,
    this.dragHandleColor,
    this.showTitleDivider = true,
    this.topRadius = 24,
    this.maxHeightFraction = 0.85,
    this.contentPadding = EdgeInsets.zero,
    this.isContentScrollable = true,
  });

  /// Body of the sheet — rendered between the header (if any) and the
  /// footer (if any).
  final Widget content;

  /// Header text shown in the default header. Ignored when [header] is
  /// non-null.
  final String? title;

  /// Fully-custom header. When non-null, it replaces the default chrome
  /// (drag handle + title + divider) entirely. Set to `const SizedBox.shrink()`
  /// to suppress the header without supplying one.
  final Widget? header;

  /// Optional pinned footer (e.g. action button row). Rendered outside the
  /// scrollable area so it stays visible while content scrolls.
  final Widget? footer;

  final bool showDragHandle;
  final Color? dragHandleColor;
  final bool showTitleDivider;
  final double topRadius;
  final double maxHeightFraction;
  final EdgeInsetsGeometry contentPadding;
  final bool isContentScrollable;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final media = MediaQuery.of(context);
    final resolvedHeader = header ?? _defaultHeader(context);

    final body = Padding(padding: contentPadding, child: content);
    final scrollableBody = ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: media.size.height * maxHeightFraction,
      ),
      child: isContentScrollable ? SingleChildScrollView(child: body) : body,
    );

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.bg.container,
        borderRadius: BorderRadius.vertical(top: Radius.circular(topRadius.r)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (resolvedHeader != null) resolvedHeader,
            Flexible(child: scrollableBody),
            if (footer != null) footer!,
          ],
        ),
      ),
    );
  }

  Widget? _defaultHeader(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    if (!showDragHandle && title == null) return null;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showDragHandle)
          _DragHandle(color: dragHandleColor ?? colors.border.secondary),
        if (title != null) ...[
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
            child: Text(title!, style: texts.bodyLarge.semiBold()),
          ),
          if (showTitleDivider)
            Divider(height: 1, color: colors.border.secondary),
        ],
      ],
    );
  }
}

/// Abstract base for declarative (stateless) Masrafy bottom sheets.
///
/// Concrete subclasses implement [buildContent] for the body and override
/// hooks ([title], [buildFooter], [topRadius], etc.) as needed. Mirrors
/// the `PilotAppBar` pattern: one abstract base, many concrete subclasses.
///
/// For sheets with internal state (e.g. a calendar with month navigation),
/// use [PilotBottomSheetShell] directly from inside a `State.build`.
///
/// Present via [PilotBottomSheetBase.show]:
/// ```dart
/// final picked = await PilotBottomSheet.show<int>(
///   context: context,
///   sheet: const _MySheet(),
/// );
/// ```
abstract class PilotBottomSheetBase extends StatelessWidget {
  const PilotBottomSheetBase({super.key});

  // ── Overridable slots ───────────────────────────────────────────────────

  /// Body of the sheet.
  Widget buildContent(BuildContext context);

  /// Header text. When null, no title row is rendered.
  String? get title => null;

  /// Override to replace the entire header (drag handle + title + divider)
  /// with a custom layout. Returning `null` falls back to the default
  /// chrome built from [showDragHandle], [title], and [showTitleDivider].
  Widget? buildHeader(BuildContext context) => null;

  /// Optional pinned footer (e.g. action button row).
  Widget? buildFooter(BuildContext context) => null;

  bool get showDragHandle => true;

  /// Drag handle colour. Defaults to `colors.border.secondary`.
  Color? dragHandleColor(PilotColorTheme colors) => colors.border.secondary;

  bool get showTitleDivider => true;

  double get topRadius => 24;

  double get maxHeightFraction => 0.85;

  EdgeInsetsGeometry get contentPadding => EdgeInsets.zero;

  bool get isContentScrollable => true;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return PilotBottomSheetShell(
      content: buildContent(context),
      title: title,
      header: buildHeader(context),
      footer: buildFooter(context),
      showDragHandle: showDragHandle,
      dragHandleColor: dragHandleColor(colors),
      showTitleDivider: showTitleDivider,
      topRadius: topRadius,
      maxHeightFraction: maxHeightFraction,
      contentPadding: contentPadding,
      isContentScrollable: isContentScrollable,
    );
  }

  // ── Presentation helper ─────────────────────────────────────────────────

  /// Wraps [showModalBottomSheet] with the project's defaults:
  /// `isScrollControlled: true`, transparent surface (so the sheet's own
  /// rounded background renders), and the platform-standard barrier.
  static Future<T?> show<T>({
    required BuildContext context,
    required Widget sheet,
    bool isDismissible = true,
    bool enableDrag = true,
    Color? barrierColor,
    RouteSettings? routeSettings,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: barrierColor,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      routeSettings: routeSettings,
      builder: (_) => sheet,
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
      child: Container(
        width: 44.w,
        height: 4.h,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(2.r),
        ),
      ),
    );
  }
}
