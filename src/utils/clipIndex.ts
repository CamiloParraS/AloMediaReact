import type { Clip, Track } from "../project/projectTypes"
import { CLIP_EPSILON } from "./time"

export interface ClipIndex {
  boundaries: number[]
  segments: Map<number, Clip[]>
}

export function buildClipIndex(tracks: Track[]): ClipIndex {
  const allClips = tracks.flatMap(t => t.clips)
  const times = new Set<number>()
  allClips.forEach(c => {
    times.add(c.timelineStart)
    times.add(c.timelineEnd)
  })
  const boundaries = Array.from(times).sort((a, b) => a - b)

  const segments = new Map<number, Clip[]>()
  for (let i = 0; i < boundaries.length - 1; i++) {
    const mid = (boundaries[i] + boundaries[i + 1]) / 2
    segments.set(
      i,
      allClips.filter(
        c => c.timelineStart - CLIP_EPSILON <= mid && mid < c.timelineEnd + CLIP_EPSILON
      )
    )
  }
  return { boundaries, segments }
}

export function lookupActiveClips(index: ClipIndex, playhead: number): Clip[] {
  const { boundaries, segments } = index
  if (boundaries.length < 2) return []
  let lo = 0
  let hi = boundaries.length - 2
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (boundaries[mid + 1] <= playhead - CLIP_EPSILON) lo = mid + 1
    else if (boundaries[mid] > playhead + CLIP_EPSILON) hi = mid - 1
    else return segments.get(mid) ?? []
  }
  return []
}
