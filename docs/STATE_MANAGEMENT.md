# AloMedia — State Management

The entire editor state lives in a single Zustand store defined in `src/store/editorStore.ts`. This document explains what the store contains, how state mutations are organized, and how the undo/redo history system works.

---

## Store Shape

The store is split into two groups of state:

### Serializable Project State (`EditorState`)

Defined in `src/project/projectTypes.ts` and owned by the store. This is the part of the state that can be saved to disk or snapshotted for undo/redo.

| Field | Type | Description |
|---|---|---|
| `project` | `Project` | The complete timeline: tracks, clips, and media catalog |
| `playhead` | `number` | Current time position in seconds |
| `timelineScale` | `number` | Pixels per second (zoom level, default 10) |
| `isPlaying` | `boolean` | Whether the player is actively playing |
| `selectedClipId` | `string?` | Currently selected clip |
| `selectedTrackId` | `string?` | Currently selected track |
| `history` | `HistoryEntry[]` | Stack of past project snapshots |
| `historyIndex` | `number` | Pointer into `history`; -1 means "no history" |

### Non-serializable Runtime State

Additional store fields that exist only in memory and are not persisted:

| Field | Type | Description |
|---|---|---|
| `clipboard` | `Clip \| null` | Copy/paste buffer (a single clip) |
| `proxyMap` | `Record<string, ProxyState>` | Per-`mediaId` proxy generation status and resulting object URL |

### Module-Level File Map

A `Map<string, File>` stored at module level (outside the Zustand store) maps each `mediaId` to its raw `File` object. This is intentionally non-reactive to avoid triggering re-renders when large binary objects are registered. Both the player and the engine read from this map directly.

---

## Action Categories

### Media Actions

**`addMedia(file)`** — The primary import action. It computes a SHA-256 hash of the file to detect duplicates, reads the duration via a temporary `<video>` or `<audio>` element, and registers the `Media` entry in the project catalog and the `File` in `fileMap`. If a file with the same hash already exists, the import is silently ignored.

### Clip Actions

All clip mutation actions follow the same pattern: push a history snapshot, then mutate the project.

- **`addClip(clip)`** — Appends a clip to its target track.
- **`removeClip(clipId)`** — Removes a clip and triggers a player reset.
- **`moveClip(clipId, trackId, newStart)`** — Repositions a clip, recalculating `timelineEnd` to preserve the clip's duration.
- **`splitClip(clipId, time)`** — Splits a clip at the given time into two adjacent clips, splitting the source media range proportionally.
- **`resizeClip(clipId, newEnd)`** — Modifies only `timelineEnd`, without changing the source media range.
- **`copyClip` / `pasteClip`** — Shallow-copies the selected clip into the clipboard and pastes it offset by a small time delta.

### Transform Actions

Transform updates are split into two phases to avoid polluting the undo history with every intermediate drag position:

- **`updateClipTransform(clipId, transform)`** — Applies the transform immediately for live preview without writing to history.
- **`commitTransform(clipId)`** — Called on `mouseup`; pushes a single history entry representing the completed drag.

### Color & Audio Actions

- **`updateClipColorAdjustments(clipId, adjustments)`** — Applies color grading parameters and pushes history. Intentionally does **not** trigger a player reset, since color changes are applied in the render layer and do not invalidate the video buffer state.
- **`updateClipAudioConfig(clipId, config)`** — Applies audio parameters and pushes history.

### Speed Action

**`setClipSpeed(clipId, speed)`** — Clamps the speed to `[0.1, 5.0]`, recalculates `timelineEnd` based on `(mediaEnd - mediaStart) / speed`, and clamps against the next clip's start to avoid overlaps. Triggers a player reset.

### Track Actions

- **`addTrack(type)`** — Inserts a new track at the correct position (video tracks before audio tracks, determined by `getInsertionIndex`).
- **`removeTrack(trackId)`** — Removes the track and all its clips, then triggers a player reset.
- **`reorderTrack(trackId, direction)`** — Swaps `order` values between adjacent tracks.

### Project Actions

- **`setProjectName(name)`** — Updates the project title.
- **`loadProject(saved)`** — Replaces the entire store state with a deserialized `SavedProject`. Clears history.

---

## Undo / Redo

The undo/redo system works by storing **deep-clone snapshots** of the `project` object. Snapshots are taken via `JSON.parse(JSON.stringify(project))` before any destructive operation.

**`pushHistory(description)`** — Called at the start of every mutating action. It:
1. Deep-clones the current `project`.
2. Trims any redo history ahead of `historyIndex`.
3. Appends a `HistoryEntry` with the snapshot and a human-readable description.
4. Caps the history stack at 50 entries to limit memory usage.

**`undo()`** — Restores `project` from `history[historyIndex - 1]` and decrements `historyIndex`.

**`redo()`** — Restores `project` from `history[historyIndex + 1]` and increments `historyIndex`.

The `clipboard`, `proxyMap`, `fileMap`, and playback state (`playhead`, `isPlaying`) are not part of the history and are not affected by undo/redo.

---

## Player Reset Pattern

Many store actions call `resetPlayer()` after mutating state. This function (exposed from `usePlayer`) is called to tear down the video buffer state whenever a structural change makes the current buffers stale — for example, when a clip is moved, removed, or has its speed changed.

`resetPlayer()` does the following:
1. Pauses playback.
2. Releases all double-buffer video slots.
3. Disconnects all Web Audio API nodes.
4. Sets a reinitialization flag so the next frame re-establishes the buffer state.

Actions that modify only rendering parameters (color adjustments) do **not** call `resetPlayer()` since the underlying video elements remain valid.

---

## Proxy State

The `proxyMap` field tracks the status of background proxy generation for each video media item.

```
ProxyState = {
  status: "pending" | "ready" | "error"
  url?: string    // object URL of the 360p proxy file (when status = "ready")
}
```

The proxy engine (`src/engine/proxyEngine.ts`) writes to `proxyMap` via `setProxyReady` and `setProxyError` store actions when transcoding completes or fails. The player reads `proxyMap` through `ObjectUrlRegistry.getPlaybackUrl()` to decide whether to use the proxy or the original file.
