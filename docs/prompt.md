# Fix Prompt: Timeline Ruler Position, Playhead Overlap & Zoom Simplification

## Context

You are working on **AloMedia**, a browser-based video editor built with React 19, TypeScript, and Zustand. The following files are directly relevant:

- `src/components/editor/Timeline.tsx` — timeline container, ruler, track layout, scroll area
- `src/components/editor/Track.tsx` — individual track row
- `src/components/editor/TimelineZoomBar.tsx` — the zoom bar component to be removed
- `src/store/editorStore.ts` — Zustand store; `timelineScale` / `pixelsPerSecond` field
- `src/constants/timeline.ts` — `MIN_PIXELS_PER_SECOND`, `MAX_PIXELS_PER_SECOND`, `DEFAULT_PIXELS_PER_SECOND`, `ZOOM_STEP`
- `src/utils/time.ts` — time/pixel conversion utilities

Read all of the above before writing any code. This prompt has three closely related fixes that must be applied together because they share the same layout structure.

---

## Problem 1 — Ruler Is Not at the Top / Playhead Covers Tracks

### The Bug

The time ruler is not positioned at the very top of the timeline area, or the playhead vertical line (the red cursor that shows current time) is rendered in a way that overlaps and covers clip content in the track rows below it.

### Required Layout

The timeline must follow this exact vertical structure from top to bottom, with no overlapping layers:

```
┌──────────────────────────────────────────────────────┐
│  Ruler  (fixed height, sits above all tracks)        │  ← h-8, position in normal flow
├──────────────────────────────────────────────────────┤
│  Track 1   [  Clip A  ]       [  Clip B  ]           │
│  Track 2         [  Clip C  ]                        │
│  Track N   ...                                       │
└──────────────────────────────────────────────────────┘
```

**Rules:**

- The ruler must be the **first child** in the timeline scroll container, rendered in normal document flow — not `position: absolute`, not `position: fixed`, not `z-index` stacked over the tracks.
- The ruler must have a fixed height of `h-8` (32px). It must not grow or shrink.
- The track rows begin immediately below the ruler with no gap and no overlap.
- The playhead vertical line must extend from the **bottom edge of the ruler** downward through all track rows. It must not start above the ruler or cover the ruler's time labels.
- The playhead line must be rendered using `position: absolute` inside a container that starts at the ruler's bottom edge — meaning the absolute positioning context must be the track area, not the full timeline including the ruler. If the current implementation uses a single `position: relative` wrapper around both the ruler and the tracks, split it: the ruler sits outside this wrapper, and the wrapper covers only the tracks.

### How to Fix

1. Read `Timeline.tsx` and identify the current DOM structure.
2. If the ruler is inside a `position: relative` container shared with tracks, extract it above that container so it is a sibling, not a child of the same stacking context.
3. Ensure the playhead line's `position: absolute` and `top: 0` is relative to the **track area wrapper**, not the full timeline. `top: 0` on the playhead line must align with the top of Track 1, not the top of the ruler.
4. The ruler itself must be `position: relative` or `position: static` — it must not be `position: absolute`, which would remove it from document flow and allow tracks to start at the top of the page.
5. Do not change the ruler's content (time labels, tick marks, gridlines) — only fix its position in the layout hierarchy.

---

## Problem 2 — Remove the Zoom Bar Component Entirely

### What to Remove

Delete `src/components/editor/TimelineZoomBar.tsx` entirely.

Remove every reference to it:
- The `import` statement in `Timeline.tsx`.
- The `<TimelineZoomBar />` JSX element wherever it is mounted.
- Any props passed to it from the parent (`pixelsPerSecond`, `onZoomChange`, etc.).
- Any `useState` or `useCallback` in `Timeline.tsx` that existed solely to drive the zoom bar slider.

Do not leave dead imports or unused variables after removal.

### What to Keep

