part of 'comments_widgets.imports.dart';

/// T131 — 5 reasons radio list + optional details textarea + Cancel/Submit.
class ReportCommentSheet extends StatefulWidget {
  const ReportCommentSheet({super.key, required this.commentId});

  final String commentId;

  static Future<void> show(BuildContext context, String commentId) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16.r)),
        ),
        builder: (ctx) => BlocProvider.value(
          value: BlocProvider.of<CommentsCubit>(context),
          child: ReportCommentSheet(commentId: commentId),
        ),
      );

  @override
  State<ReportCommentSheet> createState() => _ReportCommentSheetState();
}

class _ReportCommentSheetState extends State<ReportCommentSheet> {
  CommentReportReason? _selected;
  final _detailsController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selected == null) return;
    setState(() => _isSubmitting = true);

    final cubit = context.read<CommentsCubit>();
    final navigator = Navigator.of(context);

    final success = await cubit.reportComment(
      widget.commentId,
      _selected!,
      details: _detailsController.text.trim().isEmpty
          ? null
          : _detailsController.text.trim(),
    );

    if (!mounted) return;
    navigator.pop();
    if (success) {
      const PilotSuccessToast(message: 'Comment reported. Thank you for your feedback.').show(context);
    } else {
      final error = cubit.state.errorMessage;
      if (error != null) {
        PilotErrorToast(message: error).show(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(
          20.w, 20.h, 20.w, 20.h + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Report Comment',
            style: texts.heading5.bold().copyWith(color: colors.text.primary),
          ),
          Gap(4.h),
          Text(
            'Why are you reporting this comment?',
            style: texts.bodySmall.copyWith(color: colors.text.secondary),
          ),
          Gap(16.h),
          RadioGroup<CommentReportReason>(
            groupValue: _selected,
            onChanged: (v) => setState(() => _selected = v),
            child: Column(
              children: CommentReportReason.values
                  .map((reason) => RadioListTile<CommentReportReason>(
                        value: reason,
                        title: Text(
                          reason.label,
                          style: texts.body.copyWith(color: colors.text.primary),
                        ),
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                      ))
                  .toList(),
            ),
          ),
          Gap(12.h),
          TextField(
            controller: _detailsController,
            maxLines: 3,
            minLines: 2,
            maxLength: 500,
            style: texts.body.copyWith(color: colors.text.primary),
            decoration: InputDecoration(
              hintText: 'Additional details (optional)',
              hintStyle: texts.body.copyWith(color: colors.text.secondary),
              filled: true,
              fillColor: colors.fill.alterSolid,
              counterStyle: texts.bodySmall.copyWith(color: colors.text.secondary),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8.r),
                borderSide: BorderSide(color: colors.border.main),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8.r),
                borderSide: BorderSide(color: colors.border.main),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8.r),
                borderSide: BorderSide(color: colors.primary.border),
              ),
            ),
          ),
          Gap(16.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: _isSubmitting ? null : () => Navigator.pop(context),
                child: Text('Cancel', style: texts.body),
              ),
              Gap(8.w),
              FilledButton(
                onPressed: (_selected == null || _isSubmitting) ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: colors.primary.main),
                child: _isSubmitting
                    ? SizedBox(
                        width: 16.r,
                        height: 16.r,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: colors.bg.container,
                        ),
                      )
                    : Text(
                        'Submit',
                        style: texts.body.copyWith(color: colors.bg.container),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
