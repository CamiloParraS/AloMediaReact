import { useRef } from "react"
import { useEditorStore } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import { getProjectDuration, timeToPx, pxToTime } from "../../utils/time"

function getTickInterval(pxPerSecond: number): { major: number; minor: number } {
  if (pxPerSecond >= 100) return { major: 1,   minor: 0.5  }
  if (pxPerSecond >= 50)  return { major: 5,   minor: 1    }
  if (pxPerSecond >= 20)  return { major: 15,  minor: 5    }
  if (pxPerSecond >= 8)   return { major: 60,  minor: 15   }
  return                          { major: 300, minor: 60  }
}

function formatTickLabel(seconds: number, majorInterval: number): string {
  if (majorInterval >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, "0")}`
  }
  return `${seconds}s`
}

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
  const { major, minor } = getTickInterval(timelineScale)

  // Build tick list — step through at minor interval up to duration + 10
  const rulerEnd = duration + 10
  const tickCount = Math.ceil(rulerEnd / minor) + 1
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = i * minor
    return { t, isMajor: t % major < 0.0001 }
  })
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
      {ticks.map(({ t, isMajor }) => (
        <div
          key={t}
          style={{
            position: "absolute",
            left: timeToPx(t, timelineScale),
            top: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: 1, height: isMajor ? 10 : 5, backgroundColor: isMajor ? "#475569" : "#1e293b" }} />
          {isMajor && (
            <span style={{ fontSize: 10, color: "#64748b", marginLeft: 2 }}>
              {formatTickLabel(t, major)}
            </span>
          )}
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
