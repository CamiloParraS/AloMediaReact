# AloMedia — Hooks & Utilities

This document covers the custom React hooks and pure utility modules used across the editor.

---

## Hooks

### `usePlayer` — Playback Transport

**Location**: `src/hooks/usePlayer.ts`

The central playback hook. Exposes transport methods (play, pause, seek) and manages the `requestAnimationFrame` loop that drives the player layer. See [PLAYER.md](PLAYER.md) for a detailed description of the loop mechanics.

Key exports:
- `play()` — starts the RAF loop
- `pause()` — stops the loop and syncs the store
- `seek(time)` — jumps the playhead
- `resetPlayer()` — tears down buffer state after structural edits
- `isPlayingRef` — a live ref to playback state (used by `useMediaSync` without subscribing to store)
- `playheadRef` — a live ref to the current time (used by `useMediaSync` for frame-accurate reads)

### `useTimeline` — Timeline Interaction Logic

**Location**: `src/hooks/useTimeline.ts`

Encapsulates the geometry and collision logic for the timeline. Consumed by `Timeline` and `Track` components.

| Function | Description |
|---|---|
| `xToTime(px)` | Converts a pixel offset to a time in seconds using `timelineScale` |
| `hasCollision(trackId, start, end, excludeClipId?)` | Returns true if the given time range overlaps any existing clip on the track |
| `snapToNeighbor(trackId, rawStart, duration, excludeClipId?)` | Returns a snapped start time if `rawStart` is within the snap threshold of a neighboring clip edge |
| `resolveDropPosition(trackId, rawStart, duration, excludeClipId?)` | Full drop resolution: tries snap first; if the result overlaps, finds the nearest non-colliding position on either side of the obstacle |
| `dragOverTrackId` / `setDragOverTrack` | Controlled state for drag visual feedback (which track is currently the drag target) |

### `useAuth` — Authentication Context

**Location**: `src/hooks/useAuth.ts`

A simple convenience hook that reads `AuthContext` and throws a descriptive error if called outside `<AuthProvider>`. Returns the full `AuthContextType` (user, isAuthenticated, isLoading, login, logout).

---

## Utility Modules

### `time.ts` — Time & Layout Math

**Location**: `src/utils/time.ts`

The foundation for all time/position conversions used throughout the timeline and player.

| Export | Description |
|---|---|
| `TRACK_HEADER_WIDTH` | Pixel width of the sticky track header; used for timeline offset calculations |
| `CLIP_EPSILON` | 1 ms tolerance constant for float comparisons |
| `toMs(seconds)` | Normalizes a time value to integer milliseconds: `Math.round(s * 1000)` |
| `toSeconds(ms)` | Converts back: `ms / 1000` |
| `timeToPx(time, scale)` | `time * scale` — converts seconds to pixels at a given zoom level |
| `pxToTime(px, scale)` | `px / scale` — inverse |
| `clientXToTime(clientX, rect, scrollLeft, scale)` | Full conversion from a mouse event X to a timeline time, accounting for header offset and scroll position |
| `formatTimecode(seconds)` | Formats a time value as `HH:MM:SS` for ruler labels |
| `selectGridInterval(pxPerSec)` | Picks the most readable major tick interval from a pre-defined set based on the current zoom level |
| `getProjectDuration(tracks)` | `Math.max(0, ...allClips.map(c => c.timelineEnd))` |

### `clipIndex.ts` — Binary Search Clip Lookup

**Location**: `src/utils/clipIndex.ts`

Provides O(log n) active-clip lookup at runtime, critical for 60 fps playback performance.

`buildClipIndex(tracks)` precomputes a `ClipIndex` by:
1. Collecting all clip `timelineStart` and `timelineEnd` values as a sorted, deduplicated boundary array.
2. Building a segment map where each interval between consecutive boundaries maps to the set of clips active during that interval.

`lookupActiveClips(index, playhead)` binary-searches the boundary array to find the correct segment and returns its clips in O(log n). This is called every animation frame by `useMediaSync`.

### `snapUtils.ts` — Snap Boundaries

**Location**: `src/utils/snapUtils.ts`

- `collectSnapBoundaries(tracks, excludeClipId?)` — returns all clip start and end times as `{ timeSeconds, sourceClipId }` entries, sorted by time.
- `findSnap(candidateTime, boundaries, thresholdSeconds)` — finds the closest boundary within the threshold.

