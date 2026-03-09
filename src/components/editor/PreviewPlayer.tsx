import { useEffect, useRef, useState } from "react"
import { SkipBack, Rewind, Play, Pause, FastForward, SkipForward, Volume2, VolumeX } from "lucide-react"
import type { AudioClip, ImageClip, TextClip, Transform, VideoClip } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { fileMap } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import { getProjectDuration } from "../../utils/time"
import { TransformOverlay } from "./TransformOverlay"
import { IconButton } from "../ui/IconButton"
import { RangeSlider } from "../ui/RangeSlider"

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
  const setSelectedClip = useEditorStore(s => s.setSelectedClip)
  const proxyMap = useEditorStore(s => s.proxyMap)
  const { play, pause, seek } = usePlayer()
  const duration = getProjectDuration(project.tracks)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  // Computed scale: inner 1280×720 canvas → container actual width
  const [canvasScale, setCanvasScale] = useState(0.5)

  // Keep canvasScale in sync with the container's rendered width
  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const update = () => setCanvasScale(el.clientWidth / 1280)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  // Use proxy URL for video playback when ready; fall back to original
  function getPlaybackUrl(mediaId: string): string | undefined {
    const proxy = proxyMap[mediaId]
    if (proxy?.status === 'ready' && proxy.objectUrl) return proxy.objectUrl
    return getObjectUrl(mediaId)
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
        if (!el || el.readyState < 1) continue // skip if metadata not yet loaded
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

  // Render highest-order tracks first so track 0 (index 0) is painted last = on top
  const sortedTracks = [...project.tracks].sort((a, b) => b.order - a.order)

  const activeClips = sortedTracks.flatMap(track =>
    track.clips.filter(
      clip => clip.timelineStart <= playhead && playhead <= clip.timelineEnd
    )
  )

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = canvasContainerRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const canvasX = mouseX / (rect.width / 1280)
    const canvasY = mouseY / (rect.height / 720)

    const hit = [...activeClips].reverse().find(clip => {
      if (clip.type === 'audio') return false
      const t = clip.transform
      return canvasX >= t.x && canvasX <= t.x + t.width
          && canvasY >= t.y && canvasY <= t.y + t.height
    })

    if (hit) {
      setSelectedClip(hit.id)
    } else {
      setSelectedClip(undefined)
    }
  }

  return (
    <div className="flex flex-col min-h-0 h-full w-full items-center justify-center">

      {/* Canvas area — fills available height, maintains 16:9 */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <div
          ref={canvasContainerRef}
          onClick={handleCanvasClick}
          className="relative bg-black overflow-hidden cursor-default"
          style={{ aspectRatio: "16 / 9", height: "100%", maxWidth: "100%", width: "auto" }}
        >
          {/* Inner canvas at 1280×720 scaled to container */}
          <div
            style={{
              position: "absolute",
              width: 1280,
              height: 720,
              transform: `scale(${canvasScale})`,
              transformOrigin: "0 0",
              pointerEvents: selectedClipId ? "none" : undefined,
            }}
          >
            {activeClips.map(clip => {
              if (clip.type === "video") {
                const url = getPlaybackUrl(clip.mediaId)
                return (
                  <video
                    key={clip.id}
                    ref={el => { if (el) mediaRefsRef.current.set(clip.id, el) }}
                    src={url}
                    style={applyTransform(clip.transform)}
                    muted={isMuted}
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

          {/* Transform overlay */}
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
      </div>

      {/* Controls — fixed height row */}
      <div className="w-full bg-dark-card border-t border-dark-border px-3 py-2 shrink-0">
        {/* Seek bar */}
        <RangeSlider
          min={0}
          max={duration || 1}
          step={0.01}
          value={playhead}
          label="Seek"
          onPointerDown={() => pause()}
          onChange={seek}
          className="mb-2"
        />

        {/* Buttons + timecode + volume */}
        <div className="flex items-center gap-0.5 mt-1">
          <IconButton
            icon={<SkipBack />}
            label="Skip to start"
            size="sm"
            onClick={() => seek(0)}
          />
          <IconButton
            icon={<Rewind />}
            label="Rewind 10s"
            size="sm"
            onClick={() => seek(Math.max(0, playhead - 10))}
          />
          <IconButton
            icon={isPlaying ? <Pause /> : <Play />}
            label={isPlaying ? "Pause" : "Play"}
            size="lg"
            variant="solid"
            onClick={() => (isPlaying ? pause() : play())}
          />
          <IconButton
            icon={<FastForward />}
            label="Fast forward 10s"
            size="sm"
            onClick={() => seek(Math.min(duration, playhead + 10))}
          />
          <IconButton
            icon={<SkipForward />}
            label="Skip to end"
            size="sm"
            onClick={() => seek(duration)}
          />

          {/* Timecode */}
          <span
            className="flex-1 text-center font-mono text-xs text-muted tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          >
            {formatTime(playhead)} / {formatTime(duration)}
          </span>

          {/* Volume */}
          <IconButton
            icon={isMuted ? <VolumeX /> : <Volume2 />}
            label={isMuted ? "Unmute" : "Mute"}
            size="sm"
            onClick={() => setIsMuted(v => !v)}
          />
          <RangeSlider
            min={0}
            max={100}
            step={1}
            value={isMuted ? 0 : Math.round(volume * 100)}
            label="Volume"
            onChange={v => { setVolume(v / 100); setIsMuted(false) }}
            className="w-20"
          />
        </div>
      </div>
    </div>
  )
}
