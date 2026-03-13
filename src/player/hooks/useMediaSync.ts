import { useEffect, useMemo, useRef } from "react"
import type { MutableRefObject } from "react"
import type { AudioClip, VideoClip } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { isPlayingRef } from "../../hooks/usePlayer"
import { buildClipIndex, lookupActiveClips } from "../timeline/clipLookup"
import type { ClipIndex } from "../timeline/clipLookup"
import { getActiveVideoClip } from "../timeline/activeClipResolver"
import { VideoBufferManager } from "../video/videoBuffer"
import { ObjectUrlRegistry } from "../utils/objectUrlRegistry"
import { syncAudioElements } from "../audio/audioSync"
import { syncAudioPool, destroyAudioPool } from "../audio/audioPool"
import { CLIP_EPSILON } from "../../utils/time"
import { DRIFT_CORRECTION_THRESHOLD_S } from "../../constants/timeline"
import { DEFAULT_SPEED } from "../../constants/speed"

interface UseMediaSyncParams {
  onFrameRef: MutableRefObject<((ph: number) => void) | null>
  seekFlagResetRef: MutableRefObject<(() => void) | null>
  playheadRef: { current: number }
  isMuted: boolean
  volume: number
  secondaryVideoElemsRef: MutableRefObject<Map<string, HTMLVideoElement>>
  secondaryClipsRef: MutableRefObject<VideoClip[]>
}

/**
 * Orchestrates video double-buffer management, audio sync, and clip indexing.
 * All DOM writes happen inside the RAF loop — no React re-renders during playback.
 */
