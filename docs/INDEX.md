# AloMedia — Documentation Index

AloMedia is a browser-based, non-linear video editor built with React, TypeScript, Zustand, and FFmpeg.wasm.

---

## Documents

### Getting Started

| Document | Description |
|---|---|
| [GETTING_STARTED.md](GETTING_STARTED.md) | Setup, first run, project structure, and first editing workflow |
| [CONFIGURATION.md](CONFIGURATION.md) | Vite, TypeScript, and environment variable configuration |

### Architecture & Design

| Document | Description |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, layered architecture diagram, and key design decisions |
| [DATA_MODEL.md](DATA_MODEL.md) | All TypeScript types: Project, Track, Clip, Transform, ColorAdjustments, AudioConfig |
| [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) | Zustand editor store, action categories, undo/redo system, proxy state |

### Core Subsystems

| Document | Description |
|---|---|
| [PLAYER.md](PLAYER.md) | Real-time playback engine: RAF loop, double-buffer video, audio pool, clip index |
| [FFMPEG.md](FFMPEG.md) | Engine layer: proxy generation, final MP4 export, filter utility functions |

### Editor

| Document | Description |
|---|---|
| [VIDEO_EDITOR.md](VIDEO_EDITOR.md) | Editor user guide: layout, clips, timeline, inspector, export |
| [EDITOR_COMPONENTS.md](EDITOR_COMPONENTS.md) | Technical reference for every editor React component |
| [HOOKS_AND_UTILS.md](HOOKS_AND_UTILS.md) | Custom hooks (usePlayer, useTimeline, useAuth) and all utility modules |
| [STYLES_UI.md](STYLES_UI.md) | Color palette, Tailwind conventions, and design system |

### Authentication & Routing

| Document | Description |
|---|---|
| [AUTHENTICATION.md](AUTHENTICATION.md) | httpOnly cookie session management, AuthProvider, auth flow phases |
| [ROUTES.md](ROUTES.md) | Route tree, PublicRoute/PrivateRoute guards, API layer |

### Development Reference

| Document | Description |
|---|---|
| [EDITOR_FIXES_2026-03-13.md](EDITOR_FIXES_2026-03-13.md) | Log of editor bug fixes from March 2026 |
| [audio-fix.md](audio-fix.md) | Audio synchronization fix notes |

---

## Architecture at a Glance

```
Browser
├── React App
│   ├── AuthProvider         session state via httpOnly cookie
│   └── Router
│       ├── /auth/*          login, register, recover
│       ├── /dashboard       project gallery
│       └── /editor          VideoEditor
│           ├── MediaLibrary      import + proxy generation
│           ├── PreviewPlayer     canvas + transport
│           │   ├── Double-buffer video (primary track)
│           │   ├── Secondary <video> elements (extra tracks)
│           │   └── AudioPool (one <audio> per track)
│           ├── Toolbar
│           ├── Timeline          tracks + clips
│           └── InspectorPanel    color, audio, speed
│
├── Zustand Store
│   ├── project (tracks → clips, media catalog)
│   ├── playhead, isPlaying, timelineScale
│   ├── history stack (deep-clone snapshots)
│   └── proxyMap + fileMap (non-reactive)
│
└── Engine Layer (WASM)
    ├── ffmpegEngine      final MP4 render
    ├── proxyEngine       360p proxy (background queue)
    └── renderPipeline    Project → RenderJob (pure transform)
```
