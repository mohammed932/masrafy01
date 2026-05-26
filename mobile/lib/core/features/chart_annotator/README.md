# chart_annotator

Native Flutter canvas-annotation widget. Drop-in `ChartAnnotator` over any `ImageProvider`. 16 tools (draw / measure / select / pan / zoom / rotate / undo / redo). Zero third-party deps beyond Flutter SDK.

## Usage

```dart
ChartAnnotator(
  imageProvider: NetworkImage(signedUrl),
  strokeColor: const Color(0xFFB22222),
  strokeWidth: 2.0,
  onAnnotationsChanged: (annotations) {
    // fires on every commit / undo / redo
  },
);
```

Optional: inject an external `DrawingController` to drive the canvas from outside (e.g. share-sheet sync, replay tools).

## Tools

| Group | Tools |
|---|---|
| **Draw** | Line, Arrow, Point, Ellipse, Text |
| **Measure** | Distance, Angle, Perpendicular |
| **Transient** | Crosshair |
| **Select / nav** | Select (V), Pan, Zoom In/Out, Rotate 90° |
| **History** | Undo (Cmd+Z), Redo (Cmd+Shift+Z) |

## Architecture

```
Stack:
├── InteractiveViewer  → owns the TransformationController + image
├── Transformed Stack
│   ├── CommittedLayer  → repaints on commit/undo/redo
│   ├── ActiveDraftLayer → repaints per pointer-move frame
│   └── CrosshairLayer  → transient, hover- or touch-driven
├── SelectionHandles   → 8 handles around the selected annotation
└── ToolGestureRouter  → Listener-based; dispatches to per-tool handlers
```

Each paint layer is wrapped in `RepaintBoundary` so a draft-frame change repaints only the active-draft layer.

## State

- All reactive state on `DrawingController` is `ValueNotifier`. No `setState` inside pointer handlers.
- Annotations are stored in **image space**. Handlers convert via `screenToImage(localPosition, transform)` before writing.
- Undo / redo via `UndoStack` — immutable `List.unmodifiable` snapshots, 50-entry cap, push-after-undo drops the redo branch.
- Sealed `Annotation` library — every concrete subclass lives in `model/annotations/*.dart` as a `part of '../annotation.dart'` file.

## Gestures

Spec §3.4: `Listener` (zero-latency) on the drawing surface — NOT `GestureDetector`.
Spec §3.5: `InteractiveViewer.panEnabled = currentTool == ToolType.pan`. When any drawing tool is active, an `IgnorePointer` over the `ToolGestureRouter` is _disabled_, so pointer events go to the handler; when Pan is active, `IgnorePointer.ignoring = true` and events fall through to `InteractiveViewer`.

## Performance

- `Paint` objects cached as `static final` in `util/paint_cache.dart` — never constructed inside `paint()`.
- `Image` decoded at viewport DPR via `ResizeImage`.
- `shouldRepaint` returns `false` via `identical()` checks on the annotations list.
- Impeller enabled via `<meta-data android:name="io.flutter.embedding.android.EnableImpeller" android:value="true" />` in `AndroidManifest.xml`.

## JSON

```dart
final json = exportToJson(annotations);   // String
final restored = importFromJson(json);    // List<Annotation>
```

Discriminator field is `"type"`; every concrete annotation declares a static `kType` constant matching its tag.

## Files

```
chart_annotator/
├── chart_annotator.dart                  ← public widget + JSON helpers
├── controller/
│   ├── drawing_controller.dart           ← every ValueNotifier
│   ├── undo_stack.dart                   ← immutable snapshot history
│   └── tool_type.dart                    ← 16-slot enum + isModeTool / isAction
├── model/
│   ├── annotation.dart                   ← sealed library + remap helpers
│   └── annotations/                      ← 8 part files, one per type
├── layers/
│   ├── image_layer.dart
│   ├── committed_layer.dart
│   ├── active_draft_layer.dart
│   └── crosshair_layer.dart
├── gestures/
│   ├── tool_gesture_router.dart
│   └── handlers/                         ← one ToolHandler per mode tool
├── ui/
│   ├── toolbar.dart                      ← vertical pill toolbar
│   ├── selection_handles.dart
│   └── text_editor_overlay.dart          ← OverlayEntry-based text input
└── util/
    ├── coordinate_transform.dart
    ├── geometry.dart                     ← angle, perpendicular foot, distance
    └── paint_cache.dart
```

## Tests

```
test/chart_annotator/
├── undo_stack_test.dart           ← 8 assertions
├── geometry_test.dart             ← 10 assertions
└── chart_annotator_smoke_test.dart ← 3 widget assertions
```

Run: `fvm flutter test test/chart_annotator/`.
