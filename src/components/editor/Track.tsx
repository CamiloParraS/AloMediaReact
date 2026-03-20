import { useState, type DragEvent } from "react"
import { Eye, EyeOff, Lock, Unlock, Trash2, Film, Music } from "lucide-react"
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

const TYPE_LABEL: Record<string, string> = { video: "Video", audio: "Audio" }

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
  const [headerHovered, setHeaderHovered] = useState(false)

  const isOver = dragOverTrackId === track.id
  const rowHeight = track.type === "video" ? 48 : 40

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

  const TypeIcon = track.type === "video" ? Film : Music

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: "flex",
        height: rowHeight,
        background: isOver ? "var(--color-dark-elevated)" : "var(--color-dark-surface)",
        borderBottom: "1px solid var(--color-dark-border)",
        borderTop: reorderOver ? "2px solid var(--color-accent-red)" : undefined,
        minWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Track header — sticky left */}
      <div
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          position: "sticky",
          left: 0,
          zIndex: 4,
          width: TRACK_HEADER_WIDTH,
          flexShrink: 0,
          height: "100%",
          background: isOver ? "var(--color-dark-elevated)" : "var(--color-dark)",
          borderRight: "1px solid var(--color-dark-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 6px 0 0",
          boxSizing: "border-box",
          gap: 2,
        }}
      >
        {/* Grip handle — dotted texture on far left */}
        <div
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('reorderTrackId', track.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          style={{
            width: 8,
            height: "100%",
            flexShrink: 0,
            cursor: "grab",
            background: "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, var(--color-dark-border-light) 2px, var(--color-dark-border-light) 3px)",
            userSelect: "none",
          }}
        />

        {/* Type icon + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
          <TypeIcon size={11} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-muted-light)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {trackLabel}
          </span>
        </div>

        {/* Track action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          <IconButton
            icon={isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
            label={isVisible ? "Hide track" : "Show track"}
            size="xs"
            active={!isVisible}
            onClick={() => setIsVisible(v => !v)}
          />
          <IconButton
            icon={isLocked ? <Lock size={11} /> : <Unlock size={11} />}
            label={isLocked ? "Unlock track" : "Lock track"}
            size="xs"
            active={isLocked}
            onClick={() => setIsLocked(v => !v)}
          />
          {canRemove && (
            <IconButton
              icon={<Trash2 size={11} />}
              label="Delete track"
              size="xs"
              variant="danger"
              className={headerHovered ? "opacity-100" : "opacity-0 pointer-events-none"}
              onClick={e => { e.stopPropagation(); removeTrack(track.id) }}
            />
          )}
        </div>
      </div>

      {/* Clips area */}
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
              background: "var(--color-warning)",
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
            onDragEnd={() => setSnapIndicatorX(null)}
          />
        ))}
      </div>
    </div>
  )
}