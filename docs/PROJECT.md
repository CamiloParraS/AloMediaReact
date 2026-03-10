# AloMedia — Project Documentation

> Deep technical reference for the AloMedia web video editor. Written for developers who need to understand how the system works end-to-end.

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Authentication](#2-authentication)
3. [Styles](#3-styles)
4. [Layouts](#4-layouts)
5. [Pages](#5-pages)
6. [Router](#6-router)
7. [FFmpeg](#7-ffmpeg)
8. [Video Editor Nomenclature](#8-video-editor-nomenclature)
9. [Video Editor Functionalities](#9-video-editor-functionalities)
10. [Loading Media Optimization](#10-loading-media-optimization)
11. [Renderization](#11-renderization)
12. [Preview Player Deep Dive](#12-preview-player-deep-dive)

---

## 1. Architecture

AloMedia is a single-page application built with **React 19** and **TypeScript**, bundled with **Vite**. The project follows a feature-oriented folder structure where each concern (authentication, editor state, media processing) lives in its own module.

Global state for the video editor is managed entirely by **Zustand**, a lightweight store library that avoids the boilerplate of Redux while keeping a reactive, predictable update model. There is no backend involved in the editor itself — all video processing happens in the browser using **FFmpeg compiled to WebAssembly**.

Authentication-related state lives in a React **Context** (`AuthProvider`), separate from the editor store, because it has a different lifecycle and is consumed by a much smaller set of components. The two state systems never mix.

The application communicates with an external REST API for user management. All HTTP calls go through a centralized `http` helper that handles credentials, content type headers, and unified error parsing. The base URL is read from an environment variable (`VITE_BASE_URL`), so the same code can point at a local dev server or production API without changes.

FFmpeg requires `SharedArrayBuffer`, which in turn requires the page to be served with the security headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. These are configured at the Vite dev server level in `vite.config.ts` so developers don't need to configure them manually.

The folder structure separates concerns clearly:

- `api/` — low-level HTTP client and error types
- `components/` — reusable UI components, including all editor-specific ones under `components/editor/`
- `context/` — React context providers (only auth for now)
- `engine/` — FFmpeg wrappers: proxy generation and final rendering
- `hooks/` — shared custom hooks
- `layouts/` — page shell components that wrap route children
- `pages/` — one component per route, organized by feature area
- `project/` — data types and serialization logic for the project format
- `routes/` — route guard components
- `services/` — API function calls grouped by domain
- `store/` — Zustand store for editor state
- `types/` — shared TypeScript interfaces for API payloads
- `utils/` — pure helper functions (ID generation, time/pixel conversions, track ordering)

---

## 2. Authentication

Authentication is implemented using **httpOnly cookies**. The server sets a session cookie after a successful login, and the browser attaches it automatically on every subsequent request. The client never reads or writes the token directly — it simply calls the API and trusts the browser's cookie mechanics.

### AuthProvider

`AuthProvider` is a React context provider that wraps the entire application. On mount, it calls the `/auth/me` endpoint to verify whether the browser already has a valid session cookie. If the server returns an authenticated user, that user object is stored in state; otherwise the user is treated as a guest. This check happens once at startup, and a loading flag is exposed so the app can show a spinner rather than briefly flashing the wrong page.

The context exposes three pieces of data and two actions:

- `user` — the currently logged-in user object, or `null`
- `isAuthenticated` — a derived boolean, simply `user !== null`
- `isLoading` — true while the initial session check is in flight
- `login(user)` — stores the user after a successful sign-in or registration
- `logout()` — calls `/auth/logout` to destroy the server-side session, then clears local state

### Services

All auth API calls are isolated in `authService.ts`. Each exported function maps to one endpoint:

- `signIn` — `POST /auth/login`
- `signUp` — `POST /auth/register`
- `me` — `GET /auth/me` (session verification)
- `signout` — `POST /auth/logout`
- `recoverRequest` — sends a password-reset email
- `validateRecoverToken` — checks that a reset token is still valid
- `recoverReset` — sets a new password using the token

### Error Handling

The `http` helper throws a custom `ApiError` when the server responds with a non-2xx status. `ApiError` carries the HTTP status code, a human-readable message, and an optional array of field-level validation errors. Components use `error instanceof ApiError` to differentiate between API errors (which they display to the user) and unexpected runtime errors.

---

## 3. Styles

The styling system is built on **Tailwind CSS v4**. Instead of a traditional `tailwind.config.js`, all design tokens are declared inside `index.css` using the `@theme` directive, which registers custom CSS variables and maps them to Tailwind utility classes automatically.

### Design Tokens

The palette revolves around a dark, cinematic aesthetic with deep reds and near-black surfaces:

- **Dark surfaces** progress from `#0b0b0f` (pure background) through `#111116`, `#18181f`, and `#222230` to lighter elevated cards.
- **Borders** use subtle values like `#2e2e3a` and `#3e3e50` so boundaries are visible without being harsh.
- **Reds** range from the deep blood red `#7a1a1a` used for ambient glows to the brighter `#c0392b` accent used on interactive elements and gradient text.
- **Text** uses `#ececf0` as the main body color and `#8a8a9a` / `#b0b0c0` for muted secondary text.

### Typography

The application uses **Quicksand**, a rounded sans-serif loaded from Google Fonts. It is declared as the default font family via the custom property `--font-sans` in the theme, so every element inherits it.

### Animations

Three keyframe animations are defined directly in the theme:

- `fade-in` — fades an element from transparent to visible over 0.5s.
- `slide-up` — combines a fade with a 16px upward translation, used for page entrance animations.
- `glow-pulse` — a subtle repeating box-shadow pulse on blood-red, used for decorative CTAs.

### Utility Classes

Beyond token-driven utilities, `index.css` also defines a handful of handcrafted helpers:

- `.glass-card` — a semi-transparent card with a `backdrop-filter: blur(20px)` frosted glass effect and a faint border.
- `.text-gradient-red` — renders text with a three-stop red-to-orange gradient using `background-clip: text`.
- `.bg-noise` — uses an SVG-based fractal noise filter as a `::before` pseudo-element to add a subtle texture over gradient backgrounds, giving them depth without visible patterns.

### Editor Tokens

The editor panel uses a separate set of CSS custom properties (declared in `:root`) for clip colors, track header backgrounds, and playhead colors. This keeps editor-specific values isolated from the global palette.

---

## 4. Layouts

Currently there is one layout component: **AuthLayout**.

### AuthLayout

AuthLayout is a full-screen shell centered both horizontally and vertically. It is used by all authentication-related pages (login, register, password recovery). The layout renders a multi-layer decorative background made of stacked gradient `div`s and two blurred "orb" circles that create a sense of depth. On top of that sits the noise overlay.

The content itself is constrained to `max-w-4xl` and animated with `animate-fade-in` upon entry. The actual page content is rendered through React Router's `<Outlet />`, meaning child routes swap in without reloading the layout.

---

## 5. Pages

### LoginPage

A split-column form that handles email/password sign-in and OAuth (Google). It tracks form field state locally, calls `signIn` from `authService`, and on success calls `login()` from `AuthContext` before navigating to `/dashboard`. Field-level API errors (e.g., "Email not found") are extracted from the `ApiError` object and displayed inline below the relevant input.

### RegisterPage

Similar structure to `LoginPage` but calls `signUp`. After a successful registration the user is also logged in automatically and redirected to the dashboard.

### RecoverRequestPage

A single email input. The user enters their address and the app calls `recoverRequest`. The page shows a success message after submission without navigating away.

### RecoverPage

Reads a reset token from the URL query string, validates it against the API on mount, and if valid presents a new-password form. Calls `recoverReset` on submit.

### DashboardPage

The home screen after login. It shows a hero section with a "New Project" call-to-action, a grid of recent project cards (currently with sample data), and a row of quick-action cards. The page uses heavy layered gradients and radial glows to match the app's cinematic feel.

### VideoEditor

The main editor page. It is not behind the auth guard at the moment (`/editor` is an unprotected test route). It composes all editor panels — `MediaLibrary`, `PreviewPlayer`, `Toolbar`, and `Timeline` — into a full-viewport layout. The top bar contains an editable project title (double-click to rename), and three action buttons: Save (exports the project as JSON), Load (imports a previously saved JSON), and an Export button that triggers the full FFmpeg render pipeline and downloads the output as an `.mp4` file.

---

## 6. Router

Routing is handled by **React Router v7** using the `createBrowserRouter` function, which uses the browser's History API for clean URLs without hash fragments.

Routes are organized into three groups:

**Public-only routes** are wrapped by `PublicRoute`, which redirects already-authenticated users to `/dashboard`. This prevents logged-in users from accessing the login page. All auth pages live under the `/auth` path prefix and share the `AuthLayout` shell. Navigating to `/auth` alone redirects to `/auth/login`.

**Private routes** are wrapped by `PrivateRoute`, which does the opposite: unauthenticated users are sent to `/auth/login`. Currently only `/dashboard` lives here.

**Open routes** have no authentication constraint. The `/editor` route falls here as a development convenience so the editor can be tested without going through the auth flow.

A wildcard `*` route at the bottom catches all unmatched paths and redirects to `/auth/login`, ensuring the user always lands somewhere sensible.

---

## 7. FFmpeg

FFmpeg runs entirely in the browser as a WebAssembly binary loaded from a CDN (`unpkg.com/@ffmpeg/core@0.12.10`). The application maintains **two separate FFmpeg instances**: one for generating proxies (`proxyEngine.ts`) and one for the final export render (`ffmpegEngine.ts`). This separation is important because both tasks can be time-consuming and the proxy generation should not block or interfere with the export.

### Loading FFmpeg

Both engines share the same loading pattern: they call `ffmpeg.load()` with a `coreURL` (the JavaScript glue code) and a `wasmURL` (the compiled binary). Both are fetched and converted into Blob URLs using `toBlobURL` from `@ffmpeg/util`. This works around CORS restrictions and ensures the WASM file is served with the correct MIME type. The loaded state is checked before every operation — if FFmpeg is already initialized, the load step is skipped.

### `loadFFmpeg()`

The function exported from `ffmpegEngine.ts` initializes the rendering instance. It is called implicitly at the start of every render job, so the consumer never needs to call it directly.

### `renderJob(job, files)`

This is the main export function. It takes a `RenderJob` object (described in the nomenclature section) and a `Map<string, File>` that maps media IDs to their raw browser `File` objects. The function:

1. Writes all required input files into FFmpeg's **virtual filesystem** using `ffmpeg.writeFile()`.
2. Trims each video segment to its designated `mediaStart`/`mediaEnd` range using `-ss` and `-to` flags with `-c copy` to avoid re-encoding.
3. For a **single-track** timeline with multiple video segments, concatenates them using FFmpeg's `concat` demuxer by writing a text manifest file and running a concat pass.
4. For a **multi-track** timeline (segments spanning different tracks), composites all video segments using a chain of `overlay` filters on top of a black base canvas (`color` source). Each trimmed segment is shifted to its `timelineStart` position using `-itsoffset` and scaled to its transform dimensions. Segments are overlaid in z-order: the background track (highest `trackOrder`) is laid down first, and the foreground track (lowest `trackOrder`) last, so the topmost track visually wins when clips overlap.
5. Handles audio segments by running them through a `volume` filter chain and then an `amix` filter to blend multiple audio tracks together.
6. Combines the video track (or composited result) and mixed audio track in a final mux pass.
7. Reads the output file from the virtual filesystem and returns it as a `Uint8Array`.

### `generateProxy(mediaId, file, onReady, onError)`

This function is exported from `proxyEngine.ts`. It adds a proxy generation task to a **serial queue** — a promise chain that ensures only one proxy job runs at a time, since both would otherwise compete for the same FFmpeg WASM instance. When the job runs, it:

1. Writes the input file to the virtual filesystem.
2. Transcodes the video to a 640×360 resolution with a CRF of 28 and the `fast` preset with audio stripped entirely (`-an`).
3. Reads the result, copies it into a fresh `Uint8Array` to avoid issues with the shared WASM memory, wraps it in a `Blob`, and calls `onReady` with an object URL.
4. Cleans up both input and output files from the virtual filesystem in a `finally` block.

---

## 8. Video Editor Nomenclature

The project's data model is the foundation of the entire editor. Understanding it is necessary before working on any editor feature.

### The Project Object

A `Project` is the root document. It holds all media metadata and the arrangement of clips on the timeline. It is designed to be fully serializable as JSON — there are no functions, DOM references, or non-primitive values inside the project object itself.

```json
{
  "project": {
    "id": "a1b2c3",
    "name": "My Project",
    "media": [
      {
        "id": "m1",
        "name": "intro.mp4",
        "type": "video",
        "format": "video/mp4",
        "duration": 12.5,
        "size": 4200000,
        "hash": "e3b0c44298fc1c14..."
      }
    ],
    "tracks": [
      {
        "id": "t1",
        "type": "video",
        "order": 0,
        "clips": [
          {
            "id": "c1",
            "trackId": "t1",
            "type": "video",
            "mediaId": "m1",
            "timelineStart": 0,
            "timelineEnd": 10,
            "mediaStart": 0,
            "mediaEnd": 10,
            "volume": 1,
            "transform": {
              "x": 0,
              "y": 0,
              "width": 1280,
              "height": 720,
              "rotation": 0
            }
          }
        ]
      },
      {
        "id": "t2",
        "type": "audio",
        "order": 1,
        "clips": []
      }
    ]
  },
  "version": 1,
  "createdAt": 1741478400000,
  "updatedAt": 1741478400000
}
```

### Key Concepts

**Media** is the raw asset registry. Adding a file to the project creates a `Media` entry with metadata (name, type, duration, size) and a SHA-256 hash computed from the filename, size, and last-modified timestamp. The hash is used to prevent duplicate entries — uploading the same file twice reuses the existing `Media` record. The actual `File` object is stored separately in a module-level `Map<string, File>` called `fileMap`, outside of reactive state.

**Track** is a horizontal lane on the timeline. Each track has a `type` (either `"video"` or `"audio"`) and an `order` number that determines its position from top to bottom in the timeline panel. Tracks cannot be deleted if they are the last track of their type.

**Clip** is a placed segment on a track. There are four clip types:

- `VideoClip` — references a media asset by `mediaId`. Uses `mediaStart`/`mediaEnd` to specify which portion of the source file plays, and `timelineStart`/`timelineEnd` for where it sits on the timeline. Has a `volume` and a `transform` for spatial positioning.
- `AudioClip` — like a video clip but without a transform.
- `ImageClip` — references a media asset but has no `mediaStart`/`mediaEnd` since images have no duration. Has a transform.
- `TextClip` — carries inline `content` text instead of a media reference.

The distinction between `mediaStart`/`mediaEnd` and `timelineStart`/`timelineEnd` is important: the timeline fields define *when* the clip plays in the composition, while the media fields define *which part* of the source file is used. This enables trimming — a 30-second file can be placed as a 5-second clip by setting `mediaStart: 10, mediaEnd: 15`.

**Transform** describes the spatial properties of a visual clip within the 1280×720 canvas: position (`x`, `y`), size (`width`, `height`), and `rotation` in degrees.

---

## 9. Video Editor Functionalities

The editor is composed of several panels that communicate exclusively through the Zustand store.

### Media Library

The left panel shows all assets that have been added to the project. Users can click "Add Media" or use the file input to upload video, audio, or image files. Each file is hashed on import; duplicates are silently deduplicated. While a file is being processed (hashing, duration detection, proxy generation) a `LoadingCard` placeholder is shown. Once ready, it becomes a draggable `MediaCard` that the user can drag onto a timeline track.

### Timeline

The central editing surface. The timeline renders all tracks vertically and places clips horizontally as absolutely-positioned elements scaled to a configurable pixels-per-second ratio. The user can scroll the timeline horizontally and zoom in or out using the mouse wheel (or toolbar buttons), which adjusts the scale value in the store.

Dragging a clip from the media library onto a track calculates the drop position from the mouse X coordinate relative to the track area, resolves collision and snapping, and calls `addClip`. Dragging an existing clip between tracks or along the same track calls `moveClip`. The timeline hook (`useTimeline`) centralizes the collision detection and snapping logic: clips snap to the edges of their neighbors when dropped within 0.3 seconds of them.

A clip can be right-clicked to reveal a context menu with "Split at playhead" and "Remove clip" options. The resize handle on the right edge of each clip allows dragging to extend or shorten the clip's end time.

The ruler at the top of the timeline shows time markers that adapt their interval to the current zoom level.

### Playhead Bar

A thin vertical line that follows the current playhead position across all tracks. Clicking anywhere on the ruler area seeks the playhead to that time.

### Toolbar

A compact bar of icon buttons between the preview and the timeline. It provides shortcuts for: cutting the selected clip at the playhead, undo, redo, zoom in, zoom out, fit-to-screen (resets playhead to zero), and a snap toggle. Copy and paste buttons are present as placeholders for future implementation.

### Preview Player

Renders the composition at the current playhead position inside a fixed 1280×720 canvas that scales to fit its container using a `ResizeObserver`. For each video and audio clip that is active at the current playhead time, the player renders an HTML `<video>` or `<audio>` element and keeps it synchronized by setting `currentTime` directly on the DOM element whenever the playhead changes.

For video clips, the player prefers the **proxy URL** (a lower-resolution version) when it is available, falling back to the original file only if the proxy hasn't been generated yet. This makes scrubbing in the editor smooth even for large files.

Playback is driven by a `requestAnimationFrame` loop inside `usePlayer`. The loop reads the real wall-clock time elapsed since the last `play()` call or seek and updates the playhead accordingly. It also stops automatically when the playhead enters a gap (a point in time where no video clip is present) or reaches the end of the composition.

### Transform Overlay

When a visual clip (video, image, or text) is selected, the preview player renders a `TransformOverlay` on top of its element. The overlay shows draggable corner handles for scaling and a rotation handle above the clip. All interactions use `mousedown` + global `mousemove`/`mouseup` event listeners for smooth operation even when the cursor leaves the element during a fast drag. The transform is updated in the store on every mouse move and committed to history on mouse up.

### Undo / Redo

The store maintains a `history` array of project snapshots. Every mutating action calls `pushHistory(description)` before applying its change, which deep-clones the current project state and appends it to the array. `undo` and `redo` walk the `historyIndex` pointer and restore the corresponding snapshot.

---

## 10. Loading Media Optimization

Working with raw, high-bitrate video files directly in the browser is expensive. Seeking and scrubbing produce stuttering because the browser has to decode compressed video frames on the fly. AloMedia addresses this with a **proxy workflow**.

When a video file is added to the project, the media library immediately registers a proxy job with `generateProxy` from `proxyEngine.ts`. A proxy is a **low-resolution, low-quality re-encode** of the original video: 640×360 pixels, CRF 28 (visually acceptable but much smaller), no audio. The proxy is generated **asynchronously in the background** so the user can start placing clips on the timeline right away.

Because both the proxy job and the final render use FFmpeg WASM, and a single WASM instance can only execute one job at a time, the proxy engine uses a **serial promise queue**. Each call to `generateProxy` chains its internal `runProxy` function onto the end of the queue with `.then()`. This guarantees jobs execute one at a time without any blocking or race conditions.

While the proxy is being generated, `proxyMap[mediaId].status` is `"pending"`. The preview player checks this map and uses the raw file as a fallback during this window. Once the proxy is ready, `status` becomes `"ready"` and `objectUrl` is set to a blob URL pointing to the transcoded data. The preview player switches to the proxy URL on the next render.

This two-URL pattern keeps the **editing experience smooth** (proxy) while the **original high-quality files** remain available for the final export, which always reads from `fileMap` directly.

Additionally, object URLs are managed carefully to avoid memory leaks. Both the media library and the preview player keep their own `Map<string, string>` registries of created object URLs and revoke them when the component unmounts.

---

## 11. Renderization

Rendering is the process of mixing all tracks and clips together into a single output video file. It is triggered by clicking "Export" in the editor's top bar.

### Render Pipeline (`renderPipeline.ts`)

Before FFmpeg is involved, the project data must be converted into a flat, ordered list of segments. The `buildRenderJob` function iterates over every track and every clip, converts each one to a `RenderSegment` using `clipToSegment`, attaches the parent track's `order` value as `trackOrder`, and sorts all segments by their `timelineStart` time. The result is a `RenderJob` object that also carries the desired output format (`mp4` or `webm`), resolution, and frame rate.

A `RenderSegment` is a simplified, denormalized view of a clip that contains only the fields FFmpeg needs: which file to read, what time range to use, where to place it on the timeline, any transform or volume settings, and the `trackOrder` for z-order compositing. Each segment carries its track's rendering priority so the FFmpeg engine can composite them correctly.

### FFmpeg Render (`ffmpegEngine.ts`)

The `renderJob` function receives the `RenderJob` and the `fileMap` and orchestrates the multi-step FFmpeg pipeline:

**Step 1 — Write inputs.** All unique media files referenced by the job are written into FFmpeg's in-memory virtual filesystem. Files that are not referenced (e.g., an asset in the library that was never placed on the timeline) are ignored.

**Step 2 — Trim video segments.** Each video segment is trimmed to its `mediaStart`/`mediaEnd` range and written to a temporary file. The `-c copy` flag skips re-encoding, making this step very fast.

**Step 3 — Composite or concatenate video.** The engine detects whether the timeline is single-track or multi-track by inspecting the unique `trackOrder` values across all video segments.

- **Single-track:** If all video segments belong to the same track and there are multiple segments, they are concatenated using FFmpeg's `concat` demuxer (same behavior as before — fast, no re-encoding).
- **Multi-track:** If segments span different tracks, the engine builds an overlay compositing pipeline:
  1. A black base canvas is generated using a `color=c=black:s=WxH:d=DURATION:r=FPS` lavfi source.
  2. Each trimmed segment is fed as a separate input with `-itsoffset` set to its `timelineStart`, so the video appears at the correct position in the timeline.
  3. Segments are sorted by `trackOrder` descending (background first). An `overlay` filter chain is built where each segment is overlaid in z-order — background clips first, foreground clips last — so the topmost track visually wins when clips overlap in time.
  4. If a segment's transform dimensions differ from the output resolution, a `scale` filter resizes it before the overlay. The clip's transform `x` and `y` values are used as the overlay position.
  5. The composited result is encoded with `libx264` (the overlay filter requires re-encoding).

**Step 4 — Mix audio.** Each audio segment is given a `volume` filter. All processed audio streams are then combined using FFmpeg's `amix` filter, which mixes multiple audio inputs into one stream. Audio segments from all tracks are collected.

**Step 5 — Mux output.** The video track (or composited result) and the mixed audio track are combined into the final output file. For single-track pipelines the video is stream-copied; for multi-track pipelines the video is already encoded by the overlay step. Audio is encoded to AAC.

**Step 6 — Return.** The output file is read from the virtual filesystem and returned as a raw `Uint8Array`.

Back in `VideoEditor`, the array is wrapped in a `Blob`, a temporary object URL is created, a hidden `<a>` tag is clicked programmatically to trigger the browser's download dialog, and the URL is immediately revoked to free memory.

---

## 12. Preview Player Deep Dive

This section documents the internal mechanics of `PreviewPlayer.tsx` and `usePlayer.ts` in detail. Understanding these internals is required before making any changes to playback, clip synchronization, or timeline-to-media mapping.

---

### Architecture Overview

The preview is a **timeline-driven playback system**: the timeline clock is always the source of truth, and all media elements (video, audio) are slaves that are commanded to a specific position on every frame. No DOM media element ever drives the timeline; the direction of control is always one-way:

```
Timeline Clock (requestAnimationFrame in usePlayer)
        ↓
  setPlayhead → Zustand store
        ↓
PreviewPlayer useEffect([playhead])
        ↓
For each active clip:
  mediaTime = clip.mediaStart + (playhead - clip.timelineStart)
  videoEl.currentTime = mediaTime
```

---

### Time Precision

All timeline and media boundary values (`timelineStart`, `timelineEnd`, `mediaStart`, `mediaEnd`) are stored in **seconds, rounded to the nearest millisecond**. This is enforced at every write path through the helpers in `utils/time.ts`:

```ts
import { toMs, toSeconds } from "../utils/time"

// Write
const cleanTime = toSeconds(toMs(rawSeconds))  // e.g. 4.9999999 → 5.000

// Read (already in seconds — use directly for currentTime, comparison, etc.)
video.currentTime = clip.mediaStart + offset
```

**Why this matters:** floating-point arithmetic accumulates small errors. Even a `0.0001 s` difference between `clipA.timelineEnd` and `clipB.timelineStart` creates a real gap in the timeline. By rounding to integer milliseconds at write time, adjacent clip boundaries are guaranteed to be bitwise identical and the gap never exists at the data level.

The write paths that apply rounding are:
- `setPlayhead` in `editorStore.ts` — called on every RAF frame and on scrub
- `splitClip` in `editorStore.ts` — the cut time is rounded once and shared verbatim to both halves
- `moveClip` in `editorStore.ts` — the new start position is rounded before recomputing the end

---

### Active Clip Detection

The preview must know which clips are "active" (visible) at the current playhead. The detection uses a small **epsilon window** (`CLIP_EPSILON = 0.001 s`, defined in `utils/time.ts`) on both edges:

```ts
clip.timelineStart - CLIP_EPSILON <= playhead &&
playhead < clip.timelineEnd + CLIP_EPSILON
```

The epsilon serves two purposes:

1. **Safety net against residual float drift** — even with rounding, the RAF-computed playhead is a floating-point sum of wall-clock deltas that can land fractionally outside a boundary. The 1 ms window absorbs that.
2. **Smooth boundary transitions** — the epsilon ensures the incoming clip is detected as active on the same frame that the outgoing clip ends, so there is never a frame where no clip is active.

**Tie-break rule:** when the epsilon window causes two adjacent clips on the same track to both qualify as active (which can happen for one frame at an exact boundary), the preview keeps only the clip with the **later `timelineStart`** — the incoming clip. This is computed per track inside the `activeClips` derivation in `PreviewPlayer`.

The `isInGap` function in `usePlayer.ts` uses the same epsilon on the right edge of each clip. This prevents the playback loop from incorrectly stopping at a clip boundary that only looks like a gap due to sub-ms float overrun.

---

### Media Element Lifecycle and the No-Flash Rule

Every `<video>` and `<audio>` element in the preview is **keyed by `clip.mediaId`**, not by `clip.id`. This is the most important property for seamless playback at clip boundaries.

**Why:** when a clip is split into two halves, both halves reference the same `mediaId` but have different `id`s. If the elements were keyed by `clip.id`, React would unmount the first element and mount a brand-new one when the second clip becomes active. The new element starts blank (black frame) and takes at least one browser paint cycle to decode the correct position, even if `currentTime` is set immediately. Keying by `mediaId` causes React to **reuse the exact same DOM element** for both halves — no unmount, no blank frame, no reload.

Consequences of this design:

- **Same `mediaId` transition (common for splits):** the same `<video>` element stays in the DOM. The sync effect only seeks `currentTime`. The browser does not re-fetch or re-decode the stream. No black frame.
- **Different `mediaId` transition:** React mounts a new `<video>` element with the new `src`. The element starts blank while the browser loads the stream. The `onLoadedMetadata` callback handles seeking to the correct offset and conditionally calling `play()` once the browser is ready.
- **`videoEl.src` is never set to an empty string.** The element always holds a valid blob URL from the moment it is mounted until it is unmounted. The `src` prop in JSX is the only place the source is written; no imperative `src = ''` anywhere.

**The `mediaRefsRef` map** (a `Map<string, HTMLVideoElement | HTMLAudioElement>`) is therefore keyed by `mediaId`. All sync lookups use `clip.mediaId` as the key, not `clip.id`.

---

### Seek–Before–Play Invariant

Every code path that initiates or resumes playback follows a strict order of operations:

1. Update `src` if the media file changed (different `mediaId` → new element via React, `src` set by React prop).
2. Set `currentTime` to the correct media offset.
3. Call `play()` — only after step 2.

```ts
// Correct — from the clip-transition block in PreviewPlayer
el.currentTime = Math.max(0, mediaTime)   // seek first
if (playing) el.play().catch(() => {})    // play after seek
```

Calling `play()` before `currentTime` is set causes the browser to display one or more frames from the element's previous position before the seek completes. This produces the "first-frame flash" — a brief glimpse of the wrong content at the start of each clip.

There is no `await` between step 2 and step 3. Both calls are synchronous within the same microtask. The browser queues the seek and the play internally and honors the seek position when it starts painting.

---

### Clip Transition Sync Flow

The playhead `useEffect` in `PreviewPlayer` runs on every playhead change (every RAF frame during playback and every scrub event). The flow is:

1. **Compute `activeIds`** — the set of clip IDs active at the current playhead, using epsilon.
2. **Compute `activeMediaIds`** — the derived set of `mediaId`s for those clips (video/audio only).
3. **Pause elements that are no longer active** — iterate `mediaRefsRef`; any element whose `mediaId` is not in `activeMediaIds` is paused.
4. **Detect `newlyActiveIds`** — diff `activeIds` against `prevActiveIdsRef` (the active IDs from the previous frame). Any ID that appears in `activeIds` but not in `prevActiveIdsRef` is a newly active clip.
5. **Seek and play newly active clips** — for each newly active video/audio clip, compute `mediaTime = clip.mediaStart + (playhead - clip.timelineStart)`, set `el.currentTime`, and call `el.play()` if `isPlaying`. This runs **before** the `if (playing) return` early-exit so it fires during active playback.
6. **Update `prevActiveIdsRef`** — record the current `activeIds` for next frame's diff.
7. **Scrub sync (paused state only)** — if not playing, seek all currently active elements to their correct `mediaTime`.

The `onLoadedMetadata` handler on each `<video>` and `<audio>` element covers the asynchronous case: if a new element is mounted (different `mediaId` clip) and its metadata has not loaded by the time step 5 runs, the handler re-runs the seek+play logic once the browser has parsed the stream headers. This ensures no clip is left frozen even on a cold cache.

---

### Gap Behavior

The playback loop (`usePlayer.ts`) calls `isInGap` on every RAF frame. The function scans **all video tracks** using `flatMap` — a gap only exists when **no** video track has a clip covering the current playhead position. If `isInGap` returns `true`, the loop stops and sets `isPlaying = false`. This is intentional — the preview cannot show video where no video clip exists on any track.

With epsilon, `isInGap` uses `time < clip.timelineEnd + CLIP_EPSILON` on the right edge so that the playhead overrunning a boundary by a sub-millisecond float error does not falsely stop playback. A real gap (any gap larger than `CLIP_EPSILON`) still stops playback correctly.

---

### Multi-Track Video Compositing

The preview player supports **simultaneous display of video clips from multiple tracks**. When clips from different video tracks overlap in time, all of them are rendered as separate `<video>` elements layered with CSS `z-index` derived from the track's `order` value.

**Primary vs. secondary clips:** The `VideoBufferManager` double-buffer handles the **primary** video clip — the one from the track with the lowest `order` value (topmost / foreground), as resolved by `getActiveVideoClip`. All other active video clips from other tracks are rendered as **secondary** `<video>` elements directly in the PreviewPlayer JSX.

**Z-index scheme:** The formula `maxOrder - track.order + 1` is applied to all visual elements (video, image, text). Lower `order` values produce higher z-index values, so the topmost track in the timeline UI renders in front. The double-buffer elements receive the z-index of the primary clip's track. Static elements (images, text) also carry z-index from their parent track.

**Secondary video sync:** Secondary video elements are synchronized by `useMediaSync`'s per-frame RAF callback. On each frame:
1. For each secondary clip, `currentTime` is set to `clip.mediaStart + (playhead - clip.timelineStart)`.
2. During playback, drift correction is applied: if the element's time drifts beyond `DRIFT_CORRECTION_THRESHOLD_S`, a corrective seek is issued.
3. Secondary elements are muted — audio is handled by the separate audio pool.

**Secondary element lifecycle:** Secondary `<video>` elements are keyed by `clip.mediaId` in the JSX and use `ref` callbacks to register/unregister themselves in a shared `Map<string, HTMLVideoElement>` ref. Their `src` is set to the proxy-aware playback URL (`getPlaybackUrl`) for smooth scrubbing. They mount when a clip enters the epsilon active window and unmount when it leaves.

---

### Adding a New Clip Type with Media

If a new clip type is added that references a media file and needs `<video>` or `<audio>` playback, the following requirements apply:

1. The clip's timeline/media time fields must be written through `toSeconds(toMs(...))` in the store action that creates it.
2. The JSX element must be keyed by `clip.mediaId`.
3. The `ref` callback must call `mediaRefsRef.current.set(clip.mediaId, el)`.
4. An `onLoadedMetadata` handler must seek to the correct offset before calling `play()`.
5. The clip type must be included in the `activeMediaIds` derivation and the `isPlaying` sync effect inside `PreviewPlayer`.
