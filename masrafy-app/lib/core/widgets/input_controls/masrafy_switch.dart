import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

class MasrafySwitch extends StatelessWidget {
  const MasrafySwitch({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final isDisabled = onChanged == null;

    return Opacity(
      opacity: isDisabled ? 0.4 : 1.0,
      child: Switch(
        value: value,
        onChanged: onChanged,
        // `activeThumbColor` landed in Flutter 3.30+; current pin is 3.27.x.
        // The deprecated `activeColor` still maps to the active thumb.
        // ignore: deprecated_member_use
        activeColor: colors.white,
        activeTrackColor: colors.primary.main,
        inactiveThumbColor: colors.white,
        inactiveTrackColor: colors.fill.quaternary,
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),
    );
  }
}
