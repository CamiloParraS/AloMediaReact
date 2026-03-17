/** Sets up a ResizeObserver that scales `inner` to fit inside `container` at 1280px base width. */
export function setupCanvasScaling(container: HTMLElement, inner: HTMLElement): () => void {
  const update = () => {
    const scale = container.clientWidth / 1280
    inner.style.transform = `scale(${scale})`
  }
  update()
  const ro = new ResizeObserver(update)
  ro.observe(container)
  return () => ro.disconnect()
}
