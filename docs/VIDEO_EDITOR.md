# Video Editor Documentation

## Overview

The AloMedia video editor is the core feature of the application, providing professional-grade video composition and editing capabilities. It implements a non-destructive editing paradigm where multiple media clips (video, audio, images) are arranged on tracks in a timeline, transformed with effects, and combined into a final output file.

The editor consists of several interconnected systems that work together seamlessly:
- **Timeline Management**: Organizing clips in multi-track layouts
- **Media Library**: Importing and managing source media
- **Preview Player**: Real-time rendering and playback
- **Project State**: Central state container for all editor data
- **Render Pipeline**: Converting the project to a final video file

## Core Concepts

### Projects and Media

A **Project** is the container for all editing work. It stores:
- Unique project ID and name
- Array of media files that were imported
- Array of tracks containing clips
- Project is never automatically saved; explicit save is required

**Media** represents a single imported file (video, audio, or image). Each media entry tracks:
- File metadata (name, format, size)
- Duration (null for images)
- Hash of the file content (used for deduplication)
- The actual File object is stored in a module-level map, not in the media object itself

### Tracks and Clips

A **Track** is a horizontal lane in the timeline that contains clips. Tracks have:
- Unique ID
- Type: either "video" or "audio"
- Order: determines z-axis stacking (lower order = more visible)
- Array of clips

A **Clip** is a reference to media placed at a specific time on a track. There are four clip types:

**VideoClip**: References a video file with:
- Timeline position (start and end time on the track)
- Media position (where in the source file to start/end playing)
- Volume level
- 2D transformation (position, scale, rotation)

**AudioClip**: References an audio file with:
- Timeline position
- Media position
- Volume level
- No transformation (audio is not visual)

**ImageClip**: References an image file with:
- Timeline position
- 2D transformation
- Duration is controlled by timeline position

**TextClip**: Contains text content (reserved for future implementation)

Time throughout the system is stored in **seconds with integer millisecond precision** to avoid floating-point errors in synchronization. Use `toMs()` to convert to milliseconds and `toSeconds()` to convert back.

## Timeline Component

### Overview

The Timeline is the central UI component where users interact with clips. It displays:
- Horizontal ruler showing time markers
- Tracks with clips arranged chronologically
- Playhead indicator showing current playback position
- Drag-and-drop interface for adding and moving clips

### Ruler and Zoom

The timeline ruler shows time markers from 0 to project duration. The horizontal scale is measured in **pixels per second** (default 50px/s) and is controlled by:

- **Mouse wheel**: Scroll up to zoom out (see more time), scroll down to zoom in (see more detail)
- **Zoom factor**: 0.9x when scrolling out, 1.1x when scrolling in
- **Constraints**: Zoom scale should be restricted to reasonable bounds (e.g., 5-200 px/s)

The zoom level is stored in `editorStore.timelineScale` and affects how clips are rendered horizontally.

### Time Conversion

Converting between screen coordinates and timeline time:

```
// Pixel position to timeline seconds
timelineSeconds = pixelX / timelineScale

// Timeline seconds to pixel position
pixelX = timelineSeconds * timelineScale
```

The `useTimeline()` hook provides:
- `xToTime()`: Convert mouse X coordinate to timeline time
- `pxToTime()`: Convert pixel distance to time duration
- `timeToPx()`: Convert time duration to pixel distance

### Drag and Drop

The timeline supports two drag patterns:

**Adding Media to Timeline**
1. User drags a media card from the MediaLibrary over a track
2. `handleMediaDrop()` receives the drop event
3. X-coordinate is converted to timeline time
4. `resolveDropPosition()` checks for collisions with existing clips
5. If no collision, a new clip is created and added to the track
6. MediaCardsupply metadata via drag data attributes

**Moving Existing Clips**
1. User drags a clip on the timeline
2. `handleClipDrop()` receives the drop and clip ID
3. Clip is moved to new position/track
4. Timeline is updated and re-rendered

Drop position resolution accounts for:
- Grid snapping (optional feature for alignment)
- Collision detection with existing clips
- Track type compatibility (video clips only on video tracks)
- Valid time range (cannot place clips in negative time)

## Media Library Component

### Overview

The MediaLibrary is a panel where users import media files and browse previously imported media. It manages:

- File selection and upload
- Media processing and metadata extraction
- Visual previews (thumbnails for images/videos)
- Organization and search (future enhancement)

### Media Import Process

When a user selects files:

