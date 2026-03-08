import { useRef, useState, useEffect } from "react"
import { useEditorStore, fileMap } from "../../store/editorStore"
import { MediaCard, LoadingCard } from "./MediaCard"
import { generateId } from "../../utils/id"
import { generateProxy } from "../../engine/proxyEngine"

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

  return (
    <div style={{ width: 240, padding: 12, borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", gap: 12, backgroundColor: "#020617" }}>
      <div style={{ fontWeight: 600, color: "#e2e8f0" }}>Media Library</div>

      <button
        onClick={() => inputRef.current?.click()}
        style={{ padding: "6px 12px", cursor: "pointer", backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 4 }}
      >
        Add Media
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        style={{ display: "none" }}
        onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
        {media.map(item => (
          <MediaCard key={item.id} media={item} objectUrl={getObjectUrl(item.id)} proxyStatus={proxyMap[item.id]?.status} />
        ))}
        {pending.map(p => (
          <LoadingCard key={p.tempId} fileName={p.fileName} />
        ))}
      </div>
    </div>
  )
}
