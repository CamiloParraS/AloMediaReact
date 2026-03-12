import type { ColorAdjustments, Transform } from "../../project/projectTypes"
import { buildCssFilter } from "../../utils/colorAdjustmentFilters"

/** Returns a CSS-compatible style object for a clip transform (used in React JSX). */
export function applyTransform(t: Transform) {
  return {
    position: "absolute" as const,
    left: t.x,
    top: t.y,
    width: t.width,
    height: t.height,
    transform: `rotate(${t.rotation}deg)`,
  }
}

/** Applies a clip transform directly to an HTMLElement (used in RAF loop). */
export function applyTransformToEl(el: HTMLElement, t: Transform): void {
  el.style.left = `${t.x}px`
  el.style.top = `${t.y}px`
  el.style.width = `${t.width}px`
  el.style.height = `${t.height}px`
  el.style.transform = `rotate(${t.rotation}deg)`
}

/** Applies a clip's color adjustments as a CSS filter to an HTMLElement (used in RAF loop). */
export function applyColorAdjustmentsToEl(el: HTMLElement, adj: ColorAdjustments | undefined): void {
  el.style.filter = adj ? buildCssFilter(adj) : ""
}