1. **File Input**: User clicks "Add Media" and selects files from their computer
2. **Pending State**: Files are added to a pending list and shown as loading cards
3. **Media Processing**:
   - File is added to store via `addMedia(file)`
   - Duration is extracted by creating a temporary media element (video/audio)
   - Media object is created with a hash of the file content
4. **Proxy Generation**: For video files only:
   - `generateProxy()` creates a low-resolution version for preview
   - Progress is tracked and shown to user
   - Once ready, proxy URL is stored in `proxyMap`
5. **Completion**: Pending item is removed, media appears in the gallery

### Object URL Management

Since media files are File objects stored in memory, the MediaLibrary creates browser Object URLs (`URL.createObjectURL(file)`) to render previews. These URLs are:

- Created lazily on demand via `getObjectUrl(mediaId)`
- Cached in a ref to avoid creating duplicates
- Revoked when the component unmounts via `useEffect` cleanup

This cleanup is critical to prevent memory leaks—every created object URL must be revoked when no longer needed.

### Preview Generation

Media cards show:
- **Video files**: Thumbnail from proxy (if available) with play icon
- **Audio files**: Generic audio waveform icon or metadata
- **Images**: Thumbnail of the image

If a proxy is generating, a loading skeleton is shown instead. If proxy generation fails, an error message is displayed.

## Timeline (Track Organization)

### Track Structure

Tracks are displayed vertically and show:
- **Track header**: Contains track type icon and controls (delete, duplicate, etc.)
- **Track body**: Contains clips arranged horizontally by time
- **Drop zone**: Area where media can be dragged to create clips

Track order determines visual layering:
- Order = 0 = Top (most visible)
- Order = 1 = Below track 0
- Order = N = Bottom

When playing back video, clips on lower-order tracks are visible; clips on higher-order tracks are behind them. This allows compositing multiple video layers.

### Track Management

**Adding Tracks**: `addTrack(type)` creates a new track with:
- Unique ID
- Specified type (video or audio)
- Order automatically assigned (always lower than previous lowest)
- Empty clips array

**Removing Tracks**: `removeTrack(trackId)` deletes the track and all clips within it. Consider warning user about data loss.

**Reordering Tracks**: `reorderTrack(sourceId, targetId)` swaps the order of two tracks, changing the visual layering.

### Track Rendering

The Track component (`src/components/editor/Track.tsx`) renders:

1. **Track header**: Button controls and track info
2. **Clips**: Each clip rendered with:
   - Correct timeline position (left = `timelineStart * timelineScale`)
   - Correct width (width = `(timelineEnd - timelineStart) * timelineScale`)
   - Selection state (highlighted if `selectedClipId === clipId`)
3. **Gap areas**: Empty space before/after clips where new media can be dropped
4. **Playhead line**: Vertical indicator showing current play position

## Playhead and Scrubbing

### Playhead Position

The playhead is a vertical line indicating the current playback time. It's controlled by:

- **Automatic movement**: When playing, playhead advances at real-time speed
- **Manual scrubbing**: User can click/drag on the timeline ruler to move playhead
- **Click on timeline**: Clicking any point on a track scrubs to that time

The playhead position is stored in `editorStore.playhead` (in seconds).

### Synchronization

When the playhead moves, the preview player must:
1. Update all media elements to show the correct frame
2. Pause any audio that's no longer active
3. Start playing any newly-active audio
4. Render the correct video frame to the canvas

This synchronization happens via the `useMediaSync` hook and `activeClipResolver`.

## Preview Player

### Overview

The PreviewPlayer is the viewport showing what the combined project looks like at the current playhead position. It handles:

- Canvas-based video rendering with transforms
- Multi-track video compositing
- Audio playback synchronization
- Playback controls (play, pause, seek, volume)

### Architecture

The preview player uses a **double-buffering technique** for smooth playback:

- Two video HTML elements (`videoRefA` and `videoRefB`)
- While one element is displaying, the other is being prepared
- When the displayed element ends, the buffer is swapped
- This eliminates flickers and ensures smooth playback

### Video Rendering

The canvas rendering system:

1. **Canvas Setup**: HTML5 canvas initialized with project dimensions (default 1280x720)
2. **Active Clip Resolution**: For the current playhead position, determines which video clips should be visible
3. **Transform Application**: Each visible clip's transformation is applied
4. **Compositing**: Clips are drawn in layer order (track order)
5. **RequestAnimationFrame Loop**: Continues at 60fps for smooth preview

