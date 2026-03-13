import { RotateCcw, Volume2, VolumeX } from "lucide-react"
import type { AudioConfig } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { DEFAULT_AUDIO_CONFIG } from "../../constants/audioConfig"
import { RangeSlider } from "../ui/RangeSlider"

interface SliderRowProps {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  defaultValue: number
  displayValue: string
  onChange: (v: number) => void
  onReset: () => void
  disabled?: boolean
}

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  defaultValue,
  displayValue,
  onChange,
  onReset,
  disabled = false,
}: SliderRowProps) {
  const isDefault = value === defaultValue

  return (
    <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
      <div className="flex items-center justify-between mb-0.5">
        <div>
          <span className="text-xs text-muted">{label}</span>
          <span className="text-[11px] text-muted-light leading-tight block mb-2 opacity-55">{hint}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="font-mono text-xs text-muted-light tabular-nums w-10 text-right">
            {displayValue}
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

function formatBalance(v: number): string {
  if (Math.abs(v) <= 0.001) return "C"
  if (Math.abs(v - -1.0) <= 0.001) return "L"
  if (Math.abs(v - 1.0) <= 0.001) return "R"
  return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)
}

interface AudioConfigPanelProps {
  clipId: string
}

export function AudioConfigPanel({ clipId }: AudioConfigPanelProps) {
  const updateClipAudioConfig = useEditorStore(s => s.updateClipAudioConfig)

  const config = useEditorStore(s => {
    for (const track of s.project.tracks) {
      const c = track.clips.find(c => c.id === clipId)
      if (c && (c.type === "video" || c.type === "audio")) {
        return (c as { audioConfig?: AudioConfig }).audioConfig ?? DEFAULT_AUDIO_CONFIG
      }
    }
    return DEFAULT_AUDIO_CONFIG
  })

  function set(key: keyof AudioConfig, value: number | boolean) {
    updateClipAudioConfig(clipId, { [key]: value })
  }

  function reset(key: keyof AudioConfig) {
    updateClipAudioConfig(clipId, { [key]: DEFAULT_AUDIO_CONFIG[key] })
  }

  return (
    <div className="w-full pb-5">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
        Audio Configuration
      </h3>

      <div className="flex flex-col gap-4 pb-2">
        {/* Mute toggle */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <div>
              <span className="text-xs text-muted">Mute</span>
              <span className="text-[11px] text-muted-light leading-tight block mt-0.5 opacity-75">Silence audio without removing it</span>
            </div>
            <button
              onClick={() => set("muted", !config.muted)}
              aria-label={config.muted ? "Unmute" : "Mute"}
              title={config.muted ? "Unmute" : "Mute"}
              className="text-muted hover:text-muted-light editor-transition"
            >
              {config.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
        </div>

        {/* Volume slider — visually disabled when muted */}
        <SliderRow
          label="Volume"
          hint="Adjust output loudness"
          value={config.volume}
          min={0}
          max={2}
          step={0.01}
          defaultValue={DEFAULT_AUDIO_CONFIG.volume}
          displayValue={`${Math.round(config.volume * 100)}%`}
          onChange={v => set("volume", v)}
          onReset={() => reset("volume")}
          disabled={config.muted}
        />

        {/* Fade In */}
        <SliderRow
          label="Fade In"
          hint="Ramp up from silence at clip start"
          value={config.fadeInDuration}
          min={0}
          max={10}
          step={0.1}
          defaultValue={DEFAULT_AUDIO_CONFIG.fadeInDuration}
          displayValue={`${config.fadeInDuration.toFixed(1)}s`}
          onChange={v => set("fadeInDuration", v)}
          onReset={() => reset("fadeInDuration")}
        />

        {/* Fade Out */}
        <SliderRow
          label="Fade Out"
          hint="Ramp down to silence at clip end"
          value={config.fadeOutDuration}
          min={0}
          max={10}
          step={0.1}
          defaultValue={DEFAULT_AUDIO_CONFIG.fadeOutDuration}
          displayValue={`${config.fadeOutDuration.toFixed(1)}s`}
          onChange={v => set("fadeOutDuration", v)}
          onReset={() => reset("fadeOutDuration")}
        />

        {/* Balance */}
        <SliderRow
          label="Balance"
          hint="Pan audio between left and right channels"
          value={config.balance}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={DEFAULT_AUDIO_CONFIG.balance}
          displayValue={formatBalance(config.balance)}
          onChange={v => set("balance", v)}
          onReset={() => reset("balance")}
        />
      </div>
    </div>
  )
}
