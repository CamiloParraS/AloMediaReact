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
