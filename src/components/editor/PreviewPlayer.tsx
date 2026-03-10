import { useEffect, useMemo, useRef, useState } from "react"
import { SkipBack, Rewind, Play, Pause, FastForward, SkipForward, Volume2, VolumeX } from "lucide-react"
import type { VideoClip, ImageClip, TextClip } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import { getProjectDuration, CLIP_EPSILON } from "../../utils/time"
import { useMediaSync } from "../../player/hooks/useMediaSync"
import { applyTransform } from "../../player/render/transformUtils"
import { setupCanvasScaling } from "../../player/render/canvasScaling"
import { TransformOverlay } from "./TransformOverlay"
import { IconButton } from "../ui/IconButton"
import { RangeSlider } from "../ui/RangeSlider"

function formatTime(seconds: number): string {
  seconds = Math.max(0, isFinite(seconds) ? seconds : 0)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return [h, m, s].map(v => String(v).padStart(2, "0")).join(":")
  return [m, s].map(v => String(v).padStart(2, "0")).join(":")
}

export function PreviewPlayer() {
  const project = useEditorStore(s => s.project)
  const playhead = useEditorStore(s => s.playhead)
  const isPlaying = useEditorStore(s => s.isPlaying)
  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const updateClipTransform = useEditorStore(s => s.updateClipTransform)
  const commitTransform = useEditorStore(s => s.commitTransform)
  const setSelectedClip = useEditorStore(s => s.setSelectedClip)
  const { play, pause, seek, onFrameRef, playheadRef, seekFlagResetRef } = usePlayer()
  const tracks = project.tracks
  const duration = getProjectDuration(tracks)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const innerCanvasRef = useRef<HTMLDivElement>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)

  // Canvas scaling via ResizeObserver
  useEffect(() => {
    const container = canvasContainerRef.current
    const inner = innerCanvasRef.current
    if (!container || !inner) return
    return setupCanvasScaling(container, inner)
  }, [])

  // Media synchronization (video double-buffer + audio)
  const { videoRefA, videoRefB, getObjectUrl } = useMediaSync({
    onFrameRef,
    seekFlagResetRef,
    playheadRef,
    isMuted,
    volume,
  })

  // Derived values for rendering
  const sortedTracks = useMemo(
    () => [...project.tracks].sort((a, b) => b.order - a.order),
    [project.tracks],
  )

  const activeClips = useMemo(() => {
    return sortedTracks.flatMap(track => {
      const candidates = track.clips.filter(
        clip =>
          clip.timelineStart - CLIP_EPSILON <= playhead &&
          playhead < clip.timelineEnd + CLIP_EPSILON,
      )
      if (candidates.length <= 1) return candidates
      const maxStart = Math.max(...candidates.map(c => c.timelineStart))
      return candidates.filter(c => c.timelineStart === maxStart)
    })
  }, [sortedTracks, playhead])

  const staticElements = useMemo(
    () => activeClips.filter(c => c.type === "image" || c.type === "text"),
    [activeClips],
  )

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = canvasContainerRef.current!.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) / (rect.width / 1280)
    const canvasY = (e.clientY - rect.top) / (rect.height / 720)

    const hit = [...activeClips].reverse().find(clip => {
      if (clip.type === "audio") return false
      const t = clip.transform
      return canvasX >= t.x && canvasX <= t.x + t.width
          && canvasY >= t.y && canvasY <= t.y + t.height
    })
    setSelectedClip(hit ? hit.id : undefined)
  }

  return (
    <div className="flex flex-col min-h-0 h-full w-full items-center justify-center">
      {/* Canvas area */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <div
          ref={canvasContainerRef}
          onClick={handleCanvasClick}
          className="relative bg-black overflow-hidden cursor-default"
          style={{ aspectRatio: "16 / 9", height: "100%", maxWidth: "100%", width: "auto" }}
        >
          <div
            ref={innerCanvasRef}
            style={{
              position: "absolute",
              width: 1280,
              height: 720,
              transformOrigin: "0 0",
              pointerEvents: selectedClipId ? "none" : undefined,
            }}
          >
            {/* Double-buffer video elements */}
            <video
              ref={videoRefA}
              style={{ position: "absolute", opacity: 1, pointerEvents: "none", willChange: "transform", transform: "translateZ(0)" }}
              preload="auto" playsInline disablePictureInPicture
            />
            <video
              ref={videoRefB}
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", willChange: "transform", transform: "translateZ(0)" }}
              preload="auto" playsInline disablePictureInPicture
            />

            {staticElements.map(clip => {
              if (clip.type === "image") {
                return <img key={clip.id} src={getObjectUrl(clip.mediaId)} style={applyTransform(clip.transform)} alt="" />
              }
              if (clip.type === "text") {
                return <div key={clip.id} style={applyTransform(clip.transform)}>{clip.content}</div>
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

      {/* Controls */}
      <div className="w-full bg-dark-card border-t border-dark-border px-3 py-2 shrink-0">
        <RangeSlider min={0} max={duration || 1} step={0.01} value={playhead} label="Seek" onPointerDown={() => pause()} onChange={seek} className="mb-2" />
        <div className="flex items-center gap-0.5 mt-1">
          <IconButton icon={<SkipBack />} label="Skip to start" size="sm" onClick={() => seek(0)} />
          <IconButton icon={<Rewind />} label="Rewind 10s" size="sm" onClick={() => seek(Math.max(0, playhead - 10))} />
          <IconButton icon={isPlaying ? <Pause /> : <Play />} label={isPlaying ? "Pause" : "Play"} size="lg" variant="solid" onClick={() => (isPlaying ? pause() : play())} />
          <IconButton icon={<FastForward />} label="Fast forward 10s" size="sm" onClick={() => seek(Math.min(duration, playhead + 10))} />
          <IconButton icon={<SkipForward />} label="Skip to end" size="sm" onClick={() => seek(duration)} />
          <span className="flex-1 text-center font-mono text-xs text-muted tabular-nums" aria-live="polite" aria-atomic="true">
            {formatTime(playhead)} / {formatTime(duration)}
          </span>
          <IconButton icon={isMuted ? <VolumeX /> : <Volume2 />} label={isMuted ? "Unmute" : "Mute"} size="sm" onClick={() => setIsMuted(v => !v)} />
          <RangeSlider min={0} max={100} step={1} value={isMuted ? 0 : Math.round(volume * 100)} label="Volume" onChange={v => { setVolume(v / 100); setIsMuted(false) }} className="w-20" />
        </div>
      </div>
    </div>
  )
}
