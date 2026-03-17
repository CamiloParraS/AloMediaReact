import type { Track } from "../project/projectTypes"
import { hasCollision } from "./clipCollision"
import { SNAP_THRESHOLD_PX } from "../constants/timeline"

function snapToNeighbor(
  tracks: Track[],
  trackId: string,
  rawStart: number,
  clipDuration: number,
  thresholdSeconds: number,
  excludeClipId?: string,
): number {
  const track = tracks.find(t => t.id === trackId)
  if (!track) return rawStart
  const rawEnd = rawStart + clipDuration
  for (const existing of track.clips) {
    if (existing.id === excludeClipId) continue
    if (Math.abs(rawStart - existing.timelineEnd) <= thresholdSeconds) {
      return existing.timelineEnd
    }
    if (Math.abs(rawEnd - existing.timelineStart) <= thresholdSeconds) {
      return existing.timelineStart - clipDuration
    }
  }
  return rawStart
}

export function resolveDropPosition(
  tracks: Track[],
  trackId: string,
  rawStart: number,
  clipDuration: number,
  scale: number,
  excludeClipId?: string,
): number {
  const track = tracks.find(t => t.id === trackId)
  if (!track) return rawStart

  const thresholdSeconds = SNAP_THRESHOLD_PX / scale
  const rawEnd = rawStart + clipDuration

  const overlapping = track.clips.find(existing => {
    if (existing.id === excludeClipId) return false
    return rawStart < existing.timelineEnd && rawEnd > existing.timelineStart
  })

  if (!overlapping) {
    return snapToNeighbor(tracks, trackId, rawStart, clipDuration, thresholdSeconds, excludeClipId)
  }

  const midpoint = (overlapping.timelineStart + overlapping.timelineEnd) / 2
  const dropCenter = rawStart + clipDuration / 2

  if (dropCenter <= midpoint) {
    const candidate = Math.max(0, overlapping.timelineStart - clipDuration)
    if (!hasCollision(tracks, trackId, candidate, candidate + clipDuration, excludeClipId)) {
      return candidate
    }
    const fallback = overlapping.timelineEnd
    if (!hasCollision(tracks, trackId, fallback, fallback + clipDuration, excludeClipId)) {
      return fallback
    }
  } else {
    const candidate = overlapping.timelineEnd
    if (!hasCollision(tracks, trackId, candidate, candidate + clipDuration, excludeClipId)) {
      return candidate
    }
    const fallback = Math.max(0, overlapping.timelineStart - clipDuration)
    if (!hasCollision(tracks, trackId, fallback, fallback + clipDuration, excludeClipId)) {
      return fallback
    }
  }

  return rawStart
}
