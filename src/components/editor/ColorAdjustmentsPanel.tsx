import { RotateCcw } from "lucide-react"
import type { ColorAdjustments } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../constants/colorAdjustments"
import { RangeSlider } from "../ui/RangeSlider"

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  defaultValue: number
  onChange: (v: number) => void
  onReset: () => void
}

function SliderRow({ label, value, min, max, step, defaultValue, onChange, onReset }: SliderRowProps) {
  const isDefault = value === defaultValue
  const decimals = step < 0.1 ? 2 : 1

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "0 8px",
        height: 28,
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Label */}
        <span
          style={{
            fontSize: 10,
            color: "var(--color-muted-light)",
            width: 72,
            flexShrink: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>

        {/* Slider */}
        <div style={{ flex: 1 }}>
          <RangeSlider
            value={value}
            min={min}
            max={max}
            step={step}
            label={label}
            onChange={onChange}
          />
        </div>

        {/* Value readout */}
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 10,
            color: "var(--color-accent-white)",
            width: 36,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {value.toFixed(decimals)}
        </span>

        {/* Reset */}
        <button
          onClick={onReset}
          disabled={isDefault}
          title="Reset to default"
          style={{
            width: 16,
            height: 16,
            borderRadius: 0,
            border: "none",
            background: "transparent",
            color: "var(--color-muted)",
            cursor: isDefault ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            opacity: isDefault ? 0.3 : 1,
            flexShrink: 0,
          }}
          aria-label={`Reset ${label} to default`}
        >
          <RotateCcw size={10} />
        </button>
      </div>
    </div>
  )
}

interface ColorAdjustmentsPanelProps {
  clipId: string
}

export function ColorAdjustmentsPanel({ clipId }: ColorAdjustmentsPanelProps) {
  const updateClipColorAdjustments = useEditorStore(s => s.updateClipColorAdjustments)

  const adj = useEditorStore(s => {
    for (const track of s.project.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip && (clip.type === "video" || clip.type === "image")) {
        return clip.colorAdjustments ?? DEFAULT_COLOR_ADJUSTMENTS
      }
    }
    return DEFAULT_COLOR_ADJUSTMENTS
  })

  function set(key: keyof ColorAdjustments, value: number) {
    updateClipColorAdjustments(clipId, { ...adj, [key]: value })
  }

  function reset(key: keyof ColorAdjustments) {
    updateClipColorAdjustments(clipId, { ...adj, [key]: DEFAULT_COLOR_ADJUSTMENTS[key] })
  }

  const sliders: Array<{
    key: keyof ColorAdjustments
    label: string
    min: number
    max: number
    step: number
  }> = [
    { key: "brightness", label: "Brightness", min: -1, max: 1, step: 0.01 },
    { key: "contrast",   label: "Contrast",   min: -1, max: 1, step: 0.01 },
    { key: "saturation", label: "Saturation", min: 0,  max: 3, step: 0.01 },
    { key: "gamma",      label: "Gamma",      min: 0.1, max: 10, step: 0.1 },
    { key: "exposure",   label: "Exposure",   min: -3, max: 3,  step: 0.1 },
    { key: "shadow",     label: "Shadow",     min: -1, max: 1,  step: 0.01 },
    { key: "definition", label: "Definition", min: -1, max: 1,  step: 0.01 },
  ]

  return (
    <div className="w-full">
      {/* Section header */}
      <div
        style={{
          height: 24,
          background: "var(--color-dark)",
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--color-dark-border)",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
          }}
        >
          Color Adjustments
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {sliders.map(s => (
          <SliderRow
            key={s.key}
            label={s.label}
            value={(adj[s.key] as number) ?? DEFAULT_COLOR_ADJUSTMENTS[s.key] ?? 0}
            min={s.min}
            max={s.max}
            step={s.step}
            defaultValue={DEFAULT_COLOR_ADJUSTMENTS[s.key] as number ?? 0}
            onChange={v => set(s.key, v)}
            onReset={() => reset(s.key)}
          />
        ))}
      </div>
    </div>
  )
}
