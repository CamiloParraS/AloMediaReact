# Getting Started Guide
# AloMedia — Getting Started

## What is AloMedia?

AloMedia is a **browser-based, non-linear video editor**. It runs entirely in the browser with no server-side media processing. Users can import video, audio, and image files; arrange them on a multi-track timeline; apply per-clip color grading and audio effects; and export a final MP4 file — all without leaving their browser tab.

---

## Prerequisites

- **Node.js** 18+ (`node --version` to check)
- **npm** 9+ (bundled with Node.js)
- **A Chromium-based browser** (Chrome or Edge recommended). The WASM multi-threading model used by FFmpeg requires `SharedArrayBuffer`, which is available in all modern browsers on pages served with the correct security headers (configured automatically in the dev server).

---

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file at the project root:

```
VITE_BASE_URL=http://localhost:8080
```

This points to the backend API used for authentication. The editor itself works without a backend — only the auth flow requires a live API.

### 3. Start the Development Server

```bash
npm run dev
```

The Vite dev server starts at `http://localhost:5173`. It automatically sets the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers required for FFmpeg WASM multi-threading.

### 4. Access the Editor Directly

The video editor is accessible at `/editor` without authentication (it has no route guard in the current dev setup). To test without a backend, navigate directly to `http://localhost:5173/editor`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | TypeScript compile + Vite production bundle |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint check (`--fix` to auto-correct) |

---

## Project Structure

```
AloMedia/
├── src/
│   ├── api/            HTTP client + error types
│   ├── components/     React UI components
│   │   └── editor/     Editor-specific panels
│   ├── constants/      Shared numeric constants
│   ├── context/        AuthProvider (React Context)
│   ├── engine/         FFmpeg render + proxy engines
│   ├── hooks/          usePlayer, useTimeline, useAuth
│   ├── layouts/        AuthLayout
│   ├── pages/          Route-level page components
│   ├── player/         Real-time playback subsystem
│   ├── project/        Project types + serializer
│   ├── routes/         PublicRoute / PrivateRoute guards
│   ├── services/       authService
│   ├── store/          Zustand editor store
│   ├── types/          Shared TypeScript type definitions
│   └── utils/          Pure utility functions
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md      System overview and design decisions
│   ├── DATA_MODEL.md        Project types (Track, Clip, Media, etc.)
│   ├── STATE_MANAGEMENT.md  Zustand store and history system
│   ├── PLAYER.md            Real-time playback engine
│   ├── FFMPEG.md            Engine layer (render + proxy)
│   ├── EDITOR_COMPONENTS.md All editor UI components
│   ├── HOOKS_AND_UTILS.md   Custom hooks and utility functions
│   ├── AUTHENTICATION.md    Auth system and session management
│   ├── ROUTES.md            Routes, guards, and API layer
│   ├── VIDEO_EDITOR.md      Editor user guide
│   ├── STYLES_UI.md         Styling conventions
│   └── CONFIGURATION.md     Environment and build configuration
├── public/                  # Static assets
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # Linting rules
└── tsconfig.app.json        # App TypeScript config
└── tsconfig.app.json        # App TypeScript config
```

---

## First Workflow: Editing a Video

1. **Open the editor** — Navigate to `http://localhost:5173/editor`.
2. **Import media** — Click "Add Media" in the left panel. Select one or more video, audio, or image files. Video files are immediately transcoded to a 360p proxy in the background for smooth playback.
3. **Add clips to the timeline** — Drag a card from the media library onto a track, or double-click a card to insert it at the current playhead position.
4. **Play the preview** — Use the transport controls below the preview canvas. The canvas composites all active clips across all tracks simultaneously.
5. **Edit clips** — Drag clips to reposition them. Drag the right edge to resize. Right-click for split, copy, delete, or extract audio.
6. **Adjust a clip** — Select a clip on the timeline, then use the Inspector panel (right side) to adjust color grading, audio levels, fades, or playback speed.
7. **Export** — Click "Export" in the top bar. The FFmpeg engine renders the full timeline to an MP4 file, which the browser downloads automatically.

---

## Key Concepts to Understand First

Before diving into the code, familiarize yourself with these documents in order:

