import type { AudioConfig } from "../project/projectTypes"

/**
 * Builds the FFmpeg volume filter string for the given audio config.
 * Returns null if no volume modification is needed.
 */
export function buildVolumeFilter(config: AudioConfig): string | null {
  if (config.muted) return "volume=0"
  if (Math.abs(config.volume - 1.0) > 0.001) return `volume=${config.volume}`
  return null
}

/**
 * Builds the FFmpeg afade filter string for the given audio config.
 * clipDuration is timelineEnd - timelineStart in seconds.
 * Returns null if no fade is needed.
 */
export function buildFadeFilter(config: AudioConfig, clipDuration: number): string | null {
  let fadeIn = config.fadeInDuration
  let fadeOut = config.fadeOutDuration
  if (fadeIn === 0 && fadeOut === 0) return null

  // Clamp so fadeIn + fadeOut never exceeds clipDuration
  const total = fadeIn + fadeOut
  if (total > clipDuration) {
    const scale = clipDuration / total
    fadeIn = fadeIn * scale
    fadeOut = fadeOut * scale
  }

  const parts: string[] = []
  if (fadeIn > 0) {
    parts.push(`afade=t=in:st=0:d=${fadeIn}`)
  }
  if (fadeOut > 0) {
    parts.push(`afade=t=out:st=${clipDuration - fadeOut}:d=${fadeOut}`)
  }
  return parts.join(",")
}

/**
 * Builds the FFmpeg pan filter string for stereo balance.
 * balance: -1.0 = full left, 0 = center, 1.0 = full right.
 * Returns null if no panning is needed.
 */
export function buildBalanceFilter(config: AudioConfig): string | null {
  if (Math.abs(config.balance) <= 0.001) return null

  const b = config.balance
  if (Math.abs(b - -1.0) <= 0.001) return "pan=stereo|c0=c0|c1=c0"
  if (Math.abs(b - 1.0) <= 0.001) return "pan=stereo|c0=c1|c1=c1"

  // Intermediate: linear mix
  const leftWeight = 1 - Math.max(0, b)
  const rightWeight = 1 - Math.max(0, -b)
  return `pan=stereo|c0=${leftWeight}*c0|c1=${rightWeight}*c1`
}

/**
 * Combines all audio filter builders into a single filter chain string.
 * Returns null when no processing is needed (clip is at default settings).
 */
export function buildFullAudioFilterChain(config: AudioConfig, clipDuration: number): string | null {
  const parts = [
    buildVolumeFilter(config),
    buildFadeFilter(config, clipDuration),
    buildBalanceFilter(config),
  ].filter((p): p is string => p !== null)

  return parts.length > 0 ? parts.join(",") : null
}
