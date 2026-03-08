import { useEffect, useRef } from "react"
import type { AudioClip, ImageClip, TextClip, Transform, VideoClip } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { fileMap } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import { getProjectDuration } from "../../utils/time"
import { TransformOverlay } from "./TransformOverlay"

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return [h, m, s].map(v => String(v).padStart(2, "0")).join(":")
  return [m, s].map(v => String(v).padStart(2, "0")).join(":")
}

function applyTransform(t: Transform): React.CSSProperties {
  return {
    position: "absolute",
    left: t.x,
    top: t.y,
    width: t.width,
    height: t.height,
    transform: `rotate(${t.rotation}deg)`,
  }
}

export function PreviewPlayer() {
  const project = useEditorStore(s => s.project)
  const playhead = useEditorStore(s => s.playhead)
  const isPlaying = useEditorStore(s => s.isPlaying)
  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const updateClipTransform = useEditorStore(s => s.updateClipTransform)
  const commitTransform = useEditorStore(s => s.commitTransform)
  const { play, pause, seek } = usePlayer()
  const duration = getProjectDuration(project.tracks)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Object URL registry — create once per mediaId, revoke on unmount
  const objectUrlsRef = useRef<Map<string, string>>(new Map())
  // Element refs for video/audio sync — keyed by clipId
  const mediaRefsRef = useRef<Map<string, HTMLVideoElement | HTMLAudioElement>>(new Map())

  function getObjectUrl(mediaId: string): string | undefined {
    const existing = objectUrlsRef.current.get(mediaId)
    if (existing) return existing
    const file = fileMap.get(mediaId)
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.set(mediaId, url)
    return url
  }

  // Revoke all object URLs when the component unmounts
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  // Sync currentTime on every playhead change — covers scrubbing when paused.
  // Also pauses elements whose clip is no longer at the current playhead position.
  useEffect(() => {
    const { project: p, playhead: ph, isPlaying: playing } = useEditorStore.getState()

    const activeIds = new Set(
      p.tracks.flatMap(t =>
        t.clips.filter(c => c.timelineStart <= ph && ph <= c.timelineEnd).map(c => c.id)
      )
    )

    // Pause and reset clips that just left the active range
    for (const [clipId, el] of mediaRefsRef.current) {
      if (!activeIds.has(clipId)) {
        el.pause()
        for (const track of p.tracks) {
          const clip = track.clips.find(c => c.id === clipId)
          if (clip && (clip.type === "video" || clip.type === "audio")) {
            el.currentTime = (clip as VideoClip | AudioClip).mediaStart
            break
          }
        }
      }
    }

    if (playing) return // RAF loop owns sync during active playback

    for (const track of p.tracks) {
      for (const clip of track.clips) {
        if (!activeIds.has(clip.id)) continue
        if (clip.type !== "video" && clip.type !== "audio") continue
        const el = mediaRefsRef.current.get(clip.id)
        if (!el) continue
        const offset = ph - clip.timelineStart
        el.currentTime = (clip as VideoClip | AudioClip).mediaStart + offset
      }
    }
  }, [playhead])

  // Play or pause all active media elements when isPlaying toggles
  useEffect(() => {
    const { project: p, playhead: ph } = useEditorStore.getState()
    for (const track of p.tracks) {
      for (const clip of track.clips) {
        if (clip.timelineStart > ph || ph > clip.timelineEnd) continue
        if (clip.type !== "video" && clip.type !== "audio") continue
        const el = mediaRefsRef.current.get(clip.id)
        if (!el) continue
        if (isPlaying) {
          el.play().catch(() => {})
        } else {
          el.pause()
        }
      }
    }
  }, [isPlaying])

  const sortedTracks = [...project.tracks].sort((a, b) => a.order - b.order)

  const activeClips = sortedTracks.flatMap(track =>
    track.clips.filter(
      clip => clip.timelineStart <= playhead && playhead <= clip.timelineEnd
    )
  )

  const btnStyle: React.CSSProperties = {
    padding: "4px 10px",
    fontSize: 13,
    cursor: "pointer",
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    borderRadius: 4,
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
    {/* Canvas shell — 640x360 (half of 1280x720) */}
    <div
      ref={canvasContainerRef}
      style={{
        position: "relative",
        width: 640,
        height: 360,
        backgroundColor: "#000",
        overflow: "hidden",
      }}
    >
      {/* Inner canvas scaled 0.5 — all transforms are authored at 1280x720 */}
      <div
        style={{
          position: "absolute",
          width: 1280,
          height: 720,
          transform: "scale(0.5)",
          transformOrigin: "0 0",
          pointerEvents: selectedClipId ? "none" : undefined,
        }}
      >
        {activeClips.map(clip => {
          if (clip.type === "video") {
            const url = getObjectUrl(clip.mediaId)
            return (
              <video
                key={clip.id}
                ref={el => { if (el) mediaRefsRef.current.set(clip.id, el) }}
                src={url}
                style={applyTransform(clip.transform)}
                muted
                playsInline
              />
            )
          }

          if (clip.type === "image") {
            const url = getObjectUrl(clip.mediaId)
            return (
              <img
                key={clip.id}
                src={url}
                style={applyTransform(clip.transform)}
                alt=""
              />
            )
          }

          if (clip.type === "text") {
            return (
              <div key={clip.id} style={applyTransform(clip.transform)}>
                {clip.content}
              </div>
            )
          }

          if (clip.type === "audio") {
            const url = getObjectUrl(clip.mediaId)
            return (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio
                key={clip.id}
                ref={el => { if (el) mediaRefsRef.current.set(clip.id, el) }}
                src={url}
              />
            )
          }

          return null
        })}
      </div>

      {/* Transform overlay — shown when a visual clip is selected */}
      {(() => {
        if (!selectedClipId) return null
        let selectedClip: VideoClip | ImageClip | TextClip | undefined
        for (const track of project.tracks) {
          const found = track.clips.find(c => c.id === selectedClipId)
          if (found && found.type !== "audio") {
            selectedClip = found as VideoClip | ImageClip | TextClip
            break
          }
        }
        if (!selectedClip) return null
        return (
          <TransformOverlay
            clip={selectedClip}
            previewWidth={canvasContainerRef.current?.clientWidth ?? 640}
            previewHeight={canvasContainerRef.current?.clientHeight ?? 360}
            onUpdate={t => updateClipTransform(selectedClipId, t)}
            onCommit={() => commitTransform(selectedClipId)}
          />
        )
      })()}
    </div>

    {/* Inline controls */}
    <div style={{ width: 640, backgroundColor: "#0f172a", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, boxSizing: "border-box" }}>
      {/* Buttons row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button style={btnStyle} onClick={() => seek(Math.max(0, playhead - 10))}>-10s</button>
        <button style={btnStyle} onClick={() => isPlaying ? pause() : play()}>
          {isPlaying ? "\u23F8" : "\u25B6"}
        </button>
        <button style={btnStyle} onClick={() => seek(Math.min(duration, playhead + 10))}>+10s</button>
      </div>

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.01}
        value={playhead}
        onChange={e => seek(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      {/* Time display */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
        <span>{formatTime(playhead)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
    </div>
  )
}
