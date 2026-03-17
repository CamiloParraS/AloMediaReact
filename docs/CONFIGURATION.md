# Configuration Guide

## Overview

AloMedia uses several configuration files to manage build settings, linting, type checking, and runtime behavior. This guide explains each configuration file and how to modify them.

## Build Configuration

### Vite Configuration (`vite.config.ts`)

Vite is the build tool that bundles the React application and serves it during development.

**Current Configuration**:

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
})
```

**Plugins**:
- **react()**: Enables Fast Refresh for React components during development
- **tailwindcss()**: Integrates TailwindCSS v4 directly into the build

**Server Headers**:
These headers are critical for FFmpeg.wasm compatibility:
- **COOP** (Cross-Origin-Opener-Policy): `same-origin` restricts cross-site window opening but allows same-origin
- **COEP** (Cross-Origin-Embedder-Policy): `require-corp` requires all resources to be same-origin or have CORS headers

These headers enable SharedArrayBuffer, which FFmpeg uses for multi-threaded encoding.

**Optimization**:
- `exclude: [@ffmpeg/ffmpeg, @ffmpeg/util]`: Prevents Vite from pre-bundling FFmpeg packages
- Necessary because FFmpeg needs special loading from CDN with specific headers

### TypeScript Configuration (`tsconfig.json`)

Configures the TypeScript compiler:

```json
{
  "include": ["src"],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**Includes**: Only TypeScript files in `src/` are compiled

**References**: Project references for separate compilation contexts:

- `tsconfig.app.json`: Configuration for application code
- `tsconfig.node.json`: Configuration for build-time code (Vite config, etc.)

### TypeScript App Configuration (`tsconfig.app.json`)

Application-specific TypeScript settings:

**Key settings**:
- **target**: ES2020 (modern JavaScript features)
- **useDefineForClassFields**: true (modern class field syntax)
- **lib**: ES2020, DOM, DOM.Iterable (available APIs)
- **module**: ESNext (modern module syntax)
- **moduleResolution**: bundler (modern resolution algorithm)
- **skipLibCheck**: true (skip type checking of dependencies)
- **noEmitOnError**: true (don't output if errors exist)
- **strict**: true (enable all strict type checking)

### TypeScript Node Configuration (`tsconfig.node.json`)

Build-time configuration for Vite config file:

- **target**: ES2020
- **module**: ESNext
- **moduleResolution**: bundler

## Linting Configuration

### ESLint Configuration (`eslint.config.js`)

ESLint checks code quality and enforces style conventions:

```javascript
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
]
```

**Plugins**:
- **@eslint/js**: Core ESLint rules
- **eslint-plugin-react**: React-specific rules
- **eslint-plugin-react-hooks**: Enforces Rules of Hooks
- **typescript-eslint**: TypeScript support

**Key Rules**:
- React-in-JSX-scope off: Not needed with React 17+ JSX transform
- Prop-types off: Using TypeScript for type safety instead

### Run Linting

```bash
npm run lint
```

This checks all files and reports violations. Most issues can be auto-fixed by adding `--fix`:

```bash
npm run lint --fix
```

## Build Configuration

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

- **dev**: Start development server with Hot Module Replacement
- **build**: Compile TypeScript, then bundle with Vite
- **lint**: Check code quality with ESLint
- **preview**: Preview production build locally

### Build Output

When running `npm run build`:

1. TypeScript files compile to JavaScript (incremental mode, only changed files)
2. Vite bundles JavaScript, CSS, and assets
3. Output goes to `dist/` folder
4. Optimized for production (minification, tree-shaking, etc.)

Vite automatically:
- Minifies code
- Splits code into vendor and app bundles
- Hashes filenames for cache busting
- Optimizes images and other assets

## Runtime Configuration

### Environment Variables

Environment-specific configuration uses `.env` files:

**`.env`** (version control):
```
VITE_API_BASE_URL=http://localhost:3000
VITE_FFMPEG_TIMEOUT=300000
```

**`.env.production`** (production overrides):
```
VITE_API_BASE_URL=https://api.alomedia.com
```

**Reading in code**:
```typescript
const apiBase = import.meta.env.VITE_API_BASE_URL
const timeout = parseInt(import.meta.env.VITE_FFMPEG_TIMEOUT || '300000')
```

Note: Only variables prefixed with `VITE_` are exposed to the client.

### Constants

Application-wide constants are defined in `src/constants/`:

**`timeline.ts`**: Timeline-specific constants
```typescript
export const TIMELINE_ZOOM = 50 // pixels per second
export const DRIFT_CORRECTION_THRESHOLD_S = 0.033 // 33ms
```

These constants can be adjusted to tune performance:
- Increase zoom for finer timeline control
- Adjust drift threshold based on audio sync testing

## Development Configuration

### Vite Dev Server

The development server runs on `http://localhost:5173` by default.

**Advanced Configuration** (if needed):
```typescript
// vite.config.ts
server: {
  port: 3000,           // Change port
  strictPort: true,     // Fail if port taken
  open: true,          // Auto open browser
  cors: true,          // Enable CORS
}
```

## Browser Requirements

AloMedia requires:

- **Modern browser** with ES2020+ support
  - Chrome 80+
  - Firefox 75+
  - Safari 13+
  - Edge 80+

- **SharedArrayBuffer support** for FFmpeg multi-threading
  - All modern browsers support this
  - Requires COOP/COEP headers (configured in Vite)

- **WebAssembly support** for FFmpeg.wasm
  - Universal support in modern browsers

## Deployment Configuration

### Production Build

```bash
npm run build
```

Creates a `dist/` folder containing:
- `index.html`: Main HTML file
- `assets/`: Bundled JavaScript and CSS
- Static files from `public/`

### Serving the Build

The built application is a static site that can be served from any web server:

```bash
# Simple local preview
npm run preview

# Deploy to production (examples)
# Vercel: vercel deploy
# Netlify: netlify deploy --prod
# GitHub Pages: Push to gh-pages branch
```

### Environment Setup

For production deployment:

1. Set `VITE_API_BASE_URL` to production API endpoint
2. Ensure backend API is deployed and accessible
3. Configure CORS on backend to accept requests from frontend domain
4. Set secure cookies (HttpOnly, Secure, SameSite=Strict)
5. Enable HTTPS (required for secure cookies)

## Performance Tuning

### FFmpeg Configuration

Adjust FFmpeg behavior in `src/engine/ffmpegEngine.ts`:

```typescript
// Longer timeout for slow connections
const FFmpeg_TIMEOUT = 600000 // 10 minutes

// WASM source (alternatives)
const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm"
// Could use different CDN or local server
```

### Timeline Performance

In `src/constants/timeline.ts`:

```typescript
// Reduce for faster rendering on slower devices
export const TIMELINE_ZOOM = 30

// Increase for stricter audio sync
export const DRIFT_CORRECTION_THRESHOLD_S = 0.016 // 16ms
```

### Memory Management

Consider adding memory limits:

```typescript
// Max project size before warning
const MAX_MEDIA_SIZE = 500 * 1024 * 1024 // 500MB

// Max number of clips
const MAX_CLIPS = 1000

// Max undo history
const MAX_HISTORY_SIZE = 50
```

## Debugging

### Browser DevTools

1. Open DevTools (F12 or Ctrl+Shift+I)
2. **Console**: View logs and errors
3. **Network**: Monitor API requests
4. **Performance**: Profile frame rendering
5. **Memory**: Check for memory leaks

### Source Maps

In development, source maps are generated for full debugging:
- Click line numbers in DevTools to set breakpoints
- Step through TypeScript code directly
- View variable values at runtime

### Vite Debug Mode

Set environment variable:
```bash
DEBUG=vite:* npm run dev
```

## CI/CD Configuration

Example GitHub Actions workflow:

```yaml
name: Build and Deploy

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - uses: actions/upload-artifact@v2
        with:
          name: dist
          path: dist/
```

## Common Configuration Changes

### Change API Endpoint
```typescript
// .env
VITE_API_BASE_URL=https://new-api.example.com
```

### Increase Build Timeout
```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-router', 'zustand']
      }
    }
  }
}
```

### Add Environment Variable
1. Add to `.env`: `VITE_NEW_VAR=value`
2. Access in code: `import.meta.env.VITE_NEW_VAR`
3. TypeScript will auto-complete if vite/client is in types

### Adjust TypeScript Strictness
```json
// tsconfig.app.json
{
  "compilerOptions": {
    "strict": false,      // Turn off strict mode
    "noImplicitAny": false
  }
}
```

## Troubleshooting Configuration Issues

### Port Already in Use
```bash
# Find process using port 5173
lsof -i :5173

# Use different port
VITE_PORT=3001 npm run dev
```

### CORS Errors
Check that backend:
- Is running
- Is on whitelisted origin
- Has CORS headers configured
- API URL is correct in `.env`

### FFmpeg Not Loading
- Check browser console for WASM errors
- Verify COOP/COEP headers are set
- Ensure browser supports SharedArrayBuffer
- Check CDN connectivity

### TypeScript Errors After Dependency Update
```bash
npm install
npm run build  # Full rebuild
```

## Security Considerations

### Secret Management

Never commit secrets to version control:

```bash
# Create .env.local (ignore in git)
VITE_API_KEY=secret_key_here

# In .gitignore
.env.local
.env.*.local
```

Note: Only `VITE_` variables are exposed to client code. Server secrets don't go to frontend.

### Content Security Policy

Consider adding CSP headers:

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob:;
  media-src 'self' blob:;
```

Required for browser-based video processing due to wasm-unsafe-eval.

## Future Configuration Considerations

- Feature flags for A/B testing
- Analytics configuration
- Error tracking setup (Sentry)
- Performance monitoring
- CDN configuration
- Cache strategies
- Internationalization (i18n)
