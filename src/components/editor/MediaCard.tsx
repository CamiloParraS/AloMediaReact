import type { Media } from "../../project/projectTypes"

function formatMediaMeta(media: Media): string {
  if (media.type === "image") return "image"
  const secs = Math.round(media.duration ?? 0)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${media.type} · ${m}:${String(s).padStart(2, "0")}`
}

function MediaThumbnail({ media, objectUrl }: { media: Media; objectUrl: string | undefined }) {
  if (media.type === "video") {
    return (
      <video
        src={objectUrl}
        preload="metadata"
        style={{ width: 48, height: 32, objectFit: "cover", flexShrink: 0 }}
        onLoadedMetadata={e => { (e.currentTarget as HTMLVideoElement).currentTime = 0 }}
      />
    )
  }
  if (media.type === "image") {
    return <img src={objectUrl} alt="" style={{ width: 48, height: 32, objectFit: "cover", flexShrink: 0 }} />
  }
  // audio: simple waveform SVG
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" style={{ flexShrink: 0 }}>
      {[0, 1, 2, 3, 4, 5, 6].map(i => {
        const h = i % 3 === 0 ? 20 : i % 3 === 1 ? 12 : 6
        return <rect key={i} x={4 + i * 6} y={(32 - h) / 2} width={4} height={h} fill="#94a3b8" rx="1" />
      })}
    </svg>
  )
}

export function MediaCard({ media, objectUrl, proxyStatus }: { media: Media; objectUrl: string | undefined; proxyStatus?: 'pending' | 'ready' | 'error' }) {
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData("mediaId", media.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        border: "1px solid #334155",
        borderRadius: 4,
        cursor: "grab",
        fontSize: 13,
        backgroundColor: "#0f172a",
      }}
    >
      <MediaThumbnail media={media} objectUrl={objectUrl} />
      <div style={{ overflow: "hidden", minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e2e8f0" }}>
          {media.name}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 11 }}>
          {formatMediaMeta(media)}
          {proxyStatus === 'pending' && <span style={{ marginLeft: 4, color: "#64748b" }}>proxy...</span>}
          {proxyStatus === 'error' && <span style={{ marginLeft: 4, color: "#ef4444" }}>proxy failed</span>}
        </div>
      </div>
    </div>
  )
}

export function LoadingCard({ fileName }: { fileName: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        border: "1px solid #334155",
        borderRadius: 4,
        fontSize: 13,
        backgroundColor: "#0f172a",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          border: "2px solid #444",
          borderTopColor: "#fff",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
          flexShrink: 0,
        }}
      />
      <div style={{ overflow: "hidden", minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e2e8f0" }}>
          {fileName}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 11 }}>Loading...</div>
      </div>
    </div>
  )
}
