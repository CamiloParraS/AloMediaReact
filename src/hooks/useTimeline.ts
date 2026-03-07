import { useState } from "react"
import { useEditorStore } from "../store/editorStore"
import { pxToTime } from "../utils/time"

export function useTimeline() {
  const timelineScale = useEditorStore(s => s.timelineScale)
  const tracks = useEditorStore(s => s.project.tracks)
  const [dragOverTrackId, setDragOverTrackId] = useState<string | undefined>(undefined)

  function xToTime(x: number): number {
    return pxToTime(x, timelineScale)
  }

  function hasCollision(
    trackId: string,
    start: number,
    end: number,
    excludeClipId?: string
  ): boolean {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return false
    return track.clips.some(clip => {
      if (excludeClipId && clip.id === excludeClipId) return false
      // Two intervals overlap if one starts before the other ends
      return start < clip.timelineEnd && end > clip.timelineStart
    })
  }

  function setDragOverTrack(id: string | undefined) {
    setDragOverTrackId(id)
  }

  return {
    xToTime,
    hasCollision,
    dragOverTrackId,
    setDragOverTrack,
  }
}
