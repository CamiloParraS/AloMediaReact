import { destroyAudioContext } from "./audioSync"

/** Incrementally syncs audio elements with the current set of audio track IDs. */
export function syncAudioPool(
  pool: Map<string, HTMLAudioElement>,
  audioTrackIds: string[],
): void {
  const needed = new Set(audioTrackIds)

  // Remove elements for tracks that no longer exist
  for (const [trackId, el] of pool) {
    if (!needed.has(trackId)) {
      el.pause()
      if (el.parentNode) el.parentNode.removeChild(el)
      destroyAudioContext(trackId)
      pool.delete(trackId)
    }
  }

  // Create elements for new tracks
  for (const trackId of audioTrackIds) {
    if (pool.has(trackId)) continue
    const el = document.createElement("audio")
    el.preload = "auto"
    el.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none"
    document.body.appendChild(el)
    pool.set(trackId, el)
  }
}

/** Destroys all audio elements in the pool (call on unmount). */
export function destroyAudioPool(pool: Map<string, HTMLAudioElement>): void {
  for (const [trackId, el] of pool) {
    el.pause()
    if (el.parentNode) el.parentNode.removeChild(el)
    destroyAudioContext(trackId)
  }
  pool.clear()
}
