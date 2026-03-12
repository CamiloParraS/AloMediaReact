# AloMedia Architecture

## Overview

AloMedia is a modern web-based video editing application built with React and TypeScript. It provides users with professional video composition and editing capabilities, including multi-track timeline management, real-time preview, and FFmpeg-based rendering.

## Core Technology Stack

**Frontend Framework**: React 19 with TypeScript
**Routing**: React Router 7
**State Management**: Zustand
**Video Processing**: FFmpeg.wasm
**Styling**: TailwindCSS with custom theming
**Build Tool**: Vite
**Package Manager**: npm

## High-Level Architecture

AloMedia follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│              User Interface Layer                     │
│  (React Components, Pages, Editor UI)                │
├─────────────────────────────────────────────────────┤
│          State Management & Context Layer            │
│  (Zustand Store, Auth Context, Hooks)               │
├─────────────────────────────────────────────────────┤
│           Business Logic & Services Layer            │
│  (Timeline Management, Media Processing)            │
├─────────────────────────────────────────────────────┤
│        Engine & Processing Layer                     │
│  (FFmpeg Engine, Proxy Engine, Render Pipeline)    │
├─────────────────────────────────────────────────────┤
│           API & External Integration Layer          │
│  (HTTP Client, Authentication API)                  │
└─────────────────────────────────────────────────────┘
```

## Directory Structure Explanation

### `/src` Root Files
- **`main.tsx`**: Application entry point that mounts the React app
- **`App.tsx`**: Root component that wraps the router provider
- **`router.tsx`**: Route definitions for public (auth), private (dashboard/editor), and fallback routes

### `/src/api`
Handles all HTTP communication with the backend and error handling.

- **`http.ts`**: Generic HTTP client that wraps the Fetch API with automatic JSON parsing, error handling, and type safety
- **`errors.ts`**: Custom error classes and error handling utilities

### `/src/context`
React Context providers for cross-cutting concerns that need to be accessible throughout the app.

- **`AuthProvider.tsx`**: Provides authentication state (user data, login/logout methods) to the entire application. Manages session verification on app load through httpOnly cookies.

### `/src/store`
Zustand stores for reactive state management, primarily for the video editor.

- **`editorStore.ts`**: Central state container for the video editor including project data, playhead position, timeline scale, selected elements, and undo/redo history. Also maintains a module-level file registry.

### `/src/services`
Business logic services that interact with the backend API.

- **`authService.ts`**: Authentication-related service functions (login, register, password recovery, logout)

### `/src/pages`
Top-level page components that represent distinct application views.

- **Auth Pages** (`/auth`): Login, registration, and password recovery flows
- **Dashboard** (`/dashboard`): Main user hub showing projects and media
- **Editor** (`/editor`): The video editing interface

### `/src/layouts`
Reusable layout components that wrap page content.

- **`AuthLayout.tsx`**: Layout wrapper for authentication pages

### `/src/routes`
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
