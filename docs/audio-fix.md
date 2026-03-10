# Audio Bug Fix — Multi-Track Audio Playback

## Problem

Audio only played when an audio-bearing clip (`VideoClip` or `AudioClip`) was placed
on the first (lowest-order) track. Clips on any other track rendered their video frames
correctly but produced no audio.

## Root Cause

The audio element pool in `useMediaSync.ts` was created only for tracks with
`type === "audio"`. Video tracks were excluded from the pool, so `VideoClip` audio from
non-primary video tracks had no audio element to play through.

The primary double-buffer `<video>` element handled audio only for the topmost active
video clip. All secondary video elements were rendered `muted`. This meant any
`VideoClip` not selected as the primary clip was silently discarded from audio output.

`syncAudioElements` in `audioSync.ts` additionally filtered for `clip.type === "audio"`
only, so `VideoClip` entries were never synced even if a pool element had been created
for their track.

## Files Changed

### `src/player/hooks/useMediaSync.ts`

- Extended the audio element pool from audio-only tracks to **all tracks** (video + audio).
  A pool entry keyed by `trackId` is now created for every track.
- Added `isMutedRef` and `volumeRef` so the RAF callback (`syncMediaElements`) always
  reads the current mute/volume state without stale closure values.
- Passed `isMutedRef` and `volumeRef` into `syncAudioElements`.
- Added a `useEffect` to propagate `isMuted`/`volume` changes to all currently-playing
  audio pool elements immediately (not just on the next RAF frame).
- Updated the play/pause toggle effect to handle both `AudioClip` and `VideoClip` types
  when resuming or pausing audio elements.

### `src/player/audio/audioSync.ts`

- Extended the active-clip filter from `clip.type === "audio"` to also include
  `clip.type === "video"`, so `VideoClip` audio on any track is synced through the pool.
- Added `isMuted` and `volume` parameters (with safe defaults) to `syncAudioElements`
  so volume/mute state is applied correctly when a clip becomes newly active.

### `src/player/video/videoBuffer.ts`

- `VideoBufferManager` constructor now always sets `elA.muted = true` and
  `elB.muted = true` on creation.
- `setVolume()` always mutes both video elements. Audio output is now exclusively
  routed through the audio element pool, eliminating any risk of duplicate audio when
  both a `<video>` element and a `<audio>` pool element would otherwise play the same
  media simultaneously.

### `src/hooks/usePlayer.ts`

No changes required. `seek()` calls `setPlayhead()`, which triggers the scrub-sync
`useEffect` in `useMediaSync.ts` that calls `syncMediaElements` — this correctly syncs
audio `currentTime` for all pool elements.

## Behaviour After Fix

| Scenario | Before | After |
|---|---|---|
| `VideoClip` on Track 0 | Audio plays | Audio plays (no regression) |
| `VideoClip` on Track 1 | No audio | Audio plays |
| `VideoClip` on any track | Audio only on lowest-order track | Audio plays on all tracks |
| Two overlapping `VideoClip`s | Only lowest-order plays audio | Only lowest-order plays audio (correct) |
| `AudioClip` on any audio track | Audio plays | Audio plays (no regression) |
| Playhead leaves clip range | Audio stops | Audio stops |
| Seek while paused | Video scrubs, audio may not | Both video and audio scrub to correct offset |
| Seek while playing | Correct | Correct (no change) |
| Mute/unmute during playback | Applied to video elements | Applied to audio pool elements |
