import type { Clip, Project, RenderJob, RenderSegment } from "../project/projectTypes"
import { DEFAULT_SPEED } from "../constants/speed"

function clipToSegment(clip: Clip): RenderSegment {
  if (clip.type === "video") {
    return {
      mediaId: clip.mediaId,
      mediaStart: clip.mediaStart,
      mediaEnd: clip.mediaEnd,
      timelineStart: clip.timelineStart,
      timelineEnd: clip.timelineEnd,
      speed: clip.speed ?? DEFAULT_SPEED,
      type: "video",
      transform: clip.transform,
      volume: clip.audioConfig?.volume ?? clip.volume,
      colorAdjustments: clip.colorAdjustments,
      audioConfig: clip.audioConfig,
    }
  }

  if (clip.type === "audio") {
    return {
      mediaId: clip.mediaId,
      mediaStart: clip.mediaStart,
      mediaEnd: clip.mediaEnd,
      timelineStart: clip.timelineStart,
      timelineEnd: clip.timelineEnd,
      speed: clip.speed ?? DEFAULT_SPEED,
      type: "audio",
      volume: clip.audioConfig?.volume ?? clip.volume,
      audioConfig: clip.audioConfig,
    }
  }

  if (clip.type === "image") {
    return {
      mediaId: clip.mediaId,
      mediaStart: 0,
      mediaEnd: clip.timelineEnd - clip.timelineStart,
      timelineStart: clip.timelineStart,
      timelineEnd: clip.timelineEnd,
      speed: DEFAULT_SPEED,
      type: "image",
      transform: clip.transform,
      colorAdjustments: clip.colorAdjustments,
    }
  }

  // TextClip
  return {
    mediaId: "",
    mediaStart: 0,
    mediaEnd: clip.timelineEnd - clip.timelineStart,
    timelineStart: clip.timelineStart,
    timelineEnd: clip.timelineEnd,
    speed: DEFAULT_SPEED,
    type: "text",
    transform: clip.transform,
  }
}

export function buildRenderJob(
  project: Project,
  outputFormat: "mp4" | "webm",
  resolution: { width: number; height: number },
  fps: number
): RenderJob {
  const segments: RenderSegment[] = project.tracks
    .flatMap(track => track.clips.map(c => ({ ...clipToSegment(c), trackOrder: track.order })))
    .sort((a, b) => a.timelineStart - b.timelineStart)

  return { segments, outputFormat, resolution, fps }
}
