import { useRef } from "react"
import { useEditorStore } from "../store/editorStore"
import { getProjectDuration } from "../utils/time"

/** Returns true when there is no video clip covering the given time (a "gap"). */
function isInGap(time: number): boolean {
  const { project } = useEditorStore.getState()
  const videoTracks = project.tracks.filter(t => t.type === "video")
  if (videoTracks.length === 0) return false
  const allClips = videoTracks.flatMap(t => t.clips)
  if (allClips.length === 0) return false
  return !allClips.some(c => c.timelineStart <= time && time < c.timelineEnd)
}

export function usePlayer() {
  const setPlayhead = useEditorStore(s => s.setPlayhead)
  const isPlaying = useEditorStore(s => s.isPlaying)

  const rafRef = useRef<number | undefined>(undefined)
  // Single reference point — reset on play() start and every seek() call.
  // This fixes playhead drift when the user scrubs while the RAF loop is running.
  const seekRef = useRef<{ wallTime: number; playhead: number }>({ wallTime: 0, playhead: 0 })

  function play() {
    if (isPlaying) return
    // Initialize seekRef before setIsPlaying so the first frame has a valid reference point
    seekRef.current = { wallTime: performance.now(), playhead: useEditorStore.getState().playhead }
    useEditorStore.getState().setIsPlaying(true)

    function frame() {
      // Read isPlaying from store snapshot — avoids stale closure after pause()
      if (!useEditorStore.getState().isPlaying) return

      const elapsed = (performance.now() - seekRef.current.wallTime) / 1000
      const newPlayhead = seekRef.current.playhead + elapsed
      const duration = getProjectDuration(useEditorStore.getState().project.tracks)

      if (newPlayhead >= duration) {
        useEditorStore.getState().setPlayhead(duration)
        useEditorStore.getState().setIsPlaying(false)
        return
      }

      // Stop playback when the playhead enters a gap (no video clip at this time)
      if (isInGap(newPlayhead)) {
        useEditorStore.getState().setPlayhead(newPlayhead)
        useEditorStore.getState().setIsPlaying(false)
        return
      }

      useEditorStore.getState().setPlayhead(newPlayhead)
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
  }

  function pause() {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = undefined
    }
    useEditorStore.getState().setIsPlaying(false)
  }

  function seek(time: number) {
    setPlayhead(time)
    // Reset reference point so the playback loop continues from the new position
    seekRef.current = { wallTime: performance.now(), playhead: time }
  }

  return { play, pause, seek, isPlaying }
}
