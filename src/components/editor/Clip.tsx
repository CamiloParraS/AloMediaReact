import { useState, useEffect, type DragEvent } from "react"
import type { Clip } from "../../project/projectTypes"
import { timeToPx, pxToTime } from "../../utils/time"
import { useEditorStore } from "../../store/editorStore"

interface ClipProps {
  clip: Clip
  scale: number
  isSelected: boolean
  onSelect: (clipId: string) => void
  onDragStart: (e: DragEvent<HTMLDivElement>, clipId: string) => void
}

export function ClipComponent({ clip, scale, isSelected, onSelect, onDragStart }: ClipProps) {
  const playhead = useEditorStore(s => s.playhead)
  const splitClip = useEditorStore(s => s.splitClip)
  const removeClip = useEditorStore(s => s.removeClip)
  const resizeClip = useEditorStore(s => s.resizeClip)
  const pushHistory = useEditorStore(s => s.pushHistory)
  const projectMedia = useEditorStore(s => s.project.media)

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function getClipLabel(): string {
    if (clip.type === "text") return clip.content || "Text"
    const media = projectMedia.find(m => m.id === clip.mediaId)
    return media?.name ?? clip.type
  }

  // Close the context menu when the user clicks anywhere outside it
  useEffect(() => {
    if (!contextMenu) return
    function close() { setContextMenu(null) }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [contextMenu])

  const left = timeToPx(clip.timelineStart, scale)
  const width = timeToPx(clip.timelineEnd - clip.timelineStart, scale)

  const isAudio = clip.type === "audio"
  const bgColor = isAudio
    ? (isSelected ? "var(--surface-clip-audio-selected)" : "var(--surface-clip-audio)")
    : (isSelected ? "var(--surface-clip-video-selected)" : "var(--surface-clip-video)")
  const borderColor = isAudio
    ? (isSelected ? "#15803d" : "#14532d")
    : (isSelected ? "#4338ca" : "#312e81")

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const originalEnd = clip.timelineEnd

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX
      const newEnd = Math.max(clip.timelineStart + 0.5, originalEnd + pxToTime(dx, scale))
      resizeClip(clip.id, newEnd)
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      pushHistory("Resize image clip")
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        draggable
        onDragStart={e => { setIsDragging(true); onDragStart(e, clip.id) }}
        onDragEnd={() => setIsDragging(false)}
        onClick={() => onSelect(clip.id)}
        onContextMenu={handleContextMenu}
        className={`hover:brightness-110 transition-[filter,opacity] duration-150 ${isDragging ? "opacity-70" : ""}`}
        style={{
          position: "absolute",
          left,
          width: Math.max(width, 4),
          top: 4,
          bottom: 4,
          backgroundColor: bgColor,
          border: `${isSelected ? 2 : 1}px solid ${borderColor}`,
          borderRadius: 4,
          cursor: isDragging ? "grabbing" : "grab",
          overflow: "hidden",
          boxSizing: "border-box",
          userSelect: "none",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ fontSize: 11, padding: "0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", lineHeight: "100%", color: "rgba(255,255,255,0.85)" }}>
          {getClipLabel()}
        </span>
        <div
          onMouseDown={handleResizeMouseDown}
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize" }}
        />
      </div>

      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: "var(--color-dark-card)",
            border: "1px solid var(--color-dark-border)",
            borderRadius: 6,
            zIndex: 100,
            minWidth: 160,
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{ padding: "6px 12px", cursor: "pointer", fontSize: 13, color: "var(--color-accent-white)" }}
            onClick={e => { e.stopPropagation(); splitClip(clip.id, playhead); setContextMenu(null) }}
          >
            Split at playhead
          </div>
          <div
            style={{ padding: "6px 12px", cursor: "pointer", fontSize: 13, color: "var(--color-destructive-light)" }}
            onClick={e => { e.stopPropagation(); removeClip(clip.id); setContextMenu(null) }}
          >
            Remove clip
          </div>
        </div>
      )}
    </>
  )
}
