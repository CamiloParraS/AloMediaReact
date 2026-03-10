export const TIMELINE_ZOOM = {
  MIN: 1,           // 1px per second (most zoomed out)
  MAX: 3600,        // 3600px per second (most zoomed in)
  DEFAULT: 300,     // 300px per second — ~5 min fits in a ~1080px wide panel
  STEP_BUTTON: 60,  // increment per toolbar button click
} as const

/** How many milliseconds before the current clip ends to trigger buffer preparation. */
export const PRELOAD_LOOKAHEAD_MS = 1500

/** Minimum drift required to force a currentTime correction during free-running playback.
 *  Below this value the video element runs freely — do not seek it. */
export const DRIFT_CORRECTION_THRESHOLD_S = 0.25

/** How often (ms) the RAF loop syncs the live playhead ref into the Zustand store for UI updates. */
export const STORE_SYNC_INTERVAL_MS = 100
