import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/bottom_sheets/pilot_bottom_sheet_base.dart';
import 'package:app/features/study_session/domain/enums/test_mode.dart';

class PilotTestTypeFilterSheet extends PilotBottomSheetBase {
  const PilotTestTypeFilterSheet({
    super.key,
    required this.selected,
    required this.onApply,
  });

  final TestMode? selected;
  final ValueChanged<TestMode?> onApply;

  @override
  String? get title => 'Filter by Test Type';

  @override
  bool get isContentScrollable => false;

  @override
  Widget buildContent(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final divider = Divider(
      height: 1,
      color: colors.border.secondary,
      indent: 16.w,
      endIndent: 16.w,
    );
    final allOptions = <Widget>[
      _TestTypeTile(
        label: 'All Types',
        isSelected: selected == null,
        onTap: () {
          onApply(null);
          Navigator.pop(context);
        },
        colors: colors,
        texts: texts,
      ),
      ...TestMode.values.map(
        (mode) => _TestTypeTile(
          label: _label(mode),
          isSelected: selected == mode,
          onTap: () {
            onApply(mode);
            Navigator.pop(context);
          },
          colors: colors,
          texts: texts,
        ),
      ),
    ];

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: allOptions
          .expand((tile) => [tile, divider])
          .toList()
        ..removeLast(),
    );
  }

  String _label(TestMode mode) => switch (mode) {
    TestMode.study => 'Study',
    TestMode.studyPlanner => 'Study Planner',
    TestMode.exam => 'Exam',
    TestMode.customExam => 'Customize Exam',
  };
}

class _TestTypeTile extends StatelessWidget {
  const _TestTypeTile({
    required this.label,
    required this.isSelected,
    required this.onTap,
    required this.colors,
    required this.texts,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(
        label,
        style: texts.body.copyWith(
          color: isSelected ? colors.primary.main : colors.text.primary,
        ),
      ),
      trailing: isSelected
          ? Icon(Icons.check, color: colors.primary.main, size: 20.r)
          : null,
      onTap: onTap,
    );
  }
}
