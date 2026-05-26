import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'controller/drawing_controller.dart';
import 'controller/tool_type.dart';
import 'gestures/tool_gesture_router.dart';
import 'layers/active_draft_layer.dart';
import 'layers/committed_layer.dart';
import 'layers/crosshair_layer.dart';
import 'layers/image_layer.dart';
import 'model/annotation.dart';
import 'ui/selection_handles.dart';
import 'ui/text_editor_overlay.dart';
import 'ui/toolbar.dart';

export 'controller/drawing_controller.dart';
export 'controller/tool_type.dart';
export 'model/annotation.dart';
export 'ui/toolbar.dart' show ChartAnnotatorToolbar;

/// Native chart annotator with 16 tools.
///
/// Three-layer rendering (image, committed, draft) inside `RepaintBoundary`s.
/// `InteractiveViewer` owns the transform (pan/zoom). The drawing stack
/// re-applies the same matrix via `Transform`. A `Listener` overlay routes
/// pointer events to per-tool handlers — bypasses `GestureDetector`'s arena
/// to keep drawing latency at zero.
class ChartAnnotator extends StatefulWidget {
  const ChartAnnotator({
    super.key,
    this.imageProvider,
    this.controller,
    this.onAnnotationsChanged,
    this.initialAnnotations = const [],
    this.enabledTools,
    this.strokeColor = const Color(0xFFB22222),
    this.strokeWidth = 2.0,
    this.showToolbar = true,
    this.toolbarPadding = const EdgeInsets.fromLTRB(12, 12, 12, 12),
  });

  final ImageProvider? imageProvider;
  final DrawingController? controller;
  final ValueChanged<List<Annotation>>? onAnnotationsChanged;
  final List<Annotation> initialAnnotations;
  final List<ToolType>? enabledTools;
  final Color strokeColor;
  final double strokeWidth;
  final bool showToolbar;
  final EdgeInsets toolbarPadding;

  @override
  State<ChartAnnotator> createState() => _ChartAnnotatorState();
}

class _ChartAnnotatorState extends State<ChartAnnotator> {
  late final DrawingController _controller;
  late final bool _ownsController;
  late final TransformationController _transform;
  late final TextEditorOverlayController _textOverlay;

  VoidCallback? _committedListener;

  @override
  void initState() {
    super.initState();
    final external = widget.controller;
    if (external != null) {
      _controller = external;
      _ownsController = false;
    } else {
      _controller = DrawingController(
        initialAnnotations: widget.initialAnnotations,
      );
      _ownsController = true;
    }
    _transform = TransformationController();
    _textOverlay = TextEditorOverlayController();
    final callback = widget.onAnnotationsChanged;
    if (callback != null) {
      _committedListener = () => callback(_controller.committed.value);
      _controller.committed.addListener(_committedListener!);
    }
  }

  @override
  void dispose() {
    _textOverlay.dismiss();
    final listener = _committedListener;
    if (listener != null) {
      _controller.committed.removeListener(listener);
    }
    _transform.dispose();
    if (_ownsController) {
      _controller.dispose();
    }
    super.dispose();
  }

  void _zoom(double factor) {
    final m = Matrix4.copy(_transform.value);
    final size = context.size ?? Size.zero;
    final centerX = size.width / 2;
    final centerY = size.height / 2;
    m.translateByDouble(centerX, centerY, 0, 1);
    m.scaleByDouble(factor, factor, 1, 1);
    m.translateByDouble(-centerX, -centerY, 0, 1);
    _transform.value = m;
  }

  void _rotate90() {
    final m = Matrix4.copy(_transform.value);
    final size = context.size ?? Size.zero;
    final centerX = size.width / 2;
    final centerY = size.height / 2;
    m.translateByDouble(centerX, centerY, 0, 1);
    m.rotateZ(math.pi / 2);
    m.translateByDouble(-centerX, -centerY, 0, 1);
    _transform.value = m;
  }

