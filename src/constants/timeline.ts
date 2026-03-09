export const TIMELINE_ZOOM = {
  MIN: 1,           // 1px per second (most zoomed out)
  MAX: 3600,        // 3600px per second (most zoomed in)
  DEFAULT: 300,     // 300px per second — ~5 min fits in a ~1080px wide panel
  STEP_BUTTON: 60,  // increment per toolbar button click
} as const
