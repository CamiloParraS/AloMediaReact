import type { DragEvent } from "react"
import { useRef } from "react"
import { Plus, Film, Music } from "lucide-react"
import { useEditorStore } from "../../store/editorStore"
import { useTimeline } from "../../hooks/useTimeline"
import { getProjectDuration, timeToPx, pxToTime, TRACK_HEADER_WIDTH } from "../../utils/time"
import { generateId } from "../../utils/id"
import type { Clip, Transform } from "../../project/projectTypes"
import { TrackComponent } from "./Track"
import { PlayheadBar } from "./PlayheadBar"
import { LabelButton } from "../ui/LabelButton"
import { Dropdown } from "../ui/Dropdown"

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, width: 1280, height: 720, rotation: 0 }

export function Timeline() {
  const project = useEditorStore(s => s.project)
  const playhead = useEditorStore(s => s.playhead)
  const timelineScale = useEditorStore(s => s.timelineScale)
  const setTimelineScale = useEditorStore(s => s.setTimelineScale)
  const addClip = useEditorStore(s => s.addClip)
  const moveClip = useEditorStore(s => s.moveClip)
  const addTrack = useEditorStore(s => s.addTrack)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTimelineScale(timelineScale * factor)
  }

  const { xToTime, hasCollision, resolveDropPosition, dragOverTrackId, setDragOverTrack } = useTimeline()

  const duration = getProjectDuration(project.tracks)
  // Always show at least 30 seconds of ruler
  const rulerDuration = duration + 10

  function handleMediaDrop(trackId: string, mediaId: string, e: DragEvent<HTMLDivElement>) {
    const track = project.tracks.find(t => t.id === trackId)
    if (!track) return
    const media = project.media.find(m => m.id === mediaId)
    if (!media) return

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const mouseX = e.clientX - rect.left - TRACK_HEADER_WIDTH
    const rawStart = Math.max(0, xToTime(mouseX))
    const clipDuration = media.duration ?? 5
    const timelineStart = resolveDropPosition(trackId, rawStart, clipDuration)
    const timelineEnd = timelineStart + clipDuration

    if (hasCollision(trackId, timelineStart, timelineEnd)) return

    let newClip: Clip

    if (media.type === "video") {
      newClip = {
        id: generateId(),
        trackId,
        timelineStart,
        timelineEnd,
        type: "video",
        mediaId: media.id,
        mediaStart: 0,
        mediaEnd: clipDuration,
        volume: 1,
        transform: DEFAULT_TRANSFORM,
      }
    } else if (media.type === "audio") {
      newClip = {
        id: generateId(),
        trackId,
        timelineStart,
        timelineEnd,
        type: "audio",
        mediaId: media.id,
        mediaStart: 0,
        mediaEnd: clipDuration,
        volume: 1,
      }
    } else {
      newClip = {
        id: generateId(),
        trackId,
        timelineStart,
        timelineEnd,
        type: "image",
        mediaId: media.id,
        transform: DEFAULT_TRANSFORM,
      }
    }

    addClip(newClip)
  }

  function handleClipDrop(e: DragEvent<HTMLDivElement>, targetTrackId: string) {
    const clipId = e.dataTransfer.getData("clipId")
    const offsetX = parseFloat(e.dataTransfer.getData("clipOffsetX") || "0")

    let sourceClip: Clip | undefined
    for (const track of project.tracks) {
      sourceClip = track.clips.find(c => c.id === clipId)
      if (sourceClip) break
    }
    if (!sourceClip) return

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const mouseX = e.clientX - rect.left - TRACK_HEADER_WIDTH
    const rawStart = Math.max(0, pxToTime(mouseX - offsetX, timelineScale))
    const clipDuration = sourceClip.timelineEnd - sourceClip.timelineStart
    const newStart = resolveDropPosition(targetTrackId, rawStart, clipDuration, clipId)
    const newEnd = newStart + clipDuration

    if (hasCollision(targetTrackId, newStart, newEnd, clipId)) return

    moveClip(clipId, newStart, targetTrackId)
  }

  const totalWidth = timeToPx(rulerDuration, timelineScale)

  return (
    <div className="flex flex-1 flex-col bg-dark overflow-hidden">
      {/* Scrollable timeline area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative"
        onWheel={handleWheel}
      >
        {/* Inner container sized to timeline duration */}
        <div style={{ minWidth: totalWidth, position: "relative", display: "flex", flexDirection: "column" }}>

          <PlayheadBar totalWidth={totalWidth} />

          {/* Playhead needle — full-height vertical line spanning ruler + all tracks */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: TRACK_HEADER_WIDTH + timeToPx(playhead, timelineScale),
              width: 2,
              height: "100%",
              backgroundColor: "var(--color-accent-red)",
              pointerEvents: "none",
              zIndex: 10,
            }}
          />

          {/* Tracks */}
          {[...project.tracks].sort((a, b) => a.order - b.order).map(track => (
            <TrackComponent
              key={track.id}
              track={track}
              dragOverTrackId={dragOverTrackId}
              setDragOverTrack={setDragOverTrack}
              onDrop={handleMediaDrop}
              onClipDrop={handleClipDrop}
              resolveDropPosition={resolveDropPosition}
            />
          ))}
        </div>
      </div>

      {/* Add track row */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-dark-border bg-dark-surface shrink-0">
        <Dropdown
          trigger={
            <LabelButton
              icon={<Plus />}
              label="Add Track"
              variant="ghost"
              size="sm"
            />
          }
          items={[
            { label: "Video Track", icon: <Film />, onClick: () => addTrack("video") },
            { label: "Audio Track", icon: <Music />, onClick: () => addTrack("audio") },
          ]}
        />
      </div>
    </div>
  )
}
