import { fileMap } from "../../store/editorStore"
import type { ProxyState } from "../../store/editorStore"

/**
 * Manages object URLs for media files. Creates URLs lazily and caches them.
 * Call `revokeAll()` on unmount to release browser resources.
 */
export class ObjectUrlRegistry {
  private urls = new Map<string, string>()

  /** Returns a cached object URL for the raw media file, creating one if needed. */
  getObjectUrl(mediaId: string): string | undefined {
    const existing = this.urls.get(mediaId)
    if (existing) return existing
    const file = fileMap.get(mediaId)
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    this.urls.set(mediaId, url)
    return url
  }

  /** Returns the proxy URL if ready, otherwise falls back to the raw object URL. */
  getPlaybackUrl(mediaId: string, proxyMap: Record<string, ProxyState>): string | undefined {
    const proxy = proxyMap[mediaId]
    if (proxy?.status === "ready" && proxy.objectUrl) return proxy.objectUrl
    return this.getObjectUrl(mediaId)
  }

  /** Revokes all cached object URLs. */
  revokeAll(): void {
    this.urls.forEach(url => URL.revokeObjectURL(url))
    this.urls.clear()
  }
}
