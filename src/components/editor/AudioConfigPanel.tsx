import { RotateCcw, Volume2, VolumeX } from "lucide-react"
import type { AudioConfig } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { DEFAULT_AUDIO_CONFIG } from "../../constants/audioConfig"
import { RangeSlider } from "../ui/RangeSlider"

interface SliderRowProps {
  label: string
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "0 8px",
        height: 28,
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : undefined,
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
          {displayValue}
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
          Audio Configuration
        </span>
      </div>

      {/* Mute row */}
      <div
        style={{
          height: 28,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 10, color: "var(--color-muted-light)" }}>Mute</span>
        <button
          onClick={() => set("muted", !config.muted)}
          aria-label={config.muted ? "Unmute" : "Mute"}
          title={config.muted ? "Unmute" : "Mute"}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          {config.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

      <SliderRow
        label="Volume"
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

      <SliderRow
        label="Fade In"
        value={config.fadeInDuration}
        min={0}
        max={10}
        step={0.1}
        defaultValue={DEFAULT_AUDIO_CONFIG.fadeInDuration}
        displayValue={`${config.fadeInDuration.toFixed(1)}s`}
        onChange={v => set("fadeInDuration", v)}
        onReset={() => reset("fadeInDuration")}
      />

      <SliderRow
        label="Fade Out"
        value={config.fadeOutDuration}
        min={0}
        max={10}
        step={0.1}
        defaultValue={DEFAULT_AUDIO_CONFIG.fadeOutDuration}
        displayValue={`${config.fadeOutDuration.toFixed(1)}s`}
        onChange={v => set("fadeOutDuration", v)}
        onReset={() => reset("fadeOutDuration")}
      />

      <SliderRow
        label="Balance"
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
  )
}
