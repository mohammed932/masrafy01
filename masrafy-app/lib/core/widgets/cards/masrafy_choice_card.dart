import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Full-width, tap-to-select choice card — one option of a step whose PRIMARY
/// content is the choice itself.
///
/// This is not a form field, so it is not an A36 case: A36 mandates the shared
/// bottom sheet for value selection inside a form, where a dropdown would compete
/// with the surrounding inputs. Here the list IS the screen — the same shape the
/// Home category grid already uses (`HomeLoanCard`), one column wider so a card
/// can carry a subtitle explaining what the choice means.
///
/// Selection is a lift, not just a tint: fill, stroke and shadow move together
/// over 200 ms, and pressing scales the card fractionally so the tap registers
/// before the state does. Disabled cards stay VISIBLE and readable with
/// [disabledNote] saying why — the caller is expected to render an unavailable
/// option rather than drop it, because a silently shortened list is
/// indistinguishable from a broken one.
///
/// Tokens only (Principle VIII / A18); logical insets only (Principle IV / A19).
class MasrafyChoiceCard extends StatefulWidget {
  const MasrafyChoiceCard({
    super.key,
    required this.title,
    required this.selected,
    required this.onTap,
    this.subtitle,
    this.iconAsset,
    this.icon,
    this.trailingLabel,
    this.enabled = true,
    this.disabledNote,
  });

  final String title;

  /// One line of plain language under the title. Optional — a program name has
  /// nothing to explain, an income basis does.
  final String? subtitle;

  /// PNG/JPG asset path, rendered at 44r. Takes precedence over [icon].
  final String? iconAsset;

  /// Fallback glyph when the choice has no artwork.
  final IconData? icon;

  /// Short trailing chip, e.g. "7 banks". Hidden while disabled — a count on an
  /// option nobody can pick is noise.
  final String? trailingLabel;

  final bool selected;
  final bool enabled;

  /// Why this option cannot be picked. Rendered in place of [subtitle].
  final String? disabledNote;

  final VoidCallback onTap;

  @override
  State<MasrafyChoiceCard> createState() => _MasrafyChoiceCardState();
}

class _MasrafyChoiceCardState extends State<MasrafyChoiceCard> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    final enabled = widget.enabled;
    final selected = widget.selected && enabled;
    final tint = colors.bg.mask;
    final radius = BorderRadius.circular(18.r);

    final titleColor =
        enabled ? colors.text.heading : colors.text.disabled;
    final bodyColor =
        enabled ? colors.text.description : colors.text.disabled;
    final note = enabled ? widget.subtitle : (widget.disabledNote ?? widget.subtitle);

    return Semantics(
      button: true,
      enabled: enabled,
      selected: selected,
      child: AnimatedScale(
        // Fractional, and only while the finger is down: the card must feel
        // pressable before the selected state has had time to animate in.
        scale: _pressed && enabled ? 0.98 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: InkWell(
          borderRadius: radius,
          onTap: enabled ? widget.onTap : null,
          onTapDown: enabled ? (_) => _setPressed(true) : null,
          onTapUp: enabled ? (_) => _setPressed(false) : null,
          onTapCancel: enabled ? () => _setPressed(false) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            padding: EdgeInsetsDirectional.all(16.r),
            decoration: BoxDecoration(
              color: !enabled
                  ? colors.bg.containerDisabled
                  : selected
                      ? colors.secondary.border.withValues(alpha: 0.2)
                      : colors.bg.container,
              borderRadius: radius,
              border: selected
                  ? Border.all(color: colors.secondary.main, width: 1.5)
                  : null,
              boxShadow: enabled
                  ? [
                      BoxShadow(
                        color: tint.withValues(alpha: 0.035),
                        blurRadius: 2,
                        offset: const Offset(0, 1),
                      ),
                      BoxShadow(
                        color: tint.withValues(alpha: selected ? 0.05 : 0.04),
                        blurRadius: selected ? 14 : 9,
                        offset: Offset(0, selected ? 4 : 2),
                      ),
                      if (selected)
                        BoxShadow(
                          color: colors.secondary.main.withValues(alpha: 0.09),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                    ]
                  : const [],
            ),
            child: Row(
              children: [
                if (widget.iconAsset != null || widget.icon != null) ...[
                  _Leading(
                    iconAsset: widget.iconAsset,
                    icon: widget.icon,
                    enabled: enabled,
                    selected: selected,
                  ),
                  Gap(12.w),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: text.body.bold().copyWith(color: titleColor),
                      ),
                      if (note != null && note.isNotEmpty) ...[
                        Gap(4.h),
                        Text(
                          note,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall.copyWith(color: bodyColor),
                        ),
                      ],
                    ],
                  ),
                ),
                if (widget.trailingLabel != null && enabled) ...[
                  Gap(10.w),
                  _CountChip(label: widget.trailingLabel!, selected: selected),
                ],
                Gap(10.w),
                _SelectedMark(selected: selected),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Leading extends StatelessWidget {
  const _Leading({
    required this.iconAsset,
    required this.icon,
    required this.enabled,
    required this.selected,
  });

  final String? iconAsset;
  final IconData? icon;
  final bool enabled;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final asset = iconAsset;
    if (asset != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12.r),
        child: Image.asset(
          asset,
          width: 44.r,
          height: 44.r,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
        ),
      );
    }
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      width: 44.r,
      height: 44.r,
      decoration: BoxDecoration(
        color: selected
            ? colors.secondary.main.withValues(alpha: 0.16)
            : colors.fill.secondary,
        borderRadius: BorderRadius.circular(12.r),
      ),
      child: Icon(
        icon,
        size: 22.r,
        color: !enabled
            ? colors.text.disabled
            : selected
                ? colors.secondary.main
                : colors.icon.main,
      ),
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({required this.label, required this.selected});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      padding: EdgeInsetsDirectional.symmetric(horizontal: 8.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: selected
            ? colors.secondary.main.withValues(alpha: 0.14)
            : colors.fill.secondary,
        borderRadius: BorderRadius.circular(999.r),
      ),
      child: Text(
        label,
        style: text.caption.medium().copyWith(
              color: selected ? colors.secondary.main : colors.text.secondary,
            ),
      ),
    );
  }
}

/// The check that grows in on selection. `AnimatedSize` keeps the title column
/// from re-flowing on every tap — the mark takes its width from zero, not from
/// the row suddenly gaining a child.
class _SelectedMark extends StatelessWidget {
  const _SelectedMark({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return AnimatedSize(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      child: AnimatedOpacity(
        opacity: selected ? 1 : 0,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: SizedBox(
          width: selected ? 24.r : 0,
          height: 24.r,
          child: Container(
            decoration: BoxDecoration(
              color: colors.secondary.main,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.check_rounded, size: 15.r, color: colors.white),
          ),
        ),
      ),
    );
  }
}
