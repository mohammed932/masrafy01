import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';

class PilotSwitch extends StatelessWidget {
  const PilotSwitch({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final isDisabled = onChanged == null;

    return Opacity(
      opacity: isDisabled ? 0.4 : 1.0,
      child: Switch(
        value: value,
        onChanged: onChanged,
        activeThumbColor: colors.white,
        activeTrackColor: colors.primary.main,
        inactiveThumbColor: colors.white,
        inactiveTrackColor: colors.fill.quaternary,
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),
    );
  }
}
