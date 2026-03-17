import type { Track } from "../project/projectTypes"

export function hasCollision(
  tracks: Track[],
  trackId: string,
  start: number,
  end: number,
  excludeClipId?: string,
): boolean {
  const track = tracks.find(t => t.id === trackId)
  if (!track) return false
  return track.clips.some(clip => {
    if (excludeClipId && clip.id === excludeClipId) return false
    return start < clip.timelineEnd && end > clip.timelineStart
  })
}
