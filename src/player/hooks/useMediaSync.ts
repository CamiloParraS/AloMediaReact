import { useEffect, useMemo, useRef } from "react"
import type { MutableRefObject } from "react"
import type { AudioClip } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { isPlayingRef } from "../../hooks/usePlayer"
import { buildClipIndex, lookupActiveClips } from "../timeline/clipLookup"
import type { ClipIndex } from "../timeline/clipLookup"
import { getActiveVideoClip } from "../timeline/activeClipResolver"
import { VideoBufferManager } from "../video/videoBuffer"
import { ObjectUrlRegistry } from "../utils/objectUrlRegistry"
import { syncAudioElements } from "../audio/audioSync"
import { syncAudioPool, destroyAudioPool } from "../audio/audioPool"

interface UseMediaSyncParams {
  onFrameRef: MutableRefObject<((ph: number) => void) | null>
  seekFlagResetRef: MutableRefObject<(() => void) | null>
  playheadRef: { current: number }
  isMuted: boolean
  volume: number
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
}: UseMediaSyncParams) {
  const project = useEditorStore(s => s.project)
  const playhead = useEditorStore(s => s.playhead)
  const isPlaying = useEditorStore(s => s.isPlaying)
  const proxyMap = useEditorStore(s => s.proxyMap)
  const tracks = project.tracks

  // ── Refs ─────────────────────────────────────────────────────────────

  const videoRefA = useRef<HTMLVideoElement>(null)
  const videoRefB = useRef<HTMLVideoElement>(null)
  const registryRef = useRef(new ObjectUrlRegistry())
  const managerRef = useRef<VideoBufferManager | null>(null)
  const clipIndexRef = useRef<ClipIndex>(buildClipIndex(tracks))
  const proxyMapRef = useRef(proxyMap)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const prevActiveAudioIdsRef = useRef<Set<string>>(new Set())

  // ── Keep refs in sync with React state ───────────────────────────────

  useEffect(() => { clipIndexRef.current = buildClipIndex(tracks) }, [tracks])
  useEffect(() => { proxyMapRef.current = proxyMap }, [proxyMap])

  // ── Seek flag reset (explicit user seeks) ────────────────────────────

  useEffect(() => {
    seekFlagResetRef.current = () => managerRef.current?.resetSeekFlags()
    return () => { seekFlagResetRef.current = null }
  }, [seekFlagResetRef])

  // ── Video buffer manager init ────────────────────────────────────────

  useEffect(() => {
    const elA = videoRefA.current
    const elB = videoRefB.current
    if (!elA || !elB) return
    const manager = new VideoBufferManager(elA, elB)
    managerRef.current = manager

    const { project: p, playhead: ph } = useEditorStore.getState()
    const firstClip = getActiveVideoClip(p.tracks, ph)
    if (firstClip) {
      manager.initialize(firstClip, id => registryRef.current.getPlaybackUrl(id, proxyMapRef.current))
    }

    return () => { managerRef.current = null }
  }, [])

  // ── Volume / mute sync ───────────────────────────────────────────────

  useEffect(() => { managerRef.current?.setVolume(isMuted, volume) }, [isMuted, volume])

  // ── Audio element pool ───────────────────────────────────────────────

  const audioTrackIds = useMemo(
    () => tracks.filter(t => t.type === "audio").map(t => t.id),
    [tracks],
  )

  useEffect(() => { syncAudioPool(audioElementsRef.current, audioTrackIds) }, [audioTrackIds])
  useEffect(() => () => { destroyAudioPool(audioElementsRef.current) }, [])

  // ── Per-frame sync (RAF callback) ────────────────────────────────────

  function syncMediaElements(ph: number): void {
    const p = useEditorStore.getState().project
    const getUrl = (id: string) => registryRef.current.getPlaybackUrl(id, proxyMapRef.current)
    const getIsPlaying = () => isPlayingRef.current

    managerRef.current?.syncVideo(ph, p.tracks, getUrl, getIsPlaying)

    prevActiveAudioIdsRef.current = syncAudioElements(
      ph,
      isPlayingRef.current,
      clipIndexRef.current,
      audioElementsRef.current,
      prevActiveAudioIdsRef.current,
      id => registryRef.current.getObjectUrl(id),
    )
  }

  useEffect(() => {
    onFrameRef.current = syncMediaElements
    return () => { onFrameRef.current = null }
  }, [])

  // ── Scrub sync (not playing) ─────────────────────────────────────────

  useEffect(() => {
    if (isPlayingRef.current) return
    syncMediaElements(playhead)
  }, [playhead])

  // ── Play / pause toggle ──────────────────────────────────────────────

  useEffect(() => {
    if (isPlaying) {
      managerRef.current?.playActive()
    } else {
      managerRef.current?.pauseActive()
    }

    const ph = playheadRef.current
    const activeAudioClips = lookupActiveClips(clipIndexRef.current, ph)
      .filter((c): c is AudioClip => c.type === "audio")

    for (const clip of activeAudioClips) {
      const el = audioElementsRef.current.get(clip.trackId)
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

  // ── URL cleanup ──────────────────────────────────────────────────────

  useEffect(() => () => { registryRef.current.revokeAll() }, [])

  // ── Public API ───────────────────────────────────────────────────────

  const getObjectUrl = (mediaId: string) => registryRef.current.getObjectUrl(mediaId)

  return { videoRefA, videoRefB, getObjectUrl }
}
