import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import type { RenderJob } from "../project/projectTypes"
import { buildEqFilter, buildShadowFilter, buildDefinitionFilter } from "../utils/colorAdjustmentFilters"

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
  const audioSegments = job.segments.filter(s => s.type === "audio")

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

  if (audioSegments.length === 0) {
    // No audio — just copy the video track to the output
    if (videoSegments.length > 0) {
      await ffmpeg.exec(["-i", videoTrackFile, "-c", "copy", outputFile])
    } else {
      throw new Error("No video or audio segments to render.")
    }
  } else {
    // Build amix filter for audio segments
    const audioInputArgs: string[] = []
    for (const seg of audioSegments) {
      audioInputArgs.push("-i", seg.mediaId)
    }

    const volumeFilter = audioSegments
      .map((seg, i) => `[${i + 1}:a]volume=${seg.volume ?? 1}[a${i}]`)
      .join(";")
    const mixInputs = audioSegments.map((_, i) => `[a${i}]`).join("")
    const filterComplex = `${volumeFilter};${mixInputs}amix=inputs=${audioSegments.length}[aout]`

    const videoInputArgs = videoSegments.length > 0
      ? ["-i", videoTrackFile]
      : []

    await ffmpeg.exec([
      ...videoInputArgs,
      ...audioInputArgs,
      "-filter_complex", filterComplex,
      ...(videoSegments.length > 0 ? ["-map", "0:v", "-map", "[aout]"] : ["-map", "[aout]"]),
      ...(videoSegments.length > 0 && !isMultiTrack ? ["-c:v", "copy"] : []),
      "-c:a", "aac",
      outputFile,
    ])
  }

  return await ffmpeg.readFile(outputFile) as Uint8Array
}