The transform system applies:
- **Position**: x, y offset in pixels
- **Scale**: width, height as absolute pixel dimensions
- **Rotation**: 2D rotation in degrees around the center

### Audio Synchronization

Audio is handled separately from video:

1. **Audio Pool**: Multiple HTML audio elements, one per audio track
2. **Active Clip Lookup**: For current playhead, find which audio clips are active
3. **Seek and Play**: Each audio element is seeked to the correct position and played
4. **Volume and Mute**: User-controlled via player controls
5. **Drift Correction**: If audio drifts, it's re-seeked to the exact position

This complexity is necessary because:
- Video and audio may be on separate media elements
- Multiple audio tracks need to play simultaneously
- Synchronization between video and audio must be tight

### Playback Controls

The player UI includes:

- **Play/Pause**: Control whether time advances
- **Volume Slider**: Adjust overall playback volume
- **Mute**: Quickly toggle all audio
- **Seek Buttons**: Jump forward/backward by set intervals
- **Time Display**: Show current time and total duration

## Clip Management

### Creating Clips

Clips are created when media is dragged to the timeline. The `addClip(clip)` action:

1. Validates the clip doesn't collide with existing clips
2. Adds the clip to the appropriate track
3. Pushes a history entry for undo support

### Moving Clips

`moveClip(clipId, newStart, trackId)` relocates a clip:

1. Finds the clip in its current track
2. Checks for collisions at the new position
3. Removes from old track, adds to new track
4. Updates clip's `timelineStart` and `timelineEnd` accordingly

### Resizing Clips

`resizeClip(clipId, newEnd)` changes a clip's end time (handles trim operations):

1. Validates new end time is after start time
2. Updates clip's `timelineEnd`
3. This doesn't affect the media start/end (the portion of the source file being used)

### Splitting Clips

`splitClip(clipId, time)` divides one clip into two clips at a given time:

1. Creates two new clips from the original
2. First clip ends at the split time
3. Second clip starts at the split time
4. Both clips reference the same media but different portions
5. Removes the original clip

### Trimming Clips

Trimming is different from resizing. `resizeClip` changes when a clip ends on the timeline, but **trimming** changes which portion of the source media is used. This is typically done via a separate trim interface that modifies `mediaStart` and `mediaEnd` without changing `timelineStart` and `timelineEnd`.

## Transformations

### Transform Object

Each video/image clip can have a transform with properties:

```typescript
{
  x: number,        // Horizontal position in pixels
  y: number,        // Vertical position in pixels
  width: number,    // Width in pixels
  height: number,   // Height in pixels
  rotation: number  // Rotation in degrees (0-360)
}
```

Default transform places media at top-left (0,0) with project dimensions.

### Applying Transforms

The transform overlay provides visual UI for modifying transforms. When user drags/resizes:

1. `updateClipTransform(clipId, partial)` updates the transform while dragging
2. Changes are reflected immediately in preview
3. On completion or commit, `commitTransform(clipId)` finalizes the change
4. History entry is created for undo support

### Transform Rendering

When rendering a clip:

1. Canvas context is saved
2. Transform is applied via canvas methods (translate, scale, rotate)
3. Media is drawn to canvas
4. Canvas context is restored

## History and Undo/Redo

### History System

AloMedia maintains a complete history of project states:

**HistoryEntry**: Contains:
- Snapshot of the entire project state
- Description of the change (e.g., "Added clip", "Moved clip")

**Store State**:
- `history`: Array of all previous states
- `historyIndex`: Current position in history (0 = initial state)

### Recording Changes

`pushHistory(description)` saves the current project state:

1. All states after `historyIndex` are discarded (branching)
2. Current project state is cloned and added to history
3. `historyIndex` is incremented
4. This allows full undo/redo support

### Undo and Redo

**`undo()`**: Moves `historyIndex` backward if possible, restoring previous state

**`redo()`**: Moves `historyIndex` forward if possible, restoring next state

History is limited to prevent excessive memory usage. Consider implementing a maximum history size (e.g., 50 states).

## Collision Detection

### Purpose

To prevent clips from overlapping on the same track, the timeline uses collision detection:

```
hasCollision(trackId, start, end): boolean
```

Returns true if any existing clip on the track overlaps the time range [start, end].

### Algorithm

For each existing clip on the track:
```
clipStart <= newEnd AND clipEnd >= newStart
```