The `timelineScale` (or `pixelsPerSecond`) value in the Zustand store must remain — it is still used by the ruler gridline calculation, the clip width rendering, and the new zoom mechanism described below.

The `MIN_PIXELS_PER_SECOND`, `MAX_PIXELS_PER_SECOND`, `DEFAULT_PIXELS_PER_SECOND`, and `ZOOM_STEP` constants in `src/constants/timeline.ts` must remain — they are still needed.

---

## Problem 3 — Replace Zoom Bar with Press-and-Hold Zoom

### Required Behavior

The user zooms in and out by **pressing and holding** the left or right mouse button on a dedicated zoom control area, without any slider.

Specifically:

- Add a small zoom control strip at the **bottom** of the timeline area (below all tracks), full width.
- The strip contains two buttons side by side, centered:
  - A **zoom out** button labeled `−` or using the Lucide `ZoomOut` icon.
  - A **zoom in** button labeled `+` or using the Lucide `ZoomIn` icon.
- When the user **presses and holds** either button, the zoom continuously changes at a steady rate until the button is released.
- When the user **releases** the button, zooming stops immediately.
- A single click (press and release quickly) produces one small zoom step.

### Implementation

**Do not use `onClick` for the zoom buttons.** `onClick` only fires once per click. The continuous zoom-while-held behavior requires `onPointerDown` and `onPointerUp` / `onPointerCancel`.

Inside `Timeline.tsx`, implement the hold-to-zoom logic with an interval:

```typescript
const zoomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

function startZoom(direction: 'in' | 'out') {
  // Apply one step immediately so single clicks feel responsive
  applyZoomStep(direction)
  // Then continue applying steps while held
  zoomIntervalRef.current = setInterval(() => {
    applyZoomStep(direction)
  }, 80)  // 80ms between steps — adjust if too fast or too slow
}

function stopZoom() {
  if (zoomIntervalRef.current !== null) {
    clearInterval(zoomIntervalRef.current)
    zoomIntervalRef.current = null
  }
}

function applyZoomStep(direction: 'in' | 'out') {
  const current = useEditorStore.getState().timelineScale  // read directly from store, not from React state
  const next = direction === 'in'
    ? Math.min(MAX_PIXELS_PER_SECOND, current * ZOOM_STEP)
    : Math.max(MIN_PIXELS_PER_SECOND, current / ZOOM_STEP)
  setTimelineScale(next)  // dispatch to store
}
```

**Button event wiring:**

```tsx
<button
  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startZoom('out') }}
  onPointerUp={stopZoom}
  onPointerCancel={stopZoom}
  onPointerLeave={stopZoom}
  className="..."
>
  −
</button>
<button
  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startZoom('in') }}
  onPointerUp={stopZoom}
  onPointerCancel={stopZoom}
  onPointerLeave={stopZoom}
  className="..."
>
  +
</button>
```

Use `setPointerCapture` so the button continues receiving pointer events even if the user moves the mouse slightly off the button while holding.

**Clean up on unmount:**

```typescript
useEffect(() => {
  return () => stopZoom()  // clear interval if component unmounts while zooming
}, [])
```

### Zoom Strip Styling

The zoom strip must use existing Tailwind classes and design tokens only:

- Container: `flex items-center justify-center gap-3 py-1 border-t border-dark-border bg-dark-surface`
- Each button: `w-7 h-7 flex items-center justify-center rounded text-muted hover:text-accent-white hover:bg-dark-elevated transition-colors select-none cursor-pointer text-lg font-light`
- Do not add a zoom percentage label or any other text. Just the two buttons.
- The strip must be outside the scrollable track area — it is a fixed-height footer of the timeline panel, not something that scrolls horizontally with the clips.

---

## What NOT To Do

### ❌ Do not touch files outside the timeline layout
Off-limits:

