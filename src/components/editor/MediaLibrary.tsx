import { useRef, useState, useEffect, useCallback } from "react"
import { FilePlus2 } from "lucide-react"
import { useEditorStore, fileMap } from "../../store/editorStore"
import { MediaCard, LoadingCard } from "./MediaCard"
import { generateId } from "../../utils/id"
import { generateProxy } from "../../engine/proxyEngine"
import { LabelButton } from "../ui/LabelButton"
import type { Clip, Media, Track } from "../../project/projectTypes"
import { DEFAULT_AUDIO_CONFIG } from "../../constants/audioConfig"
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../constants/colorAdjustments"
import { DEFAULT_SPEED } from "../../constants/speed"
import { toMs, toSeconds } from "../../utils/time"

interface PendingMedia {
  tempId: string
  fileName: string
}

// Module-level ref so keyboard shortcut hook can trigger the file input
export const triggerFileInputRef = { current: null as (() => void) | null }

export function MediaLibrary() {
  const addMedia = useEditorStore(s => s.addMedia)
  const setProxyState = useEditorStore(s => s.setProxyState)
  const proxyMap = useEditorStore(s => s.proxyMap)
  const media = useEditorStore(s => s.project.media)
  const playhead = useEditorStore(s => s.playhead)
  const tracks = useEditorStore(s => s.project.tracks)
  const addClip = useEditorStore(s => s.addClip)
  const addTrack = useEditorStore(s => s.addTrack)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingMedia[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  // One object URL per mediaId, revoked on unmount
  const objectUrlsRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    triggerFileInputRef.current = () => inputRef.current?.click()
    return () => {
      triggerFileInputRef.current = null
    }
  }, [])

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

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only respond to OS file drags, not internal clip/media token drags
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
    setDropError(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    // Only clear if pointer truly left the drop zone element (not a child)
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const accepted: File[] = []
    const rejected: string[] = []

    Array.from(e.dataTransfer.files).forEach(file => {
      if (file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type.startsWith('image/')) {
        accepted.push(file)
      } else {
        rejected.push(file.name)
      }
    })

    if (rejected.length > 0) {
      setDropError(`Unsupported: ${rejected.slice(0, 2).join(', ')}${rejected.length > 2 ? ` +${rejected.length - 2} more` : ''}`)
      setTimeout(() => setDropError(null), 3500)
    }

    if (accepted.length > 0) {
      const dt = new DataTransfer()
      accepted.forEach(f => dt.items.add(f))
      await handleFiles(dt.files)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMedia, setProxyState])

  function insertMediaAtPlayhead(item: Media) {
    const trackType = item.type === "audio" ? "audio" : "video"
    const roundedPlayhead = toSeconds(toMs(playhead))
    const duration = item.duration ?? 5
    const timelineStart = roundedPlayhead
    const timelineEnd = toSeconds(toMs(roundedPlayhead + duration))

    let targetTrack: Track | undefined = tracks.find(track =>
      track.type === trackType
      && !track.clips.some(clip => timelineStart < clip.timelineEnd && timelineEnd > clip.timelineStart),
    )

    if (!targetTrack) {
      targetTrack = addTrack(trackType)
    }

    const newClip: Clip = item.type === "audio"
      ? {
        id: generateId(),
        trackId: targetTrack.id,
        type: "audio",
        mediaId: item.id,
        timelineStart,
        timelineEnd,
        mediaStart: 0,
        mediaEnd: duration,
        volume: 1,
        speed: DEFAULT_SPEED,
        audioConfig: { ...DEFAULT_AUDIO_CONFIG },
      }
      : item.type === "image"
        ? {
          id: generateId(),
          trackId: targetTrack.id,
          type: "image",
          mediaId: item.id,
          timelineStart,
          timelineEnd,
          transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0 },
          colorAdjustments: { ...DEFAULT_COLOR_ADJUSTMENTS },
        }
        : {
          id: generateId(),
          trackId: targetTrack.id,
          type: "video",
          mediaId: item.id,
          timelineStart,
          timelineEnd,
          mediaStart: 0,
          mediaEnd: duration,
          volume: 1,
          speed: DEFAULT_SPEED,
          transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0 },
          colorAdjustments: { ...DEFAULT_COLOR_ADJUSTMENTS },
          audioConfig: { ...DEFAULT_AUDIO_CONFIG },
        }

    addClip(newClip)
  }

  const hasItems = media.length > 0 || pending.length > 0

  return (
    <div
      ref={dropZoneRef}
      className="flex flex-col h-full bg-dark-surface overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay — only visible during OS file drag */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-dark-elevated/80 border-2 border-accent-red rounded pointer-events-none">
          <FilePlus2 size={28} className="text-accent-red" />
          <span className="text-sm font-semibold text-accent-white">Drop files here</span>
        </div>
      )}

      {/* Inline drop error */}
      {dropError && (
        <div className="absolute bottom-2 left-2 right-2 z-20 bg-dark-elevated border border-red-700 rounded px-2 py-1 text-[11px] text-red-400 pointer-events-none">
          {dropError}
        </div>
      )}

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
          className="flex flex-col items-center justify-center flex-1 m-3 gap-4 rounded-xl border-2 border-dashed border-dark-border hover:border-accent-red/60 hover:bg-dark-elevated/20 editor-transition min-h-48"
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
        <div className="grid grid-cols-2 gap-2 p-2 overflow-y-auto flex-1 min-h-48">
          {media.map(item => (
            <div key={item.id} onDoubleClick={() => insertMediaAtPlayhead(item)}>
              <MediaCard
                media={item}
                objectUrl={getObjectUrl(item.id)}
                proxyStatus={proxyMap[item.id]?.status}
                onInsertAtPlayhead={() => insertMediaAtPlayhead(item)}
              />
            </div>
          ))}
          {pending.map(p => (
            <LoadingCard key={p.tempId} fileName={p.fileName} />
          ))}
        </div>
      )}
    </div>
  )
}