If this condition is true, clips overlap and collision exists.

### Usage

Before adding or moving a clip, `hasCollision()` is called. If true, the operation is rejected with visual feedback to the user.

## Clip Lookup and Active Resolution

### Active Clip Resolution

At any given playhead position, determining which clips should be visible is complex with multiple tracks:

**Algorithm** (from `activeClipResolver.ts`):

1. Scan each video track in order of visual priority (lower track order first)
2. For each track, find all clips that overlap the playhead position
3. If multiple clips overlap, pick the one with the latest start time (incoming clip wins)
4. Return the first clip found from the highest-priority track with an active clip

This ensures:
- Only one video clip visible at a time (even with overlapping clips)
- The topmost overlapping clip is displayed
- Correct clip transitions happen at timeline boundaries

### Looking Up Next Clip

`getNextVideoClip()` finds the next clip that will become active:

1. Check if any clip starts exactly when current clip ends
2. If not, find all clips starting at or after the current clip's end
3. Pick the nearest clip by time
4. Break ties by track order

This is used to buffer the next clip's media in advance for smooth transitions.

## Media Synchronization

### Purpose

Synchronizing video, audio, and canvas rendering is one of the hardest problems in video editing:

- Video plays from an HTML video element (has its own timing)
- Audio plays from HTML audio elements (separate timing)
- Canvas rendering happens at 60fps (different timing)
- User may scrub or pause, breaking all synchronization
- Multiple audio tracks must play in perfect sync

### Solution: useMediaSync Hook

The `useMediaSync` hook coordinates all these timing sources:

**Input State**:
- Current playhead position
- Play/pause state
- Whether app is in focus
- Volume and mute level

**Output State**:
- Three video element refs (primary, buffer, secondary)
- Method to get object URLs for media files
- Method to handle frame updates

**Synchronization Process**:

1. **Per-frame (RAF)**: 
   - Read current time from primary video element
   - Calculate media time for current clip
   - Compare against playhead
   - Apply drift correction if needed

2. **Clip transitions**:
   - When primary clip ends, swap to buffered secondary clip
   - Continue playing without interruption
   - The now-idle primary element loads the next clip

3. **Audio sync**:
   - Active audio clips are synced via `syncAudioElements()`
   - Runs after every playhead update
   - Handles seeking, pausing, and volume

### Drift Correction

Over time, playback can drift:
```
actualTime - expectedTime > DRIFT_CORRECTION_THRESHOLD
```

When drift exceeds the threshold (default 33ms), the video is seeked back to the exact position. This keeps video and audio in perfect sync.

## Project Serialization

### Saving Projects

Projects can be saved to JSON and reloaded later. The serialization process:

1. Convert project object to JSON string
2. Include version number for compatibility
3. Include timestamps (createdAt, updatedAt)
4. Store in localStorage or backend database

**Note**: Media files are NOT serialized (too large). Instead, file references by ID are stored. When opening a project, users must re-import media or specify the source files.

### Loading Projects

When opening a saved project:

1. Load JSON from storage
2. Deserialize into project object
3. Re-import or ref-link the media files
4. Populate the timeline with clips
5. Set playhead to start position

## Performance Optimization

### Proxy Videos

For smooth timeline scrubbing with full-quality videos, AloMedia generates low-resolution proxy versions:

- **Proxy**: Small file (~5-10% of original size), low resolution (480p typical)
- **Original**: Full resolution, only used for final render

Timeline scrubbing uses proxies for instant responsiveness. Final export uses originals for quality.

### Lazy Loading

Media files are only loaded into memory when needed:

- Imported files are stored but not immediately processed
- Proxies are generated asynchronously
- Canvas rendering only processes active clips

### Clip Indexing

For fast lookup of active clips, a clip index structure can be built:

```typescript
interface ClipIndex {
  [trackId]: Clip[]  // Sorted by start time
}
```

Binary search or other techniques can then quickly find clips at a given time.

## Future Enhancements

Planned features for the video editor:

- **Effects and Filters**: Apply color correction, blur, etc.
- **Transitions**: Automatic fade/wipe between clips
- **Text Overlay**: Add titles, subtitles
- **Keyframe Animation**: Animate transformations over time
- **Speed Control**: Speed up/slow down clips
- **Cross-fade Audio**: Smooth audio transitions
- **Multi-select**: Edit multiple clips at once
- **Snap to Grid**: Alignment assistance
- **Rulers and Guides**: Positioning helps
