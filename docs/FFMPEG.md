# FFmpeg Integration & Video Rendering

## Overview

AloMedia uses **FFmpeg.wasm**, a JavaScript port of FFmpeg compiled to WebAssembly, to perform server-less video rendering directly in the browser. This eliminates the need for a backend rendering service and enables users to create videos without uploading their media to external servers.

The FFmpeg integration is abstracted into a render pipeline that converts a project definition into a final video file. This documentation covers how the system works, the rendering process, and important considerations.

## What is FFmpeg.wasm?

FFmpeg.wasm is a port of the FFmpeg multimedia framework compiled to WebAssembly (WASM). It provides:

- **Video encoding/decoding**: Read and write various video formats
- **Audio processing**: Encode/decode audio and create soundtracks
- **Filtering**: Apply transformations, effects, and compositions
- **Muxing**: Combine video and audio streams into containers

The JavaScript API allows calling FFmpeg commands as if using the CLI, but all computation happens in the browser's JavaScript sandbox.

## Architecture

### FFmpeg Engine (`src/engine/ffmpegEngine.ts`)

The primary interface for video rendering:

```
loadFFmpeg() → Promise<void>
renderJob(job: RenderJob, files: Map<string, File>) → Promise<Uint8Array>
```

**`loadFFmpeg()`**: Initializes the FFmpeg library on first use:

1. Fetches the FFmpeg core JavaScript from a CDN
2. Fetches the WASM binary
3. Initializes FFmpeg with multi-threading support
4. Subsequent calls return immediately if already loaded

The FFmpeg core is fetched from a CDN (`unpkg.com`) to:
- Serve WASM with correct MIME type (`application/wasm`)
- Serve JavaScript with correct headers
- Avoid issues with local development servers

The Vite development server is configured to include COOP/COEP headers so SharedArrayBuffer can be used for FFmpeg's multi-threading.

**`renderJob()`**: Transforms a project into a video file:

1. Writes all media files into FFmpeg's virtual filesystem
2. Processes video and audio segments separately
3. Handles single-track, multi-track, and mixed scenarios
4. Applies transformations and volume levels
5. Muxes final video and audio
6. Returns the output as binary data

### Render Job and Segments

A **RenderJob** describes what needs to be rendered:

```typescript
{
  segments: RenderSegment[],     // List of all clips
  outputFormat: "mp4" | "webm",  // Final container
  resolution: { width, height }, // Output dimensions
  fps: number                     // Frames per second
}
```

A **RenderSegment** represents one clip being rendered:

```typescript
{
  mediaId: string,      // References the media file
  mediaStart: number,   // Start time in source (seconds)
  mediaEnd: number,     // End time in source (seconds)
  timelineStart: number, // When it appears in output (seconds)
  timelineEnd: number,  // When it ends in output (seconds)
  type: "video" | "audio" | "image" | "text",
  transform?: {         // For video/image clips
    x, y, width, height, rotation
  },
  volume?: number,      // For audio/video with audio (0-1)
  trackOrder?: number   // Z-order for video compositing
}
```

### Proxy Engine (`src/engine/proxyEngine.ts`)

Before final rendering, AloMedia generates proxy videos:

**Purpose**: 
- Preview the video in the timeline without long encoding waits
- Verify audio/video sync before committing to final render
- Allow quick iterations without re-encoding at full quality

**Process**:

1. Takes the full video file
2. Scales to lower resolution (480p typical)
3. Re-encodes at lower bitrate
4. Returns lightweight video suitable for scrubbing

Proxy generation happens asynchronously as media is imported. Users see a loading state until the proxy is ready.

### Render Pipeline (`src/engine/renderPipeline.ts`)

Orchestrates the overall rendering workflow:

```
Project → Analyze → Create RenderJob → FFmpeg Render → Output File
```

**Steps**:

1. **Analyze**: Examine project structure and determine rendering strategy
2. **Segment**: Convert timeline clips into render segments
3. **Optimize**: Determine if single-pass or multi-pass rendering needed
4. **Create Job**: Build RenderJob with optimal parameters
5. **Invoke FFmpeg**: Call renderJob() with the job
6. **Download**: Return output file to user for download

## The Rendering Process

### Complex Video Rendering

When a project has multiple video clips on the same track or different tracks, FFmpeg must composite them. AloMedia handles three scenarios:

#### Scenario 1: No Video Track
If project has only audio, FFmpeg generates a silent video track automatically.

