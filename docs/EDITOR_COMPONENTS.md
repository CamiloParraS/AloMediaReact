# AloMedia — Editor Components

This document covers the UI components that make up the video editor interface, located in `src/components/editor/`. Each section describes what a component is responsible for and how it integrates with the store and player layers.

---

## VideoEditor — Root Layout

**Location**: `src/pages/editor/VideoEditor.tsx`

The top-level page for the editor. It is a full-screen flex column that composes all editor panels:

- **Top bar**: Project title (editable on double-click), and action buttons — Load, Save, Export, and Share.
- **Middle row**: `MediaLibrary` (left, fixed width), `PreviewPlayer` (center, flexible), `InspectorPanel` (right, shown only when a clip is selected).
- **Toolbar**: Sits below the middle row.
- **Timeline**: Fixed height at the bottom.

The Export action triggers the full render pipeline: calls `buildRenderJob()` to create a `RenderJob` from the current project state, passes it to `renderJob()` (FFmpeg engine), and initiates a browser download of the resulting MP4.

---

## PreviewPlayer — Canvas & Transport

**Location**: `src/components/editor/PreviewPlayer.tsx`

The main preview area. It combines the canvas (a composited stack of DOM media elements) with transport controls.

**Canvas layer**: The preview is not a literal `<canvas>` element. It is a fixed `1280×720` `div` (scaled to fit the panel via `ResizeObserver`) that contains:
- Two hidden `<video>` elements sharing the double-buffer for the primary video track.
- One `<video>` element per additional active video clip (for multi-track compositing).
- `<img>` elements for image clips.
- `<div>` elements for text clips.

Each visual element is positioned absolutely using `applyTransformToEl()`, and color filters are applied via `applyColorAdjustmentsToEl()`. Both functions write directly to DOM style properties, bypassing React diffing for performance. Z-index values are derived from track `order`: lower order (foreground track) receives a higher z-index.

**Canvas click handling**: Clicking the preview hit-tests the click coordinates against all active clip transform rectangles (scaled from canvas to preview dimensions), selecting the topmost matching clip.

**Transport controls** (via `usePlayer`): Skip to start, rewind 5 s, play/pause, forward 5 s, skip to end, mute toggle, and a volume slider.

**`TransformOverlay`**: Rendered as an SVG on top of the canvas when a video/image clip is selected, providing drag/resize/rotate handles.

---

## Timeline

**Location**: `src/components/editor/Timeline.tsx`

The scrollable horizontal timeline container. Key responsibilities:

- **Zoom**: `Ctrl + Wheel` updates `timelineScale` in the store (clamped to `[MIN, MAX]` pixels per second).
- **Ruler**: Renders `PlayheadBar` at the top of the timeline area.
- **Grid lines**: Major time intervals are drawn as vertical lines based on the current `timelineScale`.
- **Playhead needle**: A red vertical line at the current `playhead` position.
- **Tracks**: Renders one `Track` component per track, sorted by `order`.
- **Media drop**: Handles drag-and-drop of `mediaId` tokens from `MediaLibrary`. Uses `resolveDropPosition` to find a non-colliding start time, creates a new clip, and dispatches `addClip`.
- **Clip move**: Handles drag-and-drop of `clipId` tokens from `Clip` components. Moves the clip to the new track and time via `moveClip`.

---

## Track

**Location**: `src/components/editor/Track.tsx`

A single track row, split into two zones:

**Left header** (sticky): Contains a drag handle (for track reorder), the track label ("Video", "Audio 2", etc.), visibility toggle, lock toggle, and a delete button. The delete button is only shown if more than one track of that type exists.

**Clip area**: An absolutely positioned container scaled to `projectDuration * timelineScale` in width. Renders a `Clip` component for each clip on the track.

**Drag handling**: Accepts three drag token types:
- `mediaId` — new clip from the media library.
- `clipId` — existing clip being moved.
- `reorderTrackId` — another track's header being dragged to reorder.

A **snap indicator** (a vertical line) is shown at `resolveDropPosition` during a drag hover to give the user visual feedback about where a clip will land.

---

## Clip

**Location**: `src/components/editor/Clip.tsx`

The rectangle representing a single clip on the timeline.

**Positioning**: Absolutely positioned. `left = timeToPx(timelineStart)`, `width = timeToPx(timelineEnd - timelineStart)`.

**Visual style**: Video clips use an indigo/purple color scheme; audio clips use green. The selected clip has a brighter border.

**Drag**: The clip sets `clipId` and `clipOffsetX` (the horizontal offset within the clip where the drag started) in `dataTransfer`, enabling `Timeline` to calculate the exact drop target time.

**Resize handle**: A thin right-edge handle. On `mousedown + mousemove`, it calls `resizeClip` on each frame to give live feedback. On `mouseup`, a history entry is pushed.

**Context menu** (right-click):
- Split at Playhead
- Copy `→` clipboard
- Delete
- Extract Audio (video clips only — creates a linked `AudioClip` on a new audio track)

---

## PlayheadBar — Time Ruler

**Location**: `src/components/editor/PlayheadBar.tsx`

