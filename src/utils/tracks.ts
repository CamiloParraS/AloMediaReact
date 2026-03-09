import type { Track, TrackType } from "../project/projectTypes"

/**
 * Returns the correct insertion index for a new track of the given type.
 * - Audio tracks are always appended at the very end.
 * - Video tracks are inserted before the first audio track so video always
 *   sits above audio in the timeline ordering.
 */
export function getInsertionIndex(tracks: Track[], type: TrackType): number {
  if (type === "audio") {
    return tracks.length
  }
  // video: insert before the first audio track
  const firstAudioIndex = tracks.findIndex(t => t.type === "audio")
  return firstAudioIndex === -1 ? tracks.length : firstAudioIndex
}