1. [ARCHITECTURE.md](ARCHITECTURE.md) — Three-layer system (UI, Player, Engine) and their interaction model.
2. [DATA_MODEL.md](DATA_MODEL.md) — The Project/Track/Clip type tree that everything else builds on.
3. [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) — How the Zustand store works and the undo/redo system.
4. [PLAYER.md](PLAYER.md) — The real-time playback engine (the most complex subsystem).
5. [EDITOR_COMPONENTS.md](EDITOR_COMPONENTS.md) — What each UI component does.

---

## Production Deployment Notes

Any web server hosting the production build must set these HTTP response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without them, `SharedArrayBuffer` is blocked by the browser and the FFmpeg WASM engine fails to initialize. These are configured automatically in the Vite dev server via `vite.config.ts`, but must be manually configured in Nginx, Caddy, or whatever serves the production build.

Example of creating a new component:

```typescript
// src/components/MyComponent.tsx
import { useRef } from 'react'

interface MyComponentProps {
  title: string
  onAction: () => void
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div className="flex gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button onClick={onAction} className="px-4 py-2 bg-accent-red rounded">
        Click me
      </button>
    </div>
  )
}
```

## Working with State

### Zustand Store

Access editor state from any component:

```typescript
import { useEditorStore } from '../store/editorStore'

export function MyComponent() {
  const project = useEditorStore(s => s.project)
  const playhead = useEditorStore(s => s.playhead)
  const setPlayhead = useEditorStore(s => s.setPlayhead)

  return (
    <div>
      <p>Project: {project.name}</p>
      <p>Playhead: {playhead}s</p>
      <button onClick={() => setPlayhead(10)}>Jump to 10s</button>
    </div>
  )
}
```

### React Context

UseContext for authentication:

