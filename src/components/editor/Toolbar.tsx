import { useState } from "react"
import {
  Scissors,
  Copy,
  Clipboard,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Magnet,
  Plus,
  Film,
  Music,
} from "lucide-react"
import { useEditorStore } from "../../store/editorStore"
import { usePlayer } from "../../hooks/usePlayer"
import { TIMELINE_ZOOM } from "../../constants/timeline"
import { IconButton } from "../ui/IconButton"
import { Divider } from "../ui/Divider"
import { LabelButton } from "../ui/LabelButton"
import { Dropdown } from "../ui/Dropdown"

export function Toolbar() {
  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const playhead = useEditorStore(s => s.playhead)
  const timelineScale = useEditorStore(s => s.timelineScale)
  const splitClip = useEditorStore(s => s.splitClip)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const addTrack = useEditorStore(s => s.addTrack)
  const setTimelineScale = useEditorStore(s => s.setTimelineScale)
  const [snapEnabled, setSnapEnabled] = useState(false)

  const { seek } = usePlayer()

  return (
    <div
      className="flex items-center gap-0.5 px-3 h-10 shrink-0 bg-dark-surface border-t border-b border-dark-border"
    >
      {/* Edit group */}
      <IconButton
        icon={<Scissors />}
        label="Cut at playhead"
        size="sm"
        disabled={!selectedClipId}
        onClick={() => { if (selectedClipId) splitClip(selectedClipId, playhead) }}
      />
      <IconButton icon={<Copy />} label="Copy" size="sm" />
      <IconButton icon={<Clipboard />} label="Paste" size="sm" />

      <Divider />

      {/* History group */}
      <IconButton icon={<Undo2 />} label="Undo" size="sm" onClick={undo} />
      <IconButton icon={<Redo2 />} label="Redo" size="sm" onClick={redo} />

      <Divider />

      {/* Zoom group */}
      <IconButton
        icon={<ZoomIn />}
        label="Zoom in"
        size="sm"
        onClick={() => setTimelineScale(Math.min(TIMELINE_ZOOM.MAX, timelineScale + TIMELINE_ZOOM.STEP_BUTTON))}
      />
      <IconButton
        icon={<ZoomOut />}
        label="Zoom out"
        size="sm"
        onClick={() => setTimelineScale(Math.max(TIMELINE_ZOOM.MIN, timelineScale - TIMELINE_ZOOM.STEP_BUTTON))}
      />
      <IconButton
        icon={<Maximize2 />}
        label="Fit to screen"
        size="sm"
        onClick={() => seek(0)}
      />

      <Divider />

      {/* Snap toggle */}
      <IconButton
        icon={<Magnet />}
        label={snapEnabled ? "Disable snap" : "Enable snap"}
        size="sm"
        active={snapEnabled}
        onClick={() => setSnapEnabled(v => !v)}
      />

      <Divider />

      <Dropdown
        trigger={
          <LabelButton
            icon={<Plus />}
            label="Add Track"
            variant="ghost"
            size="sm"
          />
        }
        items={[
          { label: "Video Track", icon: <Film />, onClick: () => addTrack("video") },
          { label: "Audio Track", icon: <Music />, onClick: () => addTrack("audio") },
        ]}
      />
    </div>
  )
}

