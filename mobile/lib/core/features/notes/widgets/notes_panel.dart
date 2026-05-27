part of 'notes_widgets.imports.dart';

/// Side-panel: composer (Add/Edit note) + previous notes list header.
/// Requires a [NotesCubit] in the widget tree — provided by the caller.
/// The caller MUST pass the [questionId] so the composer can save against
/// the correct question without depending on any feature-specific cubit.
class NotesPanel extends StatelessWidget {
  const NotesPanel({super.key, required this.questionId});

  final String questionId;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);

    return BlocListener<NotesCubit, NotesState>(
      listenWhen: (p, c) => c.isTrialLocked && !p.isTrialLocked,
      listener: (context, state) =>
          _showTrialLockedDialog(context, colors, texts),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Composer
          _NoteComposer(questionId: questionId, colors: colors, texts: texts),
          Divider(height: 32.h, color: colors.border.main),

          BlocBuilder<NotesCubit, NotesState>(
            buildWhen: (p, c) => c.noteState != p.noteState || c.note != p.note,
            builder: (context, state) {
              if (state.noteState.isLoading) {
                return const NotesSkeleton();
              }
              if (state.note == null) {
                return Text(
                  'No notes for this question.',
                  style: texts.body.copyWith(color: colors.text.secondary),
                );
              }
              return _NoteCard(note: state.note!, colors: colors, texts: texts);
            },
          ),
        ],
      ),
    );
  }

  void _showTrialLockedDialog(
    BuildContext context,
    MasrafyColorTheme colors,
    MasrafyTextTheme texts,
  ) {
    MasrafyInfoDialog.show(
      context,
      title: 'Upgrade Required',
      message:
          'Notes are available on the Pro plan. Upgrade to start taking notes.',
    );
  }
}

class _NoteComposer extends StatefulWidget {
  const _NoteComposer({
    required this.questionId,
    required this.colors,
    required this.texts,
  });

  final String questionId;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme texts;

  @override
  State<_NoteComposer> createState() => _NoteComposerState();
}

class _NoteComposerState extends State<_NoteComposer> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: context.read<NotesCubit>().state.composerText,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    final texts = widget.texts;
    final cubit = context.read<NotesCubit>();

    return BlocConsumer<NotesCubit, NotesState>(
      listenWhen: (p, c) =>
          c.note != p.note && c.composerText != _controller.text,
      listener: (_, state) {
        _controller.text = state.composerText;
        _controller.selection = TextSelection.collapsed(
          offset: _controller.text.length,
        );
      },
      buildWhen: (p, c) =>
          c.composerText != p.composerText ||
          c.isSaving != p.isSaving ||
          c.isDeleting != p.isDeleting ||
          c.hasNote != p.hasNote,
      builder: (context, state) {
        // Visual spec mirrors Figma 3173:51424 — vertical form item
        // (label + textarea + caption) above end-aligned Cancel / Save row.
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Label
            Text(
              state.hasNote ? 'Edit Note' : 'Add Note',
              style: texts.body.regular().copyWith(color: colors.text.primary),
            ),
            Gap(8.h),
            // Textarea — fixed 146h, radius 20, primary.main border, no
            // counter inside (caption below carries the helper copy).
            Container(
              height: 146.h,
              decoration: BoxDecoration(
                color: colors.fill.alterSolid,
                border: Border.all(color: colors.primary.main),
                borderRadius: BorderRadius.circular(20.r),
              ),
              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
              child: TextField(
                controller: _controller,
                onChanged: cubit.updateComposer,
                maxLines: null,
                expands: true,
                textAlignVertical: TextAlignVertical.top,
                maxLength: UserNoteEntity.maxNoteLength,
                style: texts.bodyLarge.copyWith(color: colors.text.primary),
                decoration: InputDecoration(
                  hintText: 'Write your note here…',
                  hintStyle:
                      texts.bodyLarge.copyWith(color: colors.text.placeholder),
                  isCollapsed: true,
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                  counterText: '',
                ),
              ),
            ),
            // Caption — fixed copy per Figma; counter only surfaces when
            // user is within 50 chars of the limit (preserves UX, optional).
            Gap(2.h),
            Text(
              'Add a quick note to remind yourself while studying — your notes are private and only visible to you.',
              style:
                  texts.body.regular().copyWith(color: colors.text.placeholder),
            ),
            Gap(16.h),
            // End-aligned Cancel / Save Note (+ optional Delete) row.
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (state.hasNote) ...[
                  _GhostButton(
                    label: 'Delete',
                    color: colors.error.main,
                    onTap: state.isDeleting
                        ? null
                        : () => _confirmDelete(context, cubit, colors, texts),
                    texts: texts,
                  ),
                  Gap(16.w),
                ],
                _GhostButton(
                  label: 'Cancel',
                  color: colors.text.primary,
                  onTap: state.isDirty
                      ? () {
                          _controller.text = cubit.state.note?.noteText ?? '';
                          cubit.updateComposer(_controller.text);
                        }
                      : null,
                  texts: texts,
                ),
                Gap(16.w),
                _PrimaryPillButton(
                  label: 'Save Note',
                  isLoading: state.isSaving,
                  onTap: state.canSave && !state.isSaving && state.isDirty
                      ? () => cubit.saveNote(widget.questionId)
                      : null,
                  colors: colors,
                  texts: texts,
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  void _confirmDelete(
    BuildContext context,
    NotesCubit cubit,
    MasrafyColorTheme colors,
    MasrafyTextTheme texts,
  ) {
    showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Delete note?', style: texts.heading5.bold()),
        content: Text(
          'This note will be permanently deleted.',
          style: texts.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: texts.body),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              'Delete',
              style: texts.body.semiBold().copyWith(color: colors.error.main),
            ),
          ),
        ],
      ),
    ).then((confirmed) {
      if (confirmed == true) cubit.deleteNote();
    });
  }
}

