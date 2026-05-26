part of 'attachment_editor_widgets.imports.dart';

/// Optional question + options payload. When supplied, the editor renders a
/// `PilotPeekBottomSheet` over the canvas — peeks at 10% of the screen
/// height, expands to ~92% on upward swipe — so the user can reference (and
/// optionally answer) the underlying question while drawing on the figure.
class AttachmentEditorContext {
  const AttachmentEditorContext({
    required this.prompt,
    required this.options,
    required this.correctOptionLabel,
    this.onOptionSelected,
  });

  final String prompt;
  final List<AttachmentEditorOption> options;
  final String correctOptionLabel;

  /// Fired when the user picks an option from the peek sheet. Wire this to
  /// the originating `SessionRuntimeCubit.selectAnswer(displayIndex)` so the
  /// pick commits to the underlying Study/Exam session.
  final ValueChanged<int>? onOptionSelected;
}

class AttachmentEditorOption {
  const AttachmentEditorOption({required this.label, required this.text});
  final String label;
  final String text;
}

/// Fullscreen native chart annotator. Resolves a signed image URL via
/// `AttachmentsUseCase.getAttachmentUrl(attachmentId)` then hands the
/// resulting `NetworkImage` to [ChartAnnotator] — the WebView shell has been
/// retired for the attachment flow.
///
/// When [context] is non-null (Study / Exam tap sources), the editor overlays
/// a [PilotPeekBottomSheet] with the question prompt + options. Picking an
/// option fires [AttachmentEditorContext.onOptionSelected].
class AttachmentEditorScreen extends StatefulWidget {
  const AttachmentEditorScreen({
    super.key,
    required this.attachment,
    this.context,
  });

  final AttachmentEntity attachment;
  final AttachmentEditorContext? context;

  static Future<void> show(
    BuildContext context,
    AttachmentEntity attachment, {
    AttachmentEditorContext? panel,
  }) {
    final theme = PilotColorTheme.of(context);
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      builder: (_) => PilotColorThemeProvider(
        theme: theme,
        child: AttachmentEditorScreen(
          attachment: attachment,
          context: panel,
        ),
      ),
    );
  }

  @override
  State<AttachmentEditorScreen> createState() => _AttachmentEditorScreenState();
}

class _AttachmentEditorScreenState extends State<AttachmentEditorScreen> {
  late Future<Either<Failure, AttachmentUrlEntity>> _urlFuture;
  late final DrawingController _drawing;

  @override
  void initState() {
    super.initState();
    _urlFuture = _loadUrl();
    _drawing = DrawingController();
  }

  @override
  void dispose() {
    _drawing.dispose();
    super.dispose();
  }

  Future<Either<Failure, AttachmentUrlEntity>> _loadUrl() => getIt<AttachmentsUseCase>()
      .getAttachmentUrl(widget.attachment.attachmentId);

  void _retry() {
    setState(() {
      _urlFuture = _loadUrl();
    });
  }

  Future<void> _confirmClearAll() async {
    final confirmed = await PilotConfirmDialog.show(
      context,
      title: 'Clear all annotations?',
      message:
          'This removes every drawing on the image. Undo will bring them back.',
      confirmLabel: 'Clear',
      isDestructive: true,
    );
    if (confirmed) _drawing.clearAll();
  }

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return Dialog.fullscreen(
      child: Scaffold(
        backgroundColor: colors.bg.container,
        appBar: AppBar(
          backgroundColor: colors.bg.container,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: Icon(
              Icons.arrow_back_ios_new,
              color: colors.primary.main,
              size: 20.r,
            ),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            'Image Viewer',
            style: texts.heading4.bold().copyWith(color: colors.text.heading),
          ),
          centerTitle: false,
          titleSpacing: 0,
          actions: [
            ValueListenableBuilder<bool>(
              valueListenable: _drawing.canUndo,
              builder: (_, canUndo, __) => _AppBarPillAction(
                icon: Icons.undo_rounded,
                tooltip: 'Undo',
                onTap: canUndo ? _drawing.undo : null,
              ),
            ),
            Gap(8.w),
            ValueListenableBuilder<bool>(
              valueListenable: _drawing.canRedo,
              builder: (_, canRedo, __) => _AppBarPillAction(
                icon: Icons.redo_rounded,
                tooltip: 'Redo',
                onTap: canRedo ? _drawing.redo : null,
              ),
            ),
            Gap(8.w),
            ValueListenableBuilder<List<Annotation>>(
              valueListenable: _drawing.committed,
              builder: (_, annotations, __) {
                final enabled = annotations.isNotEmpty;
                return _AppBarPillAction(
                  icon: Icons.delete_outline_rounded,
                  tooltip: 'Clear all',
                  destructive: true,
                  onTap: enabled ? _confirmClearAll : null,
                );
              },
            ),
            Gap(12.w),
          ],
        ),
        body: FutureBuilder<Either<Failure, AttachmentUrlEntity>>(
          future: _urlFuture,
          builder: (ctx, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return Center(
                child: CircularProgressIndicator(color: colors.primary.main),
              );
            }
            final result = snapshot.data;
            if (result == null) {
              return _AttachmentLoadError(
                message: 'Could not load attachment.',
                onRetry: _retry,
              );
            }
            return result.fold(
              (failure) => _AttachmentLoadError(
                message: failure.userFacingMessage,
                onRetry: _retry,
              ),
              (entity) => _AttachmentEditorBody(
                imageUrl: entity.url,
                panel: widget.context,
                drawing: _drawing,
              ),
            );
          },
        ),
      ),
    );
  }
}

