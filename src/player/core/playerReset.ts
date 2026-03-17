import { useEditorStore } from "../../store/editorStore"
import { releaseAllBuffers } from "../video/videoBuffer"
import { disconnectAll } from "../audio/audioSync"

interface TeardownParams {
  pause: () => void
  isPlayingRef: { current: boolean }
  needsReinitRef: { current: boolean }
  playheadRef: { current: number }
  onFrameRef: { current: ((ph: number) => void) | null }
}

export function teardownPlayerState({
  pause,
  isPlayingRef,
  needsReinitRef,
  playheadRef,
  onFrameRef,
}: TeardownParams): void {
  const wasPlaying = isPlayingRef.current
  if (wasPlaying) {
    pause()
  }
  releaseAllBuffers()
  disconnectAll()
  needsReinitRef.current = true
  if (wasPlaying) {
    playheadRef.current = 0
    useEditorStore.getState().setPlayhead(0)
    useEditorStore.getState().setIsPlaying(false)
  } else {
    useEditorStore.getState().setIsPlaying(false)
    onFrameRef.current?.(playheadRef.current)
  }
}
