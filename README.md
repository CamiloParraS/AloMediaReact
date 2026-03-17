# AloMedia Documentation

Welcome to the AloMedia documentation hub. This folder contains comprehensive guides covering all aspects of the video editing application.

## Documentation Index

### 📖 Start Here

**[GETTING_STARTED.md](GETTING_STARTED.md)** - Begin here if you're new to the project
- Setup and installation
- Project structure overview
- Development workflow
- Common issues and solutions
- Keyboard shortcuts and tips

### 🏗️ Architecture & Design

**[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design patterns
- High-level architecture overview
- Layered architecture explanation
- Directory structure and purpose
- Data flow through the system
- State management patterns
- Type safety approach

**[ROUTES.md](ROUTES.md)** - Navigation and routing structure
- Route hierarchy and organization
- Public vs. private routes
- Route protection mechanisms
- Navigation flows
- URL patterns and query parameters

### 🔐 Authentication & Security

**[AUTHENTICATION.md](AUTHENTICATION.md)** - User authentication system
- Session management with httpOnly cookies
- Authentication flow (login, register, recovery)
- Password recovery process
- Integration with route protection
- Error handling
- Security best practices

### 🎬 Video Editor

**[VIDEO_EDITOR.md](VIDEO_EDITOR.md)** - Deep dive into the video editing system
- Core concepts (projects, media, tracks, clips)
- Timeline component and interactions
- Media library and import process
- Preview player and playback synchronization
- Clip management (create, move, resize, split)
- Transform and effects system
- History and undo/redo
- Collision detection
- Synchronization algorithms

**[FFMPEG.md](FFMPEG.md)** - Video rendering and processing
- FFmpeg.wasm overview and setup
- Render pipeline architecture
- Rendering strategies (single-track, multi-track, compositing)
- Audio processing
- Output formats (MP4, WebM)
- Virtual filesystem management
- Performance optimization
- Error handling
- SharedArrayBuffer and multi-threading

### 🎨 User Interface & Styling

**[STYLES_UI.md](STYLES_UI.md)** - Design system and styling
- Color palette and themes
- Typography and fonts
- Animation and transitions
- Component patterns and library
- Responsive design
- Accessibility features
- Tailwind integration
- Dark mode implementation

### ⚙️ Configuration & Build

**[CONFIGURATION.md](CONFIGURATION.md)** - Build tools and project configuration
- Vite build configuration
- TypeScript configuration
- ESLint and linting setup
- Environment variables
- Development server setup
- Runtime constants
- Performance tuning
- Debugging tools
- Deployment configuration

## Quick Navigation by Topic

### For New Developers
1. [GETTING_STARTED.md](GETTING_STARTED.md) - Learn how to set up and run the project
2. [ARCHITECTURE.md](ARCHITECTURE.md) - Understand the overall structure
3. [STYLES_UI.md](STYLES_UI.md) - See how to build UI components

### For Frontend Development
- [ARCHITECTURE.md](ARCHITECTURE.md) - Component organization
- [ROUTES.md](ROUTES.md) - Navigation structure
- [STYLES_UI.md](STYLES_UI.md) - Styling and UI components
- [VIDEO_EDITOR.md](VIDEO_EDITOR.md) - Editor components (if working on editor)

### For Video Editor Features
- [VIDEO_EDITOR.md](VIDEO_EDITOR.md) - Timeline, media, clips, playback
- [FFMPEG.md](FFMPEG.md) - Rendering and export
- [CONFIGURATION.md](CONFIGURATION.md) - Performance tuning

### For Backend Integration
- [AUTHENTICATION.md](AUTHENTICATION.md) - Auth endpoints
- [ROUTES.md](ROUTES.md) - Frontend routing (for context)
- [ARCHITECTURE.md](ARCHITECTURE.md) - API integration points

### For DevOps & Deployment
- [CONFIGURATION.md](CONFIGURATION.md) - Build and deployment
- [ARCHITECTURE.md](ARCHITECTURE.md) - System requirements

## Key Concepts

### Project Structure
The application is organized into clear layers:
```
UI Components → State Management → Business Logic → Engines → APIs
```

### Main Features
- **Authentication**: User login/logout with secure sessions
- **Project Management**: Create and manage video projects
- **Timeline Editing**: Multi-track timeline with drag-and-drop clips
- **Real-time Preview**: Canvas-based video rendering with synchronization
- **Video Rendering**: FFmpeg.wasm-based export to MP4/WebM
- **Media Import**: Support for video, audio, and image files

### Technology Stack
- **Frontend**: React 19 + TypeScript
- **State**: Zustand (lightweight, performant)
- **Styling**: TailwindCSS with custom dark theme
- **Build**: Vite (fast, modern)
- **Video**: FFmpeg.wasm (browser-based encoding)
- **Routing**: React Router 7

## Common Tasks

### Adding a New Component
1. Create file in appropriate `src/components/` subfolder
2. Implement component with TypeScript interfaces
3. Use TailwindCSS classes for styling
4. Reference documentation in [STYLES_UI.md](STYLES_UI.md)

### Adding a New Route
1. Create page component in `src/pages/`
2. Add to router in `src/router.tsx`
3. Wrap with `PrivateRoute` or `PublicRoute` as needed
4. See [ROUTES.md](ROUTES.md) for details

### Modifying Editor Behavior
1. Update state in `src/store/editorStore.ts`
2. Modify component in `src/components/editor/`
3. Test with [VIDEO_EDITOR.md](VIDEO_EDITOR.md) concepts in mind

### Changing Styling
1. Modify Tailwind classes in component
2. Or update theme in `src/index.css`
3. Reference [STYLES_UI.md](STYLES_UI.md) for color/font variables

### Improving Video Rendering
1. Review [FFMPEG.md](FFMPEG.md) for rendering pipeline
2. Modify engine code in `src/engine/`
3. Test rendering with different project configurations

## File Organization Quick Reference

```
docs/
├── GETTING_STARTED.md      ← Start here
├── ARCHITECTURE.md         ← System design
├── ROUTES.md              ← Navigation
├── AUTHENTICATION.md      ← User sessions
├── VIDEO_EDITOR.md        ← Timeline & editing
├── FFMPEG.md              ← Video rendering
├── STYLES_UI.md           ← Design system
├── CONFIGURATION.md       ← Build & deploy
└── README.md              ← This file

src/
├── components/            ← React components
│   ├── editor/           ← Video editor components
│   └── ui/               ← Generic UI components
├── pages/                ← Page-level components
├── store/                ← Zustand state management
├── engine/               ← FFmpeg and rendering
├── player/               ← Video playback system
├── services/             ← Backend API calls
├── hooks/                ← Custom React hooks
├── utils/                ← Utility functions
├── context/              ← React Context (auth)
└── types/                ← TypeScript interfaces
```

## Contributing

When adding features or fixing bugs:

1. **Read relevant documentation** to understand existing patterns
2. **Follow the established architecture** - stay within layers
3. **Use TypeScript** - all new code should be properly typed
4. **Test thoroughly** - use browser DevTools and console
5. **Update documentation** if behavior changes significantly
6. **Run linting** - `npm run lint --fix` before committing

## Glossary

### Common Terms

- **Clip**: A reference to media (video/audio/image) placed on a track at a specific time
- **Track**: A horizontal lane containing clips, either audio or video type
- **Timeline**: The visual interface showing all tracks and clips chronologically
- **Transform**: 2D transformation properties (position, scale, rotation) applied to clips
- **Playhead**: The vertical indicator showing current playback position
- **Proxy**: Low-resolution version of video for smooth preview
- **Render**: Process of converting project to final video file using FFmpeg
- **Segment**: A single clip with position and transform, used during rendering
- **RenderJob**: Complete instructions for FFmpeg to produce video
- **Media**: Imported file (video/audio/image) ready to use in project

## Performance Notes

### Timeline Performance
- Zoom out to reduce rendering complexity
- Proxy videos enable smooth browsing without full resolution
- Clip lookup optimized with efficient algorithms

### Playback Performance
- Double buffering ensures smooth video playback
- Audio sync uses drift correction for perfect timing
- Canvas rendering optimized for 60fps

### Export Performance
- FFmpeg uses multi-threading via SharedArrayBuffer
- Larger projects may take significant time
- Memory usage scales with resolution and complexity

## Security Considerations

- **httpOnly cookies** protect auth tokens from XSS
- **CORS validation** on backend prevents unauthorized requests
- **Type safety** via TypeScript prevents many runtime errors
- **COOP/COEP headers** enable secure SharedArrayBuffer use

## Browser Support

Minimum browser versions:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

All require WebAssembly and SharedArrayBuffer support.

## Troubleshooting Guide

### FFmpeg Issues
→ See [FFMPEG.md](FFMPEG.md), section "Error Handling"

### Performance Problems
→ See [FFMPEG.md](FFMPEG.md), section "Performance Considerations"

### Build Errors
→ See [CONFIGURATION.md](CONFIGURATION.md), section "Troubleshooting Configuration Issues"

### Development Server Issues
→ See [GETTING_STARTED.md](GETTING_STARTED.md), section "Common Issues and Solutions"

## Additional Resources

- **React Documentation**: https://react.dev
- **TypeScript Handbook**: https://www.typescriptlang.org/docs
- **Vite Guide**: https://vitejs.dev/guide
- **TailwindCSS Docs**: https://tailwindcss.com/docs
- **React Router Docs**: https://reactrouter.com
- **Zustand GitHub**: https://github.com/pmndrs/zustand
- **FFmpeg Docs**: https://ffmpeg.org/documentation.html
- **Web APIs**: https://developer.mozilla.org/en-US/docs/Web/API

## Documentation Maintenance

These docs should be updated when:
- Architecture changes significantly
- New major features are added
- Dependencies are upgraded
- Build process changes
- Important patterns are established
- Security practices update

Last Updated: 2026-03-11

## Questions or Suggestions?

If documentation is unclear or incomplete:
1. Check relevant source files for more context
2. Review existing comments in code
3. Search through the documentation for related topics
4. Update documentation if you find issues (and commit the fix)

Happy coding! 🚀
