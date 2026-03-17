import type { VideoClip } from "../../project/projectTypes"
import { CLIP_EPSILON } from "../../utils/time"
import { DRIFT_CORRECTION_THRESHOLD_S } from "../../constants/timeline"
import { DEFAULT_SPEED } from "../../constants/speed"

interface SyncSecondaryParams {
  clips: VideoClip[]
  elements: Map<string, HTMLVideoElement>
  playhead: number
  isPlaying: boolean
}

export function syncSecondaryVideoTracks({
  clips,
  elements,
  playhead,
  isPlaying,
}: SyncSecondaryParams): void {
  for (const clip of clips) {
    const el = elements.get(clip.id)
    if (!el) continue

    const inRange =
      clip.timelineStart - CLIP_EPSILON <= playhead &&
      playhead < clip.timelineEnd + CLIP_EPSILON

    if (!inRange) {
      el.pause()
      continue
    }

    const clipSpeed = clip.speed ?? DEFAULT_SPEED
    el.playbackRate = clipSpeed
    const mediaTime = clip.mediaStart + (playhead - clip.timelineStart) * clipSpeed

    if (isPlaying) {
      if (el.paused) {
        el.currentTime = Math.max(clip.mediaStart, mediaTime)
        el.play().catch(() => {})
      } else {
        const drift = Math.abs(el.currentTime - mediaTime)
        if (drift > DRIFT_CORRECTION_THRESHOLD_S) {
          el.currentTime = mediaTime
        }
      }
    } else {
      el.currentTime = Math.max(clip.mediaStart, mediaTime)
    }
  }
}
