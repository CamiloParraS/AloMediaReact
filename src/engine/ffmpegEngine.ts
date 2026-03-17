import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL } from "@ffmpeg/util"

const ffmpeg = new FFmpeg()

export function getFFmpeg(): FFmpeg {
  return ffmpeg
}

export async function loadFFmpeg(): Promise<void> {
  if (ffmpeg.loaded) return
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm"
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  })
}

export async function execFFmpeg(args: string[]): Promise<void> {
  const code = await ffmpeg.exec(args)
  if (code !== 0) {
    throw new Error(`FFmpeg exited with code ${code}`)
  }
}
