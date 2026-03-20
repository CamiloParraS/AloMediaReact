import { useRef, useState } from "react"
import { FolderOpen, Save, Share2, Film } from "lucide-react"
import { MediaLibrary } from "../../components/editor/MediaLibrary"
import { Timeline } from "../../components/editor/Timeline"
import { Toolbar } from "../../components/editor/Toolbar"
import { PreviewPlayer } from "../../components/editor/PreviewPlayer"
import { InspectorPanel } from "../../components/editor/InspectorPanel"
import { ExportModal } from "../../components/editor/ExportModal"
import { LabelButton } from "../../components/ui/LabelButton"
import { useEditorStore } from "../../store/editorStore"
import { exportProjectJSON, loadProject } from "../../project/projectSerializer"
import { useExport } from "../../hooks/useExport"
import { useEditorKeyboardShortcuts } from "../../hooks/useEditorKeyboardShortcuts"

export default function VideoEditor() {
  const project = useEditorStore(s => s.project)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(project.name)
  const [showExportModal, setShowExportModal] = useState(false)
  const loadInputRef = useRef<HTMLInputElement>(null)

  const { startExport, cancelExport, progress, isExporting } = useExport()
  useEditorKeyboardShortcuts()

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
    <div className="flex flex-col h-screen overflow-hidden bg-dark text-accent-white font-sans select-none cursor-default">

      {/* ── Topbar ── */}
      <header
        className="flex items-center shrink-0 gap-0"
        style={{
          height: 40,
          background: "var(--color-dark)",
          borderBottom: "1px solid var(--color-dark-border)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center shrink-0"
          style={{
            padding: "0 12px",
            borderRight: "1px solid var(--color-dark-border)",
            height: "100%",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.15em",
              color: "var(--color-accent-red)",
            }}
          >
            ALO
          </span>
        </div>

        {/* Project title */}
        <div
          className="flex items-center"
          style={{ padding: "0 12px", height: "100%", borderRight: "1px solid var(--color-dark-border)", width: 184 }}
        >
          <div className="relative w-full flex items-center" style={{ height: 24 }}>
            {isEditingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur() }}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "var(--color-dark-elevated)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-accent-white)",
                  border: "1px solid var(--color-accent-red)",
                  borderRadius: 4,
                  outline: "none",
                  padding: "0 8px",
                  width: "100%",
                  height: "100%",
                  fontFamily: "inherit",
                  lineHeight: "normal",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                }}
              />
            ) : (
              <button
                onDoubleClick={() => { setTitleDraft(project.name); setIsEditingTitle(true) }}
                onMouseEnter={e => { e.currentTarget.style.background = "#18181f"; e.currentTarget.style.borderColor = "var(--color-dark-border)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                  style={{
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 4,
                  padding: "0 8px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-accent-white)",
                  cursor: "text",
                  width: "100%",
                  height: "100%",
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  lineHeight: "normal",
                  display: "flex",
                  alignItems: "center",
                  boxSizing: "border-box",
                  transition: "background 150ms, border-color 150ms",
                }}
                title="Double-click to rename"
              >
                {project.name}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center" style={{ gap: 4, padding: "0 8px" }}>
          <LabelButton
            icon={<FolderOpen size={12} />}
            label="Load"
            variant="secondary"
            size="sm"
            onClick={() => loadInputRef.current?.click()}
          />
          <LabelButton
            icon={<Save size={12} />}
            label="Save"
            variant="secondary"
            size="sm"
            onClick={() => exportProjectJSON(project)}
          />
          <LabelButton
            icon={<Share2 size={12} />}
            label="Share"
            variant="secondary"
            size="sm"
          />
          <LabelButton
            icon={<Film size={12} />}
            label="Export"
            variant="accent"
            size="sm"
            disabled={isExporting}
            onClick={() => setShowExportModal(true)}
          />
        </div>
      </header>

      {/* ── Middle row: Media panel + Preview + Inspector ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ gap: 0 }}>
        {/* Media Library — fixed 240px */}
        <aside
          className="shrink-0 flex flex-col overflow-hidden"
          style={{
            width: 240,
            background: "var(--color-dark-surface)",
            borderRight: "1px solid var(--color-dark-border)",
          }}
        >
          <MediaLibrary />
        </aside>

        {/* Preview Player — flex 1 */}
        <div
          className="flex flex-1 min-h-0 min-w-0 overflow-hidden"
          style={{ background: "var(--color-dark)", minWidth: 480 }}
        >
          <PreviewPlayer />
        </div>

        {/* Inspector Panel — fixed 280px, hidden when no clip */}
        {showInspector && selectedClip ? (
          <InspectorPanel clip={selectedClip} />
        ) : null}
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
