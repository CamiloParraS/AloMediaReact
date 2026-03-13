import { useRef } from "react"
import { useEditorStore } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import { formatTimecode, timeToPx, pxToTime, TRACK_HEADER_WIDTH } from "../../utils/time"

interface PlayheadBarProps {
  totalWidth: number
  duration: number
  majorInterval: number
}

export function PlayheadBar({ totalWidth, duration, majorInterval }: PlayheadBarProps) {
  const playhead = useEditorStore(s => s.playhead)
  const timelineScale = useEditorStore(s => s.timelineScale)
  const { seek, pause } = usePlayer()

  const rulerRef = useRef<HTMLDivElement>(null)
  const playheadLeft = timeToPx(playhead, timelineScale)

  const minorInterval = majorInterval / 5
  const rulerEnd = duration + 10
  const tickCount = Math.ceil(rulerEnd / minorInterval) + 1
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = i * minorInterval
    const majorIndex = Math.round(t / majorInterval)
    const isMajor = Math.abs(t - (majorIndex * majorInterval)) < 0.0001
    return { t, isMajor }
  })

  function timeFromClientX(clientX: number): number {
    if (!rulerRef.current) return 0
    const rect = rulerRef.current.getBoundingClientRect()
    return Math.max(0, pxToTime(clientX - rect.left - TRACK_HEADER_WIDTH, timelineScale))
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    if (useEditorStore.getState().isPlaying) pause()

    seek(timeFromClientX(e.clientX))

    function onMove(ev: MouseEvent) {
      seek(timeFromClientX(ev.clientX))
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  return (
    <div
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "relative",
        height: 32,
        minWidth: totalWidth,
        borderBottom: "1px solid var(--color-dark-elevated)",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        backgroundColor: "var(--surface-ruler)",
      }}
    >
      {ticks.map(({ t, isMajor }) => (
        <div
          key={t}
          style={{
            position: "absolute",
            left: TRACK_HEADER_WIDTH + timeToPx(t, timelineScale),
            top: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: 1, height: isMajor ? 14 : 8, backgroundColor: isMajor ? "var(--color-ruler-tick-major)" : "var(--color-ruler-tick-minor)" }} />
          {isMajor && (
            <span className="text-[10px] text-muted-light ml-0.5 leading-tight">
              {formatTimecode(t)}
            </span>
          )}
        </div>
      ))}

      {/* Draggable handle — circle sitting at the top of the playhead needle */}
      <div
        style={{
          position: "absolute",
          left: TRACK_HEADER_WIDTH + playheadLeft - 6,
          top: 10,
          width: 12,
          height: 12,
          backgroundColor: "var(--color-accent-red)",
          borderRadius: "50%",
          cursor: "ew-resize",
          zIndex: 20,
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
