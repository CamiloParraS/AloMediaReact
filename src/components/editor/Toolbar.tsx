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
import { Divider } from "../ui/Divider"
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
      <div className="bg-dark-elevated border border-dark-border rounded-xl shadow-2xl w-[520px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-accent-white uppercase tracking-wider">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-muted hover:text-accent-white editor-transition">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {[left, right].map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {col.map(({ keys, action }) => (
                <div key={keys} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-muted">{action}</span>
                  <kbd className="text-[11px] font-mono bg-dark-card border border-dark-border rounded px-1.5 py-0.5 text-muted-light ml-3 shrink-0">
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

  // Clean up on unmount
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

  return (
    <>
      <div
        className="flex items-center gap-0.5 px-3 h-10 shrink-0 bg-dark-surface border-t border-b border-dark-border sticky top-0 z-10"
      >
        {/* Edit group */}
        <IconButton
          icon={<Scissors />}
          label="Cut at playhead"
          size="sm"
          disabled={!selectedClipId}
          onClick={() => { if (selectedClipId) splitClip(selectedClipId, playhead) }}
        />
        <IconButton icon={<Copy />} label="Copy" size="sm" onClick={copyClip} />
        <IconButton icon={<Clipboard />} label="Paste" size="sm" onClick={pasteClip} />

        <Divider />

        {/* History group */}
        <IconButton icon={<Undo2 />} label="Undo" size="sm" onClick={undo} />
        <IconButton icon={<Redo2 />} label="Redo" size="sm" onClick={redo} />

        <Divider />

        {/* Zoom group — hold-to-zoom */}
        <IconButton
          icon={<ZoomIn />}
          label="Zoom in"
          size="sm"
          onPointerDown={startZoomIn}
          onPointerUp={clearZoomIn}
          onPointerLeave={clearZoomIn}
          onPointerCancel={clearZoomIn}
        />
        <IconButton
          icon={<ZoomOut />}
          label="Zoom out"
          size="sm"
          onPointerDown={startZoomOut}
          onPointerUp={clearZoomOut}
          onPointerLeave={clearZoomOut}
          onPointerCancel={clearZoomOut}
        />
        <IconButton
          icon={<Maximize2 />}
          label="Fit to screen"
          size="sm"
          onClick={() => seek(0)}
        />

        <Divider />

        {/* Snap toggle */}
        <IconButton
          icon={<Magnet />}
          label={snapEnabled ? "Disable snap" : "Enable snap"}
          size="sm"
          active={snapEnabled}
          onClick={() => setSnapEnabled(v => !v)}
        />

        <Divider />

        <LabelButton
          icon={<Film />}
          label="+ Video Track"
          variant="ghost"
          size="sm"
          onClick={() => addTrack("video")}
        />
        <LabelButton
          icon={<Music />}
          label="+ Audio Track"
          variant="ghost"
          size="sm"
          onClick={() => addTrack("audio")}
        />

        <div className="ml-auto">
          <IconButton
            icon={<HelpCircle />}
            label="Keyboard shortcuts"
            size="sm"
            onClick={() => setShowShortcuts(true)}
          />
        </div>
      </div>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  )
}
