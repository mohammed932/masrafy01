part of 'comments.imports.dart';

class CommentsScreen extends StatelessWidget {
  const CommentsScreen({
    super.key,
    required this.questionId,
    this.currentUserId,
  });

  final String questionId;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    return CommentsPanel(
      questionId: questionId,
      currentUserId: currentUserId,
    );
  }
}