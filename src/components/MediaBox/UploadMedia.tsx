import { useState, useCallback } from 'react';
import { Upload, Film, Music, Image } from 'lucide-react';

export default function UploadMedia() {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // TODO: pass dropped files to the media library / timeline
    void Array.from(e.dataTransfer.files);
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    // TODO: pass selected files to the media library / timeline
    void Array.from(e.target.files);
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-muted text-xs font-semibold uppercase tracking-widest px-1">Import Media</p>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed p-6 transition-all duration-200 cursor-pointer ${
          isDragging
            ? 'border-blood-red/70 bg-blood-red/10'
            : 'border-dark-border hover:border-blood-red/40 hover:bg-glass'
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-blood-red/15 flex items-center justify-center">
          <Upload className="w-5 h-5 text-accent-red" />
        </div>
        <div className="text-center">
          <p className="text-accent-white text-xs font-semibold">Drop files here</p>
          <p className="text-muted text-xs mt-0.5">or click to browse</p>
        </div>
        <input
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>

      {/* Accepted types hint */}
      <div className="flex items-center justify-center gap-4">
        <span className="flex items-center gap-1.5 text-muted text-xs">
          <Film className="w-3 h-3" /> Video
        </span>
        <span className="flex items-center gap-1.5 text-muted text-xs">
          <Music className="w-3 h-3" /> Audio
        </span>
        <span className="flex items-center gap-1.5 text-muted text-xs">
          <Image className="w-3 h-3" /> Images
        </span>
      </div>
    </div>
  );
}