  void _onTextTap(Offset imagePos) {
    _textOverlay.show(
      context: context,
      imagePosition: imagePos,
      transform: _transform.value,
      color: widget.strokeColor,
      fontSize: 16,
      onSubmit: (text) => _submitText(imagePos, text),
      onCancel: _cancelText,
    );
  }

  void _submitText(Offset pos, String text) {
    final annotation = TextAnnotation(
      id: 'text-${DateTime.now().microsecondsSinceEpoch}',
      position: pos,
      text: text,
      color: widget.strokeColor,
    );
    _controller.commit([..._controller.committed.value, annotation]);
  }

  void _cancelText() {
    // Controller already removed the OverlayEntry. Nothing more to do.
  }

  Map<ShortcutActivator, Intent> get _shortcuts => const {
    SingleActivator(LogicalKeyboardKey.keyV): _SelectIntent(),
    SingleActivator(LogicalKeyboardKey.keyL): _LineIntent(),
    SingleActivator(LogicalKeyboardKey.keyO): _EllipseIntent(),
    SingleActivator(LogicalKeyboardKey.keyT): _TextIntent(),
    SingleActivator(LogicalKeyboardKey.keyR): _RotateIntent(),
    SingleActivator(LogicalKeyboardKey.equal): _ZoomInIntent(),
    SingleActivator(LogicalKeyboardKey.add): _ZoomInIntent(),
    SingleActivator(LogicalKeyboardKey.minus): _ZoomOutIntent(),
    SingleActivator(LogicalKeyboardKey.keyZ, control: true): _UndoIntent(),
    SingleActivator(LogicalKeyboardKey.keyZ, meta: true): _UndoIntent(),
    SingleActivator(LogicalKeyboardKey.keyY, control: true): _RedoIntent(),
    SingleActivator(LogicalKeyboardKey.keyZ, control: true, shift: true):
        _RedoIntent(),
    SingleActivator(LogicalKeyboardKey.keyZ, meta: true, shift: true):
        _RedoIntent(),
    SingleActivator(LogicalKeyboardKey.delete): _DeleteIntent(),
    SingleActivator(LogicalKeyboardKey.backspace): _DeleteIntent(),
    SingleActivator(LogicalKeyboardKey.escape): _EscapeIntent(),
  };

  Map<Type, Action<Intent>> get _actions => {
    _SelectIntent: CallbackAction<_SelectIntent>(
      onInvoke: (_) => _controller.currentTool.value = ToolType.select,
    ),
    _LineIntent: CallbackAction<_LineIntent>(
      onInvoke: (_) => _controller.currentTool.value = ToolType.line,
    ),
    _EllipseIntent: CallbackAction<_EllipseIntent>(
      onInvoke: (_) => _controller.currentTool.value = ToolType.ellipse,
    ),
    _TextIntent: CallbackAction<_TextIntent>(
      onInvoke: (_) => _controller.currentTool.value = ToolType.text,
    ),
    _RotateIntent: CallbackAction<_RotateIntent>(
      onInvoke: (_) {
        _rotate90();
        return null;
      },
    ),
    _ZoomInIntent: CallbackAction<_ZoomInIntent>(
      onInvoke: (_) {
        _zoom(1.25);
        return null;
      },
    ),
    _ZoomOutIntent: CallbackAction<_ZoomOutIntent>(
      onInvoke: (_) {
        _zoom(0.8);
        return null;
      },
    ),
    _UndoIntent: CallbackAction<_UndoIntent>(
      onInvoke: (_) {
        _controller.undo();
        return null;
      },
    ),
    _RedoIntent: CallbackAction<_RedoIntent>(
      onInvoke: (_) {
        _controller.redo();
        return null;
      },
    ),
    _DeleteIntent: CallbackAction<_DeleteIntent>(
      onInvoke: (_) {
        _controller.deleteSelected();
        return null;
      },
    ),
    _EscapeIntent: CallbackAction<_EscapeIntent>(
      onInvoke: (_) {
        _controller.activeDraft.value = null;
        _controller.clearSelection();
        return null;
      },
    ),
  };

