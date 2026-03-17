import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useEditorStore } from "../../store/editorStore"

interface MediaContextMenuProps {
  mediaId: string
  x: number
  y: number
  onClose: () => void
  onInsertAtPlayhead: () => void
}

export function MediaContextMenu({ mediaId, x, y, onClose, onInsertAtPlayhead }: MediaContextMenuProps) {
  const removeMedia = useEditorStore(s => s.removeMedia)
  const proxyMap = useEditorStore(s => s.proxyMap)
  const tracks = useEditorStore(s => s.project.tracks)
  const menuRef = useRef<HTMLDivElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const proxyStatus = proxyMap[mediaId]?.status
  const isProxyPending = proxyStatus === 'pending'

  const clipsUsingMedia = tracks.flatMap(t => t.clips).filter(
    c => 'mediaId' in c && c.mediaId === mediaId,
  )
  const clipCount = clipsUsingMedia.length

  // Clamp position to viewport
  const menuWidth = 200
  const menuHeight = 88
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function onScroll() { onClose() }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  function handleInsert() {
    if (isProxyPending) return
    onInsertAtPlayhead()
    onClose()
  }

  function handleDeleteClick() {
    if (clipCount > 0) {
      setConfirmDelete(true)
    } else {
      removeMedia(mediaId)
      onClose()
    }
  }

  function handleConfirmDelete() {
    removeMedia(mediaId)
    onClose()
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ left: clampedX, top: clampedY, width: menuWidth, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
      className="fixed z-9999 border border-dark-border bg-dark-elevated py-1 context-menu-enter"
    >
      {!confirmDelete ? (
        <>
          <button
            role="menuitem"
            onClick={handleInsert}
            disabled={isProxyPending}
            title={isProxyPending ? "Proxy not ready yet" : undefined}
            className="w-full text-left px-3 py-1.5 text-[11px] text-accent-white hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed editor-transition"
          >
            Add to Timeline
          </button>
          <div className="h-px bg-dark-border mx-2 my-1" />
          <button
            role="menuitem"
            onClick={handleDeleteClick}
            className="w-full text-left px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-950/40 editor-transition"
          >
            Delete Media
          </button>
        </>
      ) : (
        <div className="px-3 py-2 flex flex-col gap-2">
          <p className="text-xs text-muted-light leading-snug">
            This will also remove {clipCount} clip{clipCount !== 1 ? 's' : ''}. Confirm?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmDelete}
              className="flex-1 text-[10px] text-red-400 border border-red-800 px-2 py-1 hover:bg-red-950/40 editor-transition"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 text-[10px] text-muted-light border border-dark-border px-2 py-1 hover:bg-dark-border editor-transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
