import { useCallback, useRef } from "react"
import { useEditorStore } from "../store/editorStore"
import { getProjectDuration, CLIP_EPSILON } from "../utils/time"
import { STORE_SYNC_INTERVAL_MS } from "../constants/timeline"

/** Returns true when there is no video clip covering the given time (a "gap").
 *  Uses CLIP_EPSILON on the right edge to prevent false gaps at exact clip boundaries
 *  caused by sub-millisecond float arithmetic in the RAF timing loop. */
function isInGap(time: number): boolean {
  // Time zero is always a valid playback position — never treat it as a gap
  if (time <= 0) return false

  const { project } = useEditorStore.getState()
  const videoTracks = project.tracks.filter(t => t.type === "video")
  if (videoTracks.length === 0) return false
  const allClips = videoTracks.flatMap(t => t.clips)
  if (allClips.length === 0) return false
  return !allClips.some(c => c.timelineStart <= time && time < c.timelineEnd + CLIP_EPSILON)
}

// Shared refs — live playhead and playing flag readable from RAF without React re-renders
const playheadRef = { current: 0 }
const isPlayingRef = { current: false }

export { playheadRef, isPlayingRef }

export function usePlayer() {
  const setPlayhead = useEditorStore(s => s.setPlayhead)
  const isPlaying = useEditorStore(s => s.isPlaying)

  const rafRef = useRef<number | undefined>(undefined)
  const lastWallTimeRef = useRef(0)
  const lastStoreSyncRef = useRef(0)
  // onFrameCallback is set by PreviewPlayer so the RAF loop can call it every frame
  const onFrameRef = useRef<((playhead: number) => void) | null>(null)

  const play = useCallback(() => {
    if (isPlayingRef.current) return
    playheadRef.current = Math.max(0, useEditorStore.getState().playhead)
    lastWallTimeRef.current = performance.now()
    lastStoreSyncRef.current = performance.now()
    isPlayingRef.current = true
    useEditorStore.getState().setIsPlaying(true)

    function frame(wallTime: number) {
      if (!isPlayingRef.current) return

      const delta = (wallTime - lastWallTimeRef.current) / 1000
      lastWallTimeRef.current = wallTime
      playheadRef.current = Math.max(0, playheadRef.current + delta)

      const duration = getProjectDuration(useEditorStore.getState().project.tracks)

      if (playheadRef.current >= duration) {
        playheadRef.current = duration
        isPlayingRef.current = false
        useEditorStore.getState().setPlayhead(duration)
        useEditorStore.getState().setIsPlaying(false)
        return
      }

      if (isInGap(playheadRef.current)) {
        isPlayingRef.current = false
        useEditorStore.getState().setPlayhead(playheadRef.current)
        useEditorStore.getState().setIsPlaying(false)
        return
      }

      // Call the per-frame sync callback (media element sync) — no React involved
      onFrameRef.current?.(playheadRef.current)

      // Throttled store sync for timeline needle & timecode display
      if (wallTime - lastStoreSyncRef.current >= STORE_SYNC_INTERVAL_MS) {
        useEditorStore.getState().setPlayhead(playheadRef.current)
        lastStoreSyncRef.current = wallTime
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
  }, [])

  const pause = useCallback(() => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = undefined
    }
    isPlayingRef.current = false
    // Final sync so store has the exact stop position
    useEditorStore.getState().setPlayhead(playheadRef.current)
    useEditorStore.getState().setIsPlaying(false)
  }, [])

  // Exposed so PreviewPlayer can reset clipSeekDoneRef on explicit seeks
  const seekFlagResetRef = useRef<(() => void) | null>(null)

  const seek = useCallback((time: number) => {
    playheadRef.current = time
    setPlayhead(time)
    // Signal PreviewPlayer to force re-seek on next frame
    seekFlagResetRef.current?.()
  }, [setPlayhead])

  return { play, pause, seek, isPlaying, onFrameRef, playheadRef, seekFlagResetRef }
}