```typescript
import { useAuth } from '../hooks/useAuth'

export function UserProfile() {
  const { user, isAuthenticated, logout } = useAuth()

  if (!isAuthenticated) return <p>Not logged in</p>

  return (
    <div>
      <p>Logged in as: {user?.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

## Debugging

### Browser DevTools

1. Press F12 to open Developer Tools
2. **Console**: See any errors or logs
3. **Network**: Monitor API requests
4. **Performance**: Profile frame rendering
5. **React DevTools** Extension: Inspect React component tree

### Logging

Use console.log for debugging:

```typescript
console.log('State:', useEditorStore.getState())
console.log('User:', user)
```

### TypeScript Errors

VS Code shows TypeScript errors inline:

```typescript
// Red squiggle under variable means type error
const result: string = 123  // Type error: number is not string
```

Hover over the error to see the message. Fix by using correct type:

```typescript
const result: number = 123  // Correct
```

## Testing the Video Editor

### Import Media

1. Click **Add Media** button
2. Select a video, audio, or image file from your computer
3. File appears in the media panel
4. For video files, a proxy starts generating

### Create Clips

1. Drag media from the panel onto a track
2. A clip appears on the timeline
3. Clip shows duration and position on track

### Edit Timeline

- **Move clips**: Drag clips left/right to change timing
- **Resize clips**: Drag clip edges to trim
- **Zoom**: Use mouse wheel to zoom in/out
- **Scrub**: Click on the timeline to move playhead

### Preview Playback

1. Click **Play** button
2. Video plays in the canvas
3. Playhead advances automatically
4. Audio plays if audio clips are present

### Add Multiple Tracks

1. Click **+ Add Track** button
2. Select Video or Audio
3. New track appears below existing tracks
4. Add clips to the new track

## Common Issues and Solutions

### FFmpeg Not Loading

**Problem**: Blank preview canvas or console errors about WASM

**Solution**:
- Ensure development server headers are set (they should be by default)
- Check browser console for detailed errors
- Try a different browser (Chrome has best support)

### Slow Performance

**Problem**: Timeline is sluggish or preview jerky

**Solution**:
- Zoom out to see more timeline (less rendering)
- Close other browser tabs to free memory
- Reduce preview resolution (if option available)
- Use proxy videos instead of full quality

### Changes Not Showing

**Problem**: Edited code doesn't appear in browser

**Solution**:
- Check that dev server is still running
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check console for build errors
- Restart dev server: Stop (Ctrl+C) and run `npm run dev` again

### Memory Issues

**Problem**: Browser tab becomes unresponsive

**Symptoms**:
- "Page unresponsive" message
- Slowdown when adding many clips
- Export taking a very long time

**Solution**:
- Export in smaller chunks if possible
- Close other applications to free up RAM
- Use simpler project (fewer clips)
- Consider streaming render instead of full file

## Next Steps

### Learn More

Read the detailed documentation:

1. **[ARCHITECTURE.md](ARCHITECTURE.md)**: System design and component organization
2. **[ROUTES.md](ROUTES.md)**: Navigation and page structure
3. **[AUTHENTICATION.md](AUTHENTICATION.md)**: User login and session management
4. **[VIDEO_EDITOR.md](VIDEO_EDITOR.md)**: Timeline, clips, rendering (most complex)
5. **[FFMPEG.md](FFMPEG.md)**: Video rendering and encoding
6. **[CONFIGURATION.md](CONFIGURATION.md)**: Build settings and deployment
7. **[STYLES_UI.md](STYLES_UI.md)**: Theming and component styling

### Setup a Backend

The application currently works without backend but needs one for full functionality:

1. Database: PostgreSQL or similar
2. Authentication API: Create `/auth/login`, `/auth/register`, `/auth/me`, `/auth/logout` endpoints
3. Projects API: Create `/projects` endpoints for CRUD operations
4. File storage: S3 or similar for storing videos

Refer to the API types in `src/types/` for request/response formats.

### Contribute to Features

Ideas for next features to implement:

- **Video Effects**: Color correction, blur, brightness
- **Transitions**: Fade, wipe, slide between clips
- **Text Overlays**: Titles and subtitles
- **Keyframe Animation**: Animate clip transforms over time
- **Multi-select**: Edit multiple clips at once
- **Better UI**: Keyboard shortcuts, right-click menus
- **Mobile UI**: Touch-friendly editing interface

### Deploy the Application

When ready for production:

1. Create a production-ready backend
2. Configure environment variables
3. Run `npm run build`
4. Deploy to services like:
   - Vercel (recommended for Next.js but works with Vite)
   - Netlify (great for Vite builds)
   - AWS, Google Cloud, Azure
   - Self-hosted servers

See [CONFIGURATION.md](CONFIGURATION.md) for detailed deployment instructions.

## Performance Tips

### Development

- Maximize memory available to Node: `NODE_OPTIONS=--max-old-space-size=4096 npm run dev`
- Use the Lighthouse extension to check performance

### Production Build

- Run `npm run build` locally to test before deploying
- Use `npm run preview` to test the production build
- Monitor Core Web Vitals to ensure good performance

## Getting Help

When stuck:

1. **Check the documentation**: Start with relevant .md file in `/docs`
2. **Browser console**: Open DevTools → Console, look for error messages
3. **VS Code problems panel**: See TypeScript errors
4. **Search codebase**: Look for similar examples elsewhere in code
5. **Check comments in code**: Many functions have explanatory comments

## Quick Reference

| Task | Command |
|------|---------|
| Start dev | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Fix lint | `npm run lint -- --fix` |
| Preview build | `npm run preview` |
| Install deps | `npm install` |
| Update deps | `npm update` |

## Keyboard Shortcuts (Future)

Consider implementing these shortcuts for faster workflow:

- **Space**: Play/pause
- **↑/↓**: Select next/previous clip
- **Delete**: Delete selected clip
- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Ctrl+A**: Select all
- **,**: Previous frame
- **.**: Next frame
- **0-9**: Jump to percentage of timeline

## Resources

- **React Docs**: https://react.dev
- **TypeScript**: https://www.typescriptlang.org
- **Vite**: https://vite.dev
- **Tailwind**: https://tailwindcss.com
- **React Router**: https://reactrouter.com
- **Zustand**: https://zustand.surge.sh
- **FFmpeg Docs**: https://ffmpeg.org/documentation.html

## Conclusion

You're now ready to start developing with AloMedia! The architecture is modular and well-organized, making it easy to add new features. Start by exploring the existing components, then try making small changes to get comfortable with the workflow.

Happy coding!
