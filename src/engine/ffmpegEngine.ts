import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import type { RenderJob } from "../project/projectTypes"
import { buildEqFilter, buildShadowFilter, buildDefinitionFilter } from "../utils/colorAdjustmentFilters"
import { buildFullAudioFilterChain } from "../utils/audioFilters"
import { buildAudioSpeedFilter, buildVideoSpeedFilter } from "../utils/speedFilters"
import { DEFAULT_SPEED } from "../constants/speed"

const ffmpeg = new FFmpeg()

export async function loadFFmpeg(): Promise<void> {
  if (ffmpeg.loaded) return
  // Use CDN-hosted core so WASM is served with correct MIME type and CORS headers.
  // The app itself still needs COOP/COEP headers (set in vite.config.ts) for
  // SharedArrayBuffer support and multi-threaded execution.
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm"
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  })
}

export async function renderJob(
  job: RenderJob,
  files: Map<string, File>
): Promise<Uint8Array> {
  await loadFFmpeg()

  // Collect unique mediaIds that actually reference a file (text clips have "")
  const uniqueMediaIds = [...new Set(job.segments.map(s => s.mediaId).filter(Boolean))]

  // Write all input files into FFmpeg's virtual filesystem
  for (const mediaId of uniqueMediaIds) {
    const file = files.get(mediaId)
    if (!file) continue
    await ffmpeg.writeFile(mediaId, await fetchFile(file))
  }

  // Separate video and audio segments
  const videoSegments = job.segments.filter(s => s.type === "video")
  const audioBearingSegments = job.segments.filter(s => s.type === "audio" || s.type === "video")

  const { width: W, height: H } = job.resolution
  const totalDuration = Math.max(
    ...job.segments.map(s => s.timelineEnd),
    0.1,
  )
  const isMultiTrack = new Set(videoSegments.map(s => s.trackOrder ?? 0)).size > 1

  // Trim each video segment.
  // For single-track segments: bake color filters at trim time (requires encode when active).
  // For multi-track segments: keep -c copy here; filters are applied in the compositing graph.
  for (let i = 0; i < videoSegments.length; i++) {
    const seg = videoSegments[i]
    const vfParts: string[] = []
    const speedFilter = buildVideoSpeedFilter(seg.speed ?? DEFAULT_SPEED)
    if (speedFilter) vfParts.push(speedFilter)
    if (!isMultiTrack && seg.colorAdjustments) {
      const eq = buildEqFilter(seg.colorAdjustments)
      const shadow = buildShadowFilter(seg.colorAdjustments)
      const definition = buildDefinitionFilter(seg.colorAdjustments)
      if (eq) vfParts.push(eq)
      if (shadow) vfParts.push(shadow)
      if (definition) vfParts.push(definition)
    }

    if (vfParts.length > 0) {
      await ffmpeg.exec([
        "-i", seg.mediaId,
        "-ss", String(seg.mediaStart),
        "-to", String(seg.mediaEnd),
        "-vf", vfParts.join(","),
        "-c:v", "libx264", "-preset", "fast",
        `trimmed_${i}.mp4`,
      ])
    } else {
      await ffmpeg.exec([
        "-i", seg.mediaId,
        "-ss", String(seg.mediaStart),
        "-to", String(seg.mediaEnd),
        "-c", "copy",
        `trimmed_${i}.mp4`,
      ])
    }
  }

  let videoTrackFile = "video_track.mp4"

  if (videoSegments.length === 0) {
    // No video at all — handled below in the mux step
  } else if (videoSegments.length === 1 && !isMultiTrack) {
    videoTrackFile = "trimmed_0.mp4"
  } else if (!isMultiTrack) {
    // Single-track: safe to concatenate sequentially
    const concatLines = videoSegments
      .map((_, i) => `file 'trimmed_${i}.mp4'`)
      .join("\n")
    await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(concatLines))
    await ffmpeg.exec([
      "-f", "concat", "-safe", "0",
      "-i", "concat.txt",
      "-c", "copy",
      videoTrackFile,
    ])
  } else {
    // Multi-track: composite using overlay filters.
    // Sort by trackOrder descending so background (highest order) is overlaid first
    // and foreground (lowest order) ends up on top.
    const sorted = videoSegments
      .map((seg, origIdx) => ({ seg, origIdx }))
      .sort((a, b) => {
        const od = (b.seg.trackOrder ?? 0) - (a.seg.trackOrder ?? 0)
        return od !== 0 ? od : a.seg.timelineStart - b.seg.timelineStart
      })

    // Input 0: black base canvas
    const inputArgs: string[] = [
      "-f", "lavfi",
      "-i", `color=c=black:s=${W}x${H}:d=${totalDuration}:r=${job.fps}`,
    ]

    // Inputs 1..N: trimmed segments shifted to their timeline position
    for (const { seg, origIdx } of sorted) {
      inputArgs.push(
        "-itsoffset", String(seg.timelineStart),
        "-i", `trimmed_${origIdx}.mp4`,
      )
    }

    // Build overlay filter chain
    const filterParts: string[] = []
    let lastLabel = "0:v"

    for (let i = 0; i < sorted.length; i++) {
      const { seg } = sorted[i]
      const inIdx = i + 1
      const t = seg.transform
      const needsScale = t && (t.width !== W || t.height !== H)
      const x = t?.x ?? 0
      const y = t?.y ?? 0

      let videoLabel = `${inIdx}:v`
      if (needsScale) {
        filterParts.push(`[${videoLabel}]scale=${t!.width}:${t!.height}[s${i}]`)
        videoLabel = `s${i}`
      }

      // Inject eq → shadow → definition filters after scale/position, before overlay
      const eqFilter = seg.colorAdjustments ? buildEqFilter(seg.colorAdjustments) : null
      if (eqFilter) {
        filterParts.push(`[${videoLabel}]${eqFilter}[eq${i}]`)
        videoLabel = `eq${i}`
      }
      const shadowFilter = seg.colorAdjustments ? buildShadowFilter(seg.colorAdjustments) : null
      if (shadowFilter) {
        filterParts.push(`[${videoLabel}]${shadowFilter}[shadow${i}]`)
        videoLabel = `shadow${i}`
      }
      const definitionFilter = seg.colorAdjustments ? buildDefinitionFilter(seg.colorAdjustments) : null
      if (definitionFilter) {
        filterParts.push(`[${videoLabel}]${definitionFilter}[def${i}]`)
        videoLabel = `def${i}`
      }

      const outLabel = i === sorted.length - 1 ? "vout" : `t${i}`
      filterParts.push(
        `[${lastLabel}][${videoLabel}]overlay=${x}:${y}:eof_action=pass[${outLabel}]`,
      )
      lastLabel = outLabel
    }

    videoTrackFile = "composited.mp4"
    await ffmpeg.exec([
      ...inputArgs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[vout]",
      "-c:v", "libx264", "-preset", "fast",
      "-y", videoTrackFile,
    ])
  }

  const outputFile = `output.${job.outputFormat}`

  if (audioBearingSegments.length === 0) {
    // No audio — just copy the video track to the output
    if (videoSegments.length > 0) {
      await ffmpeg.exec(["-i", videoTrackFile, "-c", "copy", outputFile])
    } else {
      throw new Error("No video or audio segments to render.")
    }
  } else {
    const hasVideoOutput = videoSegments.length > 0
    const audioInputIndexOffset = hasVideoOutput ? 1 : 0

    // Build audio input args
    const audioInputArgs: string[] = []
    for (const seg of audioBearingSegments) {
      audioInputArgs.push("-i", seg.mediaId)
    }

    // Authority: buildFullAudioFilterChain is the single path for all audio processing
    // (volume, mute, fade, balance). When audioConfig is present on a segment it is used
    // exclusively. When audioConfig is absent (legacy segments), a simple volume= filter
    // is the fallback. These two paths are mutually exclusive per segment.
    const audioFilterParts: string[] = []
    const audioInputLabels: string[] = []
    for (let i = 0; i < audioBearingSegments.length; i++) {
      const seg = audioBearingSegments[i]
      const duration = seg.timelineEnd - seg.timelineStart
      const toneFilterChain = seg.audioConfig
        ? buildFullAudioFilterChain(seg.audioConfig, duration)
        : (seg.volume != null && Math.abs(seg.volume - 1) > 0.001 ? `volume=${seg.volume}` : null)
      const speedFilter = buildAudioSpeedFilter(seg.speed ?? DEFAULT_SPEED)
      const segmentDelayMs = Math.max(0, Math.round(seg.timelineStart * 1000))
      const segmentFilters: string[] = [
        `atrim=start=${seg.mediaStart}:end=${seg.mediaEnd}`,
        "asetpts=PTS-STARTPTS",
      ]
      if (speedFilter) segmentFilters.push(speedFilter)
      if (toneFilterChain) segmentFilters.push(toneFilterChain)
      segmentFilters.push(`adelay=${segmentDelayMs}|${segmentDelayMs}`)

      audioFilterParts.push(`[${i + audioInputIndexOffset}:a]${segmentFilters.join(",")}[a${i}]`)
      audioInputLabels.push(`[a${i}]`)
    }

    const mixInputs = audioInputLabels.join("")
    const filterComplex = `${audioFilterParts.join(";")};${mixInputs}amix=inputs=${audioBearingSegments.length}[aout]`

    const videoInputArgs = hasVideoOutput
      ? ["-i", videoTrackFile]
      : []

    await ffmpeg.exec([
      ...videoInputArgs,
      ...audioInputArgs,
      "-filter_complex", filterComplex,
      ...(hasVideoOutput ? ["-map", "0:v", "-map", "[aout]"] : ["-map", "[aout]"]),
      ...(hasVideoOutput && !isMultiTrack ? ["-c:v", "copy"] : []),
      "-c:a", "aac",
      outputFile,
    ])
  }

  return await ffmpeg.readFile(outputFile) as Uint8Array
}
