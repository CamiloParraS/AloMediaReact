import { create } from "zustand"
import { generateId } from "../utils/id"
import type { Clip, EditorState, Media, MediaType, Project } from "../project/projectTypes"

// Module-level file registry. Not part of reactive Zustand state — Map mutations
// don't trigger re-renders, but PreviewPlayer reads it after project.media updates.
export const fileMap = new Map<string, File>()

type StoreActions = {
  addMedia: (file: File) => Promise<Media>
  addClip: (clip: Clip) => void
  removeClip: (clipId: string) => void
  moveClip: (clipId: string, newStart: number, trackId: string) => void
  splitClip: (clipId: string, time: number) => void
  setPlayhead: (time: number) => void
  setIsPlaying: (value: boolean) => void
  setTimelineScale: (scale: number) => void
  setSelectedClip: (clipId: string | undefined) => void
  setSelectedTrack: (trackId: string | undefined) => void
  pushHistory: (description: string) => void
  undo: () => void
  redo: () => void
}

type EditorStore = EditorState & StoreActions

function makeInitialProject(): Project {
  return {
    id: generateId(),
    name: "Untitled Project",
    media: [],
    tracks: [
      { id: generateId(), type: "video", order: 0, clips: [] },
      { id: generateId(), type: "overlay", order: 1, clips: [] },
      { id: generateId(), type: "audio", order: 2, clips: [] },
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
  timelineScale: 50,
  isPlaying: false,
  history: [],
  historyIndex: -1,

  async addMedia(file: File): Promise<Media> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
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

      const duration = targetClip.timelineEnd - targetClip.timelineStart
      const updatedClip: Clip = {
        ...targetClip,
        trackId,
        timelineStart: newStart,
        timelineEnd: newStart + duration,
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

      const splitPoint = time - clip.timelineStart

      const firstHalf: Clip = {
        ...deepClone(clip),
        id: generateId(),
        timelineEnd: time,
        // Adjust mediaEnd for media-backed clips
        ...("mediaEnd" in clip ? { mediaEnd: clip.mediaStart + splitPoint } : {}),
      } as Clip

      const secondHalf: Clip = {
        ...deepClone(clip),
        id: generateId(),
        timelineStart: time,
        // Adjust mediaStart for media-backed clips
        ...("mediaStart" in clip ? { mediaStart: clip.mediaStart + splitPoint } : {}),
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
    set({ playhead: time })
  },

  setIsPlaying(value: boolean): void {
    set({ isPlaying: value })
  },

  setTimelineScale(scale: number): void {
    set({ timelineScale: scale })
  },

  setSelectedClip(clipId: string | undefined): void {
    set({ selectedClipId: clipId })
  },

  setSelectedTrack(trackId: string | undefined): void {
    set({ selectedTrackId: trackId })
  },

  pushHistory(description: string): void {
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
