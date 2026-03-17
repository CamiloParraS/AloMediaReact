export interface RafLoopOptions {
  syncInterval: number
  getDuration: () => number
  onFrame: (playhead: number) => void
  onEnd: (duration: number) => void
  onStoreSync: (playhead: number) => void
}

export interface RafLoopHandle {
  start: (initialPlayhead: number) => void
  stop: () => void
}

export function createRafLoop({
  syncInterval,
  getDuration,
  onFrame,
  onEnd,
  onStoreSync,
}: RafLoopOptions): RafLoopHandle {
  let rafId: number | undefined
  let playhead = 0
  let lastWallTime = 0
  let lastStoreSync = 0

  function frame(wallTime: number): void {
    if (rafId === undefined) return

    const delta = (wallTime - lastWallTime) / 1000
    lastWallTime = wallTime
    playhead = Math.max(0, playhead + delta)

    const duration = getDuration()
    if (playhead >= duration) {
      playhead = duration
      rafId = undefined
      onEnd(duration)
      return
    }

    onFrame(playhead)

    if (wallTime - lastStoreSync >= syncInterval) {
      onStoreSync(playhead)
      lastStoreSync = wallTime
    }

    rafId = requestAnimationFrame(frame)
  }

  return {
    start(initialPlayhead: number): void {
      playhead = initialPlayhead
      lastWallTime = performance.now()
      lastStoreSync = performance.now()
      rafId = requestAnimationFrame(frame)
    },
    stop(): void {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId)
        rafId = undefined
      }
    },
  }
}
