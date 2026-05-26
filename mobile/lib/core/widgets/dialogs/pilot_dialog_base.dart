import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

/// Stateful-friendly chrome wrapper for Masrafy dialogs.
///
/// Use this directly when your dialog is a `StatefulWidget` (its `State`
/// returns this from `build`). For purely declarative dialogs, extend
/// [PilotDialogBase] instead — it composes this shell from a small set
/// of hooks.
///
/// Owns: outer [Dialog] surface (`bg.elevated` + `border.main`, radius 20r,
/// horizontal 32w inset, 24r inner padding), optional title row, optional
/// footer row, scrollable body.
class PilotDialogShell extends StatelessWidget {
  const PilotDialogShell({
    super.key,
    required this.content,
    this.title,
    this.header,
    this.footer,
    this.cornerRadius = 20,
    this.contentPadding = const EdgeInsets.all(24),
    this.titleSpacing = 8,
    this.footerSpacing = 24,
    this.horizontalInset = 32,
    this.maxWidth,
  });

  /// Body of the dialog — rendered between the header (if any) and the
  /// footer (if any).
  final Widget content;

  /// Header text shown in the default header. Ignored when [header] is
  /// non-null.
  final String? title;

  /// Fully-custom header. When non-null, it replaces the default title row.
  final Widget? header;

  /// Action row pinned below the content.
  final Widget? footer;

  /// Outer corner radius. Defaults to 20.
  final double cornerRadius;

  /// Inner padding around the entire dialog content.
  final EdgeInsetsGeometry contentPadding;

  /// Vertical gap between [title] and [content].
  final double titleSpacing;

  /// Vertical gap between [content] and [footer].
  final double footerSpacing;

  /// Horizontal screen inset for the [Dialog] surface itself.
  final double horizontalInset;

  /// Optional max-width clamp. Defaults to letting the [Dialog] inset rule.
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final resolvedHeader = header ??
        (title != null
            ? Text(
                title!,
                style: texts.heading5.copyWith(color: colors.text.heading),
              )
            : null);

    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: EdgeInsets.symmetric(horizontal: horizontalInset.w),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth ?? double.infinity),
        child: Container(
          width: double.infinity,
          padding: contentPadding,
          decoration: BoxDecoration(
            color: colors.bg.elevated,
            border: Border.all(color: colors.border.main),
            borderRadius: BorderRadius.circular(cornerRadius.r),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (resolvedHeader != null) ...[
                resolvedHeader,
                Gap(titleSpacing.h),
              ],
              Flexible(child: content),
              if (footer != null) ...[
                Gap(footerSpacing.h),
                footer!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Abstract base for declarative (stateless) Masrafy dialogs.
///
/// Concrete subclasses implement [buildContent] for the body and override
/// hooks ([title], [buildFooter], [cornerRadius], etc.) as needed. Mirrors
/// the `PilotBottomSheetBase` pattern: one abstract base, many concrete
/// subclasses.
///
/// For dialogs with internal state (e.g. a multi-step picker), use
/// [PilotDialogShell] directly from inside a `State.build`.
///
/// Present via [PilotDialogBase.show]:
/// ```dart
/// final confirmed = await PilotDialogBase.show<bool>(
///   context: context,
///   dialog: const _MyDialog(),
/// );
/// ```
abstract class PilotDialogBase extends StatelessWidget {
  const PilotDialogBase({super.key});

  // ── Overridable slots ───────────────────────────────────────────────────

  /// Body of the dialog.
  Widget buildContent(BuildContext context);

  /// Header text. When null, no title row is rendered.
  String? get title => null;

  /// Override to replace the entire header with a custom layout. Returning
  /// `null` falls back to the default chrome built from [title].
  Widget? buildHeader(BuildContext context) => null;

  /// Action row pinned below the content (typically a Cancel/Confirm pair).
  Widget? buildFooter(BuildContext context) => null;

  @override
  Widget build(BuildContext context) {
    return PilotDialogShell(
      content: buildContent(context),
      title: title,
      header: buildHeader(context),
      footer: buildFooter(context),
    );
  }

  // ── Presentation helper ─────────────────────────────────────────────────

  /// Wraps [showDialog] with the project's defaults: dimmed barrier
  /// (`Colors.black54`) and barrier-dismissible by default.
  ///
  /// Re-installs the active [PilotColorTheme] inside the dialog route via
  /// [PilotColorThemeProvider] so the dialog's `PilotColorTheme.of(context)`
  /// resolves to the same theme as its caller (matters when the dialog is
  /// pushed from a tab/route that overrides the inherited theme).
  static Future<T?> show<T>({
    required BuildContext context,
    required Widget dialog,
    bool barrierDismissible = true,
    Color barrierColor = Colors.black54,
    RouteSettings? routeSettings,
  }) {
    final theme = PilotColorTheme.of(context);
    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      barrierColor: barrierColor,
      routeSettings: routeSettings,
      builder: (_) => PilotColorThemeProvider(theme: theme, child: dialog),
    );
  }
}

/// Canonical Cancel/Confirm action row for [PilotDialogBase] subclasses.
///
/// Used inside [buildFooter]:
/// ```dart
/// @override
/// Widget? buildFooter(BuildContext context) => PilotDialogActions(
///   cancelLabel: 'Cancel',
///   confirmLabel: 'Delete',
///   isDestructive: true,
///   onCancel: () => Navigator.of(context).pop(false),
///   onConfirm: () => Navigator.of(context).pop(true),
/// );
/// ```
class PilotDialogActions extends StatelessWidget {
  const PilotDialogActions({
    super.key,
    required this.cancelLabel,
    required this.confirmLabel,
    required this.onCancel,
    required this.onConfirm,
    this.isDestructive = false,
    this.gap = 12,
  });

  final String cancelLabel;
  final String confirmLabel;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;

  /// When true, the confirm button uses `error.main`. Default: `primary.main`.
  final bool isDestructive;

  /// Horizontal gap between the two buttons (logical px before .w scaling).
  final double gap;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final accent = isDestructive ? colors.error.main : colors.primary.main;
    return Row(
      children: [
        Expanded(
          child: _DialogButton(
            label: cancelLabel,
            onTap: onCancel,
            background: Colors.transparent,
            borderColor: colors.border.main,
            textColor: colors.text.heading,
          ),
        ),
        Gap(gap.w),
        Expanded(
          child: _DialogButton(
            label: confirmLabel,
            onTap: onConfirm,
            background: accent,
            borderColor: accent,
            textColor: Colors.white,
          ),
        ),
      ],
    );
  }
}

class _DialogButton extends StatelessWidget {
  const _DialogButton({
    required this.label,
    required this.onTap,
    required this.background,
    required this.borderColor,
    required this.textColor,
  });

  final String label;
  final VoidCallback onTap;
  final Color background;
  final Color borderColor;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    final texts = PilotTextTheme.of(context);
    // Min 40r tall, but grow to fit a wrapped label (up to 2 lines).
    // FittedBox.scaleDown auto-shrinks borderline-long single-line
    // labels so common cases stay one row; very long strings wrap
    // cleanly inside the pill rather than clipping under a fixed
    // height.
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        constraints: BoxConstraints(minHeight: 40.r),
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: background,
          border: Border.all(color: borderColor),
          borderRadius: BorderRadius.circular(24.r),
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: texts.bodyLarge.regular().copyWith(color: textColor),
          ),
        ),
      ),
    );
  }
}
