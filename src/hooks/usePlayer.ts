import { useRef } from "react"
import { useEditorStore } from "../store/editorStore"
import { getProjectDuration } from "../utils/time"

export function usePlayer() {
  const setPlayhead = useEditorStore(s => s.setPlayhead)
  const isPlaying = useEditorStore(s => s.isPlaying)
  const setIsPlaying = useEditorStore(s => s.setIsPlaying)

  const rafRef = useRef<number | undefined>(undefined)
  // Single reference point — reset on play() start and every seek() call.
  // This fixes playhead drift when the user scrubs while the RAF loop is running.
  const seekRef = useRef<{ wallTime: number; playhead: number }>({ wallTime: 0, playhead: 0 })

  function play() {
    if (isPlaying) return
    seekRef.current = { wallTime: performance.now(), playhead: useEditorStore.getState().playhead }
    setIsPlaying(true)

    function frame() {
      const elapsed = (performance.now() - seekRef.current.wallTime) / 1000
      const newPlayhead = seekRef.current.playhead + elapsed
      const duration = getProjectDuration(useEditorStore.getState().project.tracks)

      if (newPlayhead >= duration) {
        setPlayhead(duration)
        setIsPlaying(false)
        return
      }

      setPlayhead(newPlayhead)
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
  }

  function pause() {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = undefined
    }
    setIsPlaying(false)
  }

  function seek(time: number) {
    setPlayhead(time)
    // Reset reference point so the playback loop continues from the new position
    seekRef.current = { wallTime: performance.now(), playhead: time }
  }

  return { play, pause, seek, isPlaying }
}