#### Scenario 2: Single Video Clip
If only one video clip exists (no overlays), FFmpeg simply trims it to the right time range without complex processing. Trimming is fast because it uses copy mode (`-c copy`) avoiding re-encoding.

#### Scenario 3: Multiple Video Segments on Same Track
When video clips are sequenced (not overlapping), FFmpeg uses concat demuxer:

1. Trim each segment individually to exact in-out points
2. Create a concat file listing all trimmed files
3. Use concat demuxer to join them seamlessly
4. Result is a single seamless video track

#### Scenario 4: Multiple Video Tracks (Compositing)
The most complex scenario involves overlapping video on different tracks. Example: a lower-3rd graphic over a main video.

Process:
1. Create a black canvas the size of the output video
2. For each track (highest order first, so background first):
   - Take the trimmed segment
   - Offset its start time to match timeline position
   - Scale/crop to canvas dimensions
   - Overlay on top of previous tracks
3. Use FFmpeg's overlay filter to composite layers

FFmpeg command structure for compositing:
```
Input 0: Black canvas (color=...)
Input 1: First video segment (offset to timeline position)
Input 2: Second video segment (offset to timeline position)
Input N: Nth video segment

Filter chain: 
canvas -> overlay(video1) -> overlay(video2) -> ... -> output
```

The overlay filter supports alpha transparency, positioning, and scaling.

### Audio Rendering

Audio is handled separately from video:

1. Separate audio-only segments from rendering
2. For each audio segment:
   - Trim to exact start/end point
   - Apply volume adjustment via filter
3. Concatenate all audio segments sequentially
4. Mux audio track with video track in final container

Audio volume is adjusted using FFmpeg's `volume` filter:
```
scale factor = [0, 1]
volume filter = volume=factor
```

### Image Handling

For image clips (which have no duration of their own):

1. Image duration is determined by timeline position (timelineEnd - timelineStart)
2. FFmpeg creates a video stream from the image, lasting the specified duration
3. Image is scaled to output dimensions
4. Composited as if it were a video clip

### Transformation Application

For each video/image segment with transforms:

1. **Scale**: Resize to specified width/height
2. **Position**: Translate via `pad` filter to move within canvas
3. **Rotate**: Apply rotation filter (slower than other transforms)

Example: positioning and scaling
```
Input: image.jpg (640x480)
Transform: x=100, y=50, width=320, height=240

FFmpeg:
-vf "scale=320:240,pad=1280:720:100:50:black"
```

## Virtual Filesystem

FFmpeg.wasm includes an in-memory virtual filesystem. The rendering process:

1. **Write Input Files**: All imported media files are written to the virtual FS
   ```
   await ffmpeg.writeFile('media_123', await fetchFile(file))
   ```

2. **Execute FFmpeg Commands**: Commands reference virtual paths
   ```
   await ffmpeg.exec(['-i', 'media_123', '-c', 'copy', 'output.mp4'])
   ```

3. **Read Output**: Final output is read from virtual FS
   ```
   const data = await ffmpeg.readFile('output.mp4')
   ```

4. **Cleanup**: Temporary files should be cleaned up to save memory
   ```
   await ffmpeg.deleteFile('media_123')
   ```

**Important**: The virtual filesystem persists between calls, so previous rendering outputs should be cleaned up before starting a new render.

## Output Formats

AloMedia supports two output containers:

### MP4
- **Codec**: H.264 for video, AAC for audio
- **Advantages**: Universal compatibility, works on all devices
- **Limitations**: Proprietary format, less flexible
- **Use case**: Most common choice for sharing and streaming

### WebM
- **Codec**: VP9 for video, Opus for audio
- **Advantages**: Open source, modern, good compression
- **Limitations**: Limited device support (not on older iOS/Android)
- **Use case**: Web-native format, modern browsers

## Performance Considerations

### Encoding Time

Rendering speed depends on:

- **Resolution**: Higher resolution = slower encoding (2x resolution ≈ 4x time)
- **Duration**: Longer videos = proportionally more time
- **Complexity**: Multi-track compositing is slower than single track
- **Hardware**: GPU acceleration possible but browser-dependent
- **Working memory**: Limited by browser memory limits (typically 500MB-2GB)

### Browser Limits

Different browsers have different resource limits:

- **Memory**: Typically 512MB-2GB available to JavaScript
- **Computation**: Background tabs are throttled in most browsers
- **Storage**: Local file access limited by browser security
- **Time**: Long operations may cause "script unresponsive" warnings

Projects with:
- Very high resolution (4K+)
- Very long duration (1+ hour)
- Complex multi-track compositing
- Limited device RAM

