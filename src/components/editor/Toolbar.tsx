import { useCallback, useEffect, useRef, useState } from "react"
import {
  Scissors,
  Copy,
  Clipboard,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Magnet,
  Film,
  Music,
  HelpCircle,
  X,
} from "lucide-react"
import { useEditorStore } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import {
  TIMELINE_ZOOM,
  MIN_PIXELS_PER_SECOND,
  MAX_PIXELS_PER_SECOND,
} from "../../constants/timeline"
import { IconButton } from "../ui/IconButton"
import { LabelButton } from "../ui/LabelButton"

const SHORTCUTS = [
  { keys: "Ctrl+Z",          action: "Undo" },
  { keys: "Ctrl+Y",          action: "Redo" },
  { keys: "Ctrl+C",          action: "Copy selected clip" },
  { keys: "Ctrl+V",          action: "Paste clip" },
  { keys: "Ctrl+X",          action: "Cut selected clip" },
  { keys: "Space",           action: "Play / Pause" },
  { keys: "Shift+I",         action: "Add media (open picker)" },
  { keys: "Shift+S",         action: "Split clip at playhead" },
  { keys: "Shift++",         action: "Zoom in" },
  { keys: "Shift+−",         action: "Zoom out" },
  { keys: "Delete",          action: "Delete selected clip" },
  { keys: ",",               action: "Seek back 1 frame" },
  { keys: ".",               action: "Seek forward 1 frame" },
]

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [onClose])

  const half = Math.ceil(SHORTCUTS.length / 2)
  const left = SHORTCUTS.slice(0, half)
  const right = SHORTCUTS.slice(half)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: "var(--color-dark-elevated)",
          border: "1px solid var(--color-dark-border)",
          borderRadius: 0,
          width: 520,
          padding: 20,
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h2
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
            }}
          >
            Keyboard Shortcuts
          </h2>
          <IconButton
            icon={<X size={14} />}
            label="Close"
            size="sm"
            onClick={onClose}
          />
        </div>
        <div className="grid grid-cols-2" style={{ gap: "0 24px" }}>
          {[left, right].map((col, ci) => (
            <div key={ci} className="flex flex-col" style={{ gap: 2 }}>
              {col.map(({ keys, action }) => (
                <div key={keys} className="flex items-center justify-between" style={{ padding: "2px 0" }}>
                  <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{action}</span>
                  <kbd
                    style={{
                      fontSize: 10,
                      fontFamily: "'Courier New', monospace",
                      background: "var(--color-dark-card)",
                      border: "1px solid var(--color-dark-border)",
                      borderRadius: 0,
                      padding: "1px 6px",
                      color: "var(--color-muted-light)",
                      marginLeft: 12,
                      flexShrink: 0,
                    }}
                  >
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GroupDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        margin: "0 6px",
        background: "var(--color-dark-border)",
        flexShrink: 0,
      }}
    />
  )
}

export function Toolbar() {
  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const playhead = useEditorStore(s => s.playhead)
  const splitClip = useEditorStore(s => s.splitClip)
  const copyClip = useEditorStore(s => s.copyClip)
  const pasteClip = useEditorStore(s => s.pasteClip)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const addTrack = useEditorStore(s => s.addTrack)
  const setTimelineScale = useEditorStore(s => s.setTimelineScale)
  const timelineScale = useEditorStore(s => s.timelineScale)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const { seek } = usePlayer()

  // Hold-to-zoom refs
  const zoomInIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const zoomInTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoomOutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const zoomOutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearZoomIn() {
    if (zoomInIntervalRef.current !== null) { clearInterval(zoomInIntervalRef.current); zoomInIntervalRef.current = null }
    if (zoomInTimeoutRef.current !== null) { clearTimeout(zoomInTimeoutRef.current); zoomInTimeoutRef.current = null }
  }
  function clearZoomOut() {
    if (zoomOutIntervalRef.current !== null) { clearInterval(zoomOutIntervalRef.current); zoomOutIntervalRef.current = null }
    if (zoomOutTimeoutRef.current !== null) { clearTimeout(zoomOutTimeoutRef.current); zoomOutTimeoutRef.current = null }
  }

  useEffect(() => () => { clearZoomIn(); clearZoomOut() }, [])

  const applyZoomIn = useCallback(() => {
    const current = useEditorStore.getState().timelineScale
    const next = Math.min(MAX_PIXELS_PER_SECOND, current + TIMELINE_ZOOM.STEP_BUTTON)
    setTimelineScale(next)
    if (next >= MAX_PIXELS_PER_SECOND) clearZoomIn()
  }, [setTimelineScale])

  const applyZoomOut = useCallback(() => {
    const current = useEditorStore.getState().timelineScale
    const next = Math.max(MIN_PIXELS_PER_SECOND, current - TIMELINE_ZOOM.STEP_BUTTON)
    setTimelineScale(next)
    if (next <= MIN_PIXELS_PER_SECOND) clearZoomOut()
  }, [setTimelineScale])

  function startZoomIn() {
    applyZoomIn()
    zoomInTimeoutRef.current = setTimeout(() => {
      zoomInIntervalRef.current = setInterval(applyZoomIn, 80)
    }, 400)
  }

  function startZoomOut() {
    applyZoomOut()
    zoomOutTimeoutRef.current = setTimeout(() => {
      zoomOutIntervalRef.current = setInterval(applyZoomOut, 80)
    }, 400)
  }

  // Compute zoom percentage from scale
  const zoomPercent = Math.round((timelineScale / 100) * 100)

  return (
    <>
      <div
        className="flex items-center shrink-0"
        style={{
          height: 36,
          background: "var(--color-dark)",
          borderTop: "1px solid var(--color-dark-border)",
          borderBottom: "1px solid var(--color-dark-border)",
          padding: "0 8px",
          gap: 0,
          position: "sticky",
          top: 0,
          zIndex: 10,
          overflow: "hidden",
        }}
      >
        {/* Edit group */}
        <IconButton
          icon={<Scissors size={14} />}
          label="Cut at playhead"
          size="sm"
          disabled={!selectedClipId}
          onClick={() => { if (selectedClipId) splitClip(selectedClipId, playhead) }}
        />
        <IconButton
          icon={<Copy size={14} />}
          label="Copy"
          size="sm"
          onClick={copyClip}
        />
        <IconButton
          icon={<Clipboard size={14} />}
          label="Paste"
          size="sm"
          onClick={pasteClip}
        />

        <GroupDivider />

        {/* History group */}
        <IconButton icon={<Undo2 size={14} />} label="Undo" size="sm" onClick={undo} />
        <IconButton icon={<Redo2 size={14} />} label="Redo" size="sm" onClick={redo} />

        <GroupDivider />

        {/* Zoom group */}
        <IconButton
          icon={<ZoomOut size={14} />}
          label="Zoom out"
          size="sm"
          onPointerDown={startZoomOut}
          onPointerUp={clearZoomOut}
          onPointerLeave={clearZoomOut}
          onPointerCancel={clearZoomOut}
        />
        <div
          style={{
            width: 44,
            textAlign: "center",
            fontSize: 10,
            fontFamily: "'Courier New', monospace",
            color: "var(--color-muted)",
            flexShrink: 0,
          }}
        >
          {zoomPercent}%
        </div>
        <IconButton
          icon={<ZoomIn size={14} />}
          label="Zoom in"
          size="sm"
          onPointerDown={startZoomIn}
          onPointerUp={clearZoomIn}
          onPointerLeave={clearZoomIn}
          onPointerCancel={clearZoomIn}
        />
        <IconButton
          icon={<Maximize2 size={14} />}
          label="Fit to screen"
          size="sm"
          onClick={() => seek(0)}
        />

        <GroupDivider />

        {/* Snap toggle */}
        <IconButton
          icon={<Magnet size={14} />}
          label={snapEnabled ? "Disable snap" : "Enable snap"}
          size="sm"
          accent={snapEnabled}
          onClick={() => setSnapEnabled(v => !v)}
        />

        <GroupDivider />

        {/* Track buttons */}
        <LabelButton
          icon={<Film size={14} />}
          label="+ Video Track"
          variant="ghost"
          size="sm"
          onClick={() => addTrack("video")}
        />
        <LabelButton
          icon={<Music size={14} />}
          label="+ Audio Track"
          variant="ghost"
          size="sm"
          onClick={() => addTrack("audio")}
        />

        <div style={{ flex: 1 }} />

        {/* Help */}
        <IconButton
          icon={<HelpCircle size={14} />}
          label="Keyboard shortcuts"
          size="sm"
          onClick={() => setShowShortcuts(true)}
        />
      </div>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  )
}
