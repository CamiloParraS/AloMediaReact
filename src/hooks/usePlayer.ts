import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "../store/editorStore"
import { getProjectDuration } from "../utils/time"
import { STORE_SYNC_INTERVAL_MS } from "../constants/timeline"
import { createRafLoop } from "../player/core/rafLoop"
import { teardownPlayerState } from "../player/core/playerReset"

// Shared refs — live playhead and playing flag readable from RAF without React re-renders
const playheadRef = { current: 0 }
const isPlayingRef = { current: false }
const onFrameRef = { current: null as ((playhead: number) => void) | null }

export { playheadRef, isPlayingRef }

let resetPlayerImpl: (() => void) | null = null

export function resetPlayer(): void {
  resetPlayerImpl?.()
}

export function renderSingleFrame(): void {
  if (isPlayingRef.current) return
  if (!onFrameRef.current) return
  onFrameRef.current(playheadRef.current)
}

export function usePlayer() {
  const setPlayhead = useEditorStore(s => s.setPlayhead)
  const isPlaying = useEditorStore(s => s.isPlaying)

  const needsReinitRef = useRef(false)
  // Exposed so PreviewPlayer can reset clipSeekDoneRef on explicit seeks
  const seekFlagResetRef = useRef<(() => void) | null>(null)

  const loopRef = useRef(createRafLoop({
    syncInterval: STORE_SYNC_INTERVAL_MS,
    getDuration: () => getProjectDuration(useEditorStore.getState().project.tracks),
    onFrame: (ph) => {
      playheadRef.current = ph
      onFrameRef.current?.(ph)
    },
    onEnd: (duration) => {
      playheadRef.current = duration
      isPlayingRef.current = false
      useEditorStore.getState().setPlayhead(duration)
      useEditorStore.getState().setIsPlaying(false)
    },
    onStoreSync: (ph) => {
      useEditorStore.getState().setPlayhead(ph)
    },
  }))

  const pause = useCallback(() => {
    if (!isPlayingRef.current) return
    isPlayingRef.current = false
    loopRef.current.stop()
    // Final sync so store has the exact stop position
    useEditorStore.getState().setPlayhead(playheadRef.current)
    useEditorStore.getState().setIsPlaying(false)
  }, [])

  const play = useCallback(() => {
    if (isPlayingRef.current) return
    const initialPlayhead = Math.max(0, useEditorStore.getState().playhead)
    playheadRef.current = initialPlayhead
    if (needsReinitRef.current) {
      onFrameRef.current?.(initialPlayhead)
      needsReinitRef.current = false
    }
    isPlayingRef.current = true
    useEditorStore.getState().setIsPlaying(true)
    loopRef.current.start(initialPlayhead)
  }, [])

  const seek = useCallback((time: number) => {
    playheadRef.current = time
    setPlayhead(time)
    // Signal PreviewPlayer to force re-seek on next frame
    seekFlagResetRef.current?.()
  }, [setPlayhead])

  const resetPlayerState = useCallback(() => {
    teardownPlayerState({ pause, isPlayingRef, needsReinitRef, playheadRef, onFrameRef })
  }, [pause])

  useEffect(() => {
    resetPlayerImpl = resetPlayerState
    return () => {
      if (resetPlayerImpl === resetPlayerState) {
        resetPlayerImpl = null
      }
    }
  }, [resetPlayerState])

  return { play, pause, seek, isPlaying, onFrameRef, playheadRef, seekFlagResetRef, resetPlayer: resetPlayerState }
}