The ruler at the top of the timeline. Renders:
- **Major ticks**: Evenly spaced at an interval chosen by `selectGridInterval()` (adapts to the current zoom level). Each major tick shows a time label in `HH:MM:SS` format.
- **Minor ticks**: 4 subdivisions between each major tick.
- **Playhead handle**: A red circle at the current playhead position.

Clicking or dragging on the ruler calls `seek()`, allowing the user to jump the playhead to any position.

---

## Toolbar

**Location**: `src/components/editor/Toolbar.tsx`

A compact horizontal bar between the preview and the timeline. Organized into groups:

| Group | Actions |
|---|---|
| Edit | Scissors (split at playhead), Copy, Paste |
| History | Undo, Redo |
| Zoom | Zoom In, Zoom Out, Fit |
| Snap | Toggle snap-to-neighbor (magnet icon) |
| Tracks | + Video Track, + Audio Track |

All actions dispatch directly to the store or call `usePlayer` methods. The snap toggle is a local UI state; the underlying snap logic in `useTimeline` applies it automatically during drag operations.

---

## MediaLibrary — Import Panel

**Location**: `src/components/editor/MediaLibrary.tsx`

The left panel for importing and managing media files.

**Import**: A native file input accepts `video/*`, `audio/*`, and `image/*` files (multiple selection). On file selection, `addMedia()` is called for each file, and `generateProxy()` is called immediately for video files to start background transcoding.

**Grid**: Renders a two-column grid of `MediaCard` components. While a file is being processed, a `LoadingCard` (spinner) is shown in its place.

**Double-click to insert**: Double-clicking a media card calls `insertMediaAtPlayhead`, which places the clip at the current playhead on the first compatible track that has no collision at that time (creating a new track if needed).

**Drag**: Each card is draggable. It sets `mediaId` and `clipDuration` in `dataTransfer` so that `Track` and `Timeline` can create a correctly-sized clip on drop.

---

## MediaCard — Thumbnail

**Location**: `src/components/editor/MediaCard.tsx`

A square card showing a preview thumbnail for a media item:
- **Video**: A `<video>` element seeked to frame 0 as a static thumbnail.
- **Image**: A standard `<img>`.
- **Audio**: An SVG waveform icon (no visual thumbnail).

The bottom strip shows the filename and duration. Status badges appear for proxy generation: `proxy…` while transcoding, `!` on error.

`LoadingCard` is a companion component shown in the library grid while a file is being processed (before the `Media` entry is fully registered).

---

## InspectorPanel — Clip Properties

**Location**: `src/components/editor/InspectorPanel.tsx`

The right panel, visible only when a video, image, or audio clip is selected. Uses a tab layout:

| Tab | Available for | Content |
|---|---|---|
| Video | Video clips, Image clips | `ColorAdjustmentsPanel` |
| Audio | Video clips, Audio clips | `AudioConfigPanel` |
| Speed | Video clips, Audio clips | Logarithmic speed slider (0.1× – 5×) |

The speed slider uses a log-scale mapping so that 1× (normal speed) sits slightly right of center, giving more resolution to slow-motion values (which are perceptually more useful than extreme fast-forward). A reset button restores the default speed of 1×.

---

## ColorAdjustmentsPanel

**Location**: `src/components/editor/ColorAdjustmentsPanel.tsx`

Seven labeled sliders for per-clip color grading: Brightness, Contrast, Saturation, Gamma, Exposure, Shadow, and Definition. Each slider has a numeric readout and a reset button (`RotateCcw` icon).

Changes are dispatched via `updateClipColorAdjustments` on every slider movement, providing **live preview** in the canvas (applied as a CSS filter chain). The full adjustment range, including gamma correction, shadow curves, and definition (unsharp mask), is only reproduced accurately in the final FFmpeg export.

---

## AudioConfigPanel

**Location**: `src/components/editor/AudioConfigPanel.tsx`

Controls for per-clip audio processing:

| Control | Range | Notes |
|---|---|---|
| Mute toggle | on/off | Disables all audio for this clip |
| Volume | 0 – 200% | Values above 100% use a Web Audio GainNode |
| Fade In | 0 – clip duration | Seconds of fade from silence at clip start |
| Fade Out | 0 – clip duration | Seconds of fade to silence at clip end |
| Balance | −1 to +1 | Stereo pan; displayed as `L`, `C`, or `R` |

When muted, the volume slider is visually disabled. Changes are dispatched via `updateClipAudioConfig`.

---

## TransformOverlay

**Location**: `src/components/editor/TransformOverlay.tsx`

An SVG overlay rendered at preview coordinates over the selected video or image clip. Provides interactive drag handles for:

- **Move**: Drag the main bounding box.
- **Resize**: Four corner handles. Each handle adjusts the opposite anchor corner and updates `width`/`height` to maintain the opposite anchor position.
- **Rotate**: A handle protruding above the top-center of the bounding box.

All coordinates are transformed between display space (scaled by `previewWidth / 1280` and `previewHeight / 720`) and canvas space (1280×720). Live drag updates call `onUpdate` without pushing history; `onCommit` on `mouseup` pushes a single history entry via `commitTransform`.
