import type { Track } from "../project/projectTypes"

export type SnapBoundary = {
  timeSeconds: number
  sourceClipId: string
}

export function collectSnapBoundaries(tracks: Track[], excludeClipId?: string): SnapBoundary[] {
  const boundaries: SnapBoundary[] = []
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue
      boundaries.push({ timeSeconds: clip.timelineStart, sourceClipId: clip.id })
      boundaries.push({ timeSeconds: clip.timelineEnd, sourceClipId: clip.id })
    }
  }
  return boundaries
}

export function findSnap(
  candidateTime: number,
  boundaries: SnapBoundary[],
  thresholdSeconds: number
): number | null {
  let closest: number | null = null
  let closestDist = Number.POSITIVE_INFINITY

  for (const boundary of boundaries) {
    const dist = Math.abs(candidateTime - boundary.timeSeconds)
    if (dist < thresholdSeconds && dist < closestDist) {
      closest = boundary.timeSeconds
      closestDist = dist
    }
  }

  return closest
}
