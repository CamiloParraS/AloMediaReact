# AloMedia Architecture

# AloMedia — Architecture

## Overview

AloMedia is a browser-based, non-linear video editor built entirely on web technologies. It requires no backend for media processing: all timeline editing, preview playback, and final MP4 export happen inside the browser tab using WebAssembly.

The system is structured around three largely independent concerns that communicate through a single Zustand store:

- **User Interface** — React components responsible for rendering and user interaction.
- **Player Layer** — Real-time, frame-accurate playback engine running outside React via `requestAnimationFrame`.
- **Engine Layer** — WASM-based FFmpeg processing for proxy generation and final video export.

---

## Technology Stack

| Concern | Technology |
|---|---|
| Framework | React 19 + TypeScript 5 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 (Vite plugin) |
| State management | Zustand v5 |
| Routing | React Router v7 |
| Server state | TanStack React Query v5 |
| Media encoding | `@ffmpeg/ffmpeg` + `@ffmpeg/core` (WASM) |

**Browser requirements**: The WASM multi-threading model of FFmpeg depends on `SharedArrayBuffer`, which modern browsers only expose on pages served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. These headers are set in the Vite dev server config and must be replicated in any production deployment.

---

## Layered Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   UI Layer (React)                        │
│  Pages, Editor Layout, Timeline, Inspector, MediaLib     │
├──────────────────────────────────────────────────────────┤
│             State Layer (Zustand Store)                   │
│  Project, Playhead, History, ProxyMap, FileMap           │
├────────────────────────┬─────────────────────────────────┤
│   Player Layer (RAF)   │      Engine Layer (WASM)        │
│  VideoBufferManager    │  ffmpegEngine (final render)    │
│  AudioPool + AudioSync │  proxyEngine (360p proxy)       │
│  ClipIndex + Resolver  │  renderPipeline (job builder)   │
└────────────────────────┴─────────────────────────────────┘
		 ▲                          ▲
		 │ reads fileMap            │ reads fileMap
		 └──────────────────────────┘
				  API Layer (fetch)
			  http.ts + authService.ts
