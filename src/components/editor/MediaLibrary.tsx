import { useRef, useState, useEffect } from "react"
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
            <div key={item.id} onDoubleClick={() => insertMediaAtPlayhead(item)}>
              <MediaCard media={item} objectUrl={getObjectUrl(item.id)} proxyStatus={proxyMap[item.id]?.status} />
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