- `src/engine/` — any file
- `src/player/` — any file
- `src/utils/audioFilters.ts`, `src/utils/colorAdjustmentFilters.ts`, `src/utils/speedFilters.ts`, `src/utils/snapUtils.ts`
- `src/components/editor/ColorAdjustmentsPanel.tsx`
- `src/components/editor/AudioConfigPanel.tsx`
- `src/components/editor/InspectorPanel.tsx`
- `src/components/editor/Clip.tsx` — unless the playhead overlap specifically originates from a CSS class defined there
- `src/project/projectTypes.ts`
- Anything under `src/api/`, `src/services/`, `src/context/`, `src/routes/`, `src/layouts/`, `src/pages/`
- `src/components/ui/` — any file
- `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `eslint.config.js`
- `src/index.css`

### ❌ Do not use `onClick` for the zoom buttons
`onClick` fires once. The required behavior is continuous zoom while held. Use `onPointerDown` to start the interval and `onPointerUp` / `onPointerCancel` / `onPointerLeave` to stop it.

### ❌ Do not use `useState` to track whether the zoom button is held
An interval ref (`useRef`) is sufficient and does not cause re-renders on press/release. Do not add `isHoldingZoom` state.

### ❌ Do not position the ruler with `position: absolute`
Absolute positioning removes the ruler from document flow, which would cause the track rows to start at the top of the container and be visually covered by the ruler. The ruler must occupy space in the normal flow so tracks begin below it.

### ❌ Do not extend the playhead line into the ruler
The playhead line must start at the top of the first track row. If it currently starts at `top: 0` of a container that includes the ruler, move the `position: relative` context to wrap only the track area.

### ❌ Do not leave any reference to `TimelineZoomBar` after deletion
After deleting the file, search for every import, every JSX usage, and every prop that referenced it. Remove all of them. The build must pass with zero unused import warnings.

### ❌ Do not add new CSS custom properties or Tailwind config extensions
Use only existing design tokens and utility classes.

---

## Required Files

| File | Action | Purpose |
|---|---|---|
| `src/components/editor/Timeline.tsx` | Modify | Fix ruler position in DOM flow; fix playhead stacking context; remove `TimelineZoomBar` import and usage; add zoom strip with hold-to-zoom buttons |
| `src/components/editor/TimelineZoomBar.tsx` | **Delete** | No longer needed |
| `src/components/editor/Track.tsx` | Modify only if needed | Fix any CSS that contributes to playhead overlap |

---

## Verification Checklist

### Ruler position
- [ ] The ruler appears at the very top of the timeline area with no content above it.
- [ ] Track rows begin immediately below the ruler with no gap or overlap.
- [ ] The ruler is not covering any clip content.
- [ ] Scrolling the timeline horizontally moves the ruler and tracks together.

### Playhead
- [ ] The playhead vertical line starts at the top of Track 1, not above it.
- [ ] The playhead line does not overlap or cover the ruler's time labels.
- [ ] The playhead line extends through all track rows.
- [ ] Clicking the ruler still moves the playhead correctly (existing behavior unchanged).

### Zoom bar removal
- [ ] `TimelineZoomBar.tsx` file no longer exists.
- [ ] No import of `TimelineZoomBar` anywhere in the codebase.
- [ ] `npm run build` or `tsc --noEmit` produces zero errors related to the removed component.

### Hold-to-zoom
- [ ] Pressing and holding `+` continuously zooms in until released.
- [ ] Pressing and holding `−` continuously zooms out until released.
- [ ] Releasing either button immediately stops zooming.
- [ ] A single quick click applies exactly one zoom step.
- [ ] Zoom is clamped — holding `+` past `MAX_PIXELS_PER_SECOND` does nothing further.
- [ ] Zoom is clamped — holding `−` past `MIN_PIXELS_PER_SECOND` does nothing further.
- [ ] Zoom strip is at the bottom of the timeline, outside the scrollable track area.
- [ ] Zoom strip does not scroll horizontally with the clips.