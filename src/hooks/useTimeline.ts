import { useState } from "react"
import { useEditorStore } from "../store/editorStore"
import { pxToTime } from "../utils/time"

const SNAP_THRESHOLD = 0.3

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

  // Returns a snapped timelineStart if within threshold of a neighbor edge.
  function snapToNeighbor(
    trackId: string,
    rawStart: number,
    clipDuration: number,
    excludeClipId?: string,
    thresholdSeconds: number = SNAP_THRESHOLD
  ): number {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return rawStart
    const rawEnd = rawStart + clipDuration
    for (const existing of track.clips) {
      if (existing.id === excludeClipId) continue
      if (Math.abs(rawStart - existing.timelineEnd) <= thresholdSeconds) {
        return existing.timelineEnd
      }
      if (Math.abs(rawEnd - existing.timelineStart) <= thresholdSeconds) {
        return existing.timelineStart - clipDuration
      }
    }
    return rawStart
  }

  // Resolves a drop position, placing the clip before or after any overlapping clip.
  function resolveDropPosition(
    trackId: string,
    rawStart: number,
    clipDuration: number,
    excludeClipId?: string
  ): number {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return rawStart

    const rawEnd = rawStart + clipDuration

    const overlapping = track.clips.find(existing => {
      if (existing.id === excludeClipId) return false
      return rawStart < existing.timelineEnd && rawEnd > existing.timelineStart
    })

    if (!overlapping) {
      return snapToNeighbor(trackId, rawStart, clipDuration, excludeClipId)
    }

    const midpoint = (overlapping.timelineStart + overlapping.timelineEnd) / 2
    const dropCenter = rawStart + clipDuration / 2

    if (dropCenter <= midpoint) {
      // Try to place before the overlapping clip
      const candidate = Math.max(0, overlapping.timelineStart - clipDuration)
      if (!hasCollision(trackId, candidate, candidate + clipDuration, excludeClipId)) {
        return candidate
      }
      // Fall back: try placing after
      const fallback = overlapping.timelineEnd
      if (!hasCollision(trackId, fallback, fallback + clipDuration, excludeClipId)) {
        return fallback
      }
    } else {
      // Try to place after the overlapping clip
      const candidate = overlapping.timelineEnd
      if (!hasCollision(trackId, candidate, candidate + clipDuration, excludeClipId)) {
        return candidate
      }
      // Fall back: try placing before
      const fallback = Math.max(0, overlapping.timelineStart - clipDuration)
      if (!hasCollision(trackId, fallback, fallback + clipDuration, excludeClipId)) {
        return fallback
      }
    }

    // Both sides blocked — return a sentinel that callers can detect via hasCollision
    return rawStart
  }

  function setDragOverTrack(id: string | undefined) {
    setDragOverTrackId(id)
  }

  return {
    xToTime,
    hasCollision,
    snapToNeighbor,
    resolveDropPosition,
    dragOverTrackId,
    setDragOverTrack,
  }
}
