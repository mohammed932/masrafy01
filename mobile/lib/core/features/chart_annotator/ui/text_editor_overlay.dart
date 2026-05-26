import 'package:flutter/material.dart';

import '../util/coordinate_transform.dart';

/// Spawns an `OverlayEntry` containing an inline `TextField` for the Text
/// tool (spec §5.4). One controller per ChartAnnotator State; `show` inserts
/// the entry, `dismiss` removes it.
class TextEditorOverlayController {
  TextEditorOverlayController();

  OverlayEntry? _entry;

  bool get isVisible => _entry != null;

  /// Inserts a [TextEditorOverlay] above the chart. [onSubmit] receives the
  /// trimmed text when the user submits; [onCancel] fires on Escape / empty
  /// submit. Both close the overlay.
  void show({
    required BuildContext context,
    required Offset imagePosition,
    required Matrix4 transform,
    required Color color,
    required double fontSize,
    required ValueChanged<String> onSubmit,
    required VoidCallback onCancel,
  }) {
    dismiss();
    final overlay = Overlay.of(context);
    _entry = OverlayEntry(
      builder: (_) => TextEditorOverlay(
        imagePosition: imagePosition,
        transform: transform,
        color: color,
        fontSize: fontSize,
        onSubmit: (text) {
          dismiss();
          onSubmit(text);
        },
        onCancel: () {
          dismiss();
          onCancel();
        },
      ),
    );
    overlay.insert(_entry!);
  }

  void dismiss() {
    _entry?.remove();
    _entry = null;
  }
}

/// Inline `TextField` shown at the user's tap position when the text tool
/// commits. Sized + positioned in screen space using the current viewport
/// [Matrix4]. Commits on submit / focus loss; discards on empty / escape.
class TextEditorOverlay extends StatefulWidget {
  const TextEditorOverlay({
    super.key,
    required this.imagePosition,
    required this.transform,
    required this.onSubmit,
    required this.onCancel,
    this.color = const Color(0xFFB22222),
    this.fontSize = 16,
  });

  final Offset imagePosition;
  final Matrix4 transform;
  final ValueChanged<String> onSubmit;
  final VoidCallback onCancel;
  final Color color;
  final double fontSize;

  @override
  State<TextEditorOverlay> createState() => _TextEditorOverlayState();
}

class _TextEditorOverlayState extends State<TextEditorOverlay> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
    _focusNode.addListener(_onFocusChange);
  }

  void _onFocusChange() {
    if (!_focusNode.hasFocus) _submit();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      widget.onCancel();
    } else {
      widget.onSubmit(text);
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screen = imageToScreen(widget.imagePosition, widget.transform);
    final scale = currentScale(widget.transform);
    return Positioned(
      left: screen.dx,
      top: screen.dy,
      child: Material(
        color: Colors.transparent,
        child: IntrinsicWidth(
          child: SizedBox(
            width: 160 * scale,
            child: TextField(
              controller: _controller,
              focusNode: _focusNode,
              autofocus: true,
              cursorColor: widget.color,
              style: TextStyle(
                color: widget.color,
                fontSize: widget.fontSize * scale,
                fontWeight: FontWeight.w600,
              ),
              decoration: InputDecoration(
                isDense: true,
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.85),
                border: OutlineInputBorder(
                  borderSide: BorderSide(color: widget.color),
                  borderRadius: BorderRadius.circular(4),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 4,
                ),
                hintText: 'Label…',
              ),
              onSubmitted: (_) => _submit(),
            ),
          ),
        ),
      ),
    );
  }
}
