import 'package:flutter/material.dart';

import '../controller/drawing_controller.dart';
import '../controller/tool_type.dart';

/// Top-of-canvas pill toolbar — one slot per [ToolType].
///
/// Mode tools (line, arrow, etc.) flip [DrawingController.currentTool].
/// Action tools (zoom, rotate, undo, redo) fire callbacks on the parent
/// `ChartAnnotator` because they touch the `TransformationController` and
/// undo stack — neither of which the toolbar owns directly.
class ChartAnnotatorToolbar extends StatelessWidget {
  const ChartAnnotatorToolbar({
    super.key,
    required this.controller,
    required this.enabledTools,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onRotate,
    this.axis = Axis.vertical,
    this.padding = const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
  });

  final DrawingController controller;
  final Set<ToolType> enabledTools;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final VoidCallback onRotate;
  final Axis axis;
  final EdgeInsets padding;

  static const _ordered = <ToolType>[
    ToolType.select,
    ToolType.pan,
    ToolType.point,
    ToolType.line,
    ToolType.arrow,
    ToolType.ellipse,
    ToolType.text,
    ToolType.distance,
    ToolType.angle,
    ToolType.perpendicular,
    ToolType.crosshair,
    ToolType.zoomIn,
    ToolType.zoomOut,
    ToolType.rotate90,
    ToolType.undo,
    ToolType.redo,
  ];

  @override
  Widget build(BuildContext context) {
    final tools = _ordered.where(enabledTools.contains).toList();
    final children = <Widget>[
      for (final tool in tools) ...[
        if (tool == ToolType.zoomIn || tool == ToolType.undo)
          _Divider(axis: axis),
        _ToolButton(
          tool: tool,
          controller: controller,
          onZoomIn: onZoomIn,
          onZoomOut: onZoomOut,
          onRotate: onRotate,
        ),
      ],
    ];
    return Material(
      elevation: 12,
      borderRadius: BorderRadius.circular(28),
      color: const Color(0xF21B1F26),
      shadowColor: Colors.black,
      child: Padding(
        padding: padding,
        child: SingleChildScrollView(
          scrollDirection: axis,
          child: axis == Axis.vertical
              ? Column(mainAxisSize: MainAxisSize.min, children: children)
              : Row(mainAxisSize: MainAxisSize.min, children: children),
        ),
      ),
    );
  }
}

class _ToolButton extends StatelessWidget {
  const _ToolButton({
    required this.tool,
    required this.controller,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onRotate,
  });

  final ToolType tool;
  final DrawingController controller;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final VoidCallback onRotate;

  @override
  Widget build(BuildContext context) {
    final icon = _iconFor(tool);

    if (tool == ToolType.undo) {
      return ValueListenableBuilder<bool>(
        valueListenable: controller.canUndo,
        builder: (_, enabled, __) => _IconBtn(
          icon: icon,
          tooltip: 'Undo',
          onTap: enabled ? controller.undo : null,
          active: false,
        ),
      );
    }
    if (tool == ToolType.redo) {
      return ValueListenableBuilder<bool>(
        valueListenable: controller.canRedo,
        builder: (_, enabled, __) => _IconBtn(
          icon: icon,
          tooltip: 'Redo',
          onTap: enabled ? controller.redo : null,
          active: false,
        ),
      );
    }
    if (tool.isAction) {
      final VoidCallback handler = switch (tool) {
        ToolType.zoomIn => onZoomIn,
        ToolType.zoomOut => onZoomOut,
        ToolType.rotate90 => onRotate,
        _ => () {},
      };
      return _IconBtn(
        icon: icon,
        tooltip: _label(tool),
        onTap: handler,
        active: false,
      );
    }

    // Mode tools
    return ValueListenableBuilder<ToolType>(
      valueListenable: controller.currentTool,
      builder: (_, current, __) => _IconBtn(
        icon: icon,
        tooltip: _label(tool),
        onTap: () => controller.currentTool.value = tool,
        active: current == tool,
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  const _IconBtn({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    required this.active,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF3DA9FC);
    final disabled = onTap == null;
    final bg = active ? accent.withValues(alpha: 0.20) : Colors.transparent;
    final fg = disabled ? Colors.white24 : (active ? accent : Colors.white);
    return Tooltip(
      message: tooltip,
      child: InkResponse(
        onTap: onTap,
        radius: 24,
        child: Container(
          width: 40,
          height: 40,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: fg, size: 20),
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider({required this.axis});

  final Axis axis;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: axis == Axis.vertical ? 24 : 1,
      height: axis == Axis.vertical ? 1 : 24,
      margin: axis == Axis.vertical
          ? const EdgeInsets.symmetric(vertical: 6)
          : const EdgeInsets.symmetric(horizontal: 6),
      color: Colors.white24,
    );
  }
}

String _label(ToolType t) => switch (t) {
  ToolType.select => 'Select',
  ToolType.pan => 'Pan',
  ToolType.line => 'Line',
  ToolType.arrow => 'Arrow',
  ToolType.point => 'Point',
  ToolType.ellipse => 'Ellipse',
  ToolType.text => 'Text',
  ToolType.distance => 'Measure distance',
  ToolType.angle => 'Measure angle',
  ToolType.perpendicular => 'Perpendicular line',
  ToolType.crosshair => 'Crosshair',
  ToolType.zoomIn => 'Zoom in',
  ToolType.zoomOut => 'Zoom out',
  ToolType.rotate90 => 'Rotate 90°',
  ToolType.undo => 'Undo',
  ToolType.redo => 'Redo',
};

IconData _iconFor(ToolType t) => switch (t) {
  ToolType.select => Icons.near_me_outlined,
  ToolType.pan => Icons.pan_tool_alt_outlined,
  ToolType.line => Icons.show_chart,
  ToolType.arrow => Icons.north_east,
  ToolType.point => Icons.fiber_manual_record,
  ToolType.ellipse => Icons.circle_outlined,
  ToolType.text => Icons.text_fields,
  ToolType.distance => Icons.straighten,
  ToolType.angle => Icons.architecture,
  ToolType.perpendicular => Icons.square_foot,
  ToolType.crosshair => Icons.center_focus_strong_outlined,
  ToolType.zoomIn => Icons.add,
  ToolType.zoomOut => Icons.remove,
  ToolType.rotate90 => Icons.rotate_right,
  ToolType.undo => Icons.undo,
  ToolType.redo => Icons.redo,
};
