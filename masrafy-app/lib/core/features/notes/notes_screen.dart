part of 'notes.imports.dart';

class NotesScreen extends StatelessWidget {
  const NotesScreen({super.key, required this.questionId});

  final String questionId;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: NotesPanel(questionId: questionId),
    );
  }
}