class _AppBarPillAction extends StatelessWidget {
  const _AppBarPillAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final disabled = onTap == null;
    final activeColor = destructive ? colors.error.main : colors.primary.main;
    final iconColor = disabled
        ? colors.icon.main.withValues(alpha: 0.30)
        : activeColor;
    final ringColor = disabled
        ? colors.border.main.withValues(alpha: 0.35)
        : activeColor;
    final ringWidth = disabled ? 1.0 : 1.6;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        shape: CircleBorder(
          side: BorderSide(color: ringColor, width: ringWidth),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          splashColor: activeColor.withValues(alpha: 0.18),
          highlightColor: activeColor.withValues(alpha: 0.08),
          child: SizedBox(
            width: 40.r,
            height: 40.r,
            child: Icon(
              icon,
              size: 22.r,
              color: iconColor,
              weight: disabled ? 400 : 700,
            ),
          ),
        ),
      ),
    );
  }
}

class _AttachmentEditorBody extends StatelessWidget {
  const _AttachmentEditorBody({
    required this.imageUrl,
    required this.panel,
    required this.drawing,
  });

  final String imageUrl;
  final AttachmentEditorContext? panel;
  final DrawingController drawing;

  @override
  Widget build(BuildContext context) {
    // Peek sheet sits at the bottom 10% of the screen; reserve that strip
    // plus a small gap so the toolbar's last buttons clear the sheet's
    // drag-handle row.
    final screenH = MediaQuery.sizeOf(context).height;
    final bottomInset = panel != null ? screenH * 0.10 + 16 : 12.0;
    return Stack(
      fit: StackFit.expand,
      children: [
        ChartAnnotator(
          controller: drawing,
          imageProvider: NetworkImage(imageUrl),
          toolbarPadding: EdgeInsets.fromLTRB(12, 12, 12, bottomInset),
          // Undo + Redo live in the AppBar — exclude from the vertical pill.
          enabledTools: ToolType.values
              .where((t) => t != ToolType.undo && t != ToolType.redo)
              .toList(growable: false),
        ),
        if (panel != null)
          Align(
            alignment: Alignment.bottomCenter,
            child: _McqPeekSheet(context: panel!),
          ),
      ],
    );
  }
}

class _AttachmentLoadError extends StatelessWidget {
  const _AttachmentLoadError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 32.w),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.broken_image_outlined,
                size: 48.r, color: colors.text.secondary),
            Gap(12.h),
            Text(
              message,
              textAlign: TextAlign.center,
              style: texts.body.copyWith(color: colors.text.primary),
            ),
            Gap(16.h),
            TextButton(
              onPressed: onRetry,
              child: Text(
                'Try again',
                style: texts.body
                    .semiBold()
                    .copyWith(color: colors.primary.main),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _McqPeekSheet extends StatefulWidget {
  const _McqPeekSheet({required this.context});

  final AttachmentEditorContext context;

  @override
  State<_McqPeekSheet> createState() => _McqPeekSheetState();
}

class _McqPeekSheetState extends State<_McqPeekSheet> {
  final _sheetCtrl = PilotPeekSheetController();

  void _handleOption(int index) {
    widget.context.onOptionSelected?.call(index);
    _sheetCtrl.collapse();
  }

  @override
  Widget build(BuildContext outerContext) {
    return SizedBox(
      // The body renders the sheet aligned to bottomCenter.
      // `DraggableScrollableSheet` needs a finite max-height parent so its
      // fractional sizes resolve — give it the full screen height.
      height: MediaQuery.sizeOf(outerContext).height,
      child: PilotPeekBottomSheet(
        controller: _sheetCtrl,
        peekBuilder: (_) => GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _sheetCtrl.expand,
          child: _PeekContent(context: widget.context),
        ),
        expandedBuilder: (_) => _ExpandedContent(
          context: widget.context,
          onOptionTap: _handleOption,
        ),
      ),
    );
  }
}

class _PeekContent extends StatelessWidget {
  const _PeekContent({required this.context});

  final AttachmentEditorContext context;

  @override
  Widget build(BuildContext outerContext) {
    final colors = PilotColorTheme.of(outerContext);
    final texts = PilotTextTheme.of(outerContext);
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 4.h),
      child: Row(
        children: [
          Icon(Icons.list_alt_rounded, size: 18.r, color: colors.text.secondary),
          Gap(8.w),
          Expanded(
            child: Text(
              'Question',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: texts.body.semiBold().copyWith(color: colors.text.primary),
            ),
          ),
          Icon(Icons.keyboard_arrow_up_rounded,
              size: 20.r, color: colors.text.secondary),
        ],
      ),
    );
  }
}

class _ExpandedContent extends StatelessWidget {
  const _ExpandedContent({required this.context, required this.onOptionTap});

  final AttachmentEditorContext context;
  final ValueChanged<int> onOptionTap;

  @override
  Widget build(BuildContext outerContext) {
    final colors = PilotColorTheme.of(outerContext);
    return Padding(
      padding: EdgeInsets.fromLTRB(16.w, 8.h, 16.w, 24.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PilotHtml(
            data: context.prompt,
            fontSize: 16.sp,
            textColor: colors.text.primary,
            lineHeight: 24 / 16,
          ),
          Gap(20.h),
          for (var i = 0; i < context.options.length; i++) ...[
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onOptionTap(i),
              child: PilotAnswerOption(
                state: context.options[i].label == context.correctOptionLabel
                    ? PilotAnswerOptionState.correct
                    : PilotAnswerOptionState.idle,
                label: context.options[i].label,
                htmlText: context.options[i].text,
              ),
            ),
            Gap(12.h),
          ],
        ],
      ),
    );
  }
}
