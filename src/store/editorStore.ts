import { create } from "zustand"
import { generateId } from "../utils/id"
import { TIMELINE_ZOOM } from "../constants/timeline"
import { getInsertionIndex } from "../utils/tracks"
import { toMs, toSeconds } from "../utils/time"
import type { Clip, EditorState, Media, MediaType, Project, Track, TrackType, Transform, ColorAdjustments } from "../project/projectTypes"

export interface ProxyState {
  status: 'pending' | 'ready' | 'error'
  objectUrl: string | null
}

// Module-level file registry. Not part of reactive Zustand state — Map mutations
// don't trigger re-renders, but PreviewPlayer reads it after project.media updates.
export const fileMap = new Map<string, File>()

type StoreActions = {
  addMedia: (file: File) => Promise<Media>
  addClip: (clip: Clip) => void
  removeClip: (clipId: string) => void
  moveClip: (clipId: string, newStart: number, trackId: string) => void
  splitClip: (clipId: string, time: number) => void
  addTrack: (type: TrackType) => Track
  removeTrack: (trackId: string) => void
  reorderTrack: (sourceTrackId: string, targetTrackId: string) => void
  resizeClip: (clipId: string, newEnd: number) => void
  updateClipTransform: (clipId: string, transform: Partial<Transform>) => void
  commitTransform: (clipId: string) => void
  updateClipColorAdjustments: (clipId: string, adjustments: ColorAdjustments) => void
  setPlayhead: (time: number) => void
  setIsPlaying: (value: boolean) => void
  setTimelineScale: (scale: number) => void
  setSelectedClip: (clipId: string | undefined) => void
  setSelectedTrack: (trackId: string | undefined) => void
  pushHistory: (description: string) => void
  undo: () => void
  redo: () => void
  proxyMap: Record<string, ProxyState>
  setProxyState: (mediaId: string, state: ProxyState) => void
}

type EditorStore = EditorState & StoreActions

