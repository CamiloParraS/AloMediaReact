# AloMedia — Player Layer

The player layer is responsible for real-time, frame-accurate media playback inside the preview canvas. It operates independently of React's render cycle — using `requestAnimationFrame` and DOM mutation directly — to achieve 60 fps performance without causing layout thrashing.

---

## Subsystem Overview

```
usePlayer (RAF loop + transport)
    │
    └─► useMediaSync (per-frame orchestrator)
            ├─► VideoBufferManager   (primary video track, double-buffer)
            ├─► secondary <video>    (one per extra video track)
            ├─► AudioPool            (one <audio> element per audio track)
            └─► AudioSync            (per-frame audio drift correction)
```

All subsystems read the current playhead from `playheadRef` — a module-level ref updated by the RAF loop — rather than from the Zustand store. This is the key performance boundary: the store's `playhead` field is only synced every 100 ms for UI updates (timeline scrubber movement).

---

## `usePlayer` — Transport Control

**Location**: `src/hooks/usePlayer.ts`

Provides the transport actions (play, pause, seek) and manages the RAF loop. Two module-level refs are shared between the hook and the rest of the player subsystem:

- **`playheadRef`**: The authoritative current time. Updated on every animation frame during playback.
- **`isPlayingRef`**: Boolean flag. Readable by `useMediaSync` without subscribing to any React state.

**`play()`** — Captures wall-clock time, then starts a RAF loop. Each frame computes the elapsed wall-clock delta, advances `playheadRef`, and calls `onFrameRef.current(playhead)` — a callback set by `PreviewPlayer` that triggers `syncMediaElements`. Every 100 ms, or when the project ends, the store's `playhead` is updated to drive the timeline UI.

**`pause()`** — Cancels the RAF, then does a final store sync so the playhead indicator stops exactly where playback stopped.

**`seek(time)`** — Sets `playheadRef` immediately and synchronizes the store. Also sets a "seek flag" that signals `VideoBufferManager` to perform a hard seek on the video element rather than waiting for natural drift correction.

**`resetPlayer()`** — Called by the store whenever a structural edit makes the current buffer state stale (clip moved, removed, speed changed). Pauses playback, releases video buffers, disconnects all audio Web Audio nodes, and schedules a one-frame reinitialization.

---

## `useMediaSync` — Per-Frame Orchestrator

**Location**: `src/player/hooks/useMediaSync.ts`

Called once from `PreviewPlayer`. Sets up all player subsystems and provides a `syncMediaElements(playhead)` callback that `usePlayer` calls on every animation frame.

**Responsibilities on mount**:
- Builds a `ClipIndex` for O(log n) active-clip lookup.
- Creates a `VideoBufferManager` bound to two `<video>` refs.
- Creates an `ObjectUrlRegistry` for on-demand object URL management.
- Creates the `AudioPool` (one `<audio>` element per audio track).

**Per-frame work** (`syncMediaElements`):
1. Calls `VideoBufferManager.syncVideo()` for the primary video track.
2. Iterates over secondary video tracks: for each active clip on those tracks, manages a corresponding `<video>` element (play/pause, src assignment, drift correction) stored in `secondaryVideoElemsRef`.
3. Calls `syncAudioElements()` for all audio tracks.

When `tracks` changes in the store, `useMediaSync` rebuilds the `ClipIndex` and calls `syncAudioPool` to create or destroy audio elements as needed.

---

## `VideoBufferManager` — Double-Buffer Video

**Location**: `src/player/video/videoBuffer.ts`

Manages exactly two `<video>` elements (`elA` and `elB`). At any given time, one is **active** (visible, `opacity: 1`) and the other is **buffering** (hidden, `opacity: 0`).

**Clip transitions**:
- When the active clip changes, `swapBuffers()` makes the buffering element the new active one. The element that was active becomes the next buffering target.
- 1500 ms before the current clip ends, `prepareBuffer()` loads the next clip into the hidden element silently, so the transition is seamless.

**During playback**: `syncVideo()` calls `videoEl.play()` with the correct `playbackRate`. Drift is corrected only when it exceeds **250 ms** to avoid continuous seeking that would interrupt playback.

**During scrubbing (paused)**: Seeks exactly to `mediaTime` (the offset into the source file corresponding to the current playhead) on every frame. This produces smooth frame-by-frame scrubbing.

Both video elements are always `muted = true`. Audio from video files is handled by the audio pool, not by these elements.

---

## AudioPool — One Element per Track

**Location**: `src/player/audio/audioPool.ts`

Maintains a pool of `<audio>` elements — one per audio track (or video track with audio). Elements are appended to `document.body` with `opacity: 0` (invisible, but active in the DOM for audio processing).

