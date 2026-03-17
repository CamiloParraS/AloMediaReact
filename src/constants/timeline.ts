// Minimum pixels per second (most zoomed out — around 1 hour in ~1800px).
export const MIN_PIXELS_PER_SECOND = 0.5

// Maximum pixels per second (most zoomed in — individual seconds visible).
export const MAX_PIXELS_PER_SECOND = 200

// Default scale: minute-oriented timeline reading.
export const DEFAULT_PIXELS_PER_SECOND = 10

// Multiplicative zoom step for wheel interactions.
export const ZOOM_STEP = 1.2

// Screen-space snap threshold used when dragging clips on the timeline.
export const SNAP_THRESHOLD_PX = 10

// Candidate major gridline intervals in seconds.
export const GRID_INTERVALS_SECONDS = [
  1, 2, 5, 10, 15, 30,
  60, 120, 300, 600, 1800,
  3600,
] as const

// Compatibility alias used by existing store/actions.
export const TIMELINE_ZOOM = {
  MIN: MIN_PIXELS_PER_SECOND,
  MAX: MAX_PIXELS_PER_SECOND,
  DEFAULT: DEFAULT_PIXELS_PER_SECOND,
  STEP_BUTTON: ZOOM_STEP,
} as const

/** How many milliseconds before the current clip ends to trigger buffer preparation. */
export const PRELOAD_LOOKAHEAD_MS = 1500

/** Minimum drift required to force a currentTime correction during free-running playback.
 *  Below this value the video element runs freely — do not seek it. */
export const DRIFT_CORRECTION_THRESHOLD_S = 0.25

/** How often (ms) the RAF loop syncs the live playhead ref into the Zustand store for UI updates. */
export const STORE_SYNC_INTERVAL_MS = 100

/** Time-domain snap threshold when dragging clips (seconds). Used when scale is unavailable. */
export const SNAP_THRESHOLD_S = 0.3

/** Delay (ms) before hold-to-zoom repeat kicks in. */
export const ZOOM_HOLD_DELAY_MS = 400

/** Interval (ms) between repeated zoom steps during hold-to-zoom. */
export const ZOOM_HOLD_INTERVAL_MS = 80

/** Duration of one video frame at 30 fps, used for frame-step seek shortcuts. */
export const FRAME_STEP_SECONDS = 1 / 30
