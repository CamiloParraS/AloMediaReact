import type { AudioClip } from "../../project/projectTypes"
import type { ClipIndex } from "../timeline/clipLookup"
import { lookupActiveClips } from "../timeline/clipLookup"
import { DRIFT_CORRECTION_THRESHOLD_S } from "../../constants/timeline"

/**
 * Synchronises audio elements to the playhead. Called once per RAF frame.
 *
 * - Pauses audio elements whose clips are no longer active.
 * - Seeks newly-active clips to the correct media time.
 * - Applies drift correction to running clips.
 *
 * @returns The set of active audio clip IDs (pass back as `prevActiveIds` next frame).
 */
export function syncAudioElements(
  ph: number,
  playing: boolean,
  clipIndex: ClipIndex,
  audioElements: Map<string, HTMLAudioElement>,
  prevActiveIds: Set<string>,
  getObjectUrl: (mediaId: string) => string | undefined,
): Set<string> {
  const activeAudioClips = lookupActiveClips(clipIndex, ph).filter(
    (c): c is AudioClip => c.type === "audio",
  )
  const activeTrackIds = new Set(activeAudioClips.map(c => c.trackId))

  // Phase 1 — batch DOM reads
  const currentTimes = new Map<string, number>()
  for (const [trackId, el] of audioElements) {
    currentTimes.set(trackId, el.currentTime)
  }

  // Phase 2 — pause inactive
  for (const [trackId, el] of audioElements) {
    if (!activeTrackIds.has(trackId)) el.pause()
  }

  const activeIds = new Set(activeAudioClips.map(c => c.id))
  const newlyActive = new Set([...activeIds].filter(id => !prevActiveIds.has(id)))

  // Phase 3 — sync active clips
  for (const clip of activeAudioClips) {
    const el = audioElements.get(clip.trackId)
    if (!el) continue
    const url = getObjectUrl(clip.mediaId)
    if (url && el.src !== url) el.src = url
    const mediaTime = clip.mediaStart + (ph - clip.timelineStart)

    if (newlyActive.has(clip.id)) {
      el.currentTime = Math.max(0, mediaTime)
      if (playing) {
        el.muted = false
        el.volume = 1
        el.play().catch(() => {})
      }
    } else if (!playing) {
      if (el.readyState >= 1) el.currentTime = mediaTime
    } else {
      const current = currentTimes.get(clip.trackId) ?? 0
      if (Math.abs(current - mediaTime) > DRIFT_CORRECTION_THRESHOLD_S) {
        el.currentTime = mediaTime
      }
    }
  }

  return activeIds
}
