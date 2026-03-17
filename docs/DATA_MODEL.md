# AloMedia — Data Model

The entire editable state of a project — tracks, clips, media catalog — is represented by a tree of plain TypeScript objects defined in `src/project/projectTypes.ts`. This document describes those types, their relationships, and the conventions they rely on.

---

## Project Tree

```
Project
├── id: string
├── name: string
├── media: Media[]          ← imported files (metadata only)
└── tracks: Track[]
        └── clips: Clip[]   ← positions on the timeline
```

A `Project` object is fully serializable to JSON. The actual binary `File` objects for each media item are stored separately in a module-level map inside the editor store (`fileMap`) and are never part of the serialized project.

---

## Media

Represents a single imported file. It is created once when the file is imported and is never mutated.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID — primary key used by all clips that reference this file |
| `name` | `string` | Original filename |
| `type` | `MediaType` | `"video"`, `"audio"`, or `"image"` |
| `format` | `string` | File extension (e.g. `"mp4"`, `"png"`) |
| `duration` | `number \| null` | Length in seconds; `null` for images |
| `size` | `number` | File size in bytes |
| `hash` | `string` | SHA-256 of the file content, used to detect duplicates on re-import |

---

## Track

A horizontal lane in the timeline. Tracks are always sorted by `order` for rendering purposes.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID |
| `type` | `TrackType` | `"video"` or `"audio"` |
| `order` | `number` | Z-index priority — lower `order` renders on top (foreground) |
| `clips` | `Clip[]` | The clips placed on this track |

Video tracks are inserted before audio tracks in the track list so they always appear above audio lanes in the timeline UI.

---

## Clips

A clip is a reference from a time interval on the timeline to a portion of a media file. There are four clip variants, all sharing a common base.

### BaseClip

Every clip type extends this:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID — unique per clip |
| `trackId` | `string` | The track this clip belongs to |
| `timelineStart` | `number` | Start position on the timeline (seconds) |
| `timelineEnd` | `number` | End position on the timeline (seconds) |

### VideoClip

References a video file on a video track.

Additional fields: `mediaId`, `mediaStart`, `mediaEnd` (the source range to play), `volume`, `speed` (playback rate, defaults to 1.0), `transform` (`Transform`), `colorAdjustments?` (`ColorAdjustments`), `audioConfig?` (`AudioConfig`).

### AudioClip

References an audio or video file used for its audio on an audio track.

Additional fields: `mediaId`, `mediaStart`, `mediaEnd`, `volume`, `speed?`, `audioConfig?`. No transform (audio is non-visual).

### ImageClip

References an image file. Duration is determined purely by `timelineStart`/`timelineEnd`.

Additional fields: `mediaId`, `transform` (`Transform`), `colorAdjustments?`.

### TextClip

A text card rendered directly on the canvas. Currently reserved for future implementation.

Additional fields: `content: string`, `transform` (`Transform`).

---

## Transform

Describes the position and size of a visual clip on the 1280×720 canvas.

| Field | Description |
|---|---|
| `x`, `y` | Top-left corner position in canvas pixels |
| `width`, `height` | Dimensions in canvas pixels |
| `rotation` | Rotation angle in degrees |

All transform values are in the coordinate space of the internal 1280×720 canvas, regardless of the actual preview window size. The UI scales them for display.

---

## ColorAdjustments

Per-clip color grading parameters. Default values produce a no-op (the image is unchanged).

| Parameter | Default | Notes |
|---|---|---|
| `brightness` | `0` | Signed range; 0 = no change |
| `contrast` | `0` | Signed range; 0 = no change |
| `saturation` | `1` | Multiplier; 1 = no change |
| `gamma` | `1` | Multiplier; 1 = no change |
| `exposure` | `0` | Signed range; 0 = no change |
| `shadow` | `0` | Signed range for shadow lift/crush |
| `definition` | `0` | Controls unsharp mask (clarity) |

These values are interpreted by two separate renderers: a CSS filter chain for the live preview canvas, and FFmpeg video filters (`eq`, `curves`, `unsharp`) for the final export.

---

## AudioConfig

Per-clip audio processing parameters.

| Parameter | Default | Description |
|---|---|---|
| `volume` | `1` | Amplitude multiplier. Values above 1.0 use a Web Audio GainNode |
| `muted` | `false` | Silences the clip entirely |
| `fadeInDuration` | `0` | Seconds of fade-in from silence at the clip start |
| `fadeOutDuration` | `0` | Seconds of fade-out to silence at the clip end |
| `balance` | `0` | Stereo pan: `-1` = full left, `0` = center, `+1` = full right |

---

## Time Representation

All time values are stored as floating-point numbers in **seconds**, but their precision is always clamped to **integer milliseconds** using the `toMs()` / `toSeconds()` helper pair from `src/utils/time.ts`. This prevents floating-point drift from accumulating when the same time value is repeatedly divided (e.g. when adjusting clip speed).

```
timelineEnd = toSeconds(toMs(mediaStart + (mediaEnd - mediaStart) / speed))
```

---

## Project Persistence

The `SavedProject` type wraps a `Project` with metadata for file-based save/load:

| Field | Description |
|---|---|
| `version` | Schema version string for forward compatibility |
| `project` | The full `Project` object |
| `createdAt` | ISO timestamp |
| `updatedAt` | ISO timestamp |

Serialization and deserialization are handled by `src/project/projectSerializer.ts`. Because `fileMap` is not part of `SavedProject`, media files must be re-imported after loading a saved project.

---

## Derived Values

The following values are **never stored** — they are always computed from the project state on demand:

- **Project duration**: `Math.max(0, ...allClips.map(c => c.timelineEnd))`
- **Clip duration** (on the timeline): `timelineEnd - timelineStart`
- **Source duration** (in the media file): `mediaEnd - mediaStart`
- **Effective playback duration** (after speed): `(mediaEnd - mediaStart) / speed`
