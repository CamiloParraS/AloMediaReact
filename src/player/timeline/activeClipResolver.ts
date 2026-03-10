import type { Track, VideoClip } from "../../project/projectTypes"
import { CLIP_EPSILON } from "../../utils/time"

/**
 * Resolves the active video clip at a given playhead across ALL video tracks.
 * Picks the topmost track (lowest order value). Within a track, if multiple
 * clips overlap at the playhead, picks the latest-starting one (incoming clip wins).
 *
 * BUG FIX: the previous implementation returned null as soon as the first
 * iterated track had no active clip, ignoring lower tracks entirely.
 * This version scans every video track and selects by visual priority.
 */
export function getActiveVideoClip(tracks: Track[], playhead: number): VideoClip | null {
  let bestClip: VideoClip | null = null
  let bestOrder = Infinity

  for (const track of tracks) {
    if (track.type !== "video") continue
    const candidates = track.clips.filter(
      (c): c is VideoClip =>
        c.type === "video" &&
        c.timelineStart - CLIP_EPSILON <= playhead &&
        playhead < c.timelineEnd + CLIP_EPSILON,
    )
    if (candidates.length === 0) continue
    const best = candidates.reduce((a, b) => (a.timelineStart > b.timelineStart ? a : b))
    if (track.order < bestOrder) {
      bestOrder = track.order
      bestClip = best
    }
  }

  return bestClip
}

/**
 * Finds the next video clip that will become active after the current clip ends.
 * Uses timeline lookahead across ALL video tracks (not just the same track).
 */
export function getNextVideoClip(tracks: Track[], currentClip: VideoClip): VideoClip | null {
  // First: check if a clip is active right at the boundary
  const futureClip = getActiveVideoClip(tracks, currentClip.timelineEnd + CLIP_EPSILON)
  if (futureClip && futureClip.id !== currentClip.id) return futureClip

  // Second: find the nearest future clip across all tracks
  const trackOrderMap = new Map(tracks.map(t => [t.id, t.order]))
  const allFuture = tracks
    .filter(t => t.type === "video")
    .flatMap(t => t.clips)
    .filter(
      (c): c is VideoClip =>
        c.type === "video" &&
        c.timelineStart >= currentClip.timelineEnd - CLIP_EPSILON &&
        c.id !== currentClip.id,
    )
    .sort((a, b) => {
      const dt = a.timelineStart - b.timelineStart
      if (Math.abs(dt) > CLIP_EPSILON) return dt
      return (trackOrderMap.get(a.trackId) ?? Infinity) - (trackOrderMap.get(b.trackId) ?? Infinity)
    })

  return allFuture[0] ?? null
}