```

### Interaction Model

1. **UI → Store**: All user actions (add media, move clip, seek playhead, update color) are dispatched as store actions. The store is the single source of truth.
2. **Store → Player**: The Player layer reads project state and playhead from the store on every animation frame. It does not subscribe to reactive updates for performance reasons — it polls via module-level refs.
3. **Store → Engine**: When the user triggers a render or a file is imported, the UI calls engine functions directly, passing the current store state (project) and `fileMap` as arguments.
4. **Engine → Store**: The proxy engine writes back to the store via `setProxyReady` / `setProxyError` when a proxy URL becomes available.

---

## Directory Structure

```
src/
├── api/              HTTP client and error types
├── components/       Reusable UI components
│   └── editor/       Video editor-specific components
├── constants/        Shared numeric/config constants
├── context/          React Context providers (Auth)
├── engine/           FFmpeg render & proxy engines
├── hooks/            Custom React hooks
├── layouts/          Page layout wrappers
├── pages/            Top-level route views
├── player/           Real-time playback subsystem
│   ├── audio/        AudioPool and AudioSync
│   ├── hooks/        useMediaSync
│   ├── render/       Canvas scaling and transform utils
│   ├── timeline/     ClipIndex and active-clip resolver
│   ├── utils/        ObjectUrlRegistry
│   └── video/        VideoBufferManager (double-buffer)
├── project/          Project types and serializer
├── routes/           Route guard components
├── services/         API service wrappers
├── store/            Zustand editor store
├── types/            Shared TypeScript types
└── utils/            Pure utility functions
```

---

## Key Design Decisions

### Non-reactive Playback Loop

The RAF playback loop in `usePlayer` moves the playhead via a **module-level ref** (`playheadRef`) rather than Zustand state. This avoids triggering a React re-render on every animation frame (60 times per second), which would be prohibitive for layout and rendering performance. The store's `playhead` value is only synced every 100 ms for timeline scrubber updates.

### Double-buffered Video

The primary video track uses two `<video>` elements alternating roles as "active" and "buffering". When a clip transition is 1.5 seconds away, the next clip is silently preloaded into the background element. On transition, the elements swap opacity. This eliminates visible frame gaps between clips.

### Integer Millisecond Time

All timeline time values are stored as floating-point seconds but normalized to **integer millisecond precision** via `toMs()` / `toSeconds()` helpers. This prevents the subtle drift that accumulates when performing arithmetic on continuous floating-point timestamps (e.g. dividing clip duration by speed repeatedly).

### Immutable History via Deep Clone

Undo/redo history is implemented by storing deep-clones of the entire `project` object using `JSON.parse(JSON.stringify(...))`. This is simple and robust for the data sizes involved (no binary data is stored in `project` — media files live in `fileMap` outside the serializable state).

### Proxy URLs for Smooth Scrubbing

Imported video files are immediately transcoded in the background to a 360p, audio-free proxy file. The player uses the proxy URL for `<video>` elements during timeline scrubbing, keeping seeks fast. The full-resolution file is only loaded when needed for final export.
Route protection components using React Router's outlet pattern.

- **`PrivateRoute.tsx`**: Redirects unauthenticated users to login
- **`PublicRoute.tsx`**: Redirects authenticated users away from auth pages

### `/src/components`
Reusable UI components organized by function.

- **Top-level buttons & cards**: Fundamental interactive and display components
- **`/editor`**: Video editor specific components (Timeline, MediaLibrary, PreviewPlayer, Track, Clip, etc.)
- **`/ui`**: Generic UI building blocks (buttons, sliders, dropdowns, etc.)

### `/src/engine`
Core processing engines that handle heavy computational tasks.

- **`ffmpegEngine.ts`**: Wrapper around the FFmpeg.wasm library that handles video/audio rendering with complex filtering and composition
- **`proxyEngine.ts`**: Generates low-resolution proxy videos for smooth timeline preview without waiting for full-resolution processing
- **`renderPipeline.ts`**: Orchestrates the rendering workflow from project data to output file

### `/src/player`
Real-time playback and synchronization logic for the preview player.

- **`/audio`**: Audio track management and synchronization algorithms
- **`/video`**: Video buffering and playback coordination
- **`/render`**: Canvas transformation and scaling utilities
- **`/timeline`**: Clip resolution and lookup utilities for determining what media should play at any given time
- **`/utils`**: Object URL management and cleanup

### `/src/project`
Project data structure definitions and serialization.

- **`projectTypes.ts`**: TypeScript interfaces for media, clips, tracks, projects, and render jobs
- **`projectSerializer.ts`**: JSON serialization/deserialization for saving and loading projects

### `/src/hooks`
Custom React hooks for reusable logic.

- **`useAuth.ts`**: Quick access to authentication context
- **`usePlayer.ts`**: Playback control logic (play, pause, seek)
- **`useTimeline.ts`**: Timeline manipulation utilities
- **`useMediaSync.ts`** (in `/player/hooks`): Synchronization between video/audio elements and the playhead

### `/src/utils`
Utility functions for common tasks throughout the application.

- **`time.ts`**: Time conversion and calculation utilities (seconds to pixels, timeline duration, etc.)
- **`tracks.ts`**: Track manipulation utilities
- **`clipIndex.ts`**: Efficient clip lookup by time
- **`id.ts`**: Unique ID generation
- **`objectUrlRegistry.ts`**: Browser object URL lifecycle management

### `/src/types`
TypeScript interfaces and types for type safety.

- **`authTypes.ts`**: Authentication request/response types
- **`userTypes.ts`**: User profile types
- **`productTypes.ts`**: Product/project related types

### `/src/constants`
Application-wide constants and configuration values.

- **`timeline.ts`**: Timeline-related constants (default zoom, drift correction thresholds, etc.)

## Data Flow

### Project Editing Flow

1. **User selects media** → MediaLibrary component handles file upload
2. **Media added to project** → editorStore.addMedia() processes the file
3. **Proxy generation** → proxyEngine creates low-res version for preview
4. **User drags media to timeline** → resolveDropPosition() calculates where it should go
5. **Clip added to track** → editorStore.addClip() updates project state
6. **Timeline re-renders** → Shows new clip visually
7. **Playhead updates** → PreviewPlayer synchronizes video/audio playback
8. **User modifies clip** → editorStore methods handle resize, move, transform
9. **History entry created** → pushHistory() for undo/redo support

### Playback Flow

1. **Play button clicked** → usePlayer.play() triggered
2. **Active clips resolved** → activeClipResolver finds what should play at current playhead
3. **Media elements synced** → syncAudioElements() and video element updates
4. **Frame rendered** → Canvas draws transformed video with active clip's transform
5. **AnimationFrame loop continues** → Updates playhead and repeats process

### Rendering Flow (Export)

1. **User clicks Export** → renderPipeline.createRenderJob() analyzes the project
2. **Segments generated** → For each clip, a RenderSegment is created with its media, timing, and transforms
3. **FFmpeg engine initialized** → ffmpegEngine.renderJob() receives the job and segments
4. **Files written to virtual FS** → Each unique media file written to FFmpeg's in-memory filesystem
5. **Video track processed** → Trimming, concatenation, or composition as needed
6. **Audio track processed** → Separate audio handling for multi-track projects
7. **Muxing** → Video and audio combined into final output
8. **Download triggered** → User receives the final MP4 or WebM file

## State Management

The project uses **Zustand** for state management through the `editorStore`. This store is the single source of truth for:

- Project structure (media array, tracks, clips)
- Timeline playhead position
- UI state (selected clips, selected tracks)
- Undo/redo history
- Proxy generation status

The store is accessible via hooks like `useEditorStore(state => state.property)` throughout the application. Actions in the store are carefully designed to maintain immutability and support time-travel debugging.

## Type Safety

The entire application uses **TypeScript** for type safety. Key type definitions include:

- **Media**: Audio, video, or image files uploaded by user
- **Clip**: References to media with timeline positioning and transformations
- **Track**: Container for clips, either video or audio
- **Project**: Collection of media and tracks
- **Transform**: 2D transformation properties (x, y, width, height, rotation)
- **RenderJob**: Instructions for FFmpeg to produce final output

All time values are stored in seconds with integer millisecond precision to avoid floating-point errors in synchronization.

## Performance Considerations

### Timeline Preview
The proxy engine generates low-resolution versions of videos for instant preview without waiting for full-resolution rendering.

### Media Synchronization
The double-buffering technique in useMediaSync ensures smooth playback by preparing the next frame while displaying the current one.

### Canvas Scaling
The canvasScaling utility handles responsive resizing of the preview canvas without losing quality or performance.

### Virtual Filesystem
FFmpeg.wasm uses an in-memory virtual filesystem. Files are only kept as long as needed during rendering, then cleaned up.

## Security Considerations

- **Authentication**: httpOnly cookies prevent XSS attacks on auth tokens
- **CORS**: Proper CORS headers configured for SharedArrayBuffer to enable FFmpeg's multi-threading
- **Type Safety**: TypeScript prevents many classes of runtime errors

## Extensibility Points

Future features can be added at these extension points:

- **New clip types**: Add to the Clip union type and create clip-specific UI components
- **New engines**: Create new engine modules in `/src/engine` following the same pattern
- **New media types**: Extend MediaType and update proxy/playback logic
- **New track types**: Add to TrackType and implement track-specific behavior
