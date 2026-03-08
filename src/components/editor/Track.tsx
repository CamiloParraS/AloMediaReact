import { useState, type DragEvent } from "react"
import type { MediaType, Track, TrackType } from "../../project/projectTypes"
import { ClipComponent } from "./Clip"
import { useEditorStore } from "../../store/editorStore"
import { pxToTime, timeToPx, TRACK_HEADER_WIDTH } from "../../utils/time"

interface TrackProps {
  track: Track
  dragOverTrackId: string | undefined
  setDragOverTrack: (id: string | undefined) => void
  onDrop: (trackId: string, mediaId: string, e: DragEvent<HTMLDivElement>) => void
  onClipDrop: (e: DragEvent<HTMLDivElement>, targetTrackId: string) => void
  resolveDropPosition: (trackId: string, rawStart: number, clipDuration: number, excludeClipId?: string) => number
}

const TYPE_LETTER: Record<string, string> = { video: 'V', audio: 'A', overlay: 'O' }

export function TrackComponent({ track, dragOverTrackId, setDragOverTrack, onDrop, onClipDrop, resolveDropPosition }: TrackProps) {
  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const setSelectedClip = useEditorStore(s => s.setSelectedClip)
  const scale = useEditorStore(s => s.timelineScale)
  const removeTrack = useEditorStore(s => s.removeTrack)
  const reorderTrack = useEditorStore(s => s.reorderTrack)
  const allTracks = useEditorStore(s => s.project.tracks)
  const projectMedia = useEditorStore(s => s.project.media)

  const sameTypeTracks = allTracks.filter(t => t.type === track.type)
  const trackIndex = sameTypeTracks.findIndex(t => t.id === track.id)
  const letter = TYPE_LETTER[track.type] ?? track.type[0].toUpperCase()
  const trackLabel = sameTypeTracks.length > 1 ? `${letter}${trackIndex + 1}` : letter
  const canRemove = sameTypeTracks.length > 1

  const [snapIndicatorX, setSnapIndicatorX] = useState<number | null>(null)
  const [reorderOver, setReorderOver] = useState(false)

  const isOver = dragOverTrackId === track.id

  function isCompatibleDrop(mediaType: MediaType, trackType: TrackType): boolean {
    if (mediaType === "audio") return trackType === "audio"
    return trackType === "video" || trackType === "overlay"
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (e.dataTransfer.types.includes('reordertrackid')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setReorderOver(true)
      return
    }
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const cursorTime = pxToTime(e.clientX - rect.left - TRACK_HEADER_WIDTH, scale)
    const resolved = resolveDropPosition(track.id, cursorTime, 0)
    setSnapIndicatorX(timeToPx(resolved, scale))
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.dataTransfer.types.includes('reordertrackid')) return
    setDragOverTrack(track.id)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTrack(undefined)
      setSnapIndicatorX(null)
      setReorderOver(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setReorderOver(false)

    const sourceId = e.dataTransfer.getData('reorderTrackId')
    if (sourceId && sourceId !== track.id) {
      reorderTrack(sourceId, track.id)
      return
    }

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
        display: "flex",
        height: 60,
        backgroundColor: isOver ? "#1e293b" : "#0f172a",
        borderBottom: "1px solid #1e293b",
        borderTop: reorderOver ? "2px solid #3b82f6" : undefined,
        minWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Track header — sticky to the left edge of the scroll container */}
      <div
        style={{
          position: "sticky",
          left: 0,
          zIndex: 4,
          width: TRACK_HEADER_WIDTH,
          flexShrink: 0,
          height: "100%",
          backgroundColor: isOver ? "#1e293b" : "#0f172a",
          borderRight: "1px solid #1e293b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          boxSizing: "border-box",
        }}
      >
        {/* Reorder drag handle */}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('reorderTrackId', track.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          style={{ cursor: 'grab', fontSize: 10, textAlign: 'center', color: '#64748b', lineHeight: 1 }}
        >
          ⠿
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>
          {trackLabel}
        </span>
        {canRemove && (
          <button
            onClick={e => { e.stopPropagation(); removeTrack(track.id) }}
            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, padding: "1px 3px", lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Clips area — coordinate origin for all clip positions */}
      <div
        style={{
          position: "relative",
          flex: 1,
          overflow: "hidden",
          height: "100%",
        }}
      >
        {/* Snap indicator */}
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
    </div>
  )
}