These are used by `useTimeline.snapToNeighbor()` to magnetize clip drops to existing clip edges.

### `tracks.ts` — Track Ordering

**Location**: `src/utils/tracks.ts`

`getInsertionIndex(tracks, type)` — returns the correct index for inserting a new track while maintaining the convention that video tracks precede audio tracks in the list. Video tracks are inserted immediately before the first audio track; audio tracks are appended to the end.

### `id.ts` — ID Generation

**Location**: `src/utils/id.ts`

A single export: `generateId()` → `crypto.randomUUID()`. Used everywhere a new entity (media, track, clip) is created.

### `colorAdjustmentFilters.ts` — Color Filter Builders

**Location**: `src/utils/colorAdjustmentFilters.ts`

Converts `ColorAdjustments` values into filter strings. The module defines non-linear curve functions (e.g. signed-square for brightness, signed-sqrt for contrast) that map the user-facing slider range to perceptually meaningful FFmpeg parameter values.

Key exports:
- `buildEqFilter(adj)` — FFmpeg `eq` filter string for brightness, contrast, saturation, gamma, and exposure.
- `buildShadowFilter(adj)` — FFmpeg `curves` filter string for shadow lift/crush.
- `buildDefinitionFilter(adj)` — FFmpeg `unsharp` filter string for clarity/definition.
- `buildCssFilter(adj)` — CSS `filter` property string for live canvas preview. Note: gamma, shadow, and definition have no CSS equivalents, so the live preview is an approximation only for those parameters.

### `audioFilters.ts` — Audio Filter Builders

**Location**: `src/utils/audioFilters.ts`

Converts `AudioConfig` values into FFmpeg audio filter strings used during final export.

| Function | Produces |
|---|---|
| `buildVolumeFilter` | `volume=X` (or `volume=0` when muted) |
| `buildFadeFilter` | `afade=t=in:...` and/or `afade=t=out:...` |
| `buildBalanceFilter` | `pan=stereo\|c0=...\|c1=...` |
| `buildFullAudioFilterChain` | All applicable filters joined with `,` |

`buildFadeFilter` clamps fade durations when their sum would exceed the clip's duration, preventing malformed FFmpeg arguments.

### `speedFilters.ts` — Speed Filter Builders

**Location**: `src/utils/speedFilters.ts`

- `buildVideoSpeedFilter(speed)` → `setpts=(1/speed)*PTS` (or `null` for 1×)
- `buildAudioSpeedFilter(speed)` → one or more `atempo` filters

`atempo` is limited to `[0.5, 2.0]` by FFmpeg. Speeds outside this range are decomposed: 0.25× becomes `atempo=0.5,atempo=0.5`; 4× becomes `atempo=2.0,atempo=2.0`.

---

## Constants

Constants are centralized in `src/constants/` to avoid magic numbers scattered through the codebase.

| File | Key Constants |
|---|---|
| `timeline.ts` | `MIN/MAX/DEFAULT_PIXELS_PER_SECOND`, `ZOOM_STEP`, `SNAP_THRESHOLD_PX`, `GRID_INTERVALS_SECONDS`, `PRELOAD_LOOKAHEAD_MS = 1500`, `DRIFT_CORRECTION_THRESHOLD_S = 0.25`, `STORE_SYNC_INTERVAL_MS = 100` |
| `audioConfig.ts` | `DEFAULT_AUDIO_CONFIG` — volume 1, not muted, no fades, balance 0 |
| `colorAdjustments.ts` | `DEFAULT_COLOR_ADJUSTMENTS` — all parameters at their neutral/identity values |
| `speed.ts` | `MIN_SPEED = 0.1`, `MAX_SPEED = 5.0`, `DEFAULT_SPEED = 1.0` |

Two of these constants deserve special mention because they directly affect the feel of the editor:

- **`PRELOAD_LOOKAHEAD_MS = 1500`**: How many milliseconds before a clip ends the `VideoBufferManager` starts buffering the next clip. Increasing this gives more time for the browser to load, at the cost of slightly more eager seeks.
- **`DRIFT_CORRECTION_THRESHOLD_S = 0.25`**: The `VideoBufferManager` and `AudioSync` only correct playback drift when it exceeds this value. A smaller threshold produces tighter sync but more frequent seeks (which can stutter). 250 ms is below the perceptual threshold for most content.