...may fail or be extremely slow. Consider:
- Limiting default resolution to 1080p
- Showing warnings for long projects
- Offering streaming options instead of full download
- Chunked encoding for very large projects

### Optimization Strategies

1. **Keyframe Alignment**: Ensure clips start at keyframes for faster trimming
2. **Format Consistency**: Clips in same format are faster to process
3. **Resolution Matching**: All clips at same resolution avoid scaling overhead
4. **Bitrate Control**: Lower bitrate for faster encoding (lower quality)

## Error Handling

FFmpeg commands can fail for various reasons:

- **Unsupported format**: File is corrupted or in unexpected format
- **Invalid parameters**: Transform or duration values invalid
- **OOM**: Process runs out of memory
- **Timeout**: Process takes too long and times out

The rendering pipeline should:

1. Validate all inputs before starting FFmpeg
2. Catch FFmpeg execution errors with try/catch
3. Provide meaningful error messages to users
4. Clean up virtual filesystem on error
5. Allow cancellation of long-running renders

## SharedArrayBuffer and Multi-threading

FFmpeg.wasm can use multiple threads for faster encoding via SharedArrayBuffer:

- **SharedArrayBuffer**: Allows multiple Web Workers to share memory
- **COOP/COEP Headers**: Required for SharedArrayBuffer in browsers
- **Configuration**: Vite dev server includes these headers in `vite.config.ts`

Benefits:
- Multi-threaded encoding uses multiple CPU cores
- Can significantly speed up rendering on multi-core CPUs

Requirements:
- Browser must support SharedArrayBuffer (all modern browsers do)
- Page must be served with correct headers
- Cannot be used in cross-origin iframes

## FFmpeg Command Examples

### Trimming a Video
```bash
ffmpeg -i input.mp4 -ss 10 -to 20 -c copy output.mp4
```
Extracts 10-20 seconds without re-encoding.

### Concatenating Videos
```bash
ffmpeg -f concat -i concat.txt -c copy output.mp4
# concat.txt contains:
# file 'segment1.mp4'
# file 'segment2.mp4'
```

### Scaling and Padding
```bash
ffmpeg -i input.mp4 -vf "scale=320:240,pad=1280:720:100:50:black" output.mp4
```
Scales to 320x240, then pads to 1280x720 with black background, positioned at (100,50).

### Overlay Filtering
```bash
ffmpeg -i background.mp4 -i overlay.mp4 \
  -filter_complex "[0:v][1:v]overlay=100:50" \
  output.mp4
```
Overlays second video at position (100,50) on top of first.

### Volume Adjustment
```bash
ffmpeg -i input.mp3 -af "volume=0.5" output.mp3
```
Reduces volume to 50%.

### Rotation
```bash
ffmpeg -i input.mp4 -vf "rotate=PI/2" output.mp4
```
Rotates 90 degrees counter-clockwise.

## WASM Size and Load Time

FFmpeg.wasm adds significant size to the application:

- **Core JS**: ~200KB
- **WASM Binary**: ~20MB (gzipped: ~5MB)
- **Total**: ~5-6MB when fetched from CDN

**Load time**: 
- Initial load from CDN: 1-3 seconds (depends on network)
- Subsequent loads: Instant (in-memory cache)

Consider:
- Lazy load FFmpeg only when rendering needed
- Cache WASM in browser storage for faster subsequent loads
- Show progress indicator during load
- Background rendering to avoid UI freeze

## Tips for Best Results

1. **Consistent Media Format**: Use same video codec for all clips
2. **Keyframe Placement**: Insert keyframes at clip boundaries
3. **Audio Levels**: Normalize audio levels before rendering
4. **Test Preview**: Always preview in timeline before final render
5. **Backup Projects**: Save project data before rendering
6. **Monitor Resources**: Check browser tab memory usage
7. **Use Proxies**: Verify proxy playback before committing to final render

## Future Enhancements

Potential improvements to rendering:

- **GPU Acceleration**: Use WebGL/WebGPU for faster encoding
- **Worker Threads**: Offload rendering to Web Workers
- **Streaming Output**: Stream output as it's generated instead of buffering
- **Progressive Rendering**: Render segments in order, allow preview before complete
- **Batch Rendering**: Queue multiple projects for rendering
- **Cloud Fallback**: Button to upload and render on server for large projects
- **Custom Presets**: Save encoding profiles for quick selection
- **Adaptive Quality**: Automatically choose quality based on device capability
