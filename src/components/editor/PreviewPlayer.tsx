import { useEffect, useMemo, useRef, useState } from "react"
import { SkipBack, Rewind, Play, Pause, FastForward, SkipForward, Volume2, VolumeX } from "lucide-react"
import type { AudioClip, ImageClip, TextClip, Transform, Track, VideoClip } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { fileMap } from "../../store/editorStore"
import { usePlayer, isPlayingRef } from "../../hooks/usePlayer"
import { getProjectDuration, CLIP_EPSILON } from "../../utils/time"
import { PRELOAD_LOOKAHEAD_MS, DRIFT_CORRECTION_THRESHOLD_S } from "../../constants/timeline"
import { buildClipIndex, lookupActiveClips } from "../../utils/clipIndex"
import { TransformOverlay } from "./TransformOverlay"
import { IconButton } from "../ui/IconButton"
import { RangeSlider } from "../ui/RangeSlider"

function formatTime(seconds: number): string {
  // Sanitize — treat any invalid or negative input as zero
  seconds = Math.max(0, isFinite(seconds) ? seconds : 0)

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

interface BufferState {
  activeClipId: string | null
  activeMediaId: string | null
  bufferedClipId: string | null
  bufferedMediaId: string | null
}

function getActiveVideoClip(tracks: Track[], playhead: number): VideoClip | null {
  for (const track of tracks) {
    if (track.type !== 'video') continue
    const candidates = track.clips.filter(
      (c): c is VideoClip =>
        c.type === 'video' &&
        c.timelineStart - CLIP_EPSILON <= playhead &&
        playhead < c.timelineEnd + CLIP_EPSILON
    )
    if (candidates.length === 0) continue
    if (candidates.length === 1) return candidates[0]
    return candidates.reduce((a, b) => a.timelineStart > b.timelineStart ? a : b)
  }
  return null
}

function getNextVideoClip(tracks: Track[], currentClip: VideoClip): VideoClip | null {
  const track = tracks.find(t => t.id === currentClip.trackId)
  if (!track) return null
  return (
    track.clips
      .filter((c): c is VideoClip => c.type === 'video' && c.timelineStart >= currentClip.timelineEnd)
      .sort((a, b) => a.timelineStart - b.timelineStart)[0] ?? null
  )
}

function applyTransformToEl(el: HTMLVideoElement, t: Transform) {
  el.style.left = `${t.x}px`
  el.style.top = `${t.y}px`
  el.style.width = `${t.width}px`
  el.style.height = `${t.height}px`
  el.style.transform = `rotate(${t.rotation}deg)`
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
  const { play, pause, seek, onFrameRef, playheadRef, seekFlagResetRef } = usePlayer()
  const tracks = project.tracks
  const duration = getProjectDuration(tracks)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const innerCanvasRef = useRef<HTMLDivElement>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)

  // Fix 6 — Apply canvas scale via direct DOM mutation, not setState
  useEffect(() => {
    const container = canvasContainerRef.current
    const inner = innerCanvasRef.current
    if (!container || !inner) return
    const update = () => {
      const scale = container.clientWidth / 1280
      inner.style.transform = `scale(${scale})`
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Object URL registry — create once per mediaId, revoke on unmount
  const objectUrlsRef = useRef<Map<string, string>>(new Map())
  // Element refs for audio sync — keyed by trackId (one element per audio track)
  const mediaRefsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  // Tracks which audio clip IDs were active on the previous frame
  const prevActiveIdsRef = useRef<Set<string>>(new Set())
  // Fix 1b — tracks the clipId that has already been seeked to avoid repeat seeks
  const clipSeekDoneRef = useRef<string | null>(null)

  // Double-buffer video refs
  const videoRefA = useRef<HTMLVideoElement>(null)
  const videoRefB = useRef<HTMLVideoElement>(null)
  const activeBufferRef = useRef<'A' | 'B'>('A')
  const bufferStateRef = useRef<BufferState>({
    activeClipId: null,
    activeMediaId: null,
    bufferedClipId: null,
    bufferedMediaId: null,
  })

  // Fix 2 — Pre-built clip index, rebuilt only when tracks change
  const clipIndexRef = useRef(buildClipIndex(tracks))
  useEffect(() => {
    clipIndexRef.current = buildClipIndex(tracks)
  }, [tracks])

  // Mirror proxyMap to a ref so the RAF loop can read current values without React subscription
  const proxyMapRef = useRef(proxyMap)
  useEffect(() => { proxyMapRef.current = proxyMap }, [proxyMap])

  // Wire up the seek flag reset so explicit seeks force a re-seek
  useEffect(() => {
    seekFlagResetRef.current = () => { clipSeekDoneRef.current = null }
    return () => { seekFlagResetRef.current = null }
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

  // Use proxy URL for video playback when ready; fall back to original
  // Reads from proxyMapRef so it works both inside and outside React renders
  function getPlaybackUrl(mediaId: string): string | undefined {
    const proxy = proxyMapRef.current[mediaId]
    if (proxy?.status === 'ready' && proxy.objectUrl) return proxy.objectUrl
    return getObjectUrl(mediaId)
  }

  function getActiveEl(): HTMLVideoElement {
    return activeBufferRef.current === 'A' ? videoRefA.current! : videoRefB.current!
  }
  function getBufferEl(): HTMLVideoElement {
    return activeBufferRef.current === 'A' ? videoRefB.current! : videoRefA.current!
  }

  // Fix 1c — Use fastSeek when available to avoid decoder flush
  function seekEl(el: HTMLVideoElement, time: number): void {
    if (typeof el.fastSeek === 'function') {
      el.fastSeek(time)
    } else {
      el.currentTime = time
    }
  }

  function prepareBuffer(ph: number, activeClip: VideoClip, tracks: Track[]): void {
    // Fix 1d — Early exit when not approaching a boundary
    const remaining = activeClip.timelineEnd - ph
    if (remaining > PRELOAD_LOOKAHEAD_MS / 1000) return

    const state = bufferStateRef.current
    const bufferEl = getBufferEl()
    const nextClip = getNextVideoClip(tracks, activeClip)
    if (!nextClip) return
    if (state.bufferedClipId === nextClip.id) return
    const targetSrc = getPlaybackUrl(nextClip.mediaId) ?? ''
    if (targetSrc && bufferEl.src !== targetSrc) {
      bufferEl.src = targetSrc
      state.bufferedMediaId = nextClip.mediaId
    }
    seekEl(bufferEl, nextClip.mediaStart)
    bufferEl.pause()
    state.bufferedClipId = nextClip.id
  }

  function swapBuffers(nextClip: VideoClip, ph: number, playing: boolean): void {
    const state = bufferStateRef.current
    const outgoingEl = getActiveEl()
    const incomingEl = getBufferEl()
    const targetSrc = getPlaybackUrl(nextClip.mediaId) ?? ''
    if (!targetSrc) return
    outgoingEl.pause()
    outgoingEl.style.opacity = '0'
    if (incomingEl.src !== targetSrc) {
      incomingEl.src = targetSrc
      state.bufferedMediaId = nextClip.mediaId
    }
    const mediaTime = nextClip.mediaStart + (ph - nextClip.timelineStart)
    seekEl(incomingEl, Math.max(nextClip.mediaStart, mediaTime))
    applyTransformToEl(incomingEl, nextClip.transform)
    incomingEl.style.opacity = '1'
    if (playing) {
      incomingEl.play().catch(() => {})
    }
    activeBufferRef.current = activeBufferRef.current === 'A' ? 'B' : 'A'
    state.activeClipId = nextClip.id
    state.activeMediaId = nextClip.mediaId
    state.bufferedClipId = null
    state.bufferedMediaId = null
  }

  // Revoke all object URLs when the component unmounts
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  // Initialize double-buffer with the first video clip
  useEffect(() => {
    const { project: p, playhead: ph } = useEditorStore.getState()
    const firstClip = getActiveVideoClip(p.tracks, ph)
    if (!firstClip) return
    const activeEl = getActiveEl()
    const url = getPlaybackUrl(firstClip.mediaId)
    if (!url) return
    activeEl.src = url
    seekEl(activeEl, firstClip.mediaStart)
    applyTransformToEl(activeEl, firstClip.transform)
    activeEl.style.opacity = '1'
    getBufferEl().style.opacity = '0'
    bufferStateRef.current = {
      activeClipId: firstClip.id,
      activeMediaId: firstClip.mediaId,
      bufferedClipId: null,
      bufferedMediaId: null,
    }
    clipSeekDoneRef.current = firstClip.id
  }, [])

  // Sync muted / volume to both persistent video elements
  useEffect(() => {
    const a = videoRefA.current
    const b = videoRefB.current
    if (a) { a.muted = isMuted; a.volume = volume }
    if (b) { b.muted = isMuted; b.volume = volume }
  }, [isMuted, volume])

  // Direct media sync function called from RAF loop (no React re-renders)
  // DOM reads separated from writes (Fix 4)
  function syncMediaElements(ph: number): void {
    const p = useEditorStore.getState().project
    const playing = isPlayingRef.current
    const bState = bufferStateRef.current

    // === VIDEO: double-buffer management ===
    const activeVideoClip = getActiveVideoClip(p.tracks, ph)

    if (activeVideoClip) {
      if (activeVideoClip.id !== bState.activeClipId) {
        // Clip change — swap buffers (swapBuffers does its own seek)
        swapBuffers(activeVideoClip, ph, playing)
        clipSeekDoneRef.current = activeVideoClip.id
      } else if (playing) {
        // Fix 1b — Seek only once when clip first becomes active
        if (clipSeekDoneRef.current !== activeVideoClip.id) {
          clipSeekDoneRef.current = activeVideoClip.id
          const mediaTime = activeVideoClip.mediaStart + (ph - activeVideoClip.timelineStart)
          seekEl(getActiveEl(), mediaTime)
        } else {
          // Per-frame: only correct if drift is very large (Fix 1a)
          const activeEl = getActiveEl()
          const currentTime = activeEl.currentTime
          const expectedTime = activeVideoClip.mediaStart + (ph - activeVideoClip.timelineStart)
          if (Math.abs(currentTime - expectedTime) > DRIFT_CORRECTION_THRESHOLD_S) {
            seekEl(activeEl, expectedTime)
          }
        }
        prepareBuffer(ph, activeVideoClip, p.tracks)
      } else {
        // Paused / scrubbing — always sync exactly
        const activeEl = getActiveEl()
        activeEl.currentTime = activeVideoClip.mediaStart + (ph - activeVideoClip.timelineStart)
        applyTransformToEl(activeEl, activeVideoClip.transform)
        clipSeekDoneRef.current = null // force re-seek when playback resumes
      }
    } else if (bState.activeClipId !== null) {
      getActiveEl().pause()
      getActiveEl().style.opacity = '0'
      bState.activeClipId = null
      bState.activeMediaId = null
      clipSeekDoneRef.current = null
    }

    // === AUDIO sync (keyed by trackId) ===
    const activeAudioClips = lookupActiveClips(clipIndexRef.current, ph)
      .filter((c): c is AudioClip => c.type === 'audio')
    const activeAudioTrackIds = new Set(activeAudioClips.map(c => c.trackId))

    // Phase 1: Read all audio currentTimes
    const audioCurrentTimes = new Map<string, number>()
    for (const [trackId, el] of mediaRefsRef.current) {
      audioCurrentTimes.set(trackId, el.currentTime)
    }

    // Phase 2: Pause inactive, sync active
    for (const [trackId, el] of mediaRefsRef.current) {
      if (!activeAudioTrackIds.has(trackId)) {
        el.pause()
      }
    }

    const activeAudioIds = new Set(activeAudioClips.map(c => c.id))
    const newlyActiveAudioIds = new Set(
      [...activeAudioIds].filter(id => !prevActiveIdsRef.current.has(id))
    )
    prevActiveIdsRef.current = new Set(activeAudioIds)

    for (const clip of activeAudioClips) {
      const el = mediaRefsRef.current.get(clip.trackId)
      if (!el) continue
      // Ensure the right source is loaded for this clip
      const url = getObjectUrl(clip.mediaId)
      if (url && el.src !== url) el.src = url
      const mediaTime = clip.mediaStart + (ph - clip.timelineStart)
      if (newlyActiveAudioIds.has(clip.id)) {
        el.currentTime = Math.max(0, mediaTime)
        if (playing) {
          el.muted = false
          el.volume = 1
          el.play().catch(() => {})
        }
      } else if (!playing) {
        if (el.readyState >= 1) el.currentTime = mediaTime
      } else {
        const current = audioCurrentTimes.get(clip.trackId) ?? 0
        if (Math.abs(current - mediaTime) > DRIFT_CORRECTION_THRESHOLD_S) {
          el.currentTime = mediaTime
        }
      }
    }
  }

  // Register the sync function as the RAF callback
  useEffect(() => {
    onFrameRef.current = syncMediaElements
    return () => { onFrameRef.current = null }
  }, [])

  // Sync on playhead change when scrubbing (not playing) — the only React-driven sync
  useEffect(() => {
    if (isPlayingRef.current) return
    syncMediaElements(playhead)
  }, [playhead])

  // Play or pause active elements when isPlaying toggles
  useEffect(() => {
    // Video: control the active buffer element
    if (bufferStateRef.current.activeClipId) {
      const activeEl = getActiveEl()
      if (isPlaying) {
        activeEl.play().catch(() => {})
      } else {
        activeEl.pause()
      }
    }

    // Audio: control all active audio elements (keyed by trackId)
    const ph = playheadRef.current
    const activeAudioClips = lookupActiveClips(clipIndexRef.current, ph)
      .filter((c): c is AudioClip => c.type === 'audio')

    for (const clip of activeAudioClips) {
      const el = mediaRefsRef.current.get(clip.trackId)
      if (!el) continue
      if (isPlaying) {
        el.muted = false
        el.volume = 1
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    }
  }, [isPlaying])

  // Fix 5 — Memoize derived values
  const sortedTracks = useMemo(
    () => [...project.tracks].sort((a, b) => b.order - a.order),
    [project.tracks]
  )

  // Active clips for rendering static elements — only recalculated on playhead or project change
  const activeClips = useMemo(() => {
    return sortedTracks.flatMap(track => {
      const candidates = track.clips.filter(
        clip =>
          clip.timelineStart - CLIP_EPSILON <= playhead &&
          playhead < clip.timelineEnd + CLIP_EPSILON
      )
      if (candidates.length <= 1) return candidates
      const maxStart = Math.max(...candidates.map(c => c.timelineStart))
      return candidates.filter(c => c.timelineStart === maxStart)
    })
  }, [sortedTracks, playhead])

  // Audio tracks that need elements
  const audioTracks = useMemo(
    () => tracks.filter(t => t.type === 'audio'),
    [tracks]
  )

  // Fix 2a/2b/2d — Pre-allocate audio elements keyed by trackId, appended to document.body
  useEffect(() => {
    const existing = mediaRefsRef.current
    const neededTrackIds = new Set(audioTracks.map(t => t.id))

    // Remove elements for tracks that no longer exist
    for (const [trackId, el] of existing) {
      if (!neededTrackIds.has(trackId)) {
        el.pause()
        if (el.parentNode) el.parentNode.removeChild(el)
        existing.delete(trackId)
      }
    }

    // Create elements for new audio tracks
    for (const track of audioTracks) {
      if (existing.has(track.id)) continue
      const el = document.createElement('audio')
      el.preload = 'auto'
      el.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none'
      document.body.appendChild(el)
      existing.set(track.id, el)
    }

    // Fix 2b — Cleanup on unmount
    return () => {
      for (const [, el] of existing) {
        el.pause()
        if (el.parentNode) el.parentNode.removeChild(el)
      }
      existing.clear()
    }
  }, [audioTracks])

  // Memoize image/text elements (Fix 5)
  const staticElements = useMemo(
    () => activeClips.filter(c => c.type === 'image' || c.type === 'text'),
    [activeClips]
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
            ref={innerCanvasRef}
            style={{
              position: "absolute",
              width: 1280,
              height: 720,
              transformOrigin: "0 0",
              pointerEvents: selectedClipId ? "none" : undefined,
            }}
          >
            {/* Double-buffer video elements — always mounted, swapped via opacity */}
            {/* Fix 1e — GPU compositing hints for smooth playback */}
            <video
              ref={videoRefA}
              style={{
                position: 'absolute',
                opacity: 1,
                pointerEvents: 'none',
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
              preload="auto"
              playsInline
              disablePictureInPicture
            />
            <video
              ref={videoRefB}
              style={{
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
              preload="auto"
              playsInline
              disablePictureInPicture
            />

            {staticElements.map(clip => {
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
