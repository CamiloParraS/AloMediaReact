import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import type { RenderJob } from "../project/projectTypes"

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

  // Trim each video segment
  for (let i = 0; i < videoSegments.length; i++) {
    const seg = videoSegments[i]
    await ffmpeg.exec([
      "-i", seg.mediaId,
      "-ss", String(seg.mediaStart),
      "-to", String(seg.mediaEnd),
      "-c", "copy",
      `trimmed_${i}.mp4`,
    ])
  }

  let videoTrackFile = "video_track.mp4"

  if (videoSegments.length > 1) {
    // Build concat list
    const concatLines = videoSegments
      .map((_, i) => `file 'trimmed_${i}.mp4'`)
      .join("\n")
    const concatBytes = new TextEncoder().encode(concatLines)
    await ffmpeg.writeFile("concat.txt", concatBytes)

    await ffmpeg.exec([
      "-f", "concat", "-safe", "0",
      "-i", "concat.txt",
      "-c", "copy",
      videoTrackFile,
    ])
  } else if (videoSegments.length === 1) {
    videoTrackFile = "trimmed_0.mp4"
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

    const amixInputs = audioSegments.map((_, i) => `[${i + 1}:a]`).join("")
    const volumeFilter = audioSegments
      .map((seg, i) => `[${i + 1}:a]volume=${seg.volume ?? 1}[a${i}]`)
      .join(";")
    const mixInputs = audioSegments.map((_, i) => `[a${i}]`).join("")
    const filterComplex = videoSegments.length > 0
      ? `${volumeFilter};${mixInputs}amix=inputs=${audioSegments.length}[aout]`
      : `${volumeFilter};${mixInputs}amix=inputs=${audioSegments.length}[aout]`

    const videoInputArgs = videoSegments.length > 0
      ? ["-i", videoTrackFile]
      : []

    await ffmpeg.exec([
      ...videoInputArgs,
      ...audioInputArgs,
      "-filter_complex", filterComplex,
      ...(videoSegments.length > 0 ? ["-map", "0:v", "-map", `[aout]`] : ["-map", "[aout]"]),
      "-c:v", "copy",
      "-c:a", "aac",
      outputFile,
    ])
  }

  return await ffmpeg.readFile(outputFile) as Uint8Array
}
