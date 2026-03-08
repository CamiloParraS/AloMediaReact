import type { ImageClip, TextClip, VideoClip, Transform } from "../../project/projectTypes"

const CANVAS_W = 1280
const CANVAS_H = 720

interface TransformOverlayProps {
  clip: VideoClip | ImageClip | TextClip
  previewWidth: number
  previewHeight: number
  onUpdate: (transform: Partial<Transform>) => void
  onCommit: () => void
}

export function TransformOverlay({ clip, previewWidth, previewHeight, onUpdate, onCommit }: TransformOverlayProps) {
  const scaleX = previewWidth / CANVAS_W
  const scaleY = previewHeight / CANVAS_H

  const t = clip.transform
  const sx = t.x * scaleX
  const sy = t.y * scaleY
  const sw = t.width * scaleX
  const sh = t.height * scaleY

  const rotHandleX = sx + sw / 2
  const rotHandleY = sy - 24

  function handleMoveMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startT = { ...t }

    function onMove(ev: MouseEvent) {
      const dx = (ev.clientX - startMouseX) / scaleX
      const dy = (ev.clientY - startMouseY) / scaleY
      onUpdate({ x: startT.x + dx, y: startT.y + dy })
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      onCommit()
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startT = { ...t }

    function onMove(ev: MouseEvent) {
      const dw = (ev.clientX - startMouseX) / scaleX
      const dh = (ev.clientY - startMouseY) / scaleY
      onUpdate({
        width: Math.max(20, startT.width + dw),
        height: Math.max(20, startT.height + dh),
      })
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      onCommit()
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  function handleRotateMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    const centerX = sx + sw / 2
    const centerY = sy + sh / 2

    function onMove(ev: MouseEvent) {
      const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX)
      const degrees = (angle * 180) / Math.PI + 90
      onUpdate({ rotation: degrees })
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      onCommit()
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: 10,
    height: 10,
    backgroundColor: "#fff",
    border: "2px solid #3b82f6",
    borderRadius: 2,
    boxSizing: "border-box",
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {/* Bounding box + move area */}
      <div
        onMouseDown={handleMoveMouseDown}
        style={{
          position: "absolute",
          left: sx,
          top: sy,
          width: sw,
          height: sh,
          border: "1px solid #3b82f6",
          boxSizing: "border-box",
          cursor: "move",
          pointerEvents: "all",
        }}
      />

      {/* Corner indicators (top-left, top-right, bottom-left — visual only) */}
      {([
        [sx - 5, sy - 5],
        [sx + sw - 5, sy - 5],
        [sx - 5, sy + sh - 5],
      ] as [number, number][]).map(([cx, cy], i) => (
        <div key={i} style={{ ...handleStyle, left: cx, top: cy, pointerEvents: "none" }} />
      ))}

      {/* Bottom-right corner — resize handle (interactive) */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          ...handleStyle,
          left: sx + sw - 5,
          top: sy + sh - 5,
          cursor: "se-resize",
          pointerEvents: "all",
        }}
      />

      {/* Rotation stem line */}
      <svg
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
        width={previewWidth}
        height={previewHeight}
      >
        <line
          x1={sx + sw / 2}
          y1={sy}
          x2={rotHandleX}
          y2={rotHandleY}
          stroke="#3b82f6"
          strokeWidth={1}
        />
      </svg>

      {/* Rotation handle */}
      <div
        onMouseDown={handleRotateMouseDown}
        style={{
          position: "absolute",
          left: rotHandleX - 8,
          top: rotHandleY - 8,
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: "#fff",
          border: "2px solid #3b82f6",
          cursor: "crosshair",
          boxSizing: "border-box",
          pointerEvents: "all",
        }}
      />
    </div>
  )
}