export function useMediaSync({
  onFrameRef,
  seekFlagResetRef,
  playheadRef,
  isMuted,
  volume,
  secondaryVideoElemsRef,
  secondaryClipsRef,
}: UseMediaSyncParams) {
  const project = useEditorStore(s => s.project)
  const playhead = useEditorStore(s => s.playhead)
  const isPlaying = useEditorStore(s => s.isPlaying)
  const proxyMap = useEditorStore(s => s.proxyMap)
  const tracks = project.tracks


  const videoRefA = useRef<HTMLVideoElement>(null)
  const videoRefB = useRef<HTMLVideoElement>(null)
  const registryRef = useRef(new ObjectUrlRegistry())
  const managerRef = useRef<VideoBufferManager | null>(null)
  const clipIndexRef = useRef<ClipIndex>(buildClipIndex(tracks))
  const proxyMapRef = useRef(proxyMap)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const prevActiveAudioIdsRef = useRef<Set<string>>(new Set())
  const isMutedRef = useRef(isMuted)
  const volumeRef = useRef(volume)


  useEffect(() => { clipIndexRef.current = buildClipIndex(tracks) }, [tracks])
  useEffect(() => { proxyMapRef.current = proxyMap }, [proxyMap])
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { volumeRef.current = volume }, [volume])

  useEffect(() => {
    seekFlagResetRef.current = () => managerRef.current?.resetSeekFlags()
    return () => { seekFlagResetRef.current = null }
  }, [seekFlagResetRef])

  // Video buffer manager init

  useEffect(() => {
    const elA = videoRefA.current
    const elB = videoRefB.current
    if (!elA || !elB) return
    const manager = new VideoBufferManager(elA, elB)
    managerRef.current = manager

    const { project: p, playhead: ph } = useEditorStore.getState()
    const firstClip = getActiveVideoClip(p.tracks, ph)
    if (firstClip) {
      manager.initialize(firstClip, id => registryRef.current.getObjectUrl(id))
    }

    return () => { managerRef.current = null }
  }, [])

  // Volume / mute sync 
  // Primary video buffer elements are always muted — audio is driven exclusively
  // through the audio element pool so every track's audio is handled uniformly.

  useEffect(() => { managerRef.current?.setVolume(isMuted, volume) }, [isMuted, volume])

  // Apply volume/mute changes to all active audio pool elements immediately
  useEffect(() => {
    for (const [, el] of audioElementsRef.current) {
      if (!el.paused) {
        el.muted = isMuted
        el.volume = volume
      }
    }
  }, [isMuted, volume])

  //Audio element pool 
  // Pool covers ALL tracks (video + audio) so VideoClip audio is not lost.

  const allTrackIds = useMemo(
    () => tracks.map(t => t.id),
    [tracks],
  )

  useEffect(() => { syncAudioPool(audioElementsRef.current, allTrackIds) }, [allTrackIds])
  useEffect(() => () => { destroyAudioPool(audioElementsRef.current) }, [])

  //Per-frame sync (RAF callback)

  function syncMediaElements(ph: number): void {
    const p = useEditorStore.getState().project
    // Use raw file URL (not proxy) for the primary buffer so audio is preserved.
    // Proxies are generated with -an (no audio). Secondary elements are muted and
    // can keep using the proxy URL for smooth scrubbing.
    const getUrl = (id: string) => registryRef.current.getObjectUrl(id)
    const getIsPlaying = () => isPlayingRef.current

    managerRef.current?.syncVideo(ph, p.tracks, getUrl, getIsPlaying)

    // Sync secondary (non-primary) video elements
    const playing = isPlayingRef.current
    for (const clip of secondaryClipsRef.current) {
      const el = secondaryVideoElemsRef.current.get(clip.id)
      if (!el) continue
      const inRange =
        clip.timelineStart - CLIP_EPSILON <= ph &&
        ph < clip.timelineEnd + CLIP_EPSILON
      if (!inRange) {
        el.pause()
        continue
      }
      const clipSpeed = clip.speed ?? DEFAULT_SPEED
      el.playbackRate = clipSpeed
      const mediaTime = clip.mediaStart + (ph - clip.timelineStart) * clipSpeed
      if (playing) {
        if (el.paused) {
          el.currentTime = Math.max(clip.mediaStart, mediaTime)
          el.play().catch(() => {})
        } else {
          const drift = Math.abs(el.currentTime - mediaTime)
          if (drift > DRIFT_CORRECTION_THRESHOLD_S) {
            el.currentTime = mediaTime
          }
        }
      } else {
        el.currentTime = Math.max(clip.mediaStart, mediaTime)
      }
    }

    prevActiveAudioIdsRef.current = syncAudioElements(
      ph,
      isPlayingRef.current,
      clipIndexRef.current,
      audioElementsRef.current,
      prevActiveAudioIdsRef.current,
      id => registryRef.current.getObjectUrl(id),
      isMutedRef.current,
      volumeRef.current,
    )
  }

  useEffect(() => {
    onFrameRef.current = syncMediaElements
    return () => { onFrameRef.current = null }
  }, [])

  //Scrub sync (not playing) 

  useEffect(() => {
    if (isPlayingRef.current) return
    syncMediaElements(playhead)
  }, [playhead])

  //Play / pause toggle

  useEffect(() => {
    if (isPlaying) {
      managerRef.current?.playActive()
    } else {
      managerRef.current?.pauseActive()
    }

    // Pause/resume secondary video elements
    for (const [, el] of secondaryVideoElemsRef.current) {
      if (isPlaying) {
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    }

    const ph = playheadRef.current
    const activeAudioClips = lookupActiveClips(clipIndexRef.current, ph)
      .filter((c): c is AudioClip | VideoClip => c.type === "audio" || c.type === "video")

    for (const clip of activeAudioClips) {
      const el = audioElementsRef.current.get(clip.trackId)
      if (!el) continue
      el.playbackRate = clip.speed ?? DEFAULT_SPEED
      if (isPlaying) {
        el.muted = isMuted
        el.volume = volume
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    }
  }, [isPlaying])

  //URL cleanup 

  useEffect(() => () => { registryRef.current.revokeAll() }, [])

  //Public API 

  const getObjectUrl = (mediaId: string) => registryRef.current.getObjectUrl(mediaId)
  const getPlaybackUrl = (mediaId: string) =>
    registryRef.current.getPlaybackUrl(mediaId, proxyMapRef.current)

  return { videoRefA, videoRefB, getObjectUrl, getPlaybackUrl }
}