**`syncAudioPool(pool, audioTrackIds)`** — Creates elements for new tracks and removes elements for deleted tracks. Called by `useMediaSync` whenever the track list changes.

**`destroyAudioPool(pool)`** — Pauses and removes all elements. Called on component unmount.

---

## AudioSync — Per-Frame Audio Work

**Location**: `src/player/audio/audioSync.ts`

The `syncAudioElements()` function is called every frame by `useMediaSync`. It:

1. Uses `lookupActiveClips` to find which clips are active at the current playhead on each audio track.
2. **Batch-reads** `currentTime` from all elements before performing any writes (to avoid interleaved reads/writes that can degrade browser performance).
3. Pauses and disconnects elements for clips that have gone out of range.
4. Seeks and starts elements for newly active clips.
5. Applies drift correction (250 ms threshold) and re-applies `AudioConfig` for clips that are already running.

**`applyAudioConfig(el, config, trackId)`** — Chooses the audio processing path based on the config:
- **Native path** (`volume ≤ 1.0`, `balance = 0`): Sets `el.volume` and `el.muted` directly. No Web Audio API overhead.
- **Web Audio path** (`volume > 1.0` or `balance ≠ 0`): Attaches a `GainNode` and a `StereoPannerNode` via the Web Audio API. Contexts and nodes are cached per `trackId` to avoid re-creating them on every frame.

Fade-in and fade-out are applied as FFmpeg `afade` filters during export. The preview uses linear volume interpolation applied by the audio sync system.

---

## ClipIndex — O(log n) Clip Lookup

**Location**: `src/utils/clipIndex.ts` (re-exported from `src/player/timeline/clipLookup.ts`)

During playback, the player needs to know which clips are active at a given time on every frame. A naive linear scan over all clips would be too slow for large projects.

The `ClipIndex` solves this by precomputing a sorted array of all clip boundary times (start and end points) and grouping clips into **segments** between consecutive boundaries. During playback, `lookupActiveClips(index, playhead)` does a binary search over the boundary array to find the right segment in O(log n) time.

The index is rebuilt whenever the track list changes (on mount and on any track/clip edit).

---

## ObjectUrlRegistry — Lazy URL Management

**Location**: `src/player/utils/objectUrlRegistry.ts`

Manages the lifecycle of object URLs created from `File` objects in `fileMap`. Creating object URLs on demand (rather than up front for all files) reduces memory pressure.

- **`getObjectUrl(mediaId)`** — Creates and caches a `URL.createObjectURL` for the given file. Subsequent calls return the cached URL.
- **`getPlaybackUrl(mediaId, proxyMap)`** — Returns the proxy URL when the proxy is ready; falls back to the raw object URL. Note: the raw URL is always used for audio, because proxy files are transcoded without audio (`-an`).
- **`revokeAll()`** — Revokes all registered URLs on unmount, releasing browser memory.

---

## Active Clip Resolution

**Location**: `src/player/timeline/activeClipResolver.ts`

- **`getActiveVideoClip(tracks, playhead)`** — Returns the single "foreground" video clip at the current playhead. Among all active video clips, the one on the track with the lowest `order` number wins (lower order = foreground). Among multiple clips on the same track that overlap the playhead, the latest-starting clip wins.

- **`getActiveVideoClips(tracks, playhead)`** — Returns **all** active video clips across all tracks. Used by `PreviewPlayer` to render secondary tracks simultaneously (multi-track compositing in the canvas).

- **`getNextVideoClip(tracks, currentClip)`** — Finds the first video clip that starts after the current clip ends. Used by `VideoBufferManager.prepareBuffer()` for preloading.

---

## Canvas Rendering

**Location**: `src/components/editor/PreviewPlayer.tsx`

The preview canvas is a `1280×720` `div` (the "inner" container) scaled to fit its parent via a `ResizeObserver` managed by `canvasScaling.ts`. The "canvas" is actually a stack of DOM elements layered with CSS `position: absolute`:

- Two hidden `<video>` elements for the primary track (double-buffer).
- Additional `<video>` elements for secondary video tracks.
- `<img>` elements for image clips.
- `<div>` elements for text clips.

Each visual element is positioned using `applyTransformToEl()`, which directly sets CSS `left`, `top`, `width`, `height`, and `transform: rotate()` on the DOM node without going through React. Color adjustments are applied via `applyColorAdjustmentsToEl()`, which sets the CSS `filter` property directly.

Z-axis stacking is controlled by `zIndex`, computed from track `order` (lower order = higher z-index = foreground).
