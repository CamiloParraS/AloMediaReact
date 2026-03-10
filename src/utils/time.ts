import type { Track } from "../project/projectTypes"

// Width of the track header column — must be consistent across Track, Timeline, PlayheadBar
export const TRACK_HEADER_WIDTH = 120

export function getProjectDuration(tracks: Track[]): number {
  return Math.max(0, ...tracks.flatMap(t => t.clips.map(c => c.timelineEnd)))
}

export function pxToTime(px: number, scale: number): number {
  return px / scale
}

export function timeToPx(time: number, scale: number): number {
  return time * scale
}

/** 1-millisecond tolerance used when matching clip boundaries — prevents float drift from hiding clips. */
export const CLIP_EPSILON = 0.001

/** Round a seconds value to the nearest millisecond, eliminating sub-ms float accumulation. */
export const toMs = (seconds: number): number => Math.round(seconds * 1000)

/** Convert an integer millisecond value back to seconds. */
export const toSeconds = (ms: number): number => ms / 1000
