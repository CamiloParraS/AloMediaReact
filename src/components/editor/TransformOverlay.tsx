import type { ImageClip, TextClip, VideoClip, Transform } from "../../project/projectTypes"

const CANVAS_W = 1280
const CANVAS_H = 720

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

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

  // Rotate handle: 12px above top-center
  const rotHandleX = sx + sw / 2
  const rotHandleY = sy - 12

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

  function handleCornerMouseDown(corner: Corner) {
    return function (e: React.MouseEvent) {
      e.stopPropagation()
      const startMouseX = e.clientX
      const startMouseY = e.clientY
      const startT = { ...t }

      function onMove(ev: MouseEvent) {
        const dx = (ev.clientX - startMouseX) / scaleX
        const dy = (ev.clientY - startMouseY) / scaleY
        if (corner === 'topLeft') {
          onUpdate({
            x: startT.x + dx,
            y: startT.y + dy,
            width: Math.max(20, startT.width - dx),
            height: Math.max(20, startT.height - dy),
          })
        } else if (corner === 'topRight') {
          onUpdate({
            y: startT.y + dy,
            width: Math.max(20, startT.width + dx),
            height: Math.max(20, startT.height - dy),
          })
        } else if (corner === 'bottomLeft') {
          onUpdate({
            x: startT.x + dx,
            width: Math.max(20, startT.width - dx),
            height: Math.max(20, startT.height + dy),
          })
        } else {
          onUpdate({
            width: Math.max(20, startT.width + dx),
            height: Math.max(20, startT.height + dy),
          })
        }
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        onCommit()
      }

      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    }
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

  // Square corner handles (DaVinci/Premiere convention — no border-radius)
  const corners: { corner: Corner; x: number; y: number; cursor: string }[] = [
    { corner: 'topLeft',     x: sx - 4,       y: sy - 4,       cursor: 'nwse-resize' },
    { corner: 'topRight',    x: sx + sw - 4,   y: sy - 4,       cursor: 'nesw-resize' },
    { corner: 'bottomLeft',  x: sx - 4,       y: sy + sh - 4,   cursor: 'nesw-resize' },
    { corner: 'bottomRight', x: sx + sw - 4,   y: sy + sh - 4,   cursor: 'nwse-resize' },
  ]

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: 8,
    height: 8,
    background: "var(--color-accent-white)",
    border: "1px solid var(--color-accent-red)",
    borderRadius: 0, // Square handles — DaVinci convention
    boxSizing: "border-box",
    pointerEvents: "all",
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
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute",
          left: sx,
          top: sy,
          width: sw,
          height: sh,
          border: "1px solid var(--color-accent-red)",
          boxSizing: "border-box",
          cursor: "move",
          pointerEvents: "all",
        }}
      />

      {/* Stem line from top-center to rotate handle */}
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
          stroke="var(--color-accent-red)"
          strokeWidth={1}
        />
      </svg>

      {/* Rotate handle — diamond (rotated square), 12px above top-center */}
      <div
        onMouseDown={handleRotateMouseDown}
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute",
          left: rotHandleX - 3,
          top: rotHandleY - 3,
          width: 6,
          height: 6,
          background: "var(--color-accent-white)",
          border: "1px solid var(--color-accent-red)",
          transform: "rotate(45deg)",
          cursor: "grab",
          boxSizing: "border-box",
          pointerEvents: "all",
        }}
      />

      {/* Corner resize handles — square */}
      {corners.map(({ corner, x, y, cursor }) => (
        <div
          key={corner}
          onMouseDown={handleCornerMouseDown(corner)}
          onClick={e => e.stopPropagation()}
          style={{ ...handleStyle, left: x, top: y, cursor }}
        />
      ))}
    </div>
  )
}
