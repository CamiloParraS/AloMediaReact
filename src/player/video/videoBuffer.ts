import type { Track, VideoClip } from "../../project/projectTypes"
import { PRELOAD_LOOKAHEAD_MS, DRIFT_CORRECTION_THRESHOLD_S } from "../../constants/timeline"
import { getActiveVideoClip, getNextVideoClip } from "../timeline/activeClipResolver"
import { applyTransformToEl } from "../render/transformUtils"

export interface BufferState {
  activeClipId: string | null
  activeMediaId: string | null
  bufferedClipId: string | null
  bufferedMediaId: string | null
}

type UrlResolver = (mediaId: string) => string | undefined

function seekEl(el: HTMLVideoElement, time: number): void {
  if (typeof el.fastSeek === "function") {
    el.fastSeek(time)
  } else {
    el.currentTime = time
  }
}

/**
 * Manages a double-buffered pair of `<video>` elements.
 *
 * One element plays the active clip while the other preloads the next clip.
 * Buffer swaps are gated on `canplay` to prevent micro-freezes.
 */
export class VideoBufferManager {
  private elA: HTMLVideoElement
  private elB: HTMLVideoElement
  private activeBuffer: "A" | "B" = "A"

  state: BufferState = {
    activeClipId: null,
    activeMediaId: null,
    bufferedClipId: null,
    bufferedMediaId: null,
  }
  private bufferReady = false
  swapPending = false
  private swapGen = 0
  clipSeekDone: string | null = null

  constructor(elA: HTMLVideoElement, elB: HTMLVideoElement) {
    this.elA = elA
    this.elB = elB
    // Always muted — audio is driven through the audio element pool
    this.elA.muted = true
    this.elB.muted = true
  }

  getActiveEl(): HTMLVideoElement {
    return this.activeBuffer === "A" ? this.elA : this.elB
  }

  private getBufferEl(): HTMLVideoElement {
    return this.activeBuffer === "A" ? this.elB : this.elA
  }

  /** Load the first clip into the active buffer. */
  initialize(clip: VideoClip, getUrl: UrlResolver): void {
    const el = this.getActiveEl()
    const url = getUrl(clip.mediaId)
    if (!url) return
    el.src = url
    seekEl(el, clip.mediaStart)
    applyTransformToEl(el, clip.transform)
    el.style.opacity = "1"
    this.getBufferEl().style.opacity = "0"
    this.state = {
      activeClipId: clip.id,
      activeMediaId: clip.mediaId,
      bufferedClipId: null,
      bufferedMediaId: null,
    }
    this.clipSeekDone = clip.id
  }

  // ── Buffer preparation ──────────────────────────────────────────────

  private prepareBuffer(ph: number, activeClip: VideoClip, tracks: Track[], getUrl: UrlResolver): void {
    const remaining = activeClip.timelineEnd - ph
    if (remaining > PRELOAD_LOOKAHEAD_MS / 1000) return

    const bufferEl = this.getBufferEl()
    const nextClip = getNextVideoClip(tracks, activeClip)
    if (!nextClip) return
    if (this.state.bufferedClipId === nextClip.id) return

    this.bufferReady = false
    const targetSrc = getUrl(nextClip.mediaId) ?? ""
    if (targetSrc && bufferEl.src !== targetSrc) {
      bufferEl.src = targetSrc
      this.state.bufferedMediaId = nextClip.mediaId
    }
    const PREROLL = 0.03
    seekEl(bufferEl, Math.max(0, nextClip.mediaStart - PREROLL))
    bufferEl.pause()
    this.state.bufferedClipId = nextClip.id

    bufferEl.addEventListener("canplay", () => { this.bufferReady = true }, { once: true })
    if (bufferEl.readyState >= 3) this.bufferReady = true
  }

  // ── Buffer swap ─────────────────────────────────────────────────────

