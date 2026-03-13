import type { Media } from "../../project/projectTypes"

function formatDuration(media: Media): string {
  if (media.type === "image") return "img"
  const secs = Math.round(media.duration ?? 0)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function MediaThumbnail({ media, objectUrl }: { media: Media; objectUrl: string | undefined }) {
  if (media.type === "video") {
    return (
      <video
        src={objectUrl}
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
        onLoadedMetadata={e => { (e.currentTarget as HTMLVideoElement).currentTime = 0 }}
      />
    )
  }
  if (media.type === "image") {
    return <img src={objectUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
  }
  // audio: centered waveform
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg width="48" height="28" viewBox="0 0 48 28">
        {[0, 1, 2, 3, 4, 5, 6].map(i => {
          const h = i % 3 === 0 ? 18 : i % 3 === 1 ? 10 : 5
          return <rect key={i} x={4 + i * 6} y={(28 - h) / 2} width={4} height={h} fill="#8a8a9a" rx="1" />
        })}
      </svg>
    </div>
  )
}

export function MediaCard({ media, objectUrl, proxyStatus }: { media: Media; objectUrl: string | undefined; proxyStatus?: 'pending' | 'ready' | 'error' }) {
  return (
    <div
      draggable
      onDragStart={e => {
        const durationSeconds = media.duration ?? 5
        e.dataTransfer.setData("mediaId", media.id)
        e.dataTransfer.setData("clipDuration", String(durationSeconds))
        window.dispatchEvent(new CustomEvent("alomedia:drag-start", {
          detail: {
            kind: "media",
            mediaId: media.id,
            durationSeconds,
          },
        }))
      }}
      onDragEnd={() => {
        window.dispatchEvent(new CustomEvent("alomedia:drag-end"))
      }}
      className="relative aspect-square rounded-lg border border-dark-border bg-dark-card hover:border-accent-red/70 hover:bg-dark-elevated cursor-pointer editor-transition overflow-hidden group"
    >
      {/* Thumbnail — top ~75% */}
      <div className="absolute inset-0 bottom-[26%] bg-dark overflow-hidden">
        <MediaThumbnail media={media} objectUrl={objectUrl} />
      </div>

      {/* Info strip — bottom ~26% */}
      <div className="absolute bottom-0 left-0 right-0 h-[26%] bg-dark-surface/90 px-1.5 flex flex-col justify-center gap-0.5">
        <p className="text-[10px] font-medium text-accent-white truncate leading-none">{media.name}</p>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted leading-none">{formatDuration(media)}</span>
          {proxyStatus === 'pending' && <span className="text-[9px] text-muted opacity-60 leading-none">proxy…</span>}
          {proxyStatus === 'error' && <span className="text-[9px] text-red-400 leading-none">!</span>}
        </div>
      </div>
    </div>
  )
}

export function LoadingCard({ fileName }: { fileName: string }) {
  return (
    <div className="relative aspect-square rounded-lg border border-dark-border bg-dark-card overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-dark-elevated border-t-accent-white animate-spin" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[26%] bg-dark-surface/90 px-1.5 flex items-center">
        <p className="text-[10px] font-medium text-muted truncate leading-none">{fileName}</p>
      </div>
    </div>
  )
}
