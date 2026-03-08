import { useState, type DragEvent } from "react"
import type { MediaType, Track, TrackType } from "../../project/projectTypes"
import { ClipComponent } from "./Clip"
import { useEditorStore } from "../../store/editorStore"
import { pxToTime, timeToPx } from "../../utils/time"

interface TrackProps {
  track: Track
  dragOverTrackId: string | undefined
  setDragOverTrack: (id: string | undefined) => void
  onDrop: (trackId: string, mediaId: string, e: DragEvent<HTMLDivElement>) => void
  onClipDrop: (e: DragEvent<HTMLDivElement>, targetTrackId: string) => void
  resolveDropPosition: (trackId: string, rawStart: number, clipDuration: number, excludeClipId?: string) => number
}

export function TrackComponent({ track, dragOverTrackId, setDragOverTrack, onDrop, onClipDrop, resolveDropPosition }: TrackProps) {
  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const setSelectedClip = useEditorStore(s => s.setSelectedClip)
  const scale = useEditorStore(s => s.timelineScale)
  const removeTrack = useEditorStore(s => s.removeTrack)
  const allTracks = useEditorStore(s => s.project.tracks)
  const projectMedia = useEditorStore(s => s.project.media)

  const sameTypeTracks = allTracks.filter(t => t.type === track.type)
  const trackIndex = sameTypeTracks.findIndex(t => t.id === track.id)
  const trackLabel = `${track.type.charAt(0).toUpperCase() + track.type.slice(1)} ${trackIndex + 1}`
  const canRemove = sameTypeTracks.length > 1

  function isCompatibleDrop(mediaType: MediaType, trackType: TrackType): boolean {
    if (mediaType === "audio") return trackType === "audio"
    return trackType === "video" || trackType === "overlay"
  }

  // Pixel X of the snap indicator; null when no snap is active
  const [snapIndicatorX, setSnapIndicatorX] = useState<number | null>(null)

  const isOver = dragOverTrackId === track.id

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const cursorTime = pxToTime(e.clientX - rect.left, scale)
    // Use a nominal duration of 0 to find where the cursor would land
    const resolved = resolveDropPosition(track.id, cursorTime, 0)
    setSnapIndicatorX(timeToPx(resolved, scale))
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOverTrack(track.id)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    // Only clear if leaving the track container itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTrack(undefined)
      setSnapIndicatorX(null)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOverTrack(undefined)
    setSnapIndicatorX(null)
    const mediaId = e.dataTransfer.getData("mediaId")
    const clipId = e.dataTransfer.getData("clipId")
    if (mediaId) {
      const media = projectMedia.find(m => m.id === mediaId)
      if (media && !isCompatibleDrop(media.type, track.type)) return
      onDrop(track.id, mediaId, e)
    } else if (clipId) {
      onClipDrop(e, track.id)
    }
  }

  function handleClipDragStart(e: DragEvent<HTMLDivElement>, clipId: string) {
    // Store the clip id and the mouse offset from the clip's left edge
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    e.dataTransfer.setData("clipId", clipId)
    e.dataTransfer.setData("clipOffsetX", String(offsetX))
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: "relative",
        height: 60,
        backgroundColor: isOver ? "#1e293b" : "#0f172a",
        borderBottom: "1px solid #1e293b",
        minWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Track header — sticky to the left edge of the scroll container */}
      <div
        style={{
          position: "sticky",
          left: 0,
          zIndex: 4,
          width: 120,
          height: 60,
          backgroundColor: isOver ? "#1e293b" : "#0f172a",
          borderRight: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 4,
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: 11, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {trackLabel}
        </span>
        {canRemove && (
          <button
            onClick={e => { e.stopPropagation(); removeTrack(track.id) }}
            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Snap indicator — thin yellow line at the nearest clip edge while dragging */}
      {snapIndicatorX !== null && (
        <div
          style={{
            position: "absolute",
            left: snapIndicatorX,
            top: 0,
            width: 2,
            height: "100%",
            backgroundColor: "#facc15",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {track.clips.map(clip => (
        <ClipComponent
          key={clip.id}
          clip={clip}
          scale={scale}
          isSelected={selectedClipId === clip.id}
          onSelect={setSelectedClip}
          onDragStart={handleClipDragStart}
        />
      ))}
    </div>
  )
}