  private swapBuffers(nextClip: VideoClip, ph: number, getUrl: UrlResolver, getIsPlaying: () => boolean): void {
    const outgoingEl = this.getActiveEl()
    const incomingEl = this.getBufferEl()
    const targetSrc = getUrl(nextClip.mediaId) ?? ""
    if (!targetSrc) return

    const wasPrebuffered = this.state.bufferedClipId === nextClip.id
    const gen = ++this.swapGen

    if (incomingEl.src !== targetSrc) {
      incomingEl.src = targetSrc
      this.state.bufferedMediaId = nextClip.mediaId
    }

    // Skip seek when prebuffered — the decoder is already positioned
    if (!wasPrebuffered) {
      const mediaTime = nextClip.mediaStart + (ph - nextClip.timelineStart)
      seekEl(incomingEl, Math.max(nextClip.mediaStart, mediaTime))
    }

    applyTransformToEl(incomingEl, nextClip.transform)

    const doSwap = () => {
      if (this.swapGen !== gen) return
      outgoingEl.pause()
      outgoingEl.style.opacity = "0"
      incomingEl.style.opacity = "1"
      if (getIsPlaying()) {
        incomingEl.play().catch(() => {})
      }
      this.activeBuffer = this.activeBuffer === "A" ? "B" : "A"
      this.state.activeClipId = nextClip.id
      this.state.activeMediaId = nextClip.mediaId
      this.state.bufferedClipId = null
      this.state.bufferedMediaId = null
      this.bufferReady = false
      this.swapPending = false
    }

    if (this.bufferReady || incomingEl.readyState >= 3) {
      doSwap()
    } else {
      this.swapPending = true
      incomingEl.addEventListener("canplay", doSwap, { once: true })
    }
  }

  // ── Per-frame sync (called from RAF) ────────────────────────────────

  syncVideo(ph: number, tracks: Track[], getUrl: UrlResolver, getIsPlaying: () => boolean): void {
    const playing = getIsPlaying()
    const activeVideoClip = getActiveVideoClip(tracks, ph)

    if (activeVideoClip) {
      if (activeVideoClip.id !== this.state.activeClipId && !this.swapPending) {
        this.swapBuffers(activeVideoClip, ph, getUrl, getIsPlaying)
        this.clipSeekDone = activeVideoClip.id
      } else if (playing) {
        if (this.clipSeekDone !== activeVideoClip.id) {
          this.clipSeekDone = activeVideoClip.id
          const mediaTime = activeVideoClip.mediaStart + (ph - activeVideoClip.timelineStart)
          seekEl(this.getActiveEl(), mediaTime)
        } else {
          const el = this.getActiveEl()
          const expected = activeVideoClip.mediaStart + (ph - activeVideoClip.timelineStart)
          if (Math.abs(el.currentTime - expected) > DRIFT_CORRECTION_THRESHOLD_S) {
            seekEl(el, expected)
          }
        }
        this.prepareBuffer(ph, activeVideoClip, tracks, getUrl)
      } else {
        // Paused / scrubbing — always sync exactly
        const el = this.getActiveEl()
        el.currentTime = activeVideoClip.mediaStart + (ph - activeVideoClip.timelineStart)
        applyTransformToEl(el, activeVideoClip.transform)
        this.clipSeekDone = null
      }
    } else if (this.state.activeClipId !== null) {
      this.getActiveEl().pause()
      this.getActiveEl().style.opacity = "0"
      this.state.activeClipId = null
      this.state.activeMediaId = null
      this.clipSeekDone = null
      this.swapPending = false
    }
  }

  // ── Controls ────────────────────────────────────────────────────────

  resetSeekFlags(): void {
    this.clipSeekDone = null
    this.swapPending = false
  }

  setVolume(_muted: boolean, _vol: number): void {
    // Audio is routed through the dedicated audio element pool in useMediaSync.
    // Video elements are always muted to prevent duplicate audio output.
    this.elA.muted = true
    this.elB.muted = true
  }

  playActive(): void {
    if (this.state.activeClipId) this.getActiveEl().play().catch(() => {})
  }

  pauseActive(): void {
    if (this.state.activeClipId) this.getActiveEl().pause()
  }
}
