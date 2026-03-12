import { useRef, useState, useEffect } from "react"
import { FilePlus2 } from "lucide-react"
import { useEditorStore, fileMap } from "../../store/editorStore"
import { MediaCard, LoadingCard } from "./MediaCard"
import { generateId } from "../../utils/id"
import { generateProxy } from "../../engine/proxyEngine"
import { LabelButton } from "../ui/LabelButton"

interface PendingMedia {
  tempId: string
  fileName: string
}

export function MediaLibrary() {
  const addMedia = useEditorStore(s => s.addMedia)
  const setProxyState = useEditorStore(s => s.setProxyState)
  const proxyMap = useEditorStore(s => s.proxyMap)
  const media = useEditorStore(s => s.project.media)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingMedia[]>([])
  // One object URL per mediaId, revoked on unmount
  const objectUrlsRef = useRef<Map<string, string>>(new Map())

  function getObjectUrl(mediaId: string): string | undefined {
    const existing = objectUrlsRef.current.get(mediaId)
    if (existing) return existing
    const file = fileMap.get(mediaId)
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.set(mediaId, url)
    return url
  }

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const fileArray = Array.from(files)
    const newPending: PendingMedia[] = fileArray.map(file => ({ tempId: generateId(), fileName: file.name }))
    setPending(prev => [...prev, ...newPending])
    await Promise.all(
      fileArray.map(async (file, i) => {
        const m = await addMedia(file)
        setPending(prev => prev.filter(p => p.tempId !== newPending[i].tempId))
        if (m.type === 'video') {
          setProxyState(m.id, { status: 'pending', objectUrl: null })
          generateProxy(
            m.id,
            file,
            (url) => setProxyState(m.id, { status: 'ready', objectUrl: url }),
            () => setProxyState(m.id, { status: 'error', objectUrl: null }),
          )
        }
      })
    )
  }

  const hasItems = media.length > 0 || pending.length > 0

  return (
    <div className="flex flex-col h-full bg-dark-surface overflow-hidden">
      {/* Header */}
      {hasItems && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border shrink-0">
          <span className="text-xs font-semibold text-muted-light uppercase tracking-wider">Media</span>
          <LabelButton
            icon={<FilePlus2 />}
            label="Add Media"
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
      />

      {/* full-panel clickable drop zone */}
      {!hasItems && (
        <div
          className="flex flex-col items-center justify-center flex-1 m-3 gap-4 rounded-xl border-2 border-dashed border-dark-border hover:border-accent-red/60 hover:bg-dark-elevated/20 editor-transition"
        >
          <LabelButton
            icon={<FilePlus2 />}
            label="Add Media"
            variant="primary"
            size="lg"
            onClick={() => inputRef.current?.click()}
          />
          <span className="text-xs text-muted opacity-60 select-none">video, audio or images</span>
        </div>
      )}

      {/* 2-column square grid */}
      {hasItems && (
        <div className="grid grid-cols-2 gap-2 p-2 overflow-y-auto flex-1">
          {media.map(item => (
            <MediaCard key={item.id} media={item} objectUrl={getObjectUrl(item.id)} proxyStatus={proxyMap[item.id]?.status} />
          ))}
          {pending.map(p => (
            <LoadingCard key={p.tempId} fileName={p.fileName} />
          ))}
        </div>
      )}
    </div>
  )
}