class _GhostButton extends StatelessWidget {
  const _GhostButton({
    required this.label,
    required this.color,
    required this.onTap,
    required this.texts,
  });

  final String label;
  final Color color;
  final VoidCallback? onTap;
  final MasrafyTextTheme texts;

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 40.h,
        padding: EdgeInsets.symmetric(horizontal: 15.w),
        alignment: Alignment.center,
        child: Text(
          label,
          style: texts.bodyLarge.regular().copyWith(
                color: disabled ? color.withValues(alpha: 0.45) : color,
              ),
        ),
      ),
    );
  }
}

class _PrimaryPillButton extends StatelessWidget {
  const _PrimaryPillButton({
    required this.label,
    required this.isLoading,
    required this.onTap,
    required this.colors,
    required this.texts,
  });

  final String label;
  final bool isLoading;
  final VoidCallback? onTap;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme texts;

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 40.h,
        padding: EdgeInsets.symmetric(horizontal: 15.w),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: disabled
              ? colors.primary.main.withValues(alpha: 0.45)
              : colors.primary.main,
          borderRadius: BorderRadius.circular(24.r),
        ),
        child: isLoading
            ? SizedBox(
                width: 16.r,
                height: 16.r,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.text.lightSolid,
                ),
              )
            : Text(
                label,
                style: texts.bodyLarge
                    .regular()
                    .copyWith(color: colors.text.lightSolid),
              ),
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard({
    required this.note,
    required this.colors,
    required this.texts,
  });

  final UserNoteEntity note;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme texts;

  static const _months = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];

  String _formatDate(DateTime d) =>
      '${d.day} ${_months[d.month - 1]}, ${d.year}';

  @override
  Widget build(BuildContext context) {
    // Mirrors Figma 3173:51355 — fill.handleBg + border.main, padding 16,
    // radius 20, 8 gap between date tag and body. Date tag uses primary
    // tone (cyan-1 bg / cyan-3 border / cyan-6 text) per the Tag/Colorful
    // spec.
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: colors.fill.handleBg,
        border: Border.all(color: colors.border.main),
        borderRadius: BorderRadius.circular(20.r),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 1.h),
            decoration: BoxDecoration(
              color: colors.primary.bg,
              border: Border.all(color: colors.primary.border),
              borderRadius: BorderRadius.circular(28.r),
            ),
            child: Text(
              _formatDate(note.updatedAt),
              style: texts.caption
                  .regular()
                  .copyWith(color: colors.primary.main, height: 20 / 12),
            ),
          ),
          Gap(8.h),
          Text(
            note.noteText,
            style: texts.body
                .regular()
                .copyWith(color: colors.text.primary, height: 22 / 14),
          ),
        ],
      ),
    );
  }
}
