/// Identifies every toolbar slot in the chart annotator.
///
/// Splits conceptually into three groups, encoded by [isModeTool],
/// [isTransient], and [isAction]:
///
/// - **Mode tools** flip [DrawingController.currentTool] and stay sticky until
///   another tool is picked: [select], [pan], [line], [arrow], [point],
///   [ellipse], [text], [angle], [distance], [perpendicular].
/// - **Transient mode**: [crosshair] — sticky like a mode tool but commits no
///   annotation.
/// - **Actions** fire once on tap and do NOT change `currentTool`: [zoomIn],
///   [zoomOut], [rotate90], [undo], [redo].
enum ToolType {
  select,
  pan,
  line,
  arrow,
  point,
  ellipse,
  text,
  angle,
  distance,
  perpendicular,
  crosshair,
  zoomIn,
  zoomOut,
  rotate90,
  undo,
  redo;

  bool get isModeTool => switch (this) {
    ToolType.select ||
    ToolType.pan ||
    ToolType.line ||
    ToolType.arrow ||
    ToolType.point ||
    ToolType.ellipse ||
    ToolType.text ||
    ToolType.angle ||
    ToolType.distance ||
    ToolType.perpendicular => true,
    _ => false,
  };

  bool get isTransient => this == ToolType.crosshair;

  bool get isAction => switch (this) {
    ToolType.zoomIn ||
    ToolType.zoomOut ||
    ToolType.rotate90 ||
    ToolType.undo ||
    ToolType.redo => true,
    _ => false,
  };
}
