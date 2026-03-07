import { useRef } from "react"
import { useEditorStore } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import { getProjectDuration, timeToPx, pxToTime } from "../../utils/time"

interface PlayheadBarProps {
  totalWidth: number
}

export function PlayheadBar({ totalWidth }: PlayheadBarProps) {
  const playhead = useEditorStore(s => s.playhead)
  const timelineScale = useEditorStore(s => s.timelineScale)
  const tracks = useEditorStore(s => s.project.tracks)
  const { seek } = usePlayer()

  const rulerRef = useRef<HTMLDivElement>(null)
  const duration = getProjectDuration(tracks)
  const playheadLeft = timeToPx(playhead, timelineScale)

  // Compute timeline time from a viewport X coordinate.
  // getBoundingClientRect already accounts for container scroll, so no extra offset needed.
  function timeFromClientX(clientX: number): number {
    if (!rulerRef.current) return 0
    const rect = rulerRef.current.getBoundingClientRect()
    return Math.max(0, pxToTime(clientX - rect.left, timelineScale))
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    seek(timeFromClientX(e.clientX))

    function onMove(ev: MouseEvent) {
      seek(timeFromClientX(ev.clientX))
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }

    // Attach to document so the drag continues even if the mouse leaves the ruler
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  const ticks = Array.from({ length: Math.ceil(duration) + 11 }, (_, i) => i)

  return (
    <div
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "relative",
        height: 28,
        minWidth: totalWidth,
        borderBottom: "1px solid #1e293b",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {ticks.map(i => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: timeToPx(i, timelineScale),
            top: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: 1, height: 8, backgroundColor: "#334155" }} />
          <span style={{ fontSize: 10, color: "#64748b", marginLeft: 2 }}>{i}s</span>
        </div>
      ))}

      {/* Draggable handle — circle sitting at the top of the playhead needle */}
      <div
        style={{
          position: "absolute",
          left: playheadLeft - 6,
          top: 8,
          width: 12,
          height: 12,
          backgroundColor: "#ef4444",
          borderRadius: "50%",
          cursor: "ew-resize",
          zIndex: 20,
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
