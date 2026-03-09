import { useState, type DragEvent } from "react"
import { Eye, EyeOff, Lock, Unlock, Trash2 } from "lucide-react"
import type { MediaType, Track, TrackType } from "../../project/projectTypes"
import { ClipComponent } from "./Clip"
import { useEditorStore } from "../../store/editorStore"
import { pxToTime, timeToPx, TRACK_HEADER_WIDTH } from "../../utils/time"
import { IconButton } from "../ui/IconButton"

interface TrackProps {
  track: Track
  dragOverTrackId: string | undefined
  setDragOverTrack: (id: string | undefined) => void
  onDrop: (trackId: string, mediaId: string, e: DragEvent<HTMLDivElement>) => void
  onClipDrop: (e: DragEvent<HTMLDivElement>, targetTrackId: string) => void
  resolveDropPosition: (trackId: string, rawStart: number, clipDuration: number, excludeClipId?: string) => number
}

const TYPE_LABEL: Record<string, string> = { video: 'Video', audio: 'Audio' }

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
  const baseLabel = TYPE_LABEL[track.type] ?? track.type
  const trackLabel = sameTypeTracks.length > 1 ? `${baseLabel} ${trackIndex + 1}` : baseLabel
  const canRemove = sameTypeTracks.length > 1

  const [snapIndicatorX, setSnapIndicatorX] = useState<number | null>(null)
  const [reorderOver, setReorderOver] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [isLocked, setIsLocked] = useState(false)

  const isOver = dragOverTrackId === track.id

  function isCompatibleDrop(mediaType: MediaType, trackType: TrackType): boolean {
    if (mediaType === "audio") return trackType === "audio"
    return trackType === "video"
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
      className="group"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: "flex",
        height: 60,
        backgroundColor: isOver ? "var(--color-dark-elevated)" : "var(--color-dark-surface)",
        borderBottom: "1px solid var(--color-dark-border)",
        borderTop: reorderOver ? "2px solid var(--color-info)" : undefined,
        minWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Track header — sticky left */}
      <div
        style={{
          position: "sticky",
          left: 0,
          zIndex: 4,
          width: TRACK_HEADER_WIDTH,
          flexShrink: 0,
          height: "100%",
          backgroundColor: isOver ? "var(--color-dark-elevated)" : "var(--color-dark-card)",
          borderRight: "1px solid var(--color-dark-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 6px",
          boxSizing: "border-box",
          gap: 2,
        }}
      >
        {/* Drag handle + label */}
        <div className="flex items-center gap-1 min-w-0">
          <div
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('reorderTrackId', track.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            className="cursor-grab text-muted opacity-50 hover:opacity-100 text-xs leading-none select-none shrink-0"
          >
            ⠿
          </div>
          <span className="text-xs font-semibold text-muted-light truncate">{trackLabel}</span>
        </div>

        {/* Track action icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <IconButton
            icon={isVisible ? <Eye /> : <EyeOff />}
            label={isVisible ? "Hide track" : "Show track"}
            size="sm"
            active={!isVisible}
            onClick={() => setIsVisible(v => !v)}
          />
          <IconButton
            icon={isLocked ? <Lock /> : <Unlock />}
            label={isLocked ? "Unlock track" : "Lock track"}
            size="sm"
            active={isLocked}
            onClick={() => setIsLocked(v => !v)}
          />
          {canRemove && (
            <IconButton
              icon={<Trash2 />}
              label="Delete track"
              size="sm"
              variant="danger"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => { e.stopPropagation(); removeTrack(track.id) }}
            />
          )}
        </div>
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
              backgroundColor: "var(--color-warning)",
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

