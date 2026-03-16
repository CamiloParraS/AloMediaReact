import { useEffect, useRef } from "react"
import { useEditorStore } from "../store/editorStore"
import { usePlayer } from "./usePlayer"
import { triggerFileInputRef } from "../components/editor/MediaLibrary"
import {
  MIN_PIXELS_PER_SECOND,
  MAX_PIXELS_PER_SECOND,
  TIMELINE_ZOOM,
} from "../constants/timeline"

/** Returns true when the event target is a text-entry element — shortcuts should not fire. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true
  if (el.isContentEditable) return true
  return false
}

// Hold-to-zoom refs — stored at module level so the keyup handler can clear them
// without stale closure issues.
const zoomInIntervalRef = { current: null as ReturnType<typeof setInterval> | null }
const zoomInTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null }
const zoomOutIntervalRef = { current: null as ReturnType<typeof setInterval> | null }
const zoomOutTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null }

function clearZoomIn() {
  if (zoomInIntervalRef.current !== null) { clearInterval(zoomInIntervalRef.current); zoomInIntervalRef.current = null }
  if (zoomInTimeoutRef.current !== null) { clearTimeout(zoomInTimeoutRef.current); zoomInTimeoutRef.current = null }
}
function clearZoomOut() {
  if (zoomOutIntervalRef.current !== null) { clearInterval(zoomOutIntervalRef.current); zoomOutIntervalRef.current = null }
  if (zoomOutTimeoutRef.current !== null) { clearTimeout(zoomOutTimeoutRef.current); zoomOutTimeoutRef.current = null }
}

export function useEditorKeyboardShortcuts() {
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const copyClip = useEditorStore(s => s.copyClip)
  const pasteClip = useEditorStore(s => s.pasteClip)
  const removeClip = useEditorStore(s => s.removeClip)
  const splitClip = useEditorStore(s => s.splitClip)
  const setTimelineScale = useEditorStore(s => s.setTimelineScale)

  const { play, pause, seek } = usePlayer()

  // Use refs for values needed inside event handlers to avoid stale closures
  const storeRef = useRef(useEditorStore.getState)

  useEffect(() => {
    function applyZoomIn() {
      const { timelineScale } = storeRef.current()
      const next = Math.min(MAX_PIXELS_PER_SECOND, timelineScale + TIMELINE_ZOOM.STEP_BUTTON)
      setTimelineScale(next)
      if (next >= MAX_PIXELS_PER_SECOND) clearZoomIn()
    }

    function applyZoomOut() {
      const { timelineScale } = storeRef.current()
      const next = Math.max(MIN_PIXELS_PER_SECOND, timelineScale - TIMELINE_ZOOM.STEP_BUTTON)
      setTimelineScale(next)
      if (next <= MIN_PIXELS_PER_SECOND) clearZoomOut()
    }

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

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+Z — Undo
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      // Ctrl+Y — Redo
      if (ctrl && e.key === "y") {
        e.preventDefault()
        redo()
        return
      }

      // Ctrl+C — Copy
      if (ctrl && e.key === "c") {
        e.preventDefault()
        copyClip()
        return
      }

      // Ctrl+V — Paste
      if (ctrl && e.key === "v") {
        e.preventDefault()
        pasteClip()
        return
      }

      // Ctrl+X — Cut (copy then delete)
      if (ctrl && e.key === "x") {
        e.preventDefault()
        const { selectedClipId } = storeRef.current()
        if (!selectedClipId) return
        copyClip()
        removeClip(selectedClipId)
        return
      }

      // Space — Play / Pause
      if (e.key === " " && !ctrl) {
        e.preventDefault()
        const { isPlaying } = storeRef.current()
        if (isPlaying) pause()
        else play()
        return
      }

      // Shift+I — Open file picker
      if (e.shiftKey && e.key === "I") {
        e.preventDefault()
        triggerFileInputRef.current?.()
        return
      }

      // Shift+S — Split clip at playhead
      if (e.shiftKey && e.key === "S") {
        e.preventDefault()
        const { selectedClipId, playhead } = storeRef.current()
        if (!selectedClipId) return
        splitClip(selectedClipId, playhead)
        return
      }

      // Shift+= (zoom in) — hold-to-zoom
      if (e.shiftKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault()
        if (!e.repeat) startZoomIn()
        return
      }

      // Shift+- (zoom out) — hold-to-zoom
      if (e.shiftKey && e.key === "-") {
        e.preventDefault()
        if (!e.repeat) startZoomOut()
        return
      }

      // Delete / Backspace — Delete selected clip
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        const { selectedClipId } = storeRef.current()
        if (!selectedClipId) return
        removeClip(selectedClipId)
        return
      }

      // , — Seek back 1 frame (~33ms)
      if (e.key === ",") {
        e.preventDefault()
        const { playhead } = storeRef.current()
        seek(Math.max(0, playhead - 0.033))
        return
      }

      // . — Seek forward 1 frame
      if (e.key === ".") {
        e.preventDefault()
        const { playhead } = storeRef.current()
        seek(playhead + 0.033)
        return
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.shiftKey === false) {
        // Shift was released — always clear zoom intervals
        clearZoomIn()
        clearZoomOut()
        return
      }
      if (e.key === "=" || e.key === "+") clearZoomIn()
      if (e.key === "-") clearZoomOut()
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      clearZoomIn()
      clearZoomOut()
    }
  }, [undo, redo, copyClip, pasteClip, removeClip, splitClip, setTimelineScale, play, pause, seek])
}
