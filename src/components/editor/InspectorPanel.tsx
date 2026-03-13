import { useEffect, useMemo, useState } from "react"
import { Film, Gauge, RotateCcw, Volume2 } from "lucide-react"
import type { Clip } from "../../project/projectTypes"
import { useEditorStore } from "../../store/editorStore"
import { DEFAULT_SPEED, MAX_SPEED, MIN_SPEED } from "../../constants/speed"
import { RangeSlider } from "../ui/RangeSlider"
import { AudioConfigPanel } from "./AudioConfigPanel"
import { ColorAdjustmentsPanel } from "./ColorAdjustmentsPanel"

type InspectorTab = "video" | "audio" | "speed"

const SPEED_STEP = 0.05
const SPEED_LOG_DENOMINATOR = Math.log(MAX_SPEED) - Math.log(MIN_SPEED)

function positionToSpeed(position: number): number {
  return Math.exp(Math.log(MIN_SPEED) + position * SPEED_LOG_DENOMINATOR)
}

function speedToPosition(speed: number): number {
  return (Math.log(speed) - Math.log(MIN_SPEED)) / SPEED_LOG_DENOMINATOR
}

function quantizeSpeed(speed: number): number {
  const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed))
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(clamped / SPEED_STEP) * SPEED_STEP))
}

interface InspectorPanelProps {
  clip: Clip
}

export function InspectorPanel({ clip }: InspectorPanelProps) {
  const setClipSpeed = useEditorStore(s => s.setClipSpeed)

  const speed = useEditorStore(s => {
    for (const track of s.project.tracks) {
      const c = track.clips.find(c => c.id === clip.id)
      if (c && (c.type === "video" || c.type === "audio")) {
        return c.speed ?? DEFAULT_SPEED
      }
    }
    return DEFAULT_SPEED
  })

  const tabs = useMemo<InspectorTab[]>(() => {
    if (clip.type === "image") return ["video"]
    if (clip.type === "audio") return ["audio", "speed"]
    if (clip.type === "video") return ["video", "audio", "speed"]
    return []
  }, [clip.type])

  const [activeTab, setActiveTab] = useState<InspectorTab>(tabs[0] ?? "video")

  useEffect(() => {
    setActiveTab(tabs[0] ?? "video")
  }, [clip.id, tabs])

  const speedPosition = speedToPosition(Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed)))

  function handleSpeedPositionChange(position: number) {
    const computedSpeed = positionToSpeed(position)
    setClipSpeed(clip.id, quantizeSpeed(computedSpeed))
  }

  function renderContent(): React.ReactNode {
    if (activeTab === "video") {
      return <ColorAdjustmentsPanel clipId={clip.id} />
    }

    if (activeTab === "audio") {
      return <AudioConfigPanel clipId={clip.id} />
    }

    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-0.5">
          <div>
            <span className="text-xs text-muted">Speed</span>
            <span className="text-[11px] text-muted-light leading-tight block mb-2 opacity-55">
              Speeds up or slows down the clip, changing its duration on the timeline
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="font-mono text-xs text-muted-light tabular-nums w-14 text-right">
              {speed.toFixed(2)}×
            </span>
            <button
              onClick={() => setClipSpeed(clip.id, DEFAULT_SPEED)}
              disabled={Math.abs(speed - DEFAULT_SPEED) <= 0.001}
              title="Reset to default"
              className="text-muted hover:text-muted-light disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              aria-label="Reset speed to default"
            >
              <RotateCcw size={11} />
            </button>
          </div>
        </div>
        <RangeSlider
          value={speedPosition}
          min={0}
          max={1}
          step={0.001}
          label="Speed"
          onChange={handleSpeedPositionChange}
        />
      </div>
    )
  }

  const showTabs = tabs.length > 1

  return (
    <aside className="w-80 shrink-0 flex flex-col bg-dark-surface border-l border-dark-border overflow-hidden">
      {showTabs && (
        <div className="flex border-b border-dark-border bg-dark-card">
          {tabs.map(tab => {
            const active = activeTab === tab
            const label = tab === "video" ? "Video" : tab === "audio" ? "Audio" : "Speed"
            const Icon = tab === "video" ? Film : tab === "audio" ? Volume2 : Gauge

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${active ? "text-accent-white border-b-2 border-accent-red" : "text-muted hover:text-accent-white"}`}
                type="button"
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="overflow-y-auto flex-1 px-4 py-3">
        {renderContent()}
      </div>
    </aside>
  )
}