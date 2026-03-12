# Getting Started Guide

## Welcome to AloMedia

AloMedia is a web-based video editing platform that allows users to compose, edit, and render professional-quality videos directly in their browser. This guide will help you get started with the project.

## Prerequisites

Before you begin, ensure you have:

- **Node.js**: Version 18+ (check with `node --version`)
- **npm**: Version 9+ (comes with Node.js)
- **Git**: For version control (check with `git --version`)
- **A modern web browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **A code editor**: VS Code recommended (free)

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AloMedia
```

### 2. Install Dependencies

```bash
npm install
```

This installs all project dependencies listed in `package.json`, including:
- React 19 and related packages
- Vite build tool
- TailwindCSS for styling
- FFmpeg.wasm for video processing
- React Router for navigation
- Zustand for state management
- TypeScript and dev tools

Installation typically takes 2-5 minutes depending on your internet speed.

### 3. Start the Development Server

```bash
npm run dev
```

This starts the Vite development server with Hot Module Replacement (HMR):

```
VITE v7.3.1  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Press h to show help
```

Open your browser to `http://localhost:5173/` to see the app running.

## Understanding the Project Structure

```
AloMedia/
├── src/
│   ├── App.tsx              # Root component
│   ├── main.tsx             # App entry point
│   ├── router.tsx           # Route definitions
│   ├── index.css            # Tailwind and theme
│   ├── api/                 # HTTP client
│   ├── components/          # React components
│   ├── context/             # React context
│   ├── engine/              # FFmpeg and rendering
│   ├── player/              # Playback system
│   ├── store/               # Zustand state
│   ├── services/            # Backend API calls
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript types
│   ├── constants/           # App constants
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Page components
│   └── ...
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md
│   ├── ROUTES.md
│   ├── AUTHENTICATION.md
│   ├── VIDEO_EDITOR.md
│   ├── FFMPEG.md
│   ├── STYLES_UI.md
│   ├── CONFIGURATION.md
│   └── GETTING_STARTED.md   # This file
├── public/                  # Static assets
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # Linting rules
└── tsconfig.app.json        # App TypeScript config
```

## Available Scripts

### Development

```bash
npm run dev
```
Starts the development server with hot reloading. Changes to files automatically refresh the browser.

### Building

```bash
npm run build
```
Creates a production-ready build in the `dist/` folder. This includes:
- TypeScript compilation
- Code bundling and minification
- Asset optimization

### Linting

```bash
npm run lint
```
Checks code quality using ESLint. Add `--fix` to auto-fix issues:

```bash
npm run lint -- --fix
```

### Preview Production Build

```bash
npm run preview
```
Locally serves the production build to test it before deployment.

## First Look at the Application

### Authentication Pages

When you start the dev server, you're redirected to `/auth/login`. Here you can:

1. **Login**: If you have credentials from a backend instance
2. **Register**: Create a new account
3. **Recover**: Reset a forgotten password

**Note**: These require a backend API running. For development without a backend, you may need to mock the authentication. See the [Authentication documentation](AUTHENTICATION.md) for details.

### Dashboard

After logging in (or if backend is mocked), you see the Dashboard at `/dashboard`:

- Displays user's projects
- Options to create new projects
- Links to existing projects

**Current Status**: Dashboard UI structure is in place but may not be fully functional depending on backend implementation.

### Video Editor

Access the editor at `/editor` (this is currently unprotected for development):

- **Timeline**: Shows tracks and clips
- **Media Library**: Upload and browse media
- **Preview Player**: Real-time preview of video composition
- **Toolbar**: Playback controls and settings

Try these actions:

1. **Add Media**: Click "Add Media" button to import a video, audio, or image file
2. **Drag to Timeline**: Drag the media to a track to create a clip
3. **Play**: Click play button to preview
4. **Move Clip**: Drag clips on the timeline to different positions
5. **Zoom Timeline**: Use mouse wheel to zoom in/out

## Development Workflow

### Editing Code

1. Open any file in `src/`
2. Make changes
3. Browser automatically refreshes (HMR)
4. See your changes instantly

### TypeScript Support

The project uses TypeScript for type safety:

```typescript
// Good: Properly typed
function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
  console.log(event.currentTarget)
}

// Will show error if types don't match
```

Use your editor's intellisense to see available properties and methods.

### React Component Development

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
