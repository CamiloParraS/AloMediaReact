import { useState } from 'react';
import { Upload, Mic, FileText, SlidersHorizontal } from 'lucide-react';
import UploadMedia from './UploadMedia';
import AudioTools from './AudioTools';
import TranscriptTools from './TranscriptTools';
import VisualEnhancement from './VisualEnhancement';

type ActiveTool = 'upload' | 'audio' | 'transcript' | 'visual';

const TOOLS: { id: ActiveTool; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'upload', icon: Upload, label: 'Import' },
  { id: 'audio', icon: Mic, label: 'Audio' },
  { id: 'transcript', icon: FileText, label: 'Text' },
  { id: 'visual', icon: SlidersHorizontal, label: 'Visual' },
];

const PANELS: Record<ActiveTool, React.ReactNode> = {
  upload: <UploadMedia />,
  audio: <AudioTools />,
  transcript: <TranscriptTools />,
  visual: <VisualEnhancement />,
};

export default function MediaBox() {
  const [activeTool, setActiveTool] = useState<ActiveTool>('upload');

  return (
    <div
      id="media-box"
      className="w-full h-full border border-red-500/15 rounded-md col-span-2 row-span-3 hover:border-red-500/45 focus:border-red-500/45 transition-colors duration-300 bg-dark-card flex overflow-hidden"
    >
      {/* Sidebar tabs */}
      <aside className="h-full shrink-0 px-2 py-4 bg-burgundy rounded-l-md border-r-2 border-dark flex flex-col items-center gap-1">
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              className={`w-12 h-12 rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 cursor-pointer ${
                isActive
                  ? 'bg-dark-elevated/70 text-accent-white'
                  : 'text-muted hover:bg-dark-elevated/40 hover:text-muted-light'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-semibold leading-none">{tool.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Active tool panel */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {PANELS[activeTool]}
      </div>
    </div>
  );
}
