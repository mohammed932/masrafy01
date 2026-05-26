import 'package:app/core/widgets/common/pilot_badge.dart';

enum TestMode { study, exam, customExam, studyPlanner }

extension TestModeRemote on TestMode {
  static TestMode fromRemote(String remote) {
    switch (remote) {
      case 'STUDY':
        return TestMode.study;
      case 'EXAM':
        return TestMode.exam;
      case 'CUSTOM_EXAM':
        return TestMode.customExam;
      case 'STUDY_PLANNER':
        return TestMode.studyPlanner;
      default:
        return TestMode.study;
    }
  }

  String toRemote() {
    switch (this) {
      case TestMode.study:
        return 'STUDY';
      case TestMode.exam:
        return 'EXAM';
      case TestMode.customExam:
        return 'CUSTOM_EXAM';
      case TestMode.studyPlanner:
        return 'STUDY_PLANNER';
    }
  }

  bool get isExamMode => this == TestMode.exam || this == TestMode.customExam;
  bool get isStudyMode => this == TestMode.study || this == TestMode.studyPlanner;
}

extension TestModeBadgeVariant on TestMode {
  PilotBadgeVariant get badgeVariant => switch (this) {
        TestMode.study => PilotBadgeVariant.primary,
        TestMode.studyPlanner => PilotBadgeVariant.primary,
        TestMode.exam => PilotBadgeVariant.warning,
        TestMode.customExam => PilotBadgeVariant.warning,
      };

  String get displayLabel => switch (this) {
        TestMode.study => 'Study',
        TestMode.studyPlanner => 'Study Planner',
        TestMode.exam => 'Exam',
        TestMode.customExam => 'Custom Exam',
      };
}
