import { useEffect, useMemo, useRef, useState } from "react"
import { SkipBack, Rewind, Play, Pause, FastForward, SkipForward, Volume2, VolumeX } from "lucide-react"
import type { VideoClip, ImageClip, TextClip } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import { getProjectDuration, CLIP_EPSILON } from "../../utils/time"
import { useMediaSync } from "../../player/hooks/useMediaSync"
import { applyTransform } from "../../player/render/transformUtils"
import { buildCssFilter } from "../../utils/colorAdjustmentFilters"
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../constants/colorAdjustments"
import { setupCanvasScaling } from "../../player/render/canvasScaling"
import { TransformOverlay } from "./TransformOverlay"
import { IconButton } from "../ui/IconButton"
import { RangeSlider } from "../ui/RangeSlider"
import { getActiveVideoClip } from "../../player/timeline/activeClipResolver"
import { DEFAULT_SPEED } from "../../constants/speed"

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

  // Secondary video element refs and clip data for multi-track sync
  const secondaryVideoElemsRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const secondaryClipsRef = useRef<VideoClip[]>([])

  // Canvas scaling via ResizeObserver
  useEffect(() => {
    const container = canvasContainerRef.current
    const inner = innerCanvasRef.current
    if (!container || !inner) return
    return setupCanvasScaling(container, inner)
  }, [])

  // Media synchronization (video double-buffer + audio)
  const { videoRefA, videoRefB, getObjectUrl, getPlaybackUrl } = useMediaSync({
    onFrameRef,
    seekFlagResetRef,
    playheadRef,
    isMuted,
    volume,
    secondaryVideoElemsRef,
    secondaryClipsRef,
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

  // Track order lookup and z-index helper (lower order = foreground = higher z-index)
  const trackOrderMap = useMemo(
    () => new Map(project.tracks.map(t => [t.id, t.order])),
    [project.tracks],
  )
  const maxOrder = useMemo(
    () => Math.max(0, ...project.tracks.map(t => t.order)),
    [project.tracks],
  )
  const zIndex = (trackId: string) => maxOrder - (trackOrderMap.get(trackId) ?? 0) + 1

  // Primary video clip (handled by double-buffer) and secondary video clips (extra elements)
  const primaryVideoClip = useMemo(
    () => getActiveVideoClip(project.tracks, playhead),
    [project.tracks, playhead],
  )

  const secondaryVideoClips = useMemo(() => {
    const primaryId = primaryVideoClip?.id
    return activeClips.filter(
      (c): c is VideoClip => c.type === "video" && c.id !== primaryId,
    )
  }, [activeClips, primaryVideoClip])

  // Keep secondary clip ref in sync for the RAF loop
  secondaryClipsRef.current = secondaryVideoClips

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
            {/* Double-buffer video elements (primary clip) */}
            <video
              ref={videoRefA}
              style={{ position: "absolute", opacity: 1, pointerEvents: "none", willChange: "transform", transform: "translateZ(0)", zIndex: primaryVideoClip ? zIndex(primaryVideoClip.trackId) : 0, filter: primaryVideoClip ? buildCssFilter(primaryVideoClip.colorAdjustments ?? DEFAULT_COLOR_ADJUSTMENTS) : undefined }}
              preload="auto" playsInline disablePictureInPicture
            />
            <video
              ref={videoRefB}
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", willChange: "transform", transform: "translateZ(0)", zIndex: primaryVideoClip ? zIndex(primaryVideoClip.trackId) : 0, filter: primaryVideoClip ? buildCssFilter(primaryVideoClip.colorAdjustments ?? DEFAULT_COLOR_ADJUSTMENTS) : undefined }}
              preload="auto" playsInline disablePictureInPicture
            />

            {/* Secondary video clips from other tracks */}
            {secondaryVideoClips.map(clip => (
              <video
                key={clip.id}
                ref={el => {
                  if (el) {
                    el.playbackRate = clip.speed ?? DEFAULT_SPEED
                    secondaryVideoElemsRef.current.set(clip.id, el)
                  }
                  else secondaryVideoElemsRef.current.delete(clip.id)
                }}
                src={getPlaybackUrl(clip.mediaId)}
                style={{ ...applyTransform(clip.transform), filter: buildCssFilter(clip.colorAdjustments ?? DEFAULT_COLOR_ADJUSTMENTS), zIndex: zIndex(clip.trackId), pointerEvents: "none" }}
                muted
                preload="auto"
                playsInline
                disablePictureInPicture
              />
            ))}

            {staticElements.map(clip => {
              if (clip.type === "image") {
                return <img key={clip.id} src={getObjectUrl(clip.mediaId)} style={{ ...applyTransform(clip.transform), filter: buildCssFilter((clip as ImageClip).colorAdjustments ?? DEFAULT_COLOR_ADJUSTMENTS), zIndex: zIndex(clip.trackId) }} alt="" />
              }
              if (clip.type === "text") {
                return <div key={clip.id} style={{ ...applyTransform(clip.transform), zIndex: zIndex(clip.trackId) }}>{clip.content}</div>
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
                onUpdate={t => updateClipTransform(selectedClipId, t )}
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