  @override
  Widget build(BuildContext context) {
    final enabled = (widget.enabledTools ?? ToolType.values).toSet();
    return Shortcuts(
      shortcuts: _shortcuts,
      child: Actions(
        actions: _actions,
        child: Focus(
          autofocus: true,
          child: ValueListenableBuilder<ToolType>(
            valueListenable: _controller.currentTool,
            builder: (_, tool, __) {
              final isPan = tool == ToolType.pan;
              return Stack(
                fit: StackFit.expand,
                children: [
                  // Layer 1 + transform owner: InteractiveViewer wraps image.
                  InteractiveViewer(
                    transformationController: _transform,
                    panEnabled: isPan,
                    scaleEnabled: true,
                    minScale: 0.5,
                    maxScale: 8,
                    boundaryMargin: const EdgeInsets.all(double.infinity),
                    child: Center(
                      child: RepaintBoundary(
                        child: ImageLayer(imageProvider: widget.imageProvider),
                      ),
                    ),
                  ),
                  // Layer 2 + 3 + crosshair share the same matrix.
                  IgnorePointer(
                    child: ValueListenableBuilder<Matrix4>(
                      valueListenable: _transform,
                      builder: (_, matrix, __) => Transform(
                        transform: matrix,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            RepaintBoundary(
                              child: CommittedLayer(controller: _controller),
                            ),
                            RepaintBoundary(
                              child: ActiveDraftLayer(controller: _controller),
                            ),
                            RepaintBoundary(
                              child: CrosshairLayer(
                                controller: _controller,
                                imageSize: Size.zero,
                                color: widget.strokeColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Selection handles in screen space.
                  IgnorePointer(
                    child: SelectionHandles(
                      controller: _controller,
                      transformationController: _transform,
                    ),
                  ),
                  // Gesture router — IgnorePointer when pan tool active so
                  // InteractiveViewer below catches the drag.
                  IgnorePointer(
                    ignoring: isPan,
                    child: ToolGestureRouter(
                      controller: _controller,
                      transformationController: _transform,
                      onTextTap: _onTextTap,
                    ),
                  ),
                  // Text overlay is rendered via OverlayEntry by
                  // _textOverlay.show(...) — no inline widget in the Stack.
                  // Toolbar — vertical pill anchored to the right edge.
                  if (widget.showToolbar)
                    Positioned(
                      top: widget.toolbarPadding.top,
                      bottom: widget.toolbarPadding.bottom,
                      right: widget.toolbarPadding.right,
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: ChartAnnotatorToolbar(
                          controller: _controller,
                          enabledTools: enabled,
                          axis: Axis.vertical,
                          onZoomIn: () => _zoom(1.25),
                          onZoomOut: () => _zoom(0.8),
                          onRotate: _rotate90,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Serialises [annotations] to a JSON string. Round-trip safe with
/// [importFromJson].
String exportToJson(List<Annotation> annotations) =>
    jsonEncode(annotations.map((a) => a.toJson()).toList());

/// Inverse of [exportToJson].
List<Annotation> importFromJson(String json) {
  final list = jsonDecode(json) as List<dynamic>;
  return list
      .map((e) => annotationFromJson(e as Map<String, dynamic>))
      .toList(growable: false);
}

class _SelectIntent extends Intent {
  const _SelectIntent();
}

class _LineIntent extends Intent {
  const _LineIntent();
}

class _EllipseIntent extends Intent {
  const _EllipseIntent();
}

class _TextIntent extends Intent {
  const _TextIntent();
}

class _RotateIntent extends Intent {
  const _RotateIntent();
}

class _ZoomInIntent extends Intent {
  const _ZoomInIntent();
}

class _ZoomOutIntent extends Intent {
  const _ZoomOutIntent();
}

class _UndoIntent extends Intent {
  const _UndoIntent();
}

class _RedoIntent extends Intent {
  const _RedoIntent();
}

class _DeleteIntent extends Intent {
  const _DeleteIntent();
}

class _EscapeIntent extends Intent {
  const _EscapeIntent();
}
