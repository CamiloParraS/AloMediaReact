import { RotateCcw } from "lucide-react"
import type { ColorAdjustments } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../constants/colorAdjustments"
import { RangeSlider } from "../ui/RangeSlider"

interface SliderRowProps {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  defaultValue: number
  onChange: (v: number) => void
  onReset: () => void
}

function SliderRow({ label, hint, value, min, max, step, defaultValue, onChange, onReset }: SliderRowProps) {
  const isDefault = value === defaultValue
  const decimals = step < 0.1 ? 2 : 1

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <div>
          <span className="text-xs text-muted">{label}</span>
          <span className="text-[11px] text-muted-light leading-tight block mb-2 opacity-55">{hint}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="font-mono text-xs text-muted-light tabular-nums w-10 text-right">
            {value.toFixed(decimals)}
          </span>
          <button
            onClick={onReset}
            disabled={isDefault}
            title="Reset to default"
            className="text-muted hover:text-muted-light disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            aria-label={`Reset ${label} to default`}
          >
            <RotateCcw size={11} />
          </button>
        </div>
      </div>
      <RangeSlider
        value={value}
        min={min}
        max={max}
        step={step}
        label={label}
        onChange={onChange}
      />
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

  return (
    <div className="w-full pb-5">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
        Color Adjustments
      </h3>

      <div className="flex flex-col gap-4 pb-2">
        <SliderRow
          label="Brightness"
          hint="Lifts or darkens the overall exposure"
          value={adj.brightness}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={DEFAULT_COLOR_ADJUSTMENTS.brightness}
          onChange={v => set("brightness", v)}
          onReset={() => reset("brightness")}
        />

        <SliderRow
          label="Contrast"
          hint="Spreads tonal range between highlights and shadows"
          value={adj.contrast}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={DEFAULT_COLOR_ADJUSTMENTS.contrast}
          onChange={v => set("contrast", v)}
          onReset={() => reset("contrast")}
        />

        <SliderRow
          label="Saturation"
          hint="Controls color intensity"
          value={adj.saturation}
          min={0}
          max={3}
          step={0.01}
          defaultValue={DEFAULT_COLOR_ADJUSTMENTS.saturation}
          onChange={v => set("saturation", v)}
          onReset={() => reset("saturation")}
        />

        <SliderRow
          label="Gamma"
          hint="Adjusts midtone curve non-linearly"
          value={adj.gamma}
          min={0.1}
          max={10}
          step={0.1}
          defaultValue={DEFAULT_COLOR_ADJUSTMENTS.gamma}
          onChange={v => set("gamma", v)}
          onReset={() => reset("gamma")}
        />

        <SliderRow
          label="Exposure"
          hint="Shifts overall luminance in exposure stops"
          value={adj.exposure}
          min={-3}
          max={3}
          step={0.1}
          defaultValue={DEFAULT_COLOR_ADJUSTMENTS.exposure}
          onChange={v => set("exposure", v)}
          onReset={() => reset("exposure")}
        />

        <SliderRow
          label="Shadow"
          hint="Lifts or crushes dark tones independently"
          value={adj.shadow ?? DEFAULT_COLOR_ADJUSTMENTS.shadow ?? 0}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={DEFAULT_COLOR_ADJUSTMENTS.shadow ?? 0}
          onChange={v => set("shadow", v)}
          onReset={() => reset("shadow")}
        />

        <SliderRow
          label="Definition"
          hint="Adds or reduces local midtone contrast"
          value={adj.definition ?? DEFAULT_COLOR_ADJUSTMENTS.definition ?? 0}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={DEFAULT_COLOR_ADJUSTMENTS.definition ?? 0}
          onChange={v => set("definition", v)}
          onReset={() => reset("definition")}
        />
      </div>
    </div>
  )
}
