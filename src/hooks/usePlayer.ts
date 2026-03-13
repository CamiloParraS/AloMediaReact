import { useCallback, useRef } from "react"
import { useEditorStore } from "../store/editorStore"
import { getProjectDuration } from "../utils/time"
import { STORE_SYNC_INTERVAL_MS } from "../constants/timeline"

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
    if (!isPlayingRef.current && rafRef.current === undefined) {
      return
    }
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
