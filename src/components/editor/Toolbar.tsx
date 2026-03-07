import { useEditorStore } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":")
}

export function Toolbar() {
  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const playhead = useEditorStore(s => s.playhead)
  const timelineScale = useEditorStore(s => s.timelineScale)
  const splitClip = useEditorStore(s => s.splitClip)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const setTimelineScale = useEditorStore(s => s.setTimelineScale)

  const { play, pause, seek, isPlaying } = usePlayer()

  const btnStyle: React.CSSProperties = {
    padding: "4px 12px",
    cursor: "pointer",
    fontSize: 13,
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    borderRadius: 4,
  }

  const disabledBtnStyle: React.CSSProperties = {
    ...btnStyle,
    opacity: 0.4,
    cursor: "not-allowed",
  }

  return (
    <div style={{ display: "flex", gap: 8, padding: "8px 12px", backgroundColor: "#0f172a", borderBottom: "1px solid #1e293b", alignItems: "center" }}>
      <button style={btnStyle} onClick={() => isPlaying ? pause() : play()}>
        {isPlaying ? "Pause" : "Play"}
      </button>

      <span style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8", minWidth: 64, textAlign: "center" }}>
        {formatTime(playhead)}
      </span>

      <button style={btnStyle} onClick={() => seek(0)}>
        Seek to 0
      </button>

      <button
        style={selectedClipId ? btnStyle : disabledBtnStyle}
        disabled={!selectedClipId}
        onClick={() => { if (selectedClipId) splitClip(selectedClipId, playhead) }}
      >
        Split
      </button>

      <button style={btnStyle} onClick={undo}>Undo</button>
      <button style={btnStyle} onClick={redo}>Redo</button>

      <button style={btnStyle} onClick={() => setTimelineScale(timelineScale + 10)}>Zoom In</button>
      <button style={btnStyle} onClick={() => setTimelineScale(Math.max(10, timelineScale - 10))}>Zoom Out</button>
    </div>
  )
}
