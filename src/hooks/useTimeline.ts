import { useState } from "react"
import { useEditorStore } from "../store/editorStore"
import { pxToTime } from "../utils/time"
import { hasCollision } from "../utils/clipCollision"
import { resolveDropPosition } from "../utils/dropResolver"

export function useTimeline() {
  const timelineScale = useEditorStore(s => s.timelineScale)
  const tracks = useEditorStore(s => s.project.tracks)
  const [dragOverTrackId, setDragOverTrackId] = useState<string | undefined>(undefined)

  function xToTime(x: number): number {
    return pxToTime(x, timelineScale)
  }

  function hasCollisionBound(
    trackId: string,
    start: number,
    end: number,
    excludeClipId?: string,
  ): boolean {
    return hasCollision(tracks, trackId, start, end, excludeClipId)
  }

  function resolveDropPositionBound(
    trackId: string,
    rawStart: number,
    clipDuration: number,
    excludeClipId?: string,
  ): number {
    return resolveDropPosition(tracks, trackId, rawStart, clipDuration, timelineScale, excludeClipId)
  }

  function setDragOverTrack(id: string | undefined) {
    setDragOverTrackId(id)
  }

  return {
    xToTime,
    hasCollision: hasCollisionBound,
    resolveDropPosition: resolveDropPositionBound,
    dragOverTrackId,
    setDragOverTrack,
  }
}
