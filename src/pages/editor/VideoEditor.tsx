import { useRef, useState } from "react"
import { Settings2, Save, Upload, Share2 } from "lucide-react"
import { MediaLibrary } from "../../components/editor/MediaLibrary"
import { Timeline } from "../../components/editor/Timeline"
import { Toolbar } from "../../components/editor/Toolbar"
import { PreviewPlayer } from "../../components/editor/PreviewPlayer"
import { InspectorPanel } from "../../components/editor/InspectorPanel"
import { ExportModal } from "../../components/editor/ExportModal"
import { useEditorStore } from "../../store/editorStore"
import { exportProjectJSON, loadProject } from "../../project/projectSerializer"
import { useExport } from "../../hooks/useExport"
import { IconButton } from "../../components/ui/IconButton"
import { LabelButton } from "../../components/ui/LabelButton"

export default function VideoEditor() {
  const project = useEditorStore(s => s.project)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(project.name)
  const [showExportModal, setShowExportModal] = useState(false)
  const loadInputRef = useRef<HTMLInputElement>(null)

  const { startExport, cancelExport, progress, isExporting } = useExport()

  const selectedClip = useEditorStore(s => {
    if (!s.selectedClipId) return null
    for (const t of s.project.tracks) {
      const c = t.clips.find(c => c.id === s.selectedClipId)
      if (c) return c
    }
    return null
  })
  const showInspector = selectedClip?.type === "video" || selectedClip?.type === "image" || selectedClip?.type === "audio"

  function handleLoadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const loaded = loadProject(ev.target?.result as string)
        useEditorStore.setState({ project: loaded })
      } catch (err) {
        alert(String(err))
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  function commitTitle() {
    useEditorStore.setState(s => ({
      project: { ...s.project, name: titleDraft.trim() || "Untitled Project" },
    }))
    setIsEditingTitle(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-dark text-accent-white font-sans">

      {/* ── Topbar ── */}
      <header className="flex items-center justify-between px-4 h-12 shrink-0 bg-dark-surface border-b border-dark-border">
        {isEditingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur() }}
            className="bg-transparent text-sm font-bold text-accent-white border-b border-dark-border-light px-1 focus:outline-none w-48 cursor-text"
          />
        ) : (
          <button
            onDoubleClick={() => { setTitleDraft(project.name); setIsEditingTitle(true) }}
            className="text-sm font-bold text-accent-white hover:text-muted-light editor-transition tracking-wide truncate max-w-xs cursor-text"
            title="Double-click to rename"
          >
            {project.name}
          </button>
        )}

        <div className="flex items-center gap-1.5">
          <IconButton
            icon={<Settings2 />}
            label="Load project"
            variant="ghost"
            onClick={() => loadInputRef.current?.click()}
          />
          <LabelButton
            icon={<Save />}
            label="Save"
            variant="secondary"
            size="sm"
            onClick={() => exportProjectJSON(project)}
          />
          <LabelButton
            icon={<Upload />}
            label="Export"
            variant="primary"
            size="sm"
            loading={isExporting}
            onClick={() => setShowExportModal(true)}
          />
          <IconButton icon={<Share2 />} label="Share" variant="ghost" />
        </div>
      </header>

      {/* ── Middle row: Media panel + Preview ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-72 shrink-0 flex flex-col bg-dark-surface border-r border-dark-border overflow-hidden">
          <MediaLibrary />
        </aside>

        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden bg-dark">
          <PreviewPlayer />
        </div>

        {showInspector && selectedClip && (
          <InspectorPanel clip={selectedClip} />
        )}
      </div>

      {/* ── Toolbar ── */}
      <Toolbar />

      {/* ── Timeline ── */}
      <div className="flex flex-col shrink-0 overflow-hidden" style={{ height: 260 }}>
        <Timeline />
      </div>

      <input
        ref={loadInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleLoadFile}
      />

      {showExportModal && (
        <ExportModal
          isExporting={isExporting}
          progress={progress}
          onStart={(options) => {
            startExport(options)
          }}
          onCancel={() => {
            cancelExport()
            setShowExportModal(false)
          }}
          onClose={() => {
            if (!isExporting) setShowExportModal(false)
          }}
          defaultFileName={`${project.name}_export`}
        />
      )}
    </div>
  )
}