function makeInitialProject(): Project {
  return {
    id: generateId(),
    name: "Untitled Project",
    media: [],
    tracks: [
      { id: generateId(), type: "video", order: 0, clips: [] },
      { id: generateId(), type: "audio", order: 1, clips: [] },
    ],
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function getMediaDuration(file: File, type: MediaType): Promise<number | null> {
  if (type === "image") return Promise.resolve(null)

  return new Promise((resolve) => {
    const element =
      type === "video"
        ? document.createElement("video")
        : document.createElement("audio")
    const url = URL.createObjectURL(file)
    element.src = url
    element.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(element.duration)
    }
    element.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
  })
}

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  return "image"
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: makeInitialProject(),
  playhead: 0,
  timelineScale: TIMELINE_ZOOM.DEFAULT,
  isPlaying: false,
  history: [],
  historyIndex: -1,
  proxyMap: {},

  setProxyState(mediaId: string, state: ProxyState): void {
    set(s => ({ proxyMap: { ...s.proxyMap, [mediaId]: state } }))
  },

  async addMedia(file: File): Promise<Media> {
    const raw = `${file.name}-${file.size}-${file.lastModified}`
    const encoded = new TextEncoder().encode(raw)
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")

    const existing = get().project.media.find(m => m.hash === hash)
    if (existing) return existing

    const type = detectMediaType(file)
    const duration = await getMediaDuration(file, type)
    const format = file.type

    const media: Media = {
      id: generateId(),
      name: file.name,
      type,
      format,
      duration,
      size: file.size,
      hash,
    }

    set(state => ({
      project: {
        ...state.project,
        media: [...state.project.media, media],
      },
    }))

    fileMap.set(media.id, file)
    return media
  },

  addClip(clip: Clip): void {
    get().pushHistory("Add clip")
    set(state => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map(track =>
          track.id === clip.trackId
            ? { ...track, clips: [...track.clips, clip] }
            : track
        ),
      },
    }))
  },

  removeClip(clipId: string): void {
    get().pushHistory("Remove clip")
    set(state => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(c => c.id !== clipId),
        })),
      },
    }))
  },

  moveClip(clipId: string, newStart: number, trackId: string): void {
    get().pushHistory("Move clip")
    set(state => {
      let targetClip: Clip | undefined

      // Find and remove the clip from its current track
      const tracksWithout = state.project.tracks.map(track => {
        const clip = track.clips.find(c => c.id === clipId)
        if (clip) {
          targetClip = clip
          return { ...track, clips: track.clips.filter(c => c.id !== clipId) }
        }
        return track
      })

      if (!targetClip) return state

      const roundedStart = toSeconds(toMs(newStart))
      const duration = targetClip.timelineEnd - targetClip.timelineStart
      const updatedClip: Clip = {
        ...targetClip,
        trackId,
        timelineStart: roundedStart,
        timelineEnd: toSeconds(toMs(roundedStart + duration)),
      }

      return {
        project: {
          ...state.project,
          tracks: tracksWithout.map(track =>
            track.id === trackId
              ? { ...track, clips: [...track.clips, updatedClip] }
              : track
          ),
        },
      }
    })
  },

  addTrack(type: TrackType): Track {
    get().pushHistory("Add track")
    const sorted = get().project.tracks.slice().sort((a, b) => a.order - b.order)
    const insertIdx = getInsertionIndex(sorted, type)
    const newTrack: Track = {
      id: generateId(),
      type,
      order: insertIdx,
      clips: [],
    }
    // Insert at correct position and reassign all order values
    const withNew = [
      ...sorted.slice(0, insertIdx),
      newTrack,
      ...sorted.slice(insertIdx),
    ].map((t, i) => ({ ...t, order: i }))
    set(state => ({
      project: {
        ...state.project,
        tracks: withNew,
      },
    }))
    return withNew[insertIdx]
  },

  removeTrack(trackId: string): void {
    const { project } = get()
    const track = project.tracks.find(t => t.id === trackId)
    if (!track) return
    const sameType = project.tracks.filter(t => t.type === track.type)
    if (sameType.length <= 1) return
    get().pushHistory("Remove track")
    set(state => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.filter(t => t.id !== trackId),
      },
    }))
  },

  reorderTrack(sourceTrackId: string, targetTrackId: string): void {
    get().pushHistory('Reorder track')
    set(state => {
      const tracks = state.project.tracks
      const source = tracks.find(t => t.id === sourceTrackId)
      const target = tracks.find(t => t.id === targetTrackId)
      if (!source || !target) return state
      const sourceOrder = source.order
      const targetOrder = target.order
      const reordered = tracks.map(t => {
        if (t.id === sourceTrackId) return { ...t, order: targetOrder }
        if (t.id === targetTrackId) return { ...t, order: sourceOrder }
        return t
      })
      return { project: { ...state.project, tracks: reordered.sort((a, b) => a.order - b.order) } }
    })
  },

  resizeClip(clipId: string, newEnd: number): void {
    set(state => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => {
            if (clip.id !== clipId) return clip
            if (newEnd <= clip.timelineStart + 0.5) return clip
            return { ...clip, timelineEnd: newEnd }
          }),
        })),
      },
    }))
  },

  updateClipTransform(clipId: string, transform: Partial<Transform>): void {
    set(state => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => {
            if (clip.id !== clipId) return clip
            if (!('transform' in clip)) return clip
            return { ...clip, transform: { ...(clip as any).transform, ...transform } }
          }),
        })),
      },
    }))
  },

  commitTransform(_clipId: string): void {
    get().pushHistory('Transform clip')
  },

  updateClipColorAdjustments(clipId: string, adjustments: ColorAdjustments): void {
    get().pushHistory('Color adjustment')
    set(state => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => {
            if (clip.id !== clipId) return clip
            if (clip.type !== 'video' && clip.type !== 'image') return clip
            return { ...clip, colorAdjustments: adjustments }
          }),
        })),
      },
    }))
  },

  splitClip(clipId: string, time: number): void {
    set(state => {
      let clip: Clip | undefined
      for (const track of state.project.tracks) {
        clip = track.clips.find(c => c.id === clipId)
        if (clip) break
      }

      if (!clip) return state
      if (time <= clip.timelineStart || time >= clip.timelineEnd) return state

      get().pushHistory("Split clip")

      // Round cut time to nearest ms — both halves share the exact same value,
      // guaranteeing clipA.timelineEnd === clipB.timelineStart with no float gap.
      const cutTime = toSeconds(toMs(time))
      const splitPoint = cutTime - clip.timelineStart

      const firstHalf: Clip = {
        ...deepClone(clip),
        id: generateId(),
        timelineEnd: cutTime,
        // Adjust mediaEnd for media-backed clips
        ...("mediaEnd" in clip ? { mediaEnd: toSeconds(toMs(clip.mediaStart + splitPoint)) } : {}),
      } as Clip

      const secondHalf: Clip = {
        ...deepClone(clip),
        id: generateId(),
        timelineStart: cutTime,
        // Adjust mediaStart for media-backed clips
        ...("mediaStart" in clip ? { mediaStart: toSeconds(toMs(clip.mediaStart + splitPoint)) } : {}),
      } as Clip

      return {
        project: {
          ...state.project,
          tracks: state.project.tracks.map(track => {
            if (!track.clips.find(c => c.id === clipId)) return track
            const filtered = track.clips.filter(c => c.id !== clipId)
            return { ...track, clips: [...filtered, firstHalf, secondHalf] }
          }),
        },
      }
    })
  },

  setPlayhead(time: number): void {
    // Round to nearest millisecond to eliminate sub-ms float drift
    set({ playhead: toSeconds(toMs(time)) })
  },

  setIsPlaying(value: boolean): void {
    set({ isPlaying: value })
  },

  setTimelineScale(scale: number): void {
    set({ timelineScale: Math.min(TIMELINE_ZOOM.MAX, Math.max(TIMELINE_ZOOM.MIN, scale)) })
  },

  setSelectedClip(clipId: string | undefined): void {
    set({ selectedClipId: clipId })
  },

  setSelectedTrack(trackId: string | undefined): void {
    set({ selectedTrackId: trackId })
  },

  pushHistory(description: string): void {
    // Pause playback on any timeline mutation so preview and playhead stay in sync
    set({ isPlaying: false })
    const state = get()
    const snapshot = deepClone(state.project)
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push({ project: snapshot, description })
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo(): void {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    set({ project: deepClone(history[newIndex].project), historyIndex: newIndex })
  },

  redo(): void {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    set({ project: deepClone(history[newIndex].project), historyIndex: newIndex })
  },
}))
