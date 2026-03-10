export type MediaType = "video" | "audio" | "image"
export type TrackType = "video" | "audio"

export interface Media {
  id: string
  name: string
  type: MediaType
  format: string
  duration: number | null
  size: number
  hash: string // SHA-256 hex — used for deduplication
}

export interface Transform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface BaseClip {
  id: string
  trackId: string
  // All time fields below are stored in seconds, rounded to the nearest millisecond.
  // Always write through toMs/toSeconds from utils/time.ts to guarantee bitwise-identical boundaries.
  timelineStart: number // seconds (integer-ms precision)
  timelineEnd: number   // seconds (integer-ms precision)
}

export interface VideoClip extends BaseClip {
  type: "video"
  mediaId: string
  mediaStart: number // seconds (integer-ms precision)
  mediaEnd: number   // seconds (integer-ms precision)
  volume: number
  transform: Transform
}

export interface ImageClip extends BaseClip {
  type: "image"
  mediaId: string
  transform: Transform
}

export interface TextClip extends BaseClip {
  type: "text"
  content: string
  transform: Transform
}

export interface AudioClip extends BaseClip {
  type: "audio"
  mediaId: string
  mediaStart: number // seconds (integer-ms precision)
  mediaEnd: number   // seconds (integer-ms precision)
  volume: number
}

export type Clip = VideoClip | ImageClip | TextClip | AudioClip

export interface Track {
  id: string
  type: TrackType
  order: number
  clips: Clip[]
}

export interface Project {
  id: string
  name: string
  media: Media[]
  tracks: Track[]
}

// Project.duration is always derived — never stored.
// Use getProjectDuration(tracks) from utils/time.ts

export interface HistoryEntry {
  project: Project
  description: string
}

export interface EditorState {
  project: Project
  selectedClipId?: string
  selectedTrackId?: string
  playhead: number
  timelineScale: number // px per second, default 50
  isPlaying: boolean
  history: HistoryEntry[]
  historyIndex: number
}

export interface SavedProject {
  project: Project
  version: number
  createdAt: number
  updatedAt: number
}

export interface RenderSegment {
  mediaId: string
  mediaStart: number
  mediaEnd: number
  timelineStart: number
  timelineEnd: number
  type: "video" | "audio" | "image" | "text"
  transform?: Transform
  volume?: number
}

export interface RenderJob {
  segments: RenderSegment[]
  outputFormat: "mp4" | "webm"
  resolution: { width: number; height: number }
  fps: number
}
