part of 'exam_reports.imports.dart';

class ExamReportsScreen extends StatelessWidget {
  const ExamReportsScreen({super.key, required this.questionId});

  final String questionId;

  @override
  Widget build(BuildContext context) {
    return ExamReportsPanel(questionId: questionId);
  }
}